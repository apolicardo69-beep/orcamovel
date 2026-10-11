# Revisão 3 — contagem parcial e recuperação de módulos

## Por que apareceram somente 6 chapas

O total anterior incluía apenas as peças posicionadas. Módulos em revisão e peças maiores que a chapa não participavam dessa quantidade. A revisão 2 ainda acrescentava a toda vista complementar um aviso dentro de divergencias_cotas; isso excluía indevidamente módulos mesmo quando as cotas coincidiam.

## Correções

- Receber uma vista complementar não cria divergência. O aviso genérico da revisão 2 é ignorado também nos itens já salvos; divergências reais continuam exigindo conferência.
- Cotas explicitamente identificadas como PARTE ficam guardadas na vista, sem comparação com a dimensão total do módulo.
- Itens cobrados por un, unidade e ml com dimensões completas podem gerar a simulação. Quantidade comercial em metros lineares não multiplica o número de módulos.
- Avisos de duplicidade usam identidade do módulo: códigos diferentes (ex.: M321 e M322) não são marcados por terem dimensões iguais. Home e prateleira não são duplicatas por terem a mesma quantidade.
- A tela informa "Total de chapas para compra: não determinado" e mostra a cobertura dos itens do orçamento. A contagem de chapas é identificada como referente à parte simulada.
- Tabela por item mostra quantas peças foram geradas/posicionadas e o motivo das pendências. Fora do MDF não conta como item de madeira.
- Campos para corrigir largura, altura e profundidade por módulo. Alterar largura e altura também atualiza o orçamento, como na tabela comercial.
- Exportação do diagnóstico com itens, configuração e cobertura. Não inclui a chave de IA.
- Histórico permite reabrir um orçamento salvo para conferir o corte sem repetir a chamada de IA.

## Usar a leitura já realizada

1. Na versão atualmente aberta, clique em Salvar orçamento ANTES de fechar/trocar o projeto.
2. Extraia a nova versão em uma pasta nova. Pare o servidor anterior e inicie esta versão no mesmo endereço http://localhost:5173 e no mesmo navegador/perfil. O histórico fica no armazenamento daquele endereço.
3. Instale com npm ci. Execute npm test e npm run build. Inicie com npm run dev.
4. Abra Histórico e use Reabrir para conferir o corte. Isso carrega a cópia salva e substitui os itens em edição; salve qualquer outro trabalho antes.
5. Na aba do corte, clique em Exportar diagnóstico da leitura e envie OrcaMovel_Diagnostico.json. Assim é possível comparar a extração exata com o PDF, sem nova chamada paga.

## Validação e limites

77 testes passaram; JSX alterado teve sintaxe verificada. O build completo permanece impedido neste ambiente pela ausência do binário Rollup para Linux. Não houve teste visual no navegador ou nova análise por IA.

Esta atualização não afirma que o total de chapas está correto nem preenche regras de fabricação ausentes. Ela corrige omissões indevidas e apresenta o que efetivamente entrou na simulação. Sem os dados exatos da execução do usuário, não é possível confirmar quantos itens voltarão ao plano nem fornecer a quantidade real de chapas.

Recortes, frisos, composição de painéis, emendas e métodos não validados continuam pendentes. O motor único integrado e a produção final continuam em desenvolvimento. Não houve publicação ou alteração de Supabase.
