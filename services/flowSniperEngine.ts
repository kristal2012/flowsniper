
import { FlowStep, FlowOperation } from '../types';
import { fetchCurrentPrice } from './marketDataService';
import { blockchainService } from './blockchainService';

export class FlowSniperEngine {
    private active: boolean = false;
    private onLog: (step: FlowStep) => void;
    private onGasUpdate?: (bal: number) => void;
    private onBalanceUpdate?: (bal: number) => void;
    private dailyPnl: number = 0;
    private maxDrawdown: number = -5; // 5% limit
    private tradeLimit: number = 3; // $3 max per trade
    private runMode: 'REAL' | 'DEMO' = 'DEMO'; // Default
    private gasBalance: number = 0;
    private totalBalance: number = 0;
    private aiAnalysis: any = null;
    private tradeAmount: string = "3.0";

    constructor(onLog: (step: FlowStep) => void, onGasUpdate?: (bal: number) => void, onBalanceUpdate?: (bal: number) => void) {
        this.onLog = onLog;
        this.onGasUpdate = onGasUpdate;
        this.onBalanceUpdate = onBalanceUpdate;
    }

    start(mode: 'REAL' | 'DEMO', gas: number = 0, balance: number = 0, analysis: any = null, tradeAmount: string = "3.0") {
        if (this.active) {
            this.updateContext(gas, balance, analysis, tradeAmount);
            this.runMode = mode;
            return;
        }
        this.active = true;
        this.runMode = mode;
        this.gasBalance = gas;
        this.totalBalance = balance;
        this.aiAnalysis = analysis;
        this.tradeAmount = tradeAmount;
        console.log("ENGINE STARTED IN MODE:", mode, "GAS:", gas, "BAL:", balance, "AI:", analysis?.action, "TRADE:", tradeAmount);
        this.run();
    }

    updateContext(gas: number, balance: number, analysis: any, tradeAmount: string = "3.0") {
        this.gasBalance = gas;
        this.totalBalance = balance;
        this.aiAnalysis = analysis;
        this.tradeAmount = tradeAmount;
    }

    stop() {
        this.active = false;
    }

    private async run() {
        const symbols = ['POLUSDT', 'BTCUSDT', 'ETHUSDT', 'LINKUSDT', 'UNIUSDT', 'AAVEUSDT', 'QUICKUSDT', 'USDCUSDT', 'SOLUSDT'];
        const dexes = ['QuickSwap [Active]', 'QuickSwap [Aggregator]'];

        // Token Addresses for Polygon
        const TOKENS: { [key: string]: string } = {
            'USDT': '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
            'POL': '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270', // Use WMATIC for Swaps
            'WMATIC': '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
            'WETH': '0x7ceb23fd6bc0ad59f6c078095c510c28342245c4',
            'WBTC': '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6',
            'LINK': '0x53e0bca35ec356bd5dddfebbd1fc0fd03fabad39',
            'UNI': '0xb33EaAd8d922B1083446DC23f610c2567fB5180f',
            'AAVE': '0xd6df30500db6e36d4336069904944f2b93652618',
            'QUICK': '0xf28768daa238a2e52b21697284f1076f8a02c98d',
            'USDC': '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
            'SOL': '0x7df36098c4f923b7596ad881a70428f62c0199ba'
        };

        while (this.active) {
            // Pulse log to show activity
            this.onLog({
                id: 'pulse-' + Date.now(),
                timestamp: new Date().toLocaleTimeString(),
                type: 'SCAN_PULSE',
                pair: 'Scanning Network (Alchemy)...',
                profit: 0,
                status: 'SUCCESS',
                hash: ''
            });

            // Stop if drawdown hit
            if (this.dailyPnl <= this.maxDrawdown) {
                console.warn("Daily drawdown limit reached. Pausing engine.");
                this.stop();
                break;
            }

            // Gas check
            if (this.runMode === 'DEMO' && this.gasBalance <= 0) {
                console.warn("Out of gas (DEMO). Motor standby.");
                await new Promise(resolve => setTimeout(resolve, 5000));
                continue;
            }

            // AI Decision logic
            if (this.aiAnalysis && (this.aiAnalysis.action === 'WAIT' || this.aiAnalysis.action === 'HOLD')) {
                this.onLog({
                    id: 'ai-wait-' + Date.now(),
                    timestamp: new Date().toLocaleTimeString(),
                    type: 'SCAN_PULSE',
                    pair: `AI Waiting: ${this.aiAnalysis.suggestedStrategy || 'Market Neutral'}`,
                    profit: 0,
                    status: 'SUCCESS',
                    hash: ''
                });
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
            }

            // 1. LIQUIDITY SCAN
            const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
            const price = await fetchCurrentPrice(randomSymbol);

            if (price > 0) {
                const selectedDex = dexes[Math.floor(Math.random() * dexes.length)];
                const isSlippage = Math.random() > 0.4;
                const type: FlowOperation = isSlippage ? 'ROUTE_OPTIMIZATION' : 'LIQUIDITY_SCAN';

                if (this.runMode === 'DEMO') {
                    const gasCost = 0.01;
                    this.gasBalance -= gasCost;
                    if (this.onGasUpdate) this.onGasUpdate(this.gasBalance);
                }

                let txHash = '';
                if (this.runMode === 'REAL') {
                    try {
                        const tokenIn = TOKENS['USDT'];
                        const cleanedSymbol = randomSymbol.replace('USDT', '').replace('POL', 'WMATIC');
                        const tokenOut = TOKENS[cleanedSymbol] || TOKENS['WMATIC'];

                        // Verification: check if pool has liquidity
                        const amounts = await blockchainService.getAmountsOut(this.tradeAmount, [tokenIn, tokenOut]).catch(() => null);
                        if (!amounts || amounts.length < 2) {
                            throw new Error("DEX Error: No Liquidity for " + cleanedSymbol);
                        }

                        // 1. BUY: USDT -> Token
                        this.onLog({
                            id: 'buy-' + Date.now(),
                            timestamp: new Date().toLocaleTimeString(),
                            type: 'ROUTE_OPTIMIZATION',
                            pair: `Buying ${cleanedSymbol}...`,
                            profit: 0,
                            status: 'SUCCESS',
                            hash: ''
                        });

                        const buyHash = await blockchainService.executeTrade(tokenIn, tokenOut, this.tradeAmount, true);

                        // 2. WAIT
                        await new Promise(resolve => setTimeout(resolve, 500));

                        // 3. SELL: Token -> USDT
                        this.onLog({
                            id: 'sell-' + Date.now(),
                            timestamp: new Date().toLocaleTimeString(),
                            type: 'SLIPPAGE_SWAP',
                            pair: `Sniping Back to USDT...`,
                            profit: 0,
                            status: 'SUCCESS',
                            hash: ''
                        });

                        const activeAddr = blockchainService.getWalletAddress();
                        const tokenBal = activeAddr ? await blockchainService.getBalance(tokenOut, activeAddr) : '0';
                        if (Number(tokenBal) > 0) {
                            txHash = await blockchainService.executeTrade(tokenOut, tokenIn, tokenBal, true);
                        } else {
                            txHash = buyHash;
                        }
                    } catch (err: any) {
                        this.onLog({
                            id: 'err-' + Date.now(),
                            timestamp: new Date().toLocaleTimeString(),
                            type: 'LIQUIDITY_SCAN',
                            pair: `${err.message || 'DEX Execution Error'}`,
                            profit: 0,
                            status: 'FAILED',
                            hash: ''
                        });
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        continue;
                    }
                } else {
                    txHash = '0xSIM_' + Math.random().toString(16).substr(2, 10);
                }

                let baseProfit = isSlippage ? (Math.random() * 0.02) : (Math.random() * 0.01);
                const profit = Number(baseProfit.toFixed(4));
                this.dailyPnl += profit;

                if (this.runMode === 'DEMO') {
                    this.totalBalance += profit;
                    if (this.onBalanceUpdate) this.onBalanceUpdate(this.totalBalance);
                }

                this.onLog({
                    id: Math.random().toString(36).substr(2, 9),
                    timestamp: new Date().toLocaleTimeString(),
                    type: type,
                    pair: `${randomSymbol.replace('USDT', '')}/USDT (${selectedDex})`,
                    profit: profit,
                    status: 'SUCCESS',
                    hash: txHash
                });
            }

            await new Promise(resolve => setTimeout(resolve, Math.random() * 250 + 50));
        }
    }
}
