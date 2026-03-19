import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, AlertTriangle, FileSpreadsheet, CheckCircle, ArrowRight, FileText, CalendarDays, Calculator, Bus, Coffee } from 'lucide-react';

export default function App() {
  // Aba Ativa
  const [activeTab, setActiveTab] = useState('salario'); // 'salario' | 'beneficios'

  // Estados Globais / Salário
  const [cadastroFile, setCadastroFile] = useState(null);
  const [espelhoFile, setEspelhoFile] = useState(null);
  const [processedData, setProcessedData] = useState([]);
  const [errors, setErrors] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [paymentType, setPaymentType] = useState('1');

  // Estados Nova Aba: Benefícios (VT/VR)
  const [periodo, setPeriodo] = useState({ start: '', end: '', feriados: 0 });
  const [diasUteisBase, setDiasUteisBase] = useState(0);
  const [valorVRDiario, setValorVRDiario] = useState('');
  const [beneficiosData, setBeneficiosData] = useState([]);
  const [beneficiosOverrides, setBeneficiosOverrides] = useState({});

  const fileInputCadastro = useRef(null);
  const fileInputEspelho = useRef(null);

  useEffect(() => {
    const loadDependencies = async () => {
      // Carrega Leitor de Excel
      if (!window.XLSX) {
        const xlsxScript = document.createElement('script');
        xlsxScript.src = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
        document.body.appendChild(xlsxScript);
        await new Promise(r => xlsxScript.onload = r);
      }
      // Carrega Leitor de PDF (Para espelho)
      if (!window.pdfjsLib) {
        const pdfScript = document.createElement('script');
        pdfScript.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        document.body.appendChild(pdfScript);
        await new Promise(r => pdfScript.onload = r);
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      }
      // Carrega Gerador de PDF (Para recibos)
      if (!window.jspdf) {
        const jspdfScript = document.createElement('script');
        jspdfScript.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        document.body.appendChild(jspdfScript);
        await new Promise(r => jspdfScript.onload = r);
      }
      setIsReady(true);
    };
    loadDependencies();
  }, []);

  // ---------- FUNÇÕES COMPARTILHADAS ----------
  const normalizeKey = (key) => {
    if (!key) return '';
    return String(key).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  };

  const normalizeText = (text) => {
    if (!text) return '';
    return String(text).trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  };

  const handleFileUpload = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      if (type === 'cadastro') {
        setCadastroFile(file);
        setBeneficiosData([]);
      }
      if (type === 'espelho') setEspelhoFile(file);
    }
  };

  // ---------- FUNÇÕES ABA 1: SALÁRIO ----------
  const getBankCode = (bankStr) => {
    const str = String(bankStr).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (str.includes('ITAU')) return '341';
    if (str.includes('BRADESCO')) return '237';
    if (str.includes('BRASIL') || str === 'BB') return '001';
    if (str.includes('CAIXA') || str.includes('CEF')) return '104';
    if (str.includes('SANTANDER')) return '033';
    if (str.includes('NUBANK')) return '260';
    if (str.includes('INTER')) return '077';
    if (str.includes('C6')) return '336';
    if (str.includes('SICOOB')) return '756';
    if (str.includes('SICREDI')) return '748';
    if (str.includes('SAFRA')) return '422';
    if (str.includes('BTG')) return '208';
    if (str.includes('ORIGINAL')) return '212';
    if (str.includes('PAGBANK') || str.includes('PAGSEGURO')) return '290';
    if (str.includes('NEON')) return '735';
    if (str.includes('MERCADO PAGO')) return '323';
    if (/^\d+$/.test(str.trim())) return str.trim(); 
    return str; 
  };

  const formatCPF = (cpfRaw) => {
    let cpf = String(cpfRaw).replace(/[^\d]/g, '');
    if (cpf.length > 0 && cpf.length <= 11) {
      cpf = cpf.padStart(11, '0');
      return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return cpfRaw;
  };

  const processFiles = async () => {
    if (!cadastroFile || !espelhoFile) {
      alert("Por favor, faça o upload de ambos os arquivos.");
      return;
    }
    setIsProcessing(true);
    setErrors([]);
    setProcessedData([]);

    try {
      const [cadastroBuffer, espelhoBuffer] = await Promise.all([
        cadastroFile.arrayBuffer(),
        espelhoFile.arrayBuffer()
      ]);

      const cadastroWb = window.XLSX.read(cadastroBuffer, { type: 'array' });
      const cadastroData = window.XLSX.utils.sheet_to_json(cadastroWb.Sheets[cadastroWb.SheetNames[0]], { defval: "" });

      const cadastroMap = {};
      cadastroData.forEach((row) => {
        const matKey = Object.keys(row).find(k => normalizeKey(k) === 'matricula');
        const nomeKey = Object.keys(row).find(k => normalizeKey(k) === 'nome');
        if (matKey && row[matKey]) {
          const matStr = String(row[matKey]).trim();
          const safeMat = matStr.replace(/^0+/, '') || '0'; 
          cadastroMap[safeMat] = {
            ...row,
            _safeMat: safeMat,
            _safeNome: normalizeText(nomeKey ? String(row[nomeKey]) : '')
          };
        }
      });

      const pdfData = new Uint8Array(espelhoBuffer);
      const pdf = await window.pdfjsLib.getDocument({data: pdfData}).promise;
      const pdfLines = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const items = textContent.items;
        items.sort((a, b) => Math.abs(b.transform[5] - a.transform[5]) > 5 ? b.transform[5] - a.transform[5] : a.transform[4] - b.transform[4]);
        let currentLine = [];
        let currentY = items.length > 0 ? items[0].transform[5] : 0;
        items.forEach(item => {
          const text = item.str.trim();
          if (Math.abs(item.transform[5] - currentY) > 5) {
            if (currentLine.length > 0) pdfLines.push(currentLine.join(" "));
            currentLine = text ? [text] : [];
            currentY = item.transform[5];
          } else if (text) currentLine.push(text);
        });
        if (currentLine.length > 0) pdfLines.push(currentLine.join(" "));
      }

      const result = [];
      const currentErrors = [];
      const matriculasEncontradas = new Set();
      pdfLines.forEach((line) => {
        const lineNormalized = normalizeText(line);
        Object.keys(cadastroMap).forEach(safeMat => {
          const empData = cadastroMap[safeMat];
          const regexMat = new RegExp(`\\b0*${safeMat}\\b`);
          const primeiroNome = empData._safeNome.split(' ')[0] || '';
          if (regexMat.test(line) && lineNormalized.includes(primeiroNome)) {
            const valueMatches = line.match(/(?:\d{1,3}(?:\.\d{3})*|\d+),\d{2}/g);
            if (valueMatches && !matriculasEncontradas.has(safeMat)) {
              const valor = parseFloat(valueMatches[valueMatches.length - 1].replace(/\./g, '').replace(',', '.'));
              if (valor > 0) {
                matriculasEncontradas.add(safeMat);
                const getVal = (s) => empData[Object.keys(empData).find(k => normalizeKey(k).includes(s))] || "";
                const contaFull = String(getVal('conta')).trim();
                const rowData = [String(getVal('agencia')).trim(), contaFull.split('-')[0], contaFull.split('-')[1] || "", getVal('nome'), formatCPF(getVal('cpf')), paymentType, valor];
                result.push(rowData);
              }
            }
          }
        });
      });
      if (result.length === 0) currentErrors.push("Erro: Nenhuma matrícula associada. Verifique o formato do PDF.");
      setProcessedData(result);
      setErrors(currentErrors);
    } catch (e) { setErrors(["Erro ao processar arquivos."]); } finally { setIsProcessing(false); }
  };

  const exportToExcel = () => {
    const ws = window.XLSX.utils.aoa_to_sheet(processedData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Pagamentos");
    window.XLSX.writeFile(wb, `Pagamentos_${paymentType === '1' ? 'Salario' : 'Adiantamento'}.xlsx`);
  };

  const totalSoma = processedData.reduce((acc, row) => acc + (typeof row[6] === 'number' ? row[6] : 0), 0);

  // Benefícios
  useEffect(() => {
    if (periodo.start && periodo.end) {
      let count = 0; let curr = new Date(periodo.start + 'T00:00:00');
      while (curr <= new Date(periodo.end + 'T00:00:00')) {
        if (curr.getDay() !== 0 && curr.getDay() !== 6) count++;
        curr.setDate(curr.getDate() + 1);
      }
      setDiasUteisBase(Math.max(0, count - (parseInt(periodo.feriados) || 0)));
    }
  }, [periodo]);

  const carregarColaboradoresBeneficios = async () => {
    setIsProcessing(true);
    try {
      const buf = await cadastroFile.arrayBuffer();
      const data = window.XLSX.utils.sheet_to_json(window.XLSX.read(buf, { type: 'array' }).Sheets[0], { defval: "" });
      const list = data.map(row => {
        const getVal = (s) => row[Object.keys(row).find(k => normalizeKey(k).includes(s))] || "";
        const c = String(getVal('conta')).trim();
        return { matricula: String(getVal('matricula')).trim(), nome: getVal('nome'), agencia: getVal('agencia'), conta: c.split('-')[0], digito: c.split('-')[1] || "", cpf: formatCPF(getVal('cpf')) };
      }).filter(i => i.matricula && i.nome).sort((a,b) => a.nome.localeCompare(b.nome));
      setBeneficiosData(list);
    } catch (e) { alert("Erro ao ler cadastro."); } finally { setIsProcessing(false); }
  };

  const updateOverride = (m, f, v) => setBeneficiosOverrides(p => ({ ...p, [m]: { ...(p[m] || { ausencias: 0, descontoVT: 0, descontoVR: 0, acrescimosVT: 0, acrescimosVR: 0, obs: '', valorVT: '' }), [f]: v } }));

  const generateReceiptsPDF = () => {
    const { jsPDF } = window.jspdf; const doc = new jsPDF(); const vrD = parseFloat(valorVRDiario) || 0;
    let added = false;
    beneficiosData.forEach(colab => {
      const o = beneficiosOverrides[colab.matricula] || {};
      const tVT = Math.max(0, diasUteisBase - (parseInt(o.ausencias)||0) - (parseInt(o.descontoVT)||0) + (parseInt(o.acrescimosVT)||0)) * (parseFloat(o.valorVT)||0);
      const tVR = (Math.max(0, diasUteisBase - (parseInt(o.ausencias)||0) - (parseInt(o.descontoVR)||0) + (parseInt(o.acrescimosVR)||0)) * vrD) * 0.91;
      if (tVT + tVR <= 0) return;
      if (added) doc.addPage(); added = true;
      doc.setFontSize(16); doc.text("RECIBO DE BENEFÍCIOS", 105, 20, {align:"center"});
      doc.setFontSize(11); doc.text(`Colaborador: ${colab.nome}`, 20, 35);
      doc.text(`Total VT: R$ ${tVT.toFixed(2)} | Total VR: R$ ${tVR.toFixed(2)}`, 20, 50);
      doc.setFontSize(14); doc.text(`TOTAL GERAL: R$ ${(tVT+tVR).toFixed(2)}`, 20, 70);
      doc.line(40, 110, 170, 110); doc.text(colab.nome, 105, 117, {align:"center"});
    });
    doc.save("Recibos.pdf");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans pb-20">
      <div className="max-w-full mx-auto space-y-6"> {/* Alterado para max-w-full */}
        
        {/* Header Principal Atualizado com Logo */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 flex flex-col md:flex-row items-center justify-between border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
            <div className="flex items-center space-x-4">
              {/* Adicionada a Logo aqui */}
              <img src="/logo.png" alt="Logo" className="h-14 w-auto object-contain rounded" />
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Sistema Integrado de DP</h1>
                <p className="text-sm text-gray-600 mt-1">Automatização de Remessas e Benefícios</p>
              </div>
            </div>
          </div>
          
          <div className="flex border-b border-gray-200">
            <button onClick={() => setActiveTab('salario')} className={`flex-1 py-4 px-6 text-sm font-bold transition-colors flex justify-center items-center space-x-2 ${activeTab === 'salario' ? 'text-blue-700 bg-blue-50 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>
              <Calculator className="w-5 h-5" /> <span>Remessa de Salário / Adiantamento</span>
            </button>
            <button onClick={() => setActiveTab('beneficios')} className={`flex-1 py-4 px-6 text-sm font-bold transition-colors flex justify-center items-center space-x-2 ${activeTab === 'beneficios' ? 'text-blue-700 bg-blue-50 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>
              <Bus className="w-5 h-5" /> <span>Controle VT e VR</span>
            </button>
          </div>
        </div>

        {/* ... Restante do seu código (Salário e Benefícios) mantém a mesma lógica ... */}
        {activeTab === 'salario' && (
           <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
                <div className={`p-4 rounded-full mb-4 ${cadastroFile ? 'bg-green-100' : 'bg-blue-50'}`}>
                  {cadastroFile ? <CheckCircle className="w-8 h-8 text-green-600" /> : <Upload className="w-8 h-8 text-blue-600" />}
                </div>
                <h2 className="text-lg font-semibold">1. Planilha Base de Cadastro</h2>
                <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputCadastro} onChange={(e) => handleFileUpload(e, 'cadastro')} />
                <button onClick={() => fileInputCadastro.current.click()} className="mt-4 px-6 py-2 border rounded-lg text-blue-600 bg-blue-50">{cadastroFile ? cadastroFile.name : 'Selecionar Arquivo'}</button>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
                 <div className={`p-4 rounded-full mb-4 ${espelhoFile ? 'bg-green-100' : 'bg-blue-50'}`}>
                  {espelhoFile ? <CheckCircle className="w-8 h-8 text-green-600" /> : <FileText className="w-8 h-8 text-blue-600" />}
                </div>
                <h2 className="text-lg font-semibold">2. Espelho de Salário (PDF)</h2>
                <input type="file" accept=".pdf" className="hidden" ref={fileInputEspelho} onChange={(e) => handleFileUpload(e, 'espelho')} />
                <button onClick={() => fileInputEspelho.current.click()} className="mt-4 px-6 py-2 border rounded-lg text-blue-600 bg-blue-50">{espelhoFile ? espelhoFile.name : 'Selecionar PDF'}</button>
              </div>
              <div className="flex justify-center">
                <button onClick={processFiles} className="px-10 py-3 bg-blue-600 text-white rounded-lg font-bold shadow-md hover:bg-blue-700">PROCESSAR FOLHA</button>
              </div>
              {processedData.length > 0 && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex justify-between mb-4">
                    <h3 className="font-bold">Prévia dos Pagamentos</h3>
                    <button onClick={exportToExcel} className="bg-green-600 text-white px-4 py-2 rounded shadow">Baixar Excel p/ Banco</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead><tr className="bg-gray-50 border-b text-xs uppercase text-gray-500 font-bold"><th className="p-3">Nome</th><th className="p-3">CPF</th><th className="p-3 text-right">Valor</th></tr></thead>
                      <tbody>{processedData.map((r,i) => (<tr key={i} className="border-b hover:bg-gray-50"><td className="p-3 font-medium">{r[3]}</td><td className="p-3 font-mono">{r[4]}</td><td className="p-3 text-right text-green-600 font-bold">R$ {r[6].toFixed(2)}</td></tr>))}</tbody>
                    </table>
                  </div>
                </div>
              )}
           </div>
        )}

        {/* ... Seção de Benefícios igual ao seu original ... */}
        {activeTab === 'beneficios' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div><label className="text-xs font-bold text-gray-500 uppercase">Início</label><input type="date" className="w-full border rounded p-2" onChange={e => setPeriodo({...periodo, start: e.target.value})} /></div>
              <div><label className="text-xs font-bold text-gray-500 uppercase">Fim</label><input type="date" className="w-full border rounded p-2" onChange={e => setPeriodo({...periodo, end: e.target.value})} /></div>
              <div><label className="text-xs font-bold text-gray-500 uppercase">VR Diário (R$)</label><input type="number" className="w-full border rounded p-2" placeholder="0.00" onChange={e => setValorVRDiario(e.target.value)} /></div>
              <div className="bg-blue-600 text-white p-2 rounded text-center font-bold">{diasUteisBase} Dias Úteis</div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
               <div className="flex justify-between mb-6">
                  <button onClick={carregarColaboradoresBeneficios} className="bg-blue-100 text-blue-700 px-4 py-2 rounded font-bold">Carregar Lista</button>
                  <button onClick={generateReceiptsPDF} className="bg-red-600 text-white px-4 py-2 rounded font-bold">Gerar Recibos PDF</button>
               </div>
               <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-gray-50 border-b"><tr><th className="p-3">Matr.</th><th className="p-3">Nome</th><th className="p-3 text-center">VT Dia</th><th className="p-3 text-center">Faltas</th><th className="p-3 text-right">Total VT</th><th className="p-3 text-right">Total VR</th><th className="p-3 text-right">Total Geral</th></tr></thead>
                    <tbody>
                      {beneficiosData.map((c,i) => {
                        const o = beneficiosOverrides[c.matricula] || {};
                        const vt = (diasUteisBase - (parseInt(o.ausencias)||0)) * (parseFloat(o.valorVT)||0);
                        const vr = ((diasUteisBase - (parseInt(o.ausencias)||0)) * (parseFloat(valorVRDiario)||0)) * 0.91;
                        return (
                          <tr key={i} className="border-b">
                            <td className="p-3">{c.matricula}</td>
                            <td className="p-3 font-bold">{c.nome}</td>
                            <td className="p-3"><input type="number" className="w-16 border rounded text-center" onChange={e => updateOverride(c.matricula, 'valorVT', e.target.value)} /></td>
                            <td className="p-3"><input type="number" className="w-16 border rounded text-center" onChange={e => updateOverride(c.matricula, 'ausencias', e.target.value)} /></td>
                            <td className="p-3 text-right">R$ {vt.toFixed(2)}</td>
                            <td className="p-3 text-right">R$ {vr.toFixed(2)}</td>
                            <td className="p-3 text-right font-bold text-blue-700">R$ {(vt+vr).toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
               </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}