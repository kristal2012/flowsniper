import { proxyManager } from './proxy_utils.js';

export interface CandleData {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

const BYBIT_V5_BASE = 'https://api.bybit.com';
const BYBIT_API_PATH = '/v5/market';
const BINANCE_BASE = 'https://api.binance.com';

const isNode = typeof process !== 'undefined' && process.release && process.release.name === 'node';

export const fetchHistoricalData = async (symbol: string = 'POLUSDT', interval: string = '1', limit: number = 50): Promise<CandleData[]> => {
    try {
        const path = `${BYBIT_API_PATH}/kline?category=linear&symbol=${symbol}&interval=${interval}&limit=${limit}`;
        const url = isNode ? `${BYBIT_V5_BASE}${path}` : `/bybit-api${path}`;

        console.log("Fetching Historical Data from:", url);
        const response = await proxyManager.proxyFetch(url);
        const data = await response.json();

        if (data.retCode === 0 && data.result && data.result.list && data.result.list.length > 0) {
            return data.result.list.map((item: any) => ({
                time: parseInt(item[0]),
                open: parseFloat(item[1]),
                high: parseFloat(item[2]),
                low: parseFloat(item[3]),
                close: parseFloat(item[4]),
                volume: parseFloat(item[5])
            })).reverse();
        }
        throw new Error("Bybit data empty or invalid");
    } catch (error) {
        console.warn("Bybit Fetch failed, trying Binance fallback...", error);
        try {
            const binanceInterval = interval === '1' ? '1m' : (interval + 'm');
            const binanceSymbol = symbol;
            const path = `/api/v3/klines?symbol=${binanceSymbol}&interval=${binanceInterval}&limit=${limit}`;
            const binanceUrl = isNode ? `${BINANCE_BASE}${path}` : `/binance-api${path}`;

            const bResp = await proxyManager.proxyFetch(binanceUrl);
            const bData = await bResp.json();

            return bData.map((item: any) => ({
                time: item[0],
                open: parseFloat(item[1]),
                high: parseFloat(item[2]),
                low: parseFloat(item[3]),
                close: parseFloat(item[4]),
                volume: parseFloat(item[5])
            }));
        } catch (bError) {
            console.error("All data sources failed:", bError);
            return [];
        }
    }
};

export const fetchCurrentPrice = async (symbol: string = 'POLUSDT'): Promise<number> => {
    const normalizedSymbol = symbol.replace('WMATIC', 'MATIC').replace('POL', 'MATIC');
    const candidates = [normalizedSymbol];
    if (symbol !== normalizedSymbol) candidates.push(symbol);
    if (symbol.includes('POL') && !candidates.includes('MATICUSDT')) candidates.push(symbol.replace('POL', 'MATIC'));
    if (symbol.includes('MATIC') && !candidates.includes('POLUSDT')) candidates.push(symbol.replace('MATIC', 'POL'));

    // 1. Try Bybit
    for (const s of candidates) {
        try {
            const path = `${BYBIT_API_PATH}/tickers?category=linear&symbol=${s}`;
            const url = isNode ? `${BYBIT_V5_BASE}${path}` : `/bybit-api${path}`;
            const response = await proxyManager.proxyFetch(url);
            const data = await response.json();
            if (data.retCode === 0 && data.result?.list?.length > 0) {
                return parseFloat(data.result.list[0].lastPrice);
            }
        } catch (e) { }
    }

    // 2. Try Binance
    for (const s of candidates) {
        try {
            const path = `/api/v3/ticker/price?symbol=${s}`;
            const url = isNode ? `${BINANCE_BASE}${path}` : `/binance-api${path}`;
            const response = await proxyManager.proxyFetch(url);
            const data = await response.json();
            if (data.price) return parseFloat(data.price);
        } catch (e) { }
    }

    console.warn(`[MarketData] Exchanges failed for ${symbol}, trying CoinGecko...`);
    try {
        const coinGeckoMap: { [key: string]: string } = {
            'POLUSDT': 'matic-network',
            'MATICUSDT': 'matic-network',
            'WMATICUSDT': 'matic-network',
            'ETHUSDT': 'ethereum',
            'BTCUSDT': 'bitcoin',
            'USDCUSDT': 'usd-coin',
            'DAIUSDT': 'dai',
            'LINKUSDT': 'chainlink',
            'UNIUSDT': 'uniswap',
            'GHSTUSDT': 'aavegotchi',
            'LDOUSDT': 'lido-dao',
            'GRTUSDT': 'the-graph'
        };
        const coinId = coinGeckoMap[normalizedSymbol] || coinGeckoMap[symbol];

        if (!coinId) {
            throw new Error(`CoinGecko ID not found for ${symbol} / ${normalizedSymbol}`);
        }

        const cgUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`;
        const cgResp = await proxyManager.proxyFetch(cgUrl);
        const cgData = await cgResp.json();
        return cgData[coinId]?.usd || 0;
    } catch (cgError) {
        console.error(`[MarketData] All price sources failed for ${symbol}`, cgError);
        return 0;
    }
};
