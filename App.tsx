import React, { useState, useEffect, useRef } from 'react';
import { Wallet as EthersWallet, ethers } from 'ethers';
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

declare global {
  interface Window {
    puter: any;
  }
}
const puter = typeof window !== 'undefined' ? (window as any).puter : undefined;

import { Asset, Transaction, PerformanceData, ManagerProfile, SniperStep, FlowStep } from './types';
import { mockManager, mockAssets, mockPerformance, mockTransactions } from './services/mockData';
import { analyzePerformance } from './services/openai';
import { fetchHistoricalData, fetchCurrentPrice } from './services/marketDataService';
import { FlowSniperEngine } from './services/flowSniperEngine';
import { blockchainService } from './services/blockchainService';

const App: React.FC = () => {
  // Estados de Controle
  const [manager, setManager] = useState<ManagerProfile>(mockManager);
  const [activeTab, setActiveTab] = useState<'overview' | 'assets' | 'gas' | 'robots' | 'settings'>('overview');
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [botActive, setBotActive] = useState(false);
  const [mode, setMode] = useState<'REAL' | 'DEMO'>((localStorage.getItem('fs_mode') as 'REAL' | 'DEMO') || 'DEMO');

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

  const [realUsdtBalance, setRealUsdtBalance] = useState<string>('0.00');
  const [realPolBalance, setRealPolBalance] = useState<string>('0.00');
  const [isSyncing, setIsSyncing] = useState(false);
  const [pvtKeyError, setPvtKeyError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const fetchRealBalances = async () => {
    if (mode === 'REAL' && manager.address) {
      // Check if it's the mock address
      if (manager.address === mockManager.address) {
        console.warn("[BalanceDebug] Using mock address in REAL mode. balance will be 0.");
        return;
      }

      setIsSyncing(true);
      console.log("[BalanceDebug] Fetching for:", manager.address);

      try {
        const usdtAddr = '0xc2132d05d31c914a87c6611c10748aeb04b58e8f';
        const polAddr = '0x0000000000000000000000000000000000000000';

        // Fetch balances independently to avoid one failure blocking the other
        const usdt = await blockchainService.getBalance(usdtAddr, manager.address).catch(e => {
          console.error("[BalanceDebug] USDT Fetch Failed:", e);
          return '0.00';
        });

        const pol = await blockchainService.getBalance(polAddr, manager.address).catch(e => {
          console.error("[BalanceDebug] POL Fetch Failed:", e);
          return '0.00';
        });

        console.log("[BalanceDebug] Result - USDT:", usdt, "POL:", pol);
        setRealUsdtBalance(Number(usdt).toFixed(2));
        setRealPolBalance(Number(pol).toFixed(2));
        console.log("[BalanceDebug] UI State Updated - USDT:", Number(usdt).toFixed(2), "POL:", Number(pol).toFixed(2));
      } catch (err) {
        console.error("[BalanceDebug] General Sync Error:", err);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  useEffect(() => {
    if (mode === 'REAL') {
      fetchRealBalances();
      const interval = setInterval(fetchRealBalances, 30000); // 30s refresh
      return () => clearInterval(interval);
    }
  }, [mode, manager.address]);

  // Credentials State
  const [privateKey, setPrivateKey] = useState(localStorage.getItem('fs_private_key') || '');
  const [operatorAddress, setOperatorAddress] = useState(localStorage.getItem('fs_operator_address') || '');
  const [rpcUrl, setRpcUrl] = useState(localStorage.getItem('fs_polygon_rpc') || '');
  const [isConnectingMetaMask, setIsConnectingMetaMask] = useState(false);
  const [isSettingUpOperator, setIsSettingUpOperator] = useState(false);
  const [isGrantingAllowance, setIsGrantingAllowance] = useState(false);
  const [demoBalance, setDemoBalance] = useState<number>(0); // New Demo Balance State
  const [demoGasBalance, setDemoGasBalance] = useState<number>(0); // New Demo Gas State
  const [sniperLogs, setSniperLogs] = useState<SniperStep[]>([]);

  // Estados Financeiros
  const [dailyProfit, setDailyProfit] = useState(0);
  const [dailyLoss, setDailyLoss] = useState(0);

  // AI Analysis State
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Estados de Formulário
  const [liquidityAction, setLiquidityAction] = useState<'add' | 'remove'>('add');
  const [liquidityAmount, setLiquidityAmount] = useState('');
  const [gasAmount, setGasAmount] = useState<string>('');
  const [isRecharging, setIsRecharging] = useState(false);
  const [customAllowance, setCustomAllowance] = useState(() => localStorage.getItem('fs_custom_allowance') || '100');
  const [openAiKey, setOpenAiKey] = useState<string>(() => localStorage.getItem('flowsniper_openai_key') || '');

  // Persistir Chave AI & Configs
  useEffect(() => {
    localStorage.setItem('flowsniper_openai_key', openAiKey);
  }, [openAiKey]);

  useEffect(() => {
    localStorage.setItem('fs_custom_allowance', customAllowance);
  }, [customAllowance]);

  const rechargeGas = async () => {
    if (!gasAmount || Number(gasAmount) <= 0) return;

    if (mode === 'DEMO') {
      setDemoGasBalance(prev => prev + Number(gasAmount));
      setGasAmount('');
      alert(`RECARGA SIMULADA DE ${gasAmount} POL CONFIRMADA!`);
    } else {
      setIsRecharging(true);
      try {
        const txHash = await blockchainService.rechargeGas(gasAmount);
        alert(`RECARGA INICIADA! TX: ${txHash}`);
        setGasAmount('');
        fetchRealBalances(); // Refresh balances
      } catch (err: any) {
        alert("Erro na Recarga: " + err.message);
      } finally {
        setIsRecharging(false);
      }
    }
  };

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
    sniperRef.current = new FlowSniperEngine(
      (newStep: FlowStep) => {
        // Map FlowStep to SniperStep for the new UI
        const mappedStep: SniperStep = {
          id: newStep.id,
          timestamp: newStep.timestamp,
          path: newStep.pair.split('/'), // e.g. "WMATIC/USDC" -> ["WMATIC", "USDC"]
          profit: newStep.profit,
          status: newStep.status === 'SUCCESS' ? 'SUCCESS' : 'EXPIRED',
          hash: newStep.hash
        };

        setSniperLogs(prev => [mappedStep, ...prev].slice(0, 15));

        if (newStep.profit > 0) {
          setDailyProfit(prev => prev + newStep.profit);
        } else {
          setDailyLoss(prev => prev + Math.abs(newStep.profit));
        }
      },
      (newGas: number) => {
        if (mode === 'DEMO') setDemoGasBalance(newGas);
      },
      (newBal: number) => {
        if (mode === 'DEMO') setDemoBalance(newBal);
      }
    );

    return () => {
      if (sniperRef.current) sniperRef.current.stop();
    };
  }, [mode]);

  // Persist Mode
  useEffect(() => {
    localStorage.setItem('fs_mode', mode);
  }, [mode]);

  // --- LOGIC MERGE: Start/Stop Engine ---
  useEffect(() => {
    if (botActive && sniperRef.current) {
      sniperRef.current.start(mode, demoGasBalance, demoBalance, analysis);
    } else if (sniperRef.current) {
      sniperRef.current.stop();
    }
  }, [botActive, mode, demoGasBalance, demoBalance, analysis]);

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
    setPvtKeyError(null);
    if (!privateKey) return;

    // Validation: Check if user pasted an address (Starts with 0x and has 42 chars)
    if (privateKey.length === 42 && privateKey.startsWith('0x')) {
      setPvtKeyError("Erro: Você colou o ENDEREÇO da carteira. Para snipar, o robô precisa da CHAVE PRIVADA (Private Key) para assinar transações!");
      return;
    }

    if (privateKey) {
      try {
        const w = new EthersWallet(privateKey);
        localStorage.setItem('fs_private_key', privateKey);
        setManager(prev => ({ ...prev, address: w.address }));
        console.log("Derived address from PK:", w.address);
      } catch (e) {
        console.error("Failed to derive address from PK", e);
        setPvtKeyError("Chave Privada Inválida. Verifique se copiou corretamente da MetaMask (Exportar Chave Privada).");
        return;
      }
    }
    if (rpcUrl) localStorage.setItem('fs_polygon_rpc', rpcUrl);

    // Clear balances to force refresh
    setRealUsdtBalance('0.00');
    setRealPolBalance('0.00');

    alert('Credenciais Salvas! Sincronizando com a Blockchain...');
    fetchRealBalances();
  };

  const connectWallet = async () => {
    setIsConnectingMetaMask(true);
    try {
      const addr = await blockchainService.connectWallet();
      setManager(prev => ({ ...prev, address: addr }));
      localStorage.setItem('fs_owner_address', addr);
      alert("Carteira Conectada: " + addr);
    } catch (e: any) {
      alert("Erro ao conectar carteira: " + e.message);
    } finally {
      setIsConnectingMetaMask(false);
    }
  };

  const setupOperator = async () => {
    if (!manager.address) return alert("Conecte a MetaMask primeiro.");
    setIsSettingUpOperator(true);
    try {
      const opAddr = await blockchainService.setupOperator(manager.address);
      setOperatorAddress(opAddr);
      localStorage.setItem('fs_operator_address', opAddr);
      alert("Operador Configurado com Sucesso!\nEndereço: " + opAddr);
    } catch (e: any) {
      alert("Erro ao configurar operador: " + e.message);
    } finally {
      setIsSettingUpOperator(false);
    }
  };

  const grantAllowance = async () => {
    setIsGrantingAllowance(true);
    try {
      const usdtAddr = '0xc2132d05d31c914a87c6611c10748aeb04b58e8f';
      const amountRaw = ethers.parseUnits(customAllowance, 6).toString();
      const tx = await blockchainService.grantAllowance(usdtAddr, amountRaw);
      alert(`Permissão de ${customAllowance} USDT Concedida! TX: ${tx}`);
      fetchRealBalances();
    } catch (e: any) {
      alert("Erro ao conceder permissão: " + e.message);
    } finally {
      setIsGrantingAllowance(false);
    }
  };

  // --- LOGIC MERGE: AI & Market Data Fetch ---
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        // Timeout de segurança: Se a IA demorar mais de 10s, destrava
        const history = await fetchHistoricalData('POLUSDT', '1', 50);

        if (history.length > 0) {
          // Wrapped Promise Race with Cleanup
          let timeoutHandle: any;

          const timeoutPromise = new Promise((_, reject) => {
            timeoutHandle = setTimeout(() => reject(new Error("AI Timeout")), 10000);
          });

          try {
            const aiResult = await Promise.race([
              analyzePerformance(mockAssets, mockTransactions, openAiKey).finally(() => clearTimeout(timeoutHandle)),
              timeoutPromise
            ]) as any;

            const provider = openAiKey.startsWith('sk-') ? 'OpenAI' : (typeof puter !== 'undefined' ? 'Puter.js' : 'Pollinations AI');
            setAnalysis({ ...aiResult, provider });
          } catch (raceError) {
            throw raceError; // Re-throw to be caught by outer catch
          }
        } else {
          console.warn("Market Data unavailable, skipping AI");
          setAnalysis({
            suggestedStrategy: "Accumulation (Offline Data)",
            riskLevel: "Low",
            marketSentiment: "Neutral",
            confidence: 50,
            action: "HOLD"
          });
        }
      } catch (e) {
        console.error("Data init failed or Timed out", e);
        // Fallback state em caso de erro
        setAnalysis({
          suggestedStrategy: "Scalping (Fallback Mode)",
          riskLevel: "Medium",
          marketSentiment: "Volatile",
          confidence: 60,
          action: "WAIT"
        });
      } finally {
        setLoading(false);
      }
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
          <span className="font-bold text-2xl tracking-tighter bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent italic">FLOWSNIPER <span className="text-[10px] text-emerald-500 non-italic border border-emerald-500/20 px-1 rounded">v4.1.4 Discovery</span></span>
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
              {/* Warning: Real mode with Mock Address */}
              {mode === 'REAL' && manager.address === mockManager.address && (
                <div className="bg-rose-500/10 border border-rose-500/30 p-6 rounded-[2rem] flex items-center gap-6 animate-pulse">
                  <div className="w-12 h-12 bg-rose-500/20 rounded-xl flex items-center justify-center border border-rose-500/30">
                    <ShieldCheck size={24} className="text-rose-500" />
                  </div>
                  <div>
                    <h4 className="text-rose-500 font-black italic uppercase tracking-tighter">Atenção: Carteira não configurada</h4>
                    <p className="text-zinc-400 text-xs font-medium">Você está no modo <span className="text-rose-500 font-bold">REAL</span>, mas ainda não salvou sua Chave Privada em Configurações. O saldo refletido é zero.</p>
                  </div>
                </div>
              )}
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
                        <span className="text-[10px] text-zinc-500">Powered by {analysis.provider || 'AI Engine'}</span>
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
                  value={mode === 'DEMO' ? (demoBalance || 0).toFixed(2) : (isSyncing && realUsdtBalance === '0.00' ? '...' : realUsdtBalance)}
                  unit={mode === 'DEMO' ? "USDT (DEMO)" : "USDT"}
                  onAdd={() => setActiveTab('assets')}
                  onRemove={() => setActiveTab('assets')}
                  isLoading={isSyncing && realUsdtBalance === '0.00'}
                  onRefresh={fetchRealBalances}
                />
                <SummaryCard
                  title="Reserva Operacional"
                  value={mode === 'DEMO' ? demoGasBalance.toFixed(2) : (isSyncing && realPolBalance === '0.00' ? '...' : realPolBalance)}
                  unit="POL"
                  onAdd={() => setActiveTab('gas')}
                  onRemove={() => setActiveTab('gas')}
                  isLoading={isSyncing && realPolBalance === '0.00'}
                  onRefresh={fetchRealBalances}
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
                  <div className="flex-1 overflow-hidden">
                    <div className="p-8 space-y-4 max-h-[350px] overflow-y-auto custom-scrollbar font-mono text-[10px]">
                      {sniperLogs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center py-20 text-center opacity-20">
                          <Cpu size={48} className="mb-4" />
                          <p className="text-sm font-bold italic tracking-tight uppercase">Aguardando comando do Motor Sniper</p>
                        </div>
                      ) : (
                        sniperLogs.slice(0, 5).map((log) => (
                          <div key={log.id} className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5 animate-in slide-in-from-left-5 duration-300">
                            <div className="flex items-center gap-4">
                              <div className={`w-1.5 h-1.5 rounded-full ${log.profit < 0 ? 'bg-rose-500' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`}></div>
                              <div className="flex flex-col">
                                <span className="text-zinc-400 font-black">{log.path.join(' → ')}</span>
                                <span className="text-zinc-600 text-[9px]">{log.timestamp}</span>
                              </div>
                            </div>
                            <span className={`font-black ${log.profit < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                              {log.profit > 0 ? '+' : ''}{log.profit.toFixed(4)} <span className="text-zinc-700">POL</span>
                            </span>
                          </div>
                        ))
                      )}
                    </div>
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
                      <h3 className="font-black text-sm uppercase tracking-widest italic">Live Flow Stream</h3>
                    </div>
                    <div className="flex items-center gap-8">
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] text-zinc-500 font-bold uppercase mb-0.5">Total Ops</span>
                        <span className="text-xs font-mono font-bold text-white">{sniperLogs.length}</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-8 space-y-3 font-mono text-[11px] max-h-[500px] overflow-y-auto custom-scrollbar">
                    {sniperLogs.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-24 opacity-10">
                        <Search size={48} className="mb-6 animate-bounce" />
                        <p className="text-lg font-black italic uppercase">Buscando Rotas Lucrativas...</p>
                      </div>
                    )}
                    {sniperLogs.map((log) => (
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
                <h2 className="text-7xl font-black font-mono tracking-tighter relative z-10">
                  {mode === 'DEMO' ? demoBalance.toFixed(2) : realUsdtBalance}
                  <span className="text-zinc-700 text-4xl uppercase font-sans">USDT</span>
                </h2>
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
                    <button
                      onClick={() => {
                        if (mode === 'DEMO' && liquidityAction === 'add') {
                          setDemoBalance(prev => prev + Number(liquidityAmount));
                          setLiquidityAmount('');
                          alert(`APORTE SIMULADO DE ${liquidityAmount} USDT CONFIRMADO!`);
                        } else if (mode === 'DEMO' && liquidityAction === 'remove') {
                          setDemoBalance(prev => Math.max(0, prev - Number(liquidityAmount)));
                          setLiquidityAmount('');
                          alert(`SAQUE SIMULADO DE ${liquidityAmount} USDT CONFIRMADO!`);
                        } else {
                          alert("Modo REAL: Funcionalidade de Depósito via contrato inteligente em breve.");
                        }
                      }}
                      className="w-full bg-[#f01a74] py-6 rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-[#d01664] transition-all active:scale-[0.98] shadow-2xl shadow-[#f01a74]/20 border border-[#f01a74]/20"
                    >
                      Confirmar Operação {mode === 'DEMO' ? '(SIMULAÇÃO)' : 'Privada'}
                    </button>
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
                      value={gasAmount}
                      onChange={(e) => setGasAmount(e.target.value)}
                      disabled={isRecharging}
                      className={`w-full bg-[#0c0c0e] border border-zinc-800 rounded-2xl p-5 font-mono text-3xl text-center outline-none focus:border-blue-500/50 transition-all ${isRecharging ? 'opacity-50 cursor-not-allowed' : ''}`}
                      placeholder="0.00 POL"
                    />
                  </div>
                  <button
                    onClick={rechargeGas}
                    disabled={isRecharging || !gasAmount}
                    className={`w-full py-6 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 shadow-2xl border ${isRecharging ? 'bg-zinc-800 text-zinc-500 border-zinc-700 cursor-wait' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-500/20 border-blue-400/20'}`}
                  >
                    {isRecharging ? 'Processando Recarga...' : 'Recarregar Combustível'}
                  </button>
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
                        onChange={(e) => { setPrivateKey(e.target.value); setPvtKeyError(null); }}
                        className={`w-full bg-[#0c0c0e] border ${pvtKeyError ? 'border-rose-500/50' : 'border-zinc-800'} rounded-2xl py-5 pl-14 pr-6 text-emerald-500 font-mono text-sm outline-none focus:border-[#f01a74]/50 transition-all placeholder:text-zinc-800`}
                        placeholder="0x... (CHAVE PRIVADA)"
                      />
                    </div>
                    {pvtKeyError && (
                      <p className="text-[11px] text-rose-500 font-bold bg-rose-500/10 p-4 rounded-xl border border-rose-500/20 animate-in fade-in slide-in-from-top-2 duration-300">
                        {pvtKeyError}
                      </p>
                    )}
                    <p className="text-[10px] text-zinc-600 italic">Nunca compartilhe sua chave privada. Ela é usada para assinar transações no modo REAL.</p>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                      <Cpu size={14} className="text-[#f01a74]" /> OpenAI API Key (Opcional - Backup do Puter)
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        value={openAiKey}
                        onChange={(e) => setOpenAiKey(e.target.value)}
                        placeholder="sk-..."
                        className="w-full bg-[#0c0c0e] border border-zinc-800 rounded-2xl p-5 font-mono text-xs outline-none focus:border-[#f01a74]/50 transition-all"
                      />
                    </div>
                    <p className="text-[9px] text-zinc-600 italic">* Se deixado em branco, o sistema tentará usar o Puter (Grátis) automaticamente.</p>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Alchemy / Polygon RPC URL</label>
                    <div className="relative">
                      <Zap className="absolute left-6 top-1/2 -translate-y-1/2 text-[#f01a74]" size={18} />
                      <input
                        type="text"
                        value={rpcUrl}
                        onChange={(e) => setRpcUrl(e.target.value)}
                        className="w-full bg-[#0c0c0e] border border-zinc-800 rounded-2xl py-5 pl-14 pr-6 text-emerald-400 font-mono text-sm outline-none focus:border-[#f01a74]/50 transition-all placeholder:text-zinc-800"
                        placeholder="https://polygon-mainnet.g.alchemy.com/v2/sua-chave"
                      />
                    </div>
                    <p className="text-[10px] text-zinc-600 italic">* Use o Alchemy para execução ultra-rápida (Plano Free ou Pago).</p>
                  </div>

                  <button onClick={saveCredentials} className="px-10 py-5 bg-zinc-800 rounded-2xl font-black text-xs uppercase tracking-widest text-zinc-400 hover:text-white transition-all active:scale-95 border border-zinc-700">
                    Salvar Credenciais (Manual)
                  </button>

                  <div className="pt-8 border-t border-zinc-800/50 space-y-6">
                    <h3 className="text-xl font-black italic uppercase tracking-tighter">Fluxo de Conexão Rabby</h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <button
                        onClick={connectWallet}
                        disabled={isConnectingMetaMask}
                        className={`p-6 rounded-2xl border flex flex-col items-center gap-3 transition-all ${manager.address && manager.address !== mockManager.address ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-[#141417] border-zinc-800 hover:border-[#f01a74] text-zinc-400'}`}
                      >
                        <Wallet size={24} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{isConnectingMetaMask ? 'Conectando...' : '1. Conectar Rabby'}</span>
                      </button>

                      <button
                        onClick={setupOperator}
                        disabled={isSettingUpOperator || !manager.address || manager.address === mockManager.address}
                        className={`p-6 rounded-2xl border flex flex-col items-center gap-3 transition-all ${operatorAddress ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-[#141417] border-zinc-800 hover:border-[#f01a74] text-zinc-400 opacity-50 disabled:cursor-not-allowed'}`}
                      >
                        <ShieldCheck size={24} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{isSettingUpOperator ? 'Autorizando...' : '2. Autorizar Operador'}</span>
                      </button>

                      <div className="flex flex-col gap-4">
                        <div className="bg-[#0c0c0e] border border-zinc-800 rounded-2xl p-4 flex flex-col gap-2">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase">Limite de Allowance (USDT)</label>
                          <input
                            type="number"
                            value={customAllowance}
                            onChange={(e) => setCustomAllowance(e.target.value)}
                            className="bg-transparent border-none text-emerald-500 font-mono text-lg outline-none"
                            placeholder="100"
                          />
                        </div>
                        <button
                          onClick={grantAllowance}
                          disabled={isGrantingAllowance || !operatorAddress}
                          className={`p-6 rounded-2xl border flex flex-col items-center gap-3 transition-all bg-[#141417] border-zinc-800 hover:border-[#f01a74] text-zinc-400 ${!operatorAddress ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <Zap size={24} />
                          <span className="text-[10px] font-black uppercase tracking-widest">{isGrantingAllowance ? 'Processando...' : '3. Permitir USDT'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Painel de Diagnóstico */}
                <div className="mt-12 p-8 bg-black/40 border border-zinc-800 rounded-[2.5rem] space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                      <Activity size={16} className="text-emerald-500" /> Diagnóstico de Conexão
                    </h3>
                    <button onClick={fetchRealBalances} className="text-[10px] font-bold text-zinc-500 hover:text-white uppercase tracking-tighter transition-colors">Testar agora</button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-[#0c0c0e] p-4 rounded-2xl border border-zinc-800/50">
                      <p className="text-[9px] text-zinc-600 font-bold uppercase mb-1">Endereço Dono (Master Node)</p>
                      <p className="text-[10px] font-mono text-zinc-300 break-all">{manager.address}</p>
                    </div>
                    <div className="bg-[#0c0c0e] p-4 rounded-2xl border border-zinc-800/50">
                      <p className="text-[9px] text-[#f01a74] font-bold uppercase mb-1">Endereço do Robô (Operador / Gas)</p>
                      <p className="text-[10px] font-mono text-zinc-300 break-all">{operatorAddress || 'Não configurado'}</p>
                    </div>
                    <div className="bg-[#0c0c0e] p-4 rounded-2xl border border-zinc-800/50">
                      <p className="text-[9px] text-zinc-600 font-bold uppercase mb-1">Estado do RPC</p>
                      <p className={`text-[10px] font-bold uppercase ${syncError ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {syncError ? 'Falha de Conexão' : 'Operacional (OK)'}
                      </p>
                    </div>
                  </div>

                  {syncError && (
                    <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-xl">
                      <p className="text-[9px] text-rose-500 font-black uppercase mb-1 tracking-widest">Logs de Erro</p>
                      <p className="text-[10px] font-mono text-rose-400 leading-tight">{syncError}</p>
                    </div>
                  )}

                  <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
                    <p className="text-[10px] text-zinc-500 leading-relaxed font-medium italic">
                      💡 Se o endereço acima NÃO for o mesmo da sua MetaMask, sua Chave Privada está incorreta ou pertence a outra conta.
                    </p>
                  </div>
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
const SummaryCard: React.FC<{ title: string; value: string; unit: string; onAdd: () => void; onRemove: () => void; isLoading?: boolean; onRefresh?: () => void }> = ({ title, value, unit, onAdd, onRemove, isLoading, onRefresh }) => (
  <div className="bg-[#141417] rounded-[2.5rem] border border-zinc-800/50 p-10 shadow-2xl hover:border-[#f01a74]/30 transition-all group overflow-hidden relative">
    <div className="absolute inset-0 bg-gradient-to-br from-[#f01a74]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
    <div className="flex justify-between items-start mb-4 relative z-10">
      <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">{title}</p>
      {onRefresh && (
        <button onClick={onRefresh} className={`text-zinc-600 hover:text-[#f01a74] transition-colors ${isLoading ? 'animate-spin' : ''}`}>
          <Activity size={14} />
        </button>
      )}
    </div>
    <h2 className={`text-5xl font-black mb-10 font-mono tracking-tighter relative z-10 ${isLoading ? 'animate-pulse text-zinc-600' : ''}`}>
      {value} <span className="text-zinc-700 text-2xl uppercase font-sans">{unit}</span>
    </h2>
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
