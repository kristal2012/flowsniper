const API_URL = 'http://localhost:3005';

export interface BotStatus {
    running: boolean;
    mode: 'REAL' | 'DEMO';
    lastStatus: string;
    lastProfit: string;
    config: any;
}

export const botApi = {
    async getStatus(): Promise<BotStatus | null> {
        try {
            const res = await fetch(`${API_URL}/status`);
            if (!res.ok) throw new Error('Bot offline');
            return await res.json();
        } catch (e) {
            return null;
        }
    },

    async updateConfig(config: any): Promise<boolean> {
        try {
            const res = await fetch(`${API_URL}/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            return res.ok;
        } catch (e) {
            console.error("Failed to update config", e);
            return false;
        }
    },

    async start(): Promise<boolean> {
        try {
            const res = await fetch(`${API_URL}/start`, { method: 'POST' });
            return res.ok;
        } catch (e) {
            return false;
        }
    },

    async stop(): Promise<boolean> {
        try {
            const res = await fetch(`${API_URL}/stop`, { method: 'POST' });
            return res.ok;
        } catch (e) {
            return false;
        }
    },

    async withdraw(to: string, amount: string, tokenAddress: string): Promise<{ success: boolean; txHash?: string; error?: string }> {
        try {
            const res = await fetch(`${API_URL}/withdraw`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to, amount, tokenAddress })
            });
            return await res.json();
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    },

    async liquidate(): Promise<{ success: boolean; error?: string }> {
        try {
            const res = await fetch(`${API_URL}/liquidate`, { method: 'POST' });
            return await res.json();
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    },

    async recharge(amount: string): Promise<{ success: boolean; txHash?: string; error?: string }> {
        try {
            const res = await fetch(`${API_URL}/recharge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount })
            });
            return await res.json();
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }
};
