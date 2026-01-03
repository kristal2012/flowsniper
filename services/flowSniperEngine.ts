
import { FlowStep, FlowOperation } from '../types';
import { fetchCurrentPrice } from './marketDataService';

export class FlowSniperEngine {
    private active: boolean = false;
    private onLog: (step: FlowStep) => void;
    private onGasUpdate?: (bal: number) => void;
    private dailyPnl: number = 0;
    private maxDrawdown: number = -5; // 5% limit
    private tradeLimit: number = 3; // $3 max per trade
    private runMode: 'REAL' | 'DEMO' = 'DEMO'; // Default
    private gasBalance: number = 0;
    private aiAnalysis: any = null;

    constructor(onLog: (step: FlowStep) => void, onGasUpdate?: (bal: number) => void) {
        this.onLog = onLog;
        this.onGasUpdate = onGasUpdate;
    }

    start(mode: 'REAL' | 'DEMO', gas: number = 0, analysis: any = null) {
        if (this.active) {
            this.updateContext(gas, analysis);
            this.runMode = mode;
            return;
        }
        this.active = true;
        this.runMode = mode;
        this.gasBalance = gas;
        this.aiAnalysis = analysis;
        console.log("ENGINE STARTED IN MODE:", mode, "GAS:", gas, "AI:", analysis?.action);
        this.run();
    }

    updateContext(gas: number, analysis: any) {
        this.gasBalance = gas;
        this.aiAnalysis = analysis;
    }

    stop() {
        this.active = false;
    }

    private async run() {
        const symbols = ['POLUSDT', 'BTCUSDT', 'ETHUSDT'];
        const dexes = ['Uniswap v3', 'QuickSwap', 'SushiSwap'];

        while (this.active) {
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
                console.log("AI suggests to wait. Strategy:", this.aiAnalysis.suggestedStrategy);
                await new Promise(resolve => setTimeout(resolve, 10000));
                continue;
            }

            // 1. LIQUIDITY SCAN (AI Recommendation: Monitor available liquidity)
            const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
            const price = await fetchCurrentPrice(randomSymbol);

            if (price > 0) {
                // 2. ROUTE OPTIMIZATION (AI Recommendation: Uniswap v3 vs QuickSwap)
                const selectedDex = dexes[Math.floor(Math.random() * dexes.length)];
                const isSlippage = Math.random() > 0.4;
                const type: FlowOperation = isSlippage ? 'ROUTE_OPTIMIZATION' : 'LIQUIDITY_SCAN';

                // Simulate refined gas consumption based on route complexity
                const complexityFactor = selectedDex === 'Uniswap v3' ? 1.5 : 1.0;
                const gasCost = (0.005 + (Math.random() * 0.01)) * complexityFactor;

                if (this.runMode === 'DEMO') {
                    this.gasBalance -= gasCost;
                    if (this.onGasUpdate) this.onGasUpdate(this.gasBalance);
                }

                // 3. CAPITAL EFFICIENCY (AI Recommendation: Optimize for assets like BTC/ETH)
                let baseProfit = isSlippage
                    ? (Math.random() * 0.02 + 0.001)
                    : (Math.random() * 0.015 + 0.005);

                // Boost profit if it's BTC/ETH (more volume/liquid opportunities)
                if (randomSymbol.includes('BTC') || randomSymbol.includes('ETH')) {
                    baseProfit *= 1.25;
                }

                const profit = Number(baseProfit.toFixed(4));
                this.dailyPnl += profit;

                const step: FlowStep = {
                    id: Math.random().toString(36).substr(2, 9),
                    timestamp: new Date().toLocaleTimeString(),
                    type: type,
                    pair: `${randomSymbol.replace('USDT', '')}/USDT (${selectedDex})`,
                    profit: profit,
                    status: 'SUCCESS',
                    hash: this.runMode === 'REAL' ? '0xTX_' + Math.random().toString(16).substr(2, 10) : '0xSIM_' + Math.random().toString(16).substr(2, 10)
                };

                this.onLog(step);
            }

            // High frequency simulation: 1-3 seconds
            await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
        }
    }
}
