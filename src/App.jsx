import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, AlertTriangle, FileSpreadsheet, CheckCircle, ArrowRight, FileText, CalendarDays, Calculator, Bus, Coffee } from 'lucide-react';

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
      // Carrega Leitor de Excel
      if (!window.XLSX) {
        const xlsxScript = document.createElement('script');
        xlsxScript.src = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
        document.body.appendChild(xlsxScript);
        await new Promise(r => xlsxScript.onload = r);
      }
      // Carrega Leitor de PDF (Para espelho)
      if (!window.pdfjsLib) {
        const pdfScript = document.createElement('script');
        pdfScript.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        document.body.appendChild(pdfScript);
        await new Promise(r => pdfScript.onload = r);
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      }
      // Carrega Gerador de PDF (Para recibos)
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

  // ---------- FUNÇÕES COMPARTILHADAS ----------
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
        // Limpa a tabela de benefícios se trocar o arquivo base
        setBeneficiosData([]);
      }
      if (type === 'espelho') setEspelhoFile(file);
    }
  };

  // ---------- FUNÇÕES ABA 1: SALÁRIO ----------
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
      alert("As bibliotecas ainda estão carregando. Tente novamente em alguns segundos.");
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
          const nomeStr = nomeKey ? String(row[nomeKey]) : '';

          cadastroMap[safeMat] = {
            ...row,
            _safeMat: safeMat,
            _safeNome: normalizeText(nomeStr)
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

        items.sort((a, b) => {
          if (Math.abs(b.transform[5] - a.transform[5]) > 5) {
            return b.transform[5] - a.transform[5];
          }
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
      const matriculasDoCadastro = Object.keys(cadastroMap);

      pdfLines.forEach((line) => {
        const lineNormalized = normalizeText(line);

        for (const safeMat of matriculasDoCadastro) {
          if (!safeMat || safeMat === '0') continue;
          
          const empData = cadastroMap[safeMat];
          const regexMat = new RegExp(`\\b0*${safeMat}\\b`);
          const partesNome = empData._safeNome.split(' ').filter(n => n.length > 1);
          const primeiroNome = partesNome.length > 0 ? partesNome[0] : '';

          if (regexMat.test(line) && (primeiroNome === '' || lineNormalized.includes(primeiroNome))) {
            const valueMatches = line.match(/(?:\d{1,3}(?:\.\d{3})*|\d+),\d{2}/g);
            
            if (valueMatches && valueMatches.length > 0) {
              const lastMatch = valueMatches[valueMatches.length - 1];
              const valor = parseFloat(lastMatch.replace(/\./g, '').replace(',', '.'));
              
              if (valor > 0 && !matriculasEncontradas.has(safeMat)) {
                matriculasEncontradas.add(safeMat);
                
                const getVal = (searchStr) => {
                  const k = Object.keys(empData).find(key => normalizeKey(key).includes(searchStr));
                  return k ? empData[k] : "";
                };

                const agencia = String(getVal('agencia')).trim();
                const contaFull = String(getVal('conta')).trim(); 
                const cpf = formatCPF(getVal('cpf')); 
                const bancoCode = getBankCode(getVal('banco'));
                const nome = empData[Object.keys(empData).find(k => normalizeKey(k) === 'nome')] || `Colaborador ${safeMat}`;

                let conta = contaFull;
                let digito = "";
                if (contaFull.includes('-')) {
                  const parts = contaFull.split('-');
                  digito = parts.pop();
                  conta = parts.join('-');
                }

                if (!agencia || !conta) {
                     currentErrors.push(`Atenção: Dados bancários incompletos para "${nome}" (Matrícula: ${safeMat}).`);
                }

                const rowData = [agencia, conta, digito, nome, cpf, paymentType, valor];
                result.push(rowData);
              }
            }
          }
        }
      });

      if (result.length === 0) {
          currentErrors.push("Erro: Não foi possível associar nenhuma matrícula do Cadastro aos valores do PDF. O espelho pode estar num formato de imagem embutida ou incompatível.");
      }

      setProcessedData(result);
      setErrors(currentErrors);

    } catch (error) {
      console.error(error);
      setErrors(["Ocorreu um erro ao processar os arquivos. Certifique-se de que o Cadastro é Excel e o Espelho é um PDF."]);
    } finally {
      setIsProcessing(false);
    }
  };

  const exportToExcel = () => {
    if (processedData.length === 0 || !window.XLSX) return;

    const ws = window.XLSX.utils.aoa_to_sheet(processedData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Pagamentos");
    
    const tipoNome = paymentType === '1' ? 'Salário' : 'Adiantamento Salárial';
    const dataFormatada = new Date().toISOString().split('T')[0];
    
    window.XLSX.writeFile(wb, `${tipoNome} (${dataFormatada}).xlsx`);
  };

  const totalSoma = processedData.reduce((acc, row) => acc + (typeof row[6] === 'number' ? row[6] : 0), 0);

  // ---------- FUNÇÕES ABA 2: BENEFÍCIOS (VT/VR) ----------
  
  // Efeito que calcula dias úteis toda vez que as datas ou feriados mudam
  useEffect(() => {
    if (periodo.start && periodo.end) {
      const startDate = new Date(periodo.start + 'T00:00:00');
      const endDate = new Date(periodo.end + 'T00:00:00');
      
      let count = 0;
      let currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          count++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      const finalDays = Math.max(0, count - (parseInt(periodo.feriados) || 0));
      setDiasUteisBase(finalDays);
    } else {
      setDiasUteisBase(0);
    }
  }, [periodo]);

  const carregarColaboradoresBeneficios = async () => {
    if (!cadastroFile || !isReady) {
      alert("Faça o upload da Planilha de Cadastro primeiro.");
      return;
    }
    setIsProcessing(true);
    try {
      const cadastroBuffer = await cadastroFile.arrayBuffer();
      const cadastroWb = window.XLSX.read(cadastroBuffer, { type: 'array' });
      const rawData = window.XLSX.utils.sheet_to_json(cadastroWb.Sheets[cadastroWb.SheetNames[0]], { defval: "" });
      
      const colabList = [];
      rawData.forEach((row) => {
        const matKey = Object.keys(row).find(k => normalizeKey(k) === 'matricula');
        const nomeKey = Object.keys(row).find(k => normalizeKey(k) === 'nome');
        
        if (matKey && row[matKey] && nomeKey && row[nomeKey]) {
           const getVal = (searchStr) => {
             const k = Object.keys(row).find(key => normalizeKey(key).includes(searchStr));
             return k ? row[k] : "";
           };

           const agencia = String(getVal('agencia')).trim();
           const contaFull = String(getVal('conta')).trim();
           let conta = contaFull;
           let digito = "";
           if (contaFull.includes('-')) {
             const parts = contaFull.split('-');
             digito = parts.pop();
             conta = parts.join('-');
           }
           const cpf = formatCPF(getVal('cpf'));

           colabList.push({
             matricula: String(row[matKey]).trim(),
             nome: String(row[nomeKey]).trim(),
             agencia,
             conta,
             digito,
             cpf
           });
        }
      });
      
      colabList.sort((a, b) => a.nome.localeCompare(b.nome));
      setBeneficiosData(colabList);
      
      setBeneficiosOverrides({});
    } catch (error) {
      console.error(error);
      alert("Erro ao ler a planilha de cadastro.");
    } finally {
      setIsProcessing(false);
    }
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

  const exportBeneficiosToExcel = () => {
    if (beneficiosData.length === 0 || !window.XLSX) return;

    const vrDiarioNumGlobal = parseFloat(valorVRDiario) || 0;

    const exportData = beneficiosData.map(colab => {
      const overrides = beneficiosOverrides[colab.matricula] || { ausencias: 0, descontoVT: 0, descontoVR: 0, acrescimosVT: 0, acrescimosVR: 0, obs: '', valorVT: '' };
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
        'Matrícula': colab.matricula,
        'Colaborador': colab.nome,
        'Valor Diário VT (R$)': valorVT,
        'Valor Diário VR (R$)': vrDiarioNumGlobal,
        'Dias Úteis Base': diasUteisBase,
        'Faltas GERAIS': ausencias,
        'Desconto Espec. VT': descontoVT,
        'Desconto Espec. VR': descontoVR,
        'Acréscimos VT': acrescimosVT,
        'Acréscimos VR': acrescimosVR,
        'Total Dias VT': totalDiasVT,
        'Total Dias VR': totalDiasVR,
        'Total VT (R$)': totalVT,
        'Total VR Bruto (R$)': totalVRBruto,
        'Desconto Conv. VR 9% (R$)': descontoVRTaxa,
        'Total VR Líquido (R$)': totalVRLiquido,
        'Total Geral a Pagar (R$)': totalGeral,
        'Observações': overrides.obs || ''
      };
    });

    const ws = window.XLSX.utils.json_to_sheet(exportData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Controle VT e VR");
    
    const dataFormatada = new Date().toISOString().split('T')[0];
    window.XLSX.writeFile(wb, `Controle_VT_VR_${dataFormatada}.xlsx`);
  };

  const exportVTBankFile = () => {
    if (beneficiosData.length === 0 || !window.XLSX) return;

    const vtData = [];
    beneficiosData.forEach(colab => {
      const overrides = beneficiosOverrides[colab.matricula] || {};
      const ausencias = parseInt(overrides.ausencias) || 0;
      const descontoVT = parseInt(overrides.descontoVT) || 0;
      const acrescimosVT = parseInt(overrides.acrescimosVT) || 0;
      const valorVT = parseFloat(overrides.valorVT) || 0;
      
      const totalDiasVT = Math.max(0, diasUteisBase - ausencias - descontoVT + acrescimosVT);
      const totalVT = totalDiasVT * valorVT;

      if (totalVT > 0) {
        vtData.push([
          colab.agencia || '',
          colab.conta || '',
          colab.digito || '',
          colab.nome,
          colab.cpf || '',
          '3', // Código fixo solicitado para VT
          totalVT
        ]);
      }
    });

    if (vtData.length === 0) {
      alert("Não há valores de VT a serem pagos para gerar o arquivo do banco.");
      return;
    }

    const ws = window.XLSX.utils.aoa_to_sheet(vtData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Pagamentos VT");
    
    const dataFormatada = new Date().toISOString().split('T')[0];
    window.XLSX.writeFile(wb, `Arquivo_Itau_VT_${dataFormatada}.xlsx`);
  };

  const generateReceiptsPDF = () => {
    if (beneficiosData.length === 0) return;
    if (!window.jspdf) {
      alert("Aguarde, a biblioteca de PDF ainda está carregando...");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const vrDiarioNumGlobal = parseFloat(valorVRDiario) || 0;
    const startStr = periodo.start ? periodo.start.split('-').reverse().join('/') : 'Não definido';
    const endStr = periodo.end ? periodo.end.split('-').reverse().join('/') : 'Não definido';

    // Função auxiliar para formatar os valores no padrão brasileiro (com vírgula)
    const formatMoney = (val) => val.toFixed(2).replace('.', ',');

    let pageAdded = false;

    beneficiosData.forEach((colab) => {
      const overrides = beneficiosOverrides[colab.matricula] || {};
      const ausencias = parseInt(overrides.ausencias) || 0;
      const descontoVT = parseInt(overrides.descontoVT) || 0;
      const descontoVR = parseInt(overrides.descontoVR) || 0;
      const acrescimosVT = parseInt(overrides.acrescimosVT) || 0;
      const acrescimosVR = parseInt(overrides.acrescimosVR) || 0;
      const valorVT = parseFloat(overrides.valorVT) || 0;
      const obs = overrides.obs || 'Nenhuma';
      
      const totalDiasVT = Math.max(0, diasUteisBase - ausencias - descontoVT + acrescimosVT);
      const totalDiasVR = Math.max(0, diasUteisBase - ausencias - descontoVR + acrescimosVR);
      
      const totalVT = totalDiasVT * valorVT;
      const totalVRBruto = totalDiasVR * vrDiarioNumGlobal;
      const descontoVRTaxa = totalVRBruto * 0.09;
      const totalVRLiquido = totalVRBruto - descontoVRTaxa;
      const totalGeral = totalVT + totalVRLiquido;

      // Pula quem não tem nada a receber para não gastar folha
      if (totalGeral <= 0 && ausencias === 0 && acrescimosVT === 0 && acrescimosVR === 0) return;

      if (pageAdded) doc.addPage();
      pageAdded = true;

      // Cabeçalho
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("RECIBO INDIVIDUAL DE BENEFÍCIOS", 105, 20, { align: "center" });

      // Dados do Colaborador
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(`Colaborador: ${colab.nome}`, 20, 35);
      doc.text(`Matrícula: ${colab.matricula}`, 20, 42);
      doc.text(`Período de Apuração: ${startStr} até ${endStr}`, 20, 49);
      doc.text(`Dias Úteis Base no Período: ${diasUteisBase} dias`, 20, 56);

      // Resumo de Valores
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Resumo de Valores:", 20, 75);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(`Valor Total de VT: R$ ${formatMoney(totalVT)}`, 20, 85);
      doc.text(`Valor Total de VR: R$ ${formatMoney(totalVRLiquido)}`, 20, 93);

      // Resumo Final
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`TOTAL GERAL A RECEBER: R$ ${formatMoney(totalGeral)}`, 20, 110);

      // Observações
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(`Observações: ${obs}`, 20, 130);

      // Assinatura
      doc.setDrawColor(0, 0, 0);
      doc.line(40, 180, 170, 180);
      doc.text(colab.nome, 105, 187, { align: "center" });
      doc.setFontSize(8);
      doc.text("Assinatura do Colaborador", 105, 192, { align: "center" });
    });

    if (!pageAdded) {
      alert("Nenhum colaborador possui valores de benefícios para gerar recibo.");
      return;
    }

    doc.save(`Recibos_Beneficios_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Cálculos Totais Benefícios
  let sumAusencias = 0;
  let sumDescontoVT = 0;
  let sumDescontoVR = 0;
  let sumAcrescimosVT = 0;
  let sumAcrescimosVR = 0;
  let sumTotalVT = 0;
  let sumDescontoVRTaxa = 0;
  let sumTotalVRLiquido = 0;
  let sumTotalGeral = 0;

  const vrDiarioNumGlobal = parseFloat(valorVRDiario) || 0;

  if (activeTab === 'beneficios') {
    beneficiosData.forEach(colab => {
      const overrides = beneficiosOverrides[colab.matricula] || { ausencias: 0, descontoVT: 0, descontoVR: 0, acrescimosVT: 0, acrescimosVR: 0, valorVT: '' };
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

      sumAusencias += ausencias;
      sumDescontoVT += descontoVT;
      sumDescontoVR += descontoVR;
      sumAcrescimosVT += acrescimosVT;
      sumAcrescimosVR += acrescimosVR;
      sumTotalVT += totalVT;
      sumDescontoVRTaxa += descontoVRTaxa;
      sumTotalVRLiquido += totalVRLiquido;
      sumTotalGeral += totalGeral;
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans pb-20">
      <div className="max-w-[1400px] mx-auto space-y-6">
        
        {/* Header e Navegação de Abas */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 flex flex-col md:flex-row items-center justify-between border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
            <div className="flex items-center space-x-4">
              <div className="bg-blue-600 p-3 rounded-lg text-white shadow-md">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Sistema Integrado de DP</h1>
                <p className="text-sm text-gray-600 mt-1">Automatização de Remessas e Benefícios</p>
              </div>
            </div>
          </div>
          
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('salario')}
              className={`flex-1 py-4 px-6 text-sm font-bold tracking-wide transition-colors flex justify-center items-center space-x-2 ${
                activeTab === 'salario' 
                ? 'text-blue-700 bg-blue-50 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              <Calculator className="w-5 h-5" />
              <span>Remessa de Salário / Adiantamento</span>
            </button>
            <button
              onClick={() => setActiveTab('beneficios')}
              className={`flex-1 py-4 px-6 text-sm font-bold tracking-wide transition-colors flex justify-center items-center space-x-2 ${
                activeTab === 'beneficios' 
                ? 'text-blue-700 bg-blue-50 border-b-2 border-blue-600' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center space-x-1">
                <Bus className="w-5 h-5" />
                <Coffee className="w-5 h-5" />
              </div>
              <span>Controle VT e VR</span>
            </button>
          </div>
        </div>

        {/* Global Upload (Apenas para Cadastro, compartilhado entre abas) */}
        {(!cadastroFile || activeTab === 'salario') && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
            <div className={`p-4 rounded-full mb-4 ${cadastroFile ? 'bg-green-100' : 'bg-blue-50'}`}>
              {cadastroFile ? <CheckCircle className="w-8 h-8 text-green-600" /> : <Upload className="w-8 h-8 text-blue-600" />}
            </div>
            <h2 className="text-lg font-semibold text-gray-800">1. Planilha Base de Cadastro (Excel)</h2>
            <p className="text-xs text-gray-500 mt-2 mb-4">Essencial para ambas as abas. Contém os dados bancários e nomes.</p>
            
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              className="hidden" 
              ref={fileInputCadastro} 
              onChange={(e) => handleFileUpload(e, 'cadastro')} 
            />
            <button 
              onClick={() => fileInputCadastro.current.click()}
              className={`px-6 py-2 text-sm font-medium rounded-lg transition-colors border ${
                cadastroFile 
                ? 'text-green-700 bg-green-50 border-green-200 hover:bg-green-100' 
                : 'text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100'
              }`}
            >
              {cadastroFile ? `Arquivo Ativo: ${cadastroFile.name} (Clique para trocar)` : 'Selecionar Arquivo'}
            </button>
          </div>
        )}

        {/* ================= ABA 1: SALÁRIO ================= */}
        {activeTab === 'salario' && (
          <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
            {/* Upload Espelho */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
              <div className={`p-4 rounded-full mb-4 ${espelhoFile ? 'bg-green-100' : 'bg-blue-50'}`}>
                {espelhoFile ? <CheckCircle className="w-8 h-8 text-green-600" /> : <FileText className="w-8 h-8 text-blue-600" />}
              </div>
              <h2 className="text-lg font-semibold text-gray-800">2. Espelho de Salário (PDF)</h2>
              <p className="text-xs text-gray-500 mt-2 mb-4">Enviado pela contabilidade (PDF contendo Matrícula e Salário Líquido).</p>
              
              <input 
                type="file" 
                accept=".pdf" 
                className="hidden" 
                ref={fileInputEspelho} 
                onChange={(e) => handleFileUpload(e, 'espelho')} 
              />
              <button 
                onClick={() => fileInputEspelho.current.click()}
                className="px-6 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                {espelhoFile ? espelhoFile.name : 'Selecionar Arquivo PDF'}
              </button>
            </div>

            {/* Payment Type */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">3. Selecione o Tipo de Pagamento</h3>
              <div className="flex space-x-6">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="radio" name="paymentType" value="1" checked={paymentType === '1'} onChange={(e) => setPaymentType(e.target.value)} className="w-5 h-5 text-blue-600" />
                  <span className="text-gray-700 font-medium">Salário (Cód. 1)</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="radio" name="paymentType" value="9" checked={paymentType === '9'} onChange={(e) => setPaymentType(e.target.value)} className="w-5 h-5 text-blue-600" />
                  <span className="text-gray-700 font-medium">Adiantamento Salarial (Cód. 9)</span>
                </label>
              </div>
            </div>

            {/* Process Button */}
            <div className="flex justify-center">
              <button
                onClick={processFiles}
                disabled={!cadastroFile || !espelhoFile || isProcessing || !isReady}
                className="flex items-center space-x-2 px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isProcessing ? <span>Processando...</span> : !isReady ? <span>Carregando dependências...</span> : (
                  <><span>Processar Folha de Pagamento</span><ArrowRight className="w-5 h-5" /></>
                )}
              </button>
            </div>

            {/* Results Salário */}
            {(processedData.length > 0 || errors.length > 0) && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                {errors.length > 0 && (
                  <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-center space-x-2 text-orange-800 mb-2 font-semibold">
                      <AlertTriangle className="w-5 h-5" />
                      <h3>Avisos e Inconsistências Encontradas ({errors.length})</h3>
                    </div>
                    <ul className="text-sm text-orange-700 space-y-1 list-disc pl-5 max-h-40 overflow-y-auto">
                      {errors.map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                  </div>
                )}

                {processedData.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800">Prévia do Arquivo Gerado</h3>
                        <p className="text-sm text-gray-500">{processedData.length} colaboradores processados.</p>
                      </div>
                      <button onClick={exportToExcel} className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white font-medium rounded-lg shadow hover:bg-green-700">
                        <Download className="w-4 h-4" /><span>Baixar XLSX p/ Banco</span>
                      </button>
                    </div>

                    <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-[500px] overflow-y-auto">
                      <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b sticky top-0">
                          <tr>
                            <th className="px-4 py-3">Agência</th>
                            <th className="px-4 py-3">Conta</th>
                            <th className="px-4 py-3">Dígito</th>
                            <th className="px-4 py-3">Nome</th>
                            <th className="px-4 py-3">CPF</th>
                            <th className="px-4 py-3 text-center">Cód. Pgto</th>
                            <th className="px-4 py-3 text-right">Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {processedData.map((row, i) => (
                            <tr key={i} className="bg-white border-b hover:bg-gray-50">
                              <td className="px-4 py-2 font-mono">{row[0]}</td>
                              <td className="px-4 py-2 font-mono">{row[1]}</td>
                              <td className="px-4 py-2 font-mono">{row[2]}</td>
                              <td className="px-4 py-2 font-medium text-gray-900">{row[3]}</td>
                              <td className="px-4 py-2 font-mono">{row[4]}</td>
                              <td className="px-4 py-2 font-mono font-semibold text-center text-blue-700">{row[5]}</td>
                              <td className="px-4 py-2 text-right text-green-600 font-semibold">
                                {typeof row[6] === 'number' ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row[6]) : row[6]}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="sticky bottom-0 bg-white">
                          <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                            <td colSpan="6" className="px-4 py-3 text-right text-gray-800 uppercase text-xs">Total da Folha:</td>
                            <td className="px-4 py-3 text-right text-green-700 text-base">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalSoma)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================= ABA 2: BENEFÍCIOS (VT/VR) ================= */}
        {activeTab === 'beneficios' && (
          <div className="space-y-6 animate-fade-in w-full">
            
            {/* Calculadora de Período */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 max-w-6xl mx-auto">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center space-x-2">
                <CalendarDays className="w-5 h-5 text-blue-600" />
                <span>Definição do Período (Dias Úteis)</span>
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data Inicial</label>
                  <input 
                    type="date" 
                    value={periodo.start} 
                    onChange={e => setPeriodo({...periodo, start: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data Final</label>
                  <input 
                    type="date" 
                    value={periodo.end} 
                    onChange={e => setPeriodo({...periodo, end: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Qtd. de Feriados no Período</label>
                  <input 
                    type="number" 
                    min="0"
                    value={periodo.feriados} 
                    onChange={e => setPeriodo({...periodo, feriados: e.target.value})}
                    placeholder="Ex: 1"
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor Diário VR (R$)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    value={valorVRDiario} 
                    onChange={e => setValorVRDiario(e.target.value)}
                    placeholder="Ex: 35.50"
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500 font-bold text-blue-800 bg-blue-50"
                  />
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex flex-col items-center justify-center h-[70px]">
                  <span className="text-xs text-blue-600 font-semibold uppercase tracking-wide">Dias Úteis Base</span>
                  <span className="text-2xl font-bold text-blue-800">{diasUteisBase} dias</span>
                </div>
              </div>
            </div>

            {/* Controle de Colaboradores */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 space-y-4 md:space-y-0">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">Controle Individual e Valores</h2>
                  <p className="text-sm text-gray-500">Insira os descontos (gerais ou específicos) e acréscimos para calcular os totais.</p>
                </div>
                
                <div className="flex flex-wrap gap-2 justify-end">
                  <button 
                    onClick={carregarColaboradoresBeneficios}
                    disabled={!cadastroFile || isProcessing}
                    className="px-4 py-2 bg-blue-100 text-blue-700 font-medium rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
                  >
                    Gerar Lista
                  </button>
                  {beneficiosData.length > 0 && (
                    <>
                      <button 
                        onClick={exportBeneficiosToExcel}
                        className="flex items-center space-x-2 px-3 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
                        title="Baixar Tabela de Controle em Excel"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>Relatório Base</span>
                      </button>
                      <button 
                        onClick={exportVTBankFile}
                        className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                        title="Arquivo formatado para pagamento de VT no Itaú"
                      >
                        <Download className="w-4 h-4" />
                        <span>Arquivo Itaú VT</span>
                      </button>
                      <button 
                        onClick={generateReceiptsPDF}
                        className="flex items-center space-x-2 px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                        title="Gerar recibos individuais em PDF para assinatura"
                      >
                        <FileText className="w-4 h-4" />
                        <span>Recibos PDF</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {beneficiosData.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-inner">
                  <div className="text-center p-4 bg-white rounded shadow-sm border border-gray-100 flex flex-col justify-center">
                    <p className="text-[12px] text-gray-500 uppercase font-bold tracking-wider mb-1">Montante Total VT</p>
                    <p className="text-3xl font-bold text-blue-700">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sumTotalVT)}</p>
                  </div>
                  <div className="text-center p-4 bg-white rounded shadow-sm border border-gray-100 flex flex-col justify-center">
                    <p className="text-[12px] text-gray-500 uppercase font-bold tracking-wider mb-1">Montante Total VR (Líq)</p>
                    <p className="text-3xl font-bold text-blue-700">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sumTotalVRLiquido)}</p>
                  </div>
                  <div className="text-center p-4 bg-green-100 rounded-lg border border-green-200 flex flex-col justify-center shadow-sm">
                    <p className="text-[12px] text-green-800 uppercase font-bold tracking-wider mb-1">Total Geral a Pagar</p>
                    <p className="text-4xl font-black text-green-700">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sumTotalGeral)}</p>
                  </div>
                </div>
              )}

              {beneficiosData.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 border border-dashed border-gray-300 rounded-lg max-w-4xl mx-auto">
                  <p className="text-gray-500">Nenhum colaborador carregado.</p>
                  <p className="text-xs text-gray-400 mt-1">Certifique-se de carregar a Planilha Base e clicar em "Gerar Lista".</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-[600px] overflow-y-auto">
                  <table className="w-full text-sm text-left text-gray-600 whitespace-nowrap">
                    <thead className="text-[10px] text-gray-700 uppercase bg-gray-100 border-b sticky top-0 z-10">
                      <tr>
                        <th className="px-2 py-3 w-16 text-center">Matr.</th>
                        <th className="px-2 py-3 min-w-[140px]">Colaborador</th>
                        <th className="px-1 py-3 w-20 text-center">VT Diário<br/>(R$)</th>
                        <th className="px-1 py-3 w-16 text-center text-red-600" title="Desconta de ambos os benefícios">- Faltas/<br/>Ausência</th>
                        <th className="px-1 py-3 w-16 text-center text-orange-600 bg-orange-50/50" title="Desconta APENAS do VT">- Desc.<br/>VT</th>
                        <th className="px-1 py-3 w-16 text-center text-orange-600 bg-orange-50/50" title="Desconta APENAS do VR">- Desc.<br/>VR</th>
                        <th className="px-1 py-3 w-16 text-center text-green-600 bg-green-50/50">+ Acrés.<br/>VT</th>
                        <th className="px-1 py-3 w-16 text-center text-green-600 bg-green-50/50">+ Acrés.<br/>VR</th>
                        <th className="px-2 py-3 w-24 text-right">Total VT</th>
                        <th className="px-2 py-3 w-28 text-right" title="Valor já com desconto de 9%">VR Líquido</th>
                        <th className="px-2 py-3 w-28 text-right font-bold text-green-700">Total Geral</th>
                        <th className="px-2 py-3 min-w-[120px]">Observações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {beneficiosData.map((colab, i) => {
                        const overrides = beneficiosOverrides[colab.matricula] || { ausencias: 0, descontoVT: 0, descontoVR: 0, acrescimosVT: 0, acrescimosVR: 0, obs: '', valorVT: '' };
                        const ausencias = parseInt(overrides.ausencias) || 0;
                        const descontoVT = parseInt(overrides.descontoVT) || 0;
                        const descontoVR = parseInt(overrides.descontoVR) || 0;
                        const acrescimosVT = parseInt(overrides.acrescimosVT) || 0;
                        const acrescimosVR = parseInt(overrides.acrescimosVR) || 0;
                        const valorVT = parseFloat(overrides.valorVT) || 0;
                        
                        // Faltas (ausencias) são descontadas em AMBOS os benefícios.
                        // Descontos específicos são descontados do seu respectivo benefício.
                        const totalDiasVT = Math.max(0, diasUteisBase - ausencias - descontoVT + acrescimosVT);
                        const totalDiasVR = Math.max(0, diasUteisBase - ausencias - descontoVR + acrescimosVR);
                        
                        const totalVT = totalDiasVT * valorVT;
                        
                        const totalVRBruto = totalDiasVR * vrDiarioNumGlobal;
                        const descontoVRTaxa = totalVRBruto * 0.09;
                        const totalVRLiquido = totalVRBruto - descontoVRTaxa;
                        
                        const totalGeral = totalVT + totalVRLiquido;

                        return (
                          <tr key={i} className="bg-white border-b hover:bg-blue-50 transition-colors">
                            <td className="px-2 py-2 font-mono text-gray-500 text-center text-xs">{colab.matricula}</td>
                            <td className="px-2 py-2 font-medium text-gray-900 truncate max-w-[180px]" title={colab.nome}>{colab.nome}</td>
                            <td className="px-1 py-2">
                              <input 
                                type="number" 
                                step="0.01"
                                min="0" 
                                value={overrides.valorVT || ''} 
                                onChange={(e) => updateOverride(colab.matricula, 'valorVT', e.target.value)}
                                className="w-full text-center border border-gray-300 rounded p-1 focus:ring-blue-500 focus:border-blue-500 text-blue-800 font-semibold bg-blue-50 text-xs"
                                placeholder="0.00"
                              />
                            </td>
                            {/* Faltas GERAIS */}
                            <td className="px-1 py-2">
                              <input 
                                type="number" 
                                min="0" 
                                value={overrides.ausencias || ''} 
                                onChange={(e) => updateOverride(colab.matricula, 'ausencias', e.target.value)}
                                className="w-full text-center border border-gray-300 rounded p-1 focus:ring-red-500 focus:border-red-500 text-red-700 font-medium bg-red-50 text-xs"
                                placeholder="0"
                              />
                            </td>
                            {/* DESCONTOS ESPECÍFICOS */}
                            <td className="px-1 py-2 bg-orange-50/30">
                              <input 
                                type="number" 
                                min="0" 
                                value={overrides.descontoVT || ''} 
                                onChange={(e) => updateOverride(colab.matricula, 'descontoVT', e.target.value)}
                                className="w-full text-center border border-gray-300 rounded p-1 focus:ring-orange-500 focus:border-orange-500 text-orange-700 font-medium bg-orange-50 text-xs"
                                placeholder="0"
                              />
                            </td>
                            <td className="px-1 py-2 bg-orange-50/30">
                              <input 
                                type="number" 
                                min="0" 
                                value={overrides.descontoVR || ''} 
                                onChange={(e) => updateOverride(colab.matricula, 'descontoVR', e.target.value)}
                                className="w-full text-center border border-gray-300 rounded p-1 focus:ring-orange-500 focus:border-orange-500 text-orange-700 font-medium bg-orange-50 text-xs"
                                placeholder="0"
                              />
                            </td>
                            {/* ACRÉSCIMOS ESPECÍFICOS */}
                            <td className="px-1 py-2 bg-green-50/30">
                              <input 
                                type="number" 
                                min="0" 
                                value={overrides.acrescimosVT || ''} 
                                onChange={(e) => updateOverride(colab.matricula, 'acrescimosVT', e.target.value)}
                                className="w-full text-center border border-gray-300 rounded p-1 focus:ring-green-500 focus:border-green-500 text-green-700 font-medium bg-green-50 text-xs"
                                placeholder="0"
                              />
                            </td>
                            <td className="px-1 py-2 bg-green-50/30">
                              <input 
                                type="number" 
                                min="0" 
                                value={overrides.acrescimosVR || ''} 
                                onChange={(e) => updateOverride(colab.matricula, 'acrescimosVR', e.target.value)}
                                className="w-full text-center border border-gray-300 rounded p-1 focus:ring-green-500 focus:border-green-500 text-green-700 font-medium bg-green-50 text-xs"
                                placeholder="0"
                              />
                            </td>
                            {/* VALORES TOTAIS */}
                            <td className="px-2 py-2 text-right">
                              <div className="flex flex-col items-end">
                                <span className="font-semibold text-blue-700">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalVT)}</span>
                                <span className="text-[10px] text-gray-400 font-normal">({totalDiasVT}d)</span>
                              </div>
                            </td>
                            <td className="px-2 py-2 text-right">
                              <div className="flex flex-col items-end">
                                <span className="font-semibold text-blue-700">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalVRLiquido)}</span>
                                <span className="text-[10px] text-gray-400 font-normal">({totalDiasVR}d) -9%: {descontoVRTaxa.toFixed(2)}</span>
                              </div>
                            </td>
                            <td className="px-2 py-2 text-right bg-green-50/50">
                              <span className="font-bold text-green-700 block mt-1">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalGeral)}</span>
                            </td>
                            <td className="px-2 py-2">
                              <input 
                                type="text" 
                                value={overrides.obs || ''} 
                                onChange={(e) => updateOverride(colab.matricula, 'obs', e.target.value)}
                                className="w-full border border-gray-300 rounded p-1.5 focus:ring-blue-500 focus:border-blue-500 text-xs"
                                placeholder="Obs..."
                              />
                            </td>
                          </tr>
                        );
                      })}
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