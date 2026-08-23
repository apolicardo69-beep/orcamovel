import { useMemo, useState } from 'react';
import {
  METHOD_REGISTRY, BASE_MATERIALS, HARDWARE_CATALOG,
  calculateSinkCabinet, calculateAereo, calculateWardrobe,
  calculateDrawer, calculatePanelFixingRails, calculateTamborado,
  calculateCentralTamponadedBox, calculateTower, validateForProduction,
  groupPiecesForCut, loadCustomLibrary, addLibraryItem
} from '../engine/construction/index.js';

const presets = {
  gabinete: () => calculateSinkCabinet({width_mm:1200,height_mm:700,stone_depth_mm:600,front_recess_mm:30,body_thickness_mm:15,left_finish:{type:'PANEL_SIMPLE'},right_finish:{type:'PANEL_SIMPLE'},bottom_finish:{type:'PANEL_SIMPLE'}}),
  aereo: () => calculateAereo({box_width_mm:800,box_height_mm:700,box_depth_mm:350,body_thickness_mm:15,left_tamponamento:{thickness_mm:15},right_tamponamento:{thickness_mm:15}}),
  aereo2: () => calculateAereo({box_width_mm:1600,box_height_mm:700,box_depth_mm:350,body_thickness_mm:15,bays:2}),
  guardaGiro: () => calculateWardrobe({width_mm:1600,height_mm:2400,box_depth_mm:550,body_thickness_mm:15,door_type:'GIRO',internal_post_qty:1,shelf_qty:2}),
  guardaCorrer: () => calculateWardrobe({width_mm:1600,height_mm:2400,box_depth_mm:550,body_thickness_mm:15,door_type:'CORRER',tamponamento_height_mm:2400,door_opening_height_mm:2230,door_opening_width_mm:1600,door_qty:2}),
  torre: () => calculateTower({internal_width_mm:700,depth_mm:600,body_thickness_mm:15,zones:[{type:'SUPERIOR',height_mm:400},{type:'MICROONDAS',height_mm:400},{type:'FORNO',height_mm:600},{type:'INFERIOR',height_mm:700}]}),
  torrePendente: () => calculateTower({internal_width_mm:700,depth_mm:600,zones:[{type:'FORNO'},{type:'INFERIOR',height_mm:700}]}),
  gaveta: () => calculateDrawer({opening_width_mm:500,depth_mm:500,side_height_mm:133,body_thickness_mm:15}),
  painel: () => calculatePanelFixingRails({width_mm:1800,height_mm:2700}),
  painelRipado: () => calculatePanelFixingRails({width_mm:1800,height_mm:2700,ripado:true,ripa_width_mm:50,ripa_gap_mm:20}),
  painelRipadoPendente: () => calculatePanelFixingRails({width_mm:1800,height_mm:2700,ripado:true}),
  tamborado: () => calculateTamborado({length_mm:1000,width_mm:300}),
  criado: () => calculateCentralTamponadedBox({box_width_mm:600,box_depth_mm:450,height_mm:500,thickness_mm:15,left_finish_mm:15,right_finish_mm:15}),
};

const card={background:'#17110b',border:'1px solid #2a1d11',borderRadius:12,padding:16};
const input={background:'#0f0c08',border:'1px solid #3a2a1a',color:'#eee0c8',borderRadius:7,padding:'9px 10px',width:'100%',boxSizing:'border-box'};
const button={background:'#c8892a',color:'#160f08',border:0,borderRadius:8,padding:'10px 14px',fontWeight:700,cursor:'pointer'};

export default function BancoConstrutivoView(){
  const [scenario,setScenario]=useState('gabinete');
  const [result,setResult]=useState(()=>presets.gabinete());
  const [library,setLibrary]=useState(()=>loadCustomLibrary());
  const [material,setMaterial]=useState({nome:'',espessura_mm:'',chapa_comprimento_mm:'2750',chapa_largura_mm:'1830'});
  const [hardware,setHardware]=useState({nome:'',categoria:'ESPECIAL',especificacoes:''});
  const validation=useMemo(()=>validateForProduction(result),[result]);
  const grupos=useMemo(()=>groupPiecesForCut(result.pieces||[]),[result]);
  const run=()=>{ try{setResult(presets[scenario]())}catch(e){setResult({status:'ERRO_PRODUCAO',error:e.message,pieces:[]})} };
  const addMaterial=()=>{
    if(!material.nome || !Number(material.espessura_mm)) return;
    addLibraryItem('materials',{...material,espessura_mm:Number(material.espessura_mm),chapa:{comprimento_mm:Number(material.chapa_comprimento_mm),largura_mm:Number(material.chapa_largura_mm)}});
    setLibrary(loadCustomLibrary()); setMaterial({...material,nome:'',espessura_mm:''});
  };
  const addHardware=()=>{
    if(!hardware.nome) return;
    addLibraryItem('hardware',{...hardware,status:'REVISAO_MANUAL'}); setLibrary(loadCustomLibrary()); setHardware({...hardware,nome:'',especificacoes:''});
  };
  return <div style={{paddingBottom:30}}>
    <div style={{marginBottom:18}}><div style={{fontSize:26,fontFamily:"'Playfair Display'"}}>🧱 Banco Construtivo — Laboratório V1</div><div style={{color:'#8f7659',fontSize:13,marginTop:5}}>Ambiente de teste. Métodos seguem em validação; itens manuais ou ferragens não validadas bloqueiam a liberação automática.</div></div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:12,marginBottom:14}}>
      <div style={card}><b>Métodos cadastrados</b><div style={{fontSize:30,color:'#c8892a',marginTop:8}}>{METHOD_REGISTRY.length}</div><div style={{fontSize:12,color:'#8f7659'}}>Cozinha, banheiro/lavanderia, dormitório/closet, painéis e universais.</div></div>
      <div style={card}><b>Materiais base</b><div style={{fontSize:30,color:'#c8892a',marginTop:8}}>{BASE_MATERIALS.length + library.materials.length}</div><div style={{fontSize:12,color:'#8f7659'}}>{library.materials.length} personalizados.</div></div>
      <div style={card}><b>Ferragens</b><div style={{fontSize:30,color:'#c8892a',marginTop:8}}>{HARDWARE_CATALOG.length + library.hardware.length}</div><div style={{fontSize:12,color:'#8f7659'}}>{library.hardware.length} personalizadas.</div></div>
    </div>

    <div style={{...card,marginBottom:14}}><h3 style={{marginTop:0}}>Teste rápido de regras</h3><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <select value={scenario} onChange={e=>setScenario(e.target.value)} style={{...input,maxWidth:360}}>
        <option value="gabinete">Gabinete pia 1200×700 / pedra 600</option><option value="aereo">Aéreo 1 vão com fundo 6 mm</option><option value="aereo2">Aéreo 1600 com 2 vãos (divisória)</option><option value="guardaGiro">Guarda-roupa de giro (caixa completa)</option><option value="guardaCorrer">Guarda-roupa de correr</option><option value="torre">Torre quente com zonas medidas</option><option value="torrePendente">Torre quente com forno sem medida</option><option value="gaveta">Gaveta telescópica</option><option value="painel">Painel liso + réguas</option><option value="painelRipado">Painel ripado 50/20</option><option value="painelRipadoPendente">Painel ripado sem medida da ripa</option><option value="tamborado">Tamborado 6+15+6</option><option value="criado">Caixa central tamponada</option>
      </select><button onClick={run} style={button}>Executar teste</button></div>
      <div style={{marginTop:12,fontSize:13}}>Status: <b style={{color:validation.liberado?'#79b77a':'#dc8a58'}}>{result.status}</b> · Produção automática: <b>{validation.liberado?'LIBERADA PELO VALIDADOR':'BLOQUEADA / REVISAR'}</b></div>
      {grupos.length>0 && <div style={{marginTop:10,fontSize:12,color:'#a89070'}}>
        <b style={{color:'#c8892a'}}>Chapas necessárias:</b> {grupos.map(g=>`${g.key.split('|')[0]} (${g.pieces.reduce((a,p)=>a+p.quantidade,0)} peças)`).join(' · ')}
      </div>}
      {(result.issues||[]).length>0 && <div style={{marginTop:10,fontSize:12,color:'#dc8a58'}}>
        {result.issues.map((i,k)=><div key={k}>⚠️ {i.message||i.code}</div>)}
      </div>}
      <pre style={{marginTop:12,maxHeight:360,overflow:'auto',background:'#0b0805',padding:12,borderRadius:8,fontSize:11,color:'#d8c4aa'}}>{JSON.stringify(result,null,2)}</pre>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:12}}>
      <div style={card}><h3 style={{marginTop:0}}>+ Cadastrar chapa/material</h3>
        <input style={input} placeholder="Nome / padrão da chapa" value={material.nome} onChange={e=>setMaterial({...material,nome:e.target.value})}/><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:8}}><input style={input} placeholder="Espessura mm" value={material.espessura_mm} onChange={e=>setMaterial({...material,espessura_mm:e.target.value})}/><input style={input} placeholder="Comprimento chapa" value={material.chapa_comprimento_mm} onChange={e=>setMaterial({...material,chapa_comprimento_mm:e.target.value})}/><input style={input} placeholder="Largura chapa" value={material.chapa_largura_mm} onChange={e=>setMaterial({...material,chapa_largura_mm:e.target.value})}/></div><button style={{...button,marginTop:10}} onClick={addMaterial}>Salvar material</button>
      </div>
      <div style={card}><h3 style={{marginTop:0}}>+ Cadastrar ferragem especial</h3>
        <input style={input} placeholder="Nome da ferragem" value={hardware.nome} onChange={e=>setHardware({...hardware,nome:e.target.value})}/><textarea style={{...input,marginTop:8,minHeight:90}} placeholder="Especificações, folgas, montagem, modelo..." value={hardware.especificacoes} onChange={e=>setHardware({...hardware,especificacoes:e.target.value})}/><button style={{...button,marginTop:10}} onClick={addHardware}>Salvar ferragem</button><div style={{fontSize:11,color:'#8f7659',marginTop:8}}>Ferragem especial entra como REVISÃO MANUAL até ser tecnicamente validada.</div>
      </div>
    </div>
  </div>
}
