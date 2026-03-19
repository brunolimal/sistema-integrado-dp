import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, FileText, Calculator, Bus, Trash2, CheckCircle, Smartphone } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('beneficios');
  const [cadastroFile, setCadastroFile] = useState(null);
  const [espelhoFile, setEspelhoFile] = useState(null);
  const [processedData, setProcessedData] = useState([]);
  const [isReady, setIsReady] = useState(false);

  // Estados Benefícios
  const [periodo, setPeriodo] = useState({ start: '', end: '', feriados: 0 });
  const [diasUteisBase, setDiasUteisBase] = useState(0);
  const [valorVRDiario, setValorVRDiario] = useState('');
  const [beneficiosData, setBeneficiosData] = useState([]);
  const [beneficiosOverrides, setBeneficiosOverrides] = useState({});

  const fileInputCadastro = useRef(null);
  const fileInputEspelho = useRef(null);

  useEffect(() => {
    const loadScripts = async () => {
      if (!window.XLSX) {
        const s = document.createElement('script');
        s.src = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
        document.body.appendChild(s);
      }
      setIsReady(true);
    };
    loadScripts();
  }, []);

  // Cálculo de dias úteis
  useEffect(() => {
    if (periodo.start && periodo.end) {
      let count = 0;
      let curr = new Date(periodo.start + 'T00:00:00');
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
    if (!cadastroFile) { alert("Selecione a planilha de cadastro primeiro."); return; }
    try {
      const buf = await cadastroFile.arrayBuffer();
      const wb = window.XLSX.read(buf, { type: 'array' });
      const data = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });

      const list = data.map(r => {
        const findV = (targets) => {
          const key = Object.keys(r).find(k => targets.includes(normalize(k)));
          return key ? r[key] : "";
        };

        return {
          matricula: String(findV(['matricula', 'cod', 'registro'])).trim(),
          nome: String(findV(['nome', 'colaborador', 'funcionario'])).toUpperCase(),
          valorVT: ""
        };
      }).filter(i => i.matricula && i.nome !== "UNDEFINED");

      setBeneficiosData(list.sort((a, b) => a.nome.localeCompare(b.nome)));
    } catch (e) {
      alert("Erro ao ler planilha. Verifique o formato.");
    }
  };

  const updateOverride = (m, f, v) => setBeneficiosOverrides(p => ({ ...p, [m]: { ...(p[m] || {}), [f]: v } }));

  // Totais
  const vrDiarioNum = parseFloat(valorVRDiario) || 0;
  let totalVT = 0; let totalVR = 0;
  beneficiosData.forEach(c => {
    const o = beneficiosOverrides[c.matricula] || {};
    const dVT = Math.max(0, diasUteisBase - (parseInt(o.ausencias) || 0));
    totalVT += dVT * (parseFloat(o.valorVT) || 0);
    totalVR += (dVT * vrDiarioNum) * 0.91;
  });

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans p-4 md:p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        {/* Header Estilo Dark */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-[#1e293b] p-6 rounded-2xl border border-slate-700 shadow-xl">
          <div className="flex items-center gap-4">
            <img src="/logo.jpg" alt="Logo" className="h-12 w-auto rounded border border-slate-600" />
            <div>
              <h1 className="text-xl font-bold text-white">Mais Escoramentos</h1>
              <p className="text-xs text-slate-400 uppercase tracking-widest">Departamento Pessoal</p>
            </div>
          </div>
          <div className="flex bg-[#0f172a] p-1 rounded-xl mt-4 md:mt-0 border border-slate-700">
            <button onClick={() => setActiveTab('salario')} className={`px-6 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'salario' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>SALÁRIOS</button>
            <button onClick={() => setActiveTab('beneficios')} className={`px-6 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'beneficios' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>VT / VR</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Coluna Lateral de Configurações */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-[#1e293b] p-6 rounded-2xl border border-slate-700 shadow-lg">
              <h3 className="text-sm font-bold text-blue-400 mb-4 flex items-center gap-2 uppercase"><Upload size={16}/> Configurações</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Planilha Cadastro</label>
                  <div onClick={() => fileInputCadastro.current.click()} className={`mt-1 p-3 border-2 border-dashed rounded-xl cursor-pointer transition ${cadastroFile ? 'border-green-500/50 bg-green-500/5' : 'border-slate-700 hover:border-blue-500/50'}`}>
                    <p className="text-xs truncate">{cadastroFile ? cadastroFile.name : "Clique para subir"}</p>
                    <input type="file" ref={fileInputCadastro} hidden onChange={e => setCadastroFile(e.target.files[0])} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Início</label>
                    <input type="date" className="w-full bg-[#0f172a] border border-slate-700 rounded-lg p-2 text-xs" onChange={e => setPeriodo({...periodo, start: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Fim</label>
                    <input type="date" className="w-full bg-[#0f172a] border border-slate-700 rounded-lg p-2 text-xs" onChange={e => setPeriodo({...periodo, end: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Feriados</label>
                    <input type="number" className="w-full bg-[#0f172a] border border-slate-700 rounded-lg p-2 text-xs" placeholder="0" onChange={e => setPeriodo({...periodo, feriados: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">VR Diário</label>
                    <input type="number" className="w-full bg-[#0f172a] border border-slate-700 rounded-lg p-2 text-xs text-blue-400 font-bold" placeholder="0.00" onChange={e => setValorVRDiario(e.target.value)} />
                  </div>
                </div>

                <button onClick={carregarColaboradores} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm shadow-lg transition shadow-blue-900/20">GERAR LISTA</button>
              </div>
            </div>

            {/* Cards de Resumo */}
            <div className="space-y-3">
              <div className="bg-[#1e293b] p-4 rounded-2xl border border-slate-700">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Total VT</p>
                <p className="text-xl font-bold text-white">R$ {totalVT.toFixed(2)}</p>
              </div>
              <div className="bg-[#1e293b] p-4 rounded-2xl border border-slate-700">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Total VR (Líq)</p>
                <p className="text-xl font-bold text-white">R$ {totalVR.toFixed(2)}</p>
              </div>
              <div className="bg-green-600 p-4 rounded-2xl shadow-lg shadow-green-900/20">
                <p className="text-[10px] font-bold text-green-100 uppercase">Total Geral</p>
                <p className="text-2xl font-black text-white">R$ {(totalVT + totalVR).toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Tabela Principal */}
          <div className="lg:col-span-3">
            <div className="bg-[#1e293b] rounded-2xl border border-slate-700 shadow-lg overflow-hidden">
              <div className="p-4 border-b border-slate-700 bg-[#1e293b] flex justify-between items-center">
                <h2 className="text-sm font-bold flex items-center gap-2"><Bus size={18} className="text-blue-400"/> Listagem de Benefícios</h2>
                <div className="flex gap-2 text-[10px] font-bold bg-[#0f172a] px-3 py-1 rounded-full border border-slate-700">
                   <span className="text-blue-400">{diasUteisBase} DIAS ÚTEIS</span>
                </div>
              </div>
              
              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-[#1e293b] border-b border-slate-700 text-slate-500 font-bold uppercase">
                    <tr>
                      <th className="p-4">Matrícula</th>
                      <th className="p-4">Colaborador</th>
                      <th className="p-4 text-center">VT Diário</th>
                      <th className="p-4 text-center">Faltas</th>
                      <th className="p-4 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {beneficiosData.length > 0 ? beneficiosData.map((c, i) => {
                      const o = beneficiosOverrides[c.matricula] || {};
                      const diasFinal = Math.max(0, diasUteisBase - (parseInt(o.ausencias) || 0));
                      const vvt = (parseFloat(o.valorVT) || 0) * diasFinal;
                      const vvr = (vrDiarioNum * diasFinal) * 0.91;
                      
                      return (
                        <tr key={i} className="hover:bg-slate-800/50 transition">
                          <td className="p-4 font-mono text-slate-500">{c.matricula}</td>
                          <td className="p-4 font-bold text-slate-200">{c.nome}</td>
                          <td className="p-4 text-center">
                            <input type="number" className="w-20 bg-[#0f172a] border border-slate-700 rounded p-1 text-center text-blue-400 font-bold" placeholder="0.00" onChange={e => updateOverride(c.matricula, 'valorVT', e.target.value)} />
                          </td>
                          <td className="p-4 text-center">
                            <input type="number" className="w-14 bg-[#0f172a] border border-slate-700 rounded p-1 text-center" placeholder="0" onChange={e => updateOverride(c.matricula, 'ausencias', e.target.value)} />
                          </td>
                          <td className="p-4 text-right font-bold text-green-400">R$ {(vvt + vvr).toFixed(2)}</td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan="5" className="p-20 text-center text-slate-600 font-medium uppercase tracking-widest text-[10px]">Aguardando carregamento da lista...</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}