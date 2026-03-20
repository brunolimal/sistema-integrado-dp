import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, AlertTriangle, FileSpreadsheet, CheckCircle, ArrowRight, FileText, CalendarDays, Calculator, Bus, Coffee, Users, PieChart, Plus, Trash2, Edit2, Zap } from 'lucide-react';

export default function App() {
  // Abas
  const [activeTab, setActiveTab] = useState('colaboradores'); // 'colaboradores' | 'salario' | 'beneficios' | 'erp'

  // Banco de Dados Local de Colaboradores
  const [colaboradores, setColaboradores] = useState(() => {
    const saved = localStorage.getItem('dp_colaboradores');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('dp_colaboradores', JSON.stringify(colaboradores));
  }, [colaboradores]);

  // Estados Colaboradores (Formulário)
  const fileInputCadastro = useRef(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ matricula: '', nome: '', cpf: '', banco: '', agencia: '', conta: '', valorVT: '', centroCusto: 'ADMINISTRATIVO' });

  // Estados Aba Salário
  const [espelhoFile, setEspelhoFile] = useState(null);
  const [salarioData, setSalarioData] = useState([]); 
  const [errorsSalario, setErrorsSalario] = useState([]);
  const [isProcessingSalario, setIsProcessingSalario] = useState(false);
  const [paymentType, setPaymentType] = useState('1');

  // Estados Aba Benefícios (VT/VR)
  const [periodo, setPeriodo] = useState({ start: '', end: '', feriados: 0 });
  const [diasUteisBase, setDiasUteisBase] = useState(0);
  const [valorVRDiario, setValorVRDiario] = useState('');
  const [beneficiosData, setBeneficiosData] = useState([]); 
  const [beneficiosOverrides, setBeneficiosOverrides] = useState({});
  const [valorVTParaTodos, setValorVTParaTodos] = useState(''); // NOVO: Valor para aplicar em massa

  // Bibliotecas
  const [isReady, setIsReady] = useState(false);
  const fileInputEspelho = useRef(null);

  // Estado para controle de Modais
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'alert', onConfirm: null });

  const showAlert = (title, message) => setModalConfig({ isOpen: true, title, message, type: 'alert', onConfirm: null });
  const showConfirm = (title, message, onConfirm) => setModalConfig({ isOpen: true, title, message, type: 'confirm', onConfirm });
  const closeModal = () => setModalConfig({ ...modalConfig, isOpen: false });

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

  // ---------- FUNÇÕES COMPARTILHADAS ----------
  const normalizeKey = (key) => {
    if (!key) return '';
    return String(key).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  };

  const normalizeText = (text) => {
    if (!text) return '';
    return String(text).trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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

  const formatMoney = (val) => {
    const number = Number(val) || 0;
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number);
  };

  // ---------- ABA 1: COLABORADORES ----------
  const handleSaveColaborador = (e) => {
    e.preventDefault();
    if(!formData.matricula || !formData.nome) return showAlert("Atenção", "Matrícula e Nome são obrigatórios.");
    const matSegura = String(formData.matricula).trim().replace(/^0+/, '') || '0';
    setColaboradores(prev => {
      const idx = prev.findIndex(c => c.matricula === matSegura);
      const novo = { ...formData, matricula: matSegura };
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = novo;
        return updated;
      }
      return [...prev, novo];
    });
    setFormData({ matricula: '', nome: '', cpf: '', banco: '', agencia: '', conta: '', valorVT: '', centroCusto: 'ADMINISTRATIVO' });
    setShowAddForm(false);
  };

  const removerColaborador = (mat) => {
    showConfirm("Excluir Colaborador", "Deseja realmente remover este colaborador?", () => {
      setColaboradores(prev => prev.filter(c => c.matricula !== mat));
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
        setColaboradores(novos);
        showAlert("Sucesso", `${novos.length} colaboradores importados!`);
      }
    } catch (error) { showAlert("Erro", "Erro ao ler a planilha."); }
    if(fileInputCadastro.current) fileInputCadastro.current.value = '';
  };

  // ---------- ABA 2: SALÁRIO ----------
  const processarSalario = async () => {
    if (colaboradores.length === 0) return showAlert("Atenção", "Cadastre colaboradores primeiro.");
    if (!espelhoFile) return showAlert("Atenção", "Faça o upload do PDF.");
    setIsProcessingSalario(true);
    try {
      const espelhoBuffer = await espelhoFile.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({data: new Uint8Array(espelhoBuffer)}).promise;
      const pdfLines = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const items = textContent.items;
        items.sort((a, b) => Math.abs(b.transform[5] - a.transform[5]) > 5 ? b.transform[5] - a.transform[5] : a.transform[4] - b.transform[4]);
        let currentLine = []; let currentY = items.length > 0 ? items[0].transform[5] : 0;
        items.forEach(item => {
          if (Math.abs(item.transform[5] - currentY) > 5) {
            if (currentLine.length > 0) pdfLines.push(currentLine.join(" "));
            currentLine = [item.str.trim()]; currentY = item.transform[5];
          } else { currentLine.push(item.str.trim()); }
        });
        if (currentLine.length > 0) pdfLines.push(currentLine.join(" "));
      }
      const result = []; const matriculasEncontradas = new Set();
      pdfLines.forEach((line) => {
        const lineNormalized = normalizeText(line);
        for (const colab of colaboradores) {
          const regexMat = new RegExp(`\\b0*${colab.matricula}\\b`);
          const primeiroNome = normalizeText(colab.nome).split(' ')[0] || '';
          if (regexMat.test(line) && lineNormalized.includes(primeiroNome)) {
            const valueMatches = line.match(/(?:\d{1,3}(?:\.\d{3})*|\d+),\d{2}/g);
            if (valueMatches && !matriculasEncontradas.has(colab.matricula)) {
              const valor = parseFloat(valueMatches[valueMatches.length - 1].replace(/\./g, '').replace(',', '.'));
              if (valor > 0) {
                matriculasEncontradas.add(colab.matricula);
                let c = colab.conta; let d = "";
                if (c.includes('-')) { const p = c.split('-'); d = p.pop(); c = p.join('-'); }
                result.push({ agencia: colab.agencia, conta: c, digito: d, nome: colab.nome, cpf: colab.cpf, bancoCode: getBankCode(colab.banco), valor: valor, centroCusto: colab.centroCusto || 'GERAL', matricula: colab.matricula });
              }
            }
          }
        }
      });
      setSalarioData(result);
    } catch (e) { setErrorsSalario(["Erro no processamento."]); } finally { setIsProcessingSalario(false); }
  };

  const exportarArquivoBancoSalario = () => {
    const bankData = salarioData.map(row => [row.agencia, row.conta, row.digito, row.nome, row.cpf, paymentType, row.valor]);
    const ws = window.XLSX.utils.aoa_to_sheet(bankData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Pagamentos");
    window.XLSX.writeFile(wb, `Remessa_Salario_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ---------- ABA 3: BENEFÍCIOS (LÓGICA + MELHORIA VT) ----------
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

  const carregarColaboradoresBeneficios = () => {
    if (colaboradores.length === 0) return showAlert("Atenção", "Cadastre colaboradores primeiro.");
    const lista = [...colaboradores].sort((a, b) => a.nome.localeCompare(b.nome));
    setBeneficiosData(lista);
    const novosOverrides = {};
    lista.forEach(c => {
      novosOverrides[c.matricula] = { ausencias: 0, descontoVT: 0, descontoVR: 0, acrescimosVT: 0, acrescimosVR: 0, obs: '', valorVT: c.valorVT || '' };
    });
    setBeneficiosOverrides(novosOverrides);
  };

  // NOVO: Função para aplicar valor de VT em massa
  const aplicarVTParaTodos = () => {
    if (!valorVTParaTodos) return showAlert("Atenção", "Digite um valor para aplicar.");
    const novosOverrides = { ...beneficiosOverrides };
    beneficiosData.forEach(c => {
      novosOverrides[c.matricula] = { ...novosOverrides[c.matricula], valorVT: valorVTParaTodos };
    });
    setBeneficiosOverrides(novosOverrides);
    showAlert("Sucesso", `Valor de R$ ${valorVTParaTodos} aplicado para todos os colaboradores da lista.`);
  };

  const updateOverride = (matricula, field, value) => {
    setBeneficiosOverrides(prev => ({ ...prev, [matricula]: { ...(prev[matricula] || {}), [field]: value } }));
  };

  const calcBeneficios = () => {
    const vrD = parseFloat(valorVRDiario) || 0;
    return beneficiosData.map(colab => {
      const o = beneficiosOverrides[colab.matricula] || {};
      const dVT = Math.max(0, diasUteisBase - (parseInt(o.ausencias)||0) - (parseInt(o.descontoVT)||0) + (parseInt(o.acrescimosVT)||0));
      const dVR = Math.max(0, diasUteisBase - (parseInt(o.ausencias)||0) - (parseInt(o.descontoVR)||0) + (parseInt(o.acrescimosVR)||0));
      const tVT = dVT * (parseFloat(o.valorVT)||0);
      const tVR = ((dVR * vrD) * 0.91);
      return { ...colab, totalVT: tVT, totalVRLiquido: tVR, totalGeral: tVT + tVR, diasVT: dVT, diasVR: dVR, ausencias: o.ausencias, obs: o.obs };
    });
  };

  const exportBeneficiosBasePDF = () => {
    const { jsPDF } = window.jspdf; const doc = new jsPDF('landscape');
    const data = calcBeneficios();
    const rows = data.map(i => [i.matricula, i.nome, i.centroCusto, `VT:${i.diasVT}/VR:${i.diasVR}`, i.ausencias || 0, formatMoney(i.totalVT), formatMoney(i.totalVRLiquido), formatMoney(i.totalGeral)]);
    doc.autoTable({ head: [['Matr', 'Nome', 'Setor', 'Dias', 'Faltas', 'VT', 'VR', 'Total']], body: rows });
    doc.save("Relatorio_Beneficios.pdf");
  };

  const exportVTBankFile = () => {
    const data = calcBeneficios();
    const vtData = data.filter(i => i.totalVT > 0).map(i => [i.agencia, i.conta, '', i.nome, i.cpf, '3', i.totalVT]);
    const ws = window.XLSX.utils.aoa_to_sheet(vtData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Itaú VT");
    window.XLSX.writeFile(wb, "Arquivo_Banco_VT.xlsx");
  };

  const generateReceiptsPDF = () => {
    const { jsPDF } = window.jspdf; const doc = new jsPDF();
    calcBeneficios().forEach((item, idx) => {
      if (idx > 0) doc.addPage();
      doc.setFontSize(16); doc.text("RECIBO DE BENEFÍCIOS", 105, 20, {align:"center"});
      doc.setFontSize(10); doc.text(`Colaborador: ${item.nome} | Matrícula: ${item.matricula}`, 20, 40);
      doc.text(`Total VT: R$ ${formatMoney(item.totalVT)} | Total VR: R$ ${formatMoney(item.totalVRLiquido)}`, 20, 50);
      doc.setFontSize(14); doc.text(`TOTAL: R$ ${formatMoney(item.totalGeral)}`, 20, 70);
      doc.line(40, 120, 170, 120); doc.text(item.nome, 105, 127, {align:"center"});
    });
    doc.save("Recibos.pdf");
  };

  // Dashboard ERP
  const getERPData = () => {
    const erp = {};
    salarioData.forEach(i => {
      if (!erp[i.centroCusto]) erp[i.centroCusto] = { s: 0, vt: 0, vr: 0, v: new Set() };
      erp[i.centroCusto].s += i.valor; erp[i.centroCusto].v.add(i.matricula);
    });
    calcBeneficios().forEach(i => {
      if (!erp[i.centroCusto]) erp[i.centroCusto] = { s: 0, vt: 0, vr: 0, v: new Set() };
      erp[i.centroCusto].vt += i.totalVT; erp[i.centroCusto].vr += i.totalVRLiquido; erp[i.centroCusto].v.add(i.matricula);
    });
    return Object.keys(erp).map(cc => ({ cc, s: erp[cc].s, vt: erp[cc].vt, vr: erp[cc].vr, t: erp[cc].s+erp[cc].vt+erp[cc].vr, v: erp[cc].v.size }));
  };

  const erpResumo = getERPData();

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans pb-20 relative text-gray-900">
      {modalConfig.isOpen && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 flex items-center justify-center p-4">
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
        {/* Nav Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 flex items-center justify-between border-b bg-gradient-to-r from-blue-50 to-white">
            <div className="flex items-center space-x-4">
              <div className="bg-blue-600 p-3 rounded-lg text-white"><FileSpreadsheet className="w-8 h-8" /></div>
              <div><h1 className="text-2xl font-bold">Sistema Integrado de DP</h1><p className="text-sm text-gray-500">Mais Escoramentos</p></div>
            </div>
          </div>
          <div className="flex flex-wrap border-b">
            {['colaboradores', 'salario', 'beneficios', 'erp'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-4 text-sm font-bold uppercase transition-colors ${activeTab === tab ? 'text-blue-700 bg-blue-50 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>
                {tab.replace('salario', 'Salário').replace('beneficios', 'VT / VR')}
              </button>
            ))}
          </div>
        </div>

        {/* CONTENT TABS */}
        {activeTab === 'colaboradores' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 bg-white p-6 rounded-xl shadow-sm border flex items-center justify-between">
                <div><h2 className="text-lg font-semibold">Importar Planilha</h2><p className="text-xs text-gray-500">Colunas: Matrícula, Nome, CPF, Banco, Agência, Conta, Valor VT, Setor.</p></div>
                <div className="flex flex-col items-end gap-2">
                  <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputCadastro} onChange={handleImportColaboradores} />
                  <button onClick={() => fileInputCadastro.current.click()} className="flex items-center space-x-2 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100"><Upload size={18}/><span>XLSX</span></button>
                  <button onClick={downloadTemplate} className="text-[10px] text-blue-600 underline">Baixar Modelo</button>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border flex items-center"><button onClick={() => setShowAddForm(!showAddForm)} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold">+ Cadastro Manual</button></div>
            </div>
            {showAddForm && (
              <form onSubmit={handleSaveColaborador} className="bg-blue-50 p-6 rounded-xl grid grid-cols-1 md:grid-cols-4 gap-4">
                <input required placeholder="Matrícula" value={formData.matricula} onChange={e => setFormData({...formData, matricula: e.target.value})} className="border p-2 rounded" />
                <input required placeholder="Nome" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} className="border p-2 rounded col-span-2" />
                <input placeholder="CPF" value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} className="border p-2 rounded" />
                <input placeholder="Banco" value={formData.banco} onChange={e => setFormData({...formData, banco: e.target.value})} className="border p-2 rounded" />
                <input placeholder="Agência" value={formData.agencia} onChange={e => setFormData({...formData, agencia: e.target.value})} className="border p-2 rounded" />
                <input placeholder="Conta (ex: 123-4)" value={formData.conta} onChange={e => setFormData({...formData, conta: e.target.value})} className="border p-2 rounded" />
                <input type="number" step="0.01" placeholder="VT Diário (R$)" value={formData.valorVT} onChange={e => setFormData({...formData, valorVT: e.target.value})} className="border p-2 rounded" />
                <button type="submit" className="bg-green-600 text-white font-bold rounded py-2 hover:bg-green-700">Salvar Colaborador</button>
              </form>
            )}
            <div className="bg-white p-6 rounded-xl shadow-sm border overflow-x-auto">
              <h3 className="font-bold mb-4">Base de Dados ({colaboradores.length} colaboradores)</h3>
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50"><tr><th className="p-3">Matr.</th><th className="p-3">Nome</th><th className="p-3">VT Padrão</th><th className="p-3">Ação</th></tr></thead>
                <tbody>{colaboradores.map(c => (<tr key={c.matricula} className="border-b"><td className="p-3">{c.matricula}</td><td className="p-3">{c.nome}</td><td className="p-3">R$ {formatMoney(c.valorVT)}</td><td className="p-3 text-red-500 cursor-pointer" onClick={() => removerColaborador(c.matricula)}><Trash2 size={16}/></td></tr>))}</tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'salario' && (
          <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
            <div className="bg-white p-10 rounded-xl shadow-sm border text-center">
              <FileText className="w-12 h-12 text-blue-600 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Processar Remessa de Salário</h2>
              <input type="file" accept=".pdf" className="hidden" ref={fileInputEspelho} onChange={(e) => setEspelhoFile(e.target.files[0])} />
              <button onClick={() => fileInputEspelho.current.click()} className="px-6 py-2 border rounded-lg mb-4">{espelhoFile ? espelhoFile.name : 'Selecionar PDF de Salário'}</button>
              <div className="flex justify-center space-x-4 mb-6">
                <label className="flex items-center space-x-2"><input type="radio" checked={paymentType === '1'} onChange={() => setPaymentType('1')} /><span>Salário</span></label>
                <label className="flex items-center space-x-2"><input type="radio" checked={paymentType === '9'} onChange={() => setPaymentType('9')} /><span>Adiantamento</span></label>
              </div>
              <button onClick={processarSalario} className="bg-blue-600 text-white px-10 py-3 rounded-lg font-bold shadow-lg">PROCESSAR E CRUZAR DADOS</button>
            </div>
            {salarioData.length > 0 && (
              <div className="bg-white p-6 rounded-xl shadow-sm border">
                <div className="flex justify-between items-center mb-4"><h3 className="font-bold">Prévia da Remessa</h3><button onClick={exportarArquivoBancoSalario} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"><Download size={16}/> XLSX ITAU</button></div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50"><tr><th className="p-2">Nome</th><th className="p-2">Matr.</th><th className="p-2 text-right">Valor</th></tr></thead>
                  <tbody>{salarioData.map((r,i)=>(<tr key={i} className="border-b"><td className="p-2">{r.nome}</td><td className="p-2">{r.matricula}</td><td className="p-2 text-right font-bold text-green-700">R$ {formatMoney(r.valor)}</td></tr>))}</tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'beneficios' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white p-6 rounded-xl shadow-sm border grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div><label className="text-xs font-bold text-gray-500 uppercase">Início</label><input type="date" value={periodo.start} onChange={e => setPeriodo({...periodo, start: e.target.value})} className="w-full border p-2 rounded"/></div>
              <div><label className="text-xs font-bold text-gray-500 uppercase">Fim</label><input type="date" value={periodo.end} onChange={e => setPeriodo({...periodo, end: e.target.value})} className="w-full border p-2 rounded"/></div>
              <div><label className="text-xs font-bold text-gray-500 uppercase">Feriados</label><input type="number" value={periodo.feriados} onChange={e => setPeriodo({...periodo, feriados: e.target.value})} className="w-full border p-2 rounded"/></div>
              <div><label className="text-xs font-bold text-gray-500 uppercase">VR Diário (R$)</label><input type="number" step="0.01" value={valorVRDiario} onChange={e => setValorVRDiario(e.target.value)} className="w-full border p-2 rounded bg-blue-50"/></div>
              <div className="bg-blue-600 text-white p-2 rounded text-center font-bold">{diasUteisBase} Dias Úteis</div>
            </div>

            {/* BARRA DE FERRAMENTAS - MELHORIA VT INSERIDA AQUI */}
            <div className="bg-white p-4 rounded-xl border flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3 bg-blue-50 p-2 rounded-lg border border-blue-100">
                <Zap className="text-blue-600 w-5 h-5" />
                <span className="text-sm font-bold text-blue-800">Lançamento em Massa VT:</span>
                <input 
                  type="number" 
                  step="0.01" 
                  placeholder="Ex: 10.50" 
                  value={valorVTParaTodos} 
                  onChange={e => setValorVTParaTodos(e.target.value)} 
                  className="w-24 border rounded p-1 text-sm font-bold"
                />
                <button 
                  onClick={aplicarVTParaTodos} 
                  className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-blue-700"
                >
                  Aplicar a Todos
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={carregarColaboradoresBeneficios} className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg font-bold">Gerar Lista</button>
                <button onClick={generateReceiptsPDF} className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold">PDF Recibos</button>
                <button onClick={exportVTBankFile} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold">XLSX VT ITAU</button>
              </div>
            </div>

            {beneficiosData.length > 0 && (() => {
              const res = calcBeneficios();
              return (
                <div className="bg-white p-6 rounded-xl shadow-sm border overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 uppercase text-[10px] font-bold">
                      <tr>
                        <th className="p-3">Colaborador</th><th className="p-3 text-center">VT Dia (R$)</th><th className="p-3 text-center">Faltas</th>
                        <th className="p-3 text-right">VT Tot.</th><th className="p-3 text-right">VR Tot.</th><th className="p-3 text-right">Geral</th>
                      </tr>
                    </thead>
                    <tbody>
                      {res.map(c => (
                        <tr key={c.matricula} className="border-b">
                          <td className="p-3"><p className="font-bold">{c.nome}</p><p className="text-[10px] text-gray-400">Matr: {c.matricula}</p></td>
                          <td className="p-3 text-center"><input type="number" step="0.01" value={beneficiosOverrides[c.matricula]?.valorVT || ''} onChange={e => updateOverride(c.matricula, 'valorVT', e.target.value)} className="w-16 border rounded p-1 text-center font-bold text-blue-600"/></td>
                          <td className="p-3 text-center"><input type="number" value={beneficiosOverrides[c.matricula]?.ausencias || ''} onChange={e => updateOverride(c.matricula, 'ausencias', e.target.value)} className="w-12 border rounded p-1 text-center"/></td>
                          <td className="p-3 text-right">R$ {formatMoney(c.totalVT)}</td><td className="p-3 text-right">R$ {formatMoney(c.totalVRLiquido)}</td>
                          <td className="p-3 text-right font-bold text-green-700 bg-green-50">R$ {formatMoney(c.totalGeral)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}

        {activeTab === 'erp' && (
          <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
            <div className="bg-white p-6 rounded-xl shadow-sm border text-center">
              <PieChart className="w-12 h-12 text-blue-600 mx-auto mb-2"/><h2 className="text-xl font-bold">Resumo por Centro de Custo</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {erpResumo.map(row => (
                <div key={row.cc} className="bg-white p-5 rounded-xl shadow-sm border border-l-4 border-l-blue-600">
                  <h3 className="font-black text-gray-800 uppercase text-sm mb-3">{row.cc}</h3>
                  <div className="space-y-1 text-xs">
                    <p className="flex justify-between"><span>Salários:</span><b>R$ {formatMoney(row.s)}</b></p>
                    <p className="flex justify-between"><span>Benefícios:</span><b>R$ {formatMoney(row.vt + row.vr)}</b></p>
                    <hr className="my-2"/>
                    <p className="flex justify-between text-base font-bold text-green-700"><span>TOTAL:</span><span>R$ {formatMoney(row.t)}</span></p>
                    <p className="text-[10px] text-gray-400 mt-2">{row.v} colaboradores processados</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}