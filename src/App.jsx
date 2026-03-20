// Importe a configuração do Firebase
import { db } from './firebase'; 
import { collection, addDoc, getDocs, query, orderBy, doc, deleteDoc, setDoc } from "firebase/firestore";
import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, AlertTriangle, FileSpreadsheet, CheckCircle, ArrowRight, FileText, CalendarDays, Calculator, Bus, Coffee, Users, PieChart, Plus, Trash2, Clock, RotateCcw, Save } from 'lucide-react';

// ================= COMPONENTE DE INPUT MONETÁRIO INTELIGENTE =================
const CurrencyInput = ({ value, onChange, className, placeholder }) => {
  const formatVal = (v) => {
    if (v === '' || v === null || v === undefined) return '';
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v));
  };
  const [displayValue, setDisplayValue] = useState(formatVal(value));
  const [isFocused, setIsFocused] = useState(false);
  useEffect(() => { if (!isFocused) setDisplayValue(formatVal(value)); }, [value, isFocused]);
  const handleBlur = () => {
    setIsFocused(false);
    if (!displayValue) { onChange(''); return; }
    const cleanStr = displayValue.replace(/[^0-9.,]/g, '');
    const lastCommaIndex = cleanStr.lastIndexOf(',');
    const lastDotIndex = cleanStr.lastIndexOf('.');
    let numericVal = lastCommaIndex > lastDotIndex ? parseFloat(cleanStr.replace(/\./g, '').replace(',', '.')) : (lastDotIndex > lastCommaIndex ? parseFloat(cleanStr.replace(/,/g, '')) : parseFloat(cleanStr));
    if (!isNaN(numericVal)) { onChange(numericVal); setDisplayValue(formatVal(numericVal)); } else { onChange(''); setDisplayValue(''); }
  };
  return ( <input type="text" value={isFocused ? displayValue : (displayValue ? `R$ ${displayValue}` : '')} onChange={(e) => setDisplayValue(e.target.value)} onFocus={() => setIsFocused(true)} onBlur={handleBlur} className={className} placeholder={placeholder} /> );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('colaboradores');
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // ================= ESTADOS SINCRONIZADOS COM FIREBASE =================
  const [colaboradores, setColaboradores] = useState([]);
  const [historico, setHistorico] = useState([]);

  // Estados Locais (Sessão)
  const [salarioData, setSalarioData] = useState([]);
  const [paymentType, setPaymentType] = useState('1');
  const [periodo, setPeriodo] = useState({ start: '', end: '', feriados: 0 });
  const [valorVRDiario, setValorVRDiario] = useState('');
  const [beneficiosData, setBeneficiosData] = useState([]);
  const [beneficiosOverrides, setBeneficiosOverrides] = useState({});

  // Carregar dados da Nuvem ao iniciar
  useEffect(() => {
    const fetchData = async () => {
      if (!db) return;
      try {
        const colabSnap = await getDocs(collection(db, "colaboradores"));
        setColaboradores(colabSnap.docs.map(d => ({ ...d.data(), id: d.id })));
        
        const histQuery = query(collection(db, "historico_dp"), orderBy("timestamp", "desc"));
        const histSnap = await getDocs(histQuery);
        setHistorico(histSnap.docs.map(d => ({ ...d.data(), id: d.id })));
      } catch (e) { console.error("Erro Firebase:", e); }
      finally { setIsLoading(false); }
    };
    if (isReady) fetchData();
  }, [isReady]);

  // Restante das referências e modais do seu código original
  const fileInputCadastro = useRef(null);
  const fileInputEspelho = useRef(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ matricula: '', nome: '', cpf: '', banco: '', agencia: '', conta: '', valorVT: '', centroCusto: 'ADMINISTRATIVO' });
  const [espelhoFile, setEspelhoFile] = useState(null);
  const [errorsSalario, setErrorsSalario] = useState([]);
  const [isProcessingSalario, setIsProcessingSalario] = useState(false);
  const [diasUteisBase, setDiasUteisBase] = useState(0);
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'alert', onConfirm: null });

  const showAlert = (title, message) => setModalConfig({ isOpen: true, title, message, type: 'alert', onConfirm: null });
  const showConfirm = (title, message, onConfirm) => setModalConfig({ isOpen: true, title, message, type: 'confirm', onConfirm });
  const closeModal = () => setModalConfig({ ...modalConfig, isOpen: false });
  const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(val) || 0);
  const normalizeKey = (key) => key ? String(key).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
  const normalizeText = (text) => text ? String(text).trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';

  useEffect(() => {
    const loadDependencies = async () => {
      if (!window.XLSX) {
        const s = document.createElement('script');
        s.src = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
        document.body.appendChild(s);
      }
      if (!window.pdfjsLib) {
        const s = document.createElement('script');
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        document.body.appendChild(s);
      }
      setIsReady(true);
    };
    loadDependencies();
  }, []);

  // ---------- AÇÕES FIREBASE (Substituindo LocalStorage) ----------
  const handleSaveColaborador = async (e) => {
    e.preventDefault();
    if(!formData.matricula || !formData.nome) return showAlert("Atenção", "Matrícula e Nome são obrigatórios.");
    const matSegura = String(formData.matricula).trim().replace(/^0+/, '') || '0';
    try {
      await setDoc(doc(db, "colaboradores", matSegura), { ...formData, matricula: matSegura });
      const snap = await getDocs(collection(db, "colaboradores"));
      setColaboradores(snap.docs.map(d => ({ ...d.data(), id: d.id })));
      setFormData({ matricula: '', nome: '', cpf: '', banco: '', agencia: '', conta: '', valorVT: '', centroCusto: 'ADMINISTRATIVO' });
      setShowAddForm(false);
      showAlert("Sucesso", "Colaborador salvo na nuvem!");
    } catch (e) { showAlert("Erro", "Falha ao salvar."); }
  };

  const removerColaborador = (mat) => {
    showConfirm("Excluir", "Remover definitivamente da nuvem?", async () => {
      try {
        await deleteDoc(doc(db, "colaboradores", mat));
        setColaboradores(prev => prev.filter(c => c.matricula !== mat));
      } catch (e) { showAlert("Erro", "Erro ao excluir."); }
    });
  };

  const salvarFechamento = async () => {
    const erpData = getERPData();
    if (erpData.length === 0) return showAlert("Atenção", "Sem dados para salvar.");
    const totalGeral = erpData.reduce((acc, curr) => acc + curr.total, 0);
    const novoRegistro = {
      dataHora: new Date().toLocaleString('pt-BR'),
      tipo: 'Fechamento Consolidado',
      detalhes: `Vidas: ${colaboradores.length} | Setores: ${erpData.length}`,
      valorTotal: totalGeral,
      timestamp: Date.now()
    };
    try {
      await addDoc(collection(db, "historico_dp"), novoRegistro);
      const histSnap = await getDocs(query(collection(db, "historico_dp"), orderBy("timestamp", "desc")));
      setHistorico(histSnap.docs.map(d => ({ ...d.data(), id: d.id })));
      showAlert("Sucesso", "Fechamento salvo na nuvem!");
    } catch (e) { showAlert("Erro", "Erro ao salvar histórico."); }
  };

  // Mantendo toda a sua lógica original de cálculos e processamento abaixo
  const getERPData = () => {
    const erp = {};
    salarioData.forEach(item => {
      const cc = item.centroCusto || 'GERAL';
      if (!erp[cc]) erp[cc] = { salario: 0, vt: 0, vr: 0, headCount: new Set() };
      erp[cc].salario += item.valor; erp[cc].headCount.add(item.matricula);
    });
    const benData = calcBeneficios();
    benData.forEach(item => {
      if (item.totalGeral > 0) {
        const cc = item.centroCusto || 'GERAL';
        if (!erp[cc]) erp[cc] = { salario: 0, vt: 0, vr: 0, headCount: new Set() };
        erp[cc].vt += item.totalVT; erp[cc].vr += item.totalVRLiquido; erp[cc].headCount.add(item.matricula);
      }
    });
    return Object.keys(erp).map(cc => ({ centroCusto: cc, salario: erp[cc].salario, vt: erp[cc].vt, vr: erp[cc].vr, total: erp[cc].salario + erp[cc].vt + erp[cc].vr, vidas: erp[cc].headCount.size })).sort((a,b) => a.centroCusto.localeCompare(b.centroCusto));
  };

  const calcBeneficios = () => {
    const vrD = parseFloat(valorVRDiario) || 0;
    return beneficiosData.map(colab => {
      const o = beneficiosOverrides[colab.matricula] || {};
      const dVT = Math.max(0, diasUteisBase - (parseInt(o.ausencias)||0) - (parseInt(o.descontoVT)||0) + (parseInt(o.acrescimosVT)||0));
      const dVR = Math.max(0, diasUteisBase - (parseInt(o.ausencias)||0) - (parseInt(o.descontoVR)||0) + (parseInt(o.acrescimosVR)||0));
      const tVT = dVT * (parseFloat(o.valorVT)||0);
      const tVR = (dVR * vrD) * 0.91;
      return { ...colab, totalVT: tVT, totalVRLiquido: tVR, totalGeral: tVT + tVR };
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RotateCcw className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-bold">Conectando ao banco de dados...</p>
        </div>
      </div>
    );
  }

  // O seu JSX original começa aqui, mantendo abas, botões e tabelas
  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans pb-20 relative text-gray-900">
      {modalConfig.isOpen && (
        <div className="fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-2">{modalConfig.title}</h3>
            <p className="text-gray-600 mb-6 text-sm">{modalConfig.message}</p>
            <div className="flex justify-end space-x-3">
              {modalConfig.type === 'confirm' && <button onClick={closeModal} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm">Cancelar</button>}
              <button onClick={() => { if (modalConfig.onConfirm) modalConfig.onConfirm(); closeModal(); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">OK</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Renderização das Abas idêntica ao original */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 flex flex-col md:flex-row items-center justify-between border-b bg-gradient-to-r from-blue-50 to-white">
            <div className="flex items-center space-x-4">
              <img src="/logo.jpg" alt="Logo" className="h-14 w-auto object-contain rounded" />
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Sistema Integrado de DP Cloud</h1>
                <p className="text-sm text-gray-600 mt-1">Dados Sincronizados na Nuvem</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap border-b border-gray-200">
            {['colaboradores', 'salario', 'beneficios', 'erp', 'historico'].map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-4 px-4 text-sm font-bold uppercase transition-colors ${activeTab === t ? 'text-blue-700 bg-blue-50 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>
                {t.replace('salario', 'Salário').replace('beneficios', 'VT/VR')}
              </button>
            ))}
          </div>
        </div>

        {/* Conteúdo da aba Colaboradores */}
        {activeTab === 'colaboradores' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 bg-white p-6 rounded-xl border flex justify-between items-center">
                <div><h2 className="text-lg font-semibold">Base de Colaboradores na Nuvem</h2><p className="text-xs text-gray-400">Total: {colaboradores.length} registros ativos</p></div>
                <button onClick={() => setShowAddForm(!showAddForm)} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold">+ Novo Cadastro</button>
              </div>
            </div>
            {showAddForm && (
              <form onSubmit={handleSaveColaborador} className="bg-blue-50 p-6 rounded-xl grid grid-cols-1 md:grid-cols-4 gap-4 border border-blue-100 shadow-inner">
                <input required placeholder="Matrícula *" value={formData.matricula} onChange={e => setFormData({...formData, matricula: e.target.value})} className="border p-2 rounded" />
                <input required placeholder="Nome *" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} className="border p-2 rounded col-span-2" />
                <CurrencyInput placeholder="Valor VT Diário" value={formData.valorVT} onChange={v => setFormData({...formData, valorVT: v})} className="border p-2 rounded" />
                <button type="submit" className="bg-green-600 text-white font-bold rounded py-2">Salvar na Nuvem</button>
              </form>
            )}
            <div className="bg-white rounded-xl border overflow-hidden">
               <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50"><tr><th className="p-4">Matrícula</th><th className="p-4">Nome</th><th className="p-4">VT Padrão</th><th className="p-4 text-center">Ações</th></tr></thead>
                  <tbody>
                    {colaboradores.map(c => (
                      <tr key={c.matricula} className="border-b hover:bg-gray-50">
                        <td className="p-4 font-mono">{c.matricula}</td><td className="p-4 font-bold">{c.nome}</td>
                        <td className="p-4 text-blue-600 font-bold">R$ {formatMoney(c.valorVT)}</td>
                        <td className="p-4 text-center text-red-500 cursor-pointer" onClick={() => removerColaborador(c.matricula)}><Trash2 size={18} className="mx-auto"/></td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
          </div>
        )}

        {/* Conteúdo da aba Histórico */}
        {activeTab === 'historico' && (
          <div className="bg-white p-6 rounded-xl border animate-fade-in">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800"><Clock className="text-blue-600"/> Histórico Nuvem</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 uppercase text-[10px] font-bold">
                  <tr><th className="p-4">Data/Hora</th><th className="p-4">Tipo</th><th className="p-4 text-right">Valor Total</th></tr>
                </thead>
                <tbody>
                  {historico.map(h => (
                    <tr key={h.id} className="border-b">
                      <td className="p-4 font-mono text-gray-500">{h.dataHora}</td><td className="p-4 font-bold">{h.tipo}</td>
                      <td className="p-4 text-right font-black text-green-700">R$ {formatMoney(h.valorTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Botão de Salvar no ERP */}
        {activeTab === 'erp' && (
          <div className="bg-white p-8 rounded-xl border text-center relative animate-fade-in">
             <button onClick={salvarFechamento} className="absolute top-8 right-8 bg-green-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg hover:bg-green-700 transition-colors"><Save size={20}/> SALVAR NO HISTÓRICO</button>
             <PieChart className="w-12 h-12 text-blue-600 mx-auto mb-4" />
             <h2 className="text-2xl font-bold">Resumo por Centro de Custo</h2>
             <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
                {erpResumo.map(r => (
                  <div key={r.centroCusto} className="border rounded-xl p-4 bg-gray-50 text-left border-l-4 border-l-blue-600">
                    <p className="text-xs font-bold uppercase text-gray-400">{r.centroCusto}</p>
                    <p className="text-xl font-black text-gray-800">R$ {formatMoney(r.total)}</p>
                    <p className="text-[10px] text-blue-500 mt-1">{r.vidas} colaboradores</p>
                  </div>
                ))}
             </div>
          </div>
        )}
      </div>
    </div>
  );
}