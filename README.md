# OrcaMóvel 🪵

Agente IA para orçamento de móveis planejados.

## Deploy no Netlify

### Opção 1 — Arrasta e solta (mais simples)
1. `npm install`
2. `npm run build`
3. Acesse [netlify.com](https://netlify.com) → **Add new site → Deploy manually**
4. Arraste a pasta `dist/` gerada

### Opção 2 — GitHub + Netlify (recomendado)
1. Suba este projeto para um repositório GitHub
2. No Netlify: **Add new site → Import from Git**
3. Selecione o repositório
4. Build command: `npm run build`
5. Publish directory: `dist`
6. Clique em **Deploy**

## Variável de ambiente (opcional)
Se quiser deixar a chave API pré-configurada no servidor:

No painel do Netlify → **Site settings → Environment variables**:
```
VITE_ANTHROPIC_API_KEY = sk-ant-xxxxxxxx
```

Se não configurar, o usuário insere a chave direto na interface (⚙️ Configurar API).

## Desenvolvimento local
```bash
npm install
npm run dev
```

Acesse: http://localhost:5173
