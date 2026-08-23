export const STATUS = Object.freeze({
  CONFIRMADO: 'CONFIRMADO',
  PADRAO_APLICADO: 'PADRAO_APLICADO',
  REVISAO_MANUAL: 'REVISAO_MANUAL',
  INFORMACAO_AUSENTE: 'INFORMACAO_AUSENTE',
  ERRO_PRODUCAO: 'ERRO_PRODUCAO',
});

export const SOURCE = Object.freeze({
  PROJETO: 'PROJETO',
  PADRAO_CONSTRUTIVO: 'PADRAO_CONSTRUTIVO',
  USUARIO: 'USUARIO',
});

export const DEFAULTS = Object.freeze({
  portaFolgaMm: 3,
  portaAvancoFrontalMm: 18,
  fundoParafusadoMm: 6,
  reguaParedeLarguraMm: 50,
  travessaSuperiorLarguraMm: 50,
  rodaTetoAereoMm: 50,
  reguaEngrossoGeladeiraMm: 100,
  superiorGeladeiraProfundidadeMm: 450,
  torreQuenteLarguraInternaMm: 700,
  guardaRoupaBaseMm: 100,
  guardaRoupaAcabamentoSuperiorMm: 70,
  guardaRoupaCorrerMontanteDescontoMm: 80,
  guardaRoupaCorrerPortaDescontoCarrinhoMm: 35,
  guardaRoupaCorrerSobreposicaoMm: 20,
  gaveteiroGuardaRoupaSarrafoLateralMm: 50,
  gaveteiroGuardaRoupaGiroRecuoFrontalMm: 60,
  painelReguaFixacaoEspessuraMm: 15,
  painelReguaFixacaoEspacamentoMaxMm: 600,
  gavetaFundoMm: 6,
  gavetaRasgoOffsetInferiorMm: 12,
  gavetaRasgoProfundidadeMm: 8,
});
