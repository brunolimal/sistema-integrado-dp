import React, { useState, useRef, useEffect } from 'react';
import { db } from './firebase'; 
import { collection, addDoc, getDocs, query, orderBy, doc, deleteDoc, setDoc } from "firebase/firestore";
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
  const [salarioData, setSalarioData] = useState([]);
  const [paymentType, setPaymentType] = useState('1');
  const [periodo, setPeriodo] = useState({ start: '', end: '', feriados: 0 });
  const [valorVRDiario, setValorVRDiario] = useState('');
  const [beneficiosData, setBeneficiosData] = useState([]);
  const [beneficiosOverrides, setBeneficiosOverrides] = useState({});

  // Carregar dados da Nuvem ao iniciar (Substitui o LocalStorage)
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

  // Dependências originais
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
      if (!window.jspdf?.jsPDF?.API?.autoTable) {
         const autoTableScript = document.createElement('script');
         autoTableScript.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js";
         document.body.appendChild(autoTableScript);
      }
      setIsReady(true);
    };
    loadDependencies();
  }, []);

  // Outros estados originais
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

  // Funções Auxiliares originais
  const normalizeKey = (key) => key ? String(key).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
  const normalizeText = (text) => text ? String(text).trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
  const formatCPF = (cpfRaw) => {
    let cpf = String(cpfRaw).replace(/[^\d]/g, '');
    if (cpf.length > 0 && cpf.length <= 11) return cpf.padStart(11, '0').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    return cpfRaw;
  };
  const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(val) || 0);

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
    if (/^\d+$/.test(str.trim())) return str.trim(); 
    return str; 
  };

  // ---------- ABA 1: COLABORADORES (Persistência Firebase) ----------
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
    } catch (e) {
      showAlert("Erro", "Falha ao salvar colaborador na nuvem.");
    }
  };

  const removerColaborador = (mat) => {
    showConfirm("Excluir Colaborador", "Deseja realmente remover este colaborador?", async () => {
      try {
        await deleteDoc(doc(db, "colaboradores", String(mat)));
        setColaboradores(prev => prev.filter(c => c.matricula !== mat));
      } catch (e) {
        showAlert("Erro", "Erro ao excluir da nuvem.");
      }
    });
  };

  const downloadTemplate = () => {
    if (!window.XLSX) return showAlert("Aviso", "Aguarde, sistema carregando...");
    const headers = [['Matrícula', 'Nome', 'CPF', 'Banco', 'Agência', 'Conta', 'Valor VT', 'Centro de Custo']];
    const ws = window.XLSX.utils.aoa_to_sheet(headers);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Cadastro_Padrao");
    window.XLSX.writeFile(wb, "Modelo_Cadastro_Colaboradores.xlsx");
  };

  const handleImportColaboradores = async (e) => {
    const file = e.target.files[0];
    if (!file || !window.XLSX) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = window.XLSX.read(buffer, { type: 'array' });
      const rawData = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
      const novos = [];
      rawData.forEach(row => {
        const getVal = (possibleKeys) => {
          const k = Object.keys(row).find(key => possibleKeys.some(pk => normalizeKey(key).includes(pk)));
          return k ? row[k] : "";
        };
        const mat = String(getVal(['matricula', 'mat'])).trim();
        if(!mat) return;
        const matSegura = mat.replace(/^0+/, '') || '0';
        novos.push({
          matricula: matSegura,
          nome: String(getVal(['nome'])).trim(),
          cpf: formatCPF(getVal(['cpf'])),
          banco: String(getVal(['banco'])).trim(),
          agencia: String(getVal(['agencia'])).trim(),
          conta: String(getVal(['conta'])).trim(),
          valorVT: parseFloat(String(getVal(['valor vt', 'vale transporte', 'vt di'])).replace(',', '.')) || '',
          centroCusto: (String(getVal(['centro', 'cc', 'custo', 'setor'])).trim() || 'GERAL').toUpperCase()
        });
      });
      if(novos.length > 0) {
        // Importação em massa para o Firebase
        for (const n of novos) {
          await setDoc(doc(db, "colaboradores", n.matricula), n);
        }
        setColaboradores(novos);
        showAlert("Sucesso", `${novos.length} colaboradores importados com sucesso!`);
      } else {
        showAlert("Erro", "Nenhum colaborador encontrado.");
      }
    } catch (error) {
      showAlert("Erro", "Erro ao ler ou importar a planilha.");
    }
    if(fileInputCadastro.current) fileInputCadastro.current.value = '';
  };

  // ---------- ABA 2: SALÁRIO (Original) ----------
  const processarSalario = async () => {
    if (colaboradores.length === 0) return showAlert("Atenção", "Cadastre ou importe os colaboradores primeiro na aba 'Colaboradores'.");
    if (!espelhoFile) return showAlert("Atenção", "Faça o upload do Espelho de Salário (PDF).");

    setIsProcessingSalario(true);
    setErrorsSalario([]);
    setSalarioData([]);

    try {
      const espelhoBuffer = await espelhoFile.arrayBuffer();
      const pdfData = new Uint8Array(espelhoBuffer);
      const pdf = await window.pdfjsLib.getDocument({data: pdfData}).promise;
      const pdfLines = [];
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const items = textContent.items;

        items.sort((a, b) => {
          if (Math.abs(b.transform[5] - a.transform[5]) > 5) return b.transform[5] - a.transform[5];
          return a.transform[4] - b.transform[4];
        });

        let currentLine = [];
        let currentY = items.length > 0 ? items[0].transform[5] : 0;
        
        items.forEach(item => {
          const text = item.str.trim();
          if (Math.abs(item.transform[5] - currentY) > 5) {
            if (currentLine.length > 0) pdfLines.push(currentLine.join(" "));
            currentLine = text ? [text] : [];
            currentY = item.transform[5];
          } else {
            if (text) currentLine.push(text);
          }
        });
        if (currentLine.length > 0) pdfLines.push(currentLine.join(" "));
      }

      const result = [];
      const currentErrors = [];
      const matriculasEncontradas = new Set();

      pdfLines.forEach((line) => {
        const lineNormalized = normalizeText(line);

        for (const colab of colaboradores) {
          const safeMat = colab.matricula;
          const regexMat = new RegExp(`\\b0*${safeMat}\\b`);
          const partesNome = normalizeText(colab.nome).split(' ').filter(n => n.length > 1);
          const primeiroNome = partesNome.length > 0 ? partesNome[0] : '';

          if (regexMat.test(line) && (primeiroNome === '' || lineNormalized.includes(primeiroNome))) {
            const valueMatches = line.match(/(?:\d{1,3}(?:\.\d{3})*|\d+),\d{2}/g);
            if (valueMatches && valueMatches.length > 0) {
              const lastMatch = valueMatches[valueMatches.length - 1];
              const valor = parseFloat(lastMatch.replace(/\./g, '').replace(',', '.'));
              
              if (valor > 0 && !matriculasEncontradas.has(safeMat)) {
                matriculasEncontradas.add(safeMat);
                let conta = colab.conta;
                let digito = "";
                if (conta.includes('-')) {
                  const parts = conta.split('-'); digito = parts.pop(); conta = parts.join('-');
                }
                if (!colab.agencia || !conta) currentErrors.push(`Atenção: Dados bancários incompletos para "${colab.nome}" (Matrícula: ${safeMat}).`);

                result.push({
                  agencia: colab.agencia, conta: conta, digito: digito, nome: colab.nome, cpf: colab.cpf,
                  bancoCode: getBankCode(colab.banco), valor: valor, centroCusto: colab.centroCusto || 'GERAL', matricula: safeMat
                });
              }
            }
          }
        }
      });

      if (result.length === 0) currentErrors.push("Erro: Não foi possível extrair valores cruzando com os colaboradores cadastrados.");
      setSalarioData(result);
      setErrorsSalario(currentErrors);
    } catch (error) {
      setErrorsSalario(["Ocorreu um erro ao processar o arquivo PDF."]);
    } finally {
      setIsProcessingSalario(false);
    }
  };

  const exportarArquivoBancoSalario = () => {
    if (salarioData.length === 0 || !window.XLSX) return;
    const bankData = salarioData.map(row => [row.agencia, row.conta, row.digito, row.nome, row.cpf, paymentType, row.valor]);
    const ws = window.XLSX.utils.aoa_to_sheet(bankData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Pagamentos");
    const tipoNome = paymentType === '1' ? 'Salário' : 'Adiantamento Salárial';
    window.XLSX.writeFile(wb, `${tipoNome}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ---------- ABA 3: BENEFÍCIOS (Original) ----------
  useEffect(() => {
    if (periodo.start && periodo.end) {
      const startDate = new Date(periodo.start + 'T00:00:00');
      const endDate = new Date(periodo.end + 'T00:00:00');
      let count = 0;
      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) count++;
        currentDate.setDate(currentDate.getDate() + 1);
      }
      setDiasUteisBase(Math.max(0, count - (parseInt(periodo.feriados) || 0)));
    } else {
      setDiasUteisBase(0);
    }
  }, [periodo]);

  const carregarColaboradoresBeneficios = () => {
    if (colaboradores.length === 0) return showAlert("Atenção", "Cadastre ou importe os colaboradores primeiro.");
    const lista = [...colaboradores].sort((a, b) => a.nome.localeCompare(b.nome));
    setBeneficiosData(lista);
    const novosOverrides = { ...beneficiosOverrides }; 
    lista.forEach(c => {
      if (!novosOverrides[c.matricula]) {
        novosOverrides[c.matricula] = { ausencias: 0, descontoVT: 0, descontoVR: 0, acrescimosVT: 0, acrescimosVR: 0, obs: '', valorVT: c.valorVT || '' };
      }
    });
    setBeneficiosOverrides(novosOverrides);
  };

  const updateOverride = (matricula, field, value) => {
    setBeneficiosOverrides(prev => ({
      ...prev,
      [matricula]: {
        ...(prev[matricula] || { ausencias: 0, descontoVT: 0, descontoVR: 0, acrescimosVT: 0, acrescimosVR: 0, obs: '', valorVT: '' }),
        [field]: value
      }
    }));
  };

  const calcBeneficios = () => {
    const vrDiarioNumGlobal = parseFloat(valorVRDiario) || 0;
    return beneficiosData.map(colab => {
      const overrides = beneficiosOverrides[colab.matricula] || {};
      const ausencias = parseInt(overrides.ausencias) || 0;
      const dVT = Math.max(0, diasUteisBase - ausencias - (parseInt(overrides.descontoVT)||0) + (parseInt(overrides.acrescimosVT)||0));
      const dVR = Math.max(0, diasUteisBase - ausencias - (parseInt(overrides.descontoVR)||0) + (parseInt(overrides.acrescimosVR)||0));
      const totalVT = dVT * (parseFloat(overrides.valorVT) || 0);
      const totalVRLiquido = (dVR * vrDiarioNumGlobal) * 0.91;
      return { ...colab, totalVT, totalVRLiquido, totalGeral: totalVT + totalVRLiquido, ausencias, obs: overrides.obs || '' };
    });
  };

  // Funções de exportação PDF originais
  const exportBeneficiosBasePDF = () => {
    if (beneficiosData.length === 0 || !window.jspdf || !window.jspdf.jsPDF.API.autoTable) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape'); 
    const data = calcBeneficios();
    const tableRows = data.map(item => [
      item.matricula, item.nome.substring(0, 22), formatMoney(item.valorVT), 
      item.ausencias || '-', '-', '-', '-', '-',
      formatMoney(item.totalVT), formatMoney(item.totalVRLiquido), formatMoney(item.totalGeral), item.obs || ''
    ]);
    doc.text("RELATÓRIO BASE - VALE TRANSPORTE E REFEIÇÃO", 14, 20);
    doc.autoTable({
      startY: 40,
      head: [['Matrícula', 'Colaborador', 'VT Diário', 'Faltas', 'Desc. VT', 'Desc. VR', 'Acrés. VT', 'Acrés. VR', 'Total VT', 'Total VR', 'Total Geral', 'Obs']],
      body: tableRows,
      theme: 'striped'
    });
    doc.save(`Relatorio_Beneficios_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // ---------- ABA 4: ERP (Original) ----------
  const getERPData = () => {
    const erp = {};
    salarioData.forEach(item => {
      const cc = item.centroCusto || 'GERAL';
      if (!erp[cc]) erp[cc] = { salario: 0, vt: 0, vr: 0, vidas: new Set() };
      erp[cc].salario += item.valor; erp[cc].vidas.add(item.matricula);
    });
    calcBeneficios().forEach(item => {
      if (item.totalGeral > 0) {
        const cc = item.centroCusto || 'GERAL';
        if (!erp[cc]) erp[cc] = { salario: 0, vt: 0, vr: 0, vidas: new Set() };
        erp[cc].vt += item.totalVT; erp[cc].vr += item.totalVRLiquido; erp[cc].vidas.add(item.matricula);
      }
    });
    return Object.keys(erp).map(cc => ({
      centroCusto: cc, salario: erp[cc].salario, vt: erp[cc].vt, vr: erp[cc].vr, total: erp[cc].salario + erp[cc].vt + erp[cc].vr, vidas: erp[cc].vidas.size
    })).sort((a, b) => a.centroCusto.localeCompare(b.centroCusto));
  };

  const salvarFechamento = async () => {
    const resumo = getERPData();
    if (resumo.length === 0) return showAlert("Atenção", "Não há dados para salvar.");
    const total = resumo.reduce((acc, curr) => acc + curr.total, 0);
    const novoRegistro = {
      dataHora: new Date().toLocaleString('pt-BR'),
      tipo: paymentType === '1' ? 'Folha Mensal' : 'Adiantamento',
      valorTotal: total,
      timestamp: Date.now()
    };
    try {
      await addDoc(collection(db, "historico_dp"), novoRegistro);
      const snap = await getDocs(query(collection(db, "historico_dp"), orderBy("timestamp", "desc")));
      setHistorico(snap.docs.map(d => ({ ...d.data(), id: d.id })));
      showAlert("Sucesso", "Fechamento salvo na nuvem!");
    } catch (e) {
      showAlert("Erro", "Erro ao salvar fechamento.");
    }
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

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans pb-20 relative text-gray-900">
      {modalConfig.isOpen && (
        <div className="fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border border-gray-100">
            <h3 className="text-lg font-bold mb-2">{modalConfig.title}</h3>
            <p className="text-gray-600 mb-6 text-sm">{modalConfig.message}</p>
            <div className="flex justify-end space-x-3">
              {modalConfig.type === 'confirm' && <button onClick={closeModal} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Cancelar</button>}
              <button onClick={() => { if (modalConfig.onConfirm) modalConfig.onConfirm(); closeModal(); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">OK</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 flex items-center space-x-4 border-b bg-gradient-to-r from-blue-50 to-white">
            <div className="bg-blue-600 p-3 rounded-lg text-white shadow-md"><FileSpreadsheet className="w-8 h-8" /></div>
            <div>
              <h1 className="text-2xl font-bold">Sistema Integrado de DP Cloud</h1>
              <p className="text-sm text-gray-600">Sincronização em Tempo Real</p>
            </div>
          </div>
          <div className="flex flex-wrap border-b border-gray-200">
            {['colaboradores', 'salario', 'beneficios', 'erp', 'historico'].map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-4 text-xs font-bold uppercase transition ${activeTab === t ? 'text-blue-700 bg-blue-50 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>
                {t.replace('salario', 'Salário').replace('beneficios', 'VT/VR')}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'colaboradores' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border flex justify-between items-center">
              <div><h2 className="text-lg font-semibold">Base de Colaboradores na Nuvem</h2><p className="text-xs text-gray-400">Total: {colaboradores.length}</p></div>
              <div className="flex space-x-2">
                <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputCadastro} onChange={handleImportColaboradores} />
                <button onClick={() => fileInputCadastro.current.click()} className="flex items-center space-x-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"><Upload className="w-5 h-5" /> <span>Importar XLSX</span></button>
                <button onClick={() => setShowAddForm(!showAddForm)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-blue-700">+ Novo</button>
              </div>
            </div>
            {showAddForm && (
              <form onSubmit={handleSaveColaborador} className="bg-blue-50 p-6 rounded-xl grid grid-cols-4 gap-4 border border-blue-100 shadow-inner">
                <input required placeholder="Matrícula *" value={formData.matricula} onChange={e => setFormData({...formData, matricula: e.target.value})} className="border p-2 rounded" />
                <input required placeholder="Nome *" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} className="border p-2 rounded col-span-2" />
                <CurrencyInput placeholder="VT Diário" value={formData.valorVT} onChange={v => setFormData({...formData, valorVT: v})} className="border p-2 rounded" />
                <button type="submit" className="bg-green-600 text-white font-bold rounded py-2">Salvar na Nuvem</button>
              </form>
            )}
            <div className="bg-white rounded-xl border overflow-hidden">
               <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 uppercase text-xs font-bold"><tr><th className="p-4">Matrícula</th><th className="p-4">Nome</th><th className="p-4 text-center">Ações</th></tr></thead>
                  <tbody>
                    {colaboradores.map(c => (
                      <tr key={c.matricula} className="border-b hover:bg-gray-50"><td className="p-4 font-mono">{c.matricula}</td><td className="p-4 font-bold">{c.nome}</td><td className="p-4 text-center"><button onClick={() => removerColaborador(c.matricula)} className="text-red-500"><Trash2 className="w-4 h-4 mx-auto" /></button></td></tr>
                    ))}
                  </tbody>
               </table>
            </div>
          </div>
        )}

        {activeTab === 'erp' && (
          <div className="bg-white p-8 rounded-xl border text-center relative animate-fade-in">
             <button onClick={salvarFechamento} className="absolute top-8 right-8 bg-green-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg hover:bg-green-700"><Save size={18}/> SALVAR FECHAMENTO</button>
             <PieChart className="w-12 h-12 text-blue-600 mx-auto mb-4" />
             <h2 className="text-2xl font-bold">Resumo por Centro de Custo</h2>
             <div className="grid grid-cols-4 gap-4 mt-8">
                {getERPData().map(r => (
                  <div key={r.centroCusto} className="border rounded-xl p-4 bg-gray-50 text-left border-l-4 border-l-blue-600">
                    <p className="text-xs font-bold uppercase text-gray-400">{r.centroCusto}</p>
                    <p className="text-xl font-black text-gray-800">R$ {formatMoney(r.total)}</p>
                    <p className="text-[10px] text-blue-500 mt-1">{r.vidas} colaboradores</p>
                  </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'historico' && (
          <div className="bg-white p-6 rounded-xl border animate-fade-in">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800"><Clock className="text-blue-600"/> Histórico de Fechamentos (Nuvem)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 uppercase text-[10px] font-bold"><tr><th className="p-4">Data/Hora</th><th className="p-4">Tipo</th><th className="p-4 text-right">Valor Total</th></tr></thead>
                <tbody>
                  {historico.map(h => (
                    <tr key={h.id} className="border-b"><td className="p-4 font-mono text-gray-500">{h.dataHora}</td><td className="p-4 font-bold">{h.tipo}</td><td className="p-4 text-right font-black text-green-700">R$ {formatMoney(h.valorTotal)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}