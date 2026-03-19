import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, FileSpreadsheet, CheckCircle, ArrowRight, FileText, CalendarDays, Calculator, Bus, Coffee, Trash2, AlertTriangle } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('salario');
  const [cadastroFile, setCadastroFile] = useState(null);
  const [espelhoFile, setEspelhoFile] = useState(null);
  const [processedData, setProcessedData] = useState([]);
  const [errors, setErrors] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [paymentType, setPaymentType] = useState('1');

  const [periodo, setPeriodo] = useState({ start: '', end: '', feriados: 0 });
  const [diasUteisBase, setDiasUteisBase] = useState(0);
  const [valorVRDiario, setValorVRDiario] = useState('');
  const [beneficiosData, setBeneficiosData] = useState([]);
  const [beneficiosOverrides, setBeneficiosOverrides] = useState({});

  const fileInputCadastro = useRef(null);
  const fileInputEspelho = useRef(null);

  useEffect(() => {
    const loadDeps = async () => {
      if (!window.XLSX) {
        const s = document.createElement('script');
        s.src = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
        document.body.appendChild(s);
      }
      if (!window.pdfjsLib) {
        const s = document.createElement('script');
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        document.body.appendChild(s);
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      }
      if (!window.jspdf) {
        const s = document.createElement('script');
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        document.body.appendChild(s);
      }
      setIsReady(true);
    };
    loadDeps();
  }, []);

  useEffect(() => {
    if (periodo.start && periodo.end) {
      let count = 0; let curr = new Date(periodo.start + 'T00:00:00');
      let end = new Date(periodo.end + 'T00:00:00');
      while (curr <= end) {
        if (curr.getDay() !== 0 && curr.getDay() !== 6) count++;
        curr.setDate(curr.getDate() + 1);
      }
      setDiasUteisBase(Math.max(0, count - (parseInt(periodo.feriados) || 0)));
    }
  }, [periodo]);

  const normalize = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const carregarColaboradores = async () => {
    if (!cadastroFile) return alert("Selecione o cadastro.");
    const buf = await cadastroFile.arrayBuffer();
    const data = window.XLSX.utils.sheet_to_json(window.XLSX.read(buf, {type:'array'}).Sheets[0], {defval:""});
    const list = data.map(r => {
      const gV = (ts) => r[Object.keys(r).find(k => ts.includes(normalize(k)))] || "";
      const cF = String(gV(['conta'])).trim();
      return { matricula: String(gV(['matricula', 'cod'])).trim(), nome: String(gV(['nome', 'colaborador'])).toUpperCase(), agencia: gV(['agencia']), conta: cF.split('-')[0], digito: cF.split('-')[1] || "", cpf: gV(['cpf']) };
    }).filter(i => i.matricula && i.nome);
    setBeneficiosData(list.sort((a,b) => a.nome.localeCompare(b.nome)));
  };

  const updateOverride = (m, f, v) => setBeneficiosOverrides(p => ({ ...p, [m]: { ...(p[m] || { ausencias: 0, descontoVT: 0, descontoVR: 0, acrescimosVT: 0, acrescimosVR: 0, obs: '', valorVT: '' }), [f]: v } }));

  // Cálculo de Totais para os Cards
  const vrD = parseFloat(valorVRDiario) || 0;
  let sumVT = 0; let sumVR = 0;
  beneficiosData.forEach(c => {
    const o = beneficiosOverrides[c.matricula] || {};
    const dVT = Math.max(0, diasUteisBase - (parseInt(o.ausencias)||0) - (parseInt(o.descontoVT)||0) + (parseInt(o.acrescimosVT)||0));
    const dVR = Math.max(0, diasUteisBase - (parseInt(o.ausencias)||0) - (parseInt(o.descontoVR)||0) + (parseInt(o.acrescimosVR)||0));
    sumVT += dVT * (parseFloat(o.valorVT)||0);
    sumVR += (dVR * vrD) * 0.91;
  });

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans p-4 md:p-8">
      <div className="max-w-full mx-auto space-y-6">
        
        {/* Header Profissional */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-[#1e293b] p-6 rounded-2xl border border-slate-700 shadow-2xl">
          <div className="flex items-center gap-4">
            <img src="/logo.jpg" alt="Logo" className="h-14 w-auto rounded object-contain border border-slate-600" />
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Mais Escoramentos</h1>
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.2em]">Gestão Integrada de DP</p>
            </div>
          </div>
          <div className="flex bg-[#0f172a] p-1.5 rounded-xl mt-4 md:mt-0 border border-slate-700 shadow-inner">
            <button onClick={() => setActiveTab('salario')} className={`px-8 py-2.5 rounded-lg text-xs font-black transition-all ${activeTab === 'salario' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>REMESSA SALARIAL</button>
            <button onClick={() => setActiveTab('beneficios')} className={`px-8 py-2.5 rounded-lg text-xs font-black transition-all ${activeTab === 'beneficios' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>CONTROLE VT / VR</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Menu Lateral de Configuração */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700 shadow-xl">
              <h3 className="text-xs font-black text-blue-400 mb-6 flex items-center gap-2 uppercase tracking-widest"><Calculator size={16}/> Configurações Base</h3>
              
              <div className="space-y-5">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">1. Planilha Cadastro (XLSX)</label>
                  <div onClick={() => fileInputCadastro.current.click()} className={`p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all flex flex-col items-center gap-2 ${cadastroFile ? 'border-green-500/50 bg-green-500/5' : 'border-slate-700 hover:border-blue-500/50 hover:bg-slate-800'}`}>
                    {cadastroFile ? <CheckCircle size={20} className="text-green-500"/> : <Upload size={20} className="text-slate-500"/>}
                    <p className="text-[11px] font-medium truncate w-full text-center">{cadastroFile ? cadastroFile.name : "Clique para importar"}</p>
                    <input type="file" ref={fileInputCadastro} hidden onChange={e => setCadastroFile(e.target.files[0])} />
                  </div>
                </div>

                {activeTab === 'beneficios' ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Data Início</label><input type="date" className="w-full bg-[#0f172a] border border-slate-700 rounded-lg p-2.5 text-xs text-white" onChange={e => setPeriodo({...periodo, start: e.target.value})} /></div>
                      <div><label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Data Fim</label><input type="date" className="w-full bg-[#0f172a] border border-slate-700 rounded-lg p-2.5 text-xs text-white" onChange={e => setPeriodo({...periodo, end: e.target.value})} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Feriados</label><input type="number" className="w-full bg-[#0f172a] border border-slate-700 rounded-lg p-2.5 text-xs text-white" placeholder="0" onChange={e => setPeriodo({...periodo, feriados: e.target.value})} /></div>
                      <div><label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">VR Diário</label><input type="number" step="0.01" className="w-full bg-[#0f172a] border border-slate-700 rounded-lg p-2.5 text-xs text-blue-400 font-bold" placeholder="0.00" onChange={e => setValorVRDiario(e.target.value)} /></div>
                    </div>
                    <button onClick={carregarColaboradores} className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs shadow-lg shadow-blue-900/40 transition-all uppercase tracking-widest">Gerar Lista Benefícios</button>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">2. Espelho Contábil (PDF)</label>
                      <div onClick={() => fileInputEspelho.current.click()} className={`p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all flex flex-col items-center gap-2 ${espelhoFile ? 'border-green-500/50 bg-green-500/5' : 'border-slate-700 hover:border-blue-500/50 hover:bg-slate-800'}`}>
                        {espelhoFile ? <CheckCircle size={20} className="text-green-500"/> : <FileText size={20} className="text-slate-500"/>}
                        <p className="text-[11px] font-medium truncate w-full text-center">{espelhoFile ? espelhoFile.name : "Clique para importar"}</p>
                        <input type="file" ref={fileInputEspelho} hidden onChange={e => setEspelhoFile(e.target.files[0])} />
                      </div>
                    </div>
                    <div className="space-y-2 bg-[#0f172a] p-3 rounded-xl border border-slate-700">
                      <label className="flex items-center gap-2 text-[11px] cursor-pointer"><input type="radio" name="pt" value="1" checked={paymentType==='1'} onChange={e=>setPaymentType(e.target.value)} className="accent-blue-500"/> Cód. 1 (Salário)</label>
                      <label className="flex items-center gap-2 text-[11px] cursor-pointer"><input type="radio" name="pt" value="9" checked={paymentType==='9'} onChange={e=>setPaymentType(e.target.value)} className="accent-blue-500"/> Cód. 9 (Adiantamento)</label>
                    </div>
                    <button className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs shadow-lg shadow-blue-900/40 transition-all uppercase tracking-widest">Processar Remessa</button>
                  </>
                )}
              </div>
            </div>

            {/* Dash Cards Laterais */}
            {activeTab === 'beneficios' && (
              <div className="space-y-4">
                <div className="bg-[#1e293b] p-5 rounded-2xl border border-slate-700 shadow-lg border-l-4 border-l-blue-500">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Montante VT</p>
                  <p className="text-2xl font-black text-white">R$ {sumVT.toFixed(2)}</p>
                </div>
                <div className="bg-[#1e293b] p-5 rounded-2xl border border-slate-700 shadow-lg border-l-4 border-l-blue-500">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Montante VR (Líq)</p>
                  <p className="text-2xl font-black text-white">R$ {sumVR.toFixed(2)}</p>
                </div>
                <div className="bg-green-600 p-5 rounded-2xl shadow-xl shadow-green-900/20 border-l-4 border-l-green-400">
                  <p className="text-[10px] font-black text-green-100 uppercase tracking-widest mb-1">Total Geral a Pagar</p>
                  <p className="text-3xl font-black text-white">R$ {(sumVT + sumVR).toFixed(2)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Área Principal de Dados */}
          <div className="lg:col-span-3">
            <div className="bg-[#1e293b] rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col h-full min-h-[700px]">
              
              <div className="p-5 border-b border-slate-700 bg-[#1e293b] flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-600/10 rounded-lg text-blue-400"><Bus size={20}/></div>
                  <h2 className="text-sm font-black text-white uppercase tracking-widest">{activeTab === 'beneficios' ? "Planilha de Controle de Benefícios" : "Prévia de Remessa Bancária"}</h2>
                </div>
                <div className="flex items-center gap-3">
                   <div className="text-[10px] font-black bg-[#0f172a] px-4 py-2 rounded-full border border-slate-700 text-blue-400 shadow-inner">
                     {activeTab === 'beneficios' ? `${diasUteisBase} DIAS ÚTEIS BASE` : "PAGAMENTO BANCO ITAÚ"}
                   </div>
                   {beneficiosData.length > 0 && <button className="bg-red-600 hover:bg-red-500 text-white text-[10px] font-black px-4 py-2 rounded-full transition-all">RECIBOS PDF</button>}
                </div>
              </div>
              
              <div className="flex-grow overflow-x-auto">
                {activeTab === 'beneficios' ? (
                  <table className="w-full text-left text-[11px] whitespace-nowrap">
                    <thead className="sticky top-0 bg-[#1e293b] border-b border-slate-700 text-slate-500 font-black uppercase z-10">
                      <tr>
                        <th className="p-4 w-16">Matr.</th>
                        <th className="p-4 min-w-[200px]">Colaborador</th>
                        <th className="p-4 text-center w-28">VT Diário (R$)</th>
                        <th className="p-4 text-center w-20 text-red-500">Faltas</th>
                        <th className="p-4 text-center w-20 text-orange-400">Desc. VT</th>
                        <th className="p-4 text-center w-20 text-orange-400">Desc. VR</th>
                        <th className="p-4 text-center w-20 text-green-500">Acrés. VT</th>
                        <th className="p-4 text-center w-20 text-green-500">Acrés. VR</th>
                        <th className="p-4 text-right w-32 font-bold text-white">Total a Receber</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {beneficiosData.length > 0 ? beneficiosData.map((c, i) => {
                        const o = beneficiosOverrides[c.matricula] || {};
                        const dVT = Math.max(0, diasUteisBase - (parseInt(o.ausencias)||0) - (parseInt(o.descontoVT)||0) + (parseInt(o.acrescimosVT)||0));
                        const dVR = Math.max(0, diasUteisBase - (parseInt(o.ausencias)||0) - (parseInt(o.descontoVR)||0) + (parseInt(o.acrescimosVR)||0));
                        const tot = (dVT * (parseFloat(o.valorVT)||0)) + ((dVR * vrD) * 0.91);
                        
                        return (
                          <tr key={i} className="hover:bg-slate-800/40 transition-all group">
                            <td className="p-4 font-mono text-slate-500">{c.matricula}</td>
                            <td className="p-4 font-black text-slate-300 group-hover:text-white">{c.nome}</td>
                            <td className="p-4 text-center">
                              <input type="number" step="0.01" className="w-20 bg-[#0f172a] border border-slate-700 rounded-lg p-1.5 text-center text-blue-400 font-black shadow-inner" placeholder="0.00" onChange={e => updateOverride(c.matricula, 'valorVT', e.target.value)} />
                            </td>
                            <td className="p-4 text-center">
                              <input type="number" className="w-14 bg-[#0f172a] border border-slate-700 rounded-lg p-1.5 text-center text-red-400" placeholder="0" onChange={e => updateOverride(c.matricula, 'ausencias', e.target.value)} />
                            </td>
                            <td className="p-4 text-center bg-orange-400/5"><input type="number" className="w-14 bg-[#0f172a] border border-slate-700 rounded-lg p-1.5 text-center text-orange-300" placeholder="0" onChange={e => updateOverride(c.matricula, 'descontoVT', e.target.value)} /></td>
                            <td className="p-4 text-center bg-orange-400/5"><input type="number" className="w-14 bg-[#0f172a] border border-slate-700 rounded-lg p-1.5 text-center text-orange-300" placeholder="0" onChange={e => updateOverride(c.matricula, 'descontoVR', e.target.value)} /></td>
                            <td className="p-4 text-center bg-green-400/5"><input type="number" className="w-14 bg-[#0f172a] border border-slate-700 rounded-lg p-1.5 text-center text-green-300" placeholder="0" onChange={e => updateOverride(c.matricula, 'acrescimosVT', e.target.value)} /></td>
                            <td className="p-4 text-center bg-green-400/5"><input type="number" className="w-14 bg-[#0f172a] border border-slate-700 rounded-lg p-1.5 text-center text-green-300" placeholder="0" onChange={e => updateOverride(c.matricula, 'acrescimosVR', e.target.value)} /></td>
                            <td className="p-4 text-right font-black text-green-400 bg-green-400/5">R$ {tot.toFixed(2)}</td>
                          </tr>
                        );
                      }) : (
                        <tr><td colSpan="9" className="p-40 text-center text-slate-600 font-black uppercase tracking-[0.5em] text-[10px]">Aguardando carregamento da lista base...</td></tr>
                      )}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-20 text-center space-y-4">
                    <AlertTriangle className="mx-auto text-slate-600" size={48}/>
                    <p className="text-slate-500 font-bold">Módulo de Remessa Salarial ativo. Suba o PDF de espelho para processar.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}