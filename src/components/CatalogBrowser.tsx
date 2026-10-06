"use client";
import { useState } from "react";
import { emptyFilters,filterQuestions,uniqueOptions } from "@/domain/catalog";
import type { Catalog } from "@/domain/types";
import QuestionCard from "./QuestionCard";
export default function CatalogBrowser({catalog,savedIds,protectedIds,disabled,onSave}:{catalog:Catalog;savedIds:string[];protectedIds:ReadonlySet<string>;disabled:boolean;onSave:(id:string)=>Promise<void>}){
  const [filters,setFilters]=useState(emptyFilters),[limit,setLimit]=useState(20);
  const rows=filterQuestions(catalog.questions,filters,savedIds);
  return <section className="report-section" aria-label="Acervo para consulta"><h2>Acervo para consulta</h2><p className="muted">Questões sem gabarito conferido permanecem apenas para consulta.</p>
    <div className="form-grid panel"><label>Buscar questão<input value={filters.search} onChange={e=>setFilters(f=>({...f,search:e.target.value}))}/></label>
      <label>Origem do acervo<select value={filters.origin} onChange={e=>setFilters(f=>({...f,origin:e.target.value,exam:""}))}><option value="">Todas</option><option value="official">Questões oficiais</option><option value="third-party">Terceiros</option></select></label>
      <label>Prova do acervo<select value={filters.exam} onChange={e=>setFilters(f=>({...f,exam:e.target.value}))}><option value="">Todas</option>{catalog.exams.filter(e=>!filters.origin||e.origin===filters.origin).map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label>
      <label>Disciplina do acervo<select value={filters.discipline} onChange={e=>setFilters(f=>({...f,discipline:e.target.value,topic:""}))}><option value="">Todas</option>{uniqueOptions(catalog.questions.map(q=>q.discipline)).map(d=><option key={d}>{d}</option>)}</select></label>
      <label>Assunto do acervo<select value={filters.topic} onChange={e=>setFilters(f=>({...f,topic:e.target.value}))}><option value="">Todos</option>{uniqueOptions(catalog.questions.filter(q=>!filters.discipline||q.discipline===filters.discipline).map(q=>q.topic)).map(t=><option key={t}>{t}</option>)}</select></label>
      <label className="checkbox"><input type="checkbox" checked={filters.savedOnly} onChange={e=>setFilters(f=>({...f,savedOnly:e.target.checked}))}/>Só marcadas para revisar</label></div>
    <p className="sample-note">{rows.length} registros encontrados</p><div className="questions-grid">{rows.slice(0,limit).map(q=><QuestionCard key={q.id} question={q} catalog={catalog} saved={savedIds.includes(q.id)} hideAnswer={protectedIds.has(q.id)} disabled={disabled} onSave={()=>void onSave(q.id)}/>)}</div>{rows.length>limit&&<button onClick={()=>setLimit(n=>n+20)}>Mostrar mais questões do acervo</button>}
  </section>;
}
