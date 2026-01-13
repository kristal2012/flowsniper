
import { FlowStep, FlowOperation } from '../types';
import { fetchCurrentPrice } from './marketDataService';
import { blockchainService } from './blockchainService';
import { ethers } from 'ethers';

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
    private tradeAmount: string = "10.0"; // Increased for better gas efficiency
    private slippage: number = 0.005; // 0.5%
    private minProfit: number = 0.001; // 0.1%
    private consolidationThreshold: number = 10.0;

    constructor(onLog: (step: FlowStep) => void, onGasUpdate?: (bal: number) => void, onBalanceUpdate?: (bal: number) => void) {
        this.onLog = onLog;
        this.onGasUpdate = onGasUpdate;
        this.onBalanceUpdate = onBalanceUpdate;
    }

    start(mode: 'REAL' | 'DEMO', gas: number = 0, balance: number = 0, analysis: any = null, tradeAmount: string = "10.0", slippage: number = 0.005, minProfit: number = 0.001, consolidationThreshold: number = 10.0) {
        if (this.active) {
            this.updateContext(gas, balance, analysis, tradeAmount, slippage, minProfit, consolidationThreshold);
            this.runMode = mode;
            return;
        }
        this.active = true;
        this.runMode = mode;
        this.gasBalance = gas;
        this.totalBalance = balance;
        this.aiAnalysis = analysis;
        this.tradeAmount = tradeAmount;
        this.slippage = slippage;
        this.minProfit = minProfit;
        this.consolidationThreshold = consolidationThreshold;
        console.log("ENGINE STARTED IN MODE:", mode, "GAS:", gas, "BAL:", balance, "AI:", analysis?.action, "TRADE:", tradeAmount, "SLIPPAGE:", slippage, "THRESHOLD:", consolidationThreshold);
        this.run();
    }

    updateContext(gas: number, balance: number, analysis: any, tradeAmount: string = "10.0", slippage: number = 0.005, minProfit: number = 0.001, consolidationThreshold: number = 10.0) {
        this.gasBalance = gas;
        this.totalBalance = balance;
        this.aiAnalysis = analysis;
        this.tradeAmount = tradeAmount;
        this.slippage = slippage;
        this.minProfit = minProfit;
        this.consolidationThreshold = consolidationThreshold;
    }

    stop() {
        this.active = false;
    }

    private async run() {
        const symbols = ['POLUSDT', 'WMATICUSDT', 'ETHUSDT', 'BTCUSDT', 'USDCUSDT']; // High liquidity pairs only
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

        const GAS_ESTIMATE_USDT = 0.03;

        while (this.active) {
            // Pulse log
            this.onLog({
                id: 'pulse-' + Date.now(),
                timestamp: new Date().toLocaleTimeString(),
                type: 'SCAN_PULSE',
                pair: 'Scanning: Buscando distorção de preço DEX vs Global...',
                profit: 0,
                status: 'SUCCESS',
                hash: ''
            });

            if (this.dailyPnl <= this.maxDrawdown) {
                this.stop();
                break;
            }

            if (this.runMode === 'DEMO' && this.gasBalance <= 0) {
                await new Promise(resolve => setTimeout(resolve, 5000));
                continue;
            }

            // AI Analysis is kept for UI/Metadata but no longer blocks the sniper's local price check

            // 1. SELECT TARGET
            const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
            const price = await fetchCurrentPrice(randomSymbol);

            if (price <= 0) {
                this.onLog({
                    id: 'pulse-' + Date.now(),
                    timestamp: new Date().toLocaleTimeString(),
                    type: 'SCAN_PULSE',
                    pair: `SCAN: Erro ao obter cotação de ${randomSymbol} (API Bloqueada/CORS).`,
                    profit: 0,
                    status: 'SUCCESS',
                    hash: ''
                });
                await new Promise(resolve => setTimeout(resolve, 3000));
                continue;
            }

            if (price > 0) {
                const selectedDex = dexes[Math.floor(Math.random() * dexes.length)];
                const tokenIn = TOKENS['USDT'];

                // --- SYMBOL MAPPING FIX ---
                let searchTag = randomSymbol.replace('USDT', '');
                if (searchTag === 'BTC') searchTag = 'WBTC';
                if (searchTag === 'ETH') searchTag = 'WETH';
                if (searchTag === 'POL') searchTag = 'WMATIC';

                const tokenOut = TOKENS[searchTag];

                // If we don't have the address for this token on Polygon, skip it to avoid bugs
                if (!tokenOut) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    continue;
                }

                // Using global GAS_ESTIMATE_USDT (0.03)

                // --- SMART STRATEGY: PRE-FLIGHT VERIFICATION ---
                let isProfitable = false;
                let estimatedNetProfit = 0;
                let buyAmountOut = "0";

                // Route Optimization State
                let bestRoute = 'QuickSwap (V2)';
                let useV3 = false;
                let txHash = '';
                let buyHash = '';
                let actualProfit = 0;
                let successTrade = false;

                try {
                    // Step A: How much token do we get for our USDT?
                    console.log(`[Strategy] Checking ${searchTag}: Fetching QUOTES (V2 vs V3) for ${this.tradeAmount} USDT...`);

                    // Parallel Fetch for Speed
                    const [v2Amounts, v3Amount] = await Promise.all([
                        blockchainService.getAmountsOut(this.tradeAmount, [tokenIn, tokenOut]),
                        blockchainService.getQuoteV3(tokenIn, tokenOut, this.tradeAmount)
                    ]);

                    let bestAmountOut = 0;

                    // Analyze V2
                    if (v2Amounts && v2Amounts.length >= 2) {
                        const decimalsOut = await (blockchainService as any).getTokenDecimals(tokenOut);
                        const v2Out = Number(v2Amounts[1]) / (10 ** decimalsOut);
                        if (v2Out > bestAmountOut) {
                            bestAmountOut = v2Out;
                            bestRoute = 'QuickSwap (V2)';
                            useV3 = false;
                        }
                    }

                    // Analyze V3
                    const v3Out = Number(v3Amount);
                    if (v3Out > bestAmountOut) {
                        bestAmountOut = v3Out;
                        bestRoute = 'Uniswap (V3)';
                        useV3 = true;
                    }

                    if (bestAmountOut > 0) {
                        buyAmountOut = bestAmountOut.toString();

                        // Step B: Compare with Global Price
                        const globalPrice = price;
                        const globalValueUsdt = Number(buyAmountOut) * globalPrice;

                        const grossProfit = globalValueUsdt - Number(this.tradeAmount);
                        const totalGas = (GAS_ESTIMATE_USDT * 2);
                        estimatedNetProfit = grossProfit - totalGas;

                        const targetProfit = Number(this.tradeAmount) * this.minProfit;

                        console.log(`[Strategy] ${searchTag} [${bestRoute}]: Buy ${buyAmountOut} tokens @ Global $${globalPrice} = $${globalValueUsdt.toFixed(4)} | Gross: $${grossProfit.toFixed(4)} | Net: $${estimatedNetProfit.toFixed(4)}`);

                        if (estimatedNetProfit > targetProfit) {
                            isProfitable = true;
                            console.log(`[Strategy] ✅ ${searchTag} IS PROFITABLE on ${bestRoute}! Executing...`);
                        } else if (grossProfit > 0) {
                            // Provide feedback: Trade found but gas/profit too low
                            const spreadPct = (grossProfit / Number(this.tradeAmount)) * 100;
                            this.onLog({
                                id: 'pulse-' + Date.now(),
                                timestamp: new Date().toLocaleTimeString(),
                                type: 'SCAN_PULSE',
                                pair: `${searchTag}: Spread ${spreadPct.toFixed(2)}% em ${bestRoute}. Inviável por Gás ($${totalGas.toFixed(2)}).`,
                                profit: 0,
                                status: 'SUCCESS',
                                hash: ''
                            });
                        }
                    }

                    await new Promise(resolve => setTimeout(resolve, 1000));

                    if (this.runMode === 'REAL') {
                        if (isProfitable) {
                            // 1. BUY with Slippage Protection
                            const minBuyOut = (Number(buyAmountOut) * (1 - this.slippage)).toString();
                            buyHash = await blockchainService.executeTrade(tokenIn, tokenOut, this.tradeAmount, true, undefined, minBuyOut, useV3);
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        }

                        // 2. SELL with Slippage Protection
                        const activeAddr = blockchainService.getWalletAddress();
                        const tokenBal = activeAddr ? await blockchainService.getBalance(tokenOut, activeAddr) : '0';

                        if (Number(tokenBal) > 0) {
                            // Calculate min sell out based on current market for the balance we have
                            const currentSellAmounts = await blockchainService.getAmountsOut(tokenBal, [tokenOut, tokenIn]);
                            const expectedUsdtBack = Number(currentSellAmounts[1]) / (10 ** 6);
                            const minUsdtOut = (expectedUsdtBack * (1 - this.slippage)).toString();

                            txHash = await blockchainService.executeTrade(tokenOut, tokenIn, tokenBal, true, undefined, minUsdtOut);

                            // Calculate actual profit (approximate for UI)
                            actualProfit = expectedUsdtBack - Number(this.tradeAmount) - GAS_ESTIMATE_USDT;
                            successTrade = true;
                        } else {
                            txHash = buyHash;
                            actualProfit = -0.1; // Failed to buy enough?
                        }

                    } else {
                        // DEMO MODE
                        txHash = '0xSIM_' + Math.random().toString(16).substr(2, 10);
                        actualProfit = isProfitable ? estimatedNetProfit : (Math.random() * -0.05);
                    }
                } catch (err: any) {
                    this.onLog({
                        id: 'err-' + Date.now(),
                        timestamp: new Date().toLocaleTimeString(),
                        type: 'LIQUIDITY_SCAN',
                        pair: `SAFE SKIP: ${err.message}`,
                        profit: 0,
                        status: 'FAILED',
                        hash: ''
                    });
                    continue;
                }

                this.dailyPnl += actualProfit;
                if (this.runMode === 'DEMO') {
                    this.totalBalance += actualProfit;
                    if (this.onBalanceUpdate) this.onBalanceUpdate(this.totalBalance);
                }

                this.onLog({
                    id: Math.random().toString(36).substr(2, 9),
                    timestamp: new Date().toLocaleTimeString(),
                    type: isProfitable ? 'ROUTE_OPTIMIZATION' : 'LIQUIDITY_SCAN',
                    pair: `${randomSymbol.replace('USDT', '')}/USDT (${bestRoute})`,
                    profit: actualProfit,
                    status: 'SUCCESS',
                    hash: txHash
                });

                // --- AUTO CONSOLIDATION LOGIC ---
                if (this.runMode === 'REAL' && successTrade && this.consolidationThreshold > 0) {
                    try {
                        const opAddr = blockchainService.getWalletAddress();
                        const pvt = localStorage.getItem('fs_private_key');
                        const ownerAddr = pvt ? new ethers.Wallet(pvt).address : null;

                        // We need the owner address to transfer to. If not in localStorage, we can't do it.
                        if (opAddr && ownerAddr && opAddr.toLowerCase() !== ownerAddr.toLowerCase()) {
                            const usdtBal = await blockchainService.getBalance(TOKENS['USDT'], opAddr);

                            if (Number(usdtBal) >= this.consolidationThreshold) {
                                console.log(`[Consolidate] Threshold reached (${usdtBal} >= ${this.consolidationThreshold}). Transferring to Owner...`);
                                this.onLog({
                                    id: 'consolidate-' + Date.now(),
                                    timestamp: new Date().toLocaleTimeString(),
                                    type: 'ASSET_CONSOLIDATION',
                                    pair: `Auto-Consolidating ${usdtBal} USDT...`,
                                    profit: 0,
                                    status: 'SUCCESS',
                                    hash: ''
                                });

                                const transferHash = await blockchainService.transferTokens(TOKENS['USDT'], ownerAddr, usdtBal, opAddr);
                                console.log(`[Consolidate] Success! Tx: ${transferHash}`);
                            }
                        }
                    } catch (e) {
                        console.error("[Consolidate] Auto-transfer failed", e);
                    }
                }
            }

            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }



}
