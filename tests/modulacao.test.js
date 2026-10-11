import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decomporPeca, explodirPecasConstrutivas, DEFAULT_METODOS_CONSTRUTIVOS,
  inferirCategoriaPorNome, detectarMaterialNaoMadeira, aplicarPadroesCategoria,
  dividirEmChapa,
} from '../src/engine/metodosConstrutivos.js';
import { normalizarPecasParaCorte, otimizarCorte, CONFIG_PADRAO_CORTE } from '../src/engine/otimizador.js';

const CHAPA = { util_largura_m: 2.73, util_altura_m: 1.81 };

const peca = (o) => ({ _id: 'x', quantidade: 1, observacao: '', tipo: 'm²', ...o });
const painelDe = (r, re) => r.paineis.find((p) => re.test(p.nome));
const total = (r) => r.paineis.reduce((a, p) => a + p.quantidade, 0);

// ---------------------------------------------------------------
// MODULAÇÃO — a causa principal da contagem de peças baixa
// ---------------------------------------------------------------

test('móvel largo vira vários módulos, não uma caixa única', () => {
  const r = decomporPeca(peca({ nome: 'Guarda-roupa', largura: 3.63, altura: 2.70 }), DEFAULT_METODOS_CONSTRUTIVOS);
  // 3,63 / 0,90 -> 5 módulos, 6 laterais (compartilhadas entre módulos)
  assert.equal(r.modulacao.modulos, 5);
  assert.equal(r.modulacao.laterais, 6);
  assert.equal(painelDe(r, /Lateral/).quantidade, 6);
  assert.equal(painelDe(r, /Tampo/).quantidade, 5);
  assert.equal(painelDe(r, /Base/).quantidade, 5);
  // o fundo é por módulo, na largura do módulo — não um fundo de 3,63 m
  assert.equal(painelDe(r, /Fundo \(/).largura_m, 0.726);
  assert.equal(painelDe(r, /Fundo \(/).quantidade, 5);
});

test('módulo estreito continua com 2 laterais e 1 tampo', () => {
  const r = decomporPeca(peca({ nome: 'Armário', largura: 0.9, altura: 1.9 }), DEFAULT_METODOS_CONSTRUTIVOS);
  assert.equal(r.modulacao.modulos, 1);
  assert.equal(painelDe(r, /Lateral/).quantidade, 2);
  assert.equal(painelDe(r, /Tampo/).quantidade, 1);
});

test('a largura máxima do módulo é configurável', () => {
  const cfg = JSON.parse(JSON.stringify(DEFAULT_METODOS_CONSTRUTIVOS));
  cfg['Armário/Guarda-roupa'].modulo_largura_max_m = 2.0;
  const r = decomporPeca(peca({ nome: 'Guarda-roupa', largura: 3.63, altura: 2.70 }), cfg);
  assert.equal(r.modulacao.modulos, 2);
  assert.equal(r.modulacao.largura_modulo_m, 1.815);
  assert.equal(painelDe(r, /Lateral/).quantidade, 3);
});

test('prateleiras acompanham a altura do módulo', () => {
  const baixo = decomporPeca(peca({ nome: 'Armário', largura: 0.9, altura: 0.9 }), DEFAULT_METODOS_CONSTRUTIVOS);
  const alto = decomporPeca(peca({ nome: 'Armário', largura: 0.9, altura: 2.7 }), DEFAULT_METODOS_CONSTRUTIVOS);
  assert.ok(painelDe(alto, /Prateleira/).quantidade > painelDe(baixo, /Prateleira/).quantidade);
  // 2,70 / 0,45 - 1 = 5 prateleiras
  assert.equal(painelDe(alto, /Prateleira/).quantidade, 5);
});

// ---------------------------------------------------------------
// PORTAS — são peça de corte, mesmo não entrando no preço
// ---------------------------------------------------------------

test('portas de giro entram na lista de corte, uma por vão', () => {
  const r = decomporPeca(peca({ nome: 'Armário', largura: 0.9, altura: 1.9 }), DEFAULT_METODOS_CONSTRUTIVOS);
  const porta = painelDe(r, /Porta de giro/);
  // 0,90 de módulo / 0,50 máx por porta = 2 portas
  assert.equal(porta.quantidade, 2);
  // a porta cobre a caixa, não o rodapé: 1,90 - 0,10 - folga
  assert.equal(porta.altura_m, 1.797);
});

test('porta de correr usa a sobreposição e o desconto do trilho', () => {
  const r = decomporPeca(peca({ nome: 'Guarda-roupa com portas de correr', largura: 3.81, altura: 2.70 }), DEFAULT_METODOS_CONSTRUTIVOS);
  const porta = painelDe(r, /Porta de correr/);
  assert.equal(porta.quantidade, 4);
  // (3,81 + 0,02 x 3) / 4
  assert.equal(porta.largura_m, 0.9675);
  assert.equal(painelDe(r, /Porta de giro/), undefined);
});

test('desligar "cortar portas" tira as portas do plano', () => {
  const cfg = JSON.parse(JSON.stringify(DEFAULT_METODOS_CONSTRUTIVOS));
  cfg['Armário/Guarda-roupa'].gerar_portas = false;
  const r = decomporPeca(peca({ nome: 'Armário', largura: 0.9, altura: 1.9 }), cfg);
  assert.equal(painelDe(r, /Porta/), undefined);
});

// ---------------------------------------------------------------
// GAVETA x PRATELEIRA — ocupam o mesmo espaço vertical
// ---------------------------------------------------------------

test('gaveteiro desconta prateleira no mesmo módulo', () => {
  const sem = decomporPeca(peca({ nome: 'Guarda-roupa com prateleiras', largura: 3.63, altura: 2.70 }), DEFAULT_METODOS_CONSTRUTIVOS);
  const com = decomporPeca(peca({ nome: 'Guarda-roupa com prateleiras e gavetas', largura: 3.63, altura: 2.70 }), DEFAULT_METODOS_CONSTRUTIVOS);
  assert.equal(painelDe(sem, /Prateleira/).quantidade, 25); // 5 por módulo
  assert.equal(painelDe(com, /Prateleira/).quantidade, 20); // 4 por módulo (3 gavetas comem 1)
});

test('a caixa da gaveta tem lateral, frente interna, contrafrente e fundo', () => {
  const r = decomporPeca(peca({ nome: 'Móvel com 4 gavetas', largura: 0.9, altura: 0.9 }), DEFAULT_METODOS_CONSTRUTIVOS);
  assert.equal(painelDe(r, /Lateral da gaveta/).quantidade, 8);
  assert.equal(painelDe(r, /Frente interna/).quantidade, 4);
  assert.equal(painelDe(r, /Contrafrente/).quantidade, 4);
  assert.equal(painelDe(r, /Fundo da gaveta/).quantidade, 4);
  assert.equal(painelDe(r, /Frente externa/).quantidade, 4);
});

// ---------------------------------------------------------------
// ITENS QUE ANTES SAÍAM DO PLANO DE CORTE
// ---------------------------------------------------------------

test('item por metro linear gera módulos em vez de virar alerta manual', () => {
  const r = decomporPeca(peca({ nome: 'Gabinete de pia', tipo: 'ml', largura: 0, altura: 0, quantidade: 2 }), DEFAULT_METODOS_CONSTRUTIVOS);
  assert.equal(r.status, 'ok');
  assert.ok(total(r) > 10);
  assert.match(r.aviso, /metro linear/);
});

test('painel ripado gera as ripas em vez de virar alerta manual', () => {
  const r = decomporPeca(peca({ nome: 'Painel ripado', largura: 1.54, altura: 4.58, ripa_largura_mm:50,ripa_espacamento_mm:20,ripa_espessura_mm:15,ripado_tem_base:true,base_espessura_mm:15 }), DEFAULT_METODOS_CONSTRUTIVOS);
  assert.equal(r.status, 'ok');
  // passo 0,07 -> (1,54 + 0,02) / 0,07 = 22 ripas
  assert.equal(painelDe(r, /Ripa/).quantidade, 22);
  assert.ok(painelDe(r, /Base do painel/));
});

test('nomes comuns de marcenaria são reconhecidos', () => {
  assert.equal(inferirCategoriaPorNome('Movel com gavetas'), 'TV/Sala');
  assert.equal(inferirCategoriaPorNome('Gaveteiro com puxador'), 'TV/Sala');
  assert.equal(inferirCategoriaPorNome('Mesa em L com gaveteiro'), 'TV/Sala');
  assert.equal(inferirCategoriaPorNome('Torre quente para forno'), 'Cozinha');
  assert.equal(inferirCategoriaPorNome('Gabinete de pia'), 'Cozinha');
});

test('vidro como complemento não apaga o móvel inteiro do corte', () => {
  // "Espelho" É a peça -> fora do corte em MDF
  assert.equal(detectarMaterialNaoMadeira({ nome: 'Espelho' }), true);
  // corpo em MDF com porta de vidro -> continua no corte
  assert.equal(detectarMaterialNaoMadeira({ nome: 'Cristaleira com portas de vidro' }), false);
  assert.equal(detectarMaterialNaoMadeira({ nome: 'Painel ripado com espelho' }), false);

  const r = explodirPecasConstrutivas([peca({ nome: 'Cristaleira com portas de vidro', largura: 0.94, altura: 2.10 })], DEFAULT_METODOS_CONSTRUTIVOS);
  assert.equal(r.excluidos.length, 0);
  assert.ok(r.paraCorte.length > 0);
  assert.match(r.avisos[0].aviso, /vidro/);
});

test('configuração antiga salva no navegador recebe os campos novos', () => {
  const antiga = { estrategia: 'corpo', espessura_mm: 15, prateleiras_qtd: 2, profundidade_padrao_m: 0.56 };
  const c = aplicarPadroesCategoria(antiga);
  assert.equal(c.modulo_largura_max_m, 0.9);
  assert.equal(c.gerar_portas, true);
  assert.equal(c.prateleira_passo_m, 0.45);
  // e a decomposição funciona com ela
  const r = decomporPeca(peca({ nome: 'Armário', categoria: 'X', largura: 3.63, altura: 2.7 }), { X: antiga });
  assert.equal(r.modulacao.modulos, 5);
});

// ---------------------------------------------------------------
// PAINEL MAIOR QUE A CHAPA — antes era descartado do plano
// ---------------------------------------------------------------

test('peça que cabe na chapa não é dividida', () => {
  assert.equal(dividirEmChapa(2.7, 1.8, CHAPA), null);
  // cabe girando: 1,80 x 2,70
  assert.equal(dividirEmChapa(1.8, 2.7, CHAPA), null);
});

test('painel de parede maior que a chapa é dividido em partes emendadas', () => {
  const d = dividirEmChapa(2.87, 2.80, CHAPA);
  // 2 partes não bastam: 1,435 x 2,80 ainda estoura os 2,73 úteis da chapa.
  assert.equal(d.partes, 4);
  assert.equal(d.largura_m, 1.435);
  assert.equal(d.altura_m, 1.40);
  const cabe = (a, b) => (a <= CHAPA.util_largura_m && b <= CHAPA.util_altura_m) || (a <= CHAPA.util_altura_m && b <= CHAPA.util_largura_m);
  assert.ok(cabe(d.largura_m, d.altura_m), 'cada parte tem de caber na chapa');
});

test('peças grandes permanecem inteiras e são reportadas sem emenda automática', () => {
  const itens = [
    { nome: 'Painel MDF Areia Guararapes', tipo: 'm²', largura: 2.25, altura: 4.59 },
    { nome: 'Painel de parede liso', tipo: 'm²', largura: 2.87, altura: 2.80 },
    { nome: 'Guarda-roupa com portas de correr', tipo: 'm²', largura: 3.81, altura: 2.70 },
    { nome: 'Armário com prateleiras, cabideiro e gavetas', tipo: 'm²', largura: 0.60, altura: 2.70 },
  ].map((o, i) => ({ _id: 'p' + i, quantidade: 1, observacao: '', ...o }));

  const ex = explodirPecasConstrutivas(itens, DEFAULT_METODOS_CONSTRUTIVOS, CHAPA);
  assert.equal(ex.manuais.length, 0);
  assert.ok(ex.emendas.length >= 2);

  const res = otimizarCorte(normalizarPecasParaCorte(ex.paraCorte), CONFIG_PADRAO_CORTE);
  assert.equal(res.pecas_nao_posicionadas.length, 2, 'peças grandes devem exigir revisão');
  assert.equal(res.total_pecas_posicionadas + res.pecas_nao_posicionadas.length, ex.paraCorte.reduce((n,p)=>n+p.quantidade,0));
  assert.ok(ex.paraCorte.every(p=>!p.nome.includes('parte emendada')));
  assert.ok(res.total_chapas > 0);
});
