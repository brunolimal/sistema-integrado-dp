import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, AlertTriangle, FileSpreadsheet, CheckCircle, ArrowRight, FileText, CalendarDays, Calculator, Bus, Coffee, Trash2 } from 'lucide-react';

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

  const normalizeKey = (key) => key ? String(key).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
  const normalizeText = (text) => text ? String(text).trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';

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

  const formatCPF = (cpfRaw) => {
    let cpf = String(cpfRaw).replace(/[^\d]/g, '');
    if (cpf.length > 0 && cpf.length <= 11) {
      cpf = cpf.padStart(11, '0');
      return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return cpfRaw;
  };

  const processFiles = async () => {
    if (!cadastroFile || !espelhoFile) { alert("Upload de ambos os arquivos necessário."); return; }
    setIsProcessing(true); setErrors([]); setProcessedData([]);
    try {
      const [cadBuf, espBuf] = await Promise.all([cadastroFile.arrayBuffer(), espelhoFile.arrayBuffer()]);
      const cadData = window.XLSX.utils.sheet_to_json(window.XLSX.read(cadBuf, { type: 'array' }).Sheets[0], { defval: "" });
      const cadMap = {};
      cadData.forEach(row => {
        const mKey = Object.keys(row).find(k => normalizeKey(k) === 'matricula');
        if (mKey && row[mKey]) {
          const sMat = String(row[mKey]).trim().replace(/^0+/, '') || '0';
          cadMap[sMat] = { ...row, _sMat: sMat, _sNome: normalizeText(row[Object.keys(row).find(k => normalizeKey(k) === 'nome')] || '') };
        }
      });
      const pdf = await window.pdfjsLib.getDocument({data: new Uint8Array(espBuf)}).promise;
      const lines = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const text = await page.getTextContent();
        const items = text.items;
        items.sort((a,b) => Math.abs(b.transform[5]-a.transform[5]) > 5 ? b.transform[5]-a.transform[5] : a.transform[4]-b.transform[4]);
        let currL = []; let currY = items.length > 0 ? items[0].transform[5] : 0;
        items.forEach(it => {
          if (Math.abs(it.transform[5]-currY) > 5) { lines.push(currL.join(" ")); currL = [it.str.trim()]; currY = it.transform[5]; }
          else currL.push(it.str.trim());
        });
        lines.push(currL.join(" "));
      }
      const res = []; const matriculasEnc = new Set();
      lines.forEach(l => {
        const lNorm = normalizeText(l);
        Object.keys(cadMap).forEach(sMat => {
          const emp = cadMap[sMat];
          const reg = new RegExp(`\\b0*${sMat}\\b`);
          const pNome = emp._sNome.split(' ')[0] || '';
          if (reg.test(l) && lNorm.includes(pNome)) {
            const vMatches = l.match(/(?:\d{1,3}(?:\.\d{3})*|\d+),\d{2}/g);
            if (vMatches && !matriculasEnc.has(sMat)) {
              const val = parseFloat(vMatches[vMatches.length-1].replace(/\./g, '').replace(',', '.'));
              if (val > 0) {
                matriculasEnc.add(sMat);
                const gV = (s) => emp[Object.keys(emp).find(k => normalizeKey(k).includes(s))] || "";
                const cF = String(gV('conta')).trim();
                res.push([String(gV('agencia')).trim(), cF.split('-')[0], cF.split('-')[1]||"", gV('nome'), formatCPF(gV('cpf')), paymentType, val]);
              }
            }
          }
        });
      });
      setProcessedData(res);
    } catch(e) { setErrors(["Erro ao processar."]); } finally { setIsProcessing(false); }
  };

  const exportToExcel = () => {
    const ws = window.XLSX.utils.aoa_to_sheet(processedData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Folha");
    window.XLSX.writeFile(wb, "Remessa_Banco.xlsx");
  };

  // Logica Benefícios
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
    if (!cadastroFile) { alert("Suba a planilha de cadastro primeiro."); return; }
    setIsProcessing(true);
    try {
      const buf = await cadastroFile.arrayBuffer();
      const data = window.XLSX.utils.sheet_to_json(window.XLSX.read(buf, {type:'array'}).Sheets[0], {defval:""});
      const list = data.map(r => {
        const gV = (s) => r[Object.keys(r).find(k => normalizeKey(k).includes(s))] || "";
        const c = String(gV('conta')).trim();
        return { matricula: String(gV('matricula')).trim(), nome: gV('nome'), agencia: gV('agencia'), conta: c.split('-')[0], digito: c.split('-')[1]||"", cpf: formatCPF(gV('cpf')) };
      }).filter(i => i.matricula && i.nome).sort((a,b) => a.nome.localeCompare(b.nome));
      setBeneficiosData(list);
    } catch(e) { alert("Erro ao carregar lista."); } finally { setIsProcessing(false); }
  };

  const updateOverride = (m, f, v) => setBeneficiosOverrides(p => ({ ...p, [m]: { ...(p[m] || { ausencias: 0, descontoVT: 0, descontoVR: 0, acrescimosVT: 0, acrescimosVR: 0, obs: '', valorVT: '' }), [f]: v } }));

  // Cálculo de Totais Gerais para os Cards
  const vrDiarioNum = parseFloat(valorVRDiario) || 0;
  let totalVTGeral = 0; let totalVRLiquidoGeral = 0;
  beneficiosData.forEach(c => {
    const o = beneficiosOverrides[c.matricula] || {};
    const dVT = Math.max(0, diasUteisBase - (parseInt(o.ausencias)||0) - (parseInt(o.descontoVT)||0) + (parseInt(o.acrescimosVT)||0));
    const dVR = Math.max(0, diasUteisBase - (parseInt(o.ausencias)||0) - (parseInt(o.descontoVR)||0) + (parseInt(o.acrescimosVR)||0));
    totalVTGeral += dVT * (parseFloat(o.valorVT)||0);
    totalVRLiquidoGeral += (dVR * vrDiarioNum) * 0.91;
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans pb-20">
      <div className="max-w-full mx-auto space-y-6">
        
        {/* Header com Logo */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 flex flex-col md:flex-row items-center justify-between border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
            <div className="flex items-center space-x-4">
              <img src="/logo.jpg" alt="Logo" className="h-14 w-auto object-contain rounded" />
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

        {/* Global Upload - Aparece em ambas as abas se o cadastro não existir */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
            <div className={`p-4 rounded-full mb-4 ${cadastroFile ? 'bg-green-100' : 'bg-blue-50'}`}>
                {cadastroFile ? <CheckCircle className="w-8 h-8 text-green-600" /> : <Upload className="w-8 h-8 text-blue-600" />}
            </div>
            <h2 className="text-lg font-semibold text-gray-800">1. Planilha Base de Cadastro (Excel)</h2>
            <p className="text-xs text-gray-500 mt-2 mb-4">Essencial para cruzar dados e carregar nomes.</p>
            <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputCadastro} onChange={(e) => handleFileUpload(e, 'cadastro')} />
            <button onClick={() => fileInputCadastro.current.click()} className={`px-6 py-2 text-sm font-medium rounded-lg border ${cadastroFile ? 'text-green-700 bg-green-50 border-green-200' : 'text-blue-600 bg-blue-50 border-blue-200'}`}>
                {cadastroFile ? `Arquivo: ${cadastroFile.name}` : 'Selecionar Arquivo'}
            </button>
        </div>

        {/* ABA SALÁRIO */}
        {activeTab === 'salario' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
                <div className={`p-4 rounded-full mb-4 ${espelhoFile ? 'bg-green-100' : 'bg-blue-50'}`}>
                    {espelhoFile ? <CheckCircle className="w-8 h-8 text-green-600" /> : <FileText className="w-8 h-8 text-blue-600" />}
                </div>
                <h2 className="text-lg font-semibold">2. Espelho de Salário (PDF)</h2>
                <input type="file" accept=".pdf" className="hidden" ref={fileInputEspelho} onChange={(e) => handleFileUpload(e, 'espelho')} />
                <button onClick={() => fileInputEspelho.current.click()} className="mt-4 px-6 py-2 border rounded-lg text-blue-600 bg-blue-50">{espelhoFile ? espelhoFile.name : 'Selecionar PDF'}</button>
            </div>
            <div className="flex justify-center"><button onClick={processFiles} className="px-10 py-3 bg-blue-600 text-white rounded-lg font-bold shadow-md hover:bg-blue-700">PROCESSAR FOLHA</button></div>
            {processedData.length > 0 && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold">Total Processado: {processedData.length} colaboradores</h3>
                        <button onClick={exportToExcel} className="bg-green-600 text-white px-4 py-2 rounded shadow flex items-center gap-2"><Download size={16}/> Baixar Excel Itaú</button>
                    </div>
                    <table className="w-full text-left text-sm">
                        <thead><tr className="bg-gray-50 border-b text-gray-500 uppercase text-xs font-bold"><th className="p-3">Nome</th><th className="p-3">CPF</th><th className="p-3 text-right">Valor</th></tr></thead>
                        <tbody>{processedData.map((r,i) => (<tr key={i} className="border-b hover:bg-gray-50"><td className="p-3 font-medium">{r[3]}</td><td className="p-3">{r[4]}</td><td className="p-3 text-right text-green-600 font-bold">R$ {r[6].toFixed(2)}</td></tr>))}</tbody>
                    </table>
                </div>
            )}
          </div>
        )}

        {/* ABA BENEFÍCIOS (RESTAURADA TOTALMENTE) */}
        {activeTab === 'beneficios' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-5 gap-6 items-end">
              <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data Inicial</label><input type="date" className="w-full border rounded-lg p-2" onChange={e => setPeriodo({...periodo, start: e.target.value})} /></div>
              <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data Final</label><input type="date" className="w-full border rounded-lg p-2" onChange={e => setPeriodo({...periodo, end: e.target.value})} /></div>
              <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Feriados</label><input type="number" className="w-full border rounded-lg p-2" placeholder="0" onChange={e => setPeriodo({...periodo, feriados: e.target.value})} /></div>
              <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">VR Diário (R$)</label><input type="number" step="0.01" className="w-full border rounded-lg p-2 font-bold text-blue-700 bg-blue-50" placeholder="0.00" onChange={e => setValorVRDiario(e.target.value)} /></div>
              <div className="bg-blue-600 text-white p-3 rounded-lg text-center font-bold text-xl">{diasUteisBase} Dias Úteis</div>
            </div>

            {beneficiosData.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm text-center">
                        <p className="text-xs text-gray-500 font-bold uppercase">Total VT</p>
                        <p className="text-2xl font-black text-blue-700">R$ {totalVTGeral.toFixed(2)}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm text-center">
                        <p className="text-xs text-gray-500 font-bold uppercase">Total VR (Líq)</p>
                        <p className="text-2xl font-black text-blue-700">R$ {totalVRLiquidoGeral.toFixed(2)}</p>
                    </div>
                    <div className="bg-green-600 p-4 rounded-xl shadow-md text-center text-white">
                        <p className="text-xs font-bold uppercase opacity-80">Total Geral a Pagar</p>
                        <p className="text-2xl font-black">R$ {(totalVTGeral + totalVRLiquidoGeral).toFixed(2)}</p>
                    </div>
                </div>
            )}

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
               <div className="flex justify-between items-center mb-6">
                  <div className="flex gap-2">
                    <button onClick={carregarColaboradoresBeneficios} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold shadow hover:bg-blue-700">GERAR LISTA</button>
                    {beneficiosData.length > 0 && <button onClick={() => setBeneficiosData([])} className="bg-gray-100 text-gray-600 p-2 rounded-lg hover:bg-gray-200"><Trash2 size={20}/></button>}
                  </div>
                  {beneficiosData.length > 0 && <button className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold shadow hover:bg-red-700">RECIBOS PDF</button>}
               </div>
               {beneficiosData.length > 0 ? (
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="p-3">Matr.</th><th className="p-3">Colaborador</th>
                        <th className="p-3 text-center">VT Diário (R$)</th><th className="p-3 text-center">Faltas</th>
                        <th className="p-3 text-right">Total VT</th><th className="p-3 text-right">VR Líquido (-9%)</th>
                        <th className="p-3 text-right font-bold text-green-700">Total Geral</th>
                      </tr>
                    </thead>
                    <tbody>
                      {beneficiosData.map((c, i) => {
                        const o = beneficiosOverrides[c.matricula] || {};
                        const dVT = Math.max(0, diasUteisBase - (parseInt(o.ausencias)||0));
                        const vt = dVT * (parseFloat(o.valorVT)||0);
                        const vr = (dVT * vrDiarioNum) * 0.91;
                        return (
                          <tr key={i} className="border-b hover:bg-gray-50 transition-colors">
                            <td className="p-3 font-mono text-gray-400">{c.matricula}</td>
                            <td className="p-3 font-bold text-gray-800">{c.nome}</td>
                            <td className="p-3"><input type="number" className="w-20 border rounded p-1 text-center font-bold text-blue-700" placeholder="0.00" onChange={e => updateOverride(c.matricula, 'valorVT', e.target.value)} /></td>
                            <td className="p-3"><input type="number" className="w-16 border rounded p-1 text-center" placeholder="0" onChange={e => updateOverride(c.matricula, 'ausencias', e.target.value)} /></td>
                            <td className="p-3 text-right">R$ {vt.toFixed(2)}</td>
                            <td className="p-3 text-right">R$ {vr.toFixed(2)}</td>
                            <td className="p-3 text-right font-black text-green-700">R$ {(vt+vr).toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
               ) : (
                <div className="text-center py-20 bg-gray-50 border-2 border-dashed rounded-xl text-gray-400">Clique em "GERAR LISTA" para carregar os colaboradores da planilha.</div>
               )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}