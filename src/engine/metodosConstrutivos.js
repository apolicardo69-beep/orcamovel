// ============================================================
// MÉTODOS CONSTRUTIVOS — Decomposição das peças do orçamento em
// painéis físicos reais de corte (laterais, tampo, base, fundo,
// prateleiras...), para alimentar o motor de nesting (otimizador.js).
//
// POR QUÊ ISSO EXISTE:
// Uma linha do orçamento como "Corpo do armário 2,21×2,63 m²" NÃO é
// uma peça física de corte — é o preço de um MÓDULO inteiro (2
// laterais + tampo + base + fundo + prateleiras + portas). Antes desta
// decomposição, o plano de corte tratava cada linha do orçamento como
// se fosse ela mesma um único retângulo a cortar, o que gera um plano
// de corte fisicamente incorreto para qualquer módulo com profundidade
// (armário, gabinete, cristaleira...).
//
// COMO FUNCIONA:
// decomporPeca(peca, metodosConfig) devolve um destes status:
//   - "ok"       → paineis: lista de retângulos físicos reais (m)
//   - "manual"   → motivo: por que não foi possível decompor
//                  automaticamente (categoria não configurada,
//                  faltam dimensões, é uma peça cobrada por metro
//                  linear sem modulação definida, etc.) — o
//                  marceneiro insere os painéis manualmente na aba
//                  Plano de Corte.
//   - "excluido" → motivo: item que não é madeira (vidro, alumínio)
//                  ou não é uma peça física (acréscimo percentual) —
//                  não deve entrar no plano de corte de MDF.
//
// LIMITAÇÃO CONHECIDA (documentada, não escondida): nesta versão,
// peças de fundo (espessura menor, ex. 6mm) entram no MESMO plano de
// corte das peças estruturais (ex. 15mm) por simplicidade — na
// prática elas costumam vir de uma chapa mais fina e devem ser
// cortadas à parte. Cada painel carrega seu "espessura_mm" de origem
// para o marceneiro conferir antes de mandar cortar.
// ============================================================

export const CATEGORIAS_PADRAO = [
  "Armário/Guarda-roupa",
  "Cozinha",
  "Banheiro",
  "Painel",
  "Prateleira",
  "TV/Sala",
  "Cristaleira/Vidro",
];

// ------------------------------------------------------------------
// PORTAS, TRILHOS E CORREDIÇAS
//
// Como você observou: o "corpo" do móvel (laterais, tampo, base, fundo,
// prateleiras) é construído igual não importa o tipo de porta — o que
// muda é só a ferragem:
//   - Porta de GIRO (dobradiça): não altera nenhuma medida do corpo,
//     só muda a QUANTIDADE de dobradiças (conforme altura/qtd de portas).
//   - Porta de CORRER (trilho): não muda o corpo em si, mas o trilho
//     ocupa espaço e reduz a profundidade útil onde ficam as prateleiras
//     (e o desconto de altura da própria porta, caso seja cortada à parte).
//
// Os valores abaixo são um PONTO DE PARTIDA levantado a partir de fichas
// técnicas e fóruns do setor (ex.: comunidade Hellomob) — cada fabricante
// tem sua própria especificação, então trate isso como um banco de dados
// inicial, editável, e não como valor definitivo. Confira sempre com a
// ficha técnica do kit/ferragem que você realmente compra.
// ------------------------------------------------------------------

// Regra geral de mercado (catálogos de fabricantes de dobradiça, ex.
// Blum/Hettich) para quantidade de dobradiças por altura de porta.
// Portas muito largas (>60cm) ou pesadas podem precisar de +1 dobradiça —
// ajuste manualmente na lista de ferragens se for o caso.
export function calcularDobradicasPorAltura(alturaPortaM) {
  const mm = (alturaPortaM || 0) * 1000;
  if (mm <= 900) return 2;
  if (mm <= 1600) return 3;
  if (mm <= 2000) return 4;
  if (mm <= 2500) return 5;
  return 6;
}

// Sistemas de trilho de correr — banco inicial (expansível). Fonte dos
// descontos de altura: suporte técnico/comunidade de fabricantes de
// ferragem para porta de correr embutida vs. sobreposta.
export const BANCO_TRILHOS_CORRER = {
  embutido: {
    nome: "Embutido (perfil recuado, encaixado no vão)",
    desconto_altura_porta_mm: 7,
    desconto_profundidade_util_m: 0.05,
  },
  sobreposto: {
    nome: "Sobreposto (perfil aparente sobre o vão, kits tipo RO-47)",
    desconto_altura_porta_mm: 20,
    desconto_profundidade_util_m: 0.08,
  },
};

// Tipos de corrediça de gaveta — desconto de largura a aplicar de cada
// lado do vão interno para calcular a lateral da gaveta.
export const BANCO_CORREDICAS = {
  telescopica: { nome: "Telescópica (saída total)", desconto_largura_mm: 25 },
  oculta: { nome: "Oculta / embutida (undermount)", desconto_largura_mm: 26 },
  roldana: { nome: "Roldana simples (mais econômica)", desconto_largura_mm: 20 },
};

// Config editável por categoria — pode ser ajustada na aba Plano de Corte
// (⚙️ Ajustar Chapa/Serra → Métodos Construtivos) e é persistida no navegador.
// Inspirado nos parâmetros reais de plugins de marcenaria (ex.: hellomob):
// rodapé, cabideiro duplo, malheiro e gavetas mudam o painel físico gerado,
// não só a aparência — por isso entram aqui em vez de ficarem só no papel.
export const DEFAULT_METODOS_CONSTRUTIVOS = {
  "Armário/Guarda-roupa": {
    estrategia: "corpo",
    espessura_mm: 15,
    tem_fundo: true,
    fundo_espessura_mm: 6,
    fundo_tipo: "rasgado", // rasgado | encaixado — só informativo, não muda a medida
    prateleiras_qtd: 2,
    profundidade_padrao_m: 0.56,
    tem_rodape: true,
    rodape_mm: 100,
    gaveta_qtd_padrao: 3,
    gaveta_altura_padrao_m: 0.15,
    gaveta_espessura_mm: 15,
    tipo_porta: "giro", // giro | correr | nenhuma — o corpo é igual, só muda a ferragem
    largura_max_porta_m: 0.5,
    trilho_sistema: "embutido",
    corredica_tipo: "telescopica",
  },
  Cozinha: {
    estrategia: "corpo",
    espessura_mm: 15,
    tem_fundo: true,
    fundo_espessura_mm: 6,
    fundo_tipo: "encaixado",
    prateleiras_qtd: 1,
    profundidade_padrao_m: 0.6,
    tem_rodape: true,
    rodape_mm: 100,
    gaveta_qtd_padrao: 3,
    gaveta_altura_padrao_m: 0.15,
    gaveta_espessura_mm: 15,
    tipo_porta: "giro",
    largura_max_porta_m: 0.45,
    trilho_sistema: "embutido",
    corredica_tipo: "telescopica",
  },
  Banheiro: {
    estrategia: "corpo",
    espessura_mm: 15,
    tem_fundo: true,
    fundo_espessura_mm: 6,
    fundo_tipo: "encaixado",
    prateleiras_qtd: 1,
    profundidade_padrao_m: 0.45,
    tem_rodape: true,
    rodape_mm: 100,
    gaveta_qtd_padrao: 2,
    gaveta_altura_padrao_m: 0.15,
    gaveta_espessura_mm: 15,
    tipo_porta: "giro",
    largura_max_porta_m: 0.45,
    trilho_sistema: "embutido",
    corredica_tipo: "telescopica",
  },
  Painel: {
    estrategia: "painel_simples",
    espessura_mm: 18,
  },
  Prateleira: {
    estrategia: "prateleira_linear",
    espessura_mm: 18,
    profundidade_padrao_m: 0.25,
  },
  "TV/Sala": {
    estrategia: "corpo",
    espessura_mm: 15,
    tem_fundo: true,
    fundo_espessura_mm: 6,
    fundo_tipo: "rasgado",
    prateleiras_qtd: 1,
    profundidade_padrao_m: 0.4,
    tem_rodape: false,
    rodape_mm: 0,
    gaveta_qtd_padrao: 2,
    gaveta_altura_padrao_m: 0.15,
    gaveta_espessura_mm: 15,
    tipo_porta: "giro",
    largura_max_porta_m: 0.5,
    trilho_sistema: "embutido",
    corredica_tipo: "telescopica",
  },
  "Cristaleira/Vidro": {
    estrategia: "corpo",
    espessura_mm: 15,
    tem_fundo: true,
    fundo_espessura_mm: 6,
    fundo_tipo: "rasgado",
    prateleiras_qtd: 1,
    profundidade_padrao_m: 0.35,
    tem_rodape: false,
    rodape_mm: 0,
    gaveta_qtd_padrao: 2,
    gaveta_altura_padrao_m: 0.15,
    gaveta_espessura_mm: 15,
    tipo_porta: "giro",
    largura_max_porta_m: 0.4,
    trilho_sistema: "embutido",
    corredica_tipo: "telescopica",
  },
};

// Palavras-chave que indicam material que NÃO é cortado na chapa de MDF
// (vidro, alumínio, metal) — detectado no nome/observação, independente
// da categoria, já que qualquer categoria pode ter um item desses.
const REGEX_MATERIAL_NAO_MADEIRA = /vidro|alum[ií]nio|inox|metal(?!izado)|ferro|espelho|pedra|granito|m[áa]rmore/i;

// Peças "ripado" precisam da largura da ripa e do espaçamento. Agora isso vem
// da configuração da categoria Painel (ou do texto da peça), então dá para
// gerar as ripas — antes o item inteiro virava alerta manual e saía do corte.
const REGEX_RIPADO = /ripad|friso/i;

// Só exclui o item quando ele É o material não-madeira ("Espelho", "Tampo de
// granito"). Quando o material aparece como COMPLEMENTO ("Cristaleira com
// portas de vidro", "Painel ripado com espelho"), o corpo continua sendo MDF e
// precisa ser cortado — excluir o item inteiro nesses casos apagava do plano de
// corte um móvel inteiro por causa de uma porta de vidro.
export function detectarMaterialNaoMadeira(peca) {
  const nome = (peca?.nome || "").trim();
  const texto = `${nome} ${peca?.observacao || ""}`;
  if (!REGEX_MATERIAL_NAO_MADEIRA.test(texto)) return false;
  // "com vidro", "de espelho", "e vidro" = complemento -> mantém o item.
  if (/\b(com|de|e|em)\s+(portas?\s+(de|em)\s+)?(vidro|espelho|alum[ií]nio|inox|metal|ferro|pedra|granito|m[áa]rmore)/i.test(texto)) return false;
  // O material é a primeira palavra do nome -> o item É a peça não-madeira.
  return REGEX_MATERIAL_NAO_MADEIRA.test(nome.split(/\s+/)[0] || "");
}

// Quando o item tem uma parte não-madeira mas o corpo é MDF, vale avisar que
// aquela parte fica fora do plano de corte e precisa ser pedida ao fornecedor.
export function detectarComplementoNaoMadeira(peca) {
  const texto = `${peca?.nome || ""} ${peca?.observacao || ""}`;
  const m = texto.match(/(vidro|espelho|alum[ií]nio|inox|metal|ferro|pedra|granito|m[áa]rmore)/i);
  return m ? m[1].toLowerCase() : null;
}

// Fallback para peças sem o campo "categoria" preenchido pela IA. Vale a pena
// ser generoso aqui: cada item que cai fora da inferência vira alerta manual e
// sai do plano de corte inteiro — foi essa lista curta demais que fez ~1/3 dos
// itens de um orçamento real não gerarem nenhuma peça.
export function inferirCategoriaPorNome(nome) {
  const n = (nome || "").toLowerCase();
  if (/guarda-?roupa|arm[áa]rio|closet|roupeiro|sapateira/.test(n)) return "Armário/Guarda-roupa";
  if (/cozinha|gabinete de pia|torre quente|torre para forno|despenseiro|paneleiro/.test(n)) return "Cozinha";
  if (/banheiro|lavabo|gabinete de banheiro/.test(n)) return "Banheiro";
  if (/cristaleira/.test(n)) return "Cristaleira/Vidro";
  if (/painel|frisos?\b/.test(n)) return "Painel";
  if (/prateleira|nicho\b/.test(n)) return "Prateleira";
  if (/\btv\b|rack|buffet|aparador|cabeceira|home\b|criado|c[oô]moda|penteadeira|bancada|balc[aã]o|escrivaninha|mesa|gaveteiro|m[óo]dulo de gaveta|m[óo]vel|movel|arm[áa]rio/.test(n))
    return "TV/Sala";
  return "";
}

// Preenche os campos novos que podem faltar — tanto nas categorias padrão
// quanto na configuração que o marceneiro já tem salva no navegador (que foi
// gravada antes destes campos existirem). Sem isso, quem já usou o sistema
// continuaria com o comportamento antigo mesmo depois da atualização.
export function aplicarPadroesCategoria(cfg) {
  if (!cfg) return cfg;
  const c = { ...cfg };
  if (c.estrategia === "corpo") {
    // Largura máxima de um módulo. É ISTO que faz um armário de 3,63 m virar
    // 4 módulos com 5 laterais em vez de uma caixa única de 3,63 m — que não
    // existe na prática e era a maior causa da contagem de peças baixa.
    if (c.modulo_largura_max_m == null) c.modulo_largura_max_m = 0.9;
    // Portas SÃO peças de corte. Elas não entram no preço (o m² do corpo já
    // cobre a fachada), mas precisam ser cortadas na chapa.
    if (c.gerar_portas == null) c.gerar_portas = true;
    if (c.porta_espessura_mm == null) c.porta_espessura_mm = c.espessura_mm || 15;
    // Usada quando o item é cobrado por metro linear e não tem altura no projeto.
    if (c.altura_padrao_m == null) c.altura_padrao_m = 0.85;
    // Prateleiras extras conforme a altura: um módulo de 2,70 m não tem a
    // mesma quantidade de prateleiras que um de 0,70 m.
    if (c.prateleira_passo_m == null) c.prateleira_passo_m = 0.45;
  }
  if (c.estrategia === "painel_simples") {
    if (c.ripa_largura_m == null) c.ripa_largura_m = 0.05;
    if (c.ripa_espacamento_m == null) c.ripa_espacamento_m = 0.02;
  }
  return c;
}

// A IA descreve cada peça em texto livre ("Guarda-roupa com cabideiro duplo e
// maleiro", "Móvel com 4 gavetas", "Armário com vão inferior"...). Em vez de
// aplicar o MESMO template pra toda a categoria, procuramos essas pistas no
// nome/observação e ajustamos a decomposição peça a peça — mais fiel ao que
// realmente será construído, sem exigir que o marceneiro escolha um tipo toda
// vez. Continua sendo uma sugestão: se o texto não mencionar nada, cai no
// padrão configurado da categoria.
export function detectarAjustesConstrutivos(peca) {
  const texto = `${peca?.nome || ""} ${peca?.observacao || ""}`.toLowerCase();

  const cabideiroDuplo = /cabideiro\s*duplo|dois\s*cabideiros|2\s*cabideiros/.test(texto);
  const maleiro = /maleiro/.test(texto);
  const vaoInferior = /v[ãa]o\s*inferior|vão\s*aberto|sem\s*base|aberto\s*embaixo/.test(texto);

  let gavetaQtd = 0;
  if (/gavetas?|gaveteiro/.test(texto)) {
    const m = texto.match(/(\d+)\s*gavetas?/);
    gavetaQtd = m ? parseInt(m[1], 10) : null; // null = menção sem número -> usa padrão da categoria
  }

  // Tipo de porta e quantidade — o corpo do móvel é o mesmo independente do
  // tipo de porta, mas o texto pode indicar explicitamente "porta de correr"
  // ("deslizante") ou "porta de giro" ("de abrir"), sobrepondo o padrão
  // configurado para a categoria. Também tenta capturar "3 portas".
  let tipoPortaTexto = null;
  if (/porta(s)?\s*de\s*correr|correr|deslizante/.test(texto)) tipoPortaTexto = "correr";
  else if (/porta(s)?\s*de\s*giro|porta(s)?\s*de\s*abrir|dobradi[cç]a/.test(texto)) tipoPortaTexto = "giro";

  let portasQtd = null;
  const mp = texto.match(/(\d+)\s*portas?/);
  if (mp) portasQtd = parseInt(mp[1], 10);

  return { cabideiroDuplo, maleiro, vaoInferior, gavetaQtd, tipoPortaTexto, portasQtd };
}

// Um painel de parede de 2,87 × 2,80 m não existe em chapa nenhuma — na
// prática ele é emendado a partir de várias placas. Antes essas peças eram
// simplesmente descartadas do plano ("maior que a chapa"), levando junto os
// painéis mais caros do orçamento. Aqui a placa é dividida na menor
// quantidade de partes que cabem na chapa.
export function dividirEmChapa(largura_m, altura_m, chapa) {
  const uL = (chapa?.util_largura_m || 2.73);
  const uA = (chapa?.util_altura_m || 1.81);
  const cabe = (a, b) => (a <= uL + 1e-9 && b <= uA + 1e-9) || (a <= uA + 1e-9 && b <= uL + 1e-9);
  if (cabe(largura_m, altura_m)) return null;
  let melhor = null;
  for (let nc = 1; nc <= 12; nc++) {
    for (let nr = 1; nr <= 12; nr++) {
      const w = largura_m / nc;
      const h = altura_m / nr;
      if (!cabe(w, h)) continue;
      const partes = nc * nr;
      // Entre opções com o mesmo número de partes, prefere a menos alongada
      // (menos emenda aparente e sobra melhor distribuída).
      const proporcao = Math.max(w, h) / Math.min(w, h);
      if (!melhor || partes < melhor.partes || (partes === melhor.partes && proporcao < melhor.proporcao)) {
        melhor = { nc, nr, partes, proporcao, largura_m: w, altura_m: h };
      }
    }
  }
  return melhor;
}

function painel(nome, largura_m, altura_m, quantidade, espessura_mm, profundidadeAssumida) {
  return {
    nome,
    largura_m: Math.max(0, largura_m),
    altura_m: Math.max(0, altura_m),
    quantidade: Math.max(0, quantidade),
    espessura_mm,
    profundidade_assumida: !!profundidadeAssumida,
  };
}

// Decompõe UMA peça do orçamento em painéis físicos (ou sinaliza manual/excluído).
export function decomporPeca(peca, metodosConfig) {
  const config = metodosConfig || DEFAULT_METODOS_CONSTRUTIVOS;

  if (detectarMaterialNaoMadeira(peca)) {
    return {
      status: "excluido",
      motivo: "Vidro/alumínio/metal detectado no nome ou observação — não entra no plano de corte de MDF. Encomende separadamente com o fornecedor específico.",
    };
  }

  if (peca.tipo === "%") {
    return { status: "excluido", motivo: "Item percentual (acréscimo, ex.: canto arredondado) — não é uma peça física de corte." };
  }

  const categoria = peca.categoria || inferirCategoriaPorNome(peca.nome);
  const cfg = aplicarPadroesCategoria(config[categoria]);
  if (!cfg) {
    return {
      status: "manual",
      motivo: categoria
        ? `Categoria "${categoria}" ainda não tem método construtivo configurado.`
        : "Peça sem categoria reconhecida — não foi possível determinar o método construtivo.",
    };
  }

  const larguraM = parseFloat(peca.largura) || 0;
  const alturaM = parseFloat(peca.altura) || 0;
  const qtd = Math.max(1, parseInt(peca.quantidade, 10) || 1);

  // --- Estratégia: painel simples (painel de parede liso etc.) ---
  if (cfg.estrategia === "painel_simples") {
    if (peca.tipo !== "m²" || larguraM <= 0 || alturaM <= 0) {
      return { status: "manual", motivo: "Painel sem largura/altura completas para gerar o retângulo de corte." };
    }
    // Painel ripado/frisado: as ripas são cortadas uma a uma. A largura da ripa
    // e o espaçamento vêm da configuração da categoria Painel — como você disse,
    // "é só ler a medida que estipular em cada projeto".
    if (REGEX_RIPADO.test(`${peca.nome} ${peca.observacao || ""}`)) {
      const ripaW = parseFloat(cfg.ripa_largura_m) || 0;
      const gap = parseFloat(cfg.ripa_espacamento_m);
      if (!(ripaW > 0) || !(gap >= 0)) {
        return { status: "manual", motivo: "Painel ripado sem largura de ripa/espaçamento configurados na categoria Painel." };
      }
      const passo = ripaW + gap;
      const nRipas = Math.max(1, Math.floor((larguraM + gap) / passo));
      return {
        status: "ok",
        paineis: [
          painel(`${peca.nome} — Base do painel ripado`, larguraM, alturaM, qtd, cfg.espessura_mm, false),
          painel(`${peca.nome} — Ripa`, ripaW, alturaM, nRipas * qtd, cfg.espessura_mm, false),
        ],
        aviso: `Painel ripado: ${nRipas} ripas de ${(ripaW * 100).toFixed(1)}cm com ${(gap * 100).toFixed(1)}cm de espaçamento, conforme configurado na categoria Painel. Ajuste lá se o projeto usar outra medida.`,
      };
    }
    return {
      status: "ok",
      paineis: [painel(peca.nome, larguraM, alturaM, qtd, cfg.espessura_mm, false)],
    };
  }

  // --- Estratégia: peça linear simples (prateleira externa por ml) ---
  if (cfg.estrategia === "prateleira_linear") {
    // Se o marceneiro já preencheu largura/altura manualmente, trata como painel direto.
    if (larguraM > 0 && alturaM > 0) {
      return { status: "ok", paineis: [painel(peca.nome, larguraM, alturaM, qtd, cfg.espessura_mm, false)] };
    }
    if (peca.tipo !== "ml" || qtd <= 0) {
      return { status: "manual", motivo: "Prateleira sem comprimento definido (nem largura/altura, nem metros lineares)." };
    }
    const profM = parseFloat(peca.profundidade) || cfg.profundidade_padrao_m;
    const profAssumida = !(parseFloat(peca.profundidade) > 0);
    // Aqui "qtd" representa os metros lineares cobrados (comprimento da prateleira).
    return {
      status: "ok",
      paineis: [painel(peca.nome, profM, qtd, 1, cfg.espessura_mm, profAssumida)],
    };
  }

  // --- Estratégia: corpo de módulo com profundidade (armário, cozinha, banheiro, cristaleira, tv/sala) ---
  if (cfg.estrategia === "corpo") {
    // Item cobrado por metro linear (gabinete de pia, móvel de apoio...):
    // a quantidade é o comprimento em metros e a altura vem do padrão da
    // categoria. Antes esses itens viravam alerta manual e saíam do corte
    // inteiro — num orçamento real isso sozinho derrubava vários módulos.
    let largEfetiva = larguraM;
    let altEfetiva = alturaM;
    let qtdModulos = qtd;
    let dimsAssumidas = false;
    if (peca.tipo === "ml" && larguraM <= 0) {
      const compr = parseFloat(peca.quantidade) || 0;
      if (compr > 0) {
        largEfetiva = compr;
        altEfetiva = alturaM > 0 ? alturaM : parseFloat(cfg.altura_padrao_m) || 0.85;
        qtdModulos = 1;
        dimsAssumidas = true;
      }
    }

    const temDimsCompletas = largEfetiva > 0 && altEfetiva > 0;
    const podeDecompor = temDimsCompletas && (peca.tipo === "m²" || peca.tipo === "unidade" || dimsAssumidas);
    if (!podeDecompor) {
      return {
        status: "manual",
        motivo:
          peca.tipo === "ml"
            ? "Item por metro linear sem comprimento informado — preencha a quantidade (metros) ou a largura/altura para decompor."
            : "Faltam largura e/ou altura completas para decompor este item em painéis.",
      };
    }

    const profM = parseFloat(peca.profundidade) || cfg.profundidade_padrao_m;
    const profAssumida = !(parseFloat(peca.profundidade) > 0);
    const ajustes = detectarAjustesConstrutivos(peca);

    // Rodapé: a lateral não precisa descer até o chão quando o módulo assenta
    // sobre uma base/pé — reduz a altura real da peça de lateral.
    const alturaLateral = cfg.tem_rodape ? Math.max(0.05, altEfetiva - (cfg.rodape_mm || 0) / 1000) : altEfetiva;

    // Tipo de porta: o CORPO (laterais/tampo/base/fundo) é o mesmo seja a
    // porta de giro ou de correr — o que muda é só a ferragem (dobradiças x
    // trilho) e, no caso do correr, a profundidade ÚTIL onde entram as
    // prateleiras/gavetas, porque o trilho e o percurso da porta tomam um
    // pouco de espaço internamente.
    const tipoPorta = ajustes.tipoPortaTexto || cfg.tipo_porta || "giro";
    const trilhoInfo = tipoPorta === "correr" ? BANCO_TRILHOS_CORRER[cfg.trilho_sistema] || BANCO_TRILHOS_CORRER.embutido : null;
    const profInterna = trilhoInfo ? Math.max(0.1, profM - (trilhoInfo.desconto_profundidade_util_m || 0)) : profM;

    // ---------------- MODULAÇÃO ----------------
    // Um armário de 3,63 m NÃO é uma caixa única de 3,63 m: são vários módulos
    // lado a lado, com uma lateral entre cada um. Antes o motor gerava sempre
    // 2 laterais, 1 tampo, 1 base e 1 fundo, independente da largura — por isso
    // a contagem de peças ficava perto de 10% da real.
    const moduloMax = parseFloat(cfg.modulo_largura_max_m) || 0.9;
    const nModulos = Math.max(1, Math.ceil(largEfetiva / moduloMax));
    const modW = largEfetiva / nModulos;
    // n módulos lado a lado compartilham laterais: n+1 verticais no total.
    const nLaterais = nModulos + 1;

    const paineis = [
      painel(`${peca.nome} — Lateral / divisória${cfg.tem_rodape ? " (descontado rodapé)" : ""}`, profM, alturaLateral, nLaterais * qtdModulos, cfg.espessura_mm, profAssumida),
      painel(`${peca.nome} — Tampo do módulo`, modW, profM, nModulos * qtdModulos, cfg.espessura_mm, profAssumida),
    ];

    // Vão inferior detectado no texto ("com vão inferior") = móvel aberto por
    // baixo, sem painel de base — senão, gera a base de cada módulo.
    if (!ajustes.vaoInferior) {
      paineis.push(painel(`${peca.nome} — Base do módulo`, modW, profM, nModulos * qtdModulos, cfg.espessura_mm, profAssumida));
    }

    if (cfg.tem_fundo) {
      paineis.push(painel(`${peca.nome} — Fundo (${cfg.fundo_tipo || "padrão"})`, modW, altEfetiva, nModulos * qtdModulos, cfg.fundo_espessura_mm, false));
    }

    // Prateleiras POR MÓDULO, e a quantidade acompanha a altura: um módulo de
    // 2,70 m não leva a mesma quantidade de prateleiras que um de 0,70 m.
    // A base é o passo configurado (espaço entre prateleiras).
    const prateleirasExtra = (ajustes.cabideiroDuplo ? 1 : 0) + (ajustes.maleiro ? 1 : 0);
    const passo = parseFloat(cfg.prateleira_passo_m) || 0;
    const porAltura = passo > 0 ? Math.max(0, Math.floor(altEfetiva / passo) - 1) : 0;
    let prateleirasPorModulo = Math.max(cfg.prateleiras_qtd || 0, porAltura) + prateleirasExtra;

    // Gaveta e prateleira ocupam o MESMO espaço vertical: onde entra gaveteiro
    // não entra prateleira. Sem esse desconto o módulo sairia com prateleiras
    // e gavetas somadas, o que não cabe fisicamente.
    const alturaGavetaCfg = cfg.gaveta_altura_padrao_m || 0.15;
    let gavetasPorModulo = 0;
    if (ajustes.gavetaQtd !== 0 && (ajustes.gavetaQtd > 0 || ajustes.gavetaQtd === null)) {
      gavetasPorModulo = ajustes.gavetaQtd > 0
        ? Math.ceil(ajustes.gavetaQtd / nModulos)
        : (cfg.gaveta_qtd_padrao || 0);
      if (passo > 0 && gavetasPorModulo > 0) {
        // +1e-9: 3 × 0,15 dá 0,44999... em ponto flutuante e o floor comia o
        // desconto inteiro, deixando prateleira e gaveta no mesmo espaço.
        prateleirasPorModulo = Math.max(0, prateleirasPorModulo - Math.floor((gavetasPorModulo * alturaGavetaCfg) / passo + 1e-9));
      }
    }

    if (prateleirasPorModulo > 0) {
      paineis.push(painel(`${peca.nome} — Prateleira interna`, modW, profInterna, prateleirasPorModulo * nModulos * qtdModulos, cfg.espessura_mm, profAssumida || !!trilhoInfo));
    }

    // PORTAS: são peças de corte reais. Não entram no preço (o m² do corpo já
    // cobre a fachada), mas precisam ser cortadas na chapa — deixá-las de fora
    // foi um erro de modelagem: confundiu regra de PREÇO com lista de CORTE.
    // A porta cobre a CAIXA, não o rodapé, por isso usa a altura da lateral.
    if (cfg.gerar_portas && tipoPorta !== "nenhuma") {
      const folga = 0.003;
      if (tipoPorta === "correr") {
        const nPortas = Math.max(2, ajustes.portasQtd || Math.max(2, Math.round(largEfetiva / 1.0)));
        const sobreposicao = 0.02;
        const portaW = (largEfetiva + sobreposicao * (nPortas - 1)) / nPortas;
        const portaH = alturaLateral - (trilhoInfo?.desconto_altura_porta_mm || 20) / 1000;
        paineis.push(painel(`${peca.nome} — Porta de correr`, portaW, portaH, nPortas * qtdModulos, cfg.porta_espessura_mm || cfg.espessura_mm, false));
      } else {
        const larguraMaxPorta = parseFloat(cfg.largura_max_porta_m) || 0.5;
        const portasPorModulo = Math.max(1, Math.ceil(modW / larguraMaxPorta));
        const portaW = modW / portasPorModulo - folga;
        // Onde há gaveteiro, a frente da gaveta ocupa o lugar da porta.
        const alturaPorta = alturaLateral - folga - gavetasPorModulo * alturaGavetaCfg;
        if (alturaPorta > 0.05) {
          paineis.push(painel(`${peca.nome} — Porta de giro`, portaW, alturaPorta, portasPorModulo * nModulos * qtdModulos, cfg.porta_espessura_mm || cfg.espessura_mm, false));
        }
        if (gavetasPorModulo > 0) {
          paineis.push(painel(`${peca.nome} — Frente externa da gaveta`, modW - folga, alturaGavetaCfg - folga, gavetasPorModulo * nModulos * qtdModulos, cfg.porta_espessura_mm || cfg.espessura_mm, false));
        }
      }
    }

    // Gavetas: detectadas no texto (com ou sem quantidade explícita). Cada
    // gaveta vira uma caixa (2 laterais + frente interna + contrafrente +
    // fundo). A lateral desconta a folga da corrediça configurada para a
    // categoria (telescópica/oculta/roldana têm folgas diferentes).
    // A FRENTE EXTERNA da gaveta é peça de corte como qualquer porta.
    let nGavetas = 0;
    const corredicaInfo = BANCO_CORREDICAS[cfg.corredica_tipo] || BANCO_CORREDICAS.telescopica;
    if (ajustes.gavetaQtd !== 0 && (ajustes.gavetaQtd > 0 || ajustes.gavetaQtd === null)) {
      // Quantidade explícita no texto é o total do item; sem número, aplica o
      // padrão da categoria em CADA módulo.
      nGavetas = ajustes.gavetaQtd > 0
        ? ajustes.gavetaQtd * qtdModulos
        : (cfg.gaveta_qtd_padrao || 0) * nModulos * qtdModulos;
      const alturaGaveta = cfg.gaveta_altura_padrao_m || 0.15;
      const descontoCorredicaM = (corredicaInfo.desconto_largura_mm || 25) / 1000;
      const profGaveta = Math.max(0.1, profInterna - descontoCorredicaM);
      const largGaveta = Math.max(0.1, modW - descontoCorredicaM - 2 * (cfg.espessura_mm || 15) / 1000);
      if (nGavetas > 0) {
        paineis.push(painel(`${peca.nome} — Lateral da gaveta`, profGaveta, alturaGaveta, 2 * nGavetas, cfg.gaveta_espessura_mm || cfg.espessura_mm, profAssumida || !!trilhoInfo));
        paineis.push(painel(`${peca.nome} — Frente interna da gaveta`, largGaveta, alturaGaveta, nGavetas, cfg.gaveta_espessura_mm || cfg.espessura_mm, profAssumida));
        paineis.push(painel(`${peca.nome} — Contrafrente da gaveta`, largGaveta, alturaGaveta, nGavetas, cfg.gaveta_espessura_mm || cfg.espessura_mm, profAssumida));
        paineis.push(painel(`${peca.nome} — Fundo da gaveta`, largGaveta, profGaveta, nGavetas, cfg.fundo_espessura_mm, profAssumida || !!trilhoInfo));
      }
    }

    // Ferragens: não são painéis de corte, mas é exatamente a lista que o
    // marceneiro precisa pra fazer o pedido de ferragem — dobradiças (porta
    // de giro), trilho (porta de correr) e corrediças (gavetas).
    const ferragens = {};
    if (tipoPorta === "giro") {
      const larguraMaxPorta = parseFloat(cfg.largura_max_porta_m) || 0.5;
      const nPortas = ajustes.portasQtd || Math.max(1, Math.ceil(modW / larguraMaxPorta)) * nModulos;
      const dobradicasPorPorta = calcularDobradicasPorAltura(alturaLateral);
      ferragens.portas = {
        tipo: "giro",
        qtd: nPortas * qtdModulos,
        dobradicas_por_porta: dobradicasPorPorta,
        dobradicas_total: nPortas * dobradicasPorPorta * qtdModulos,
      };
    } else if (tipoPorta === "correr") {
      ferragens.trilho = {
        tipo: "correr",
        sistema: cfg.trilho_sistema || "embutido",
        nome: trilhoInfo.nome,
        desconto_altura_porta_mm: trilhoInfo.desconto_altura_porta_mm,
        desconto_profundidade_util_m: trilhoInfo.desconto_profundidade_util_m,
        qtd_kits: qtdModulos,
      };
    }
    if (nGavetas > 0) {
      ferragens.gavetas = {
        qtd: nGavetas,
        corredica_tipo: cfg.corredica_tipo || "telescopica",
        nome: corredicaInfo.nome,
        pares_corredica: nGavetas,
      };
    }

    let aviso = `Decomposto em ${nModulos} módulo(s) de ${(modW * 100).toFixed(0)}cm (máx. ${(moduloMax * 100).toFixed(0)}cm por módulo, ajustável na categoria). ${nLaterais} laterais/divisórias no total.`;
    if (dimsAssumidas) {
      aviso += ` Item por metro linear: usou ${largEfetiva.toFixed(2)}m de comprimento e altura padrão de ${altEfetiva.toFixed(2)}m da categoria — confira.`;
    }
    if (cfg.gerar_portas && tipoPorta !== "nenhuma") {
      aviso += " As portas entram na lista de corte (não afetam o preço, que continua pelo m² do corpo).";
    }
    if (tipoPorta === "correr") {
      aviso += ` Porta de correr (${trilhoInfo.nome}): altura já descontada em ${trilhoInfo.desconto_altura_porta_mm}mm e profundidade interna reduzida em ${Math.round((trilhoInfo.desconto_profundidade_util_m || 0) * 1000)}mm — confira com a ficha técnica do kit real.`;
    }

    return {
      status: "ok",
      paineis,
      aviso,
      modulacao: { modulos: nModulos, largura_modulo_m: Math.round(modW * 1000) / 1000, laterais: nLaterais },
      ferragens: Object.keys(ferragens).length ? ferragens : undefined,
    };
  }

  return { status: "manual", motivo: "Método construtivo não reconhecido para esta categoria." };
}

// Roda a decomposição em todas as peças do orçamento e separa em 3 grupos.
export function explodirPecasConstrutivas(pieces, metodosConfig, chapa) {
  const paraCorte = [];
  const manuais = [];
  const excluidos = [];
  const avisos = [];
  const ferragens = [];
  const emendas = [];

  for (const p of pieces || []) {
    const r = decomporPeca(p, metodosConfig);
    if (r.status === "ok") {
      r.paineis.forEach((pn, idx) => {
        if (pn.largura_m <= 0 || pn.altura_m <= 0 || pn.quantidade <= 0) return;
        const id = `auto_${p._id ?? p.id ?? "x"}_${idx}`;
        const base = {
          id,
          _id: id,
          _origemPecaId: p._id ?? p.id,
          tipo: "m²",
          espessura_mm: pn.espessura_mm,
          profundidade_assumida: pn.profundidade_assumida,
          unidade: "m",
        };
        // Peça maior que a chapa: divide em partes emendadas em vez de sumir
        // do plano de corte — era isso que apagava os painéis de parede
        // grandes, justamente os itens mais caros do orçamento.
        const div = dividirEmChapa(pn.largura_m, pn.altura_m, chapa);
        if (div) {
          emendas.push({
            pecaId: p._id ?? p.id,
            nome: pn.nome,
            original_largura_m: pn.largura_m,
            original_altura_m: pn.altura_m,
            partes: div.partes,
            parte_largura_m: Math.round(div.largura_m * 1000) / 1000,
            parte_altura_m: Math.round(div.altura_m * 1000) / 1000,
          });
          paraCorte.push({
            ...base,
            nome: `${pn.nome} — parte emendada (${div.nc}×${div.nr})`,
            largura: div.largura_m,
            altura: div.altura_m,
            quantidade: pn.quantidade * div.partes,
          });
          return;
        }
        paraCorte.push({
          ...base,
          nome: pn.nome,
          largura: pn.largura_m,
          altura: pn.altura_m,
          quantidade: pn.quantidade,
        });
      });
      const complemento = detectarComplementoNaoMadeira(p);
      const avisoFinal = complemento
        ? `${r.aviso || ""} Atenção: este item tem parte em ${complemento} — essa parte NÃO entra no plano de corte de MDF, peça ao fornecedor específico.`.trim()
        : r.aviso;
      if (avisoFinal) avisos.push({ pecaId: p._id ?? p.id, nome: p.nome, aviso: avisoFinal });
      if (r.ferragens) ferragens.push({ pecaId: p._id ?? p.id, nome: p.nome, ...r.ferragens });
    } else if (r.status === "manual") {
      manuais.push({ pecaId: p._id ?? p.id, nome: p.nome, categoria: p.categoria, motivo: r.motivo });
    } else if (r.status === "excluido") {
      excluidos.push({ pecaId: p._id ?? p.id, nome: p.nome, motivo: r.motivo });
    }
  }

  return { paraCorte, manuais, excluidos, avisos, ferragens, emendas };
}
