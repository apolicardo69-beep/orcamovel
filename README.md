# OrcaMóvel 🪵

Agente IA para orçamento de móveis planejados.

## Deploy na Vercel

### Opção 1 — CLI (mais simples)
1. `npm install -g vercel`
2. Na pasta do projeto: `vercel` (preview) ou `vercel --prod` (produção)
3. A Vercel detecta automaticamente que é um projeto Vite (build `npm run build`,
   saída em `dist`) e também publica tudo que estiver em `api/` como serverless
   functions — não precisa de `vercel.json` para isso.

### Opção 2 — GitHub + Vercel (recomendado)
1. Suba este projeto para um repositório GitHub
2. Em [vercel.com](https://vercel.com): **Add New → Project → Import** o repositório
3. Framework preset: **Vite** (detectado automaticamente)
4. Clique em **Deploy**

## Chave de API pré-configurada no servidor (opcional)
Se quiser que os usuários não precisem colar a própria chave, configure uma chave do
servidor que fica protegida numa Vercel Serverless Function (`api/analyze.js`) — ela
NUNCA é enviada ao navegador.

No painel da Vercel → **Project → Settings → Environment Variables**:
```
OPENROUTER_API_KEY = sk-or-xxxxxxxx
```

**Importante:** essa variável não deve ter o prefixo `VITE_`. Qualquer variável
`VITE_*` é embutida pelo Vite diretamente no JavaScript enviado ao navegador — ou
seja, ficaria visível a qualquer visitante do site pelo DevTools. `OPENROUTER_API_KEY`
(sem `VITE_`) só é lida dentro de `api/analyze.js`, do lado do servidor — o código do
navegador nunca a vê.

Se não configurar essa variável, cada usuário insere a própria chave na interface
(⚙️ API key, canto superior direito) — ela fica só no navegador dele.

### Testando a function localmente
```bash
npm install -g vercel
vercel dev
```
Isso roda o Vite e as functions de `api/` juntos, simulando o ambiente da Vercel
(rodar só `npm run dev` não expõe `/api/analyze` — para isso é preciso `vercel dev`).

## Desenvolvimento local
```bash
npm install
npm run dev
```

Acesse: http://localhost:5173
