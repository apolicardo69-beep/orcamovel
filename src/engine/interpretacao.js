const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
export function identificarConstrucao(p){
 const text=norm(`${p.nome||''} ${p.observacao||''}`);
 const detected=/^painel\b/.test(norm(p.nome)) || (!/armario|guarda.?roupa|rack|buffet|cristaleira/.test(norm(p.nome)) && /painel/.test(text));
 const explicit=p.tipo_construtivo;
 const valid=['PAINEL_LISO','PAINEL_FRISADO','PAINEL_RIPADO','PAINEL_COM_PORTA','CORPO'];
 const tipo=valid.includes(explicit)?explicit:detected ? (/porta.*embutid/.test(text)?'PAINEL_COM_PORTA':/ripad/.test(text)?'PAINEL_RIPADO':/fris/.test(text)?'PAINEL_FRISADO':'PAINEL_LISO'):'CORPO';
 const pendencias=[];
 if((Array.isArray(p.recortes) && p.recortes.length) || /recorte|encaixe.*janela|abertura.*janela/.test(text)) pendencias.push('Recorte identificado: conferir geometria e decomposição das peças antes do corte.');
 if(divergenciasReais(p).length) pendencias.push('Há cotas divergentes entre vistas: '+divergenciasReais(p).join('; '));
 if(tipo==='PAINEL_COM_PORTA') pendencias.push('Separar porta embutida, partes fixas e estrutura. Método ainda não cadastrado.');
 if(tipo==='PAINEL_FRISADO') pendencias.push(p.execucao_friso==='NEGATIVO'?'Negativo entre placas: informar dimensões de cada placa e montagem.':p.execucao_friso==='USINADO'?'Friso usinado: cadastrar posições, largura e profundidade dos sulcos.':'Definir se o friso é usinado ou negativo entre placas.');
 return {tipo,pendencias};
}
export function chaveModulo(p){
 if(!p.codigo_modulo || !p.ambiente) return null;
 return JSON.stringify([norm(p.ambiente),norm(p.codigo_modulo)]);
}
export function modulosRepetidos(pieces){
 const groups=new Map();
 for(const p of pieces){const key=chaveModulo(p);if(key)groups.set(key,[...(groups.get(key)||[]),p]);}
 return [...groups.values()].filter(g=>g.length>1);
}
export function agruparNaoPosicionadas(items=[]){
 const groups=new Map();
 for(const n of items){
  const p=n.peca;
  const key=JSON.stringify([p.id,p.nome,p.largura_mm,p.comprimento_mm,p.espessura_mm,p.material_id]);
  if(!groups.has(key)) groups.set(key,{...n,quantidade:0});
  groups.get(key).quantidade++;
 }
 return [...groups.values()];
}
export const formatarMm=v=>Number(v).toLocaleString('pt-BR',{maximumFractionDigits:2});

// Complementos são evidências de outra vista, nunca novas linhas de orçamento.
export function anexarComplementos(pieces,complementos,pagina,pendentes=[]){
 for(const c of Array.isArray(complementos)?complementos:[]){
  if(!c || typeof c!=='object')continue;
  const key=chaveModulo(c);if(!key){pendentes.push({...c,pagina,motivo:"Código ou ambiente ausente."});continue;}
  const matches=pieces.filter(p=>chaveModulo(p)===key);if(matches.length!==1){pendentes.push({...c,pagina,motivo:"Nenhum módulo único corresponde ao código e ambiente."});continue;}
  const p=matches[0];
  p.vistas_complementares=[...(p.vistas_complementares||[]),{...c,pagina}];
  for(const dim of c.referencia_dimensoes==='PARTE'?[]:['largura','altura','profundidade']){
   if(Number(c[dim])>0 && Number(p[dim])>0 && Math.abs(Number(c[dim])-Number(p[dim]))>0.0001){
    p.divergencias_cotas=[...new Set([...(p.divergencias_cotas||[]),`${dim}: ${p[dim]} m versus ${c[dim]} m na página ${pagina}`])];
   }
  }
  if(c.referencia_dimensoes!=='PARTE' && Array.isArray(c.recortes) && c.recortes.length)p.recortes=[...(p.recortes||[]),...c.recortes];
  p.divergencias_cotas=divergenciasReais(p);
  if(c.tipo_construtivo && c.tipo_construtivo!==identificarConstrucao(p).tipo){
    p.divergencias_cotas.push(`Construção indicada na página ${pagina}: ${c.tipo_construtivo}. Conferir com o módulo atual.`);
  }
  if(Array.isArray(c.divergencias_cotas))p.divergencias_cotas=[...new Set([...p.divergencias_cotas,...c.divergencias_cotas.map(String)])];
 }
 return pieces;
}

export const AVISO_COMPLEMENTO_LEGADO='Vista complementar recebida; conferir detalhes construtivos antes de calcular.';
export function divergenciasReais(p){
 return (Array.isArray(p.divergencias_cotas)?p.divergencias_cotas:[]).filter(v=>v!==AVISO_COMPLEMENTO_LEGADO);
}
export function codigoDoModulo(p){
 return norm(p.codigo_modulo || String(p.nome||'').match(/\bM\d{2,4}\b/i)?.[0]);
}
export function possiveisDuplicatas(pieces){
 const pares=[];
 for(let i=0;i<pieces.length;i++)for(let j=i+1;j<pieces.length;j++){
  const a=pieces[i],b=pieces[j];
  if(!norm(a.ambiente) || norm(a.ambiente)!==norm(b.ambiente) || a.tipo!==b.tipo)continue;
  const ca=codigoDoModulo(a),cb=codigoDoModulo(b);
  if(ca&&cb){if(ca===cb)pares.push([a,b]);continue;}
  // Sem identidade: mesma quantidade ou área não identifica o mesmo móvel.
  if(norm(a.nome)!==norm(b.nome) || !norm(a.nome))continue;
  if(identificarConstrucao(a).tipo!==identificarConstrucao(b).tipo)continue;
  const perto=(x,y)=>Number(x)>0&&Number(y)>0&&Math.abs(Number(x)-Number(y))<=0.002;
  if(perto(a.largura,b.largura)&&perto(a.altura,b.altura))pares.push([a,b]);
 }
 return pares;
}
export function coberturaDoCorte(pieces,explodir,pecas,resultado,complementos=[]){
 const rows=(pieces||[]).map(p=>{
  const id=p._id??p.id;
  const manual=explodir.manuais.find(m=>m.pecaId===id);
  const fora=explodir.excluidos.find(m=>m.pecaId===id);
  const paineis=(pecas||[]).filter(x=>x._origem?._origemPecaId===id);
  const nao=(resultado?.pecas_nao_posicionadas||[]).filter(x=>x.peca._origem?._origemPecaId===id).length;
  const qtd=paineis.reduce((n,x)=>n+x.quantidade,0);
  const status=fora?'FORA_MDF':manual?'PENDENTE':!qtd?'SEM_PECAS':!resultado?'SEM_PLANO':nao?'PARCIAL':'SIMULADO';
  return {id,nome:p.nome,ambiente:p.ambiente||'Sem ambiente',codigo:p.codigo_modulo||'',status,geradas:qtd,posicionadas:resultado?qtd-nao:0,motivo:fora?.motivo||manual?.motivo||(!qtd?'Nenhuma peça gerada.':nao?'Peças não couberam na chapa.':'')};
 });
 const total=rows.filter(r=>r.status!=='FORA_MDF').length;
 const simulados=rows.filter(r=>r.status==='SIMULADO').length;
 return {rows,total,simulados,pendentes:total-simulados,completa:total>0&&simulados===total&&complementos.length===0};
}
