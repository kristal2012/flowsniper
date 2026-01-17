
import { ethers, JsonRpcProvider } from 'ethers';
import { proxyManager } from './services/proxy_utils.js';
import dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
    console.log("--- RPC Connection Diagnostic ---");

    // Validate proxy first
    console.log("\n0. Validating Proxy Connection...");
    const isProxyWorking = await proxyManager.validateConnection();
    console.log(`Proxy Validation Result: ${isProxyWorking ? 'OK' : 'FAILED'}`);

    const rpcUrl = process.env.VITE_POLYGON_RPC_URL || 'https://polygon-rpc.com';
    console.log(`\nTesting RPC: ${rpcUrl}`);

    const proxiedFetch = proxyManager.getEthersFetch();

    const runTest = async (name: string, provider: JsonRpcProvider) => {
        try {
            console.log(`\nTesting ${name}...`);
            const [blockNumber, network] = await Promise.all([
                provider.getBlockNumber(),
                provider.getNetwork()
            ]);
            console.log(`SUCCESS [${name}]:`);
            console.log(` - Current block: ${blockNumber}`);
            console.log(` - Network Name: ${network.name}`);
            console.log(` - Chain ID: ${network.chainId}`);
            return true;
        } catch (e: any) {
            console.error(`FAILED [${name}]:`);
            console.error(` - Error: ${e.message}`);
            if (e.code) console.error(` - Code: ${e.code}`);
            return false;
        }
    };

    // Test Proxied
    const fetchReq = new ethers.FetchRequest(rpcUrl);
    // @ts-ignore
    fetchReq.getUrl = proxiedFetch;
    const proxiedProvider = new JsonRpcProvider(fetchReq, 137, { staticNetwork: true });
    await runTest("Proxied Fetch", proxiedProvider);

    // Test Direct
    const directProvider = new JsonRpcProvider(rpcUrl, 137, { staticNetwork: true });
    await runTest("Direct Fetch", directProvider);
}

testConnection();
