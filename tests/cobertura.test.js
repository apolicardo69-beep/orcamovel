import test from 'node:test';
import assert from 'node:assert/strict';
import {possiveisDuplicatas,coberturaDoCorte} from '../src/engine/interpretacao.js';
import {decomporPeca,explodirPecasConstrutivas} from '../src/engine/metodosConstrutivos.js';
import {normalizarPecasParaCorte,otimizarCorte} from '../src/engine/otimizador.js';
const item=(over)=>({_id:'a',nome:'Armário',categoria:'Armário/Guarda-roupa',tipo:'m²',largura:0.8,altura:0.7,profundidade:0.5,quantidade:1,ambiente:'Sala',...over});
test('códigos M321 e M322 não são possíveis duplicatas por terem as mesmas medidas',()=>{
 assert.equal(possiveisDuplicatas([item({nome:'Armário M321'}),item({_id:'b',nome:'Armário M322'})]).length,0);
});
test('home e prateleira de um metro linear não são duplicatas',()=>{
 assert.equal(possiveisDuplicatas([item({nome:'Home',tipo:'ml'}),item({_id:'b',nome:'Prateleira',tipo:'ml'})]).length,0);
});
test('mesmo módulo e mesmo ambiente continua sendo candidato, sem remoção',()=>{
 const list=[item({codigo_modulo:'M01'}),item({_id:'b',codigo_modulo:'M01',nome:'Vista interna'})];assert.equal(possiveisDuplicatas(list).length,1);assert.equal(list.length,2);
});
test('itens un e ml com dimensões completas geram simulação',()=>{
 for(const tipo of ['un','unidade','ml'])assert.equal(decomporPeca(item({tipo})).status,'ok');
 const r=decomporPeca(item({tipo:'ml',quantidade:2.5}));
 assert.equal(r.paineis.find(p=>p.nome.includes('Tampo')).quantidade,1);
});
test('cobertura não apresenta o subconjunto como projeto completo',()=>{
 const list=[item(),item({_id:'b',nome:'Painel com frisos',categoria:'Painel'}),item({_id:'c',nome:'Painel liso',categoria:'Painel',largura:4,altura:4}),item({_id:'d',nome:'Espelho'})];
 const ex=explodirPecasConstrutivas(list),ps=normalizarPecasParaCorte(ex.paraCorte),r=otimizarCorte(ps);
 const c=coberturaDoCorte(list,ex,ps,r);
 assert.equal(c.total,3);assert.equal(c.simulados,1);assert.equal(c.pendentes,2);assert.equal(c.completa,false);
 assert.deepEqual(c.rows.map(x=>x.status),['SIMULADO','PENDENTE','PARCIAL','FORA_MDF']);
});
test('sem resultado não há itens completamente simulados',()=>{
 const list=[item()],ex=explodirPecasConstrutivas(list),ps=normalizarPecasParaCorte(ex.paraCorte);
 assert.equal(coberturaDoCorte(list,ex,ps,null).simulados,0);
});
