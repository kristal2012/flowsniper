import { FlowSniperEngine } from './services/flowSniperEngine';
import { FlowStep } from './types';
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { blockchainService } from './services/blockchainService';
import { proxyManager } from './services/proxy_utils';

dotenv.config();

console.log('==================================================');
console.log('      FLOWSNIPER - HEADLESS BOT VERSION');
console.log('==================================================');

const app = express();
const PORT = 3005;

app.use(cors());
app.use(bodyParser.json());

// CONFIG PERSISTENCE
const CONFIG_FILE = path.resolve(process.cwd(), 'bot_config.json');

// Default Config
let currentConfig = {
    mode: (process.env.VITE_MODE as 'REAL' | 'DEMO') || 'DEMO',
    tradeAmount: process.env.VITE_TRADE_AMOUNT || '3.0',
    slippage: parseFloat(process.env.VITE_SLIPPAGE || '0.005'),
    minProfit: parseFloat(process.env.VITE_MIN_PROFIT || '0.001'),
    consolidationThreshold: parseFloat(process.env.VITE_CONSOLIDATION_THRESHOLD || '10.0'),
    privateKey: process.env.VITE_PRIVATE_KEY || '',
    rpcUrl: process.env.VITE_POLYGON_RPC_URL || '',
    openaiKey: process.env.VITE_OPENAI_API_KEY || '',
    isRunning: true
};

// Load Config from File
if (fs.existsSync(CONFIG_FILE)) {
    try {
        const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        currentConfig = { ...currentConfig, ...saved };
        console.log("Loaded configuration from file:", currentConfig);
    } catch (e) {
        console.error("Failed to load config file", e);
    }
}

const saveConfig = () => {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(currentConfig, null, 2));
    } catch (e) {
        console.error("Failed to save config", e);
    }
};

// APPLY CONFIG TO SERVICES
const applyConfig = () => {
    if (currentConfig.privateKey) {
        blockchainService.setActiveKey(currentConfig.privateKey);
    }
    if (currentConfig.rpcUrl) {
        blockchainService.setRpcUrl(currentConfig.rpcUrl);
    }
    // OpenAI Key handling would go here if we had a dedicated service setter
    // For now, it's passed to engine via start() if needed, or set to env
    if (currentConfig.openaiKey) {
        process.env.VITE_OPENAI_API_KEY = currentConfig.openaiKey;
        // Also set explicit property if analyzePerformance uses it differently
    }
};

console.log('==================================================');
console.log('      FLOWSNIPER - HEADLESS BOT VERSION (API ENABLED)');
console.log('==================================================');

const initialGas = 20.0;
const initialBalance = 1000.0;

let lastStatus = "IDLE";
let lastProfit = "0.0000";

const bot = new FlowSniperEngine(
    (step: FlowStep) => {
        const time = step.timestamp;
        const type = step.type;
        const pair = step.pair;
        const profit = step.profit.toFixed(4);
        const status = step.status;

        lastStatus = `${type}: ${pair} (${status})`;
        if (step.profit !== 0) lastProfit = profit;

        if (type === 'SCAN_PULSE') {
            process.stdout.write(`\r[${time}] Scanning: ${pair} `);
        } else {
            console.log(`\n[${time}] [${type}] ${pair} | Profit: ${profit} | Status: ${status} | Hash: ${step.hash || 'N/A'}`);
        }
    },
    (gas: number) => { },
    (bal: number) => { }
);

process.on('SIGINT', () => {
    console.log('\nStopping bot...');
    bot.stop();
    process.exit();
});

// START FUNCTION
const startBot = () => {
    applyConfig(); // Ensure services have latest keys
    console.log(`Starting Bot in ${currentConfig.mode} mode...`);

    // Pass config values to engine
    bot.start(
        currentConfig.mode,
        initialGas,
        initialBalance,
        { action: "HOLD", confidence: 0, reason: "Auto-Start" }, // Dummy initial analysis
        currentConfig.tradeAmount,
        currentConfig.slippage,
        currentConfig.minProfit,
        currentConfig.consolidationThreshold
    );
};

// INITIAL STARTUP SEQUENCE
const initialize = () => {
    proxyManager.validateConnection().then(isValid => {
        if (!isValid) {
            console.error("CRITICAL: Proxy validation failed. Aborting startup.");
            return;
        }

        console.log("Proxy validated.");
        applyConfig(); // Apply initial config

        if (currentConfig.isRunning) {
            startBot();
        }
    }).catch(err => {
        console.error("CRITICAL: Error during startup proxy check:", err);
    });
};

// API ROUTES
app.get('/status', (req, res) => {
    res.json({
        running: currentConfig.isRunning,
        mode: currentConfig.mode,
        lastStatus,
        lastProfit,
        config: currentConfig
    });
});

app.post('/config', (req, res) => {
    const newConfig = req.body;
    console.log("Received new config:", newConfig);

    currentConfig = { ...currentConfig, ...newConfig };
    saveConfig();
    applyConfig(); // Update services immediately

    // Restart if running
    if (currentConfig.isRunning) {
        bot.stop();
        setTimeout(() => startBot(), 1000);
    }

    res.json({ success: true, config: currentConfig });
});

app.post('/start', (req, res) => {
    if (!currentConfig.isRunning) {
        currentConfig.isRunning = true;
        saveConfig();
        startBot();
    }
    res.json({ success: true, running: true });
});

app.post('/stop', (req, res) => {
    if (currentConfig.isRunning) {
        currentConfig.isRunning = false;
        saveConfig();
        bot.stop();
    }
    res.json({ success: true, running: false });
});

app.post('/withdraw', async (req, res) => {
    const { tokenAddress, to, amount } = req.body;
    console.log(`[API] Transfer Request: ${amount} of ${tokenAddress} to ${to}`);

    try {
        // Ensure keys are loaded
        applyConfig();

        // Execute Transfer
        const txHash = await blockchainService.transferTokens(tokenAddress, to, amount);
        res.json({ success: true, txHash });
    } catch (e: any) {
        console.error("[API] Withdraw Failed", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/liquidate', async (req, res) => {
    console.log("[API] EMERGENCY LIQUIDATION REQUESTED");
    try {
        applyConfig();
        // Stop bot first to prevent conflicts
        if (currentConfig.isRunning) {
            bot.stop();
            currentConfig.isRunning = false;
            saveConfig();
        }

        // Target address to liquidate FOR (the active key's address)
        // We need the address derived from the key.
        const wallet = blockchainService.getWallet();
        if (!wallet) throw new Error("Wallet not loaded");

        await blockchainService.emergencyLiquidate(wallet.address);
        res.json({ success: true });
    } catch (e: any) {
        console.error("[API] Liquidation Failed", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/recharge', async (req, res) => {
    const { amount } = req.body; // Amount in USDT to swap for POL
    console.log(`[API] Recharge Gas Request: ${amount} USDT`);
    try {
        applyConfig();
        const txHash = await blockchainService.rechargeGas(amount);
        res.json({ success: true, txHash });
    } catch (e: any) {
        console.error("[API] Recharge Failed", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Start Server & Bot
app.listen(PORT, () => {
    console.log(`[API] Control Server running on http://localhost:${PORT}`);
    initialize();
});
