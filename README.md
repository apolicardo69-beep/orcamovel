# OrcaMóvel 🪵

Agente IA para orçamento de móveis planejados e marcenaria de alto padrão.

## Deploy na Vercel (Recomendado)

### Opção 1 — GitHub + Vercel (Automático)
1. Suba este projeto para o seu repositório GitHub (`apolicardo69-beep/orcamovel`).
2. Em [vercel.com](https://vercel.com): **Import Project** selecionando o repositório.
3. Framework Preset: **Vite** (detectado automaticamente).
4. No painel da Vercel: **Settings → Environment Variables**:
   - `OPENROUTER_API_KEY` = `sk-or-...` (sua chave da OpenRouter protegida no servidor)
5. Clique em **Deploy**.

### Opção 2 — CLI da Vercel
```bash
npm install -g vercel
vercel --prod
```

## Configuração da Chave de API
- **No Servidor (Vercel)**: Defina a variável de ambiente `OPENROUTER_API_KEY` no painel da Vercel. A serverless function em `api/analyze.js` utilizará essa chave de forma 100% segura sem expor ao navegador dos clientes.
- **No Navegador (Pessoal)**: Caso não configure no servidor, o usuário pode inserir sua própria chave clicando em **⚙️ API key** no topo do aplicativo.

## Desenvolvimento Local
```bash
npm install
npm run dev
```

Acesse em: `http://localhost:5173`
