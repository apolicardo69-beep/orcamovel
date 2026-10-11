# OrcaMóvel — Fase 1: correções e bloqueios de produção

## O que mudou

- Chapas da simulação separadas por material, espessura, padrão e veio.
- Prateleira de 2,50 metros lineares preserva 2.500 mm. Dimensões de produção não perdem décimos de milímetro na normalização.
- Tamponamentos laterais e inferiores do gabinete seguem avanço frontal de 18 mm e traseiro de 6 mm. Caixa 570 mm: tamponamento 594 mm. Régua de parede continua com 50 mm.
- Peças maiores que a chapa permanecem inteiras; não há aplicação automática de emendas.
- Validador rejeita resultados vazios, medidas não finitas, quantidades inválidas, ausência de material/chapa, peças fora da chapa, pendências, métodos e ferragens ainda não validados.
- Conflito entre altura do montante de correr e vão da caixa sinalizado para revisão. Não foi escolhida uma montagem ainda não confirmada.
- Torre sem zonas e caixa central incompleta ficam bloqueadas.
- Plano legado identificado como SIMULAÇÃO. O botão de impressão para produção fica indisponível enquanto não existir validação construtiva integrada. Painéis manuais não liberam automaticamente um módulo.
- Sintaxe JSX conferida; 57 testes automatizados aprovados.

## Instalação em uma pasta nova

1. Extraia este arquivo e abra a pasta orcamovel no seu editor/terminal.
2. Execute `npm ci` para instalar as versões do package-lock.json.
3. Execute `npm test`.
4. Execute `npm run build`.
5. Para desenvolvimento, execute `npm run dev`.

Não foram incluídos node_modules (dependências específicas do computador) nem dist antigo. Não substitua sua pasta atual sem guardar uma cópia. O armazenamento local do navegador não foi migrado ou apagado. Não limpe os dados do navegador se quiser conservar seus registros locais.

## Validação e limites desta entrega

O build completo não pôde ser validado neste ambiente: o pacote original trouxe binários Windows e falta o Rollup nativo para Linux. A rede não permitiu obter a dependência. A análise de sintaxe dos componentes React passou; ela não substitui o build ou teste visual no navegador.

Esta fase preserva orçamento, histórico, IA e proposta comercial. Não publica o sistema. A chamada de IA não foi exercitada.

O laboratório e o plano legado continuam separados. Todos os métodos atuais do catálogo estão EM_VALIDACAO; por isso nenhum cenário do laboratório equivale a autorização de produção. A impressão da simulação permanece bloqueada até a próxima fase. Não há botão para contornar uma regra inexistente.

Próximas fases: conferir montagem dos montantes, completar a caixa central e demais módulos, integrar materiais e ferragens reais, aprovar e versionar regras, conectar o motor único ao plano e depois persistir em Supabase. As fórmulas legadas restantes (incluindo descontos e distribuição de gavetas) ainda não foram certificadas para fabricação. O cálculo comercial de acréscimos percentuais e a proteção da API de IA permanecem pendentes de etapas próprias.

## Arquivos alterados

- src/engine/construction/engine.js
- src/engine/metodosConstrutivos.js
- src/engine/otimizador.js
- src/components/PlanoCorteView.jsx
- tests/modulacao.test.js
- tests/productionSafety.test.js (novo)
- package.json
- BANCO_CONSTRUTIVO_TESTES.md
- FASE_1_LEIA_PRIMEIRO.md (novo)
