
import { proxyManager } from './services/proxy_utils.js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

async function diagnoseMarketData() {
    console.log("--- Diagnóstico de Acesso a Mercado ---");
    console.log("Proxy Habilitado:", process.env.VITE_PROXY_ENABLED);

    const targets = [
        { name: "Bybit Tickers", url: "https://api.bybit.com/v5/market/tickers?category=linear&symbol=POLUSDT" },
        { name: "Binance Ticker", url: "https://api.binance.com/api/v3/ticker/price?symbol=POLUSDT" },
        { name: "Binance Klines", url: "https://api.binance.com/api/v3/klines?symbol=POLUSDT&interval=1m&limit=1" },
        { name: "CoinGecko", url: "https://api.coingecko.com/api/v3/simple/price?ids=matic-network&vs_currencies=usd" }
    ];

    for (const target of targets) {
        console.log(`\nTestando ${target.name}...`);
        try {
            const response = await proxyManager.proxyFetch(target.url);
            console.log(`Status: ${response.status} ${response.statusText}`);
            if (response.ok) {
                const data = await response.json();
                console.log(`Dados recebidos: ${JSON.stringify(data).substring(0, 100)}...`);
            } else {
                const text = await response.text();
                console.log(`Erro corpo: ${text.substring(0, 200)}`);
            }
        } catch (e: any) {
            console.error(`FALHA: ${e.message}`);
            if (e.code) console.error(`Código: ${e.code}`);
        }
    }
}

diagnoseMarketData();
