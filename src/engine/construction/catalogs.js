import { DEFAULTS } from './constants.js';

export const BASE_MATERIALS = Object.freeze([
  { id:'MDF_15', tipo:'MDF', nome:'MDF 15 mm', espessura_mm:15, chapa:{comprimento_mm:2750, largura_mm:1830}, veio:false, status:'BASE' },
  { id:'MDF_18', tipo:'MDF', nome:'MDF 18 mm', espessura_mm:18, chapa:{comprimento_mm:2750, largura_mm:1830}, veio:false, status:'BASE' },
  { id:'MDF_6', tipo:'MDF', nome:'MDF 6 mm', espessura_mm:6, chapa:{comprimento_mm:2750, largura_mm:1830}, veio:false, status:'BASE' },
]);

export const HARDWARE_CATALOG = Object.freeze([
  {
    id:'CORREDICA_TELESCOPICA_PADRAO', categoria:'CORREDICA', tipo:'TELESCOPICA_LATERAL',
    nome:'Corrediça telescópica lateral — padrão interno', folga_lateral_mm:12.5,
    folga_total_mm:25, status:'EM_VALIDACAO', permite_override:true,
    observacao:'Confirmar marca/modelo antes de marcar como validado para produção.'
  },
  {
    id:'CORREDICA_INVISIVEL_PADRAO', categoria:'CORREDICA', tipo:'INVISIVEL',
    nome:'Corrediça invisível — padrão interno', folga_total_mm:26,
    status:'EM_VALIDACAO', permite_override:true,
    observacao:'Usar quando o projeto indicar invisível; fabricante/modelo pode exigir ajuste.'
  },
  {
    id:'DOBRADICA_35_GENERICA', categoria:'DOBRADICA', tipo:'CANECO_35',
    nome:'Dobradiça caneco 35 mm', status:'CADASTRO_GENERICO', permite_override:true,
    observacao:'Quantidade e furação devem seguir modelo/fabricante efetivamente utilizado.'
  },
  {
    id:'FERRAGEM_ESPECIAL', categoria:'ESPECIAL', tipo:'MANUAL', nome:'Ferragem especial / não identificada',
    status:'REVISAO_MANUAL', campos_livres:true, bloqueia_producao_ate_confirmacao:true,
  }
]);

export const MACHINING_CATALOG = Object.freeze([
  { id:'RASGO_FUNDO_GAVETA', nome:'Rasgo fundo gaveta', largura_mm:DEFAULTS.gavetaFundoMm, profundidade_mm:DEFAULTS.gavetaRasgoProfundidadeMm, offset_inferior_mm:DEFAULTS.gavetaRasgoOffsetInferiorMm, status:'CONFIRMADO_USUARIO' },
  { id:'SULCO_NEGATIVO_PAINEL', nome:'Sulco negativo em painel', largura_mm:null, profundidade_mm:null, posicao:null, status:'DEFINIDO_PELO_PROJETO' },
]);

export const METHOD_REGISTRY = Object.freeze([
  { id:'GABINETE_BASE_V1', familia:'COZINHA_BANHEIRO_LAVANDERIA', status:'EM_VALIDACAO', descricao:'Gabinete/balcão com caixa sobre base, travessas superiores e acabamentos parametrizados.' },
  { id:'AEREO_COZINHA_V1', familia:'COZINHA_LAVANDERIA', status:'EM_VALIDACAO', descricao:'Aéreo com fundo 6 mm parafusado por trás e prateleira padrão por vão.' },
  { id:'AEREO_BASCULANTE_V1', familia:'COZINHA_LAVANDERIA', status:'EM_VALIDACAO', descricao:'Mesma caixa do aéreo; frente e ferragem basculante específicas.' },
  { id:'CAIXA_GELADEIRA_V1', familia:'COZINHA', status:'EM_VALIDACAO', descricao:'Envoltório de geladeira com superior e engrossamento configuráveis.' },
  { id:'TORRE_QUENTE_V1', familia:'COZINHA', status:'EM_VALIDACAO', descricao:'Torre paramétrica por zonas: superior, micro, forno e inferior.' },
  { id:'GUARDA_ROUPA_GIRO_V1', familia:'DORMITORIO_CLOSET', status:'EM_VALIDACAO', descricao:'Guarda-roupa giro com fundo parafusado, rodapé e acabamento superior.' },
  { id:'GUARDA_ROUPA_CORRER_V1', familia:'DORMITORIO_CLOSET', status:'EM_VALIDACAO', descricao:'Guarda-roupa correr com montantes, carrinhos e sobreposição.' },
  { id:'GAVETA_MDF_FUNDO_RASGADO_V1', familia:'UNIVERSAL', status:'EM_VALIDACAO', descricao:'Gaveta em MDF com laterais, frente interna, contrafrente e fundo 6 mm rasgado.' },
  { id:'CAIXA_CENTRAL_TAMPONADA_V1', familia:'UNIVERSAL', status:'EM_VALIDACAO', descricao:'Criado/rack/aparador com caixa central tamponada e tampo cobrindo emendas.' },
  { id:'PAINEL_LISO_V1', familia:'UNIVERSAL', status:'EM_VALIDACAO', descricao:'Placas exatamente conforme projeto + réguas de fixação.' },
  { id:'PAINEL_RIPADO_V1', familia:'UNIVERSAL', status:'EM_VALIDACAO', descricao:'Ripas conforme projeto + réguas de fixação.' },
  { id:'TAMBORADO_PARAMETRICO_V1', familia:'UNIVERSAL', status:'EM_VALIDACAO', descricao:'Peça composta por face + miolo + face, espessuras parametrizadas.' },
]);
