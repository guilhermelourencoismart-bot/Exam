"use client";
import { useMemo,useState } from "react";
import { defaultAnalysisFilters, filterResults, resultRows, type ResultRow } from "@/domain/analytics";
import { areas, topicKey } from "@/domain/classification";
import { uniqueOptions } from "@/domain/catalog";
import type { Attempt } from "@/domain/training";
import type { Catalog } from "@/domain/types";
import type { ErrorNote,ErrorReason,Preferences } from "@/domain/preferences";
import AnalyticsReport from "./AnalyticsReport";
export default function ReviewPanel({attempts,catalog,preferences,notes,onPreferences,onReason,onReview}:{attempts:Attempt[];catalog:Catalog;preferences:Preferences;notes:ErrorNote[];onPreferences:(p:Preferences)=>Promise<void>;onReason:(r:ResultRow,reason:ErrorReason|null)=>Promise<void>;onReview:(rows:ResultRow[])=>Promise<void>}){
  const [filters,setFilters]=useState(defaultAnalysisFilters);
  const all=useMemo(()=>resultRows(attempts,catalog.questions),[attempts,catalog]),rows=useMemo(()=>filterResults(all,filters),[all,filters]);
  const disciplineScope=all.filter(r=>!filters.area||r.area===filters.area);
  const topics=uniqueOptions(disciplineScope.filter(r=>!filters.discipline||r.item.discipline===filters.discipline).map(r=>topicKey(r.item.discipline,r.item.topic)));
  return <section aria-label="Revisão consolidada"><div className="page-heading"><div><span className="eyebrow">Seu histórico, junto</span><h1>Revise com direção.</h1><p>Todas as provas finalizadas, com os denominadores à vista.</p></div></div>
    <div className="review-filters panel"><div className="form-grid filter-grid"><label>De<input aria-label="Período inicial" type="date" value={filters.from} onChange={e=>setFilters(f=>({...f,from:e.target.value}))}/></label><label>Até<input aria-label="Período final" type="date" value={filters.to} onChange={e=>setFilters(f=>({...f,to:e.target.value}))}/></label>
      <label>Matéria<select aria-label="Matéria da revisão" value={filters.area} onChange={e=>setFilters(f=>({...f,area:e.target.value,discipline:"",topic:""}))}><option value="">Todas as matérias</option>{areas.map(a=><option key={a}>{a}</option>)}</select></label>
      <label>Disciplina<select aria-label="Disciplina da revisão" value={filters.discipline} onChange={e=>setFilters(f=>({...f,discipline:e.target.value,topic:""}))}><option value="">Todas as disciplinas</option>{uniqueOptions(disciplineScope.map(r=>r.item.discipline)).map(d=><option key={d}>{d}</option>)}</select></label>
      <label>Assunto<select aria-label="Assunto da revisão" value={filters.topic} onChange={e=>setFilters(f=>({...f,topic:e.target.value}))}><option value="">Todos os assuntos</option>{topics.map(t=><option value={t} key={t}>{t.split("::").join(" · ")}</option>)}</select></label>
      <label>Origem<select aria-label="Origem da revisão" value={filters.origin} onChange={e=>setFilters(f=>({...f,origin:e.target.value}))}><option value="">Todas as origens</option><option value="official">Questões oficiais</option><option value="third-party">Terceiros</option><option value="ai">Inéditas por IA</option></select></label></div>
      <div className="filter-footer"><label className="checkbox"><input type="checkbox" checked={filters.firstOnly} onChange={e=>setFilters(f=>({...f,firstOnly:e.target.checked}))}/>Somente a primeira resposta a cada questão</label><button onClick={()=>setFilters(defaultAnalysisFilters)}>Limpar filtros</button></div>
      {filters.from&&filters.to&&filters.from>filters.to&&<p role="alert">O início do período deve vir antes do fim.</p>}
    </div><p className="sample-note">Período pela data de finalização, no horário de Brasília. Tentativas em andamento ficam fora. A primeira resposta é definida no histórico completo, antes dos filtros; se uma questão nunca foi respondida, conserva-se apenas seu primeiro branco. Evolução usa primeiras exposições para separar questões já vistas.</p>
    <AnalyticsReport key={JSON.stringify(filters)} rows={rows} allRows={rows} attempts={attempts} catalog={catalog} preferences={preferences} notes={notes} onPreferences={onPreferences} onReason={onReason} onReview={onReview}/>
  </section>;
}
