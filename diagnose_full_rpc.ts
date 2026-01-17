
import { ethers, Contract } from 'ethers';
import { proxyManager } from './services/proxy_utils.js';
import dotenv from 'dotenv';

dotenv.config();

const ROUTER_ADDRESS = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";
const ROUTER_ABI = ["function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)"];
const USDT = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
const WMATIC = "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270";

async function diagnoseFullRpc() {
    console.log("--- Diagnóstico Completo de RPC (eth_call) ---");

    const rpcUrl = process.env.VITE_POLYGON_RPC_URL || 'https://polygon-rpc.com';
    const proxiedFetch = proxyManager.getEthersFetch();

    try {
        console.log("\n1. Testando chamada de contrato via Proxy...");
        const fetchReq = new ethers.FetchRequest(rpcUrl);
        // @ts-ignore
        fetchReq.getUrl = proxiedFetch;
        const provider = new ethers.JsonRpcProvider(fetchReq, 137, { staticNetwork: true });

        const router = new Contract(ROUTER_ADDRESS, ROUTER_ABI, provider);
        const amountIn = ethers.parseUnits("3.0", 6);
        const path = [USDT, WMATIC];

        console.log(`Chamando getAmountsOut para ${path.join(' -> ')}...`);
        const amounts = await router.getAmountsOut(amountIn, path);
        console.log("SUCESSO! Saída:", ethers.formatUnits(amounts[1], 18), "WMATIC");
    } catch (e: any) {
        console.error("FALHA na chamada de contrato:");
        console.error(e.message || e);
    }
}

diagnoseFullRpc();
