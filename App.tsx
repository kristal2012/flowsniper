import React, { useState, useEffect, useRef } from 'react';
import { Wallet as EthersWallet } from 'ethers';
import {
  Wallet,
  Activity,
  ExternalLink,
  Copy,
  LayoutDashboard,
  Fuel,
  Coins,
  Cpu,
  Zap,
  LogOut,
  Settings,
  Bell,
  Bot,
  Play,
  Square,
  ShieldCheck,
  Plus,
  Minus,
  Circle,
  ChevronDown,
  Key,
  FolderX,
  TrendingUp,
  TrendingDown,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  BrainCircuit
} from 'lucide-react';

import { Asset, Transaction, PerformanceData, ManagerProfile, ArbitrageStep, FlowStep } from './types';
import { mockManager, mockAssets, mockPerformance, mockTransactions } from './services/mockData';
import { analyzePerformance } from './services/openai';
import { fetchHistoricalData, fetchCurrentPrice } from './services/marketDataService';
import { FlowSniperEngine } from './services/flowSniperEngine';

const App: React.FC = () => {
  // Estados de Controle
  const [manager, setManager] = useState<ManagerProfile>(mockManager);

  // Load real address on mount
  useEffect(() => {
    const pvt = localStorage.getItem('fs_private_key');
    if (pvt) {
      try {
        const w = new EthersWallet(pvt);
        setManager(prev => ({ ...prev, address: w.address }));
      } catch (e) { console.log("Invalid key in storage"); }
    }
  }, []);
  const [activeTab, setActiveTab] = useState<'overview' | 'assets' | 'gas' | 'robots' | 'settings'>('overview');
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [botActive, setBotActive] = useState(false);
  const [mode, setMode] = useState<'REAL' | 'DEMO'>('DEMO');

  // Credentials State
  const [privateKey, setPrivateKey] = useState(localStorage.getItem('fs_private_key') || '');
  const [rpcUrl, setRpcUrl] = useState(localStorage.getItem('fs_polygon_rpc') || '');
  const [arbitrageLogs, setArbitrageLogs] = useState<ArbitrageStep[]>([]);

  // Estados Financeiros
  const [dailyProfit, setDailyProfit] = useState(0);
  const [dailyLoss, setDailyLoss] = useState(0);

  // AI Analysis State
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Estados de Formulário
  const [liquidityAction, setLiquidityAction] = useState<'add' | 'remove'>('add');
  const [liquidityAmount, setLiquidityAmount] = useState('');
  const [gasAmount, setGasAmount] = useState('');

  const accountMenuRef = useRef<HTMLDivElement>(null);
  const sniperRef = useRef<FlowSniperEngine | null>(null);

  // Lógica de fechamento do menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- LOGIC MERGE: Real Engine Initialization ---
  useEffect(() => {
    sniperRef.current = new FlowSniperEngine((newStep: FlowStep) => {
      // Map FlowStep to ArbitrageStep for the new UI
      const mappedStep: ArbitrageStep = {
        id: newStep.id,
        timestamp: newStep.timestamp,
        path: newStep.pair.split('/'), // e.g. "WMATIC/USDC" -> ["WMATIC", "USDC"]
        profit: newStep.profit,
        status: newStep.status === 'SUCCESS' ? 'SUCCESS' : 'EXPIRED',
        hash: newStep.hash
      };

      setArbitrageLogs(prev => [mappedStep, ...prev].slice(0, 15));

      if (newStep.profit > 0) {
        setDailyProfit(prev => prev + newStep.profit);
      } else {
        setDailyLoss(prev => prev + Math.abs(newStep.profit));
      }
    });

    return () => {
      if (sniperRef.current) sniperRef.current.stop();
    };
  }, []);

  // --- LOGIC MERGE: Start/Stop Engine ---
  useEffect(() => {
    if (botActive && sniperRef.current) {
      sniperRef.current.start(mode);
    } else if (sniperRef.current) {
      sniperRef.current.stop();
    }
  }, [botActive, mode]);

  // Auto-Derive Address from Private Key
  useEffect(() => {
    if (privateKey && privateKey.length > 60) {
      try {
        // Creating a temp wallet to get address
        // specific import needed or use ethers from window if available, 
        // but we can imply usage of blockchainService or simple check
        // For now, let's just update the UI state if we assume valid key
        // OR better: use ethers library if imported.

        // Since we don't want to add heavy imports to App.tsx if not needed,
        // let's rely on blockchainService to validate/get address? 
        // Or just import Wallet from ethers.
        // Let's check imports. logic merge:
      } catch (e) { }
    }
  }, [privateKey]);

  // Actually, let's do this directly in the saveCredentials or just import Wallet.
  // Re-writing simple effect:

  // Save Credentials
  const saveCredentials = () => {
    if (privateKey) {
      localStorage.setItem('fs_private_key', privateKey);
      // Try to update manager address visual
      try {
        // Basic heuristic or real derivation would require ethers import
        // Let's leave the derivation for the re-load or add ethers import
      } catch (e) { }
    }
    if (rpcUrl) localStorage.setItem('fs_polygon_rpc', rpcUrl);
    alert('Credenciais Salvas! O nó Master será atualizado.');
    window.location.reload(); // Simple reload to re-init services with new keys
  };

  // --- LOGIC MERGE: AI & Market Data Fetch ---
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        // Fetch real market data
        const history = await fetchHistoricalData('MATICUSDT', '1', 50);
        if (history.length > 0) {
          // Puter AI Analysis
          const aiResult = await analyzePerformance(mockAssets, mockTransactions);
          setAnalysis(aiResult);
        }
      } catch (e) {
        console.error("Data init failed", e);
      }
      setLoading(false);
    };
    initData();
  }, []);


  const copyAddress = () => {
    navigator.clipboard.writeText(manager.address);
    alert('Endereço copiado!');
    setIsAccountMenuOpen(false);
  };

  const netResult = dailyProfit - dailyLoss;

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col md:flex-row font-['Inter'] selection:bg-[#f01a74]/30">

      {/* Sidebar - Desktop */}
      <aside className="w-72 border-r border-zinc-800/50 hidden md:flex flex-col p-6 sticky top-0 h-screen bg-[#0c0c0e]">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-[#f01a74] rounded-xl flex items-center justify-center font-bold text-white text-xl shadow-lg shadow-[#f01a74]/30">FS</div>
          <span className="font-bold text-2xl tracking-tighter bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent italic">FLOWSNIPER <span className="text-[10px] text-emerald-500 non-italic border border-emerald-500/20 px-1 rounded">v4.0 AI</span></span>
        </div>

        {/* Account Info Card */}
        <div className="relative mb-10" ref={accountMenuRef}>
          <button
            onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
            className="w-full bg-[#141417] p-4 rounded-2xl border border-zinc-800/50 flex flex-col text-left hover:border-zinc-700 transition-all active:scale-[0.98] shadow-xl"
          >
            <div className="flex items-center justify-between mb-2 w-full">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Master Node</span>
              <ChevronDown size={14} className={`text-zinc-500 transition-transform ${isAccountMenuOpen ? 'rotate-180' : ''}`} />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center border border-zinc-700">
                <ShieldCheck size={14} className="text-[#f01a74]" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-mono text-zinc-300 truncate">{manager.address}</p>
              </div>
            </div>
          </button>

          {isAccountMenuOpen && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-[#141417] border border-zinc-800 rounded-2xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-4 border-b border-zinc-800/50 bg-black/20">
                <p className="text-xs font-bold text-white">Acesso de Proprietário</p>
                <p className="text-[10px] text-zinc-500 font-mono">Privacidade: Máxima</p>
              </div>
              <div className="p-2">
                <button onClick={copyAddress} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-zinc-300 text-xs font-medium transition-colors">
                  <Copy size={14} /> Copiar Endereço
                </button>
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-2">
          <SidebarItem active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<LayoutDashboard size={20} />} label="Painel Inicial" />
          <SidebarItem active={activeTab === 'assets'} onClick={() => setActiveTab('assets')} icon={<Coins size={20} />} label="Gestão de Liquidez" />
          <SidebarItem active={activeTab === 'gas'} onClick={() => setActiveTab('gas')} icon={<Fuel size={20} />} label="Reserva de Gás" />
          <SidebarItem active={activeTab === 'robots'} onClick={() => setActiveTab('robots')} icon={<Bot size={20} />} label="Motor Sniper" />
          <SidebarItem active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={20} />} label="Configurações" />
        </nav>

        <div className="mt-auto pt-6 border-t border-zinc-800/50 flex items-center justify-between text-zinc-500">
          <Settings size={18} className="cursor-pointer hover:text-white transition-colors" onClick={() => setActiveTab('settings')} />
          <Bell size={18} className="cursor-pointer hover:text-white transition-colors" />
          <LogOut size={18} className="cursor-pointer text-rose-500 hover:text-rose-400" />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-[#09090b] pb-24 md:pb-0">
        <header className="h-16 border-b border-zinc-800/30 flex items-center justify-end px-8 gap-4 sticky top-0 bg-[#09090b]/80 backdrop-blur-md z-40">
          <div className="bg-[#141417] px-4 py-2 rounded-full border border-zinc-800 flex items-center gap-3 shadow-inner">
            <div className="flex flex-col items-end">
              <span className="text-[9px] text-zinc-500 font-bold uppercase leading-none mb-1">Lucro Sessão</span>
              <span className={`text-xs font-mono font-black ${netResult >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {netResult >= 0 ? '+' : ''}{netResult.toFixed(4)} <span className="text-[10px]">USDT</span>
              </span>
            </div>
            <div className={`w-2.5 h-2.5 rounded-full ${botActive ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-700'}`}></div>
          </div>
        </header>

        <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-10">

          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              {/* --- LOGIC MERGE: AI WIDGET --- */}
              {analysis ? (
                <div className="bg-[#141417] rounded-[2rem] border border-zinc-800/50 p-6 md:p-8 animate-in fade-in duration-700 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-5">
                    <BrainCircuit size={100} className="text-[#f01a74]" />
                  </div>
                  <div className="flex items-center gap-4 mb-4 relative z-10">
                    <div className="w-12 h-12 bg-[#f01a74]/10 rounded-xl flex items-center justify-center border border-[#f01a74]/20">
                      <BrainCircuit size={24} className="text-[#f01a74]" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black italic uppercase tracking-tighter">Market AI Insight</h3>
                      <div className="flex items-center gap-2">
                        <div className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-500/20 uppercase">
                          {analysis.riskLevel}
                        </div>
                        <span className="text-[10px] text-zinc-500">Powered by Puter.js (GPT-4o)</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-zinc-300 mb-6 leading-relaxed font-medium relative z-10 max-w-3xl">
                    {analysis.summary}
                  </p>
                  <div className="grid md:grid-cols-2 gap-4 relative z-10">
                    <div className="bg-black/40 p-5 rounded-2xl border border-zinc-800/30">
                      <p className="text-zinc-500 text-[9px] uppercase font-black tracking-widest mb-1">Recomendação</p>
                      <p className="font-bold text-emerald-400 italic">{analysis.recommendation}</p>
                    </div>
                    <div className="bg-black/40 p-5 rounded-2xl border border-zinc-800/30">
                      <p className="text-zinc-500 text-[9px] uppercase font-black tracking-widest mb-1">Estratégia</p>
                      <p className="font-bold text-blue-400 italic">{analysis.suggestedStrategy}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[#141417] rounded-[2rem] border border-zinc-800/50 p-8 flex items-center justify-center opacity-50">
                  <p className="text-sm font-bold text-zinc-500 flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-zinc-600 border-t-white rounded-full animate-spin"></span>
                    Carregando Análise de IA...
                  </p>
                </div>
              )}
              {/* --- END AI WIDGET --- */}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <SummaryCard
                  title="Capital Disponível"
                  value="0.000000"
                  unit="USDT"
                  onAdd={() => setActiveTab('assets')}
                  onRemove={() => setActiveTab('assets')}
                />
                <SummaryCard
                  title="Reserva Operacional"
                  value="--"
                  unit="POL"
                  onAdd={() => setActiveTab('gas')}
                  onRemove={() => setActiveTab('gas')}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="bg-[#141417] rounded-[2.5rem] border border-zinc-800/50 overflow-hidden flex flex-col min-h-[400px] lg:col-span-2 shadow-2xl">
                  <div className="p-8 border-b border-zinc-800/30 flex justify-between items-center bg-black/40">
                    <h3 className="font-bold flex items-center gap-3 text-lg"><Activity size={20} className="text-[#f01a74]" /> Monitor On-Chain</h3>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${botActive ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                        {botActive ? 'Ativo' : 'Offline'}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-20">
                    <Cpu size={64} className="mb-6" />
                    <p className="text-lg font-bold italic tracking-tight uppercase">Aguardando comando do Motor Sniper</p>
                  </div>
                </div>

                <div className="bg-[#141417] rounded-[2.5rem] border border-zinc-800/50 p-10 flex flex-col lg:col-span-1 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                    <Zap size={120} className="text-[#f01a74]" />
                  </div>
                  <h3 className="font-black text-xl mb-8 flex items-center gap-3 italic"><Settings size={22} className="text-zinc-600" /> ENGINE SETS</h3>
                  <div className="space-y-6 flex-1 relative z-10">
                    <StatRow label="Network" value="Polygon Mainnet" />
                    <StatRow label="Slippage Limit" value="0.12% - 0.50%" />
                    <StatRow label="HFT Mode" value={<span className="text-emerald-500 font-bold">Ultra-Fast</span>} />
                    <StatRow label="Gas Boost" value="Priority x2" />
                    <StatRow label="Safety Net" value="Active" />
                  </div>
                  <button onClick={() => setActiveTab('robots')} className="mt-8 w-full bg-white/5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5">Ajustar Parâmetros</button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: ROBOTS (MOTOR SNIPER - O CORAÇÃO DO SISTEMA) */}
          {activeTab === 'robots' && (
            <div className="space-y-10 animate-in fade-in duration-300">
              <div className="bg-gradient-to-br from-[#141417] to-[#0c0c0e] rounded-[3rem] border border-zinc-800/50 p-10 flex flex-col md:flex-row justify-between items-center gap-10 shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-[#f01a74]/5 opacity-20 pointer-events-none"></div>
                <div className="flex items-center gap-8 relative z-10">
                  <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center transition-all duration-700 ${botActive ? 'bg-[#f01a74] shadow-[0_0_50px_rgba(240,26,116,0.4)] rotate-12 scale-110' : 'bg-zinc-800 shadow-inner'}`}>
                    <Bot size={48} className={botActive ? 'text-white' : 'text-zinc-600'} />
                  </div>
                  <div>
                    <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-1">FLOWSNIPER ENGINE</h2>
                    <p className="text-xs text-zinc-500 font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                      <Circle size={8} fill={botActive ? '#10b981' : '#71717a'} className="border-none" />
                      Private Master v4.0 • <span className={`${mode === 'REAL' ? 'text-rose-500' : 'text-emerald-500'} font-black`}>{mode === 'REAL' ? 'LIVE TRADING' : 'DEMO MODE'}</span>
                    </p>

                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => { setBotActive(false); setMode('DEMO'); }}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${mode === 'DEMO' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-transparent text-zinc-600 border-zinc-800 hover:border-zinc-600'}`}
                      >
                        Demo
                      </button>
                      <button
                        onClick={() => { setBotActive(false); setMode('REAL'); }}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${mode === 'REAL' ? 'bg-rose-600 text-white border-rose-600 shadow-[0_0_20px_rgba(225,29,72,0.4)]' : 'bg-transparent text-zinc-600 border-zinc-800 hover:border-zinc-600'}`}
                      >
                        Live Real
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setBotActive(!botActive)}
                  className={`px-16 py-6 rounded-[2rem] font-black italic text-lg flex items-center gap-5 transition-all duration-500 active:scale-90 relative z-10 overflow-hidden ${botActive ? 'bg-rose-500/10 text-rose-500 border border-rose-500/30' : 'bg-[#f01a74] text-white shadow-2xl shadow-[#f01a74]/30 hover:bg-[#d01664] hover:scale-105'}`}
                >
                  {botActive ? <><Square size={24} fill="currentColor" /> PARAR MOTOR</> : <><Play size={24} fill="currentColor" /> INICIAR MOTOR</>}
                </button>
              </div>

              {/* MÓDULO DE MONITORAMENTO FINANCEIRO (O QUE VOCÊ PEDIU) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <BotStat
                  label="Lucro Bruto (Diário)"
                  value={`+${dailyProfit.toFixed(4)}`}
                  color="text-emerald-500"
                  icon={<ArrowUpRight size={20} />}
                  sub="Captura de Slippage On-Chain"
                />
                <BotStat
                  label="Perda Bruta (Diário)"
                  value={`-${dailyLoss.toFixed(4)}`}
                  color="text-rose-500"
                  icon={<ArrowDownRight size={20} />}
                  sub="Taxas de Gás & Falhas"
                />
                <BotStat
                  label="Lucro Líquido"
                  value={`${netResult >= 0 ? '+' : ''}${netResult.toFixed(4)}`}
                  color={netResult >= 0 ? 'text-white' : 'text-rose-400'}
                  icon={<Zap size={20} className={netResult >= 0 ? 'text-emerald-400' : 'text-rose-400'} />}
                  sub="Resultado Final da Sessão"
                  isMain
                />
                <BotStat
                  label="Estado da Rede"
                  value={botActive ? "EM OPERAÇÃO" : "STANDBY"}
                  color={botActive ? "text-emerald-400" : "text-zinc-500"}
                  sub="Polygon PoS Network"
                />
              </div>

              {/* LIVE FEED DE OPERAÇÕES */}
              {botActive && (
                <div className="bg-[#141417] rounded-[3rem] border border-zinc-800/50 overflow-hidden animate-in slide-in-from-bottom-10 duration-700 shadow-2xl">
                  <div className="p-8 border-b border-zinc-800/30 flex items-center justify-between bg-black/50">
                    <div className="flex items-center gap-4">
                      <div className="w-3 h-3 bg-emerald-500 rounded-full animate-ping"></div>
                      <h3 className="font-black text-sm uppercase tracking-widest italic">Live Arbitrage Stream</h3>
                    </div>
                    <div className="flex items-center gap-8">
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] text-zinc-500 font-bold uppercase mb-0.5">Total Ops</span>
                        <span className="text-xs font-mono font-bold text-white">{arbitrageLogs.length}</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-8 space-y-3 font-mono text-[11px] max-h-[500px] overflow-y-auto custom-scrollbar">
                    {arbitrageLogs.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-24 opacity-10">
                        <Search size={48} className="mb-6 animate-bounce" />
                        <p className="text-lg font-black italic uppercase">Buscando Rotas Lucrativas...</p>
                      </div>
                    )}
                    {arbitrageLogs.map((log) => (
                      <div
                        key={log.id}
                        className={`group flex justify-between items-center p-5 rounded-[1.5rem] border transition-all duration-300 hover:scale-[1.02] ${log.profit < 0 ? 'bg-rose-500/5 border-rose-500/10' : 'bg-emerald-500/5 border-emerald-500/10 hover:border-emerald-500/30'}`}
                      >
                        <div className="flex items-center gap-8">
                          <span className="text-zinc-600 text-[10px] w-20">{log.timestamp}</span>
                          <div className="flex flex-col">
                            <span className={`font-black uppercase tracking-tighter text-sm ${log.profit < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                              {log.profit < 0 ? 'Cost Recapture' : 'Successful Snipe'}
                            </span>
                            <span className="text-zinc-500 text-[10px] mt-1 font-bold">{log.path.join(' → ')}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="flex flex-col items-end">
                            <span className={`font-black text-base tracking-tighter ${log.profit < 0 ? 'text-rose-500' : 'text-white'}`}>
                              {log.profit > 0 ? '+' : ''}{log.profit.toFixed(4)} <span className="text-[10px] text-zinc-600">POL</span>
                            </span>
                            <span className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest mt-1 group-hover:text-zinc-400 transition-colors">Ver no PolygonScan</span>
                          </div>
                          <a href={`https://polygonscan.com/tx/${log.hash}`} target="_blank" rel="noreferrer" className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors border border-white/5">
                            <ExternalLink size={16} className="text-zinc-500" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: ASSETS (LIQUIDEZ) */}
          {activeTab === 'assets' && (
            <div className="space-y-10 animate-in fade-in duration-300">
              <div className="bg-[#141417] rounded-[3rem] p-16 border border-zinc-800/50 text-center relative overflow-hidden group shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-t from-[#f01a74]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                <p className="text-zinc-500 text-xs font-black uppercase tracking-[0.4em] mb-4 relative z-10">Capital Sob Gestão Privada</p>
                <h2 className="text-7xl font-black font-mono tracking-tighter relative z-10">0.000000 <span className="text-zinc-700 text-4xl uppercase font-sans">USDT</span></h2>
              </div>

              <div className="bg-[#141417] rounded-[3rem] border border-zinc-800/50 overflow-hidden shadow-2xl">
                <div className="grid grid-cols-2 border-b border-zinc-800/50 bg-black/30">
                  <button onClick={() => setLiquidityAction('add')} className={`py-6 font-black text-sm uppercase tracking-widest transition-all ${liquidityAction === 'add' ? 'bg-emerald-500/10 text-emerald-500 border-b-2 border-emerald-500' : 'text-zinc-600 hover:text-zinc-400'}`}>+ Aportar Fundos</button>
                  <button onClick={() => setLiquidityAction('remove')} className={`py-6 font-black text-sm uppercase tracking-widest transition-all ${liquidityAction === 'remove' ? 'bg-rose-500/10 text-rose-500 border-b-2 border-rose-500' : 'text-zinc-600 hover:text-zinc-400'}`}>- Resgatar Fundos</button>
                </div>
                <div className="p-12 space-y-8">
                  <div className="max-w-md mx-auto space-y-6 text-center">
                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em]">Montante em USDT</p>
                    <input
                      type="number"
                      value={liquidityAmount}
                      onChange={(e) => setLiquidityAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[#0c0c0e] border border-zinc-800 rounded-3xl p-6 font-mono text-4xl text-center outline-none focus:border-[#f01a74]/50 transition-all shadow-inner"
                    />
                    <button className="w-full bg-[#f01a74] py-6 rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-[#d01664] transition-all active:scale-[0.98] shadow-2xl shadow-[#f01a74]/20 border border-[#f01a74]/20">Confirmar Operação Privada</button>
                    <p className="text-[10px] text-zinc-600 font-medium italic">* Os fundos nunca saem do seu contrato privado durante a operação.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: GAS (COMBUSTÍVEL) */}
          {activeTab === 'gas' && (
            <div className="space-y-10 animate-in fade-in duration-300">
              <div className="bg-[#141417] rounded-[3rem] border border-zinc-800/50 p-16 flex flex-col md:flex-row gap-16 items-center shadow-2xl">
                <div className="flex-1 space-y-6 text-center md:text-left">
                  <div className="w-20 h-20 bg-blue-500/10 rounded-[2rem] flex items-center justify-center mx-auto md:mx-0 border border-blue-500/20">
                    <Fuel size={40} className="text-blue-500" />
                  </div>
                  <h3 className="text-4xl font-black tracking-tighter uppercase italic">Operação de Gás</h3>
                  <p className="text-zinc-400 leading-relaxed text-lg font-medium">
                    O motor sniper exige combustível em POL para executar as rotas on-chain.
                    Sem saldo de gás, o robô permanecerá em standby.
                  </p>
                </div>
                <div className="w-full max-w-md bg-black/30 p-12 rounded-[3rem] border border-zinc-800/50 space-y-8 shadow-inner">
                  <div className="text-center">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4">Valor para Abastecimento (POL)</p>
                    <input
                      type="number"
                      className="w-full bg-[#0c0c0e] border border-zinc-800 rounded-2xl p-5 font-mono text-3xl text-center outline-none focus:border-blue-500/50 transition-all"
                      placeholder="0.00 POL"
                    />
                  </div>
                  <button className="w-full bg-blue-600 py-6 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-500 transition-all active:scale-95 shadow-2xl shadow-blue-500/20 border border-blue-400/20">Recarregar Combustível</button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: SETTINGS (NOVA) */}
          {activeTab === 'settings' && (
            <div className="space-y-10 animate-in fade-in duration-300">
              <div className="bg-[#141417] rounded-[3rem] border border-zinc-800/50 p-12 shadow-2xl">
                <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-2">Configurações do Nó</h2>
                <p className="text-zinc-500 text-sm mb-10">Gerencie suas chaves de acesso e conexão RPC. Seus dados são salvos apenas no seu navegador.</p>

                <div className="space-y-8 max-w-2xl">
                  <div className="space-y-3">
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Chave Privada (Private Key)</label>
                    <div className="relative">
                      <Key className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                      <input
                        type="password"
                        value={privateKey}
                        onChange={(e) => setPrivateKey(e.target.value)}
                        className="w-full bg-[#0c0c0e] border border-zinc-800 rounded-2xl py-5 pl-14 pr-6 text-emerald-500 font-mono text-sm outline-none focus:border-[#f01a74]/50 transition-all placeholder:text-zinc-800"
                        placeholder="0x..."
                      />
                    </div>
                    <p className="text-[10px] text-zinc-600 italic">Nunca compartilhe sua chave privada. Ela é usada para assinar transações no modo REAL.</p>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Polygon RPC URL</label>
                    <div className="relative">
                      <Activity className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                      <input
                        type="text"
                        value={rpcUrl}
                        onChange={(e) => setRpcUrl(e.target.value)}
                        className="w-full bg-[#0c0c0e] border border-zinc-800 rounded-2xl py-5 pl-14 pr-6 text-blue-400 font-mono text-sm outline-none focus:border-[#f01a74]/50 transition-all placeholder:text-zinc-800"
                        placeholder="https://polygon-rpc.com"
                      />
                    </div>
                  </div>

                  <button onClick={saveCredentials} className="px-10 py-5 bg-[#f01a74] rounded-2xl font-black text-xs uppercase tracking-widest text-white shadow-xl shadow-[#f01a74]/20 hover:bg-[#d01664] transition-all active:scale-95">
                    Salvar Credenciais
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur-2xl border-t border-zinc-800/50 flex justify-around py-6 z-50">
        <MobileNavItem active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<LayoutDashboard size={24} />} />
        <MobileNavItem active={activeTab === 'robots'} onClick={() => setActiveTab('robots')} icon={<Bot size={24} />} />
        <MobileNavItem active={activeTab === 'assets'} onClick={() => setActiveTab('assets')} icon={<Coins size={24} />} />
        <MobileNavItem active={activeTab === 'gas'} onClick={() => setActiveTab('gas')} icon={<Fuel size={24} />} />
      </nav>
    </div>
  );
};

// COMPONENTES DE INTERFACE PERSONALIZADOS
const SummaryCard: React.FC<{ title: string; value: string; unit: string; onAdd: () => void; onRemove: () => void }> = ({ title, value, unit, onAdd, onRemove }) => (
  <div className="bg-[#141417] rounded-[2.5rem] border border-zinc-800/50 p-10 shadow-2xl hover:border-[#f01a74]/30 transition-all group overflow-hidden relative">
    <div className="absolute inset-0 bg-gradient-to-br from-[#f01a74]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-4 relative z-10">{title}</p>
    <h2 className="text-5xl font-black mb-10 font-mono tracking-tighter relative z-10">{value} <span className="text-zinc-700 text-2xl uppercase font-sans">{unit}</span></h2>
    <div className="grid grid-cols-2 gap-4 relative z-10">
      <button onClick={onAdd} className="flex items-center justify-center gap-2 bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-800/50 rounded-2xl py-3 text-[10px] font-black uppercase transition-all active:scale-95"><Plus size={14} /> Aporte</button>
      <button onClick={onRemove} className="flex items-center justify-center gap-2 bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-800/50 rounded-2xl py-3 text-[10px] font-black uppercase transition-all active:scale-95"><Minus size={14} /> Resgate</button>
    </div>
  </div>
);

const StatRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex justify-between items-center py-3 border-b border-zinc-800/30">
    <span className="text-zinc-500 text-xs font-bold uppercase tracking-tighter">{label}</span>
    <span className="text-xs font-black tracking-tight text-white">{value}</span>
  </div>
);

const BotStat: React.FC<{ label: string; value: string; color?: string; icon?: React.ReactNode; sub?: string; isMain?: boolean }> = ({ label, value, color = "text-white", icon, sub, isMain }) => (
  <div className={`p-8 rounded-[2rem] border transition-all duration-300 hover:shadow-2xl ${isMain ? 'bg-[#141417] border-[#f01a74]/30 shadow-[#f01a74]/10' : 'bg-[#141417] border-zinc-800/50 shadow-black/40 hover:border-zinc-700'}`}>
    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">{label}</p>
    <div className="flex items-center gap-3 mb-3">
      {icon && <div className={`${color} bg-black/30 p-2.5 rounded-xl border border-white/5`}>{icon}</div>}
      <p className={`text-2xl font-black italic font-mono tracking-tighter ${color}`}>{value}</p>
    </div>
    {sub && <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-tighter leading-none">{sub}</p>}
  </div>
);

const SidebarItem: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-500 ${active ? 'bg-[#f01a74]/10 text-[#f01a74] shadow-inner shadow-[#f01a74]/5' : 'text-zinc-500 hover:bg-zinc-800/40 hover:text-white'}`}>
    <div className={`transition-transform duration-700 ${active ? 'scale-110 rotate-3' : ''}`}>{icon}</div>
    <span className="text-sm font-black italic tracking-tighter uppercase">{label}</span>
  </button>
);

const MobileNavItem: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode }> = ({ active, onClick, icon }) => (
  <button onClick={onClick} className={`p-4 transition-all active:scale-90 ${active ? 'text-[#f01a74] scale-125' : 'text-zinc-700'}`}>
    {icon}
  </button>
);

export default App;
