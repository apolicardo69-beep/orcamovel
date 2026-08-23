import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSinkCabinet, calculateDrawer, calculateAereo, calculateWardrobe, calculatePanelFixingRails, calculateTamborado, calculateCentralTamponadedBox, validateForProduction } from '../src/engine/construction/index.js';

test('gabinete pia 1200x700, pedra 600, tamponamentos simples 15',()=>{
  const r=calculateSinkCabinet({width_mm:1200,height_mm:700,stone_depth_mm:600,front_recess_mm:30,body_thickness_mm:15,left_finish:{type:'PANEL_SIMPLE'},right_finish:{type:'PANEL_SIMPLE'},bottom_finish:{type:'PANEL_SIMPLE'}});
  assert.equal(r.dimensions.box_width_mm,1170);
  assert.equal(r.dimensions.box_depth_mm,570);
  assert.equal(r.dimensions.side_height_mm,655);
  assert.equal(r.pieces.find(p=>p.id==='TOP_RAIL_FRONT').largura_mm,50);
  assert.equal(r.pieces.find(p=>p.id==='SHELF').comprimento_mm,1140);
});

test('régua de parede é 700x50 e ocupa a espessura do MDF, não 50 mm na largura do conjunto',()=>{
  const r=calculateSinkCabinet({width_mm:1200,height_mm:700,stone_depth_mm:600,front_recess_mm:30,body_thickness_mm:15,left_finish:{type:'WALL_STRIP'},right_finish:{type:'PANEL_SIMPLE'},bottom_finish:{type:'NONE'}});
  assert.equal(r.dimensions.box_width_mm,1170);
  const rail=r.pieces.find(p=>p.id==='WALL_STRIP_LEFT');
  assert.equal(rail.comprimento_mm,700);
  assert.equal(rail.largura_mm,50);
});

test('gaveta telescópica usa 25 mm de folga total e fundo rasgado 6mm/8mm',()=>{
  const r=calculateDrawer({opening_width_mm:500,depth_mm:500,side_height_mm:133,body_thickness_mm:15});
  assert.equal(r.dimensions.drawer_outer_width_mm,475);
  assert.equal(r.machining.groove_depth_mm,8);
  assert.equal(r.machining.offset_bottom_mm,12);
  assert.equal(r.pieces.find(p=>p.id==='DRAWER_BOTTOM').espessura_mm,6);
});

test('aéreo: fundo 6 parafusado e tamponamento avança 18+6',()=>{
  const r=calculateAereo({box_width_mm:800,box_height_mm:700,box_depth_mm:350,body_thickness_mm:15,left_tamponamento:{thickness_mm:15}});
  assert.equal(r.dimensions.total_with_back_mm,356);
  assert.equal(r.dimensions.tamponamento_depth_mm,374);
  assert.equal(r.pieces.find(p=>p.id==='AEREO_BACK').espessura_mm,6);
  assert.equal(r.pieces.find(p=>p.id==='AEREO_TAMP_L').largura_mm,374);
});

test('guarda-roupa correr: montante -80, porta -35 e sobreposição 20',()=>{
  const r=calculateWardrobe({width_mm:1600,height_mm:2400,box_depth_mm:550,body_thickness_mm:15,door_type:'CORRER',tamponamento_height_mm:2400,door_opening_height_mm:2230,door_opening_width_mm:1600,door_qty:2});
  assert.equal(r.dimensions.tamponamento_depth_mm,574);
  assert.equal(r.dimensions.internal_post_height_mm,2320);
  assert.equal(r.dimensions.sliding_door_height_mm,2195);
  assert.equal(r.dimensions.sliding_door_width_mm,810);
  assert.equal(r.dimensions.drawer_front_recess_mm,0);
});

test('guarda-roupa giro: gaveteiro recua 60 mm',()=>{
  const r=calculateWardrobe({width_mm:1600,height_mm:2400,box_depth_mm:550,door_type:'GIRO'});
  assert.equal(r.dimensions.drawer_front_recess_mm,60);
  assert.equal(r.dimensions.drawer_side_spacer_mm,50);
});

test('painel 1800mm usa réguas de modo que o vão máximo seja 600mm',()=>{
  const r=calculatePanelFixingRails({width_mm:1800,height_mm:2700});
  assert.equal(r.rails.quantity,4);
  assert.equal(r.rails.max_spacing_mm,600);
  assert.equal(r.rails.length_mm,2700);
});

test('tamborado padrão 6+15+6 = 27 mm e aceita 15+15+15 = 45 mm',()=>{
  assert.equal(calculateTamborado({length_mm:1000,width_mm:300}).final_thickness_mm,27);
  assert.equal(calculateTamborado({length_mm:1000,width_mm:300,face_front_mm:15,core_mm:15,face_back_mm:15}).final_thickness_mm,45);
});

test('caixa central tamponada: tampo cobre emendas laterais',()=>{
  const r=calculateCentralTamponadedBox({box_width_mm:600,box_depth_mm:450,height_mm:500,thickness_mm:15,left_finish_mm:15,right_finish_mm:15});
  assert.equal(r.dimensions.top_width_mm,630);
  assert.equal(r.dimensions.top_depth_mm,450);
});

test('status de revisão manual bloqueia produção',()=>{
  const r=calculateDrawer({opening_width_mm:500,depth_mm:500,side_height_mm:133});
  assert.equal(validateForProduction(r).liberado,false);
});
