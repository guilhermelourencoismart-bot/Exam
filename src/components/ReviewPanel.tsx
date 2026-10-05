"use client";
import { useEffect,useState } from "react";
import { formatTime,reviewErrors,type Attempt } from "@/domain/training";
import { readAttempts } from "@/storage/indexed-db";
import FacsimileViewer from "./FacsimileViewer";
export default function ReviewPanel({refreshSignal}:{refreshSignal:number}){
  const [attempts,setAttempts]=useState<Attempt[]>([]),[error,setError]=useState("");
  useEffect(()=>{void readAttempts().then(setAttempts).catch(e=>setError(e.message));},[refreshSignal]);
  const errors=reviewErrors(attempts),flags=attempts.flatMap(a=>a.items.filter(q=>a.reviewFlags[q.id]).map(q=>({q,a})));
  return <section aria-label="Caderno de revisão"><h2>Caderno de revisão</h2><p>{errors.length} erros respondidos em tentativas finalizadas. Questões em branco não são tratadas como erro.</p>
    {error&&<p role="alert">{error}</p>}{!errors.length&&<p className="notice">Nenhum erro registrado. O caderno será preenchido pelas suas tentativas reais.</p>}
    {errors.map(e=><details className="result-source" key={`${e.attemptId}-${e.item.id}`}><summary>{e.item.id} · {e.item.topic} · sua resposta {e.answer}, correta {e.expected}</summary>
      <p>{e.attemptTitle} · tempo ativo nesta questão: {formatTime(e.timeMs)}</p>
      <p>{e.item.audit.sourceDocument} · versão conferida, questão {e.item.audit.sourceNumber}. Gabarito: {e.item.audit.key!.document}, número {e.item.audit.key!.number}.</p>
      <p className="muted">Não há resolução oficial incorporada. Este caderno registra o erro e as fontes, sem inventar uma explicação.</p><FacsimileViewer media={e.item.audit.media}/></details>)}
    <h3 className="section-title">Marcações dentro das tentativas</h3>{!flags.length?<p>Nenhuma marcação nas tentativas.</p>:flags.map(({q,a})=><p key={`${a.id}-${q.id}`}>{q.id} · {q.topic} · {a.title} ({a.status==="completed"?"finalizada":"pausada"})</p>)}
    <p className="muted">As marcações do catálogo continuam em “Questões → Só marcadas para revisar”.</p>
  </section>;
}
