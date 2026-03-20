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
  // Abas
  const [activeTab, setActiveTab] = useState('colaboradores');

  // ================= ESTADOS COM AUTO-SAVE (LOCAL STORAGE) =================
  const [colaboradores, setColaboradores] = useState(() => {
    const saved = localStorage.getItem('dp_colaboradores');
    return saved ? JSON.parse(saved) : [];
  });

  const [salarioData, setSalarioData] = useState(() => {
    const saved = localStorage.getItem('dp_salarioData');
    return saved ? JSON.parse(saved) : [];
  });
  const [paymentType, setPaymentType] = useState(() => localStorage.getItem('dp_paymentType') || '1');

  const [periodo, setPeriodo] = useState(() => {
    const saved = localStorage.getItem('dp_periodo');
    return saved ? JSON.parse(saved) : { start: '', end: '', feriados: 0 };
  });
  const [valorVRDiario, setValorVRDiario] = useState(() => localStorage.getItem('dp_valorVRDiario') || '');
  const [beneficiosData, setBeneficiosData] = useState(() => {
    const saved = localStorage.getItem('dp_beneficiosData');
    return saved ? JSON.parse(saved) : [];
  });
  const [beneficiosOverrides, setBeneficiosOverrides] = useState(() => {
    const saved = localStorage.getItem('dp_beneficiosOverrides');
    return saved ? JSON.parse(saved) : {};
  });

  const [historico, setHistorico] = useState(() => {
    const saved = localStorage.getItem('dp_historico');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => localStorage.setItem('dp_colaboradores', JSON.stringify(colaboradores)), [colaboradores]);
  useEffect(() => localStorage.setItem('dp_salarioData', JSON.stringify(salarioData)), [salarioData]);
  useEffect(() => localStorage.setItem('dp_paymentType', paymentType), [paymentType]);
  useEffect(() => localStorage.setItem('dp_periodo', JSON.stringify(periodo)), [periodo]);
  useEffect(() => localStorage.setItem('dp_valorVRDiario', valorVRDiario), [valorVRDiario]);
  useEffect(() => localStorage.setItem('dp_beneficiosData', JSON.stringify(beneficiosData)), [beneficiosData]);
  useEffect(() => localStorage.setItem('dp_beneficiosOverrides', JSON.stringify(beneficiosOverrides)), [beneficiosOverrides]);
  useEffect(() => localStorage.setItem('dp_historico', JSON.stringify(historico)), [historico]);

  // ================= OUTROS ESTADOS =================
  const fileInputCadastro = useRef(null);
  const fileInputEspelho = useRef(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ matricula: '', nome: '', cpf: '', banco: '', agencia: '', conta: '', valorVT: '', centroCusto: 'ADMINISTRATIVO' });
  const [espelhoFile, setEspelhoFile] = useState(null);
  const [errorsSalario, setErrorsSalario] = useState([]);
  const [isProcessingSalario, setIsProcessingSalario] = useState(false);
  const [diasUteisBase, setDiasUteisBase] = useState(0);
  const [isReady, setIsReady] = useState(false);

  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'alert', onConfirm: null });
  const showAlert = (title, message) => setModalConfig({ isOpen: true, title, message, type: 'alert', onConfirm: null });
  const showConfirm = (title, message, onConfirm) => setModalConfig({ isOpen: true, title, message, type: 'confirm', onConfirm });
  const closeModal = () => setModalConfig({ ...modalConfig, isOpen: false });

  // Funções Auxiliares
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

  // ---------- ABA 1: COLABORADORES ----------
  const handleSaveColaborador = (e) => {
    e.preventDefault();
    if(!formData.matricula || !formData.nome) return showAlert("Atenção", "Matrícula e Nome são obrigatórios.");
    
    const matSegura = String(formData.matricula).trim().replace(/^0+/, '') || '0';
    setColaboradores(prev => {
      const idx = prev.findIndex(c => c.matricula === matSegura);
      const novo = { ...formData, matricula: matSegura };
      if (idx >= 0) { const updated = [...prev]; updated[idx] = novo; return updated; }
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
        showAlert("Sucesso", `${novos.length} colaboradores importados com sucesso!`);
      } else {
        showAlert("Erro", "Nenhum colaborador encontrado.");
      }
    } catch (error) {
      console.error(error);
      showAlert("Erro", "Erro ao ler a planilha.");
    }
    if(fileInputCadastro.current) fileInputCadastro.current.value = '';
  };

  // ---------- ABA 2: SALÁRIO ----------
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
      console.error(error);
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
    const dataFormatada = new Date().toISOString().split('T')[0];
    window.XLSX.writeFile(wb, `${tipoNome} (${dataFormatada}).xlsx`);
  };

  // ---------- ABA 3: BENEFÍCIOS ----------
  useEffect(() => {
    if (periodo.start && periodo.end) {
      const startDate = new Date(periodo.start + 'T00:00:00');
      const endDate = new Date(periodo.end + 'T00:00:00');
      let count = 0;
      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
        currentDate.setDate(currentDate.getDate() + 1);
      }
      setDiasUteisBase(Math.max(0, count - (parseInt(periodo.feriados) || 0)));
    } else {
      setDiasUteisBase(0);
    }
  }, [periodo]);

  const carregarColaboradoresBeneficios = () => {
    if (colaboradores.length === 0) return showAlert("Atenção", "Cadastre ou importe os colaboradores na aba 'Colaboradores'.");
    
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

  const limparMesBeneficios = () => {
    showConfirm("Limpar Dados", "Tem certeza que deseja zerar todos os descontos, acréscimos e observações desta tabela? (Os valores fixos de VT não serão apagados)", () => {
      const novosOverrides = {};
      beneficiosData.forEach(c => {
        novosOverrides[c.matricula] = { ausencias: 0, descontoVT: 0, descontoVR: 0, acrescimosVT: 0, acrescimosVR: 0, obs: '', valorVT: c.valorVT || '' };
      });
      setBeneficiosOverrides(novosOverrides);
    });
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
      const descontoVT = parseInt(overrides.descontoVT) || 0;
      const descontoVR = parseInt(overrides.descontoVR) || 0;
      const acrescimosVT = parseInt(overrides.acrescimosVT) || 0;
      const acrescimosVR = parseInt(overrides.acrescimosVR) || 0;
      const valorVT = parseFloat(overrides.valorVT) || 0;
      
      const totalDiasVT = Math.max(0, diasUteisBase - ausencias - descontoVT + acrescimosVT);
      const totalDiasVR = Math.max(0, diasUteisBase - ausencias - descontoVR + acrescimosVR);
      
      const totalVT = totalDiasVT * valorVT;
      const totalVRBruto = totalDiasVR * vrDiarioNumGlobal;
      const descontoVRTaxa = totalVRBruto * 0.09;
      const totalVRLiquido = totalVRBruto - descontoVRTaxa;
      const totalGeral = totalVT + totalVRLiquido;

      return {
        ...colab, diasVT: totalDiasVT, diasVR: totalDiasVR, totalVT, totalVRLiquido, totalGeral,
        ausencias, descontoVT, descontoVR, acrescimosVT, acrescimosVR, valorVT, obs: overrides.obs || ''
      };
    });
  };

  const exportBeneficiosBasePDF = () => {
    if (beneficiosData.length === 0 || !window.jspdf || !window.jspdf.jsPDF.API.autoTable) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape'); 
    const data = calcBeneficios();
    let somaVT = 0, somaVR = 0, somaGeral = 0;

    const tableRows = data.map(item => {
      somaVT += item.totalVT; somaVR += item.totalVRLiquido; somaGeral += item.totalGeral;
      
      return [
        item.matricula, 
        item.nome.substring(0, 22), // Limitando o tamanho do nome para caber na folha
        formatMoney(item.valorVT),
        item.ausencias > 0 ? `-${item.ausencias}` : '-', 
        item.descontoVT > 0 ? `-${item.descontoVT}` : '-',
        item.descontoVR > 0 ? `-${item.descontoVR}` : '-',
        item.acrescimosVT > 0 ? `+${item.acrescimosVT}` : '-',
        item.acrescimosVR > 0 ? `+${item.acrescimosVR}` : '-',
        formatMoney(item.totalVT), 
        formatMoney(item.totalVRLiquido), 
        formatMoney(item.totalGeral),
        item.obs || ''
      ];
    });

    doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.text("RELATÓRIO BASE - VALE TRANSPORTE E REFEIÇÃO", 14, 20);
    
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    const periodoStr = `${periodo.start ? periodo.start.split('-').reverse().join('/') : ''} a ${periodo.end ? periodo.end.split('-').reverse().join('/') : ''}`;
    doc.text(`Período: ${periodoStr} | Dias Úteis Base: ${diasUteisBase}`, 14, 28);
    doc.text(`Valor Padrão VR Diário: R$ ${formatMoney(parseFloat(valorVRDiario) || 0)} (-9% CCT aplicado na folha)`, 14, 34);

    doc.autoTable({
      startY: 40,
      head: [['Matrícula', 'Colaborador', 'VT Diário', 'Faltas', 'Desc. VT', 'Desc. VR', 'Acrés. VT', 'Acrés. VR', 'Total VT', 'Total VR (R$)', 'Total Geral', 'Obs']],
      body: tableRows,
      theme: 'striped', showFoot: 'lastPage',
      headStyles: { fillColor: [30, 64, 175] }, styles: { fontSize: 7, cellPadding: 2 },
      columnStyles: { 8: {halign: 'right'}, 9: {halign: 'right'}, 10: {halign: 'right', fontStyle: 'bold'} },
      foot: [['', '', '', '', '', '', '', 'TOTAIS', formatMoney(somaVT), formatMoney(somaVR), formatMoney(somaGeral), '']],
      footStyles: { fillColor: [240, 253, 244], textColor: [21, 128, 61], fontStyle: 'bold' }
    });

    doc.save(`Relatorio_Base_VTVR_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportVTBankFile = () => {
    const data = calcBeneficios();
    const vtData = [];
    
    data.forEach(item => {
      if (item.totalVT > 0) {
        let conta = item.conta; let digito = "";
        if (conta.includes('-')) { const parts = conta.split('-'); digito = parts.pop(); conta = parts.join('-'); }
        vtData.push([item.agencia || '', conta || '', digito || '', item.nome, item.cpf || '', '3', item.totalVT]);
      }
    });

    if (vtData.length === 0) return showAlert("Atenção", "Não há valores de VT a serem pagos.");
    const ws = window.XLSX.utils.aoa_to_sheet(vtData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Pagamentos VT");
    window.XLSX.writeFile(wb, `Arquivo_Itau_VT_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const generateReceiptsPDF = () => {
    if (beneficiosData.length === 0 || !window.jspdf) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const startStr = periodo.start ? periodo.start.split('-').reverse().join('/') : '';
    const endStr = periodo.end ? periodo.end.split('-').reverse().join('/') : '';
    const data = calcBeneficios();
    let pageAdded = false;

    data.forEach((item) => {
      if (item.totalGeral <= 0 && item.ausencias === 0 && item.acrescimosVT === 0 && item.acrescimosVR === 0) return;
      if (pageAdded) doc.addPage();
      pageAdded = true;

      doc.setFont("helvetica", "bold"); doc.setFontSize(16);
      doc.text("RECIBO INDIVIDUAL DE BENEFÍCIOS", 105, 20, { align: "center" });

      doc.setFontSize(11); doc.setFont("helvetica", "normal");
      doc.text(`Colaborador: ${item.nome}`, 20, 35);
      doc.text(`Matrícula: ${item.matricula}   |   Centro de Custo: ${item.centroCusto}`, 20, 42);
      doc.text(`Período de Apuração: ${startStr} até ${endStr}`, 20, 49);
      doc.text(`Dias Úteis Base no Período: ${diasUteisBase} dias`, 20, 56);

      doc.setFont("helvetica", "bold"); doc.setFontSize(12);
      doc.text("Resumo de Valores Apurados:", 20, 75);

      doc.setFont("helvetica", "normal"); doc.setFontSize(11);
      doc.text(`Valor Total de VT: R$ ${formatMoney(item.totalVT)}`, 20, 85);
      doc.text(`Valor Total de VR: R$ ${formatMoney(item.totalVRLiquido)}`, 20, 93);

      doc.setFontSize(14); doc.setFont("helvetica", "bold");
      doc.text(`TOTAL GERAL A RECEBER: R$ ${formatMoney(item.totalGeral)}`, 20, 115);

      doc.setFontSize(10); doc.setFont("helvetica", "normal");
      doc.text(`Observações: ${item.obs}`, 20, 135);

      doc.setDrawColor(0, 0, 0); doc.line(40, 180, 170, 180);
      doc.text(item.nome, 105, 187, { align: "center" });
      doc.setFontSize(8); doc.text("Assinatura do Colaborador", 105, 192, { align: "center" });
    });

    if (!pageAdded) return showAlert("Atenção", "Nenhum recibo para gerar. Verifique os valores.");
    doc.save(`Recibos_Beneficios_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // ---------- ABA 4: DASHBOARD ERP & FECHAMENTO HISTÓRICO ----------
  const getERPData = () => {
    const erp = {};
    salarioData.forEach(item => {
      const cc = item.centroCusto || 'GERAL';
      if (!erp[cc]) erp[cc] = { salario: 0, vt: 0, vr: 0, headCount: new Set() };
      erp[cc].salario += item.valor;
      erp[cc].headCount.add(item.matricula);
    });
    const benData = activeTab === 'erp' || activeTab === 'beneficios' ? calcBeneficios() : [];
    benData.forEach(item => {
      if (item.totalGeral > 0) {
        const cc = item.centroCusto || 'GERAL';
        if (!erp[cc]) erp[cc] = { salario: 0, vt: 0, vr: 0, headCount: new Set() };
        erp[cc].vt += item.totalVT;
        erp[cc].vr += item.totalVRLiquido;
        erp[cc].headCount.add(item.matricula);
      }
    });
    return Object.keys(erp).map(cc => ({
      centroCusto: cc, salario: erp[cc].salario, vt: erp[cc].vt, vr: erp[cc].vr, total: erp[cc].salario + erp[cc].vt + erp[cc].vr, vidas: erp[cc].headCount.size
    })).sort((a, b) => a.centroCusto.localeCompare(b.centroCusto));
  };
  const erpResumo = getERPData();

  const exportERPPDF = () => {
    if (erpResumo.length === 0 || !window.jspdf || !window.jspdf.jsPDF.API.autoTable) {
      return showAlert("Atenção", "Não há dados calculados para imprimir.");
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('portrait');

    doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.text("RESUMO GERENCIAL POR CENTRO DE CUSTO", 14, 20);

    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    const periodoStr = `${periodo.start ? periodo.start.split('-').reverse().join('/') : ''} a ${periodo.end ? periodo.end.split('-').reverse().join('/') : ''}`;
    doc.text(`Período de Referência (Benefícios): ${periodoStr}`, 14, 28);
    doc.text(`Data de Emissão: ${new Date().toLocaleString('pt-BR')}`, 14, 34);

    const tableRows = erpResumo.map(row => [
      row.centroCusto,
      row.vidas,
      formatMoney(row.salario),
      formatMoney(row.vt),
      formatMoney(row.vr),
      formatMoney(row.total)
    ]);

    const totalSalarioERP = erpResumo.reduce((acc, curr) => acc + curr.salario, 0);
    const totalVtERP = erpResumo.reduce((acc, curr) => acc + curr.vt, 0);
    const totalVrERP = erpResumo.reduce((acc, curr) => acc + curr.vr, 0);
    const totalGeralERP = erpResumo.reduce((acc, curr) => acc + curr.total, 0);
    const totalVidasERP = erpResumo.reduce((acc, curr) => acc + curr.vidas, 0);

    doc.autoTable({
      startY: 40,
      head: [['Centro de Custo', 'Quantidade de\nColaboradores', 'Salário / Adiant.\n(R$)', 'Vale Transporte\n(R$)', 'Vale Refeição\n(R$)', 'Custo Total\n(R$)']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [30, 64, 175], halign: 'center' },
      styles: { fontSize: 8, cellPadding: 3, valign: 'middle' },
      columnStyles: { 1: {halign: 'center'}, 2: {halign: 'right'}, 3: {halign: 'right'}, 4: {halign: 'right'}, 5: {halign: 'right', fontStyle: 'bold'} },
      foot: [['TOTAIS GERAIS', totalVidasERP, formatMoney(totalSalarioERP), formatMoney(totalVtERP), formatMoney(totalVrERP), formatMoney(totalGeralERP)]],
      footStyles: { fillColor: [240, 253, 244], textColor: [21, 128, 61], fontStyle: 'bold', halign: 'right' }
    });

    doc.save(`Resumo_ERP_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const salvarFechamento = () => {
    if (erpResumo.length === 0) {
      return showAlert("Atenção", "Não há dados calculados para salvar no histórico.");
    }
    const totalGeralERP = erpResumo.reduce((acc, curr) => acc + curr.total, 0);

    const snapshot = {
      colaboradores: [...colaboradores],
      salarioData: [...salarioData],
      paymentType,
      periodo: { ...periodo },
      valorVRDiario,
      beneficiosData: [...beneficiosData],
      beneficiosOverrides: JSON.parse(JSON.stringify(beneficiosOverrides))
    };

    const periodoStr = periodo.start && periodo.end
      ? `${periodo.start.split('-').reverse().join('/')} a ${periodo.end.split('-').reverse().join('/')}`
      : 'Sem período definido';

    const novoRegistro = {
      id: Date.now(),
      dataHora: new Date().toLocaleString('pt-BR'),
      tipo: 'Fechamento Consolidado de Folha',
      detalhes: `Período: ${periodoStr} | Vidas Impactadas: ${colaboradores.length}`,
      valorTotal: totalGeralERP,
      snapshot
    };

    setHistorico(prev => [novoRegistro, ...prev]);
    showAlert("Sucesso", "Fechamento salvo no histórico! Você pode acessá-lo futuramente na aba 'Histórico'.");
  };

  const restaurarHistorico = (registro) => {
    showConfirm(
      "Restaurar Fechamento",
      `Isso irá substituir todos os dados atuais (Colaboradores, Salários e Benefícios) pelos dados do dia ${registro.dataHora}. Deseja continuar?`,
      () => {
        const snap = registro.snapshot;
        setColaboradores(snap.colaboradores || []);
        setSalarioData(snap.salarioData || []);
        setPaymentType(snap.paymentType || '1');
        setPeriodo(snap.periodo || { start: '', end: '', feriados: 0 });
        setValorVRDiario(snap.valorVRDiario || '');
        setBeneficiosData(snap.beneficiosData || []);
        setBeneficiosOverrides(snap.beneficiosOverrides || {});
        
        setActiveTab('erp');
        showAlert("Restaurado", "Dados restaurados com sucesso! Você pode conferir os valores ou re-gerar os arquivos.");
      }
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans pb-20 relative">
      
      {/* Sistema de Modal Customizado */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-fade-in border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-2">{modalConfig.title}</h3>
            <p className="text-gray-600 mb-6 text-sm leading-relaxed">{modalConfig.message}</p>
            <div className="flex justify-end space-x-3">
              {modalConfig.type === 'confirm' && (
                <button onClick={closeModal} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors text-sm">
                  Cancelar
                </button>
              )}
              <button onClick={() => { if (modalConfig.onConfirm) modalConfig.onConfirm(); closeModal(); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors text-sm">
                {modalConfig.type === 'confirm' ? 'Confirmar' : 'Entendi'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto space-y-6">
        
        {/* Header e Navegação de Abas */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 flex flex-col md:flex-row items-center justify-between border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
            <div className="flex items-center space-x-4">
              <div className="bg-blue-600 p-3 rounded-lg text-white shadow-md"><FileSpreadsheet className="w-8 h-8" /></div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Sistema Integrado de DP</h1>
                <p className="text-sm text-gray-600 mt-1">Colaboradores, Remessas, Benefícios, ERP e Histórico</p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap border-b border-gray-200">
            <button onClick={() => setActiveTab('colaboradores')} className={`flex-1 py-4 px-4 text-sm font-bold tracking-wide transition-colors flex justify-center items-center space-x-2 ${activeTab === 'colaboradores' ? 'text-blue-700 bg-blue-50 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>
              <Users className="w-5 h-5" /><span>Base Local</span>
            </button>
            <button onClick={() => setActiveTab('salario')} className={`flex-1 py-4 px-4 text-sm font-bold tracking-wide transition-colors flex justify-center items-center space-x-2 ${activeTab === 'salario' ? 'text-blue-700 bg-blue-50 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>
              <Calculator className="w-5 h-5" /><span>Salário / Adiant.</span>
            </button>
            <button onClick={() => setActiveTab('beneficios')} className={`flex-1 py-4 px-4 text-sm font-bold tracking-wide transition-colors flex justify-center items-center space-x-2 ${activeTab === 'beneficios' ? 'text-blue-700 bg-blue-50 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>
              <div className="flex items-center space-x-1"><Bus className="w-5 h-5" /><Coffee className="w-5 h-5" /></div><span>VT e VR</span>
            </button>
            <button onClick={() => setActiveTab('erp')} className={`flex-1 py-4 px-4 text-sm font-bold tracking-wide transition-colors flex justify-center items-center space-x-2 ${activeTab === 'erp' ? 'text-blue-700 bg-blue-50 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>
              <PieChart className="w-5 h-5" /><span>Resumo ERP</span>
            </button>
            <button onClick={() => setActiveTab('historico')} className={`flex-1 py-4 px-4 text-sm font-bold tracking-wide transition-colors flex justify-center items-center space-x-2 ${activeTab === 'historico' ? 'text-blue-700 bg-blue-50 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>
              <Clock className="w-5 h-5" /><span>Histórico</span>
            </button>
          </div>
        </div>

        {/* ================= ABA 1: COLABORADORES ================= */}
        {activeTab === 'colaboradores' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">Importar Planilha Simplificada</h2>
                  <p className="text-sm text-gray-500 mt-1">Matrícula, Nome, CPF, Banco, Agência, Conta, Valor VT, Centro de Custo.</p>
                </div>
                <div className="flex flex-col space-y-2 items-end">
                  <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputCadastro} onChange={handleImportColaboradores} />
                  <button onClick={() => fileInputCadastro.current.click()} className="flex items-center space-x-2 px-4 py-2 bg-blue-50 text-blue-700 font-medium border border-blue-200 rounded-lg hover:bg-blue-100">
                    <Upload className="w-5 h-5" /> <span>Upload XLSX</span>
                  </button>
                  <button onClick={downloadTemplate} className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center space-x-1">
                    <Download className="w-3 h-3"/> <span>Baixar Modelo</span>
                  </button>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-center">
                <button onClick={() => setShowAddForm(!showAddForm)} className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white font-medium rounded-lg shadow hover:bg-blue-700">
                  <Plus className="w-5 h-5" /> <span>{showAddForm ? 'Fechar Formulário' : 'Cadastro Manual'}</span>
                </button>
              </div>
            </div>

            {showAddForm && (
              <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 shadow-inner">
                <form onSubmit={handleSaveColaborador} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <input required placeholder="Matrícula *" value={formData.matricula} onChange={e => setFormData({...formData, matricula: e.target.value})} className="border p-2 rounded" />
                  <input required placeholder="Nome Completo *" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} className="border p-2 rounded col-span-2" />
                  <input placeholder="CPF (Apenas números)" value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} className="border p-2 rounded" />
                  <input placeholder="Banco (Nome ou Cód)" value={formData.banco} onChange={e => setFormData({...formData, banco: e.target.value})} className="border p-2 rounded" />
                  <input placeholder="Agência" value={formData.agencia} onChange={e => setFormData({...formData, agencia: e.target.value})} className="border p-2 rounded" />
                  <input placeholder="Conta (com dígito ex: 123-4)" value={formData.conta} onChange={e => setFormData({...formData, conta: e.target.value})} className="border p-2 rounded" />
                  <CurrencyInput placeholder="Valor VT Fixo (Ex: 10,50)" value={formData.valorVT} onChange={val => setFormData({...formData, valorVT: val})} className="border p-2 rounded" />
                  <input placeholder="Centro de Custo" value={formData.centroCusto} onChange={e => setFormData({...formData, centroCusto: e.target.value.toUpperCase()})} className="border p-2 rounded col-span-2" />
                  <button type="submit" className="bg-green-600 text-white font-bold rounded py-2 hover:bg-green-700">Salvar Dados</button>
                </form>
              </div>
            )}

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">Banco de Dados Local ({colaboradores.length} pessoas)</h3>
                <button onClick={() => showConfirm("Limpar Base", "Tem certeza que deseja limpar toda a base? Essa ação não pode ser desfeita.", () => setColaboradores([]))} className="text-red-500 text-sm font-medium hover:underline">
                  Limpar Base
                </button>
              </div>
              <div className="overflow-x-auto max-h-[500px] border rounded-lg">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-100 sticky top-0 text-xs uppercase text-gray-600">
                    <tr><th className="p-3">Matrícula</th><th className="p-3">Nome</th><th className="p-3">C. Custo</th><th className="p-3">Dados Bancários</th><th className="p-3">VT Padrão</th><th className="p-3">Ação</th></tr>
                  </thead>
                  <tbody>
                    {colaboradores.map((c, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-mono">{c.matricula}</td><td className="p-3 font-medium">{c.nome}</td><td className="p-3 text-xs">{c.centroCusto}</td>
                        <td className="p-3 text-xs text-gray-500">{c.banco} | Ag: {c.agencia} | CC: {c.conta}</td>
                        <td className="p-3 font-semibold text-blue-600">{c.valorVT ? `R$ ${formatMoney(c.valorVT)}` : '-'}</td>
                        <td className="p-3"><button onClick={() => removerColaborador(c.matricula)} className="text-red-500 hover:text-red-700 p-1" title="Excluir Colaborador"><Trash2 className="w-4 h-4" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= ABA 2: SALÁRIO ================= */}
        {activeTab === 'salario' && (
          <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
              <div className={`p-4 rounded-full mb-4 ${espelhoFile ? 'bg-green-100' : 'bg-blue-50'}`}>
                {espelhoFile ? <CheckCircle className="w-8 h-8 text-green-600" /> : <FileText className="w-8 h-8 text-blue-600" />}
              </div>
              <h2 className="text-lg font-semibold text-gray-800">1. Espelho de Salário (PDF)</h2>
              <p className="text-xs text-gray-500 mt-2 mb-4">O sistema usará a base local de Colaboradores para cruzar as matrículas.</p>
              <input type="file" accept=".pdf" className="hidden" ref={fileInputEspelho} onChange={(e) => setEspelhoFile(e.target.files[0])} />
              <button onClick={() => fileInputEspelho.current.click()} className="px-6 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
                {espelhoFile ? espelhoFile.name : 'Selecionar Arquivo PDF'}
              </button>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center space-y-4">
              <div className="flex justify-between w-full max-w-lg items-center">
                <h3 className="text-lg font-semibold text-gray-800">2. Tipo de Pagamento</h3>
                {salarioData.length > 0 && (
                  <button onClick={() => showConfirm("Limpar Lançamentos", "Deseja remover os dados processados da tela de salário?", () => {setSalarioData([]); setEspelhoFile(null);})} className="text-xs text-red-500 hover:underline flex items-center"><RotateCcw className="w-3 h-3 mr-1"/> Limpar Tela</button>
                )}
              </div>
              <div className="flex space-x-6">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="radio" value="1" checked={paymentType === '1'} onChange={(e) => setPaymentType(e.target.value)} className="w-5 h-5 text-blue-600" />
                  <span className="text-gray-700 font-medium">Salário (Cód. 1)</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="radio" value="9" checked={paymentType === '9'} onChange={(e) => setPaymentType(e.target.value)} className="w-5 h-5 text-blue-600" />
                  <span className="text-gray-700 font-medium">Adiantamento (Cód. 9)</span>
                </label>
              </div>
            </div>

            <div className="flex justify-center">
              <button onClick={processarSalario} disabled={!espelhoFile || isProcessingSalario || !isReady} className="flex items-center space-x-2 px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700 disabled:opacity-50">
                {isProcessingSalario ? <span>Processando...</span> : !isReady ? <span>Carregando dependências...</span> : <><span>Processar Remessa Bancária</span><ArrowRight className="w-5 h-5" /></>}
              </button>
            </div>

            {(salarioData.length > 0 || errorsSalario.length > 0) && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                {errorsSalario.length > 0 && (
                  <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
                    <AlertTriangle className="w-5 h-5 inline mr-2" /><strong>Avisos ({errorsSalario.length})</strong>
                    <ul className="list-disc pl-5 mt-2 max-h-40 overflow-y-auto">{errorsSalario.map((err, i) => <li key={i}>{err}</li>)}</ul>
                  </div>
                )}
                {salarioData.length > 0 && (() => {
                  const totalSalario = salarioData.reduce((acc, row) => acc + (row.valor || 0), 0);
                  return (
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <p className="font-semibold">{salarioData.length} processados.</p>
                        <button onClick={exportarArquivoBancoSalario} className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center space-x-2"><Download className="w-4 h-4"/><span>Baixar XLSX Banco</span></button>
                      </div>
                      <div className="overflow-x-auto max-h-[400px] border rounded-lg">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-gray-50 text-xs uppercase sticky top-0">
                            <tr><th>Agência</th><th>Conta-Dig</th><th>Nome</th><th>CPF</th><th>Cód</th><th>C. Custo</th><th className="text-right">Valor</th></tr>
                          </thead>
                          <tbody>
                            {salarioData.map((row, i) => (
                              <tr key={i} className="border-b">
                                <td className="px-2 py-1">{row.agencia}</td><td className="px-2 py-1">{row.conta}-{row.digito}</td>
                                <td className="px-2 py-1">{row.nome}</td><td className="px-2 py-1">{row.cpf}</td>
                                <td className="px-2 py-1 text-center font-bold text-blue-600">{row.bancoCode}</td>
                                <td className="px-2 py-1 text-xs text-gray-500">{row.centroCusto}</td>
                                <td className="px-2 py-1 text-right text-green-700 font-bold whitespace-nowrap">R$ {formatMoney(row.valor)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-100 text-xs uppercase font-bold sticky bottom-0 border-t-2 border-gray-300 shadow-[0_-2px_4px_rgba(0,0,0,0.05)]">
                            <tr>
                              <td colSpan="6" className="px-2 py-3 text-right text-gray-700">Total da Folha:</td>
                              <td className="px-2 py-3 text-right text-green-800 whitespace-nowrap">R$ {formatMoney(totalSalario)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ================= ABA 3: BENEFÍCIOS (VT/VR) ================= */}
        {activeTab === 'beneficios' && (
          <div className="space-y-6 animate-fade-in w-full">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 max-w-6xl mx-auto">
              <h2 className="text-lg font-semibold text-gray-800 mb-4"><CalendarDays className="w-5 h-5 inline mr-2 text-blue-600" />Parâmetros do Período</h2>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div><label className="text-sm">Data Inicial</label><input type="date" value={periodo.start} onChange={e => setPeriodo({...periodo, start: e.target.value})} className="w-full border p-2 rounded focus:ring-blue-500"/></div>
                <div><label className="text-sm">Data Final</label><input type="date" value={periodo.end} onChange={e => setPeriodo({...periodo, end: e.target.value})} className="w-full border p-2 rounded focus:ring-blue-500"/></div>
                <div><label className="text-sm">Feriados</label><input type="number" min="0" value={periodo.feriados} onChange={e => setPeriodo({...periodo, feriados: e.target.value})} className="w-full border p-2 rounded focus:ring-blue-500"/></div>
                <div><label className="text-sm">Valor Diário VR</label><CurrencyInput value={valorVRDiario} onChange={setValorVRDiario} className="w-full border p-2 rounded bg-blue-50 font-bold"/></div>
                <div className="bg-blue-100 rounded p-2 text-center h-full flex flex-col justify-center"><span className="text-xs uppercase">Dias Úteis</span><span className="text-2xl font-bold text-blue-800">{diasUteisBase}</span></div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold flex items-center">
                  Lançamentos Individuais
                  {beneficiosData.length > 0 && (
                    <button onClick={limparMesBeneficios} className="ml-4 text-xs font-normal text-red-500 hover:underline flex items-center"><RotateCcw className="w-3 h-3 mr-1"/> Limpar Dados</button>
                  )}
                </h2>
                <div className="flex space-x-2">
                  <button onClick={carregarColaboradoresBeneficios} className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">Carregar Base de Colaboradores</button>
                  {beneficiosData.length > 0 && (
                    <>
                      <button onClick={exportBeneficiosBasePDF} className="px-3 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 flex items-center space-x-1"><FileText className="w-4 h-4" /><span>Relatório em PDF</span></button>
                      <button onClick={exportVTBankFile} className="px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 flex items-center space-x-1"><Download className="w-4 h-4" /><span>Arquivo Itaú VT</span></button>
                      <button onClick={generateReceiptsPDF} className="px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 flex items-center space-x-1"><FileText className="w-4 h-4" /><span>Recibos Indiv.</span></button>
                    </>
                  )}
                </div>
              </div>

              {beneficiosData.length > 0 && (() => {
                const listaCalculada = calcBeneficios();
                const somaVT = listaCalculada.reduce((acc, c) => acc + c.totalVT, 0);
                const somaVR = listaCalculada.reduce((acc, c) => acc + c.totalVRLiquido, 0);
                const somaGeral = listaCalculada.reduce((acc, c) => acc + c.totalGeral, 0);

                return (
                  <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-[600px]">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                      <thead className="text-[10px] text-gray-700 uppercase bg-gray-100 border-b sticky top-0 z-10">
                        <tr>
                          <th className="px-2 py-3">Matr. / Nome</th>
                          <th className="px-2 py-3 text-center">VT Diário</th>
                          <th className="px-2 py-3 text-center text-red-600 bg-red-50/50">Faltas<br/>(Abate ambos)</th>
                          <th className="px-1 py-3 text-center text-orange-600">- Desc<br/>VT</th>
                          <th className="px-1 py-3 text-center text-orange-600">- Desc<br/>VR</th>
                          <th className="px-1 py-3 text-center text-green-600">+ Acrés<br/>VT</th>
                          <th className="px-1 py-3 text-center text-green-600">+ Acrés<br/>VR</th>
                          <th className="px-2 py-3 text-right">Tot. VT</th>
                          <th className="px-2 py-3 text-right">Tot. VR Líq</th>
                          <th className="px-2 py-3 text-right font-bold">Total Geral</th>
                          <th className="px-2 py-3">Obs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {listaCalculada.map((c, i) => (
                          <tr key={i} className="bg-white border-b hover:bg-blue-50">
                            <td className="px-2 py-2">
                              <span className="font-mono text-gray-500 text-xs">{c.matricula}</span><br/>
                              <span className="font-medium text-gray-900" title={c.nome}>{c.nome.substring(0,25)}</span>
                            </td>
                            <td className="px-2 py-2">
                              <CurrencyInput value={beneficiosOverrides[c.matricula]?.valorVT ?? ''} onChange={(val) => updateOverride(c.matricula, 'valorVT', val)} className="w-24 text-center border rounded p-1 text-xs font-bold text-blue-700 bg-transparent" />
                            </td>
                            <td className="px-2 py-2 bg-red-50/20 text-center">
                              <input type="number" min="0" value={beneficiosOverrides[c.matricula]?.ausencias ?? ''} onChange={(e) => updateOverride(c.matricula, 'ausencias', e.target.value)} className="w-12 text-center border border-red-200 rounded p-1 text-xs text-red-700" />
                            </td>
                            <td className="px-1 py-2 text-center">
                              <input type="number" min="0" value={beneficiosOverrides[c.matricula]?.descontoVT ?? ''} onChange={(e) => updateOverride(c.matricula, 'descontoVT', e.target.value)} className="w-10 text-center border rounded p-1 text-xs text-orange-600" />
                            </td>
                            <td className="px-1 py-2 text-center">
                              <input type="number" min="0" value={beneficiosOverrides[c.matricula]?.descontoVR ?? ''} onChange={(e) => updateOverride(c.matricula, 'descontoVR', e.target.value)} className="w-10 text-center border rounded p-1 text-xs text-orange-600" />
                            </td>
                            <td className="px-1 py-2 text-center">
                              <input type="number" min="0" value={beneficiosOverrides[c.matricula]?.acrescimosVT ?? ''} onChange={(e) => updateOverride(c.matricula, 'acrescimosVT', e.target.value)} className="w-10 text-center border rounded p-1 text-xs text-green-700" />
                            </td>
                            <td className="px-1 py-2 text-center">
                              <input type="number" min="0" value={beneficiosOverrides[c.matricula]?.acrescimosVR ?? ''} onChange={(e) => updateOverride(c.matricula, 'acrescimosVR', e.target.value)} className="w-10 text-center border rounded p-1 text-xs text-green-700" />
                            </td>
                            <td className="px-2 py-2 text-right text-blue-700 font-semibold whitespace-nowrap">R$ {formatMoney(c.totalVT)}</td>
                            <td className="px-2 py-2 text-right text-blue-700 font-semibold whitespace-nowrap">R$ {formatMoney(c.totalVRLiquido)}</td>
                            <td className="px-2 py-2 text-right bg-green-50/50 font-bold text-green-700 whitespace-nowrap">R$ {formatMoney(c.totalGeral)}</td>
                            <td className="px-2 py-2">
                              <input type="text" value={beneficiosOverrides[c.matricula]?.obs || ''} onChange={(e) => updateOverride(c.matricula, 'obs', e.target.value)} className="w-full border rounded p-1 text-xs" placeholder="..." />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-100 text-[10px] uppercase font-bold sticky bottom-0 border-t-2 border-gray-300 z-10 shadow-[0_-2px_4px_rgba(0,0,0,0.05)]">
                        <tr>
                          <td colSpan="7" className="px-2 py-3 text-right text-gray-700 text-xs">Totais Gerais da Folha:</td>
                          <td className="px-2 py-3 text-right text-blue-800 whitespace-nowrap text-xs">R$ {formatMoney(somaVT)}</td>
                          <td className="px-2 py-3 text-right text-blue-800 whitespace-nowrap text-xs">R$ {formatMoney(somaVR)}</td>
                          <td className="px-2 py-3 text-right bg-green-200 text-green-800 whitespace-nowrap text-xs">R$ {formatMoney(somaGeral)}</td>
                          <td className="px-2 py-3"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ================= ABA 4: DASHBOARD ERP E FECHAMENTO ================= */}
        {activeTab === 'erp' && (() => {
          const erpResumo = getERPData();
          const totalSalarioERP = erpResumo.reduce((acc, curr) => acc + curr.salario, 0);
          const totalVtERP = erpResumo.reduce((acc, curr) => acc + curr.vt, 0);
          const totalVrERP = erpResumo.reduce((acc, curr) => acc + curr.vr, 0);
          const totalGeralERP = erpResumo.reduce((acc, curr) => acc + curr.total, 0);

          return (
            <div className="space-y-6 animate-fade-in w-full max-w-6xl mx-auto">
              <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 relative">
                <div className="absolute top-6 right-6 flex space-x-3">
                  <button onClick={exportERPPDF} className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 text-white font-bold rounded-lg shadow-lg hover:bg-blue-700 transition-colors text-sm">
                    <FileText className="w-5 h-5"/><span>Imprimir PDF</span>
                  </button>
                  <button onClick={salvarFechamento} className="flex items-center space-x-2 px-5 py-2.5 bg-green-600 text-white font-bold rounded-lg shadow-lg hover:bg-green-700 transition-colors text-sm">
                    <Save className="w-5 h-5"/><span>Salvar Fechamento no Histórico</span>
                  </button>
                </div>
                <div className="text-center mt-4">
                  <PieChart className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-gray-800">Resumo Gerencial por Centro de Custo</h2>
                  <p className="text-gray-500 mt-2">Valores consolidados baseados no processamento da aba Salário e aba Benefícios.</p>
                </div>
              </div>

              {erpResumo.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 border border-dashed border-gray-300 rounded-lg">
                  <p className="text-gray-500">Não há dados calculados no momento.</p>
                  <p className="text-xs mt-1">Gere a remessa de Salário e/ou os controles de Benefícios primeiro.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                      <p className="text-xs uppercase text-gray-500 font-bold">Total Salários/Adiant.</p>
                      <p className="text-2xl font-bold text-gray-800 mt-1">R$ {formatMoney(totalSalarioERP)}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                      <p className="text-xs uppercase text-gray-500 font-bold">Total VT (Benefícios)</p>
                      <p className="text-2xl font-bold text-blue-700 mt-1">R$ {formatMoney(totalVtERP)}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                      <p className="text-xs uppercase text-gray-500 font-bold">Total VR (Líq. Benefícios)</p>
                      <p className="text-2xl font-bold text-blue-700 mt-1">R$ {formatMoney(totalVrERP)}</p>
                    </div>
                    <div className="bg-green-600 p-4 rounded-lg shadow-sm text-white">
                      <p className="text-xs uppercase font-bold text-green-100">Despesa Geral da Folha</p>
                      <p className="text-2xl font-bold mt-1">R$ {formatMoney(totalGeralERP)}</p>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                      <thead className="bg-gray-100 text-gray-700 uppercase text-xs font-bold border-b">
                        <tr>
                          <th className="p-4">Centro de Custo</th>
                          <th className="p-4 text-center">Quantidade de Colaboradores</th>
                          <th className="p-4 text-right">Salário/Adiant.</th>
                          <th className="p-4 text-right">Vale Transporte</th>
                          <th className="p-4 text-right">Vale Refeição</th>
                          <th className="p-4 text-right bg-green-50">Custo Total Setor</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {erpResumo.map((row, i) => (
                          <tr key={i} className="border-b hover:bg-gray-50">
                            <td className="p-4 font-bold text-gray-800">{row.centroCusto}</td>
                            <td className="p-4 text-center text-gray-500">{row.vidas}</td>
                            <td className="p-4 text-right font-medium text-gray-600">R$ {formatMoney(row.salario)}</td>
                            <td className="p-4 text-right font-medium text-blue-600">R$ {formatMoney(row.vt)}</td>
                            <td className="p-4 text-right font-medium text-blue-600">R$ {formatMoney(row.vr)}</td>
                            <td className="p-4 text-right font-bold text-green-700 bg-green-50/30">R$ {formatMoney(row.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* ================= ABA 5: HISTÓRICO (MÁQUINA DO TEMPO) ================= */}
        {activeTab === 'historico' && (
          <div className="space-y-6 animate-fade-in w-full max-w-6xl mx-auto">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-800 flex items-center"><Clock className="w-5 h-5 mr-2 text-blue-600"/> Fechamentos e Auditoria</h2>
                  <p className="text-sm text-gray-500">Ao restaurar um fechamento, os dados atuais da tela serão substituídos permitindo emitir os relatórios novamente.</p>
                </div>
              </div>

              {historico.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 border border-dashed border-gray-300 rounded-lg">
                  <p className="text-gray-500">O histórico de fechamentos está vazio.</p>
                  <p className="text-xs mt-1">Salve o seu primeiro fechamento na aba 'Resumo ERP'.</p>
                </div>
              ) : (
                <div className="overflow-hidden border border-gray-200 rounded-lg">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-100 text-gray-700 uppercase text-xs font-bold border-b">
                      <tr>
                        <th className="p-3 w-40">Data e Hora</th>
                        <th className="p-3 w-48">Período/Pagamento</th>
                        <th className="p-3">Detalhes</th>
                        <th className="p-3 text-right w-40">Despesa Total</th>
                        <th className="p-3 text-center w-32">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {historico.map((log) => (
                        <tr key={log.id} className="bg-white hover:bg-gray-50">
                          <td className="p-3 text-gray-500 font-mono text-xs">{log.dataHora}</td>
                          <td className="p-3 font-semibold text-gray-800 text-xs">{log.tipo}</td>
                          <td className="p-3 text-gray-600 text-xs">{log.detalhes}</td>
                          <td className="p-3 text-right font-bold text-green-700 whitespace-nowrap">R$ {formatMoney(log.valorTotal)}</td>
                          <td className="p-3 text-center">
                            <button onClick={() => restaurarHistorico(log)} className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs font-bold transition-colors">
                              Restaurar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}