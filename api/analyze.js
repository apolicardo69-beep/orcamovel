// Proxy server-side para a OpenRouter (Vercel Serverless Function).
//
// Por quê isto existe: o app permite que cada usuário cole sua própria chave da
// OpenRouter (guardada só no localStorage do navegador dele, usada só nas chamadas
// dele — tudo bem). O problema era o dono do site pré-configurar UMA chave para todo
// mundo via variável VITE_OPENROUTER_API_KEY: o prefixo VITE_ faz o Vite embutir o
// valor no JS que é enviado ao navegador, ou seja, qualquer visitante conseguia abrir
// o DevTools e ler a chave paga do dono do site.
//
// Esta function resolve isso: a chave do servidor fica em OPENROUTER_API_KEY, lida
// aqui via process.env — isso só roda no runtime serverless da Vercel, nunca é
// enviado ao navegador. O frontend só chama /api/analyze quando o usuário não tem
// uma chave pessoal configurada (ver src/App.jsx, requestPageAnalysis).
//
// Configuração na Vercel: Project → Settings → Environment Variables →
//   OPENROUTER_API_KEY = sk-or-xxxxxxxx
//
// A Vercel detecta qualquer arquivo dentro de /api na raiz do projeto e publica
// automaticamente em https://seu-site.vercel.app/api/analyze — não precisa de
// configuração extra em vercel.json para isso.

export default async function handler(req, res) {
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

  // A Vercel já faz o parse do JSON em req.body quando o Content-Type é
  // application/json, mas cobrimos o caso de vir como string por segurança.
  let payload = req.body;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload || "{}");
    } catch {
      res.status(400).json({ error: { message: "Corpo da requisição inválido (JSON malformado)." } });
      return;
    }
  }

  const { systemPrompt, imageDataUrl, instruction, maxTokens } = payload || {};
  if (!systemPrompt || !imageDataUrl || !instruction) {
    res.status(400).json({ error: { message: "Campos obrigatórios ausentes: systemPrompt, imageDataUrl, instruction." } });
    return;
  }

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
        model: "anthropic/claude-sonnet-4-5",
        max_tokens: maxTokens || 4096,
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

    // Repassa o corpo tal como veio da OpenRouter — o frontend já sabe interpretar
    // esse formato (choices[0].message.content, finish_reason etc), então mantemos
    // o mesmo contrato independentemente do caminho (chave pessoal x proxy).
    const data = await upstream.json().catch(() => ({}));
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: { message: "Falha ao contatar a OpenRouter: " + err.message } });
  }
}
