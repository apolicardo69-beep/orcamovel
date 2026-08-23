import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAereo, calculateWardrobe, calculateTower,
  calculatePanelFixingRails, calculateSinkCabinet,
  groupPiecesForCut, materialForThickness,
} from '../src/engine/construction/index.js';

const get = (r, id) => r.pieces.find((p) => p.id === id);

// ---------------------------------------------------------------
// GUARDA-ROUPA — antes gerava só o fundo, agora gera a caixa inteira
// ---------------------------------------------------------------

test('guarda-roupa giro gera a caixa completa, não só o fundo', () => {
  const r = calculateWardrobe({ width_mm: 1600, height_mm: 2400, box_depth_mm: 550, body_thickness_mm: 15, door_type: 'GIRO' });
  // altura da caixa = 2400 - 100 (rodapé) - 70 (acabamento superior)
  assert.equal(r.dimensions.box_height_mm, 2230);
  assert.equal(r.dimensions.inner_width_mm, 1570);

  assert.equal(get(r, 'WARDROBE_SIDE').comprimento_mm, 2230);
  assert.equal(get(r, 'WARDROBE_SIDE').quantidade, 2);
  assert.equal(get(r, 'WARDROBE_BASE').comprimento_mm, 1570);
  assert.equal(get(r, 'WARDROBE_TOP').comprimento_mm, 1570);
  assert.equal(get(r, 'WARDROBE_BACK').largura_mm, 2230);
  assert.equal(get(r, 'WARDROBE_BACK').espessura_mm, 6);
  assert.equal(get(r, 'WARDROBE_PLINTH_FRONT').largura_mm, 100);
  assert.equal(get(r, 'WARDROBE_TOP_FINISH').largura_mm, 70);
  assert.equal(get(r, 'WARDROBE_SHELF').comprimento_mm, 1570);
});

test('divisória interna divide o vão e a prateleira acompanha a largura do vão', () => {
  const r = calculateWardrobe({ width_mm: 1600, height_mm: 2400, box_depth_mm: 550, body_thickness_mm: 15, door_type: 'GIRO', internal_post_qty: 1, shelf_qty: 2 });
  // 1570 interno - 15 do montante = 1555, dividido em 2 vãos
  assert.equal(r.dimensions.bay_width_mm, 777.5);
  assert.equal(get(r, 'WARDROBE_POST').quantidade, 1);
  assert.equal(get(r, 'WARDROBE_SHELF').comprimento_mm, 777.5);
  // 2 prateleiras por vão × 2 vãos
  assert.equal(get(r, 'WARDROBE_SHELF').quantidade, 4);
});

test('guarda-roupa correr mantém montante -80, porta -35 e sobreposição 20', () => {
  const r = calculateWardrobe({ width_mm: 1600, height_mm: 2400, box_depth_mm: 550, body_thickness_mm: 15, door_type: 'CORRER', tamponamento_height_mm: 2400, door_opening_height_mm: 2230, door_opening_width_mm: 1600, door_qty: 2 });
  assert.equal(r.dimensions.internal_post_height_mm, 2320);
  assert.equal(r.dimensions.sliding_door_height_mm, 2195);
  assert.equal(r.dimensions.sliding_door_width_mm, 810);
  // porta só vira peça de corte quando o projeto disser que é MDF
  assert.equal(get(r, 'WARDROBE_SLIDING_DOOR'), undefined);
});

test('portas entram no corte apenas com include_doors', () => {
  const r = calculateWardrobe({ width_mm: 1600, height_mm: 2400, box_depth_mm: 550, door_type: 'CORRER', door_opening_height_mm: 2230, door_opening_width_mm: 1600, door_qty: 2, include_doors: true });
  const porta = get(r, 'WARDROBE_SLIDING_DOOR');
  assert.equal(porta.quantidade, 2);
  assert.equal(porta.comprimento_mm, 2195);
  assert.equal(porta.largura_mm, 810);
});

test('guarda-roupa recusa altura incompatível com rodapé e acabamento', () => {
  assert.throws(() => calculateWardrobe({ width_mm: 1600, height_mm: 150, box_depth_mm: 550, door_type: 'GIRO' }));
});

// ---------------------------------------------------------------
// AÉREO COM MAIS DE UM VÃO — antes não gerava divisória
// ---------------------------------------------------------------

test('aéreo de 2 vãos gera divisória e prateleira na largura do vão', () => {
  const r = calculateAereo({ box_width_mm: 1600, box_height_mm: 700, box_depth_mm: 350, body_thickness_mm: 15, bays: 2 });
  assert.equal(r.dimensions.bays, 2);
  // (1600 - 30 das laterais - 15 da divisória) / 2
  assert.equal(r.dimensions.bay_width_mm, 777.5);
  assert.equal(get(r, 'AEREO_DIVIDER').quantidade, 1);
  assert.equal(get(r, 'AEREO_DIVIDER').comprimento_mm, 670);
  assert.equal(get(r, 'AEREO_SHELF').comprimento_mm, 777.5);
  assert.equal(get(r, 'AEREO_SHELF').quantidade, 2);
});

test('aéreo de 1 vão continua igual (sem regressão)', () => {
  const r = calculateAereo({ box_width_mm: 800, box_height_mm: 700, box_depth_mm: 350, body_thickness_mm: 15 });
  assert.equal(get(r, 'AEREO_DIVIDER'), undefined);
  assert.equal(get(r, 'AEREO_SHELF').comprimento_mm, 770);
  assert.equal(get(r, 'AEREO_SHELF').quantidade, 1);
});

// ---------------------------------------------------------------
// TORRE QUENTE — antes não gerava peça nenhuma
// ---------------------------------------------------------------

test('torre quente com todas as zonas medidas gera as peças', () => {
  const r = calculateTower({
    internal_width_mm: 700, depth_mm: 600, body_thickness_mm: 15,
    zones: [{ type: 'SUPERIOR', height_mm: 400 }, { type: 'MICROONDAS', height_mm: 400 }, { type: 'FORNO', height_mm: 600 }, { type: 'INFERIOR', height_mm: 700 }],
  });
  // 2100 de zonas + 3 separadores (45) + base e tampo (30)
  assert.equal(r.dimensions.box_height_mm, 2175);
  assert.equal(r.dimensions.box_width_mm, 730);
  assert.equal(get(r, 'TOWER_SIDE').quantidade, 2);
  assert.equal(get(r, 'TOWER_DIVIDER').quantidade, 3);
  assert.equal(get(r, 'TOWER_BACK').espessura_mm, 6);
});

test('torre quente com forno sem medida não gera peça e fica pendente', () => {
  const r = calculateTower({ internal_width_mm: 700, depth_mm: 600, zones: [{ type: 'FORNO' }, { type: 'INFERIOR', height_mm: 700 }] });
  assert.equal(r.status, 'INFORMACAO_AUSENTE');
  assert.equal(r.pieces.length, 0);
  assert.ok(r.issues.some((i) => i.code === 'ELETRO_SEM_MEDIDA'));
});

test('torre quente sem profundidade não gera peça', () => {
  const r = calculateTower({ internal_width_mm: 700, zones: [{ type: 'INFERIOR', height_mm: 700 }] });
  assert.equal(r.status, 'INFORMACAO_AUSENTE');
  assert.equal(r.pieces.length, 0);
  assert.ok(r.issues.some((i) => i.code === 'TORRE_SEM_PROFUNDIDADE'));
});

// ---------------------------------------------------------------
// PAINEL — antes gerava só as réguas
// ---------------------------------------------------------------

test('painel liso gera a placa além das réguas', () => {
  const r = calculatePanelFixingRails({ width_mm: 1800, height_mm: 2700 });
  assert.equal(r.rails.quantity, 4);
  const face = get(r, 'PANEL_FACE');
  assert.equal(face.comprimento_mm, 2700);
  assert.equal(face.largura_mm, 1800);
  assert.equal(face.espessura_mm, 18);
});

test('painel ripado calcula as ripas quando o projeto informa largura e espaçamento', () => {
  const r = calculatePanelFixingRails({ width_mm: 1800, height_mm: 2700, ripado: true, ripa_width_mm: 50, ripa_gap_mm: 20 });
  // passo 70mm -> (1800+20)/70 = 26 ripas
  assert.equal(r.ripas.quantity, 26);
  assert.equal(r.ripas.pitch_mm, 70);
  assert.equal(get(r, 'PANEL_SLAT').quantidade, 26);
  assert.equal(get(r, 'PANEL_SLAT').largura_mm, 50);
  assert.equal(get(r, 'PANEL_FACE'), undefined);
});

test('painel ripado sem medida da ripa fica pendente em vez de chutar', () => {
  const r = calculatePanelFixingRails({ width_mm: 1800, height_mm: 2700, ripado: true });
  assert.equal(r.status, 'INFORMACAO_AUSENTE');
  assert.ok(r.issues.some((i) => i.code === 'RIPADO_SEM_MEDIDA'));
  assert.equal(get(r, 'PANEL_SLAT'), undefined);
});

// ---------------------------------------------------------------
// MATERIAL — antes toda peça caía como SEM_MATERIAL
// ---------------------------------------------------------------

test('cada peça carrega o material da chapa pela espessura', () => {
  assert.equal(materialForThickness(15).id, 'MDF_15');
  assert.equal(materialForThickness(6).id, 'MDF_6');
  assert.equal(materialForThickness(99), null);

  const r = calculateWardrobe({ width_mm: 1600, height_mm: 2400, box_depth_mm: 550, door_type: 'GIRO' });
  assert.equal(get(r, 'WARDROBE_SIDE').material_id, 'MDF_15');
  assert.equal(get(r, 'WARDROBE_BACK').material_id, 'MDF_6');
  assert.equal(get(r, 'WARDROBE_SIDE').chapa_comprimento_mm, 2750);
});

test('o fundo de 6 mm não é agrupado junto com a chapa de 15 mm', () => {
  const r = calculateSinkCabinet({ width_mm: 1200, height_mm: 700, stone_depth_mm: 600, front_recess_mm: 30, body_thickness_mm: 15, left_finish: { type: 'PANEL_SIMPLE' }, right_finish: { type: 'PANEL_SIMPLE' }, bottom_finish: { type: 'NONE' } });
  const wardrobe = calculateWardrobe({ width_mm: 1600, height_mm: 2400, box_depth_mm: 550, door_type: 'GIRO' });
  const grupos = groupPiecesForCut([...r.pieces, ...wardrobe.pieces]);
  const ids = grupos.map((g) => g.key.split('|')[0]).sort();
  assert.deepEqual(ids, ['MDF_15', 'MDF_6']);
});
