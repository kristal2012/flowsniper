
export interface Asset {
  symbol: string;
  name: string;
  balance: number;
  valueUsd: number;
  price: number;
  allocation: number;
  change24h: number;
}

export interface Transaction {
  id: string;
  type: 'BUY' | 'SELL' | 'TRANSFER' | 'SWAP' | 'BOT_TRADE';
  asset: string;
  amount: number;
  price: number;
  total: number;
  timestamp: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  txHash: string;
  details?: string;
}

export interface PerformanceData {
  timestamp: string;
  pnl: number;
  equity: number;
}

export interface ManagerProfile {
  address: string;
  name: string;
  totalAum: number;
  pnlAllTime: number;
  pnlMonthly: number;
  winRate: number;
  tradesCount: number;
}

export interface BotInstance {
  id: string;
  name: string;
  status: 'RUNNING' | 'STOPPED' | 'PAUSED';
  strategy: 'SLIPPAGE_LP_ALPHA';
  network: 'POLYGON';
  tvl: number;
  dailyProfit: number;
  activeOps: number;
  profitSplit: number; // e.g., 0.7 for 70%
}

export type FlowOperation =
  | 'SLIPPAGE_SWAP'
  | 'LP_FEE_CAPTURE'
  | 'SANDWICH_DETECTION'
  | 'CROSS_DEX_LIQUIDITY'
  | 'ROUTE_OPTIMIZATION'
  | 'LIQUIDITY_SCAN';

export const SUPPORTED_PAIRS = [
  'POL/USDT',
  'WBTC/USDT',
  'WETH/USDT',
  'POL/ETH',
  'WBTC/ETH'
];

export interface FlowStep {
  id: string;
  timestamp: string;
  type: FlowOperation;
  pair: string; // e.g. "WMATIC/USDC"
  profit: number;
  status: 'SUCCESS' | 'FAILED';
  hash: string;
}

export interface SniperStep {
  id: string;
  timestamp: string;
  path: string[];
  profit: number;
  status: 'SUCCESS' | 'EXPIRED';
  hash: string;
}
