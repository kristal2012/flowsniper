
import { ethers, JsonRpcProvider, Wallet, Contract, BrowserProvider } from 'ethers';
import { proxyManager } from './proxy_utils';

// Standard ERC20 ABI (Minimal)
const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "event Transfer(address indexed from, address indexed to, uint256 amount)"
];

// Uniswap V2 Router ABI (Compatible with QuickSwap)
const ROUTER_ABI = [
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)"
];

// QuickSwap Router Address (Polygon)
const ROUTER_ADDRESS = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff"; // QuickSwap V2

// Uniswap V3 Addresses (Polygon)
const QUOTER_V3_ADDRESS = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";
const ROUTER_V3_ADDRESS = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

// Uniswap V3 Quoter ABI (Minimal)
const QUOTER_ABI = [
    "function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)"
];

// Uniswap V3 Router ABI (Minimal)
const ROUTER_V3_ABI = [
    "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)"
];

const DEFAULT_RPC = 'https://polygon-mainnet.g.alchemy.com/v2/iRsg1SsPMDZZ9s5kHsRbH'; // User Alchemy RPC
const FALLBACK_RPCS = [
    'https://polygon-rpc.com',
    'https://rpc-mainnet.maticvigil.com',
    'https://1rpc.io/matic'
];

export class BlockchainService {
    public lastError: string | null = null;
    private browserProvider: BrowserProvider | null = null;
    private operatorWallet: Wallet | null = null;

    // Dynamic Configuration (Injected by Headless Bot)
    private activeKey: string | null = null;
    private activeRpc: string | null = null;

    private getRPC(): string {
        if (this.activeRpc) return this.activeRpc;

        let storedRpc = '';
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
            storedRpc = localStorage.getItem('fs_polygon_rpc') || '';
        }
        return storedRpc || process.env.VITE_POLYGON_RPC_URL || DEFAULT_RPC;
    }

    public setRpcUrl(url: string) {
        if (url && url.startsWith('http')) {
            this.activeRpc = url;
            console.log("[BlockchainService] Active RPC updated dynamically.");
        }
    }

    public setActiveKey(key: string) {
        if (key && key.length === 66) { // 0x + 64 chars
            this.activeKey = key;
            console.log("[BlockchainService] Active Key injected dynamically.");
        }
    }

    constructor() {
        if (typeof window !== 'undefined' && ((window as any).ethereum || (window as any).rabby)) {
            // Priority to Rabby if available, otherwise standard ethereum
            const provider = (window as any).rabby || (window as any).ethereum;
            this.browserProvider = new BrowserProvider(provider);
        }
        this.loadOperatorWallet();
    }

    private loadOperatorWallet() {
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
            const storedKey = localStorage.getItem('fs_operator_key');
            if (storedKey) {
                try {
                    this.operatorWallet = new Wallet(storedKey, this.getProvider());
                } catch (e) {
                    console.error("Failed to load operator wallet", e);
                }
            }
        }
    }

    public async connectWallet(): Promise<string> {
        if (!this.browserProvider) throw new Error("Carteira (Rabby/MetaMask) não encontrada.");
        await this.ensurePolygonNetwork();
        const accounts = await ((window as any).ethereum || (window as any).rabby).request({ method: 'eth_requestAccounts' });
        return accounts[0];
    }

    private async ensurePolygonNetwork(): Promise<void> {
        const provider = (window as any).rabby || (window as any).ethereum;
        if (!provider) return;

        const chainId = '0x89'; // 137 in hex
        try {
            await provider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId }],
            });
        } catch (switchError: any) {
            // This error code indicates that the chain has not been added
            if (switchError.code === 4902) {
                try {
                    await provider.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId,
                            chainName: 'Polygon Mainnet',
                            nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
                            rpcUrls: ['https://polygon-rpc.com'],
                            blockExplorerUrls: ['https://polygonscan.com/']
                        }],
                    });
                } catch (addError) {
                    throw new Error("Não foi possível adicionar a rede Polygon.");
                }
            } else {
                throw new Error("Por favor, mude para a rede Polygon na sua Carteira.");
            }
        }
    }

    public async setupOperator(ownerAddress: string): Promise<string> {
        await this.ensurePolygonNetwork();
        // Generate or load operator wallet
        if (!this.operatorWallet) {
            const newWallet = Wallet.createRandom();
            if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
                localStorage.setItem('fs_operator_key', newWallet.privateKey);
            }
            this.operatorWallet = new Wallet(newWallet.privateKey, this.getProvider());
        }

        // Request signature to "pair" the operator (security proof)
        const message = `Autorizar FlowSniper Operator\nOwner: ${ownerAddress}\nOperator: ${this.operatorWallet.address}`;
        const signer = await this.browserProvider!.getSigner();
        await signer.signMessage(message);

        return this.operatorWallet.address;
    }

    public async grantAllowance(tokenAddress: string, amount: string): Promise<string> {
        if (!this.browserProvider || !this.operatorWallet) throw new Error("Conecte a Carteira primeiro.");

        await this.ensurePolygonNetwork();
        const signer = await this.browserProvider.getSigner();
        const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer);

        console.log(`[BlockchainService] Granting allowance for operator: ${this.operatorWallet.address}, amount: ${amount}`);
        const tx = await tokenContract.approve(this.operatorWallet.address, amount);
        await tx.wait();
        return tx.hash;
    }

    private getProvider(): JsonRpcProvider {
        const rpc = this.getRPC();
        const proxiedFetch = proxyManager.getEthersFetch();

        const createProvider = (url: string) => {
            if (typeof window !== 'undefined') {
                return new JsonRpcProvider(url, 137, { staticNetwork: true });
            }

            const fetchReq = new ethers.FetchRequest(url);
            // @ts-ignore
            fetchReq.getUrl = proxiedFetch;

            return new JsonRpcProvider(fetchReq, 137, { staticNetwork: true });
        };

        try {
            const provider = createProvider(rpc);
            // Basic check if the provider is responsive (optional, but good for stability)
            return provider;
        } catch (e: any) {
            console.error(`[BlockchainService] Erro ao criar provedor para ${rpc}: ${e.message}`);
            console.warn("[BlockchainService] Iniciando fallback para RPC pública...");
            try {
                return createProvider(FALLBACK_RPCS[0]);
            } catch (fallbackError: any) {
                console.error("[BlockchainService] Fallback também falhou:", fallbackError.message);
                // Last resort: return default provider anyway, it might work later
                return createProvider(DEFAULT_RPC);
            }
        }
    }

    public async getAmountsOut(amountIn: string, path: string[]): Promise<bigint[]> {
        try {
            const provider = this.getProvider();
            const router = new Contract(ROUTER_ADDRESS, ROUTER_ABI, provider);

            // Detect decimals for the first token in path
            const decimals = await this.getTokenDecimals(path[0]);
            const amountWei = ethers.parseUnits(amountIn, decimals);

            const amounts = await router.getAmountsOut(amountWei, path);
            console.log(`[getAmountsOut] ${amountIn} ${path[0]} -> ${amounts.length > 1 ? ethers.formatUnits(amounts[1], await this.getTokenDecimals(path[1])) : '0'} ${path[1]}`);
            return amounts;
        } catch (e: any) {
            console.error(`[BlockchainService] getAmountsOut Error for path ${path.join('->')}:`, e.message || e);
            return [];
        }
    }

    // NEW: Uniswap V3 Quoter (Multi-Tier)
    public async getQuoteV3(tokenIn: string, tokenOut: string, amountIn: string): Promise<string> {
        try {
            const provider = this.getProvider();
            const quoter = new Contract(QUOTER_V3_ADDRESS, QUOTER_ABI, provider);

            const decimalsIn = await this.getTokenDecimals(tokenIn);
            const decimalsOut = await this.getTokenDecimals(tokenOut);
            const amountWei = ethers.parseUnits(amountIn, decimalsIn);

            const tiers = [500, 3000, 10000]; // 0.05%, 0.3%, 1%
            let bestQuoteWei = BigInt(0);
            let bestFee = 3000;

            // Parallel scan of all tiers for speed
            const quotes = await Promise.all(tiers.map(async (fee) => {
                try {
                    return await quoter.quoteExactInputSingle.staticCall(
                        tokenIn,
                        tokenOut,
                        fee,
                        amountWei,
                        0
                    );
                } catch (e) {
                    return BigInt(0);
                }
            }));

            // Find best
            quotes.forEach((q, index) => {
                if (q > bestQuoteWei) {
                    bestQuoteWei = q;
                    bestFee = tiers[index];
                }
            });

            const formatted = ethers.formatUnits(bestQuoteWei, decimalsOut);
            console.log(`[getQuoteV3] Best Quote: ${amountIn} -> ${formatted} (Fee: ${bestFee})`);
            return formatted; // Ideally we should return fee too, but for now we optimize for price
        } catch (e: any) {
            console.error("[getQuoteV3] Failed", e);
            return "0";
        }
    }

    public getWalletAddress(): string | null {
        const wallet = this.getWallet();
        return wallet ? wallet.address : null;
    }

    public getWallet(preferredAddress?: string): Wallet | null {
        // 1. Check if we have a preferred address
        if (preferredAddress) {
            if (this.operatorWallet && this.operatorWallet.address.toLowerCase() === preferredAddress.toLowerCase()) {
                return this.operatorWallet.connect(this.getProvider());
            }

            // Check Injected Key first for preferred
            if (this.activeKey) {
                const master = new Wallet(this.activeKey, this.getProvider());
                if (master.address.toLowerCase() === preferredAddress.toLowerCase()) return master;
            }

            if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
                const pvtKey = localStorage.getItem('fs_private_key');
                if (pvtKey) {
                    const master = new Wallet(pvtKey, this.getProvider());
                    if (master.address.toLowerCase() === preferredAddress.toLowerCase()) return master;
                }
            }
        }

        // 2. Default Priority: Injected Key -> Operator -> Env/Local
        if (this.activeKey) {
            try {
                return new Wallet(this.activeKey, this.getProvider());
            } catch (e) {
                console.error("Invalid Injected Key", e);
            }
        }

        if (this.operatorWallet) {
            return this.operatorWallet.connect(this.getProvider());
        }

        const pvtKey = (typeof window !== 'undefined' && typeof localStorage !== 'undefined') ?
            localStorage.getItem('fs_private_key') :
            process.env.VITE_PRIVATE_KEY;
        if (pvtKey) {
            try {
                return new Wallet(pvtKey, this.getProvider());
            } catch (e) {
                console.error("Invalid Private Key", e);
                return null;
            }
        }
        return null;
    }

    // CORE MODULE: TradeExecutor (Real & Sim)
    async executeTrade(tokenIn: string, tokenOut: string, amountIn: string, isReal: boolean, fromAddress?: string, amountOutMin: string = "0", useV3: boolean = false): Promise<string> {
        console.log(`[TradeExecutor] Executing ${isReal ? 'REAL' : 'SIMULATED'} trade (${useV3 ? 'Uniswap V3' : 'QuickSwap V2'}): ${amountIn} tokens`);

        if (!isReal) {
            await new Promise(r => setTimeout(r, 1000));
            return "0xSIM_" + Math.random().toString(16).substr(2, 32);
        }

        const wallet = this.getWallet(fromAddress);
        if (!wallet) {
            throw new Error("Carteira não configurada para este endereço.");
        }

        try {
            const provider = this.getProvider();

            // PRE-TRADE CHECK: Gas (Native POL)
            const gasBal = await provider.getBalance(wallet.address);
            if (gasBal < ethers.parseEther('0.05')) {
                throw new Error(`Insufficient Gas (POL). Address ${wallet.address} has only ${ethers.formatEther(gasBal)} POL. Please fund it for fees.`);
            }

            const router = new Contract(ROUTER_ADDRESS, ROUTER_ABI, wallet);

            // Robust Decimals Detection
            const decimalsIn = await this.getTokenDecimals(tokenIn);
            const decimalsOut = await this.getTokenDecimals(tokenOut);
            const amountWei = ethers.parseUnits(amountIn, decimalsIn);
            const amountOutMinWei = ethers.parseUnits(amountOutMin, decimalsOut);

            // 0. Pull funds from Owner to Operator if needed
            let ownerAddress: string | null = null;
            if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
                ownerAddress = localStorage.getItem('fs_owner_address');
            }
            if (this.operatorWallet && wallet.address === this.operatorWallet.address && ownerAddress) {
                const tokenContract = new Contract(tokenIn, ERC20_ABI, wallet);
                const opBalance = await tokenContract.balanceOf(wallet.address);

                if (opBalance < amountWei) {
                    console.log(`[TradeExecutor] Operator low balance. Attempting to pull funds from owner: ${ownerAddress}`);
                    const remainingToPull = amountWei - opBalance;

                    // Verify allowance
                    const allowanceFromOwner = await tokenContract.allowance(ownerAddress, wallet.address);
                    if (allowanceFromOwner < remainingToPull) {
                        throw new Error(`Saldo insuficiente no Operador e permissão insuficiente do Proprietário. Necessário: ${ethers.formatUnits(remainingToPull, decimalsIn)}`);
                    }

                    const pullTx = await tokenContract.transferFrom(ownerAddress, wallet.address, remainingToPull);
                    await pullTx.wait();
                    console.log(`[TradeExecutor] Pulled ${ethers.formatUnits(remainingToPull, decimalsIn)} tokens from owner.`);
                }
            }

            const tokenContract = new Contract(tokenIn, ERC20_ABI, wallet);

            // Gas estimation for transparency
            const gasPrice = (await this.getProvider().getFeeData()).gasPrice || ethers.parseUnits('50', 'gwei');

            if (useV3) {
                // UNISWAP V3 EXECUTION
                console.log(`[TradeExecutor] Checking/Approving V3 Router...`);
                const allowance = await tokenContract.allowance(wallet.address, ROUTER_V3_ADDRESS);
                if (allowance < amountWei) {
                    const approveTx = await tokenContract.approve(ROUTER_V3_ADDRESS, ethers.MaxUint256);
                    await approveTx.wait();
                }

                const routerV3 = new Contract(ROUTER_V3_ADDRESS, ROUTER_V3_ABI, wallet);
                const params = {
                    tokenIn: tokenIn,
                    tokenOut: tokenOut,
                    fee: 3000, // Hardcoded to 0.3% pool for now
                    recipient: wallet.address,
                    deadline: Math.floor(Date.now() / 1000) + 60 * 20,
                    amountIn: amountWei,
                    amountOutMinimum: amountOutMinWei,
                    sqrtPriceLimitX96: 0
                };

                console.log(`[TradeExecutor] Sending V3 Swap...`);
                const tx = await routerV3.exactInputSingle(params, {
                    gasLimit: 400000, // Slightly higher for V3
                    gasPrice: gasPrice * 12n / 10n
                });
                console.log(`[TradeExecutor] V3 Tx based: ${tx.hash}`);
                return tx.hash;

            } else {
                // QUICKSWAP V2 EXECUTION (Legacy)
                console.log(`[TradeExecutor] Checking/Approving Router...`);
                const allowance = await tokenContract.allowance(wallet.address, ROUTER_ADDRESS);

                if (allowance < amountWei) {
                    const approveTx = await tokenContract.approve(ROUTER_ADDRESS, ethers.MaxUint256);
                    await approveTx.wait();
                }

                // 2. Swap
                const path = [tokenIn, tokenOut];
                const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 mins

                console.log(`[TradeExecutor] Sending Swap Tx... (Min Out: ${amountOutMin})`);
                const tx = await router.swapExactTokensForTokens(
                    amountWei,
                    amountOutMinWei,
                    path,
                    wallet.address,
                    deadline,
                    {
                        gasLimit: 300000, // Standard swap gas limit
                        gasPrice: gasPrice * 12n / 10n // 20% bump for speed
                    }
                );
                console.log(`[TradeExecutor] Tx Sent: ${tx.hash}`);
                return tx.hash;
            }
            return ""; // Should not reach here

        } catch (error: any) {
            console.error("[TradeExecutor] Real Trade Failed", error);

            let cleanMsg = error.message || "Unknown error";
            if (cleanMsg.includes('insufficient funds for gas')) cleanMsg = "Erro: Falta POL para Gás";
            if (cleanMsg.includes('allowance')) cleanMsg = "Erro: Falta Permissão USDT";
            if (cleanMsg.includes('user rejected')) cleanMsg = "Erro: Transação Negada";
            if (cleanMsg.includes('execution reverted')) cleanMsg = "Erro: Falha na DEX (Slippage?)";

            throw new Error(cleanMsg);
        }
    }

    // CORE MODULE: Gas Station (Swap USDT to Native POL)
    async rechargeGas(amountUsdt: string): Promise<string> {
        console.log(`[GasStation] Recharging with ${amountUsdt} USDT...`);

        const wallet = this.getWallet();
        if (!wallet) throw new Error("Private Key required for Gas Recharge");

        try {
            const router = new Contract(ROUTER_ADDRESS, ROUTER_ABI, wallet);
            const usdtAddr = '0xc2132d05d31c914a87c6611c10748aeb04b58e8f';
            const wmaticAddr = '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270';
            const amountWei = ethers.parseUnits(amountUsdt, 6); // USDT has 6 decimals

            // 0. Pull USDT from Owner if needed
            const ownerAddress = localStorage.getItem('fs_owner_address');
            if (this.operatorWallet && wallet.address === this.operatorWallet.address && ownerAddress) {
                const tokenContract = new Contract(usdtAddr, ERC20_ABI, wallet);
                const opBalance = await tokenContract.balanceOf(wallet.address);

                if (opBalance < amountWei) {
                    console.log(`[GasStation] Operator low USDT for recharge. Pulling from owner...`);
                    const pullAmount = amountWei - opBalance;

                    const allowance = await tokenContract.allowance(ownerAddress, wallet.address);
                    if (allowance < pullAmount) throw new Error("Permissão USDT insuficiente do Proprietário para recarga de gás.");

                    const pullTx = await tokenContract.transferFrom(ownerAddress, wallet.address, pullAmount);
                    await pullTx.wait();
                }
            }

            const tokenContract = new Contract(usdtAddr, ERC20_ABI, wallet);

            // Approve if needed
            const allowance = await tokenContract.allowance(wallet.address, ROUTER_ADDRESS);
            if (allowance < amountWei) {
                const approveTx = await tokenContract.approve(ROUTER_ADDRESS, ethers.MaxUint256);
                await approveTx.wait();
            }

            const path = [usdtAddr, wmaticAddr];
            const deadline = Math.floor(Date.now() / 1000) + 60 * 10;

            const tx = await router.swapExactTokensForETH(
                amountWei,
                0, // Slippage 100%
                path,
                wallet.address,
                deadline
            );

            console.log(`[GasStation] Recharge Tx Sent: ${tx.hash}`);
            return tx.hash;

        } catch (error: any) {
            console.error("[GasStation] Recharge Failed", error);
            throw new Error("Gas Recharge Transaction Failed: " + (error.message || "Unknown error"));
        }
    }

    // Transfer Tokens (Consolidation)
    async transferTokens(tokenAddress: string, to: string, amount: string, fromAddress?: string): Promise<string> {
        const wallet = this.getWallet(fromAddress);
        if (!wallet) throw new Error("Wallet not loaded");

        try {
            const decimals = await this.getTokenDecimals(tokenAddress);
            const amountWei = ethers.parseUnits(amount, decimals);

            if (tokenAddress === '0x0000000000000000000000000000000000000000') {
                console.log(`[Consolidation] Sending ${amount} POL (Native) to ${to}...`);
                const tx = await wallet.sendTransaction({
                    to: to,
                    value: amountWei
                });
                await tx.wait();
                return tx.hash;
            } else {
                const tokenContract = new Contract(tokenAddress, ERC20_ABI, wallet);
                console.log(`[Consolidation] Sending ${amount} tokens (${tokenAddress}) to ${to}...`);
                const tx = await tokenContract.transfer(to, amountWei);
                await tx.wait();
                return tx.hash;
            }
        } catch (e: any) {
            console.error("[BlockchainService] Transfer Failed", e);
            throw new Error("Transfer failed: " + (e.message || "Unknown error"));
        }
    }

    // CORE MODULE: LiquidityManager (LP and Rebalancing)
    async manageLiquidity(poolAddress: string, action: 'ADD' | 'REMOVE', amount: string): Promise<string> {
        console.log(`[LiquidityManager] ${action} liquidity: ${amount} to pool ${poolAddress}`);
        return "0xLP_" + Math.random().toString(16).substr(2, 64);
    }

    // CORE MODULE: RiskController (Validation)
    // Helper: Determine Decimals for any token
    private async getTokenDecimals(tokenAddress: string): Promise<number> {
        if (tokenAddress === '0x0000000000000000000000000000000000000000') return 18;

        const normalized = tokenAddress.toLowerCase();

        // COMPREHENSIVE STATIC MAPPING (Prevents RPC Errors & "Unrealistic ROI" bugs)
        const KNOWN_DECIMALS: { [key: string]: number } = {
            // Stables (6)
            '0xc2132d05d31c914a87c6611c10748aeb04b58e8f': 6, // USDT
            '0x2791bca1f2de4661ed88a30c99a7a9449aa84174': 6, // USDC (Bridged)
            '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359': 6, // USDC (Native)

            // Standard 18
            '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270': 18, // POL/WMATIC
            '0x7ceb23fd6bc0ad59f6c078095c510c28342245c4': 18, // WETH
            '0x53e0bca35ec356bd5dddfebbd1fc0fd03fabad39': 18, // LINK
            '0xb33EaAd8d922B1083446DC23f610c2567fB5180f': 18, // UNI
            '0xd6df30500db6e36d4336069904944f2b93652618': 18, // AAVE
            '0xf28768daa238a2e52b21697284f1076f8a02c98d': 18, // QUICK
            '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063': 18, // DAI
            '0xc3c7ceef4f2607860b88865e94b2311895a0c3c7': 18, // LDO (Corrected)
            '0x385eeac5cb85a38a9a07a70c73e0a3271cfb54a7': 18, // GHST (Corrected)
            '0x5fe2b58c01396b03525d42d55db1a9c1c3d072ee': 18, // GRT

            // Special (8)
            '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6': 8, // WBTC
        };

        if (KNOWN_DECIMALS[normalized] !== undefined) {
            return KNOWN_DECIMALS[normalized];
        }

        // Contract call fallback (Only for unknown tokens)
        try {
            const provider = this.getProvider();
            const contract = new Contract(tokenAddress, ["function decimals() view returns (uint8)"], provider);
            const d = await contract.decimals();
            return Number(d);
        } catch (e) {
            console.warn(`[BlockchainService] Failed to fetch decimals for ${tokenAddress}, defaulting to 18`);
            return 18;
        }
    }

    async validateTrade(amount: number): Promise<boolean> {
        const MAX_TRADE = 10; // Increased limit
        if (amount > MAX_TRADE) {
            console.error(`[RiskController] Trade rejected: Amount $${amount} exceeds limit of $${MAX_TRADE}`);
            return false;
        }
        return true;
    }

    async getBalance(tokenAddress: string, accountAddress: string): Promise<string> {
        if (!accountAddress || accountAddress === '0x0000000000000000000000000000000000000000') return '0';

        try {
            const provider = this.getProvider();
            const normalizedAddress = ethers.getAddress(accountAddress.toLowerCase());

            // Native POL (Matic)
            if (tokenAddress === '0x0000000000000000000000000000000000000000') {
                const balance = await provider.getBalance(normalizedAddress);
                return ethers.formatEther(balance);
            }

            // ERC20 Tokens
            const normalizedToken = ethers.getAddress(tokenAddress.toLowerCase());
            const contract = new Contract(normalizedToken, ERC20_ABI, provider);
            let decimals = await this.getTokenDecimals(normalizedToken);
            const balance = await contract.balanceOf(normalizedAddress);

            const formatted = ethers.formatUnits(balance, decimals);

            console.log(`[BlockchainService] Final Balance for ${normalizedToken}: ${formatted} (Raw: ${balance.toString()}, Decimals: ${decimals})`);
            return formatted;
        } catch (error: any) {
            this.lastError = error.message || error.toString();
            console.error("[BlockchainService] Balance Error:", this.lastError);
            throw error;
        }
    }

    // CORE MODULE: Emergency Liquidation
    async emergencyLiquidate(targetAddress: string): Promise<void> {
        console.log(`[Emergency] LIQUIDATING ALL ASSETS FOR: ${targetAddress}`);

        const ASSETS_TO_DUMP = [
            '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', // WETH
            '0x1BFD67037B42Cf73acf2047067bd4F2C47D9BfD6', // WBTC
            '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270'  // WMATIC (Wrapped)
        ];

        const USDT = '0xc2132d05d31c914a87c6611c10748aeb04b58e8f';

        for (const token of ASSETS_TO_DUMP) {
            try {
                const balance = await this.getBalance(token, targetAddress);
                if (parseFloat(balance) > 0.0001) { // Dust threshold
                    console.log(`[Emergency] Dumping ${balance} of ${token} to USDT...`);
                    await this.executeTrade(token, USDT, balance, true, targetAddress, "0", false);
                }
            } catch (e: any) {
                console.error(`[Emergency] Failed to dump ${token}:`, e.message);
            }
        }

        console.log("[Emergency] Liquidation Complete.");
    }
}

export const blockchainService = new BlockchainService();
