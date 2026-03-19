import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, AlertTriangle, FileSpreadsheet, CheckCircle, ArrowRight, FileText, CalendarDays, Calculator, Bus, Coffee } from 'lucide-react';

export default function App() {
  // Aba Ativa
  const [activeTab, setActiveTab] = useState('salario');

  // Estados Globais / Salário
  const [cadastroFile, setCadastroFile] = useState(null);
  const [espelhoFile, setEspelhoFile] = useState(null);
  const [processedData, setProcessedData] = useState([]);
  const [errors, setErrors] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [paymentType, setPaymentType] = useState('1');

  // Estados Benefícios
  const [periodo, setPeriodo] = useState({ start: '', end: '', feriados: 0 });
  const [diasUteisBase, setDiasUteisBase] = useState(0);
  const [valorVRDiario, setValorVRDiario] = useState('');
  const [beneficiosData, setBeneficiosData] = useState([]);
  const [beneficiosOverrides, setBeneficiosOverrides] = useState({});

  const fileInputCadastro = useRef(null);
  const fileInputEspelho = useRef(null);

  useEffect(() => {
    const loadDependencies = async () => {
      if (!window.XLSX) {
        const xlsxScript = document.createElement('script');
        xlsxScript.src = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
        document.body.appendChild(xlsxScript);
        await new Promise(r => xlsxScript.onload = r);
      }
      if (!window.pdfjsLib) {
        const pdfScript = document.createElement('script');
        pdfScript.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        document.body.appendChild(pdfScript);
        await new Promise(r => pdfScript.onload = r);
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      }
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
    if (!isReady) {
      alert("As bibliotecas ainda estão carregando.");
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
              const lastMatch = valueMatches[valueMatches.length - 1];
              const valor = parseFloat(lastMatch.replace(/\./g, '').replace(',', '.'));
              if (valor > 0) {
                matriculasEncontradas.add(safeMat);
                const getVal = (s) => empData[Object.keys(empData).find(k => normalizeKey(k).includes(s))] || "";
                const contaFull = String(getVal('conta')).trim();
                let conta = contaFull; let digito = "";
                if (contaFull.includes('-')) {
                   const pts = contaFull.split('-');
                   digito = pts.pop();
                   conta = pts.join('-');
                }
                if (!getVal('agencia') || !conta) currentErrors.push(`Dados bancários incompletos: ${empData._safeNome}`);
                result.push([getVal('agencia'), conta, digito, getVal('nome'), formatCPF(getVal('cpf')), paymentType, valor]);
              }
            }
          }
        });
      });
      setProcessedData(result);
      setErrors(currentErrors);
    } catch (error) { setErrors(["Erro ao processar arquivos."]); } finally { setIsProcessing(false); }
  };

  const exportToExcel = () => {
    const ws = window.XLSX.utils.aoa_to_sheet(processedData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Pagamentos");
    window.XLSX.writeFile(wb, `Remessa_${new Date().toLocaleDateString()}.xlsx`);
  };

  // Funções Benefícios
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
    if (!cadastroFile) return alert("Selecione o cadastro.");
    setIsProcessing(true);
    try {
      const buf = await cadastroFile.arrayBuffer();
      const data = window.XLSX.utils.sheet_to_json(window.XLSX.read(buf, {type:'array'}).Sheets[0], {defval:""});
      const list = data.map(row => {
        const gV = (s) => row[Object.keys(row).find(k => normalizeKey(k).includes(s))] || "";
        const cF = String(gV('conta')).trim();
        return { matricula: String(gV('matricula')).trim(), nome: gV('nome'), agencia: gV('agencia'), conta: cF.split('-')[0], digito: cF.split('-')[1]||"", cpf: formatCPF(gV('cpf')) };
      }).filter(i => i.matricula && i.nome).sort((a,b) => a.nome.localeCompare(b.nome));
      setBeneficiosData(list);
    } catch (e) { alert("Erro ao carregar lista."); } finally { setIsProcessing(false); }
  };

  const updateOverride = (m, f, v) => setBeneficiosOverrides(p => ({ ...p, [m]: { ...(p[m] || { ausencias: 0, descontoVT: 0, descontoVR: 0, acrescimosVT: 0, acrescimosVR: 0, obs: '', valorVT: '' }), [f]: v } }));

  const generateReceiptsPDF = () => {
    const { jsPDF } = window.jspdf; const doc = new jsPDF(); const vrD = parseFloat(valorVRDiario) || 0;
    beneficiosData.forEach((c, idx) => {
      if (idx > 0) doc.addPage();
      doc.text("RECIBO DE BENEFÍCIOS", 105, 20, {align:"center"});
      doc.text(`Colaborador: ${c.nome}`, 20, 40);
      doc.text(`Matrícula: ${c.matricula}`, 20, 50);
      doc.line(20, 150, 190, 150); doc.text("Assinatura", 105, 160, {align:"center"});
    });
    doc.save("Recibos.pdf");
  };

  // Cálculos Totais Benefícios
  const vrD = parseFloat(valorVRDiario) || 0;
  let sVT = 0; let sVR = 0;
  beneficiosData.forEach(c => {
    const o = beneficiosOverrides[c.matricula] || {};
    const dVT = Math.max(0, diasUteisBase - (parseInt(o.ausencias)||0) - (parseInt(o.descontoVT)||0) + (parseInt(o.acrescimosVT)||0));
    const dVR = Math.max(0, diasUteisBase - (parseInt(o.ausencias)||0) - (parseInt(o.descontoVR)||0) + (parseInt(o.acrescimosVR)||0));
    sVT += dVT * (parseFloat(o.valorVT)||0);
    sVR += (dVR * vrD) * 0.91;
  });

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 p-4 md:p-8 font-sans">
      <div className="max-w-full mx-auto space-y-6">
        
        {/* HEADER COM LOGO */}
        <div className="bg-[#1e293b] rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
          <div className="p-6 flex flex-col md:flex-row items-center justify-between border-b border-slate-700 bg-gradient-to-r from-slate-800 to-transparent">
            <div className="flex items-center space-x-4">
              <img src="/logo.jpg" alt="Logo" className="h-14 w-auto rounded border border-slate-600 shadow-sm" />
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">Mais Escoramentos</h1>
                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Sistema Integrado de DP</p>
              </div>
            </div>
          </div>
          <div className="flex bg-[#0f172a]/50 p-1">
            <button onClick={() => setActiveTab('salario')} className={`flex-1 py-4 text-xs font-black transition-all ${activeTab === 'salario' ? 'bg-blue-600 text-white shadow-lg rounded-lg' : 'text-slate-500 hover:text-slate-300'}`}>REMESSA SALARIAL</button>
            <button onClick={() => setActiveTab('beneficios')} className={`flex-1 py-4 text-xs font-black transition-all ${activeTab === 'beneficios' ? 'bg-blue-600 text-white shadow-lg rounded-lg' : 'text-slate-500 hover:text-slate-300'}`}>CONTROLE VT / VR</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* MENU LATERAL */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700 shadow-xl">
              <h3 className="text-[10px] font-black text-blue-400 uppercase mb-6 tracking-[0.2em]">Configurações</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">1. Cadastro (Excel)</label>
                  <div onClick={() => fileInputCadastro.current.click()} className={`p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all text-center ${cadastroFile ? 'border-green-500/50 bg-green-500/5' : 'border-slate-700 hover:border-blue-500/50 hover:bg-slate-800'}`}>
                    <p className="text-[11px] truncate">{cadastroFile ? cadastroFile.name : "Subir Planilha"}</p>
                    <input type="file" ref={fileInputCadastro} hidden onChange={e => handleFileUpload(e, 'cadastro')} />
                  </div>
                </div>

                {activeTab === 'beneficios' ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="date" className="bg-[#0f172a] border border-slate-700 rounded-lg p-2 text-[10px] text-white" onChange={e => setPeriodo({...periodo, start: e.target.value})} />
                      <input type="date" className="bg-[#0f172a] border border-slate-700 rounded-lg p-2 text-[10px] text-white" onChange={e => setPeriodo({...periodo, end: e.target.value})} />
                    </div>
                    <input type="number" step="0.01" className="w-full bg-[#0f172a] border border-slate-700 rounded-lg p-3 text-sm text-blue-400 font-black" placeholder="VR Diário R$" onChange={e => setValorVRDiario(e.target.value)} />
                    <button onClick={carregarColaboradoresBeneficios} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs transition-all uppercase">Gerar Lista</button>
                  </>
                ) : (
                  <>
                    <div onClick={() => fileInputEspelho.current.click()} className="p-4 border-2 border-dashed border-slate-700 rounded-xl cursor-pointer text-center">
                      <p className="text-[11px]">{espelhoFile ? espelhoFile.name : "Subir Espelho (PDF)"}</p>
                      <input type="file" ref={fileInputEspelho} hidden onChange={e => handleFileUpload(e, 'espelho')} />
                    </div>
                    <button onClick={processFiles} className="w-full py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase">Processar Folha</button>
                  </>
                )}
              </div>
            </div>

            {activeTab === 'beneficios' && (
               <div className="space-y-3">
                  <div className="bg-[#1e293b] p-4 rounded-xl border border-slate-700 border-l-4 border-l-blue-500"><p className="text-[10px] text-slate-500 font-bold uppercase">Total VT</p><p className="text-xl font-black">R$ {sVT.toFixed(2)}</p></div>
                  <div className="bg-[#1e293b] p-4 rounded-xl border border-slate-700 border-l-4 border-l-blue-500"><p className="text-[10px] text-slate-500 font-bold uppercase">Total VR</p><p className="text-xl font-black">R$ {sVR.toFixed(2)}</p></div>
                  <div className="bg-green-600 p-4 rounded-xl shadow-lg border-l-4 border-l-green-400"><p className="text-[10px] text-green-100 font-bold uppercase">Total Geral</p><p className="text-2xl font-black">R$ {(sVT + sVR).toFixed(2)}</p></div>
               </div>
            )}
          </div>

          {/* TABELA PRINCIPAL */}
          <div className="lg:col-span-3">
            <div className="bg-[#1e293b] rounded-2xl border border-slate-700 shadow-xl overflow-hidden min-h-[600px]">
              <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/30">
                <h2 className="text-xs font-black uppercase tracking-widest">{activeTab === 'salario' ? "Remessa Bancária" : "Controle de Benefícios"}</h2>
                {activeTab === 'beneficios' && <button onClick={generateReceiptsPDF} className="bg-red-600 hover:bg-red-500 text-white text-[10px] font-black px-4 py-2 rounded-full transition-all">RECIBOS PDF</button>}
              </div>

              <div className="overflow-x-auto">
                {activeTab === 'beneficios' ? (
                  <table className="w-full text-[10px] text-left whitespace-nowrap">
                    <thead className="bg-[#0f172a] text-slate-500 font-black uppercase">
                      <tr>
                        <th className="p-4">Matr.</th><th className="p-4">Nome</th>
                        <th className="p-4 text-center">VT Dia</th><th className="p-4 text-center">Faltas</th>
                        <th className="p-4 text-center">Desc VT</th><th className="p-4 text-center">Desc VR</th>
                        <th className="p-4 text-center">Acr VT</th><th className="p-4 text-center">Acr VR</th>
                        <th className="p-4 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {beneficiosData.map((c, i) => {
                        const o = beneficiosOverrides[c.matricula] || {};
                        const dVT = Math.max(0, diasUteisBase - (parseInt(o.ausencias)||0) - (parseInt(o.descontoVT)||0) + (parseInt(o.acrescimosVT)||0));
                        const dVR = Math.max(0, diasUteisBase - (parseInt(o.ausencias)||0) - (parseInt(o.descontoVR)||0) + (parseInt(o.acrescimosVR)||0));
                        const tot = (dVT * (parseFloat(o.valorVT)||0)) + ((dVR * vrD) * 0.91);
                        return (
                          <tr key={i} className="hover:bg-slate-800/50 transition-all">
                            <td className="p-4 font-mono text-slate-500">{c.matricula}</td>
                            <td className="p-4 font-bold text-slate-300 uppercase">{c.nome}</td>
                            <td className="p-4 text-center"><input type="number" step="0.01" className="w-16 bg-[#0f172a] border border-slate-700 rounded p-1 text-center text-blue-400 font-bold" onChange={e => updateOverride(c.matricula, 'valorVT', e.target.value)} /></td>
                            <td className="p-4 text-center"><input type="number" className="w-12 bg-[#0f172a] border border-slate-700 rounded p-1 text-center text-red-400" onChange={e => updateOverride(c.matricula, 'ausencias', e.target.value)} /></td>
                            <td className="p-4 text-center"><input type="number" className="w-12 bg-[#0f172a] border border-slate-700 rounded p-1 text-center" onChange={e => updateOverride(c.matricula, 'descontoVT', e.target.value)} /></td>
                            <td className="p-4 text-center"><input type="number" className="w-12 bg-[#0f172a] border border-slate-700 rounded p-1 text-center" onChange={e => updateOverride(c.matricula, 'descontoVR', e.target.value)} /></td>
                            <td className="p-4 text-center"><input type="number" className="w-12 bg-[#0f172a] border border-slate-700 rounded p-1 text-center" onChange={e => updateOverride(c.matricula, 'acrescimosVT', e.target.value)} /></td>
                            <td className="p-4 text-center"><input type="number" className="w-12 bg-[#0f172a] border border-slate-700 rounded p-1 text-center" onChange={e => updateOverride(c.matricula, 'acrescimosVR', e.target.value)} /></td>
                            <td className="p-4 text-right font-black text-green-400">R$ {tot.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-20 text-center text-slate-600 font-bold uppercase tracking-widest">Aguardando Processamento de Folha...</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}