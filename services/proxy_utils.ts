import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import dotenv from 'dotenv';

dotenv.config();

export interface ProxyConfig {
    enabled: boolean;
    url: string; // protocol://[user:pass@]host:port
}

class ProxyManager {
    private agent: HttpAgent | HttpsAgent | null = null;
    private config: ProxyConfig;

    constructor() {
        const enabled = process.env.VITE_PROXY_ENABLED === 'true';
        const url = process.env.VITE_PROXY_URL || '';

        this.config = { enabled, url };

        if (enabled && url) {
            console.log(`[Proxy] Initializing with: ${url.replace(/:([^:@]+)@/, ':****@')}`);
            if (url.startsWith('socks')) {
                this.agent = new SocksProxyAgent(url);
            } else {
                this.agent = new HttpsProxyAgent(url);
            }
        }
    }

    getAgent() {
        return this.agent;
    }

    isEnabled() {
        return this.config.enabled;
    }

    /**
     * Specialized fetch that injects the proxy agent if enabled.
     * Uses node-fetch in Node environments.
     */
    /**
     * Specialized fetch that injects the proxy agent if enabled.
     * Uses node-fetch in Node environments.
     */
    async proxyFetch(url: string, options: any = {}) {
        if (this.isEnabled()) {
            if (!this.agent) {
                // If proxy is enabled but agent is null, it's a critical error configuration
                throw new Error("[Proxy] Enabled but failed to initialize agent. Aborting request to prevent IP leak.");
            }

            // Note: In Node.js environment, we use node-fetch with the agent.
            // When running in the browser (Vite dev), this file shouldn't be used for API calls
            // as the browser uses the built-in fetch and Vite handles the proxy.
            try {
                // @ts-ignore
                const nodeFetch = (await import('node-fetch')).default;
                return nodeFetch(url, {
                    ...options,
                    agent: this.agent
                });
            } catch (e) {
                console.error("[Proxy] node-fetch not found or error importing", e);
                throw e; // Fail hard if we can't use the proxy
            }
        }
        return fetch(url, options); // Fallback only if proxy is explicitly DISABLED
    }

    /**
     * Verifies if the proxy is working by making a request to a public IP checker.
     */
    async validateConnection(): Promise<boolean> {
        if (!this.isEnabled()) {
            console.log('[Proxy] Disabled. Running with direct connection.');
            return true;
        }

        console.log('[Proxy] Validating connection...');
        try {
            const response = await this.proxyFetch('https://api.ipify.org?format=json');
            if (response.ok) {
                const data = await response.json();
                console.log(`[Proxy] Connection confirmed. Public IP seen by remote: ${data.ip}`);
                return true;
            } else {
                console.error(`[Proxy] Validation request failed: ${response.status} ${response.statusText}`);
                return false;
            }
        } catch (error) {
            console.error('[Proxy] Validation failed with error:', error);
            return false;
        }
    }
}

export const proxyManager = new ProxyManager();
