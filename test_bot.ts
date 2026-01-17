
import { FlowSniperEngine } from './services/flowSniperEngine.js';
import { proxyManager } from './services/proxy_utils.js';
import dotenv from 'dotenv';

dotenv.config();

async function runTest() {
    console.log("--- TESTE DE PONTAS A PONTA (MODO DEMO) ---");

    const isValid = await proxyManager.validateConnection();
    if (!isValid) {
        console.error("Falha na validação do proxy. Abortando teste.");
        return;
    }

    let tradePerformed = false;

    const bot = new FlowSniperEngine(
        (step) => {
            if (step.type === 'SCAN_PULSE') {
                process.stdout.write('.');
            } else {
                console.log(`\n[${step.timestamp}] [${step.type}] ${step.pair} | Lucro: ${step.profit.toFixed(4)} | Status: ${step.status}`);
                if (step.type === 'ROUTE_OPTIMIZATION' || (step.type === 'LIQUIDITY_SCAN' && step.profit !== 0)) {
                    tradePerformed = true;
                }
            }
        },
        (gas) => { },
        (bal) => { }
    );

    console.log("Iniciando bot em modo DEMO por 60 segundos...");
    bot.start('DEMO', 10.0, 1000.0, null, "3.0", 0.005, 0.001, 10.0);

    // Run for 1 minute
    await new Promise(resolve => setTimeout(resolve, 60000));

    console.log("\nParando bot...");
    bot.stop();

    if (tradePerformed) {
        console.log("\nESTADO: SUCESSO - O bot realizou scans e identificou oportunidades/simulou trades.");
    } else {
        console.log("\nESTADO: PARCIAL - O bot varreu o mercado mas não encontrou oportunidades lucrativas no período.");
    }
}

runTest().catch(console.error);
