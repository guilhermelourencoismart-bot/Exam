"use client";
import { useState } from "react";
import type { ResultRow } from "@/domain/analytics";
import { formatTime } from "@/domain/training";
import { originLabels } from "@/domain/classification";
import FacsimileViewer from "./FacsimileViewer";
import AuthoredContent from "./AuthoredContent";
export const outcomeLabels={correct:"Acerto",wrong:"Erro",blank:"Em branco"};
export default function QuestionReview({row}:{row:ResultRow}){
  const [open,setOpen]=useState(false),q=row.item;
  return <details className={`result-source ${row.outcome}`} onToggle={e=>setOpen(e.currentTarget.open)}>
    <summary><span>{q.id} · {q.topic}</span><span className={`tag ${row.outcome==="correct"?"green":row.outcome==="wrong"?"red":""}`}>{outcomeLabels[row.outcome]}</span></summary>
    {open&&<div><div className="review-answer"><span>Sua resposta <strong>{row.answer??"Em branco"}</strong></span><span>Gabarito <strong>{row.expected}</strong></span>
      <span>Tempo <strong>{row.timeMs===null?"Dados insuficientes":formatTime(row.timeMs)}</strong></span></div>
      <p className="muted">{originLabels[row.origin]??"Origem não registrada"} · {q.discipline} · {row.first?"Primeira exposição finalizada":"Questão repetida"}</p>
      <p className="muted">Visitas: {row.visits??"não registradas"} · mudanças de resposta: {row.changes??"não registradas"}</p>
      {q.author&&<AuthoredContent question={q.author} options/>}
      {q.resolution&&row.origin==="ai"?<div className="resolution"><h4>Resolução autoral por IA</h4><p className="raw-text">{q.resolution.text}</p><small>{q.resolution.model} · {q.resolution.generatedAt}</small><p className="muted">Resolução gerada e revisada por IA; não é resolução oficial. {q.author?.provenance.verification==="linear-solver"?"As equações e a alternativa correta também foram verificadas por cálculo independente.":"A revisão por IA pode conter erros."}</p></div>:<p className="muted">Resolução não disponível. O gabarito conferido não inclui uma justificativa oficial.</p>}
      {q.audit&&<><FacsimileViewer media={q.audit.media}/><details><summary>Versão e fontes da correção</summary><p>{q.audit.sourceDocument} · questão {q.audit.sourceNumber}</p>
        <p>{q.audit.key!.document} · página {q.audit.key!.page} · questão {q.audit.key!.number} · resposta {row.expected}</p>
        {q.audit.key?.pdfUrl&&<a href={`${q.audit.key.pdfUrl}#page=${q.audit.key.page}`} target="_blank" rel="noreferrer">Abrir gabarito original</a>}<p><code>{q.audit.revision}</code></p></details></>}
      {q.author&&<details><summary>Origem e revisão da questão autoral</summary><p>ChatGPT autorizado para este aplicativo · {q.author.provenance.model} · revisão: {q.author.provenance.reviewerModel}</p><p>{q.author.provenance.generatedAt}</p><p className="hash"><code>{q.author.revision}</code></p></details>}
    </div>}
  </details>;
}
