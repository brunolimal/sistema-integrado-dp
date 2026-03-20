// CONTEÚDO PARA O SEU APP.JSX
import { db } from './firebase'; 
import { collection, addDoc, getDocs, query, orderBy, doc, deleteDoc, setDoc } from "firebase/firestore";
import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, Download, AlertTriangle, FileSpreadsheet, CheckCircle, 
  ArrowRight, FileText, CalendarDays, Calculator, Bus, Coffee, 
  Users, PieChart, Plus, Trash2, Clock, Save, RotateCcw 
} from 'lucide-react';

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
  
  const [colaboradores, setColaboradores] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [salarioData, setSalarioData] = useState([]);
  const [paymentType, setPaymentType] = useState('1');
  const [periodo, setPeriodo] = useState({ start: '', end: '', feriados: 0 });
  const [valorVRDiario, setValorVRDiario] = useState('');
  const [beneficiosData, setBeneficiosData] = useState([]);
  const [beneficiosOverrides, setBeneficiosOverrides] = useState({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ matricula: '', nome: '', cpf: '', banco: '', agencia: '', conta: '', valorVT: '', centroCusto: 'ADMINISTRATIVO' });
  const [diasUteisBase, setDiasUteisBase] = useState(0);
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'alert', onConfirm: null });

  const showAlert = (title, message) => setModalConfig({ isOpen: true, title, message, type: 'alert', onConfirm: null });
  const showConfirm = (title, message, onConfirm) => setModalConfig({ isOpen: true, title, message, type: 'confirm', onConfirm });
  const closeModal = () => setModalConfig({ ...modalConfig, isOpen: false });
  const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(val) || 0);

  useEffect(() => {
    const loadDependencies = async () => {
      setIsReady(true);
    };
    loadDependencies();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!db) return;
        const colabSnap = await getDocs(collection(db, "colaboradores"));
        setColaboradores(colabSnap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
        const histQuery = query(collection(db, "historico_dp"), orderBy("timestamp", "desc"));
        const histSnap = await getDocs(histQuery);
        setHistorico(histSnap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      } catch (e) {
        console.error("Erro Firebase:", e);
      } finally {
        setIsLoading(false);
      }
    };
    if (isReady) fetchData();
  }, [isReady]);

  const handleSaveColaborador = async (e) => {
    e.preventDefault();
    const matSegura = String(formData.matricula).trim().replace(/^0+/, '') || '0';
    try {
      await setDoc(doc(db, "colaboradores", matSegura), { ...formData, matricula: matSegura });
      const snap = await getDocs(collection(db, "colaboradores"));
      setColaboradores(snap.docs.map(d => ({ ...d.data(), id: d.id })));
      setFormData({ matricula: '', nome: '', cpf: '', banco: '', agencia: '', conta: '', valorVT: '', centroCusto: 'ADMINISTRATIVO' });
      setShowAddForm(false);
      showAlert("Sucesso", "Salvo na nuvem!");
    } catch (e) { showAlert("Erro", "Falha ao salvar."); }
  };

  const removerColaborador = (mat) => {
    showConfirm("Excluir", "Remover definitivamente?", async () => {
      try {
        await deleteDoc(doc(db, "colaboradores", mat));
        setColaboradores(prev => prev.filter(c => c.matricula !== mat));
      } catch (e) { showAlert("Erro", "Não foi possível excluir."); }
    });
  };

  const salvarFechamento = async () => {
    const total = erpResumo.reduce((acc, curr) => acc + curr.total, 0);
    const novoRegistro = {
      dataHora: new Date().toLocaleString('pt-BR'),
      tipo: paymentType === '1' ? 'Folha Mensal' : 'Adiantamento',
      valorTotal: total,
      timestamp: Date.now()
    };
    try {
      await addDoc(collection(db, "historico_dp"), novoRegistro);
      const q = query(collection(db, "historico_dp"), orderBy("timestamp", "desc"));
      const snap = await getDocs(q);
      setHistorico(snap.docs.map(d => ({ ...d.data(), id: d.id })));
      showAlert("Sucesso", "Histórico salvo!");
    } catch (e) { showAlert("Erro", "Erro ao gravar."); }
  };

  const getERPData = () => {
    const erp = {};
    return Object.keys(erp).map(cc => ({ centroCusto: cc, total: 0 }));
  };
  const erpResumo = getERPData();

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

  return (
    <div className="min-h-screen bg-gray-50 p-6 text-gray-900">
      {modalConfig.isOpen && (
        <div className="fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold mb-2">{modalConfig.title}</h3>
            <p className="text-gray-600 mb-6 text-sm">{modalConfig.message}</p>
            <div className="flex justify-end space-x-3">
              <button onClick={closeModal} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Fechar</button>
              {modalConfig.type === 'confirm' && <button onClick={modalConfig.onConfirm} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Confirmar</button>}
            </div>
          </div>
        </div>
      )}
      
      <div className="max-w-[1400px] mx-auto space-y-6">
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-6 flex items-center space-x-4 border-b bg-gradient-to-r from-blue-50 to-white">
            <img src="/logo.jpg" alt="Logo" className="h-14 w-auto object-contain rounded" />
            <div><h1 className="text-2xl font-bold">Sistema Integrado de DP Cloud</h1><p className="text-sm text-gray-500">Mais Escoramentos - Sincronizado</p></div>
          </div>
          <div className="flex flex-wrap border-b">
            {['colaboradores', 'historico', 'erp'].map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-4 text-xs font-bold uppercase ${activeTab === t ? 'text-blue-700 bg-blue-50 border-b-2 border-blue-600' : 'text-gray-400'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'colaboradores' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border flex justify-between items-center">
              <div><h2 className="text-lg font-semibold">Base na Nuvem</h2><p className="text-xs text-gray-400">Total: {colaboradores.length} registros</p></div>
              <button onClick={() => setShowAddForm(!showAddForm)} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold">+ Novo</button>
            </div>
            {showAddForm && (
              <form onSubmit={handleSaveColaborador} className="bg-blue-50 p-6 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-4 border">
                <input placeholder="Matrícula" value={formData.matricula} onChange={e => setFormData({...formData, matricula: e.target.value})} className="border p-2 rounded" />
                <input placeholder="Nome" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} className="border p-2 rounded" />
                <button type="submit" className="bg-green-600 text-white font-bold rounded">Salvar no Firebase</button>
              </form>
            )}
            <div className="bg-white rounded-xl border overflow-hidden">
               <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50"><tr><th className="p-4">Matrícula</th><th className="p-4">Nome</th><th className="p-4 text-center">Ações</th></tr></thead>
                  <tbody>
                    {colaboradores.map(c => (
                      <tr key={c.id} className="border-b">
                        <td className="p-4 font-mono">{c.matricula}</td><td className="p-4 font-bold">{c.nome}</td>
                        <td className="p-4 text-center text-red-500 cursor-pointer" onClick={() => removerColaborador(c.matricula)}><Trash2 size={18} className="mx-auto"/></td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
          </div>
        )}

        {activeTab === 'historico' && (
          <div className="bg-white p-6 rounded-xl border">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Clock className="text-blue-600"/> Histórico Nuvem</h2>
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 font-bold text-[10px] uppercase">
                <tr><th className="p-4">Data</th><th className="p-4">Tipo</th><th className="p-4 text-right">Valor</th></tr>
              </thead>
              <tbody>
                {historico.map(h => (
                  <tr key={h.id} className="border-b">
                    <td className="p-4">{h.dataHora}</td><td className="p-4 font-bold">{h.tipo}</td>
                    <td className="p-4 text-right font-black text-green-700">R$ {formatMoney(h.valorTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}