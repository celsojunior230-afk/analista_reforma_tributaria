/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UploadCloud, 
  Coins, 
  TrendingUp, 
  ShieldCheck, 
  Sparkles, 
  Settings, 
  LogOut, 
  Search, 
  Trash2, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  Printer, 
  Download, 
  FolderOpen, 
  FileText, 
  Globe, 
  BadgeAlert,
  Loader2,
  Lock,
  ChevronRight,
  Database
} from 'lucide-react';
import { useFiscalStore } from './application/store/useFiscalStore';
import { useAiStore } from './application/store/useAiStore';
import { TaxAnalyzerService } from './application/services/TaxAnalyzerService';
import { AiContextService } from './application/services/AiContextService';
import { MockDataService } from './application/services/MockDataService';

// Recharts components
import {
  ComposedChart,
  AreaChart,
  BarChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Helper for formatting BRL currency
const formatBRL = (val: number) => {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Helper to format CNPJ / CPF
const formatCNPJ = (val: string) => {
  const clean = val.replace(/\D/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return val;
};

export default function App() {
  const { 
    documents, 
    referenceCnpj, 
    isLoading: isFiscalLoading, 
    errors: fiscalErrors, 
    setReferenceCnpj, 
    clearDocuments, 
    processFiles,
    simulationMode,
    simulationIbsRate,
    simulationCbsRate,
    setSimulationMode,
    setSimulationIbsRate,
    setSimulationCbsRate
  } = useFiscalStore();

  const {
    selectedModel,
    preparedBy,
    logoBase64,
    history,
    setSelectedModel,
    setPreparedBy,
    setLogoBase64,
    addHistoryEntry,
    clearHistory
  } = useAiStore();

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authEmail, setAuthEmail] = useState<string>('celsojunior230@gmail.com');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);

  // Active Navigation Tab
  // 'upload' | 'apuracao' | 'temporal' | 'conformidade' | 'ai' | 'config'
  const [activeTab, setActiveTab] = useState<string>('upload');

  // Input CNPJ manually state
  const [manualCnpj, setManualCnpj] = useState<string>('');

  // Search inside tabular lists
  const [docSearch, setDocSearch] = useState<string>('');
  
  // Tabular files pagination
  const [docPage, setDocPage] = useState<number>(1);
  const [docPageSize, setDocPageSize] = useState<number>(15);
  
  // Temporal period mode
  const [temporalMode, setTemporalMode] = useState<'monthly' | 'quarterly'>('monthly');

  // Server side API key configured status
  const [apiKeyConfigured, setApiKeyConfigured] = useState<boolean>(true);

  // AI Dossiê parameters
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);
  const [aiStep, setAiStep] = useState<string>('');
  const [aiTimer, setAiTimer] = useState<number>(0);
  const [aiReportText, setAiReportText] = useState<string>('');
  const [aiError, setAiError] = useState<string>('');

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check if server-side Gemini key is ready
    fetch('/api/ai/status')
      .then(r => r.json())
      .then(d => setApiKeyConfigured(d.configured))
      .catch(() => setApiKeyConfigured(false));
  }, []);

  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthenticating(true);

    setTimeout(() => {
      if (!authEmail.includes('@') || authPassword.length < 4) {
        setAuthError('E-mail inválido ou senha muito curta (mínimo 4 caracteres).');
        setIsAuthenticating(false);
      } else {
        setIsAuthenticated(true);
        setIsAuthenticating(false);
      }
    }, 700);
  };

  const handleQuickPass = () => {
    setIsAuthenticating(true);
    setAuthEmail('celsojunior230@gmail.com');
    setTimeout(() => {
      setIsAuthenticated(true);
      setIsAuthenticating(false);
    }, 500);
  };

  const handleLogOut = () => {
    setIsAuthenticated(false);
    setAuthPassword('');
  };

  const handleLoadDemoData = () => {
    const demoCnpj = '03124567000189';
    setReferenceCnpj(demoCnpj);
    
    // Clear and process mock documents
    // Simulate processFiles internally to mock store
    const mockDocs = MockDataService.getMockDocuments(demoCnpj);
    // Overwrite the store's documents directly
    useFiscalStore.setState({ 
      documents: mockDocs, 
      referenceCnpj: demoCnpj, 
      errors: [] 
    });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) {
        alert('O tamanho do logotipo não deve exceder 500KB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Drag and drop for XML processing
  const handleFileDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files);
      await processFiles(filesArray);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      await processFiles(filesArray);
    }
  };

  // Compile calculations
  const apuracao = TaxAnalyzerService.calculateApuracao(documents, referenceCnpj, simulationMode, simulationIbsRate, simulationCbsRate);
  const inconformes = TaxAnalyzerService.getInconformes(documents, referenceCnpj, simulationMode);
  const cfopsReport = TaxAnalyzerService.groupByCfop(documents, referenceCnpj, simulationMode, simulationIbsRate, simulationCbsRate);
  const temporalReport = TaxAnalyzerService.groupByTemporal(documents, referenceCnpj, temporalMode, simulationMode, simulationIbsRate, simulationCbsRate);
  const highlights = TaxAnalyzerService.getTemporalHighlights(temporalReport);

  // Filter documents in tabular overview
  const filteredDocs = documents.filter(doc => {
    const search = docSearch.toLowerCase();
    return (
      doc.access_key.toLowerCase().includes(search) ||
      doc.issuer.name.toLowerCase().includes(search) ||
      doc.receiver.name.toLowerCase().includes(search) ||
      doc.document_type.toLowerCase().includes(search)
    );
  });

  // Extrai todos os CNPJs de parceiros (emitente e destinatário) mapeados nos documentos carregados
  const detectedCnpjs = useMemo(() => {
    const map = new Map<string, { cnpj: string; name: string; count: number }>();
    documents.forEach(doc => {
      const emit = doc.issuer;
      const dest = doc.receiver;
      if (emit.cnpj_cpf && emit.cnpj_cpf !== 'CONSUMIDOR_FINAL') {
        const clean = emit.cnpj_cpf.replace(/\D/g, '');
        if (clean.length === 14) { // garante que é CNPJ
          const existing = map.get(clean) || { cnpj: emit.cnpj_cpf, name: emit.name, count: 0 };
          existing.count++;
          map.set(clean, existing);
        }
      }
      if (dest.cnpj_cpf && dest.cnpj_cpf !== 'CONSUMIDOR_FINAL') {
        const clean = dest.cnpj_cpf.replace(/\D/g, '');
        if (clean.length === 14) { // garante que é CNPJ
          const existing = map.get(clean) || { cnpj: dest.cnpj_cpf, name: dest.name, count: 0 };
          existing.count++;
          map.set(clean, existing);
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [documents]);

  // IA Generation Engine
  const generateReportWithIa = async () => {
    if (documents.length === 0) {
      alert('Carregue ou processed documentos fiscais antes de ativar a IA.');
      return;
    }

    setIsAiGenerating(true);
    setAiReportText('');
    setAiError('');
    setAiTimer(0);

    const steps = [
      'Compilando metadados tributários...',
      'Filtrando dados sensíveis e auditorando privacidade...',
      'Detectando perfis competitivos da empresa...',
      'Medindo mixes B2B vs B2C locais...',
      'Analisando inconsistências logísticas e de CFOP...',
      'Conectando ao núcleo de IA do Gemini...',
      'Orquestrando relatórios de transição da Lei Complementar 214/2025...',
      'Generando relatórios de impacto competitivo de Simples Nacional...',
      'Finalizando formatação tributária...',
    ];

    let currentStep = 0;
    setAiStep(steps[currentStep]);

    // Timer setup
    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed++;
      setAiTimer(elapsed);
      if (elapsed % 4 === 0 && currentStep < steps.length - 1) {
        currentStep++;
        setAiStep(steps[currentStep]);
      }
    }, 1000);

    // Prepare Anonymized Context
    const aiContext = AiContextService.buildAiContext(documents, referenceCnpj);

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          context: aiContext,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.error || 'Erro na comunicação com a API de IA.');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');

      if (!reader) {
        throw new Error('Streaming de resposta indisponível.');
      }

      setAiStep('Streaming do Dossiê recebido em tempo real...');

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // SSE buffer parser split by double newlines \n\n
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // keep trailing incomplete chunk in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') {
              continue;
            }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) {
                setAiReportText(prev => prev + parsed.text);
              } else if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (err) {
              // Ignore non-json or intermediate chunk parsing errors
            }
          }
        }
      }

      // Finish Timer
      if (timerRef.current) clearInterval(timerRef.current);
      setAiStep('Dossiê Tributário compilado com sucesso!');

      // Save to History store
      addHistoryEntry({
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR'),
        conclusions: `Posição líquida: ${formatBRL(apuracao.saldo)}. ${apuracao.saldo >= 0 ? 'Credora' : 'Devedora'}.`,
        period: aiContext.period,
        volumes: { total: documents.length },
      });

    } catch (e: any) {
      if (timerRef.current) clearInterval(timerRef.current);
      setAiError(e.message || 'Falha catastrófica ao processar IA.');
    } finally {
      setIsAiGenerating(false);
    }
  };

  const printReport = () => {
    window.print();
  };

  const downloadReportHtml = () => {
    if (!aiReportText) return;

    // Build fully styled autocontained document
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Dossiê Tributário Simples Apuração RTC</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #333333;
      line-height: 1.6;
      padding: 40px;
      max-width: 900px;
      margin: 0 auto;
      background: #fafafb;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #1f2937;
      padding-bottom: 20px;
      margin-bottom: 40px;
    }
    .logo-container img {
      max-height: 70px;
    }
    .brand-name {
      font-size: 24px;
      font-weight: bold;
      color: #1f2937;
    }
    .doc-meta {
      text-align: right;
      font-size: 14px;
      color: #6b7280;
    }
    h1, h2, h3 {
      color: #1f2937;
      margin-top: 30px;
    }
    h1 {
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 10px;
      font-size: 28px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      border: 1px solid #e5e7eb;
      padding: 12px;
      text-align: left;
    }
    th {
      background: #f3f4f6;
      font-weight: 600;
    }
    tr:nth-child(even) {
      background: #f9fafb;
    }
    .footer {
      border-top: 1px solid #e5e7eb;
      margin-top: 50px;
      padding-top: 20px;
      font-size: 12px;
      color: #9ca3af;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" style="max-height:70px;">` : `<div class="brand-name">Simples Apuração RTC</div>`}
    </div>
    <div class="doc-meta">
      <strong>Preparado por:</strong> ${preparedBy}<br>
      <strong>Data de geração:</strong> ${new Date().toLocaleDateString('pt-BR')}<br>
      <strong>Empresa analisada CNPJ:</strong> ${formatCNPJ(referenceCnpj)}
    </div>
  </div>
  
  <div class="report-content">
    <!-- Render raw markdown to plain text paragraphs fallback or browser native reader -->
    ${aiReportText.split('\n').map(p => {
      if (p.startsWith('# ')) return `<h1>${p.replace('# ', '')}</h1>`;
      if (p.startsWith('## ')) return `<h2>${p.replace('## ', '')}</h2>`;
      if (p.startsWith('### ')) return `<h3>${p.replace('### ', '')}</h3>`;
      if (p.startsWith('|') && p.endsWith('|')) {
        // Simple line parser fallback for tables
        return `<pre style="background:#f3f4f6;padding:10px;border-radius:4px;overflow-x:auto;">${p}</pre>`;
      }
      return `<p>${p}</p>`;
    }).join('\n')}
  </div>

  <div class="footer">
    Relatório emitido pela Inteligência Artificial do Simples Apuração RTC sob conformidade da Lei Complementar 214/2025.
  </div>
</body>
</html>
`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dossie_tributario_${referenceCnpj || 'empresa'}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#030712] relative flex flex-col items-center justify-center p-4 overflow-hidden font-sans">
        {/* Glow ambient panels */}
        <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="w-full max-w-md glass-card rounded-2xl border border-white/5 p-8 relative cyber-panel-glow">
          {/* Cyan/indigo header border glow */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-400 via-indigo-500 to-rose-400 rounded-t-2xl" />

          <div className="text-center mb-8">
            <div className="inline-flex py-2 px-4 rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-mono font-bold tracking-widest uppercase mb-4 border border-cyan-500/25">
              TRANSITION SECURITY MODULE v3
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
              Simples Apuração <span className="text-cyan-400 font-extrabold uppercase">RTC</span>
            </h1>
            <p className="text-gray-400 text-sm">
              Análise estratégica e apuração tributária de IBS/CBS focado na Reforma Tributária LC 214/2025
            </p>
          </div>

          {authError && (
            <div className="mb-6 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleManualLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">E-mail de Acesso</label>
              <input 
                type="email" 
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full bg-[#080d19] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all font-mono"
                placeholder="nome@empresa.com"
                required
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">Senha Críptica</label>
              </div>
              <input 
                type="password" 
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full bg-[#080d19] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all font-mono"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-900 border border-cyan-400/30 rounded-xl py-3.5 text-sm font-semibold text-white cursor-pointer relative overflow-hidden transition-all flex items-center justify-center gap-2 mt-6 active:scale-[0.98]"
            >
              {isAuthenticating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Autenticando credenciais...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Entrar com Segurança</span>
                </>
              )}
            </button>
          </form>

          <div className="relative my-6 text-center">
            <span className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t border-white/5" />
            <span className="relative bg-[#0b0f1a] px-3 text-[10px] font-mono uppercase tracking-wider text-gray-500">Ou use o passaporte rápido</span>
          </div>

          <button
            type="button"
            onClick={handleQuickPass}
            className="w-full bg-[#0b1528] hover:bg-[#101d36] border border-cyan-500/20 text-cyan-400 font-semibold py-3 px-4 rounded-xl text-xs uppercase tracking-widest cursor-pointer transition-all flex items-center justify-center gap-2 hover:border-cyan-400/50"
          >
            <Database className="w-4 h-4" />
            <span>Quick-Pass de Demonstração</span>
          </button>
        </div>

        <div className="mt-8 text-center text-[10px] font-mono text-gray-600 uppercase tracking-widest">
          SECURE ENCRYPTED TERMINAL ENTRY • 256-BIT
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030712] text-gray-200 flex flex-col md:flex-row antialiased font-sans">
      {/* SIDEBAR NAVIGATION - Cyber Slate Style */}
      <aside className="w-full md:w-64 bg-[#080d19] md:min-h-screen border-b md:border-b-0 md:border-r border-white/5 flex flex-col justify-between shrink-0 font-sans">
        <div>
          {/* Brand header */}
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-sm tracking-tight shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                RTC
              </div>
              <div>
                <div role="heading" aria-level={2} className="text-white text-sm font-bold tracking-tight">Simples Apuração</div>
                <div className="text-[10px] text-cyan-400 font-mono tracking-wider font-semibold uppercase">Reforma Tributária</div>
              </div>
            </div>
          </div>

          {/* Nav menu links */}
          <nav className="p-4 space-y-1">
            <button
              onClick={() => setActiveTab('upload')}
              className={`w-full text-left font-medium text-xs px-4 py-3 rounded-lg transition-all flex items-center justify-between cursor-pointer ${
                activeTab === 'upload' 
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <UploadCloud className="w-4 h-4" />
                <span>Upload de XMLs & ZIP</span>
              </div>
              <div className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500">
                {documents.length}
              </div>
            </button>

            <button
              onClick={() => setActiveTab('apuracao')}
              disabled={documents.length === 0}
              className={`w-full text-left font-medium text-xs px-4 py-3 rounded-lg transition-all flex items-center justify-between cursor-pointer ${
                documents.length === 0 ? 'opacity-30 cursor-not-allowed' : ''
              } ${
                activeTab === 'apuracao' 
                  ? 'bg-gradient-to-r from-cyan-500/10 to-indigo-500/10 text-cyan-400 border border-cyan-500/20 font-bold' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <Coins className="w-4 h-4" />
                <span>Apuração IBS/CBS</span>
              </div>
              {documents.length > 0 && (
                <div className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-cyan-400/10 text-cyan-400">
                  KPIs
                </div>
              )}
            </button>

            <button
              onClick={() => setActiveTab('temporal')}
              disabled={documents.length === 0}
              className={`w-full text-left font-medium text-xs px-4 py-3 rounded-lg transition-all flex items-center justify-between cursor-pointer ${
                documents.length === 0 ? 'opacity-30 cursor-not-allowed' : ''
              } ${
                activeTab === 'temporal' 
                  ? 'bg-[#4f46e5]/10 text-indigo-400 border border-indigo-500/20 font-bold' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <TrendingUp className="w-4 h-4" />
                <span>Análise Temporal</span>
              </div>
              {documents.length > 0 && (
                <div className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-indigo-400/10 text-indigo-400">
                  {temporalReport.length}M
                </div>
              )}
            </button>

            <button
              onClick={() => setActiveTab('conformidade')}
              disabled={documents.length === 0}
              className={`w-full text-left font-medium text-xs px-4 py-3 rounded-lg transition-all flex items-center justify-between cursor-pointer ${
                documents.length === 0 ? 'opacity-30 cursor-not-allowed' : ''
              } ${
                activeTab === 'conformidade' 
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4" />
                <span>Auditoria de Conformidade</span>
              </div>
              {inconformes.length > 0 && (
                <div className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-rose-400/10 text-rose-400">
                  {inconformes.length}!
                </div>
              )}
            </button>

            <button
              onClick={() => setActiveTab('ai')}
              disabled={documents.length === 0}
              className={`w-full text-left font-medium text-xs px-4 py-3 rounded-lg transition-all flex items-center justify-between cursor-pointer ${
                documents.length === 0 ? 'opacity-30 cursor-not-allowed' : ''
              } ${
                activeTab === 'ai' 
                  ? 'bg-[#8b5cf6]/10 text-purple-400 border border-purple-500/20 font-bold' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-purple-300 font-semibold">Dossiê Tributário (IA)</span>
              </div>
              <span className="font-mono text-[8px] bg-purple-500 text-white rounded-full px-1.5 py-0.5 font-bold uppercase shrink-0">Gemini</span>
            </button>

            <button
              onClick={() => setActiveTab('config')}
              className={`w-full text-left font-medium text-xs px-4 py-3 rounded-lg transition-all flex items-center gap-3 cursor-pointer ${
                activeTab === 'config' 
                  ? 'bg-[#1f2937] text-white border border-white/10 font-bold' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Configurações</span>
            </button>
          </nav>
        </div>

        {/* User logout and active CNPJ info */}
        <div className="p-4 border-t border-white/5 space-y-4">
          {referenceCnpj ? (
            <div className="p-3 bg-[#0d1527]/60 rounded-xl border border-cyan-500/15 relative overflow-hidden space-y-2">
              <span className="absolute top-0 right-0 w-[50px] h-[50px] bg-cyan-500/5 rounded-full blur-xl" />
              <div className="text-[10px] font-mono text-gray-400 uppercase tracking-widest leading-none mb-1">Empresa Ativa</div>
              <div className="text-xs font-mono font-bold text-cyan-400 tracking-tight select-all leading-normal">
                {formatCNPJ(referenceCnpj)}
              </div>
              
              {detectedCnpjs.length > 1 && (
                <div className="pt-2 space-y-1 border-t border-white/5">
                  <label className="text-[9px] text-gray-500 uppercase tracking-wider block font-semibold">Alterar Empresa Ativa:</label>
                  <select
                    value={referenceCnpj.replace(/\D/g, '')}
                    onChange={(e) => setReferenceCnpj(e.target.value)}
                    className="w-full bg-[#080d19] border border-white/10 rounded-lg p-1.5 text-[10px] font-mono text-gray-300 focus:outline-none focus:border-cyan-500/50"
                  >
                    {detectedCnpjs.map((opt) => (
                      <option key={opt.cnpj} value={opt.cnpj.replace(/\D/g, '')}>
                        {opt.name.substring(0, 16)}... ({opt.count}x)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ) : documents.length > 0 && (
            <div className="p-3 bg-rose-500/5 rounded-xl border border-rose-500/20 text-xs space-y-2.5">
              <span className="text-rose-400 font-medium block">Nenhuma empresa mapeada como ativa. Selecione a sua abaixo para ativar as apurações:</span>
              <select
                onChange={(e) => setReferenceCnpj(e.target.value)}
                className="w-full bg-[#080d19] border border-white/10 rounded-lg p-1.5 text-[10px] font-mono text-white focus:outline-none focus:border-rose-500/50"
                defaultValue=""
              >
                <option value="" disabled>Selecione...</option>
                {detectedCnpjs.map((opt) => (
                  <option key={opt.cnpj} value={opt.cnpj.replace(/\D/g, '')}>
                    {opt.name.substring(0, 20)} ({opt.count} Faturas)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-xs truncate max-w-[140px]">
              <span className="block text-gray-500 text-[10px] uppercase font-semibold">Conectado</span>
              <span className="font-mono text-white/80 font-medium">{authEmail}</span>
            </div>
            <button
              onClick={handleLogOut}
              className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg cursor-pointer transition-all active:scale-[0.95]"
              title="Encerrar Sessão"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* DASHBOARD CORE VIEWPORT */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* UPPER PANEL: Info and stats */}
        <header className="h-16 px-6 md:px-8 border-b border-white/5 bg-[#080d19]/80 backdrop-blur-xl flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-3">
            {logoBase64 ? (
              <img src={logoBase64} alt="Company Logo" className="max-h-8 object-contain" />
            ) : (
              <h2 className="text-base font-bold text-white tracking-wide uppercase">SIMPLES APURAÇÃO RTC</h2>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Live indicator tag */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/25 rounded-full text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Transição Ativa 2026+
            </div>

            {documents.length > 0 && (
              <div className="hidden sm:block text-right">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider block">Saldo Líquido</span>
                <span className={`text-sm font-mono font-bold ${apuracao.saldo >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
                  {formatBRL(apuracao.saldo)}
                </span>
              </div>
            )}
          </div>
        </header>

        {/* CONTAINER FRAME */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 min-h-0">
          <AnimatePresence mode="wait">
            
            {/* TAB-1: UPLOAD ZONE */}
            {activeTab === 'upload' && (
              <motion.div
                key="tab-upload"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight leading-normal">Repositório de XMLs</h1>
                  <p className="text-gray-400 text-xs">Arraste seus XMLs de NF-e, NFC-e, CT-e e NFS-e, ou jogue o pacote ZIP diretamente. O parsing ocorre de forma segura localmente no seu navegador.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Upload action area */}
                  <div className="lg:col-span-2 space-y-6">
                    <div 
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleFileDrop}
                      className="border border-dashed border-white/10 hover:border-cyan-500/50 bg-[#080d19]/40 hover:bg-[#080d19]/60 rounded-2xl p-10 cursor-pointer text-center relative overflow-hidden transition-all group flex flex-col items-center justify-center min-h-[300px]"
                    >
                      <input 
                        type="file" 
                        multiple 
                        accept=".xml,.zip" 
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        id="file-input"
                      />
                      
                      <div className="w-14 h-14 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-4 border border-cyan-500/20 group-hover:scale-105 group-hover:bg-cyan-500/15 transition-all shadow-[0_0_15px_rgba(6,182,212,0.05)]">
                        <UploadCloud className="w-6 h-6 animate-pulse" />
                      </div>

                      <h3 className="text-white font-semibold text-sm mb-2 leading-none">Arraste ou selecione arquivos</h3>
                      <p className="text-gray-400 text-xs max-w-sm mb-6 leading-normal">
                        Suporta arquivos estruturados de NF-e (mod 55), NFC-e (mod 65), CT-e (v3.0) e NFS-e unificada nacional. Formatos de lotes .zip são descompactados instantaneamente.
                      </p>

                      <div className="flex gap-3">
                        <label htmlFor="file-input" className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 border border-cyan-400/30 text-xs font-semibold text-white pointer-events-none transition-all cursor-pointer">
                          Procurar Arquivos
                        </label>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLoadDemoData();
                          }}
                          className="px-4 py-2 rounded-xl bg-[#0e1628] hover:bg-[#16233d] border border-cyan-500/25 text-xs font-semibold text-cyan-400 cursor-pointer transition-all flex items-center gap-1.5 hover:border-cyan-400/50"
                        >
                          <Database className="w-3.5 h-3.5" />
                          <span>Carregar Empresa Beta (Demo)</span>
                        </button>
                      </div>
                    </div>

                    {/* Progress indicator */}
                    {isFiscalLoading && (
                      <div className="p-4 bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 rounded-xl flex items-center gap-3">
                        <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                        <span className="text-xs">Processando pacote XML - Convertendo estruturas e extraindo tokens tributários no browser...</span>
                      </div>
                    )}

                    {/* Processing failures */}
                    {fiscalErrors.length > 0 && (
                      <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 space-y-2">
                        <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>Informes de Irregularidade de Carga ({fiscalErrors.length}):</span>
                        </div>
                        <ul className="text-[10px] text-gray-400 font-mono max-h-[120px] overflow-y-auto space-y-1 pl-4 list-disc">
                          {fiscalErrors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Document stats summaries */}
                  <div className="space-y-6">
                    <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-4">
                      <h3 className="text-white text-xs font-bold uppercase tracking-wider mb-2">Composição da Carga</h3>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-[#0c1221] rounded-xl border border-white/5">
                          <span className="text-[10px] text-gray-500 uppercase font-semibold">Documentos</span>
                          <span className="block text-2xl font-bold font-mono text-white mt-1 leading-none">{documents.length}</span>
                        </div>
                        <div className="p-3 bg-[#0c1221] rounded-xl border border-white/5">
                          <span className="text-[10px] text-gray-500 uppercase font-semibold">Valor Total</span>
                          <span className="block text-sm font-bold font-mono text-cyan-400 mt-1.5 leading-none">
                            {formatBRL(documents.reduce((acc, curr) => acc + curr.total_value, 0))}
                          </span>
                        </div>
                      </div>

                      {documents.length > 0 ? (
                        <div className="space-y-2.5 pt-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-400">NF-e (Produto):</span>
                            <span className="font-mono text-white font-bold">{documents.filter(d => d.document_type === 'NFE').length}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-400">NFC-e (Consumidor):</span>
                            <span className="font-mono text-white font-bold">{documents.filter(d => d.document_type === 'NFCE').length}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-400">CT-e (Transporte):</span>
                            <span className="font-mono text-white font-bold">{documents.filter(d => d.document_type === 'CTE').length}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-400">NFS-e (Serviço):</span>
                            <span className="font-mono text-white font-bold">{documents.filter(d => d.document_type === 'NFSE').length}</span>
                          </div>
                          <button
                            onClick={clearDocuments}
                            className="w-full mt-4 py-2 border border-rose-500/20 hover:border-rose-500/50 text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 transition-all font-semibold rounded-xl text-xs cursor-pointer active:scale-95"
                          >
                            Remover Todos os Documentos
                          </button>
                        </div>
                      ) : (
                        <div className="text-center py-6 text-xs text-gray-500 font-mono uppercase tracking-widest pl-2">
                          Mix vazio — insira ou carregue demonstrações
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tabular data overview */}
                {documents.length > 0 && (
                  <div className="glass-card rounded-2xl border border-white/5 p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <h3 className="text-sm font-semibold text-white tracking-normal leading-normal">Mapeamento de Operações Digitadas</h3>
                      
                      {/* Search inputs */}
                      <div className="relative max-w-sm w-full">
                        <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input 
                          type="text" 
                          placeholder="Filtrar por Emitente, CNPJ, Tipo..."
                          value={docSearch}
                          onChange={(e) => setDocSearch(e.target.value)}
                          className="w-full bg-[#080d19] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                        />
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-white/5 bg-[#080d19]/20">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 bg-[#080d19]/60 text-gray-400 font-medium">
                            <th className="p-3">Data</th>
                            <th className="p-3">Tipo</th>
                            <th className="p-3">Remetente (Issuer)</th>
                            <th className="p-3">Destinatário (Receiver)</th>
                            <th className="p-3">Sentido</th>
                            <th className="p-3 text-right">Valor Bruto</th>
                            <th className="p-3 text-right">IBS</th>
                            <th className="p-3 text-right">CBS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 font-mono">
                          {filteredDocs.slice((docPage - 1) * docPageSize, docPage * docPageSize).map((doc) => {
                            const enriched = TaxAnalyzerService.enrichDocument(doc, referenceCnpj, simulationMode, simulationIbsRate, simulationCbsRate);
                            return (
                              <tr key={doc.access_key} className="hover:bg-white/[0.02] transition-colors">
                                <td className="p-3 whitespace-nowrap text-gray-400">
                                  {doc.issue_date.substring(0, 10)}
                                </td>
                                <td className="p-3">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    doc.document_type === 'NFE' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                                    doc.document_type === 'CTE' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                                    doc.document_type === 'NFSE' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                                    'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  }`}>
                                    {doc.document_type}
                                  </span>
                                </td>
                                <td className="p-3 font-sans max-w-[150px] truncate" title={doc.issuer.name}>
                                  {doc.issuer.name}
                                </td>
                                <td className="p-3 font-sans max-w-[150px] truncate" title={doc.receiver.name}>
                                  {doc.receiver.name}
                                </td>
                                <td className="p-3 text-gray-300">
                                  {enriched.direction === 'INBOUND' ? (
                                    <span className="text-emerald-400">Entrada</span>
                                  ) : enriched.direction === 'OUTBOUND' ? (
                                    <span className="text-cyan-400 font-semibold">Saída</span>
                                  ) : (
                                    <span className="text-gray-500">Externo</span>
                                  )}
                                </td>
                                <td className="p-3 text-right text-white font-medium">
                                  {formatBRL(doc.total_value)}
                                </td>
                                <td className="p-3 text-right text-cyan-400 font-medium">
                                  {enriched.totals.vIBS ? formatBRL(enriched.totals.vIBS) : '-'}
                                </td>
                                <td className="p-3 text-right text-indigo-400 font-medium">
                                  {enriched.totals.vCBS ? formatBRL(enriched.totals.vCBS) : '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Controls de Paginação */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-white/5 text-gray-400 text-xs">
                      <div className="flex items-center gap-2">
                        <span>Exibindo de</span>
                        <span className="font-semibold text-white font-mono">
                          {Math.min((docPage - 1) * docPageSize + 1, filteredDocs.length)}
                        </span>
                        <span>a</span>
                        <span className="font-semibold text-white font-mono">
                          {Math.min(docPage * docPageSize, filteredDocs.length)}
                        </span>
                        <span>de</span>
                        <span className="font-semibold text-white font-mono">{filteredDocs.length}</span>
                        <span>documentos</span>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Itens p/ página:</span>
                          <select
                            value={docPageSize}
                            onChange={(e) => {
                              setDocPageSize(Number(e.target.value));
                              setDocPage(1); // reseta para a primeira página
                            }}
                            className="bg-[#080d19] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                          >
                            <option value={15}>15</option>
                            <option value={30}>30</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                          </select>
                        </div>

                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          <button
                            disabled={docPage === 1}
                            onClick={() => setDocPage(prev => Math.max(prev - 1, 1))}
                            className="py-1 px-3.5 rounded bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-white/20 disabled:opacity-30 disabled:hover:bg-white/5 disabled:hover:border-white/10 cursor-pointer disabled:cursor-not-allowed transition-all"
                          >
                            &lt; Anterior
                          </button>
                          <span className="px-1 text-gray-300">
                            {docPage} / {Math.ceil(filteredDocs.length / docPageSize) || 1}
                          </span>
                          <button
                            disabled={docPage >= Math.ceil(filteredDocs.length / docPageSize)}
                            onClick={() => setDocPage(prev => Math.min(prev + 1, Math.ceil(filteredDocs.length / docPageSize)))}
                            className="py-1 px-3.5 rounded bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-white/20 disabled:opacity-30 disabled:hover:bg-white/5 disabled:hover:border-white/10 cursor-pointer disabled:cursor-not-allowed transition-all"
                          >
                            Próxima &gt;
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* TAB-2: APURACAO DETALHADA */}
            {activeTab === 'apuracao' && (
              <motion.div
                key="tab-apuracao"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-8"
              >
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight leading-normal">Apuração Operacional IBS/CBS</h1>
                  <p className="text-gray-400 text-xs">Indicadores de transição da Reforma Tributária. Compara créditos obtidos nas entradas com os débitos nas vendas.</p>
                </div>

                {simulationMode && (
                  <div className="p-4 bg-[#0a152d]/40 border border-cyan-500/15 rounded-2xl flex items-start gap-4">
                    <span className="p-2 py-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg text-[10px] font-mono font-bold leading-none select-none">SIMULADOR</span>
                    <div className="space-y-1">
                      <h4 className="text-white text-xs font-bold leading-none">Projeção e Estimativas de Transição da Reforma Tributária Cooperando</h4>
                      <p className="text-gray-400 text-[11px] font-sans leading-relaxed">
                        Como as notas fiscais carregadas representam operações reais cotidianas sem tags fiscais da transição pós-2026, o simulador projeta e estima as alíquotas de <span className="font-semibold text-cyan-400 font-mono">{simulationIbsRate.toFixed(1)}% de IBS</span> e <span className="font-semibold text-indigo-400 font-mono">{simulationCbsRate.toFixed(1)}% de CBS</span> sobre o valor líquido para calcular os débitos fiscais de faturamento e créditos de compras.
                      </p>
                    </div>
                  </div>
                )}

                {/* KPI Panels Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Credits */}
                  <div className="glass-card rounded-2xl p-6 border border-emerald-500/10 relative overflow-hidden credit-glow">
                    <span className="absolute top-0 right-0 w-[80px] h-[80px] bg-emerald-500/5 rounded-full blur-2xl" />
                    <div className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest font-bold leading-none mb-1">Créditos de Entrada</div>
                    <div className="text-2xl font-bold font-mono text-emerald-400 tracking-tight leading-none my-2">
                      {formatBRL(apuracao.credits)}
                    </div>
                    <div className="text-[11px] text-gray-400 font-medium">
                      Alíquota Média de Entrada:{' '}
                      <span className="font-mono text-emerald-400 font-bold">{apuracao.creditRate.toFixed(2)}%</span>
                    </div>
                  </div>

                  {/* Debits */}
                  <div className="glass-card rounded-2xl p-6 border border-rose-500/10 relative overflow-hidden debit-glow">
                    <span className="absolute top-0 right-0 w-[80px] h-[80px] bg-rose-500/5 rounded-full blur-2xl" />
                    <div className="text-[10px] font-mono text-rose-500 uppercase tracking-widest font-bold leading-none mb-1">Débitos de Saída</div>
                    <div className="text-2xl font-bold font-mono text-rose-500 tracking-tight leading-none my-2">
                      {formatBRL(apuracao.debits)}
                    </div>
                    <div className="text-[11px] text-gray-400 font-medium">
                      Alíquota Média de Saída:{' '}
                      <span className="font-mono text-rose-400 font-bold">{apuracao.debitRate.toFixed(2)}%</span>
                    </div>
                  </div>

                  {/* Saldo RTC (Credits - Debits) */}
                  <div className={`glass-card rounded-2xl p-6 border relative overflow-hidden ${
                    apuracao.saldo >= 0 ? 'border-cyan-500/20' : 'border-rose-500/20'
                  }`}>
                    <span className="absolute top-0 right-0 w-[80px] h-[80px] bg-cyan-500/5 rounded-full blur-2xl" />
                    <div className="text-[10px] font-mono text-gray-400 uppercase tracking-widest font-bold leading-none mb-1">Saldo Liquidado RTC</div>
                    <div className={`text-2xl font-bold font-mono tracking-tight leading-none my-2 ${
                      apuracao.saldo >= 0 ? 'text-cyan-400' : 'text-rose-400'
                    }`}>
                      {formatBRL(apuracao.saldo)}
                    </div>
                    <div className="text-[11px] text-gray-400">
                      Peso Real Líquido s/ Saídas:{' '}
                      <span className="font-mono font-bold text-gray-200">{apuracao.balanceRate.toFixed(2)}%</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Recharts: CFOP volume and impacts */}
                  <div className="glass-card rounded-2xl border border-white/5 p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-white tracking-normal leading-normal">Carga Fiscal por CFOP de Operação</h3>
                    
                    <div className="h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={cfopsReport.slice(0, 6)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                          <XAxis dataKey="cfop" stroke="#9ca3af" fontSize={11} fontStyle="mono" />
                          <YAxis stroke="#9ca3af" fontSize={10} />
                          <Tooltip 
                            contentStyle={{ background: '#0b1329', borderColor: '#3b82f6', color: '#fff', fontStyle: 'mono' }}
                            formatter={(value: any) => [formatBRL(Number(value)), '']}
                          />
                          <Bar dataKey="credits" fill="#10b981" name="Créditos obtidos" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="debits" fill="#f43f5e" name="Débitos gerados" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* CFOP report card list */}
                  <div className="glass-card rounded-2xl border border-white/5 p-6 space-y-4">
                     <h3 className="text-sm font-semibold text-white tracking-normal leading-normal">Detalhamento dos CFOPs Mapeados</h3>
                     
                     <div className="overflow-x-auto rounded-xl">
                       <table className="w-full text-xs text-left border-collapse">
                         <thead>
                           <tr className="border-b border-white/5 text-gray-400 bg-white/[0.01]">
                             <th className="p-3">CFOP</th>
                             <th className="p-3 text-right">Volume</th>
                             <th className="p-3 text-right">Créditos</th>
                             <th className="p-3 text-right">Débitos</th>
                           </tr>
                         </thead>
                         <tbody className="divide-y divide-white/5 font-mono">
                           {cfopsReport.map((g) => (
                             <tr key={g.cfop} className="hover:bg-white/[0.01]">
                               <td className="p-3 font-semibold text-white">{g.cfop}</td>
                               <td className="p-3 text-right text-gray-400">{formatBRL(g.volume)}</td>
                               <td className="p-3 text-right text-emerald-400">{g.credits > 0 ? formatBRL(g.credits) : '-'}</td>
                               <td className="p-3 text-right text-rose-400">{g.debits > 0 ? formatBRL(g.debits) : '-'}</td>
                             </tr>
                           ))}
                         </tbody>
                       </table>
                     </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB-3: ANÁLISE TEMPORAL */}
            {activeTab === 'temporal' && (
              <motion.div
                key="tab-temporal"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-8"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h1 className="text-xl font-bold text-white tracking-tight leading-normal">Dimensão e Evolução Temporal</h1>
                    <p className="text-gray-400 text-xs">Variações periódicas, desvios e projeções evolutivas das alíquotas do imposto duopolar.</p>
                  </div>

                  {/* Mode switcher monthly vs quarterly */}
                  <div className="bg-[#0c1222] border border-white/5 p-1 rounded-xl flex gap-1.5 self-start shrink-0">
                    <button
                      onClick={() => setTemporalMode('monthly')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                        temporalMode === 'monthly' ? 'bg-[#1e293b] text-cyan-400 font-bold' : 'text-gray-400'
                      }`}
                    >
                      Apuração Mensal
                    </button>
                    <button
                      onClick={() => setTemporalMode('quarterly')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                        temporalMode === 'quarterly' ? 'bg-[#1e293b] text-cyan-400 font-bold' : 'text-gray-400'
                      }`}
                    >
                      Apuração Trimestral
                    </button>
                  </div>
                </div>

                {simulationMode && (
                  <div className="p-4 bg-[#0a152d]/40 border border-cyan-500/15 rounded-2xl flex items-start gap-4">
                    <span className="p-2 py-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg text-[10px] font-mono font-bold leading-none select-none">HISTÓRICO</span>
                    <div className="space-y-1">
                      <h4 className="text-white text-xs font-bold leading-none">Análise Histórica de Projeção Ativa</h4>
                      <p className="text-gray-400 text-[11px] font-sans leading-relaxed">
                        Os dados exibidos neste painel cronológico simulam a evolução temporal da sua carga fiscal a partir de créditos e débitos estimados de <span className="font-semibold text-cyan-400 font-mono">{simulationIbsRate.toFixed(1)}% / {simulationCbsRate.toFixed(1)}%</span>. Se os gráficos apresentarem ausência de dados, certifique-se de ajustar a <strong>Empresa Ativa</strong> selecionada na barra lateral para coincidir com a sua empresa.
                      </p>
                    </div>
                  </div>
                )}

                {/* Highlights cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Peak period */}
                  <div className="glass-card rounded-2xl p-5 border border-white/5 space-y-1">
                    <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider leading-none">Melhor Posição</span>
                    {highlights.best ? (
                      <>
                        <div className="text-sm font-bold text-white tracking-tight">{highlights.best.label}</div>
                        <div className="text-lg font-bold font-mono text-emerald-400 leading-tight">
                          +{formatBRL(highlights.best.saldo)}
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-gray-400 pl-2">Vazio</div>
                    )}
                  </div>

                  {/* Worst period */}
                  <div className="glass-card rounded-2xl p-5 border border-white/5 space-y-1">
                    <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider leading-none">Pior Desempenho</span>
                    {highlights.worst ? (
                      <>
                        <div className="text-sm font-bold text-white tracking-tight">{highlights.worst.label}</div>
                        <div className="text-lg font-bold font-mono text-rose-400 leading-tight">
                          {formatBRL(highlights.worst.saldo)}
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-gray-400 pl-2">Vazio</div>
                    )}
                  </div>

                  {/* Trend vector */}
                  <div className="glass-card rounded-2xl p-5 border border-white/5 space-y-1">
                    <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider leading-none">Evolutivo Histórico</span>
                    <div className="text-sm font-bold text-white flex items-center gap-1.5">
                      {highlights.trend === 'UPWARD' && <span className="text-emerald-400">Tendência Altista</span>}
                      {highlights.trend === 'DOWNWARD' && <span className="text-rose-400">Tendência Baixista</span>}
                      {highlights.trend === 'STABLE' && <span className="text-cyan-400">Tendência Estável</span>}
                      {highlights.trend === 'NEUTRAL' && <span className="text-gray-400">Efeito Neutro</span>}
                    </div>
                    <div className="text-[10px] text-gray-400 font-sans leading-relaxed">
                      Projeções indicadas pelas variações de saldo do período.
                    </div>
                  </div>
                </div>

                {/* Evolution composed line / bar chart */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Composed Chart */}
                  <div className="lg:col-span-2 glass-card rounded-2xl border border-white/5 p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-white tracking-normal leading-normal">Balanço Periódico de Saldos IBS/CBS</h3>
                    
                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={temporalReport}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                          <XAxis dataKey="label" stroke="#9ca3af" fontSize={11} fontStyle="mono" />
                          <YAxis stroke="#9ca3af" fontSize={10} />
                          <Tooltip 
                            contentStyle={{ background: '#0b1329', borderColor: '#4f46e5', color: '#fff', fontStyle: 'mono' }}
                            formatter={(value: any) => [formatBRL(Number(value)), 'Value']}
                          />
                          <Bar dataKey="credito" fill="#10b981" name="Créditos" barSize={25} radius={[4, 4, 0, 0]} />
                          <Bar dataKey="debito" fill="#f43f5e" name="Débitos" barSize={25} radius={[4, 4, 0, 0]} />
                          <Line type="monotone" dataKey="saldo" stroke="#06b6d3" strokeWidth={2} name="Saldo Líquido" dot={{ fill: '#06b6d3' }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Area Chart: progressive trajectory of forward saldo */}
                  <div className="glass-card rounded-2xl border border-white/5 p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-white tracking-normal leading-normal">Acúmulo Progressivo de Saldos</h3>
                    
                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={temporalReport}>
                          <defs>
                            <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#818cf8" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                          <XAxis dataKey="label" stroke="#9ca3af" fontSize={11} fontStyle="mono" />
                          <YAxis stroke="#9ca3af" fontSize={10} />
                          <Tooltip 
                            contentStyle={{ background: '#0b1329', borderColor: '#818cf8', color: '#fff', fontStyle: 'mono' }}
                            formatter={(value: any) => [formatBRL(Number(value)), 'Acumulado']}
                          />
                          <Area type="monotone" dataKey="saldoAcumulado" stroke="#818cf8" strokeWidth={2} fillOpacity={1} fill="url(#colorSaldo)" name="Acumulado" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Temporal tables */}
                <div className="glass-card rounded-2xl border border-white/5 p-6">
                  <h3 className="text-sm font-semibold text-white tracking-normal leading-normal mb-4">Relatório do Fluxo de Caixa Periódico</h3>
                  
                  <div className="overflow-x-auto rounded-xl border border-white/5 bg-[#080d19]/20">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 bg-[#080d19]/60 text-gray-400 font-medium">
                          <th className="p-3">Período</th>
                          <th className="p-3 text-right">Compras (Inbound)</th>
                          <th className="p-3 text-right">Vendas (Outbound)</th>
                          <th className="p-3 text-right">Créditos</th>
                          <th className="p-3 text-right">Débitos</th>
                          <th className="p-3 text-right">Saldo Período</th>
                          <th className="p-3 text-right">Saldo Acumulado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-mono">
                        {temporalReport.map((p) => (
                          <tr key={p.label} className="hover:bg-white/[0.01]">
                            <td className="p-3 font-semibold text-white">{p.label}</td>
                            <td className="p-3 text-right text-gray-400">{formatBRL(p.volumeInbound)}</td>
                            <td className="p-3 text-right text-gray-400">{formatBRL(p.volumeOutbound)}</td>
                            <td className="p-3 text-right text-emerald-400">{formatBRL(p.credito)}</td>
                            <td className="p-3 text-right text-rose-400">{formatBRL(p.debito)}</td>
                            <td className={`p-3 text-right font-bold ${p.saldo >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
                              {formatBRL(p.saldo)}
                            </td>
                            <td className={`p-3 text-right font-medium ${p.saldoAcumulado >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
                              {formatBRL(p.saldoAcumulado)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB-4: CONFORMIDADE FISCAL */}
            {activeTab === 'conformidade' && (
              <motion.div
                key="tab-conformidade"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight leading-normal">Auditoria de Conformidade Fiscal</h1>
                  <p className="text-gray-400 text-xs text-balance">
                    Rastreie automaticamente notas de fornecedores enquadrados no **Regime Normal (RPA)** emitidos em período obrigatório (2026+) que **omitiram** o destaque das alíquotas de IBS/CBS.
                  </p>
                </div>

                {simulationMode && (
                  <div className="p-4 bg-[#1f0e15]/40 border border-rose-500/15 rounded-2xl flex items-start gap-4">
                    <span className="p-2 py-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg text-[10px] font-mono font-bold leading-none select-none">AUDITORIA</span>
                    <div className="space-y-1">
                      <h4 className="text-white text-xs font-bold leading-none">Simulação de Impacto da Conformidade Ativa</h4>
                      <p className="text-gray-400 text-[11px] font-sans leading-relaxed">
                        Como as notas subidas sâo anteriores a 2026, o auditor de conformidade ignorou o limite de corte temporal e mapeou quais fornecedores enquadrados no **Regime Normal (RPA)** de suas faturas reais de compras não possuem as marcas do IBS/CBS — impedindo o aproveitamento estimado de <span className="font-semibold text-rose-400 font-mono">{(simulationIbsRate + simulationCbsRate).toFixed(1)}% de incentivo de créditos</span> sob vigência fictícia.
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Quick stats on compliance leaks */}
                  <div className="glass-card rounded-2xl p-6 border border-rose-500/10 relative overflow-hidden debit-glow md:col-span-1">
                    <span className="absolute top-0 right-0 w-[80px] h-[80px] bg-rose-500/5 rounded-full blur-2xl" />
                    <div className="text-[10px] font-mono text-rose-500 uppercase tracking-widest font-bold leading-none mb-1">Inconformidades Ativas</div>
                    <div className="text-3xl font-bold font-mono text-rose-400 tracking-tight leading-none my-2">
                      {inconformes.length} <span className="text-xs text-white/50">ocorrências</span>
                    </div>
                    
                    {inconformes.length > 0 && (
                      <div className="text-xs text-gray-400 leading-normal pt-2">
                        Perda de créditos potenciais em compras calculada em{' '}
                        <strong className="text-rose-400 font-mono">
                          {formatBRL(inconformes.reduce((acc, curr) => acc + curr.value * ((simulationIbsRate + simulationCbsRate) / 100), 0))}
                        </strong> (estimado em alíquota standard de {(simulationIbsRate + simulationCbsRate).toFixed(1)}%). Cabe auditoria direta nestas transações!
                      </div>
                    )}
                  </div>

                  {/* Compliance guide cards */}
                  <div className="lg:col-span-2 glass-card rounded-2xl p-6 border border-white/5 flex flex-col justify-center">
                    <h3 className="text-white text-xs font-bold uppercase tracking-wider mb-2">Orientações de Auditoria</h3>
                    <p className="text-gray-400 text-xs mb-3 leading-relaxed">
                      Nesta lista de inconformidades, mostramos operantes RPA que não destacaram IBS/CBS. De acordo com os fundamentos da **não-cumulatividade plena (LC 214/2025)**, compras que não geram faturamento do imposto impedem o creditamento, onerando diretamente suas margens.
                    </p>
                    <div className="text-[11px] text-gray-500 font-mono flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>Fornecedores do Simples Nacional ou MEI foram corretamente isentos e omitidos deste relatório.</span>
                    </div>
                  </div>
                </div>

                {/* Tabular audit checklist card */}
                <div className="glass-card rounded-2xl border border-white/5 p-6">
                  <h3 className="text-sm font-semibold text-white tracking-normal leading-normal mb-4">Relatório de Omissões de Destaque</h3>
                  
                  {inconformes.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-white/5 bg-[#080d19]/20">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 bg-[#080d19]/60 text-gray-400 font-medium">
                            <th className="p-3">Data</th>
                            <th className="p-3">Remetente (Supplier)</th>
                            <th className="p-3">Regime</th>
                            <th className="p-3">CFOP</th>
                            <th className="p-3">Especificação do Item</th>
                            <th className="p-3 text-right">Val. Operação</th>
                            <th className="p-3 text-right">Crédito Perdido (Est.)</th>
                            <th className="p-3">Chave Referenciada</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 font-mono">
                          {inconformes.map((item, index) => {
                            const loss = item.value * ((simulationIbsRate + simulationCbsRate) / 100);
                            return (
                              <tr key={index} className="hover:bg-white/[0.01]">
                                <td className="p-3 whitespace-nowrap text-gray-400">
                                  {item.date.substring(0, 10)}
                                </td>
                                <td className="p-3 font-sans font-medium text-white max-w-[150px] truncate" title={item.sender}>
                                  {item.sender}
                                </td>
                                <td className="p-3 text-rose-400 font-sans tracking-wide font-medium">{item.emitterRegime}</td>
                                <td className="p-3 text-white">{item.cfop}</td>
                                <td className="p-3 font-sans text-gray-400 max-w-[200px] truncate" title={item.desc}>
                                  {item.desc}
                                </td>
                                <td className="p-3 text-right font-medium text-white">
                                  {formatBRL(item.value)}
                                </td>
                                <td className="p-3 text-right text-rose-400 font-bold">
                                  {formatBRL(loss)}
                                </td>
                                <td className="p-3 text-gray-500 font-sans select-all truncate max-w-[100px]" title={item.key}>
                                  {item.key}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-10 space-y-3">
                      <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                      <h4 className="text-white font-semibold text-sm">Sem Irregularidades Mapeadas!</h4>
                      <p className="text-gray-400 text-xs max-w-sm mx-auto leading-normal">
                        Todos os emissores RPA cumpriram o destaque legal nos XMLs processados, ou os arquivos são anteriores ao período de vigência.
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* TAB-5: DOM DOSSIÊ TRIBUTÁRIO (IA) */}
            {activeTab === 'ai' && (
              <motion.div
                key="tab-ai"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                <div role="region" aria-label="Introdução do Dossiê" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h1 className="text-xl font-bold text-white tracking-tight leading-normal">Dossiê Tributário com Inteligência Artificial (Gemini)</h1>
                    <p className="text-gray-400 text-xs">Examine análises e pareceres de alto nível estruturadas para o controller e tomadas de decisão.</p>
                  </div>

                  {!isAiGenerating && !aiReportText && (
                    <button
                      onClick={generateReportWithIa}
                      className="px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 border border-purple-400/30 text-xs font-semibold uppercase tracking-wider text-white flex items-center gap-2 cursor-pointer transition-all active:scale-95 shadow-[0_0_20px_rgba(139,92,246,0.3)] animate-pulse"
                    >
                      <Sparkles className="w-4 h-4 text-purple-200" />
                      <span>Gerar Dossiê Inteligente</span>
                    </button>
                  )}
                </div>

                {!apiKeyConfigured && (
                  <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 text-rose-400 text-xs flex items-center gap-3">
                    <BadgeAlert className="w-5 h-5 shrink-0" />
                    <div>
                      <strong>Nota sobre chaves:</strong> A chave do Gemini (GEMINI_API_KEY) está ausente do servidor. 
                      Fornecemos um sistema que responderá com templates de auditorias realistas offline para que possamos avaliar o fluxo de visualização completo!
                    </div>
                  </div>
                )}

                {/* Indication of generation progression */}
                {isAiGenerating && (
                  <div className="glass-card rounded-2xl border border-purple-500/25 p-8 relative overflow-hidden space-y-6">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-indigo-600 to-purple-400 animate-pulse" />
                    
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                        <div>
                          <h4 className="text-white font-bold text-sm tracking-tight">{aiStep}</h4>
                          <p className="text-gray-400 text-xs">Aguardando retornos do Gemini {selectedModel}...</p>
                        </div>
                      </div>
                      <div className="font-mono text-xs text-gray-500 bg-white/5 px-3 py-1.5 rounded-lg self-start">
                        Tempo Decorrido: <span className="text-purple-400 font-bold">{aiTimer}s</span>
                      </div>
                    </div>

                    {/* Progress loader */}
                    <div className="w-full bg-[#0c1221] h-1.5 rounded-full overflow-hidden">
                      <div className="bg-gradient-to-r from-purple-500 to-cyan-400 h-full rounded-full animate-progress" style={{ width: '70%', transition: 'width 2s' }} />
                    </div>
                  </div>
                )}

                {aiError && (
                  <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 text-rose-400 text-xs space-y-2">
                    <div className="flex items-center gap-2 font-bold uppercase tracking-wider">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Falha de Processamento de IA:</span>
                    </div>
                    <p className="font-mono pl-6">{aiError}</p>
                    <button 
                      onClick={generateReportWithIa}
                      className="mt-2 text-xs text-purple-400 font-bold hover:underline ml-6"
                    >
                      Tentar Novamente
                    </button>
                  </div>
                )}

                {aiReportText && (
                  <div className="space-y-6">
                    {/* Action buttons list */}
                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={printReport}
                        className="px-4 py-2 bg-[#0e1628] hover:bg-[#16233d] border border-cyan-500/20 text-cyan-400 font-semibold rounded-xl text-xs uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1.5"
                      >
                        <Printer className="w-4 h-4" />
                        <span>Imprimir / Salvar PDF</span>
                      </button>
                      <button
                        onClick={downloadReportHtml}
                        className="px-4 py-2 bg-[#0e1628] hover:bg-[#16233d] border border-cyan-500/20 text-cyan-400 font-semibold rounded-xl text-xs uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1.5"
                      >
                        <Download className="w-4 h-4" />
                        <span>Exportar HTML Autocontido</span>
                      </button>
                      <button
                        onClick={generateReportWithIa}
                        disabled={isAiGenerating}
                        className="px-4 py-2 bg-[#8b5cf6]/10 hover:bg-[#8b5cf6]/20 border border-purple-500/20 text-purple-300 font-semibold rounded-xl text-xs uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1.5"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>Regerar Análise</span>
                      </button>
                    </div>

                    {/* Dossiê Paper Layout */}
                    <article className="bg-[#0b0f1a] rounded-2xl border border-white/5 p-8 md:p-12 relative print:bg-white print:text-black print:p-0 print:border-none shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
                      {/* Logo header */}
                      <header className="flex justify-between items-center border-b border-white/5 pb-6 mb-8 print:border-black/10">
                        <div>
                          {logoBase64 ? (
                            <img src={logoBase64} alt="Company Logo" className="max-h-12 object-contain" />
                          ) : (
                            <h3 className="text-white text-lg font-bold tracking-tight print:text-black">SIMPLES APURAÇÃO RTC</h3>
                          )}
                        </div>
                        <div className="text-right text-[10px] font-mono text-gray-500 print:text-black/50">
                          <strong>Preparado por:</strong> {preparedBy}<br />
                          <strong>Análise CNPJ:</strong> {formatCNPJ(referenceCnpj)}<br />
                          <strong>Fase de Transição:</strong> LC 214/2025
                        </div>
                      </header>

                      {/* Decoded Markdown Text Output */}
                      <div className="prose prose-invert prose-xs max-w-none print:text-black print:prose-neutral text-gray-300 leading-relaxed font-sans space-y-4">
                        <div className="markdown-body">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {aiReportText}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </article>
                  </div>
                )}

                {/* Standard empty display */}
                {!isAiGenerating && !aiReportText && (
                  <div className="glass-card rounded-2xl border border-white/5 p-12 text-center space-y-4">
                    <Sparkles className="w-12 h-12 text-purple-400 mx-auto animate-pulse" />
                    <h3 className="text-white font-bold text-sm">Pronto para Auditar Operações</h3>
                    <p className="text-gray-400 text-xs max-w-md mx-auto leading-normal">
                      Ao clicar no gerador, o sistema consolidará todos os balances tributários, auditará os perfis de vendas B2B e as perdas de créditos de conformidade RPA e gerará um relatório técnico altamente sofisticado do Gemini.
                    </p>
                    <button
                      onClick={generateReportWithIa}
                      className="px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 border border-purple-400/30 text-xs font-semibold uppercase tracking-wider text-white inline-flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Iniciar Geração com Gemini</span>
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* TAB-6: CONFIGURAÇÕES */}
            {activeTab === 'config' && (
              <motion.div
                key="tab-config"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight leading-normal">Configurações Gerais</h1>
                  <p className="text-gray-400 text-xs">Customize parâmetros de análises de inteligência artificial e logos e arquivos de rodapé.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* AI configurations */}
                  <div className="glass-card rounded-2xl border border-white/5 p-6 space-y-4">
                    <h3 className="text-white text-xs font-bold uppercase tracking-wider mb-2">Parâmetros de Modelos de IA</h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">Selecionar Modelo do Core</label>
                        <select
                          value={selectedModel}
                          onChange={(e) => setSelectedModel(e.target.value)}
                          className="w-full bg-[#080d19] border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                        >
                          <option value="gemini-3.5-flash">Gemini 3.5 Flash (Superrápido, Padrão)</option>
                          <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Parecer Profissional Denso)</option>
                          <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite (Velocidade Extrema)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">Autor / Preparado por</label>
                        <input
                          type="text"
                          value={preparedBy}
                          onChange={(e) => setPreparedBy(e.target.value)}
                          className="w-full bg-[#080d19] border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-cyan-500/50 font-mono"
                          placeholder="Simples Consultoria Rápida"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Corporate Branding configurations */}
                  <div className="glass-card rounded-2xl border border-white/5 p-6 space-y-4">
                    <h3 className="text-white text-xs font-bold uppercase tracking-wider mb-2">Logomarca e Identidade</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">Logotipo Corporativo (.PNG, .JPG, .SVG)</label>
                        <div className="flex items-center gap-4">
                          <div className="min-w-[80px] h-20 bg-[#080d19] rounded-xl border border-white/5 flex items-center justify-center p-2">
                            {logoBase64 ? (
                              <img src={logoBase64} alt="Preview" className="max-h-full max-w-full object-contain" />
                            ) : (
                              <FolderOpen className="w-5 h-5 text-gray-600" />
                            )}
                          </div>
                          <div className="flex-1 space-y-2">
                            <input 
                              type="file" 
                              id="logo-file" 
                              accept="image/*" 
                              onChange={handleLogoUpload}
                              className="hidden"
                            />
                            <label htmlFor="logo-file" className="inline-block px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white rounded-lg cursor-pointer transition-all">
                              Selecionar Imagem
                            </label>
                            {logoBase64 && (
                              <button
                                onClick={() => setLogoBase64(null)}
                                className="block text-[10px] text-rose-400 font-bold hover:underline"
                              >
                                Limpar Logotipo
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RTC Simulation configuration */}
                  <div className="glass-card rounded-2xl border border-white/5 p-6 space-y-4 md:col-span-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-white/5">
                      <div>
                        <h3 className="text-white text-xs font-bold uppercase tracking-wider mb-1">Simulador Contínuo da Reforma Tributária (PLP 68/24)</h3>
                        <p className="text-gray-400 text-[11px] font-sans">Projeta e estima créditos/débitos para notas cotidianas que não contêm tags físicas de transição.</p>
                      </div>
                      
                      <button
                        onClick={() => setSimulationMode(!simulationMode)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-2 ${
                          simulationMode 
                            ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_12px_rgba(6,182,212,0.15)]' 
                            : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${simulationMode ? 'bg-cyan-400 animate-pulse' : 'bg-gray-500'}`} />
                        <span>{simulationMode ? 'Modo Projeção Ativo' : 'Usar Apenas XML Puro'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                      <div className="space-y-2">
                        <label className="block text-xs text-gray-400 font-semibold uppercase tracking-wider font-sans">Alíquota projetada do IBS (%)</label>
                        <div className="flex items-center gap-3 font-mono">
                          <input
                            type="range"
                            min="0"
                            max="20"
                            step="0.1"
                            value={simulationIbsRate}
                            disabled={!simulationMode}
                            onChange={(e) => setSimulationIbsRate(Number(e.target.value))}
                            className="flex-1 accent-cyan-500 bg-white/5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          />
                          <input
                            type="number"
                            min="0"
                            max="20"
                            step="0.1"
                            value={simulationIbsRate}
                            disabled={!simulationMode}
                            onChange={(e) => setSimulationIbsRate(Number(e.target.value))}
                            className="w-20 bg-[#080d19] border border-white/10 rounded-lg p-2 text-xs text-right text-cyan-400 font-mono focus:outline-none focus:border-cyan-500/50 disabled:opacity-30 disabled:cursor-not-allowed"
                          />
                        </div>
                        <span className="text-[10px] text-gray-500 block">Alíquota estadual/municipal sugerida para o Imposto sobre Bens e Serviços.</span>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs text-gray-400 font-semibold uppercase tracking-wider font-sans">Alíquota projetada da CBS (%)</label>
                        <div className="flex items-center gap-3 font-mono">
                          <input
                            type="range"
                            min="0"
                            max="20"
                            step="0.1"
                            value={simulationCbsRate}
                            disabled={!simulationMode}
                            onChange={(e) => setSimulationCbsRate(Number(e.target.value))}
                            className="flex-1 accent-indigo-500 bg-white/5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          />
                          <input
                            type="number"
                            min="0"
                            max="20"
                            step="0.1"
                            value={simulationCbsRate}
                            disabled={!simulationMode}
                            onChange={(e) => setSimulationCbsRate(Number(e.target.value))}
                            className="w-20 bg-[#080d19] border border-white/10 rounded-lg p-2 text-xs text-right text-indigo-400 font-mono focus:outline-none focus:border-indigo-500/50 disabled:opacity-30 disabled:cursor-not-allowed"
                          />
                        </div>
                        <span className="text-[10px] text-gray-500 block font-sans">Alíquota federal sugerida para a Contribuição sobre Bens e Serviços.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
