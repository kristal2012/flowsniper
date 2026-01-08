
import { ethers, JsonRpcProvider, Wallet, Contract, BrowserProvider } from 'ethers';

// Standard ERC20 ABI (Minimal)
const ERC20_ABI = [
    "function balance_Of(address owner) view returns (uint256)",
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
const ROUTER_ADDRESS = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";

const DEFAULT_RPC = 'https://polygon-mainnet.g.alchemy.com/v2/iRsg1SsPMDZZ9s5kHsRbH'; // User Alchemy RPC
const FALLBACK_RPCS = [
    'https://polygon-rpc.com',
    'https://rpc-mainnet.maticvigil.com',
    'https://1rpc.io/matic'
];

export class BlockchainService {
    private getRPC(): string {
        return localStorage.getItem('fs_polygon_rpc') || import.meta.env.VITE_POLYGON_RPC_URL || DEFAULT_RPC;
    }

    public lastError: string | null = null;
    private browserProvider: BrowserProvider | null = null;
    private operatorWallet: Wallet | null = null;

    constructor() {
        if (typeof window !== 'undefined' && (window.ethereum || (window as any).rabby)) {
            // Priority to Rabby if available, otherwise standard ethereum
            const provider = (window as any).rabby || window.ethereum;
            this.browserProvider = new BrowserProvider(provider);
        }
        this.loadOperatorWallet();
    }

    private loadOperatorWallet() {
        const storedKey = localStorage.getItem('fs_operator_key');
        if (storedKey) {
            try {
                this.operatorWallet = new Wallet(storedKey, this.getProvider());
            } catch (e) {
                console.error("Failed to load operator wallet", e);
            }
        }
    }

    public async connectWallet(): Promise<string> {
        if (!this.browserProvider) throw new Error("Carteira (Rabby/MetaMask) não encontrada.");
        await this.ensurePolygonNetwork();
        const accounts = await (window.ethereum || (window as any).rabby).request({ method: 'eth_requestAccounts' });
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
            localStorage.setItem('fs_operator_key', newWallet.privateKey);
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
        try {
            // Explicitly set network to 137 (Polygon) for faster initialization
            return new JsonRpcProvider(rpc, 137, { staticNetwork: true });
        } catch (e) {
            console.warn("[BlockchainService] Primary RPC failed, using fallback:", FALLBACK_RPCS[0]);
            return new JsonRpcProvider(FALLBACK_RPCS[0], 137, { staticNetwork: true });
        }
    }

    private getWallet(): Wallet | null {
        // Prioritize Operator Wallet
        if (this.operatorWallet) {
            return this.operatorWallet.connect(this.getProvider());
        }

        const pvtKey = localStorage.getItem('fs_private_key') || import.meta.env.VITE_PRIVATE_KEY;
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
    async executeTrade(tokenIn: string, tokenOut: string, amountIn: string, isReal: boolean): Promise<string> {
        console.log(`[TradeExecutor] Executing ${isReal ? 'REAL' : 'SIMULATED'} trade: ${amountIn} tokens`);

        if (!isReal) {
            // SIMULATION MODE
            await new Promise(r => setTimeout(r, 1000)); // Fake latency
            return "0xSIM_" + Math.random().toString(16).substr(2, 32);
        }

        // REAL MODE
        const wallet = this.getWallet();
        if (!wallet) {
            throw new Error("Private Key required for Risk Mode (Real Trading)");
        }

        try {
            const router = new Contract(ROUTER_ADDRESS, ROUTER_ABI, wallet);

            // Dynamic Decimals Detection
            const isStable = tokenIn.toLowerCase() === '0xc2132d05d31c914a87c6611c10748aeb04b58e8f' || // USDT
                tokenIn.toLowerCase() === '0x2791bca1f2de4661ed88a30c99a7a9449aa84174';   // USDC

            const decimals = isStable ? 6 : 18;
            const amountWei = ethers.parseUnits(amountIn, decimals);

            // 0. Pull funds from Owner to Operator if needed
            const ownerAddress = localStorage.getItem('fs_owner_address');
            if (this.operatorWallet && wallet.address === this.operatorWallet.address && ownerAddress) {
                const tokenContract = new Contract(tokenIn, ERC20_ABI, wallet);
                const opBalance = await tokenContract.balanceOf(wallet.address);

                if (opBalance < amountWei) {
                    console.log(`[TradeExecutor] Operator low balance. Attempting to pull funds from owner: ${ownerAddress}`);
                    const remainingToPull = amountWei - opBalance;

                    // Verify allowance
                    const allowanceFromOwner = await tokenContract.allowance(ownerAddress, wallet.address);
                    if (allowanceFromOwner < remainingToPull) {
                        throw new Error(`Saldo insuficiente no Operador e permissão insuficiente do Proprietário. Necessário: ${ethers.formatUnits(remainingToPull, decimals)}`);
                    }

                    const pullTx = await tokenContract.transferFrom(ownerAddress, wallet.address, remainingToPull);
                    await pullTx.wait();
                    console.log(`[TradeExecutor] Pulled ${ethers.formatUnits(remainingToPull, decimals)} tokens from owner.`);
                }
            }

            const tokenContract = new Contract(tokenIn, ERC20_ABI, wallet);

            // 1. Check & Approve Router if needed
            console.log(`[TradeExecutor] Checking/Approving Router...`);
            const allowance = await tokenContract.allowance(wallet.address, ROUTER_ADDRESS);

            if (allowance < amountWei) {
                const approveTx = await tokenContract.approve(ROUTER_ADDRESS, ethers.MaxUint256);
                await approveTx.wait();
            }

            // 2. Swap
            const path = [tokenIn, tokenOut];
            const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 mins

            // Gas estimation for transparency
            const gasPrice = (await this.getProvider().getFeeData()).gasPrice || ethers.parseUnits('50', 'gwei');

            console.log(`[TradeExecutor] Sending Swap Tx...`);
            const tx = await router.swapExactTokensForTokens(
                amountWei,
                0, // Slippage 100% allowed (Sniper Mode - Dangerous but fast)
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

        } catch (error: any) {
            console.error("[TradeExecutor] Real Trade Failed", error);
            throw new Error("Blockchain Transaction Failed: " + (error.message || "Unknown error"));
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

    // CORE MODULE: LiquidityManager (LP and Rebalancing)
    async manageLiquidity(poolAddress: string, action: 'ADD' | 'REMOVE', amount: string): Promise<string> {
        console.log(`[LiquidityManager] ${action} liquidity: ${amount} to pool ${poolAddress}`);
        return "0xLP_" + Math.random().toString(16).substr(2, 64);
    }

    // CORE MODULE: RiskController (Validation)
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
            const normalizedAddress = ethers.getAddress(accountAddress);

            // Native POL (Matic)
            if (tokenAddress === '0x0000000000000000000000000000000000000000') {
                const balance = await provider.getBalance(normalizedAddress);
                return ethers.formatEther(balance);
            }

            // ERC20 Tokens
            const normalizedToken = ethers.getAddress(tokenAddress);
            const contract = new Contract(normalizedToken, ERC20_ABI, provider);
            const balance = await contract.balanceOf(normalizedAddress);

            // USDT / USDC on Polygon use 6 decimals
            const USDT_ADDR = '0xc2132d05d31c914a87c6611c10748aeb04b58e8f';
            const USDC_ADDR = '0x2791bca1f2de4661ed88a30c99a7a9449aa84174';

            const isStable = normalizedToken.toLowerCase() === USDT_ADDR.toLowerCase() ||
                normalizedToken.toLowerCase() === USDC_ADDR.toLowerCase();

            const decimals = isStable ? 6 : 18;
            const formatted = ethers.formatUnits(balance, decimals);

            console.log(`[BlockchainService] Balance for ${normalizedToken}: ${formatted} (Raw: ${balance.toString()}, Decimals: ${decimals})`);
            return formatted;
        } catch (error: any) {
            this.lastError = error.message || error.toString();
            console.error("[BlockchainService] Balance Error:", this.lastError);
            throw error; // Let the caller decide how to handle it
        }
    }
}

export const blockchainService = new BlockchainService();
