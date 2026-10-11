> Atualização Fase 1: consulte FASE_1_LEIA_PRIMEIRO.md. O plano legado agora é simulação, com chapas separadas e impressão de produção bloqueada até validação.

# Banco Construtivo V1 — pacote de testes

Esta versão adiciona uma camada nova e isolada ao OrcaMóvel. O motor legado continua disponível; o Banco Construtivo V1 pode ser testado pela nova aba **Banco Construtivo** e por testes automatizados.

## Regras consolidadas nesta versão

- Medidas internas do motor em milímetros.
- Gabinete de cozinha/banheiro/lavanderia: caixa sobre a base, duas travessas superiores de 50 mm, prateleira padrão 1, profundidade derivada da pedra/projeto, tamponamentos simples/engrossados e régua de parede 50 mm.
- Portas: folga geral de 3 mm registrada como padrão global.
- Gaveta MDF: 2 laterais + frente interna + contrafrente; fundo 6 mm em rasgo, offset 12 mm e profundidade do rasgo 8 mm.
- Corrediça telescópica: perfil interno de teste com 25 mm de folga total, marcado EM_VALIDACAO.
- Corrediça invisível: perfil interno editável, marcado EM_VALIDACAO.
- Aéreos: fundo 6 mm parafusado por trás; tamponamento avança 18 mm na frente + 6 mm do fundo; 1 prateleira por vão quando o projeto não detalha; roda-teto padrão 50 mm.
- Caixa de geladeira: superior padrão 450 mm quando ausente no projeto; régua de engrossamento 100 mm quando engrossada.
- Torre quente: largura interna padrão 700 mm; zonas de forno/micro sem medida ficam pendentes.
- Guarda-roupa: base 100 mm, acabamento superior 70 mm, fundo 6 mm parafusado atrás, tamponamento com avanço 18+6.
- Guarda-roupa correr: montantes 80 mm menores que o tamponamento; portas com desconto de 35 mm para carrinhos; sobreposição 20 mm.
- Gaveteiro interno: sarrafo lateral 50 mm; em porta de giro recuo frontal 60 mm; em porta de correr faceia os montantes internos.
- Painel liso/ripado: medidas visuais conforme projeto; réguas de fixação de 15 mm com espaçamento máximo de 600 mm.
- Tamborado paramétrico: face + miolo + face, inclusive 6+15+6 ou 15+15+15.
- Caixa central tamponada: tampo superior cobre as emendas laterais; profundidade faceada por padrão, permitindo exceção do projeto.
- Ferragens especiais podem ser cadastradas com especificações livres e permanecem em revisão até validação.

## Completado nesta revisão (V1.1)

- **Guarda-roupa** gerava apenas o fundo. Agora gera a caixa completa: laterais, base, tampo, fundo parafusado, rodapé (frontal + laterais), acabamento superior, prateleiras e tamponamentos. Divisórias internas (`internal_post_qty`) dividem o vão e a prateleira passa a sair na largura do vão, não na largura total.
- **Portas** só entram como peça de corte com `include_doors: true` — em kit de alumínio/vidro elas vêm prontas do fornecedor, e no orçamento por m² a área da frente já está no corpo. As medidas calculadas continuam sempre disponíveis em `dimensions`.
- **Torre quente** não gerava peça nenhuma. Agora gera laterais, base, tampo, fundo e separadores entre zonas. Se qualquer zona estiver sem medida, ou faltar a profundidade, não gera peça e devolve `INFORMACAO_AUSENTE` com o motivo — chutar altura de forno estraga a chapa.
- **Aéreo com mais de um vão** gerava prateleira na largura total e nenhuma divisória (impossível de montar). Agora gera a divisória vertical por vão e a prateleira na largura do vão.
- **Painel liso** gerava só as réguas de fixação; agora gera também a placa. **Painel ripado** calcula as ripas quando o projeto informa `ripa_width_mm` e `ripa_gap_mm`; sem essas medidas fica `INFORMACAO_AUSENTE` em vez de inventar.
- **Material por peça**: toda peça carrega `material_id` e as medidas da chapa, derivados da espessura. Sem isso o `groupPiecesForCut` juntava fundo de 6 mm com estrutura de 15 mm na mesma otimização.
- Removidas as pastas `engine/catalog` e `engine/production` (tentativa anterior, sem nenhum import) e a pasta vazia `engine/validation`.

## Ainda pendente

O Banco Construtivo continua **isolado na aba de laboratório**. O Plano de Corte segue usando o motor antigo (`metodosConstrutivos.js`, por categoria e em metros). Ligar os dois é o próximo passo e exige mapear cada linha do orçamento para um método + preencher profundidade/pedra.

## Segurança

Este pacote é de **validação técnica**, não deve ser usado como autorização final de produção sem conferência. Métodos e ferragens ainda aparecem como EM_VALIDACAO quando faltam fichas técnicas ou fórmulas que ainda não foram confirmadas.

## Executar

```bash
npm install
npm run test:construction
npm run build
npm run dev
```

Na aplicação, abra a aba **Banco Construtivo**.
