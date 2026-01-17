// Basic check if we are in Node.js
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

export interface ProxyConfig {
    enabled: boolean;
    url: string;
}

class ProxyManager {
    private agent: any = null;
    private freeProxyList: string[] = [];
    private currentProxyIndex: number = -1;
    private isInitializing: boolean = false;

    constructor() {
        // We delay agent initialization if we don't have the URL yet
        const url = this.getEnvUrl();
        if (this.isEnabled() && url && !url.includes('sua_url_aqui')) {
            this.initializeAgent(url);
        }
    }

    private getEnvUrl(): string {
        if (isNode) return process.env.VITE_PROXY_URL || '';
        return (import.meta as any).env?.VITE_PROXY_URL || '';
    }

    private async initializeAgent(url: string) {
        if (typeof window !== 'undefined') return; // Do not initialize agents in browser

        try {
            console.log(`[Proxy] Initializing with: ${url.replace(/:([^:@]+)@/, ':****@')}`);
            if (url.startsWith('socks')) {
                const { SocksProxyAgent } = await import('socks-proxy-agent');
                this.agent = new SocksProxyAgent(url);
            } else {
                const { HttpsProxyAgent } = await import('https-proxy-agent');
                this.agent = new HttpsProxyAgent(url);
            }
        } catch (e) {
            console.error("[Proxy] Failed to initialize agent for URL:", url, e);
            this.agent = null;
        }
    }

    private async fetchFreeProxies() {
        if (this.isInitializing) return;
        this.isInitializing = true;

        console.log("[Proxy] Fetching fresh free SOCKS5 proxy list...");
        try {
            const response = await fetch('https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks5&timeout=10000&country=all&ssl=all&anonymity=all');
            if (response.ok) {
                const text = await response.text();
                const proxies = text.split('\n').map(p => p.trim()).filter(p => p.length > 0);
                if (proxies.length > 0) {
                    this.freeProxyList = proxies.map(p => `socks5://${p}`);
                    console.log(`[Proxy] Loaded ${this.freeProxyList.length} free proxies.`);
                    this.currentProxyIndex = 0;
                    return;
                }
            }
        } catch (e) {
            console.error("[Proxy] Error fetching from ProxyScrape:", e);
        } finally {
            this.isInitializing = false;
        }
    }

    async rotateProxy(): Promise<boolean> {
        if (typeof window !== 'undefined') return false;

        if (this.freeProxyList.length === 0 || this.currentProxyIndex >= this.freeProxyList.length - 1) {
            await this.fetchFreeProxies();
        } else {
            this.currentProxyIndex++;
        }

        if (this.freeProxyList.length > 0 && this.currentProxyIndex < this.freeProxyList.length) {
            const nextUrl = this.freeProxyList[this.currentProxyIndex];
            console.log(`[Proxy] Rotating to new candidate: ${nextUrl}`);
            await this.initializeAgent(nextUrl);
            return true;
        }
        return false;
    }

    getAgent() {
        return this.agent;
    }

    isEnabled(): boolean {
        if (isNode) return process.env.VITE_PROXY_ENABLED === 'true';
        return (import.meta as any).env?.VITE_PROXY_ENABLED === 'true';
    }

    /**
     * Specialized fetch that injects the proxy agent if enabled.
     * Uses automatic rotation if the current proxy fails.
     */
    async proxyFetch(url: string, options: any = {}, retryCount = 0): Promise<any> {
        if (!this.isEnabled()) {
            return fetch(url, options);
        }

        // Browser fallback: Use native fetch without agent
        if (typeof window !== 'undefined') {
            return fetch(url, options);
        }

        if (!this.agent) {
            const rotated = await this.rotateProxy();
            if (!rotated && retryCount < 3) {
                console.warn("[Proxy] Nenhum proxy funcional encontrado. Usando conexão direta como último recurso.");
                return fetch(url, options);
            }
        }

        try {
            // @ts-ignore
            const nodeFetch = (await import('node-fetch')).default;

            // Convert Uint8Array body to Buffer for node-fetch compatibility
            let body = options.body;
            if (body && body instanceof Uint8Array) {
                body = Buffer.from(body);
            }

            const response = await nodeFetch(url, {
                ...options,
                body,
                agent: this.agent,
                timeout: 15000
            });

            if (!response.ok && (response.status === 403 || response.status === 429) && retryCount < 5) {
                console.warn(`[Proxy] API Bloqueada (${response.status}) em ${url}. Rotacionando...`);
                await this.rotateProxy();
                return this.proxyFetch(url, options, retryCount + 1);
            }

            return response;
        } catch (e: any) {
            const retryableErrors = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EHOSTUNREACH'];
            const isRetryable = retryableErrors.some(code => e.code === code || e.message?.includes(code));

            if ((isRetryable || retryCount < 2) && retryCount < 5) {
                console.warn(`[Proxy] Conexão falhou para ${url}: ${e.message}. Rotacionando e tentando novamente (${retryCount + 1}/5)...`);
                await this.rotateProxy();
                return this.proxyFetch(url, options, retryCount + 1);
            }
            throw e;
        }
    }

    /**
     * Returns a fetch-like function for ethers.js v6 FetchRequest.getUrl
     */
    getEthersFetch() {
        return async (req: any) => {
            if (typeof window !== 'undefined') {
                // In browser, let ethers use its default fetch
                return null; // Returning null/undefined might not work, let's just do a plain fetch
            }

            const url = req.url;
            const options: any = {
                method: req.method,
                headers: req.headers,
                body: req.body
            };

            const response = await this.proxyFetch(url, options);

            // Fetch body as ArrayBuffer
            const bodyBuffer = await response.arrayBuffer();

            // Map headers
            const headers: Record<string, string> = {};
            response.headers.forEach((value: string, key: string) => {
                headers[key.toLowerCase()] = value;
            });

            return {
                statusCode: response.status,
                statusMessage: response.statusText || "OK",
                headers: headers,
                body: new Uint8Array(bodyBuffer)
            };
        };
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
            if (typeof window === 'undefined') {
                const rotated = await this.rotateProxy();
                if (rotated) return this.validateConnection();
            }
            return false;
        }
    }
}

export const proxyManager = new ProxyManager();
