"use client";
import { useState } from "react";
import { areas, type Area } from "@/domain/classification";
import type { Preferences } from "@/domain/preferences";
export default function PersonalSettings({preferences,onSave}:{preferences:Preferences;onSave:(p:Preferences)=>Promise<void>}){
  const [goal,setGoal]=useState(preferences.goalPercentage?.toString()??""),[areaGoals,setAreaGoals]=useState(preferences.areaGoals),[name,setName]=useState(preferences.course?.name??"");
  const [weights,setWeights]=useState<Record<Area,string>>(Object.fromEntries(areas.map(a=>[a,preferences.course?.weights[a].toString()??""])) as Record<Area,string>);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
  async function save(){setBusy(true);setMessage("");try{
    const numeric=Object.fromEntries(areas.map(a=>[a,weights[a].trim()?Number(weights[a]):0])) as Record<Area,number>;
    const target=goal.trim()?Number(goal):null;
    if(target!==null&&(!Number.isFinite(target)||target<0||target>100))throw new Error("A meta precisa estar entre 0 e 100%.");
    if(Object.values(areaGoals).some(n=>!Number.isFinite(n)||n<0||n>100))throw new Error("Confira as metas por área.");
    if(Object.values(numeric).some(n=>!Number.isFinite(n)||n<0||n>1000)|| (name.trim()&&Object.values(numeric).every(n=>n===0)))throw new Error("Informe pesos válidos e pelo menos um peso maior que zero.");
    if(!name.trim()&&Object.values(numeric).some(n=>n>0))throw new Error("Dê um nome ao curso para salvar os pesos.");
    await onSave({id:"personal",goalPercentage:target,areaGoals,course:name.trim()?{name:name.trim(),weights:numeric,source:"user"}:null});setMessage("Metas e pesos salvos neste navegador.");
  }catch(e){setMessage(e instanceof Error?e.message:"Não foi possível salvar.");}finally{setBusy(false);}}
  return <div className="personal-settings"><div className="form-grid"><label>Meta geral (%)<input type="number" min="0" max="100" value={goal} onChange={e=>setGoal(e.target.value)} placeholder="Ex.: 80"/></label>
    <label>Curso para nota ponderada<input maxLength={200} value={name} onChange={e=>setName(e.target.value)} placeholder="Nome definido por você"/></label></div>
    <div className="table-scroll"><table><thead><tr><th>Área</th><th>Meta (%)</th><th>Peso definido por você</th></tr></thead><tbody>{areas.map(area=><tr key={area}><td>{area}</td>
      <td><input aria-label={`Meta de ${area}`} type="number" min="0" max="100" value={areaGoals[area]??""} onChange={e=>setAreaGoals(g=>{const next={...g};if(!e.target.value)delete next[area];else next[area]=Number(e.target.value);return next;})}/></td>
      <td><input aria-label={`Peso de ${area}`} type="number" min="0" max="1000" step="any" value={weights[area]} onChange={e=>setWeights(w=>({...w,[area]:e.target.value}))}/></td></tr>)}</tbody></table></div>
    <p className="muted">Não há pesos oficiais incorporados. Estes pesos são configurados por você; a nota é exibida na escala de 0 a 100 e exige dados em todas as áreas com peso positivo.</p>
    <button className="primary" onClick={()=>void save()} disabled={busy}>{busy?"Salvando…":"Salvar metas e pesos"}</button>{message&&<p role="status">{message}</p>}
  </div>;
}
