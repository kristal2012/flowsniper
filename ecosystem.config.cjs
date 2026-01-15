module.exports = {
    apps: [{
        name: 'flowsniper-headless',
        script: 'headless_bot.ts',
        // Use node with tsx loader for best ESM + TypeScript compatibility
        interpreter: 'node',
        interpreter_args: '--import tsx --no-warnings',
        env: {
            NODE_ENV: 'production',
            VITE_PROXY_ENABLED: 'true',
            VITE_MODE: 'DEMO'
        },
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        exp_backoff_restart_delay: 5000 // Wait 5s, then 10s, etc. if it crashes repeatedly
    }]
};
