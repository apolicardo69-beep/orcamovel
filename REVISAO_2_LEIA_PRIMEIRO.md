# OrcaMóvel — Revisão 2: interpretação construtiva

Esta versão inclui as correções da Fase 1 e o primeiro lote de interpretação validado com casos do PDF FC_DET-INT_WARLEI_R00_MIXADO.pdf.

## Mudanças

- Painel com frisos não gera ripas. A execução pode ser marcada como usinada ou negativo entre placas; ambos aguardam parâmetros/método específico para gerar corte.
- Nomes de painéis passam pela classificação construtiva antes da categoria comercial. Painel para TV deixa de gerar automaticamente portas e divisórias de armário apenas por estar na categoria TV/Sala.
- Ripados deixam de herdar silenciosamente 50/20 mm da configuração antiga. Largura, espaço, espessura da ripa, presença de base e espessura de base são informados por módulo.
- Recortes de janela, portas embutidas e divergências entre cotas geram revisão. Não são convertidos silenciosamente em retângulos completos.
- Código e ambiente permitem relacionar vistas. Complementos enviados pela IA são guardados no módulo sem criar outra linha comercial nem substituir medidas. Código repetido gera revisão, pois também pode indicar partes diferentes de um mesmo conjunto. Vistas sem vínculo único ficam visíveis para conferência.
- Avisos de peças não posicionadas agrupados por peça e medida, com quantidade. Milímetros apresentados com até duas casas decimais.
- Nova seção "Conferir módulos e parâmetros de construção" na aba de corte. Pode editar código e tipo construtivo, escolher execução dos frisos e preencher parâmetros de ripado.

## Como testar

1. Extraia em uma pasta nova, preservando a versão anterior.
2. Abra orcamovel no terminal. Execute npm ci, npm test, npm run build e npm run dev, um por vez.
3. Para verificar as mudanças de leitura, envie novamente o PDF no sistema e execute a análise. Isso consome o serviço de IA configurado. Registros antigos não ganham cotas/recortes que a leitura anterior omitiu.
4. Na aba de corte, abra "Conferir módulos e parâmetros de construção". Compare identificação, tipo e medidas com o desenho. Salve o orçamento para conservar as alterações nos itens.
5. No M304 com recorte de janela, o esperado nesta etapa é revisão da geometria, sem lista automática de ripas iguais. No painel Nuvem com frisos, o esperado é revisão da execução dos sulcos/negativos, sem dezenas de ripas de 50 mm.

## Verificação realizada

68 testes automatizados passaram. Sintaxe dos componentes JSX alterados validada. Casos incluem M304 com recorte, Nuvem com frisos, painel para TV, cotas divergentes e agrupamento de 137 avisos repetidos.

A leitura real por IA do PDF não foi exercitada nesta revisão: os testes usam dados transcritos das pranchas, não garantem a precisão da extração automática. O build foi tentado e permanece impedido neste ambiente pela falta de @rollup/rollup-linux-x64-gnu. Não foi feita validação visual no navegador. Execute o build local antes de substituir uma instalação publicada.

## Ainda pendente

Este lote não conclui o motor construtivo único nem a fabricação dos painéis especiais. Faltam definir a geometria de corte para recortes, posições/profundidades dos frisos, composição de painéis espessos, regras de fixação, divisão/emenda e integração do catálogo validado. A produção permanece bloqueada. Alterar um seletor não equivale a aprovar uma regra de fabricação.

As fórmulas comerciais do orçamento foram preservadas; a correção de adicionais percentuais continua pendente. Nenhuma alteração no Supabase ou publicação foi realizada. node_modules e dist antigo foram excluídos do pacote.
