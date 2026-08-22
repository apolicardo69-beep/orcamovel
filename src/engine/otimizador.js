// ============================================================
// ORCAMOVEL + CORTESMART — Motor de Otimização de Corte 2D
// Algoritmo: First Fit Decreasing (FFD) + Guillotine Cut
// Compatível com seccionadoras e esquadrejadeiras (cortes de ponta a ponta)
// ============================================================

export const CONFIG_PADRAO_CORTE = {
  chapa_largura_mm: 2750, // Padrão MDF Brasil
  chapa_altura_mm: 1830,
  kerf_mm: 3,             // Espessura da serra (corte)
  margem_borda_mm: 10,    // Refilo nas 4 bordas da chapa
  permitir_rotacao: true, // Permitir girar peças para melhor encaixe
  respeitar_veio: false,  // Se true, respeita veio da madeira
  preco_chapa: 0,         // Custo unitário da chapa MDF
};

export const CORES_PECAS = [
  "#c8892a", "#e87a40", "#5b9bd5", "#9a7ab8",
  "#7ab87a", "#c87aa0", "#60c8c8", "#d4a030",
  "#e05555", "#4caf7d", "#4a90d9", "#9b59b6",
];

/**
 * Converte as peças do OrcaMóvel (que usam largura/altura em metros ou cm)
 * para o formato esperado pelo motor de corte (em milímetros).
 */
export function normalizarPecasParaCorte(pecasOrca) {
  return pecasOrca
    .filter((p) => {
      const l = parseFloat(p.largura) || 0;
      const a = parseFloat(p.altura) || 0;
      const qtd = parseInt(p.quantidade, 10) || 1;
      return (l > 0 || a > 0) && qtd > 0;
    })
    .map((p, idx) => {
      let larg = parseFloat(p.largura) || 0;
      let alt = parseFloat(p.altura) || 0;

      // Se veio em metros (ex: 2.20 ou 0.60), converte para mm (* 1000)
      if (larg > 0 && larg < 10) larg = Math.round(larg * 1000);
      if (alt > 0 && alt < 10) alt = Math.round(alt * 1000);

      // Se ainda estiver pequeno (ex: 60 cm), converte para mm (* 10)
      if (larg >= 10 && larg <= 100) larg = Math.round(larg * 10);
      if (alt >= 10 && alt <= 100) alt = Math.round(alt * 10);

      // Caso uma dimensão seja 0 (ex: peça linear), define uma largura útil padrão de 150mm
      if (larg === 0 && alt > 0) larg = 150;
      if (alt === 0 && larg > 0) alt = 150;

      const cor = CORES_PECAS[idx % CORES_PECAS.length];
      const codigo = `P${String(idx + 1).padStart(2, "0")}`;

      return {
        id: p._id || p.id || String(idx + 1),
        codigo,
        nome: p.nome || `Peça ${idx + 1}`,
        largura_mm: larg,
        comprimento_mm: alt,
        quantidade: parseInt(p.quantidade, 10) || 1,
        tipo: p.tipo || "m²",
        rotacao_permitida: true,
        veio: "qualquer",
        cor,
        _origem: p,
      };
    });
}

/**
 * Executa a otimização de corte 2D em chapas
 */
export function otimizarCorte(pecas, config = CONFIG_PADRAO_CORTE) {
  const chapaL = config.chapa_largura_mm || 2750;
  const chapaA = config.chapa_altura_mm || 1830;
  const kerf = config.kerf_mm !== undefined ? config.kerf_mm : 3;
  const margem = config.margem_borda_mm || 0;
  const permitirRotacao = config.permitir_rotacao !== false;
  const respeitarVeio = !!config.respeitar_veio;

  // Área útil da chapa descontando o refilo de borda
  const utilL = Math.max(100, chapaL - margem * 2);
  const utilA = Math.max(100, chapaA - margem * 2);

  // 1. Expandir peças com quantidade > 1
  const instancias = [];
  for (const p of pecas) {
    const qtd = p.quantidade || 1;
    for (let i = 0; i < qtd; i++) {
      instancias.push({ peca: p, instancia: i });
    }
  }

  // 2. Ordenar por área decrescente (First Fit Decreasing)
  instancias.sort((a, b) => {
    const areaA = a.peca.largura_mm * a.peca.comprimento_mm;
    const areaB = b.peca.largura_mm * b.peca.comprimento_mm;
    return areaB - areaA;
  });

  // 3. Bin packing com Guillotine Split
  const chapas = [];

  for (const inst of instancias) {
    const colocado = tentarColocar(
      inst.peca,
      inst.instancia,
      chapas,
      kerf,
      permitirRotacao,
      respeitarVeio,
      utilL,
      utilA,
      margem
    );

    if (!colocado) {
      // Abre nova chapa
      const novaChapa = {
        indice: chapas.length + 1,
        largura: chapaL,
        altura: chapaA,
        margem,
        pecas: [],
        espacosLivres: [{ x: margem, y: margem, largura: utilL, altura: utilA }],
      };
      chapas.push(novaChapa);
      tentarColocar(
        inst.peca,
        inst.instancia,
        [novaChapa],
        kerf,
        permitirRotacao,
        respeitarVeio,
        utilL,
        utilA,
        margem
      );
    }
  }

  // 4. Montar resultado final e métricas de eficiência
  const areaTotalChapaMm2 = chapaL * chapaA;
  let totalAreaUsadaMm2 = 0;

  const chapasOtimizadas = chapas.map((ch) => {
    const areaUsada = ch.pecas.reduce((acc, pp) => {
      const l = pp.rotacionada ? pp.peca.comprimento_mm : pp.peca.largura_mm;
      const c = pp.rotacionada ? pp.peca.largura_mm : pp.peca.comprimento_mm;
      return acc + l * c;
    }, 0);
    totalAreaUsadaMm2 += areaUsada;

    const aprov = Math.min(100, Math.round((areaUsada / areaTotalChapaMm2) * 100));

    return {
      indice: ch.indice,
      largura_mm: ch.largura,
      altura_mm: ch.altura,
      margem_mm: ch.margem,
      pecas: ch.pecas,
      area_total_mm2: areaTotalChapaMm2,
      area_usada_mm2: areaUsada,
      aproveitamento_pct: aprov,
    };
  });

  const totalAreaGeralMm2 = chapas.length * areaTotalChapaMm2;
  const areaDesperdicadaMm2 = Math.max(0, totalAreaGeralMm2 - totalAreaUsadaMm2);
  const aprovMedio =
    chapas.length > 0
      ? Math.round(
          chapasOtimizadas.reduce((a, c) => a + c.aproveitamento_pct, 0) / chapas.length
        )
      : 0;

  return {
    chapas: chapasOtimizadas,
    total_chapas: chapas.length,
    total_pecas_posicionadas: instancias.length,
    aproveitamento_medio_pct: aprovMedio,
    area_usada_m2: Number((totalAreaUsadaMm2 / 1_000_000).toFixed(2)),
    area_desperdicada_m2: Number((areaDesperdicadaMm2 / 1_000_000).toFixed(2)),
    area_total_m2: Number((totalAreaGeralMm2 / 1_000_000).toFixed(2)),
    custo_estimado: config.preco_chapa ? chapas.length * config.preco_chapa : 0,
  };
}

// Tenta encaixar uma peça nas chapas existentes
function tentarColocar(
  peca,
  instancia,
  chapas,
  kerf,
  permitirRotacao,
  respeitarVeio,
  utilL,
  utilA,
  margem
) {
  for (const chapa of chapas) {
    // 1. Tentar orientação original (sem rotação)
    if (encaixarEmEspaco(peca, instancia, chapa, kerf, false)) return true;

    // 2. Tentar rotacionado (se permitido)
    const podeRotacionar =
      permitirRotacao &&
      peca.rotacao_permitida !== false &&
      (!respeitarVeio || peca.veio === "qualquer");

    if (podeRotacionar) {
      if (encaixarEmEspaco(peca, instancia, chapa, kerf, true)) return true;
    }
  }
  return false;
}

// Encaixe por Guilhotina (Guillotine Split)
function encaixarEmEspaco(peca, instancia, chapa, kerf, rotacionada) {
  const pL = rotacionada ? peca.comprimento_mm : peca.largura_mm;
  const pC = rotacionada ? peca.largura_mm : peca.comprimento_mm;
  const pLk = pL + kerf;
  const pCk = pC + kerf;

  for (let i = 0; i < chapa.espacosLivres.length; i++) {
    const esp = chapa.espacosLivres[i];

    // Verifica se cabe no espaço disponível
    if (esp.largura >= pL && esp.altura >= pC) {
      // Posiciona a peça
      chapa.pecas.push({
        peca,
        instancia,
        x: esp.x,
        y: esp.y,
        largura_pos: pL,
        altura_pos: pC,
        rotacionada,
      });

      // Divide o espaço restante em 2 retângulos (Guillotine Split)
      const restoDireita = {
        x: esp.x + pLk,
        y: esp.y,
        largura: Math.max(0, esp.largura - pLk),
        altura: pC,
      };
      const restoCima = {
        x: esp.x,
        y: esp.y + pCk,
        largura: esp.largura,
        altura: Math.max(0, esp.altura - pCk),
      };

      // Remove espaço utilizado
      chapa.espacosLivres.splice(i, 1);

      // Adiciona novos espaços livres
      if (restoDireita.largura > kerf && restoDireita.altura > kerf) {
        chapa.espacosLivres.push(restoDireita);
      }
      if (restoCima.largura > kerf && restoCima.altura > kerf) {
        chapa.espacosLivres.push(restoCima);
      }

      // Ordena espaços livres pelos menores primeiro (melhor aproveitamento)
      chapa.espacosLivres.sort(
        (a, b) => a.largura * a.altura - b.largura * b.altura
      );

      return true;
    }
  }
  return false;
}
