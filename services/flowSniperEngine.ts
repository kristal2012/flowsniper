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
        const symbols = ['POLUSDT', 'WMATICUSDT', 'ETHUSDT', 'BTCUSDT', 'LINKUSDT', 'AAVEUSDT', 'SANDUSDT', 'CRVUSDT', 'SUSHIUSDT', 'BALUSDT', 'GRTUSDT', 'UNIUSDT', 'QUICKUSDT', 'GHSTUSDT', 'LDOUSDT'];
        const dexes = ['QuickSwap [Active]', 'QuickSwap [Aggregator]'];

        // Token Addresses & Decimals for Polygon (Safe normalization)
        const normalize = (addr: string) => ethers.getAddress(addr.toLowerCase());

        const TOKEN_METADATA: { [key: string]: { address: string, decimals: number } } = {
            'USDT': { address: normalize('0xc2132d05d31c914a87c6611c10748aeb04b58e8f'), decimals: 6 },
            'POL': { address: normalize('0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270'), decimals: 18 },
            'WMATIC': { address: normalize('0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270'), decimals: 18 },
            'WETH': { address: normalize('0x7ceb23fd6bc0ad59f6c078095c510c28342245c4'), decimals: 18 },
            'WBTC': { address: normalize('0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6'), decimals: 8 },
            'USDC': { address: normalize('0x2791bca1f2de4661ed88a30c99a7a9449aa84174'), decimals: 6 },
            'DAI': { address: normalize('0x8f3cf7ad23cd3cadbd9735aff958023239c6a063'), decimals: 18 },
            'LINK': { address: normalize('0x53e0bca35ec356bd5dddfebbd1fc0fd03fabad39'), decimals: 18 },
            'UNI': { address: normalize('0xb33EaAd8d922B14833400E19B271D8f691630c3a'), decimals: 18 },
            'GHST': { address: normalize('0x385a6061f584773cc0016fa0343714652288004b'), decimals: 18 },
            'LDO': { address: normalize('0x13313d5b943264fc7729f635649938b816223d6a'), decimals: 18 },
            'GRT': { address: normalize('0x5fe2b58c013d7601147dcdd68c143a77499f5531'), decimals: 18 },
            'QUICK': { address: normalize('0xb5c064f955d8e7f38fe0460c556a722fabb24b3a'), decimals: 18 },
            'AAVE': { address: normalize('0xd6df30500db6e36d4336069904944f2b93652618'), decimals: 18 },
            'SAND': { address: normalize('0xbbba073c31bf03b8acf7c28ef0738decf3695683'), decimals: 18 },
            'CRV': { address: normalize('0x172370d5cd6322a39e03c40a3e1bc76417772aea'), decimals: 18 },
            'SUSHI': { address: normalize('0x0b3f868e0be5597d5db7feb59e1cadbb0fdda50a'), decimals: 18 },
            'BAL': { address: normalize('0x9a71011361935e9097d620f59c3c79b110eaadc7'), decimals: 18 }
        };

        const TOKENS: { [key: string]: string } = {}; // Backward compat shim
        for (const [k, v] of Object.entries(TOKEN_METADATA)) { TOKENS[k] = v.address; }

        const GAS_ESTIMATE_USDT = 0.02; // Reduzido para ser mais realista com a Polygon

        while (this.active) {
            try {
                // Pulse log
                this.onLog({
                    id: 'pulse-' + Date.now(),
                    timestamp: new Date().toLocaleTimeString(),
                    type: 'SCAN_PULSE',
                    pair: 'DEX vs Global: Buscando distorções...',
                    profit: 0,
                    status: 'SUCCESS',
                    hash: ''
                });

                if (this.dailyPnl <= this.maxDrawdown) {
                    console.error("[Engine] Limite diário de perda atingido.");
                    this.stop();
                    break;
                }

                if (this.runMode === 'DEMO' && this.gasBalance <= 0) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    continue;
                }

                // AI Analysis (Non-blocking)

                // 1. SELECT TARGET
                const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
                const price = await fetchCurrentPrice(randomSymbol);

                if (price <= 0) {
                    console.warn(`[Engine] Falha ao obter preço para ${randomSymbol}.`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }

                if (price > 0) {
                    const selectedDex = dexes[Math.floor(Math.random() * dexes.length)];
                    const tokenIn = TOKENS['USDT'];

                    let searchTag = randomSymbol.replace('USDT', '');
                    if (searchTag === 'BTC') searchTag = 'WBTC';
                    if (searchTag === 'ETH') searchTag = 'WETH';
                    if (searchTag === 'POL') searchTag = 'WMATIC';

                    const tokenOut = TOKENS[searchTag];
                    if (!tokenOut) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                        continue;
                    }

                    let isProfitable = false;
                    let estimatedNetProfit = 0;
                    let buyAmountOut = "0";
                    let bestRoute = 'Nenhuma';
                    let useV3 = false;

                    let txHash = '';
                    let buyHash = '';
                    let actualProfit = 0;
                    let successTrade = false;

                    try {
                        const [v2Amounts, v3Amount] = await Promise.all([
                            blockchainService.getAmountsOut(this.tradeAmount, [tokenIn, tokenOut]),
                            blockchainService.getQuoteV3(tokenIn, tokenOut, this.tradeAmount)
                        ]);

                        let bestAmountOutNum = 0;
                        if (v2Amounts && v2Amounts.length >= 2) {
                            const decimalsOut = await (blockchainService as any).getTokenDecimals(tokenOut);
                            const v2Out = Number(v2Amounts[1]) / (10 ** decimalsOut);
                            if (v2Out > bestAmountOutNum) {
                                bestAmountOutNum = v2Out;
                                bestRoute = 'QuickSwap (V2)';
                                useV3 = false;
                            }
                        }

                        const v3OutNum = Number(v3Amount);
                        if (v3OutNum > bestAmountOutNum) {
                            bestAmountOutNum = v3OutNum;
                            bestRoute = 'Uniswap (V3)';
                            useV3 = true;
                        }

                        if (bestAmountOutNum > 0) {
                            buyAmountOut = bestAmountOutNum.toString();
                            const globalValueUsdt = bestAmountOutNum * price;
                            const grossProfit = globalValueUsdt - Number(this.tradeAmount);
                            const totalGas = (GAS_ESTIMATE_USDT * 2);
                            estimatedNetProfit = grossProfit - totalGas;

                            // No modo DEMO, somos mais permissivos (0.5% de spread bruto já dispara o log/trade para teste)
                            const spreadPct = (grossProfit / Number(this.tradeAmount)) * 100;
                            const targetProfit = this.runMode === 'DEMO' ? -0.01 : (Number(this.tradeAmount) * this.minProfit);

                            console.log(`[Scan] ${searchTag}: Global $${price.toFixed(4)} | DEX $${(Number(this.tradeAmount) / bestAmountOutNum).toFixed(4)} | Spread: ${spreadPct.toFixed(2)}% | Net: $${estimatedNetProfit.toFixed(4)}`);

                            if (estimatedNetProfit > targetProfit) {
                                const roi = (estimatedNetProfit / Number(this.tradeAmount)) * 100;
                                if (roi > 1000.0) {
                                    console.warn(`[Strategy] ⚠️ CIRCUIT BREAKER: ROI irreal (${roi.toFixed(2)}%).`);
                                } else {
                                    isProfitable = true;
                                    console.log(`[Strategy] ✅ OPORTUNIDADE IDENTIFICADA em ${bestRoute}!`);
                                }
                            }
                        } else {
                            console.warn(`[Scan] ${searchTag}: Sem liquidez detectada nas DEXes.`);
                        }

                        if (isProfitable) {
                            if (this.runMode === 'REAL') {
                                // 1. BUY
                                const minBuyOut = (Number(buyAmountOut) * (1 - this.slippage)).toString();
                                buyHash = await blockchainService.executeTrade(tokenIn, tokenOut, this.tradeAmount, true, undefined, minBuyOut, useV3);
                                await new Promise(resolve => setTimeout(resolve, 2000));

                                // 2. SELL
                                const activeAddr = blockchainService.getWalletAddress();
                                const tokenBal = activeAddr ? await blockchainService.getBalance(tokenOut, activeAddr) : '0';

                                if (Number(tokenBal) > 0) {
                                    const currentSellAmounts = await blockchainService.getAmountsOut(tokenBal, [tokenOut, tokenIn]);
                                    const expectedUsdtBack = Number(currentSellAmounts[1]) / (10 ** 6);
                                    const minUsdtOut = (expectedUsdtBack * (1 - this.slippage)).toString();

                                    txHash = await blockchainService.executeTrade(tokenOut, tokenIn, tokenBal, true, undefined, minUsdtOut);
                                    actualProfit = expectedUsdtBack - Number(this.tradeAmount) - (GAS_ESTIMATE_USDT * 2);
                                    successTrade = true;
                                } else {
                                    txHash = buyHash;
                                    actualProfit = -0.1;
                                }
                            } else {
                                // DEMO MODE
                                txHash = '0xSIM_' + Math.random().toString(16).substr(2, 10);
                                actualProfit = estimatedNetProfit;
                                successTrade = true;
                            }

                            // UPDATE STATE & LOGS
                            this.dailyPnl += actualProfit;
                            if (this.runMode === 'DEMO') {
                                this.totalBalance += actualProfit;
                                this.gasBalance -= 0.05;
                                if (this.onGasUpdate) this.onGasUpdate(this.gasBalance);
                                if (this.onBalanceUpdate) this.onBalanceUpdate(this.totalBalance);
                            }

                            this.onLog({
                                id: Math.random().toString(36).substr(2, 9),
                                timestamp: new Date().toLocaleTimeString(),
                                type: 'ROUTE_OPTIMIZATION',
                                pair: `${randomSymbol.replace('USDT', '')}/USDT (${bestRoute})`,
                                profit: actualProfit,
                                status: 'SUCCESS',
                                hash: txHash
                            });

                            // AUTO CONSOLIDATION
                            if (this.runMode === 'REAL' && successTrade && this.consolidationThreshold > 0) {
                                try {
                                    const opAddr = blockchainService.getWalletAddress();
                                    const pvt = localStorage.getItem('fs_private_key');
                                    const ownerAddr = pvt ? new ethers.Wallet(pvt).address : null;

                                    if (opAddr && ownerAddr && opAddr.toLowerCase() !== ownerAddr.toLowerCase()) {
                                        const usdtBal = await blockchainService.getBalance(TOKENS['USDT'], opAddr);
                                        if (Number(usdtBal) >= this.consolidationThreshold) {
                                            const transferHash = await blockchainService.transferTokens(TOKENS['USDT'], ownerAddr, usdtBal, opAddr);
                                            console.log(`[Consolidate] Consolidado ${usdtBal} USDT. Tx: ${transferHash}`);
                                        }
                                    }
                                } catch (e) { console.error("[Consolidate] Erro:", e); }
                            }
                        }
                    } catch (err: any) {
                        console.error(`[Engine] Erro no loop de trade para ${searchTag}:`, err.message);
                        this.onLog({
                            id: 'err-' + Date.now(),
                            timestamp: new Date().toLocaleTimeString(),
                            type: 'LIQUIDITY_SCAN',
                            pair: `SKIP: ${err.message}`,
                            profit: 0,
                            status: 'FAILED',
                            hash: ''
                        });
                    }
                }
            } catch (loopError) {
                console.error("[CRITICAL] Erro fatal no Engine Loop:", loopError);
            }

            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}
