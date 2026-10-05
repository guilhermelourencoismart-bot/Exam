"use client";
import { useCallback,useEffect,useMemo,useState } from "react";
import type { Catalog } from "@/domain/types";
import { emptyFilters,filterQuestions,uniqueOptions } from "@/domain/catalog";
import { availableForTraining,createAttempt,formatTime,type Attempt } from "@/domain/training";
import { readAttempts,saveAttempt } from "@/storage/indexed-db";
import AttemptRunner from "./AttemptRunner";
export default function TrainingPanel({catalog,storageReady,refreshSignal,onRunningChange,onAttemptsChange}:{catalog:Catalog;storageReady:boolean;refreshSignal:number;onRunningChange:(r:boolean)=>void;onAttemptsChange:(rows:Attempt[])=>void}){
  const [filters,setFilters]=useState({...emptyFilters,origin:"official"}),[quantity,setQuantity]=useState(20),[reserved,setReserved]=useState(false);
  const [attempts,setAttempts]=useState<Attempt[]>([]),[selected,setSelected]=useState<string|null>(null),[booted,setBooted]=useState(false);
  const [error,setError]=useState(""),[busy,setBusy]=useState(false);
  const refresh=useCallback(()=>{void readAttempts().then(rows=>{setAttempts(rows.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));onAttemptsChange(rows);}).catch(e=>setError(e.message));},[onAttemptsChange]);
  useEffect(()=>{if(storageReady)refresh();},[refresh,storageReady,refreshSignal]);
  useEffect(()=>{if(!booted&&attempts.length){setSelected(attempts.find(a=>a.status==="paused")?.id??null);setBooted(true);}},[attempts,booted]);
  const scope=useMemo(()=>filterQuestions(catalog.questions,{...emptyFilters,origin:filters.origin,exam:filters.exam}),[catalog,filters.origin,filters.exam]);
  const matched=filterQuestions(catalog.questions,filters),available=availableForTraining(catalog.questions,filters,reserved);
  const selectedAttempt=attempts.find(a=>a.id===selected);
  async function create(){
    setBusy(true);setError("");try{
      const title=filters.topic||filters.discipline||catalog.exams.find(e=>e.id===filters.exam)?.title||"Lista de treino";
      const attempt=await saveAttempt(createAttempt(matched,quantity,title,reserved),null);
      setAttempts(rows=>[attempt,...rows]);onAttemptsChange([attempt,...attempts]);setBooted(true);setSelected(attempt.id);
    }catch(e){setError(e instanceof Error?e.message:"Não foi possível criar a lista.");}finally{setBusy(false);}
  }
  if(selectedAttempt)return <AttemptRunner key={selectedAttempt.id} initial={selectedAttempt} onSaved={refresh} onRunningChange={onRunningChange}
    onExit={()=>{setSelected(null);setBooted(true);refresh();}}/>;
  return <section aria-label="Treinos"><div className="section-heading"><div><span className="eyebrow">Listas com correção conferida</span><h2>Monte seu treino</h2></div></div>
    <div className="filters">
      <label>Origem do treino<select aria-label="Origem do treino" value={filters.origin} onChange={e=>setFilters({...emptyFilters,origin:e.target.value})}><option value="official">Seleção Insper/Vunesp</option><option value="third-party">Terceiros · ALFRED</option><option value="">Todas, explicitamente</option></select></label>
      <label>Prova do treino<select aria-label="Prova do treino" value={filters.exam} onChange={e=>setFilters(f=>({...f,exam:e.target.value,discipline:"",topic:""}))}><option value="">Todas as provas</option>{catalog.exams.filter(e=>!filters.origin||e.origin===filters.origin).map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label>
      <label>Disciplina do treino<select aria-label="Disciplina do treino" value={filters.discipline} onChange={e=>setFilters(f=>({...f,discipline:e.target.value,topic:""}))}><option value="">Todas as disciplinas</option>{uniqueOptions(scope.map(q=>q.discipline)).map(d=><option key={d}>{d}</option>)}</select></label>
      <label>Assunto do treino<select aria-label="Assunto do treino" value={filters.topic} onChange={e=>setFilters(f=>({...f,topic:e.target.value}))}><option value="">Todos os assuntos</option>{uniqueOptions(scope.filter(q=>!filters.discipline||q.discipline===filters.discipline).map(q=>q.topic)).map(t=><option key={t}>{t}</option>)}</select></label>
      <label>Quantidade<input type="number" min={1} max={400} step={1} aria-label="Quantidade de questões" value={quantity} onChange={e=>setQuantity(Number(e.target.value))}/></label>
      <label className="checkbox"><input type="checkbox" checked={reserved} onChange={e=>setReserved(e.target.checked)}/>Incluir reservadas para avaliação (expõe esse conteúdo)</label>
      <div className="training-availability"><strong>{available.length} questões disponíveis para este treino</strong><p className="muted">{matched.length} registros no recorte; {matched.filter(q=>q.reservedForEvaluation).length} marcados como reservados. Apenas conteúdo completo com gabarito conferido é selecionado.</p>
        {quantity>available.length&&<p>Faltam {quantity-available.length} questões para a quantidade escolhida. Nenhum outro assunto será acrescentado.</p>}
        {!available.length&&<p>Este recorte ainda não tem questões liberadas. Consulte os bloqueios em “Fontes e relatório”.</p>}
        <button className="primary" disabled={!storageReady||busy||!Number.isInteger(quantity)||quantity<1||quantity>available.length} onClick={()=>void create()}>Criar lista de treino</button>
      </div>
    </div>
    {error&&<p role="alert" className="notice">{error}</p>}
    <h3 className="section-title">Suas tentativas</h3><p className="muted">Respostas e tempo são salvos neste navegador. Ao reabrir, retome uma tentativa pausada; nenhuma pausa é somada ao cronômetro.</p>
    {!attempts.length&&<p>Nenhuma tentativa criada ainda.</p>}
    <div className="attempt-list">{attempts.map(a=><article key={a.id}><div><h4>{a.title}</h4><span className={`tag ${a.status==="completed"?"green":"amber"}`}>{a.status==="completed"?"Finalizada":"Pausada"}</span>
      <p>{a.items.length} questões · tempo ativo {formatTime(a.totalMs)} · {new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short",timeZone:"America/Sao_Paulo"}).format(new Date(a.createdAt))}</p></div>
      <button onClick={()=>{setBooted(true);setSelected(a.id);}}>{a.status==="completed"?"Ver resultado":"Retomar tentativa"}</button></article>)}</div>
  </section>;
}
