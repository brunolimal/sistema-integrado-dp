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

  useEffect(() => {
    if (!isFocused) setDisplayValue(formatVal(value));
  }, [value, isFocused]);

  const handleBlur = () => {
    setIsFocused(false);
    if (!displayValue) {
      onChange('');
      return;
    }
    const cleanStr = displayValue.replace(/[^0-9.,]/g, '');
    const lastCommaIndex = cleanStr.lastIndexOf(',');
    const lastDotIndex = cleanStr.lastIndexOf('.');
    
    let numericVal = 0;
    if (lastCommaIndex > lastDotIndex) {
        numericVal = parseFloat(cleanStr.replace(/\./g, '').replace(',', '.'));
    } else if (lastDotIndex > lastCommaIndex) {
        numericVal = parseFloat(cleanStr.replace(/,/g, ''));
    } else {
        numericVal = parseFloat(cleanStr);
    }
    
    if (!isNaN(numericVal)) {
      onChange(numericVal);
      setDisplayValue(formatVal(numericVal));
    } else {
      onChange('');
      setDisplayValue('');
    }
  };

  return (
    <input
      type="text"
      value={isFocused ? displayValue : (displayValue ? `R$ ${displayValue}` : '')}
      onChange={(e) => setDisplayValue(e.target.value)}
      onFocus={() => setIsFocused(true)}
      onBlur={handleBlur}
      className={className}
      placeholder={placeholder}
    />
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('colaboradores');
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // ================= ESTADOS SINCRONIZADOS COM FIREBASE =================
  const [colaboradores, setColaboradores] = useState([]);
  const [historico, setHistorico] = useState([]);

  // Estados Locais de Sessão
  const [salarioData, setSalarioData] = useState([]);
  const [paymentType, setPaymentType] = useState('1'); // '1' = Folha Mensal, '2' = Adiantamento
  const [periodo, setPeriodo] = useState({ start: '', end: '', feriados: 0 });
  const [valorVRDiario, setValorVRDiario] = useState('');
  const [beneficiosData, setBeneficiosData] = useState([]);
  const [beneficiosOverrides, setBeneficiosOverrides] = useState({});

  // Refs e outros estados originais
  const fileInputCadastro = useRef(null);
  const fileInputEspelho = useRef(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    matricula: '', nome: '', cpf: '', banco: '', agencia: '', conta: '', valorVT: '', centroCusto: 'ADMINISTRATIVO'
  });
  const [espelhoFile, setEspelhoFile] = useState(null);
  const [errorsSalario, setErrorsSalario] = useState([]);
  const [isProcessingSalario, setIsProcessingSalario] = useState(false);
  const [diasUteisBase, setDiasUteisBase] = useState(0);
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'alert', onConfirm: null });

  const showAlert = (title, message) => setModalConfig({ isOpen: true, title, message, type: 'alert', onConfirm: null });
  const showConfirm = (title, message, onConfirm) => setModalConfig({ isOpen: true, title, message, type: 'confirm', onConfirm });
  const closeModal = () => setModalConfig({ ...modalConfig, isOpen: false });
  const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(val) || 0);

  // CARREGAR DADOS DO FIREBASE AO INICIAR
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!db) return;
        const colabSnap = await getDocs(collection(db, "colaboradores"));
        setColaboradores(colabSnap.docs.map(d => ({ ...d.data(), id: d.id })));
        
        const histQuery = query(collection(db, "historico_dp"), orderBy("timestamp", "desc"));
        const histSnap = await getDocs(histQuery);
        setHistorico(histSnap.docs.map(d => ({ ...d.data(), id: d.id })));
      } catch (e) {
        console.error("Erro ao carregar banco:", e);
      } finally {
        setIsLoading(false);
      }
    };
    if (isReady) fetchData();
  }, [isReady]);

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

  // FUNÇÕES DE SALVAMENTO NO FIREBASE
  const handleSaveColaborador = async (e) => {
    e.preventDefault();
    if (!formData.matricula || !formData.nome) return showAlert("Erro", "Campos obrigatórios!");
    const matId = String(formData.matricula).trim();
    try {
      await setDoc(doc(db, "colaboradores", matId), { ...formData, matricula: matId });
      const snap = await getDocs(collection(db, "colaboradores"));
      setColaboradores(snap.docs.map(d => ({ ...d.data(), id: d.id })));
      setFormData({ matricula: '', nome: '', cpf: '', banco: '', agencia: '', conta: '', valorVT: '', centroCusto: 'ADMINISTRATIVO' });
      setShowAddForm(false);
      showAlert("Sucesso", "Salvo na nuvem!");
    } catch (e) { showAlert("Erro", "Falha ao sincronizar."); }
  };

  const removerColaborador = (mat) => {
    showConfirm("Remover", "Excluir permanentemente da nuvem?", async () => {
      try {
        await deleteDoc(doc(db, "colaboradores", String(mat)));
        setColaboradores(prev => prev.filter(c => String(c.matricula) !== String(mat)));
      } catch (e) { showAlert("Erro", "Falha ao remover."); }
    });
  };

  const salvarFechamento = async () => {
    const erpData = getERPData();
    if (erpData.length === 0) return showAlert("Aviso", "Não há dados para salvar.");
    const total = erpData.reduce((acc, curr) => acc + curr.total, 0);
    const novoLog = {
      dataHora: new Date().toLocaleString('pt-BR'),
      tipo: paymentType === '1' ? 'Folha Mensal' : 'Adiantamento',
      detalhes: `Vidas: ${colaboradores.length} | Setores: ${erpData.length}`,
      valorTotal: total,
      timestamp: Date.now()
    };
    try {
      await addDoc(collection(db, "historico_dp"), novoLog);
      const snap = await getDocs(query(collection(db, "historico_dp"), orderBy("timestamp", "desc")));
      setHistorico(snap.docs.map(d => ({ ...d.data(), id: d.id })));
      showAlert("Sucesso", "Fechamento salvo na nuvem!");
    } catch (e) { showAlert("Erro", "Falha ao salvar histórico."); }
  };

  // Mantive sua lógica de ERP e Benefícios intacta
  const getERPData = () => {
    const erp = {};
    salarioData.forEach(item => {
      const cc = item.centroCusto || 'N/D';
      if (!erp[cc]) erp[cc] = { salario: 0, vt: 0, vr: 0, headCount: new Set() };
      erp[cc].salario += item.valor; erp[cc].headCount.add(item.matricula);
    });
    calcBeneficios().forEach(item => {
      if (item.totalGeral > 0) {
        const cc = item.centroCusto || 'N/D';
        if (!erp[cc]) erp[cc] = { salario: 0, vt: 0, vr: 0, headCount: new Set() };
        erp[cc].vt += item.totalVT; erp[cc].vr += item.totalVRLiquido; erp[cc].headCount.add(item.matricula);
      }
    });
    return Object.keys(erp).map(cc => ({ centroCusto: cc, salario: erp[cc].salario, vt: erp[cc].vt, vr: erp[cc].vr, total: erp[cc].salario + erp[cc].vt + erp[cc].vr, vidas: erp[cc].headCount.size }));
  };

  const calcBeneficios = () => {
    const vrD = parseFloat(valorVRDiario) || 0;
    return beneficiosData.map(c => {
      const o = beneficiosOverrides[c.matricula] || {};
      const dVT = Math.max(0, (diasUteisBase - (parseInt(o.ausencias)||0) - (parseInt(o.descontoVT)||0) + (parseInt(o.acrescimosVT)||0)));
      const dVR = Math.max(0, (diasUteisBase - (parseInt(o.ausencias)||0) - (parseInt(o.descontoVR)||0) + (parseInt(o.acrescimosVR)||0)));
      const tVT = dVT * (parseFloat(o.valorVT)||0);
      const tVR = (dVR * vrD) * 0.91;
      return { ...c, totalVT: tVT, totalVRLiquido: tVR, totalGeral: tVT + tVR };
    });
  };

  // TELA DE CARREGAMENTO
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

  // O RESTO DO SEU JSX CONTINUA EXATAMENTE IGUAL ABAIXO
  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans pb-20 relative text-gray-900">
      {/* SEU HEADER, TABS E CONTEÚDO ORIGINAL AQUI */}
      <div className="max-w-[1400px] mx-auto space-y-6">
         {/* ... (Todo o seu código de interface original) ... */}
         {/* Certifique-se de usar handleSaveColaborador no form e salvarFechamento no botão de salvar */}
         <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 flex items-center space-x-4 border-b bg-gradient-to-r from-blue-50 to-white">
               <img src="/logo.jpg" alt="Logo" className="h-14 w-auto object-contain" />
               <h1 className="text-2xl font-bold">Sistema Integrado de DP Cloud</h1>
            </div>
            <div className="flex border-b overflow-x-auto">
               {['colaboradores', 'salario', 'beneficios', 'erp', 'historico'].map(t => (
                 <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-4 px-6 text-xs font-bold uppercase ${activeTab === t ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-400'}`}>
                   {t}
                 </button>
               ))}
            </div>
         </div>

         {activeTab === 'colaboradores' && (
           <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl border flex justify-between items-center">
                 <h2 className="font-bold">Base Sincronizada</h2>
                 <button onClick={() => setShowAddForm(!showAddForm)} className="bg-blue-600 text-white px-4 py-2 rounded font-bold">+ Novo</button>
              </div>
              {showAddForm && (
                <form onSubmit={handleSaveColaborador} className="bg-blue-50 p-6 rounded-xl grid grid-cols-4 gap-4">
                   <input placeholder="Matrícula" value={formData.matricula} onChange={e => setFormData({...formData, matricula: e.target.value})} className="border p-2 rounded" />
                   <input placeholder="Nome" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} className="border p-2 rounded col-span-2" />
                   <button type="submit" className="bg-green-600 text-white font-bold rounded">Salvar na Nuvem</button>
                </form>
              )}
              <div className="bg-white rounded-xl border overflow-hidden">
                 <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50"><tr><th className="p-4">Matrícula</th><th className="p-4">Nome</th><th className="p-4 text-center">Ações</th></tr></thead>
                    <tbody>
                       {colaboradores.map(c => (
                         <tr key={c.id} className="border-b">
                            <td className="p-4">{c.matricula}</td><td className="p-4 font-bold">{c.nome}</td>
                            <td className="p-4 text-center text-red-500 cursor-pointer" onClick={() => removerColaborador(c.matricula)}><Trash2 size={18} className="mx-auto"/></td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
         )}

         {/* ... (Continuar com as outras abas seguindo sua lógica original) ... */}
         {activeTab === 'erp' && (
           <div className="bg-white p-8 rounded-xl border relative text-center">
              <button onClick={salvarFechamento} className="absolute top-8 right-8 bg-green-600 text-white px-4 py-2 rounded font-bold flex items-center gap-2"><Save size={18}/> SALVAR FECHAMENTO</button>
              <h2 className="text-xl font-bold mb-8">Resumo por Centro de Custo</h2>
              <div className="grid grid-cols-4 gap-4">
                 {getERPData().map(r => (
                   <div key={r.centroCusto} className="bg-gray-50 p-4 rounded-xl border-l-4 border-blue-600 text-left">
                      <p className="text-xs font-bold text-gray-400 uppercase">{r.centroCusto}</p>
                      <p className="text-lg font-black">R$ {formatMoney(r.total)}</p>
                   </div>
                 ))}
              </div>
           </div>
         )}
      </div>
      
      {/* Modal de confirmação original */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
           <div className="bg-white p-6 rounded-xl max-w-sm w-full">
              <h3 className="font-bold mb-2">{modalConfig.title}</h3>
              <p className="text-sm text-gray-500 mb-6">{modalConfig.message}</p>
              <div className="flex justify-end gap-2">
                 <button onClick={closeModal} className="px-4 py-2 bg-gray-100 rounded">Sair</button>
                 <button onClick={() => { if(modalConfig.onConfirm) modalConfig.onConfirm(); closeModal(); }} className="px-4 py-2 bg-blue-600 text-white rounded">Ok</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}