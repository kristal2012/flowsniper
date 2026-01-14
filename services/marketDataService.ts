
export interface CandleData {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

const BYBIT_V5_URL = '/bybit-api/v5/market';

export const fetchHistoricalData = async (symbol: string = 'POLUSDT', interval: string = '1', limit: number = 50): Promise<CandleData[]> => {
    try {
        const url = `${BYBIT_V5_URL}/kline?category=linear&symbol=${symbol}&interval=${interval}&limit=${limit}`;
        console.log("Fetching Historical Data from:", url);
        const response = await fetch(url);
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
            // Binance Fallback (Public API usually has better CORS/Availability)
            // Binance uses 1m, 5m, etc. instead of 1.
            const binanceInterval = interval === '1' ? '1m' : (interval + 'm');
            // Binance symbol for MATIC/POL is POLUSDT
            const binanceSymbol = symbol;
            const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${binanceInterval}&limit=${limit}`;
            const bResp = await fetch(binanceUrl);
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
    // Normalize symbols for Binance (WMATIC -> MATIC)
    const normalizedSymbol = symbol.replace('WMATIC', 'MATIC').replace('POL', 'MATIC');

    // List of symbol variations to try (e.g., POLUSDT, MATICUSDT)
    const candidates = [normalizedSymbol];
    if (symbol !== normalizedSymbol) candidates.push(symbol);
    if (symbol.includes('POL') && !candidates.includes('MATICUSDT')) candidates.push(symbol.replace('POL', 'MATIC'));
    if (symbol.includes('MATIC') && !candidates.includes('POLUSDT')) candidates.push(symbol.replace('MATIC', 'POL'));

    // 1. Try Bybit
    for (const s of candidates) {
        try {
            const response = await fetch(`${BYBIT_V5_URL}/tickers?category=linear&symbol=${s}`);
            const data = await response.json();
            if (data.retCode === 0 && data.result?.list?.length > 0) {
                return parseFloat(data.result.list[0].lastPrice);
            }
        } catch (e) { /* continued */ }
    }

    // 2. Try Binance
    for (const s of candidates) {
        try {
            const response = await fetch(`/binance-api/api/v3/ticker/price?symbol=${s}`);
            const data = await response.json();
            if (data.price) return parseFloat(data.price);
        } catch (e) { /* continued */ }
    }

    console.warn(`[MarketData] Exchanges failed for ${symbol}, trying CoinGecko...`);
    try {
        console.warn(`[MarketData] Binance failed, trying CoinGecko...`);
        try {
            // CoinGecko fallback (no CORS issues)
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
            const cgResp = await fetch(cgUrl);
            const cgData = await cgResp.json();
            return cgData[coinId]?.usd || 0;
        } catch (cgError) {
            console.error(`[MarketData] All price sources failed for ${symbol}`, cgError);
            return 0;
        }
    }
    }
};
