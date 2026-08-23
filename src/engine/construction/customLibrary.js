const KEY='orcamovel_construction_library_v1';
const EMPTY={materials:[],hardware:[],sheets:[],edgeBands:[],specialRules:[]};
const copy=(v)=>JSON.parse(JSON.stringify(v));
export function loadCustomLibrary(){
  if(typeof localStorage==='undefined') return copy(EMPTY);
  try { return {...copy(EMPTY),...(JSON.parse(localStorage.getItem(KEY)||'{}'))}; } catch { return copy(EMPTY); }
}
export function saveCustomLibrary(lib){ if(typeof localStorage!=='undefined') localStorage.setItem(KEY,JSON.stringify(lib)); return lib; }
export function addLibraryItem(section,item){
  const allowed=Object.keys(EMPTY); if(!allowed.includes(section)) throw new Error('Seção inválida.');
  const lib=loadCustomLibrary(); const record={id:item.id||`${section}_${Date.now()}`,created_at:new Date().toISOString(),...item};
  lib[section]=[...lib[section],record]; saveCustomLibrary(lib); return record;
}
export function resetCustomLibrary(){ if(typeof localStorage!=='undefined') localStorage.removeItem(KEY); return copy(EMPTY); }
