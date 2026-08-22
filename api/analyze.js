// Proxy server-side para a OpenRouter (Vercel Serverless Function).
// A chave do servidor fica segura em OPENROUTER_API_KEY e nunca é enviada ao navegador.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: { message: "Método não permitido." } });
    return;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    res.status(400).json({
      error: {
        message: "Nenhuma chave OpenRouter configurada no servidor (OPENROUTER_API_KEY).",
        code: "NO_SERVER_KEY",
      },
    });
    return;
  }

  let payload = req.body;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload || "{}");
    } catch {
      res.status(400).json({ error: { message: "Corpo da requisição inválido (JSON malformado)." } });
      return;
    }
  }

  const { systemPrompt, imageDataUrl, instruction, maxTokens, model } = payload || {};
  if (!systemPrompt || !imageDataUrl || !instruction) {
    res.status(400).json({ error: { message: "Campos obrigatórios ausentes: systemPrompt, imageDataUrl, instruction." } });
    return;
  }

  // Modelo padrão mais avançado: Claude 3.7 Sonnet
  const selectedModel = model || "anthropic/claude-3.7-sonnet";

  try {
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": `https://${req.headers.host || "orcamovel.vercel.app"}`,
        "X-Title": "OrcaMóvel",
      },
      body: JSON.stringify({
        model: selectedModel,
        max_tokens: maxTokens || 4096,
        temperature: 0.1,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: imageDataUrl } },
              { type: "text", text: instruction },
            ],
          },
        ],
      }),
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      res.status(upstream.status).json({
        error: {
          message: data?.error?.message || `Erro ${upstream.status} da OpenRouter.`,
          code: data?.error?.code,
        },
      });
      return;
    }

    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: { message: "Falha ao contatar a OpenRouter: " + err.message } });
  }
}
