import test from 'node:test';
import assert from 'node:assert/strict';
import {decomporPeca,explodirPecasConstrutivas,DEFAULT_METODOS_CONSTRUTIVOS} from '../src/engine/metodosConstrutivos.js';
import {identificarConstrucao,modulosRepetidos,anexarComplementos,agruparNaoPosicionadas,formatarMm} from '../src/engine/interpretacao.js';
const p=over=>({_id:'a',nome:'Painel',tipo:'m²',quantidade:1,largura:1.5,altura:2,ambiente:'Sala',...over});
test('painel Nuvem da p34 não vira ripas de 50mm',()=>{
 const item=p({nome:'Painel MDF Nuvem Guararapes com frisos',largura:2.645,altura:2.8,categoria:'TV/Sala'});
 assert.equal(identificarConstrucao(item).tipo,'PAINEL_FRISADO');
 const r=decomporPeca(item);assert.equal(r.status,'manual');assert.match(r.motivo,/usinado/);assert.equal(r.paineis,undefined);
});
test('painel para TV não herda caixa, portas nem divisórias da categoria comercial',()=>{
 const r=decomporPeca(p({nome:'Painel MDF com espaço para TV',categoria:'TV/Sala'}));
 assert.equal(r.status,'ok');assert.equal(r.paineis.length,1);assert.equal(r.paineis[0].nome,'Painel MDF com espaço para TV');
});
test('porta embutida requer método específico',()=>{
 const r=decomporPeca(p({nome:'Painel com porta de abrir embutida'}));assert.equal(r.status,'manual');assert.match(r.motivo,/porta embutida/);
});
test('M304 preserva recorte da janela como pendência, sem fabricar retângulo inteiro',()=>{
 const r=decomporPeca(p({codigo_modulo:'M304',nome:'Painel ripado',largura:1.54,altura:4.585,recortes:[{descricao:'Janela',largura_mm:496,altura_mm:3400}]}));
 assert.equal(r.status,'manual');assert.match(r.motivo,/Recorte/);assert.equal(r.paineis,undefined);
});
test('configuração antiga 50/20 não preenche medidas ausentes de ripado',()=>{
 const cfg={...DEFAULT_METODOS_CONSTRUTIVOS,Painel:{estrategia:'painel_simples',espessura_mm:18,ripa_largura_m:0.05,ripa_espacamento_m:0.02}};
 assert.equal(decomporPeca(p({nome:'Painel ripado'}),cfg).status,'manual');
});
test('ripado simples usa parâmetros do módulo, sem inventar base',()=>{
 const item=p({nome:'Painel ripado',largura:0.89,ripa_largura_mm:30,ripa_espacamento_mm:20,ripa_espessura_mm:15,ripado_tem_base:false});
 const r=decomporPeca(item);assert.equal(r.status,'ok');assert.equal(r.paineis.length,1);assert.equal(r.paineis[0].quantidade,18);
 assert.equal(decomporPeca({...item,ripado_tem_base:null}).status,'manual');
 assert.equal(decomporPeca({...item,ripa_espacamento_mm:null}).status,'manual');
});
test('cotas divergentes p49 exigem revisão',()=>{
 const r=decomporPeca(p({nome:'Painel Cinza Puro',divergencias_cotas:['Topo 2645 mm; frente 2650 mm']}));assert.equal(r.status,'manual');assert.match(r.motivo,/divergentes/);
});
test('códigos iguais em ambientes diferentes não são duplicatas',()=>{
 const a=p({codigo_modulo:'M01'}),b=p({_id:'b',codigo_modulo:'M01',ambiente:'Quarto'});assert.equal(modulosRepetidos([a,b]).length,0);
 const ex=explodirPecasConstrutivas([a,{...a,_id:'b'}]);assert.equal(ex.paraCorte.length,0);assert.equal(ex.manuais.length,2);
});
test('vistas complementam um módulo sem criar linha comercial ou substituir suas medidas',()=>{
 const items=[p({codigo_modulo:'M304',largura:1.54})];
 anexarComplementos(items,[{codigo_modulo:'M304',ambiente:'Sala',largura:1.55,recortes:[{descricao:'janela'}]}],8);
 assert.equal(items.length,1);assert.equal(items[0].largura,1.54);assert.equal(items[0].vistas_complementares.length,1);assert.equal(items[0].recortes.length,1);assert.ok(items[0].divergencias_cotas.length);
});
test('vistas sem correspondência são guardadas para revisão',()=>{
 const pendentes=[];anexarComplementos([],[{codigo_modulo:'M304',ambiente:'Sala',observacao:'Janela'}],8,pendentes);assert.equal(pendentes.length,1);assert.equal(pendentes[0].pagina,8);
});
test('137 instâncias iguais geram um aviso com quantidade e sem casas decimais espúrias',()=>{
 const items=Array.from({length:137},(_,i)=>({peca:{id:'r',nome:'Ripa',largura_mm:50,comprimento_mm:2796.9999999999995,espessura_mm:15},instancia:i}));
 const g=agruparNaoPosicionadas(items);assert.equal(g.length,1);assert.equal(g[0].quantidade,137);assert.equal(formatarMm(items[0].peca.comprimento_mm),'2.797');
});

test('vista complementar com cotas iguais não cria divergência nem elimina módulo',()=>{
 const items=[p({nome:'Gabinete de banheiro',categoria:'Banheiro',codigo_modulo:'M01',profundidade:0.45})];
 anexarComplementos(items,[{codigo_modulo:'M01',ambiente:'Sala',largura:1.5,altura:2,profundidade:0.45}],2);
 assert.deepEqual(items[0].divergencias_cotas,[]);assert.equal(decomporPeca(items[0]).status,'ok');
});
test('aviso genérico da revisão anterior não bloqueia dados já salvos; conflito real permanece',()=>{
 const aviso='Vista complementar recebida; conferir detalhes construtivos antes de calcular.';
 const item=p({nome:'Armário',categoria:'Armário/Guarda-roupa',divergencias_cotas:[aviso]});
 assert.equal(decomporPeca(item).status,'ok');
 assert.equal(decomporPeca({...item,divergencias_cotas:[aviso,'Altura 2000 versus 2100']} ).status,'manual');
});
test('cota de uma parte não é comparada com a dimensão total do módulo',()=>{
 const items=[p({codigo_modulo:'M01'})];anexarComplementos(items,[{codigo_modulo:'M01',ambiente:'Sala',referencia_dimensoes:'PARTE',largura:0.5,altura:0.4,recortes:[{descricao:'rasgo da gaveta'}]}],3);
 assert.deepEqual(items[0].divergencias_cotas,[]);assert.equal(items[0].recortes,undefined);assert.equal(items[0].vistas_complementares.length,1);
});
