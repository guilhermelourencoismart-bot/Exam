"use client";
import { useEffect,useState } from "react";
import { answerAttempt,navigateAttempt,formatTime,letters,type Attempt } from "@/domain/training";
import { useAttemptSession } from "@/hooks/useAttemptSession";
import FacsimileViewer from "./FacsimileViewer";
import AuthoredContent from "./AuthoredContent";
export default function AttemptRunner({initial,onSaved,onRunningChange,onExit}:{initial:Attempt;onSaved:()=>void;onRunningChange:(r:boolean)=>void;onExit:()=>void}){
  const s=useAttemptSession(initial,onSaved,onRunningChange),a=s.attempt,q=a.items[a.currentIndex];
  const [mediaReady,setMediaReady]=useState(false),[mediaError,setMediaError]=useState(""),[confirmFinish,setConfirmFinish]=useState(false);
  useEffect(()=>{
    let active=true;const images=a.items.flatMap(q=>q.audit?.media.map(m=>m.imageUrl)||[]);
    Promise.all(images.map(src=>new Promise<void>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve();image.onerror=()=>reject(new Error("Um fac-símile desta tentativa não está disponível. Reincorpore o PDF original antes de retomar."));image.src=src;})))
      .then(()=>{if(active)setMediaReady(true);}).catch(e=>{if(active)setMediaError(e.message);});
    return()=>{active=false;};
  },[initial.id]);
  if(a.status==="completed")return <p role="status">Preparando seu relatório…</p>;
  const disabled=!s.running||s.pending||!!s.error;
  async function exit(){await s.pause().catch(()=>{});onExit();}
  return <section aria-label="Tentativa em andamento">
    <div className="section-heading"><div><span className="eyebrow">Prova em andamento · {a.kind==="review"?"revisão de questões já respondidas":a.items.every(q=>q.origin==="ai")?"inéditas por IA":"banco conferido"}</span><h2>{a.title}</h2></div><button onClick={()=>void exit()}>Salvar e voltar</button></div>
    <div className="timer-bar"><div><span>Tempo ativo total</span><strong data-testid="total-time" data-ms={Math.round(a.totalMs+s.extraMs)}>{formatTime(a.totalMs+s.extraMs)}</strong></div>
      <div><span>Nesta questão</span><strong data-testid="question-time">{formatTime(a.timesMs[q.id]+s.extraMs)}</strong></div>
      <div><span className={`tag ${s.running?"green":"amber"}`} role="status">{s.running?"Em andamento":"Pausado"}</span><small>{s.pending?"Salvando…":"Salvo neste navegador"}</small></div>
      {s.running?<button onClick={()=>void s.pause().catch(()=>{})} disabled={s.pending}>Pausar</button>:<button className="primary" onClick={()=>void s.resume()} disabled={s.pending||!!s.error||!mediaReady}>Iniciar ou retomar</button>}
    </div>
    {s.error&&<p role="alert" className="notice">{s.error}</p>}
    {mediaError&&<p role="alert" className="notice">{mediaError}</p>}
    {!mediaReady&&!mediaError&&<p role="status">Carregando as páginas completas…</p>}
    {!s.running&&<p className="muted">Retome para responder. Ao atualizar, fechar, sair desta tela ou ocultar a aba, a tentativa fica pausada. O tempo de pausa não será somado.</p>}
    <div className="question-nav" aria-label="Navegar entre questões">{a.items.map((item,i)=><button key={item.id} disabled={s.pending||!!s.error}
      aria-label={`Ir para questão ${i+1}`} aria-current={i===a.currentIndex?"step":undefined}
      className={i===a.currentIndex?"selected":""} onClick={()=>void s.commit(a=>navigateAttempt(a,i)).catch(()=>{})}>
      {i+1}{a.answers[item.id]!==null?" ✓":""}{a.reviewFlags[item.id]?" ★":""}</button>)}</div>
    <article className="training-question"><span className="eyebrow">Questão {a.currentIndex+1} de {a.items.length} · {q.discipline}</span><h3>{q.topic}</h3>
      {q.author?<><p className="question-source">Autoral por IA · {q.author.provenance.verification==="linear-solver"?"sistema e alternativas verificados por cálculo e revisão por IA":"revisada por IA"}</p><AuthoredContent question={q.author}/></>:<><p className="question-source">{q.id} · responda à questão {q.audit!.sourceNumber} da página original.</p>
      <details className="source-context"><summary>Sobre a página exibida</summary><p className="muted">As páginas integrais podem mostrar questões vizinhas e preservam textos, figuras e fórmulas. Fonte: {q.audit!.sourceDocument}.</p></details></>}
      {q.reservedForEvaluation&&<p className="notice small">Questão reservada para avaliação no corpus original. Sua inclusão foi escolhida ao criar esta lista.</p>}
      {q.audit&&<FacsimileViewer media={q.audit.media}/>}
      <fieldset className={`answer-options ${q.author?"author-options":""}`} disabled={disabled}><legend>{q.author?"Marque a alternativa correta":"Marque a alternativa conforme o fac-símile"}</legend>
        {letters.map(letter=><label key={letter} className={a.answers[q.id]===letter?"chosen":""}><input type="radio" aria-label={`Alternativa ${letter}`} name={`answer-${q.id}`} value={letter}
          checked={a.answers[q.id]===letter} onChange={()=>void s.commit(a=>answerAttempt(a,q.id,letter),false,true).catch(()=>{})}/><strong>{letter}</strong>{q.author&&<span className="raw-text">{q.author.options[letter]}</span>}</label>)}
      </fieldset>
      <div className="training-actions"><button disabled={disabled||a.answers[q.id]===null} onClick={()=>void s.commit(a=>answerAttempt(a,q.id,null),false,true).catch(()=>{})}>Deixar em branco</button>
        <label className="checkbox"><input type="checkbox" checked={a.reviewFlags[q.id]} disabled={s.pending||!!s.error}
          onChange={e=>{const checked=e.target.checked;void s.commit(a=>({...a,reviewFlags:{...a.reviewFlags,[q.id]:checked}}),false,true).catch(()=>{});}}/>Marcar para revisar nesta tentativa</label></div>
    </article>
    <div className="pagination"><button disabled={a.currentIndex===0||s.pending||!!s.error} onClick={()=>void s.commit(a=>navigateAttempt(a,a.currentIndex-1)).catch(()=>{})}>← Questão anterior</button>
      <button disabled={a.currentIndex===a.items.length-1||s.pending||!!s.error} onClick={()=>void s.commit(a=>navigateAttempt(a,a.currentIndex+1)).catch(()=>{})}>Próxima questão →</button></div>
    <button className="primary" disabled={s.pending||!!s.error||!mediaReady} onClick={()=>setConfirmFinish(true)}>Finalizar prova</button>
    {confirmFinish&&<div role="group" aria-label="Confirmar finalização" className="notice"><p>Finalizar com {Object.values(a.answers).filter(v=>v===null).length} questões em branco? A tentativa será fechada e corrigida com o gabarito conferido desta versão.</p>
      <button className="primary" onClick={()=>void s.finish().catch(()=>{})} disabled={s.pending}>Confirmar finalização</button> <button onClick={()=>setConfirmFinish(false)}>Continuar respondendo</button></div>}
  </section>;
}
