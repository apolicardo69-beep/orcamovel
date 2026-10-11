import { DEFAULTS, STATUS, SOURCE } from './constants.js';
import { HARDWARE_CATALOG, BASE_MATERIALS, METHOD_REGISTRY } from './catalogs.js';

const n = (v, label) => {
  const x = Number(v);
  if (!Number.isFinite(x) || x < 0) throw new Error(`${label} inválido.`);
  return x;
};
const pos = (v,label) => { const x=n(v,label); if(x<=0) throw new Error(`${label} deve ser maior que zero.`); return x; };

// Liga a peça ao material da chapa pela espessura. Sem isso, groupPiecesForCut
// agrupa tudo como "SEM_MATERIAL" e o plano de corte mistura chapa de 15 com
// chapa de 6 na mesma otimização — que é justamente o erro que se quer evitar.
export function materialForThickness(espessura_mm){
  const alvo = Number(espessura_mm);
  return BASE_MATERIALS.find(m => m.espessura_mm === alvo) || null;
}

const piece = (id,nome,comprimento_mm,largura_mm,espessura_mm,quantidade=1,extra={}) => {
  const esp = Math.round(espessura_mm*100)/100;
  const mat = materialForThickness(esp);
  return {
    id,nome,
    comprimento_mm:Math.round(comprimento_mm*100)/100,
    largura_mm:Math.round(largura_mm*100)/100,
    espessura_mm:esp,
    quantidade,
    material_id: mat ? mat.id : null,
    chapa_comprimento_mm: mat ? mat.chapa.comprimento_mm : null,
    chapa_largura_mm: mat ? mat.chapa.largura_mm : null,
    ...extra
  };
};

export function resolveSideFinish(side={}, bodyThickness=15, height=0, depth=0){
  const type = side.type || 'NONE';
  if(type==='NONE') return {occupancy_mm:0,pieces:[],source:SOURCE.PROJETO};
  if(type==='WALL_STRIP'){
    const t = n(side.thickness_mm ?? bodyThickness,'espessura régua parede');
    const w = n(side.width_mm ?? DEFAULTS.reguaParedeLarguraMm,'largura régua parede');
    return {occupancy_mm:t,pieces:[piece(`WALL_STRIP_${side.position||'SIDE'}`,'Régua de parede',height,w,t,1,{role:'ACABAMENTO'})]};
  }
  if(type==='PANEL_SIMPLE'){
    const t=n(side.thickness_mm ?? bodyThickness,'espessura tamponamento simples');
    return {occupancy_mm:t,pieces:[piece(`SIDE_PANEL_${side.position||'SIDE'}`,'Tamponamento lateral simples',height,depth,t,1,{role:'ACABAMENTO'})]};
  }
  if(type==='PANEL_THICK'){
    const layer=n(side.layer_thickness_mm ?? bodyThickness,'espessura camada tamponamento');
    const layers=Math.max(2,Math.trunc(side.layers ?? 2));
    return {occupancy_mm:layer*layers,pieces:[piece(`SIDE_PANEL_THICK_${side.position||'SIDE'}`,'Camada de tamponamento engrossado',height,depth,layer,layers,{role:'ACABAMENTO',assembly:'COLADO'})]};
  }
  throw new Error(`Tipo de acabamento lateral desconhecido: ${type}`);
}

export function calculateSinkCabinet(input){
  const W=pos(input.width_mm,'largura total');
  const H=pos(input.height_mm,'altura total');
  const stoneD=pos(input.stone_depth_mm,'profundidade da pedra/projeto');
  const T=pos(input.body_thickness_mm ?? 15,'espessura MDF corpo');
  const recessFront=n(input.front_recess_mm ?? 30,'recuo frontal');
  const recessBack=n(input.back_recess_mm ?? 0,'recuo traseiro');
  const boxD=stoneD-recessFront-recessBack;
  if(boxD<=0) throw new Error('Profundidade calculada da caixa inválida.');

  const left=resolveSideFinish({...input.left_finish,position:'LEFT'},T,H,boxD+DEFAULTS.portaAvancoFrontalMm+DEFAULTS.fundoParafusadoMm);
  const right=resolveSideFinish({...input.right_finish,position:'RIGHT'},T,H,boxD+DEFAULTS.portaAvancoFrontalMm+DEFAULTS.fundoParafusadoMm);
  const bottom=input.bottom_finish || {type:'NONE'};
  let bottomOcc=0, bottomPieces=[];
  if(bottom.type==='PANEL_SIMPLE'){ bottomOcc=n(bottom.thickness_mm ?? T,'tamponamento inferior'); bottomPieces=[piece('BOTTOM_PANEL','Tamponamento inferior',W,boxD+DEFAULTS.portaAvancoFrontalMm+DEFAULTS.fundoParafusadoMm,bottomOcc,1,{role:'ACABAMENTO'})]; }
  if(bottom.type==='PANEL_THICK'){
    const layer=n(bottom.layer_thickness_mm ?? T,'camada tamponamento inferior'); const layers=Math.max(2,Math.trunc(bottom.layers??2)); bottomOcc=layer*layers;
    bottomPieces=[piece('BOTTOM_PANEL_THICK','Camada tamponamento inferior engrossado',W,boxD+DEFAULTS.portaAvancoFrontalMm+DEFAULTS.fundoParafusadoMm,layer,layers,{role:'ACABAMENTO',assembly:'COLADO'})];
  }
  const boxW=W-left.occupancy_mm-right.occupancy_mm;
  const railT=T;
  const sideH=H-bottomOcc-T-railT;
  if(boxW<=2*T || sideH<=0) throw new Error('Dimensões resultantes da caixa são incompatíveis com os descontos.');
  const railWidth=n(input.top_rail_width_mm ?? DEFAULTS.travessaSuperiorLarguraMm,'largura travessa');
  const shelfQty=Math.max(0,Math.trunc(input.shelf_qty ?? 1));
  const pieces=[...left.pieces,...right.pieces,...bottomPieces,
    piece('BASE','Base',boxW,boxD,T,1,{role:'ESTRUTURAL'}),
    piece('SIDE_L','Lateral esquerda',sideH,boxD,T,1,{role:'ESTRUTURAL'}),
    piece('SIDE_R','Lateral direita',sideH,boxD,T,1,{role:'ESTRUTURAL'}),
    piece('TOP_RAIL_FRONT','Travessa superior frontal',boxW,railWidth,T,1,{role:'ESTRUTURAL'}),
    piece('TOP_RAIL_BACK','Travessa superior traseira',boxW,railWidth,T,1,{role:'ESTRUTURAL'}),
  ];
  if(shelfQty) pieces.push(piece('SHELF','Prateleira interna',boxW-2*T,boxD,T,shelfQty,{role:'INTERNO'}));
  return {method_id:'GABINETE_BASE_V1',dimensions:{width_total_mm:W,height_total_mm:H,stone_depth_mm:stoneD,box_width_mm:boxW,box_depth_mm:boxD,side_height_mm:sideH},pieces,assumptions:[{field:'shelf_qty',value:shelfQty,source:input.shelf_qty==null?SOURCE.PADRAO_CONSTRUTIVO:SOURCE.PROJETO}],status:STATUS.PADRAO_APLICADO};
}

export function calculateDrawer(input){
  const openingW=pos(input.opening_width_mm,'vão da gaveta');
  const D=pos(input.depth_mm,'profundidade da gaveta');
  const H=pos(input.side_height_mm,'altura da lateral da gaveta');
  const T=pos(input.body_thickness_mm ?? 15,'espessura da gaveta');
  const slideId=input.slide_id || 'CORREDICA_TELESCOPICA_PADRAO';
  const slide=HARDWARE_CATALOG.find(h=>h.id===slideId);
  if(!slide || slide.categoria!=='CORREDICA') throw new Error('Corrediça não cadastrada.');
  const clearance=pos(input.slide_clearance_total_mm ?? slide.folga_total_mm,'folga total da corrediça');
  const outerW=openingW-clearance;
  if(outerW<=2*T) throw new Error('Vão insuficiente para a gaveta e a corrediça selecionada.');
  const innerW=outerW-2*T;
  const innerD=D-2*T;
  const grooveDepth=pos(input.groove_depth_mm ?? DEFAULTS.gavetaRasgoProfundidadeMm,'profundidade rasgo');
  const bottomW=innerW+2*grooveDepth;
  const bottomD=innerD+2*grooveDepth;
  return {method_id:'GAVETA_MDF_FUNDO_RASGADO_V1',hardware:[slide],dimensions:{opening_width_mm:openingW,drawer_outer_width_mm:outerW,drawer_inner_width_mm:innerW,drawer_depth_mm:D},pieces:[
    piece('DRAWER_SIDE','Lateral gaveta',D,H,T,2,{machining:['RASGO_FUNDO_GAVETA']}),
    piece('DRAWER_FRONT_IN','Frente interna gaveta',innerW,H,T,1,{machining:['RASGO_FUNDO_GAVETA']}),
    piece('DRAWER_BACK','Contrafrente gaveta',innerW,H,T,1,{machining:['RASGO_FUNDO_GAVETA']}),
    piece('DRAWER_BOTTOM','Fundo gaveta',bottomD,bottomW,DEFAULTS.gavetaFundoMm,1,{role:'FUNDO'})
  ], machining:{groove_width_mm:DEFAULTS.gavetaFundoMm,groove_depth_mm:grooveDepth,offset_bottom_mm:DEFAULTS.gavetaRasgoOffsetInferiorMm},status:slide.status==='EM_VALIDACAO'?STATUS.REVISAO_MANUAL:STATUS.CONFIRMADO};
}

export function calculateAereo(input){
  const W=pos(input.box_width_mm,'largura da caixa');
  const H=pos(input.box_height_mm,'altura da caixa');
  const D=pos(input.box_depth_mm,'profundidade da caixa');
  const T=pos(input.body_thickness_mm ?? 15,'espessura corpo');
  const B=pos(input.back_thickness_mm ?? DEFAULTS.fundoParafusadoMm,'espessura fundo');
  const bays=Math.max(1,Math.trunc(input.bays ?? 1));
  // Com mais de um vão o aéreo precisa de divisória vertical, e a prateleira
  // passa a ter a largura do VÃO, não a largura inteira do móvel — antes ela
  // saía com a largura toda, o que é impossível de montar num aéreo dividido.
  const dividers=bays-1;
  const bayW=(W-2*T-dividers*T)/bays;
  if(bayW<=0) throw new Error('Número de vãos incompatível com a largura do aéreo.');
  const shelfPerBay=input.shelf_qty==null?1:Math.max(0,Math.trunc(input.shelf_qty));
  const shelfQty=shelfPerBay*bays;
  const trimDepth=D+DEFAULTS.portaAvancoFrontalMm+B;
  const pieces=[piece('AEREO_BACK','Fundo parafusado traseiro',W,H,B,1,{mount:'PARAFUSADO_TRASEIRO'}),piece('AEREO_SIDE','Laterais',H,D,T,2),piece('AEREO_BASE','Base',W-2*T,D,T,1),piece('AEREO_TOP','Superior',W-2*T,D,T,1)];
  if(dividers) pieces.push(piece('AEREO_DIVIDER','Divisória vertical entre vãos',H-2*T,D,T,dividers,{role:'ESTRUTURAL'}));
  if(shelfQty) pieces.push(piece('AEREO_SHELF','Prateleira',bayW,D,T,shelfQty));
  if(input.left_tamponamento) pieces.push(piece('AEREO_TAMP_L','Tamponamento esquerdo',H,trimDepth,input.left_tamponamento.thickness_mm??T,1));
  if(input.right_tamponamento) pieces.push(piece('AEREO_TAMP_R','Tamponamento direito',H,trimDepth,input.right_tamponamento.thickness_mm??T,1));
  if(input.top_closure!==false) pieces.push(piece('AEREO_RODATETO','Fechamento superior / roda-teto',W,DEFAULTS.rodaTetoAereoMm,T,1,{source:SOURCE.PADRAO_CONSTRUTIVO}));
  return {method_id:input.door_type==='BASCULANTE'?'AEREO_BASCULANTE_V1':'AEREO_COZINHA_V1',dimensions:{box_depth_mm:D,total_with_back_mm:D+B,tamponamento_depth_mm:trimDepth,bays,bay_width_mm:Math.round(bayW*100)/100},pieces,assumptions:[{field:'shelf_qty',value:shelfQty,source:input.shelf_qty==null?SOURCE.PADRAO_CONSTRUTIVO:SOURCE.PROJETO}],status:input.shelf_qty==null?STATUS.PADRAO_APLICADO:STATUS.CONFIRMADO};
}

export function calculateFridgeBox(input){
  const T=pos(input.material_thickness_mm ?? 15,'espessura material');
  const depth=pos(input.depth_mm,'profundidade caixa geladeira');
  const topDepth=pos(input.top_depth_mm ?? DEFAULTS.superiorGeladeiraProfundidadeMm,'profundidade superior geladeira');
  const H=pos(input.height_mm,'altura');
  const sideW=pos(input.side_width_mm,'largura/altura útil do envoltório');
  const pieces=[piece('FRIDGE_SIDE','Tamponamento lateral geladeira',H,depth,T,2),piece('FRIDGE_TOP','Superior geladeira',sideW,topDepth,T,1)];
  if(input.thickened){ pieces.push(piece('FRIDGE_THICK_RAIL','Régua de engrossamento',H,DEFAULTS.reguaEngrossoGeladeiraMm,T,2,{assembly:'ENGROSSAMENTO'})); }
  return {method_id:'CAIXA_GELADEIRA_V1',pieces,dimensions:{depth_mm:depth,top_depth_mm:topDepth},assumptions:[{field:'top_depth_mm',value:topDepth,source:input.top_depth_mm==null?SOURCE.PADRAO_CONSTRUTIVO:SOURCE.PROJETO}],status:input.top_depth_mm==null?STATUS.PADRAO_APLICADO:STATUS.CONFIRMADO};
}

export function calculateTower(input){
  const internalW=pos(input.internal_width_mm ?? DEFAULTS.torreQuenteLarguraInternaMm,'largura interna torre');
  const zones=(input.zones||[]).map((z,i)=>({index:i,type:z.type,height_mm:Number(z.height_mm)||null,confirmed:Number(z.height_mm)>0}));
  const requiredElectros=zones.filter(z=>['FORNO','MICROONDAS'].includes(z.type) && !z.confirmed);
  const issues=requiredElectros.map(z=>({code:'ELETRO_SEM_MEDIDA',message:`Zona ${z.type} sem medida confirmada.`}));

  const assumptions=[{field:'internal_width_mm',value:internalW,source:input.internal_width_mm==null?SOURCE.PADRAO_CONSTRUTIVO:SOURCE.PROJETO}];
  const result={method_id:'TORRE_QUENTE_V1',dimensions:{internal_width_mm:internalW},zones,pieces:[],assumptions,issues,status:requiredElectros.length?STATUS.INFORMACAO_AUSENTE:(input.internal_width_mm==null?STATUS.PADRAO_APLICADO:STATUS.CONFIRMADO)};

  // Só gera peça de corte quando dá para fechar a altura da torre: toda zona
  // precisa de medida confirmada e a profundidade tem que vir do projeto.
  // Zona de forno/micro sem medida é justamente o caso em que chutar uma
  // altura estraga a chapa inteira — então preferimos não emitir nada.
  const semMedida=zones.some(z=>!z.confirmed);
  const D=Number(input.depth_mm)||0;
  if(!zones.length || semMedida || D<=0){
    if(!zones.length) result.status=STATUS.INFORMACAO_AUSENTE;
    if(!zones.length) issues.push({code:'TORRE_SEM_ZONAS',message:'Torre sem zonas definidas — informe as zonas (superior, micro, forno, inferior).'});
    if(D<=0) issues.push({code:'TORRE_SEM_PROFUNDIDADE',message:'Profundidade da torre não informada — sem ela não é possível gerar as peças.'});
    if(semMedida&&zones.length) result.status=STATUS.INFORMACAO_AUSENTE;
    if(D<=0) result.status=STATUS.INFORMACAO_AUSENTE;
    return result;
  }

  const T=pos(input.body_thickness_mm??15,'espessura corpo torre');
  const back=pos(input.back_thickness_mm??DEFAULTS.fundoParafusadoMm,'fundo torre');
  const alturaZonas=zones.reduce((a,z)=>a+z.height_mm,0);
  // Cada zona é separada da seguinte por uma travessa/prateleira horizontal.
  const separadores=Math.max(0,zones.length-1);
  const boxH=alturaZonas+separadores*T+2*T; // + base e tampo
  const boxW=internalW+2*T;

  result.dimensions.box_width_mm=boxW;
  result.dimensions.box_height_mm=boxH;
  result.dimensions.depth_mm=D;
  result.pieces=[
    piece('TOWER_SIDE','Lateral da torre',boxH,D,T,2,{role:'ESTRUTURAL'}),
    piece('TOWER_BASE','Base da torre',internalW,D,T,1,{role:'ESTRUTURAL'}),
    piece('TOWER_TOP','Tampo da torre',internalW,D,T,1,{role:'ESTRUTURAL'}),
    piece('TOWER_BACK','Fundo parafusado da torre',boxW,boxH,back,1,{mount:'PARAFUSADO_TRASEIRO'}),
  ];
  if(separadores) result.pieces.push(piece('TOWER_DIVIDER','Separador entre zonas',internalW,D,T,separadores,{role:'ESTRUTURAL'}));
  return result;
}

export function calculateWardrobe(input){
  const W=pos(input.width_mm,'largura guarda-roupa'); const H=pos(input.height_mm,'altura guarda-roupa'); const D=pos(input.box_depth_mm,'profundidade caixa'); const T=pos(input.body_thickness_mm??15,'espessura corpo');
  const back=pos(input.back_thickness_mm??DEFAULTS.fundoParafusadoMm,'fundo');
  const baseH=pos(input.base_height_mm??DEFAULTS.guardaRoupaBaseMm,'base/rodapé'); const topFinish=pos(input.top_finish_height_mm??DEFAULTS.guardaRoupaAcabamentoSuperiorMm,'acabamento superior');
  const tamponamentoDepth=D+DEFAULTS.portaAvancoFrontalMm+back;

  // Altura da CAIXA propriamente dita: o rodapé (base) e o acabamento superior
  // não fazem parte do corpo — por isso o fundo parafusado também tem essa
  // altura, e não a altura total do móvel.
  const boxH=H-baseH-topFinish;
  if(boxH<=2*T) throw new Error('Altura da caixa incompatível com base e acabamento superior informados.');

  // Laterais externas: a base e o tampo da caixa ficam ENTRE as laterais, então
  // têm a largura do móvel menos as duas laterais.
  const innerW=W-2*T;
  if(innerW<=0) throw new Error('Largura do guarda-roupa incompatível com a espessura das laterais.');

  // Divisórias internas (montantes). No guarda-roupa de correr elas são a
  // estrutura que sustenta os trilhos; no de giro delimitam os módulos.
  const postQty=Math.max(0,Math.trunc(input.internal_post_qty??0));
  const bayW=(innerW-postQty*T)/(postQty+1);
  if(bayW<=0) throw new Error('Divisórias internas em excesso para a largura informada.');

  const shelfQty=Math.max(0,Math.trunc(input.shelf_qty??1));
  const shelfDepth=pos(input.shelf_depth_mm??D,'profundidade da prateleira');

  const pieces=[
    piece('WARDROBE_SIDE','Lateral do guarda-roupa',boxH,D,T,2,{role:'ESTRUTURAL'}),
    piece('WARDROBE_BASE','Base da caixa',innerW,D,T,1,{role:'ESTRUTURAL'}),
    piece('WARDROBE_TOP','Tampo da caixa',innerW,D,T,1,{role:'ESTRUTURAL'}),
    piece('WARDROBE_BACK','Fundo 6 mm parafusado',W,boxH,back,1,{mount:'PARAFUSADO_TRASEIRO'}),
    piece('WARDROBE_PLINTH_FRONT','Rodapé frontal',W,baseH,T,1,{role:'ACABAMENTO'}),
    piece('WARDROBE_PLINTH_SIDE','Rodapé lateral',D-T,baseH,T,2,{role:'ACABAMENTO'}),
    piece('WARDROBE_TOP_FINISH','Acabamento superior',W,topFinish,T,1,{role:'ACABAMENTO'}),
  ];
  if(postQty) pieces.push(piece('WARDROBE_POST','Divisória / montante interno',boxH-2*T,D,T,postQty,{role:'ESTRUTURAL'}));
  if(shelfQty) pieces.push(piece('WARDROBE_SHELF','Prateleira interna',bayW,shelfDepth,T,shelfQty*(postQty+1),{role:'INTERNO'}));
  if(input.left_tamponamento) pieces.push(piece('WARDROBE_TAMP_L','Tamponamento esquerdo',H,tamponamentoDepth,input.left_tamponamento.thickness_mm??T,1,{role:'ACABAMENTO'}));
  if(input.right_tamponamento) pieces.push(piece('WARDROBE_TAMP_R','Tamponamento direito',H,tamponamentoDepth,input.right_tamponamento.thickness_mm??T,1,{role:'ACABAMENTO'}));

  const assumptions=[
    {field:'shelf_qty',value:shelfQty,source:input.shelf_qty==null?SOURCE.PADRAO_CONSTRUTIVO:SOURCE.PROJETO},
    {field:'internal_post_qty',value:postQty,source:input.internal_post_qty==null?SOURCE.PADRAO_CONSTRUTIVO:SOURCE.PROJETO},
  ];

  const result={method_id:input.door_type==='CORRER'?'GUARDA_ROUPA_CORRER_V1':'GUARDA_ROUPA_GIRO_V1',dimensions:{width_mm:W,height_mm:H,box_depth_mm:D,box_height_mm:boxH,inner_width_mm:innerW,bay_width_mm:Math.round(bayW*100)/100,tamponamento_depth_mm:tamponamentoDepth,base_height_mm:baseH,top_finish_height_mm:topFinish},pieces,assumptions,status:STATUS.PADRAO_APLICADO};
  if(input.door_type==='CORRER'){
    const tampH=pos(input.tamponamento_height_mm??H,'altura tamponamento');
    result.dimensions.internal_post_height_mm=tampH-DEFAULTS.guardaRoupaCorrerMontanteDescontoMm;
    if(postQty && result.dimensions.internal_post_height_mm !== boxH-2*T){
      result.status=STATUS.REVISAO_MANUAL;
      result.issues=[{code:'CONFLITO_MONTANTE',message:'Altura do montante pela regra do tamponamento diverge do vão da caixa. Confirmar montagem antes de fabricar.'}];
    }
    const openingH=pos(input.door_opening_height_mm??(H-baseH-topFinish),'vão portas');
    result.dimensions.sliding_door_height_mm=openingH-DEFAULTS.guardaRoupaCorrerPortaDescontoCarrinhoMm;
    const qty=Math.max(2,Math.trunc(input.door_qty??2));
    const openingW=pos(input.door_opening_width_mm??W,'vão portas largura');
    result.dimensions.sliding_door_width_mm=(openingW+DEFAULTS.guardaRoupaCorrerSobreposicaoMm*(qty-1))/qty;
    result.dimensions.sliding_door_qty=qty;
    result.dimensions.drawer_front_reference='FACE_MONTANTE_INTERNO';
    result.dimensions.drawer_front_recess_mm=0;
    // As portas de correr só entram como peça de corte quando o projeto disser
    // que são de MDF — em kit de alumínio/vidro elas vêm prontas do fornecedor.
    if(input.include_doors) pieces.push(piece('WARDROBE_SLIDING_DOOR','Porta de correr',result.dimensions.sliding_door_height_mm,result.dimensions.sliding_door_width_mm,input.door_thickness_mm??18,qty,{role:'PORTA'}));
  } else {
    result.dimensions.drawer_front_recess_mm=DEFAULTS.gaveteiroGuardaRoupaGiroRecuoFrontalMm;
    const qty=Math.max(1,Math.trunc(input.door_qty??Math.ceil(W/500)));
    const folga=DEFAULTS.portaFolgaMm;
    result.dimensions.hinged_door_qty=qty;
    result.dimensions.hinged_door_width_mm=Math.round((W/qty-folga)*100)/100;
    result.dimensions.hinged_door_height_mm=boxH-folga;
    assumptions.push({field:'door_qty',value:qty,source:input.door_qty==null?SOURCE.PADRAO_CONSTRUTIVO:SOURCE.PROJETO});
    if(input.include_doors) pieces.push(piece('WARDROBE_HINGED_DOOR','Porta de giro',result.dimensions.hinged_door_height_mm,result.dimensions.hinged_door_width_mm,input.door_thickness_mm??18,qty,{role:'PORTA'}));
  }
  result.dimensions.drawer_side_spacer_mm=DEFAULTS.gaveteiroGuardaRoupaSarrafoLateralMm;
  return result;
}

export function calculatePanelFixingRails(input){
  const width=pos(input.width_mm,'largura painel'); const height=pos(input.height_mm,'altura painel'); const t=pos(input.rail_thickness_mm??DEFAULTS.painelReguaFixacaoEspessuraMm,'espessura régua');
  const spacing=pos(input.max_spacing_mm??DEFAULTS.painelReguaFixacaoEspacamentoMaxMm,'espaçamento máximo');
  const intervals=Math.max(1,Math.ceil(width/spacing));
  const qty=intervals+1;
  const faceT=pos(input.panel_thickness_mm??18,'espessura do painel');
  const pieces=[piece('PANEL_RAIL','Régua de fixação painel',height,input.rail_width_mm??50,t,qty,{role:'ESTRUTURAL'})];
  const issues=[];
  const assumptions=[{field:'panel_thickness_mm',value:faceT,source:input.panel_thickness_mm==null?SOURCE.PADRAO_CONSTRUTIVO:SOURCE.PROJETO}];
  let status=input.panel_thickness_mm==null?STATUS.PADRAO_APLICADO:STATUS.CONFIRMADO;
  const result={method_id:input.ripado?'PAINEL_RIPADO_V1':'PAINEL_LISO_V1',rails:{quantity:qty,length_mm:height,thickness_mm:t,max_spacing_mm:spacing},pieces,assumptions,issues,status};

  if(!input.ripado){
    // Painel liso: a placa sai exatamente na medida do projeto.
    pieces.push(piece('PANEL_FACE','Placa do painel',height,width,faceT,1,{role:'ACABAMENTO'}));
    return result;
  }

  // Painel ripado: sem a largura da ripa e o espaçamento não dá para calcular
  // quantas ripas cabem — e chutar isso muda a quantidade de material. Fica
  // pendente para o marceneiro informar, como você mesmo disse: "é só ler a
  // medida que estipular em cada projeto".
  const ripaW=Number(input.ripa_width_mm)||0;
  const ripaGap=Number(input.ripa_gap_mm);
  if(ripaW<=0 || !Number.isFinite(ripaGap) || ripaGap<0){
    issues.push({code:'RIPADO_SEM_MEDIDA',message:'Painel ripado sem largura da ripa e/ou espaçamento — informe ripa_width_mm e ripa_gap_mm conforme o projeto.'});
    result.status=STATUS.INFORMACAO_AUSENTE;
    return result;
  }
  const passo=ripaW+ripaGap;
  const ripaQty=Math.max(1,Math.floor((width+ripaGap)/passo));
  result.ripas={quantity:ripaQty,width_mm:ripaW,gap_mm:ripaGap,length_mm:height,pitch_mm:passo,sobra_mm:Math.round((width-(ripaQty*passo-ripaGap))*100)/100};
  pieces.push(piece('PANEL_SLAT','Ripa do painel',height,ripaW,faceT,ripaQty,{role:'ACABAMENTO'}));
  return result;
}

export function calculateTamborado(input){
  const L=pos(input.length_mm,'comprimento'); const W=pos(input.width_mm,'largura');
  const face1=pos(input.face_front_mm??6,'face frontal'); const core=pos(input.core_mm??15,'miolo'); const face2=pos(input.face_back_mm??6,'face traseira');
  return {method_id:'TAMBORADO_PARAMETRICO_V1',final_thickness_mm:face1+core+face2,pieces:[piece('TAMB_FACE_FRONT','Face frontal',L,W,face1),piece('TAMB_CORE','Miolo/estrutura',L,W,core),piece('TAMB_FACE_BACK','Face traseira',L,W,face2)],status:STATUS.CONFIRMADO};
}

export function calculateCentralTamponadedBox(input){
  const boxW=pos(input.box_width_mm,'largura caixa'); const boxD=pos(input.box_depth_mm,'profundidade caixa'); const H=pos(input.height_mm,'altura'); const T=pos(input.thickness_mm??15,'espessura');
  const left=n(input.left_finish_mm??T,'tamponamento esquerdo'); const right=n(input.right_finish_mm??T,'tamponamento direito');
  const topD=input.top_depth_mm==null?boxD:Number(input.top_depth_mm);
  return {method_id:'CAIXA_CENTRAL_TAMPONADA_V1',dimensions:{top_width_mm:boxW+left+right,top_depth_mm:topD},issues:[{code:'CAIXA_INCOMPLETA',message:'Caixa central ainda é referência; falta cadastrar a decomposição estrutural.'}],pieces:[piece('CENTRAL_BOX','Caixa central - referência',boxW,boxD,T,1),piece('CENTRAL_TAMP_L','Tamponamento esquerdo',H,boxD,left,1),piece('CENTRAL_TAMP_R','Tamponamento direito',H,boxD,right,1),piece('CENTRAL_TOP','Tampo de cobertura',boxW+left+right,topD,T,1)],assumptions:[{field:'top_depth_mm',value:topD,source:input.top_depth_mm==null?SOURCE.PADRAO_CONSTRUTIVO:SOURCE.PROJETO}],status:input.top_depth_mm==null?STATUS.PADRAO_APLICADO:STATUS.CONFIRMADO};
}

export function validateForProduction(result){
  const issues=[];
  const block=(code,message,piece)=>issues.push({code,message,piece,severity:'critical'});
  if(!Array.isArray(result?.pieces) || !result.pieces.length) block('SEM_PECAS','Resultado sem peças fabricáveis.');
  if(![STATUS.CONFIRMADO,STATUS.PADRAO_APLICADO].includes(result?.status)) block('STATUS_BLOQUEANTE','Status exige revisão.');
  for(const issue of result?.issues||[]) block(issue.code||'PENDENCIA',issue.message||'Pendência construtiva.');
  // Os métodos atuais estão em validação no catálogo. Não confundir cenário calculado com regra aprovada.
  if(result?.method_id && METHOD_REGISTRY.find(m=>m.id===result.method_id)?.status!=='VALIDADO') block('METODO_NAO_VALIDADO','Método construtivo ainda não validado para produção.');
  for(const h of result?.hardware||[]) if(!['VALIDADO','CONFIRMADO'].includes(h.status)) block('FERRAGEM_NAO_VALIDADA','Ferragem exige validação.');
  for(const p of result?.pieces||[]){
    if(![p.comprimento_mm,p.largura_mm,p.espessura_mm].every(v=>Number.isFinite(v)&&v>0) || !Number.isInteger(p.quantidade) || p.quantidade<=0) block('PECA_INVALIDA','Dimensões ou quantidade inválidas.',p.id);
    if(!p.material_id || ['SEM_MATERIAL','LEGACY_NAO_CLASSIFICADO'].includes(p.material_id)) block('SEM_MATERIAL','Selecione o material da peça.',p.id);
    const L=p.chapa_comprimento_mm,W=p.chapa_largura_mm;
    if(!(Number.isFinite(L)&&L>0&&Number.isFinite(W)&&W>0)) block('SEM_CHAPA','Dimensões da chapa ausentes.',p.id);
    else if(!((p.comprimento_mm<=L&&p.largura_mm<=W) || (p.rotacao_permitida!==false && (!p.veio || p.veio==='qualquer') && p.comprimento_mm<=W&&p.largura_mm<=L))) block('MAIOR_QUE_CHAPA','Peça não cabe na chapa na orientação permitida.',p.id);
  }
  return {liberado:issues.length===0,issues};
}

export function groupPiecesForCut(pieces){
  const groups=new Map();
  for(const p of pieces||[]){
    const key=[p.material_id||'SEM_MATERIAL',p.espessura_mm,p.padrao||'',p.chapa_comprimento_mm||'',p.chapa_largura_mm||'',p.veio||''].join('|');
    if(!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(p);
  }
  return [...groups.entries()].map(([key,items])=>({key,pieces:items}));
}
