import {identificarConstrucao} from '../engine/interpretacao.js';
const field={background:'#17110b',color:'#eee0c8',border:'1px solid #6e5030',borderRadius:5,padding:7,width:'100%',boxSizing:'border-box'};
export default function RevisaoConstrutiva({pieces,onUpdate}){
 if(!onUpdate || !pieces.length)return null;
 return <details style={{border:'1px solid #6e5030',padding:14,borderRadius:10,marginBottom:16}}>
 <summary style={{cursor:'pointer',fontWeight:700}}>Conferir módulos e parâmetros de construção ({pieces.length})</summary>
 <p>Estes parâmetros são usados na simulação do corte. Salve o orçamento para conservar as alterações.</p>
 {pieces.map(p=>{const r=identificarConstrucao(p);const set=(k,v)=>onUpdate(p._id,k,v);return <details key={p._id} style={{padding:10,borderTop:'1px solid #6e5030'}}>
 <summary>{p.ambiente||'Sem ambiente'} · {p.codigo_modulo||'Sem código'} · {p.nome} · {r.tipo}</summary>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10,marginTop:10}}>
 {['largura','altura','profundidade'].map(k=><label key={k}>{{largura:'Largura total (m)',altura:'Altura total (m)',profundidade:'Profundidade informada (m)'}[k]}<input style={field} type="number" min="0" step="0.001" value={p[k]??''} onChange={e=>set(k,e.target.value===''?0:Number(e.target.value))}/></label>)}
 <label>Código no desenho<input style={field} value={p.codigo_modulo||''} onChange={e=>set('codigo_modulo',e.target.value)}/></label>
 <label>Construção<select style={field} value={r.tipo} onChange={e=>set('tipo_construtivo',e.target.value)}>
 <option value="PAINEL_LISO">Painel liso</option><option value="PAINEL_FRISADO">Painel com frisos</option><option value="PAINEL_RIPADO">Painel ripado</option><option value="PAINEL_COM_PORTA">Painel com porta embutida</option><option value="CORPO">Corpo de móvel</option>
 </select></label>
 {r.tipo==='PAINEL_FRISADO' && <label>Execução dos frisos<select style={field} value={p.execucao_friso||''} onChange={e=>set('execucao_friso',e.target.value)}><option value="">A definir</option><option value="USINADO">Usinado na chapa</option><option value="NEGATIVO">Negativo entre placas</option></select></label>}
 {r.tipo==='PAINEL_RIPADO' && <>
 {[['ripa_largura_mm','Largura da ripa (mm)'],['ripa_espacamento_mm','Espaçamento (mm)'],['ripa_espessura_mm','Espessura da ripa (mm)']].map(([k,label])=><label key={k}>{label}<input style={field} type="number" min="0" step="0.1" value={p[k]??''} onChange={e=>set(k,e.target.value===''?null:Number(e.target.value))}/></label>)}
 <label>Existe placa de base?<select style={field} value={p.ripado_tem_base==null?'':String(p.ripado_tem_base)} onChange={e=>set('ripado_tem_base',e.target.value===''?null:e.target.value==='true')}><option value="">A definir</option><option value="true">Sim</option><option value="false">Não</option></select></label>
 {p.ripado_tem_base && <label>Espessura da base (mm)<input style={field} type="number" min="0" step="0.1" value={p.base_espessura_mm??''} onChange={e=>set('base_espessura_mm',e.target.value===''?null:Number(e.target.value))}/></label>}
 </>}
 </div>
 {r.pendencias.map(m=><p key={m} style={{color:'#e9a26d'}}>{m}</p>)}
 {p.recortes?.length>0 && <pre style={{whiteSpace:'pre-wrap'}}>Recortes: {JSON.stringify(p.recortes,null,2)}</pre>}
 {p.vistas_complementares?.length>0 && <details><summary>Informações de outras vistas</summary><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(p.vistas_complementares,null,2)}</pre></details>}
 <small>Página de origem: {p._pagina||'manual'} · Dimensões do orçamento: {p.largura} × {p.altura} m. Peças com recortes, frisos ou portas embutidas aguardam o método específico de fabricação.</small>
 </details>})}
 </details>;
}
