
// Declare puter for TypeScript
declare const puter: any;

export const analyzePerformance = async (assets: any[], transactions: any[], apiKey?: string) => {
  const prompt = `Analise a seguinte carteira e histórico de operações do robô FlowSniper:
  Assets: ${JSON.stringify(assets)}
  History: ${JSON.stringify(transactions)}
  Forneça uma análise de mercado profissional e concisa em Português, focando em slippage, taxas de liquidez capturadas e otimização de rotas nas DEXs da Polygon (Uniswap v3, QuickSwap). 
  Responda estritamente em JSON com o seguinte formato:
  {
    "summary": "...",
    "riskLevel": "...",
    "recommendation": "...",
    "suggestedStrategy": "..."
  }`;

  try {
    // 1. Prioridade: Chave API Direta (Otimizado para detecção sk-)
    if (apiKey && apiKey.trim().startsWith('sk-')) {
      console.log("Using direct OpenAI API...");
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: "json_object" }
        })
      });
      const data = await response.json();
      return JSON.parse(data.choices[0].message.content);
    }

    // 2. Tentar Puter (Se carregado e sem bloqueio)
    if (typeof puter !== 'undefined') {
      try {
        console.log("Attempting Puter AI...");
        const response = await puter.ai.chat(prompt, { model: 'gpt-4o' });
        const text = typeof response === 'string' ? response : response.message.content;
        const cleanedJson = text.replace(/```json\n?|```/g, '').trim();
        return JSON.parse(cleanedJson);
      } catch (puterError) {
        console.warn("Puter AI blocked or failed, falling back to Pollinations...");
      }
    }

    // 3. Fallback Final: Pollinations.ai (Anônimo e sem conta)
    console.log("Using Pollinations AI anonymous fallback...");
    const pollinationsUrl = `https://text.pollinations.ai/`;
    const response = await fetch(pollinationsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt + "\nRESPONDA APENAS O JSON PURO." }],
        jsonMode: true
      })
    });

    const text = await response.text();
    const cleanedJson = text.replace(/```json\n?|```/g, '').trim();
    return JSON.parse(cleanedJson);

  } catch (error) {
    console.error("FlowSniper AI Fallback Error:", error);
    return {
      summary: "O serviço de IA está em modo de segurança. O robô continua operando com parâmetros padrão.",
      riskLevel: "Estável",
      recommendation: "Monitoramento manual sugerido.",
      suggestedStrategy: "Slippage Capture"
    };
  }
};
