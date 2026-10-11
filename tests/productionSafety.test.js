import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateSinkCabinet,calculateWardrobe,calculateTower,calculateCentralTamponadedBox,validateForProduction,materialForThickness} from '../src/engine/construction/index.js';
import {decomporPeca,explodirPecasConstrutivas} from '../src/engine/metodosConstrutivos.js';
import {normalizarPecasParaCorte,otimizarCorte,revisarPlanoCorte} from '../src/engine/otimizador.js';
const item=(over={})=>({id:'p',comprimento_mm:600,largura_mm:400,espessura_mm:15,quantidade:1,material_id:'MDF_15',chapa_comprimento_mm:2750,chapa_largura_mm:1830,...over});
const result=(p)=>({status:'CONFIRMADO',pieces:[p]});
test('validação aceita peça completa e rejeita resultados vazios',()=>{
 assert.equal(validateForProduction(result(item())).liberado,true);
 for(const r of [undefined,{}, {status:'CONFIRMADO',pieces:[]}]) assert.equal(validateForProduction(r).liberado,false);
});
test('validação rejeita material, chapa, medidas e quantidades inválidas',()=>{
 for(const over of [{material_id:null},{chapa_largura_mm:null},{comprimento_mm:Infinity},{largura_mm:NaN},{quantidade:0},{quantidade:1.5},{espessura_mm:0},{comprimento_mm:3000}]) assert.equal(validateForProduction(result(item(over))).liberado,false,JSON.stringify(over));
});
test('orientação e veio limitam a rotação na validação',()=>{
 const p=item({comprimento_mm:1800,largura_mm:2500});
 assert.equal(validateForProduction(result(p)).liberado,true);
 assert.equal(validateForProduction(result({...p,rotacao_permitida:false})).liberado,false);
 assert.equal(validateForProduction(result({...p,veio:'longitudinal'})).liberado,false);
});
test('pendências e ferragens em revisão bloqueiam mesmo com status confirmado',()=>{
 assert.equal(validateForProduction({...result(item()),issues:[{code:'CONFLITO'}]}).liberado,false);
 assert.equal(validateForProduction({...result(item()),hardware:[{status:'EM_VALIDACAO'}]}).liberado,false);
});
test('gabinete aplica avanço de 24mm nos tamponamentos, mantendo régua de parede',()=>{
 for(const type of ['PANEL_SIMPLE','PANEL_THICK']){
 const r=calculateSinkCabinet({width_mm:1200,height_mm:700,stone_depth_mm:600,left_finish:{type},right_finish:{type:'WALL_STRIP'},bottom_finish:{type}});
 assert.equal(r.dimensions.box_depth_mm,570);
 assert.equal(r.pieces.find(p=>p.id.startsWith('SIDE_PANEL')).largura_mm,594);
 assert.equal(r.pieces.find(p=>p.id.startsWith('BOTTOM_PANEL')).largura_mm,594);
 assert.equal(r.pieces.find(p=>p.id==='WALL_STRIP_RIGHT').largura_mm,50);
 assert.equal(validateForProduction(r).liberado,false,'método ainda em validação');
 }
});
test('montante conflitante bloqueia produção sem inventar a montagem',()=>{
 const r=calculateWardrobe({width_mm:1600,height_mm:2400,box_depth_mm:550,door_type:'CORRER',internal_post_qty:1});
 assert.equal(r.status,'REVISAO_MANUAL');
 assert.ok(r.issues.some(i=>i.code==='CONFLITO_MONTANTE'));
 assert.equal(validateForProduction(r).liberado,false);
});
test('torre sem zonas e caixa de referência não são liberadas',()=>{
 assert.equal(calculateTower({depth_mm:600}).status,'INFORMACAO_AUSENTE');
 assert.equal(validateForProduction(calculateTower({depth_mm:600})).liberado,false);
 assert.equal(validateForProduction(calculateCentralTamponadedBox({box_width_mm:600,box_depth_mm:450,height_mm:500})).liberado,false);
});
test('espessura não é arredondada para atribuir material diferente',()=>assert.equal(materialForThickness(14.6),null));
test('prateleira mantém metros decimais na decomposição e no corte',()=>{
 const ex=explodirPecasConstrutivas([{id:1,nome:'Prateleira',categoria:'Prateleira',tipo:'ml',quantidade:2.5}]);
 assert.equal(ex.paraCorte[0].altura,2.5);
 assert.equal(normalizarPecasParaCorte(ex.paraCorte)[0].comprimento_mm,2500);
});
test('normalização preserva décimos de milímetro e rejeita quantidades inválidas',()=>{
 assert.equal(normalizarPecasParaCorte([item({largura_mm:400.25})])[0].largura_mm,400.25);
 for(const quantidade of [0,-1,1.5,NaN]) assert.equal(normalizarPecasParaCorte([item({quantidade})]).invalidas.length,1);
});
test('plano real separa fundos 6mm e corpo 15mm',()=>{
 const ex=explodirPecasConstrutivas([{id:1,nome:'Armário',categoria:'Armário/Guarda-roupa',tipo:'m²',largura:0.8,altura:0.7,profundidade:0.5,quantidade:1}]);
 const r=otimizarCorte(normalizarPecasParaCorte(ex.paraCorte));
 assert.ok(r.chapas.length>=2);
 for(const c of r.chapas) assert.equal(new Set(c.pecas.map(p=>p.peca.espessura_mm)).size,1);
 assert.equal(r.total_pecas_posicionadas,ex.paraCorte.reduce((a,p)=>a+p.quantidade,0));
});
test('materiais diferentes na mesma espessura ocupam chapas diferentes',()=>{
 const r=otimizarCorte(normalizarPecasParaCorte([item(),item({id:'b',material_id:'MDF_AZUL_15'})]));
 assert.equal(r.total_chapas,2);
});
test('peça estrutural grande não recebe emenda automática',()=>{
 const ex=explodirPecasConstrutivas([{id:1,nome:'Armário',categoria:'Armário/Guarda-roupa',tipo:'m²',largura:0.8,altura:3.2,profundidade:0.5,quantidade:1}]);
 assert.ok(ex.emendas.some(e=>e.nome.includes('Lateral')));
 assert.ok(ex.paraCorte.some(p=>p.altura>3));
 const r=otimizarCorte(normalizarPecasParaCorte(ex.paraCorte));
 assert.ok(r.pecas_nao_posicionadas.length>0);
});
test('simulação legada e pendências impedem impressão de produção',()=>{
 const ex={manuais:[{pecaId:1}],emendas:[]};
 const pecas=normalizarPecasParaCorte([item()]);
 const r=revisarPlanoCorte({explodir:ex,pecas,resultado:otimizarCorte(pecas)});
 assert.equal(r.liberado,false);
 assert.ok(r.motivos.some(m=>m.includes('módulos')));
});
test('configurações impossíveis não criam área útil fictícia',()=>{
 for(const cfg of [{chapa_largura_mm:10,margem_borda_mm:10},{kerf_mm:-1},{chapa_altura_mm:NaN}]) assert.throws(()=>otimizarCorte(normalizarPecasParaCorte([item()]),cfg));
});
