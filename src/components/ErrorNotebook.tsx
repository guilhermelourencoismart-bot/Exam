"use client";
import { useState } from "react";
import type { ResultRow } from "@/domain/analytics";
import { errorReasons, type ErrorNote, type ErrorReason } from "@/domain/preferences";
import QuestionReview from "./QuestionReview";
export default function ErrorNotebook({rows,notes,onReason,selected,onSelection,onReview}:{rows:ResultRow[];notes:ErrorNote[];onReason:(row:ResultRow,reason:ErrorReason|null)=>Promise<void>;selected:ReadonlySet<string>;onSelection:(value:Set<string>)=>void;onReview:(rows:ResultRow[])=>Promise<void>}){
  const errors=rows.filter(r=>r.outcome==="wrong"),[limit,setLimit]=useState(12),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[reserved,setReserved]=useState(false);
  const chosen=errors.filter(r=>selected.has(r.key));
  async function create(){setBusy(true);setMessage("");try{await onReview(chosen);}catch(e){setMessage(e instanceof Error?e.message:"Falha ao criar revisão.");}finally{setBusy(false);}}
  return <section className="report-section"><div className="section-heading"><div><span className="eyebrow">Aprender com os erros</span><h2>Caderno de erros</h2></div><span className="muted">{errors.length} erros respondidos</span></div>
    {!errors.length?<div className="empty-state compact">Nenhum erro neste recorte. Questões em branco ficam separadas.</div>:<>
      <div className="notebook-toolbar"><button onClick={()=>onSelection(new Set(errors.map(r=>r.key)))}>Selecionar todos os erros</button><button onClick={()=>onSelection(new Set())}>Limpar seleção</button>
        <button className="primary" disabled={!chosen.length||busy||(chosen.some(r=>r.item.reservedForEvaluation)&&!reserved)} onClick={()=>void create()}>{busy?"Criando…":"Criar lista de revisão"} ({new Set(chosen.map(r=>r.item.id)).size})</button></div>
      {chosen.some(r=>r.item.reservedForEvaluation)&&<label className="checkbox"><input type="checkbox" checked={reserved} onChange={e=>setReserved(e.target.checked)}/>Incluir os erros de questões reservadas selecionados</label>}
      <p className="muted">Cada questão selecionada entra uma vez na lista. A seleção também alimenta a simulação de ganho abaixo.</p>
      {errors.slice(0,limit).map(r=><div className="error-entry" key={r.key}><div className="error-entry-controls">
        <label className="checkbox"><input aria-label={`Selecionar erro ${r.key}`} type="checkbox" checked={selected.has(r.key)} onChange={e=>{const s=new Set(selected);if(e.target.checked)s.add(r.key);else s.delete(r.key);onSelection(s);}}/>Selecionar para revisar</label>
        <label>Motivo do erro<select aria-label={`Motivo do erro ${r.key}`} value={notes.find(n=>n.id===r.key)?.reason??""} disabled={busy} onChange={e=>{const reason=e.target.value as ErrorReason|"";setBusy(true);void onReason(r,reason||null).catch(e=>setMessage(e.message)).finally(()=>setBusy(false));}}><option value="">Não informado</option>{errorReasons.map(reason=><option key={reason}>{reason}</option>)}</select></label></div>
        <QuestionReview row={r}/></div>)}
      {errors.length>limit&&<button onClick={()=>setLimit(n=>n+20)}>Mostrar mais erros</button>}
    </>}{message&&<p role="alert">{message}</p>}
  </section>;
}
