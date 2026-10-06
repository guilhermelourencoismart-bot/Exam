"use client";
import { useCallback,useEffect,useMemo,useRef,useState } from "react";
import type { Catalog } from "@/domain/types";
import { attemptFromPlan, type ProofPlan, type SavedPlan } from "@/domain/proof-plan";
import { canTrain,attemptFromItems,authoredItems,itemAnswer,type Attempt } from "@/domain/training";
import { useChatGPT } from "@/hooks/useChatGPT";
import type { ResultRow } from "@/domain/analytics";
import { defaultPreferences,type Preferences,type ErrorNote,type ErrorReason } from "@/domain/preferences";
import { deletePlan,mergeBackup,readAttempts,readBookmarks,readErrorNotes,readPlans,readPreferences,saveAttempt,saveErrorNote,savePlan,savePreferences,setBookmark } from "@/storage/indexed-db";
import { validateBackup,type Bookmark } from "@/storage/backup";
import ProofsPanel from "./ProofsPanel";
import ReviewPanel from "./ReviewPanel";
import AttemptRunner from "./AttemptRunner";
import AttemptResult from "./AttemptResult";
import SourcesPanel from "./SourcesPanel";
import BackupControls from "./BackupControls";
import CatalogBrowser from "./CatalogBrowser";
import PersonalSettings from "./PersonalSettings";
export default function CatalogApp(){
  const ai=useChatGPT(),adopting=useRef(new Set<string>()),acknowledged=useRef(new Set<string>());
  const [catalog,setCatalog]=useState<Catalog|null>(null),[loadError,setLoadError]=useState("");
  const [tab,setTab]=useState<"proofs"|"review">("proofs"),[utility,setUtility]=useState<"sources"|"settings"|null>(null),[menu,setMenu]=useState(false);
  const [attempts,setAttempts]=useState<Attempt[]>([]),[plans,setPlans]=useState<SavedPlan[]>([]),[notes,setNotes]=useState<ErrorNote[]>([]),[bookmarks,setBookmarks]=useState<Bookmark[]>([]),[preferences,setPreferences]=useState<Preferences>(defaultPreferences);
  const [selected,setSelected]=useState<string|null>(null),[storageReady,setStorageReady]=useState(false),[running,setRunning]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const booted=useRef(false);
  const refreshAttempts=useCallback(()=>{void readAttempts().then(setAttempts).catch(e=>setMessage(e.message));},[]);
  const refreshAll=useCallback(async()=>{const [a,b,n,p,s]=await Promise.all([readAttempts(),readBookmarks(),readErrorNotes(),readPlans(),readPreferences()]);setAttempts(a);setBookmarks(b);setNotes(n);setPlans(p);setPreferences(s);return a;},[]);
  useEffect(()=>{
    const controller=new AbortController();let active=true;
    fetch("/data/catalog.json",{signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error("Não foi possível carregar as questões.");const c=await r.json();if(c.schemaVersion!==1||!Array.isArray(c.questions))throw new Error("Catálogo incompatível.");if(active)setCatalog(c);}).catch(e=>{if(e.name!=="AbortError"&&active)setLoadError(e.message);});
    void refreshAll().then(a=>{if(active){setStorageReady(true);if(!booted.current){const paused=[...a].filter(a=>a.status==="paused").sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];setSelected(paused?.id??null);booted.current=true;}}}).catch(e=>{if(active)setMessage(`Armazenamento local indisponível: ${e.message}`);});
    return()=>{active=false;controller.abort();};
  },[refreshAll]);
  const protectedIds=useMemo(()=>new Set(attempts.filter(a=>a.status!=="completed").flatMap(a=>a.items.map(q=>q.id))),[attempts]);
  const current=attempts.find(a=>a.id===selected);
  function navigate(next:"proofs"|"review"){setTab(next);setUtility(null);setMenu(false);window.scrollTo({top:0,behavior:"auto"});}
  function open(id:string){setSelected(id);setTab("proofs");setUtility(null);window.scrollTo({top:0,behavior:"auto"});}
  function showUtility(value:"sources"|"settings"){setUtility(value);setMenu(false);window.scrollTo({top:0,behavior:"auto"});}
  async function create(plan:ProofPlan){if(!catalog)return;if(plan.origin==="ai"){await ai.generate(plan,[...new Set(attempts.flatMap(a=>a.items.map(i=>i.id)))].slice(-5000));return;}const a=await saveAttempt(attemptFromPlan(plan,catalog.questions),null);setAttempts(prior=>[a,...prior]);open(a.id);}
  useEffect(()=>{
    const job=ai.job;if(!job||job.status!=="completed"||!storageReady||running||utility||tab!=="proofs"||adopting.current.has(job.id))return;
    adopting.current.add(job.id);const id=`ai-proof-${job.id}`,existing=attempts.find(a=>a.id===id);
    if(existing){open(existing.id);return;}
    try{const a={...attemptFromItems(authoredItems(job.questions),job.plan.mode==="full"?"Simulado completo · inéditas por IA":job.plan.prompt||"Prova personalizada · inéditas por IA",job.plan.mode==="full"?"full":"thematic"),id};
    void saveAttempt(a,null).then(saved=>{setAttempts(prior=>[saved,...prior]);open(saved.id);}).catch(e=>{setMessage(`${e.message} A prova gerada permanece no servidor local. Recarregue após corrigir o armazenamento para tentar salvá-la novamente.`);refreshAttempts();});
    }catch(e){setMessage(e instanceof Error?e.message:"Conteúdo gerado inválido. Nada foi salvo.");}
  },[ai.job,storageReady,running,utility,tab,attempts,refreshAttempts]);
  useEffect(()=>{
    const author=current?.items[0].author,job=ai.job;if(!author||!job||job.status!=="completed"||author.provenance.generationId!==job.id||utility||tab!=="proofs"||acknowledged.current.has(job.id))return;
    acknowledged.current.add(job.id);void ai.acknowledge(job.id,author.id).then(()=>ai.dismiss()).catch(e=>{acknowledged.current.delete(job.id);setMessage(`As questões foram salvas, mas a confirmação da conexão falhou: ${e.message}`);});
  },[current?.id,ai.job,ai.acknowledge,tab,utility]);
  async function saveConfiguration(plan:ProofPlan){const p:SavedPlan={id:crypto.randomUUID(),title:plan.prompt.trim()||(plan.mode==="full"?"Prova completa · 60 questões":plan.lines.map(l=>`${l.quantity} ${l.topic||l.discipline||l.area}`).join("; ")),createdAt:new Date().toISOString(),plan:structuredClone(plan)};p.title=p.title.slice(0,300);await savePlan(p);setPlans(await readPlans());}
  async function removeConfiguration(id:string){await deletePlan(id);setPlans(await readPlans());}
  async function settings(p:Preferences){await savePreferences(p);setPreferences(p);setMessage("Metas e pesos salvos neste navegador.");}
  async function reason(row:ResultRow,value:ErrorReason|null){const note:ErrorNote={id:row.key,attemptId:row.attemptId,questionId:row.item.id,reason:value,updatedAt:new Date().toISOString()};await saveErrorNote(note);setNotes(await readErrorNotes());}
  async function review(rows:ResultRow[]){
    if(!catalog||!rows.length)throw new Error("Selecione erros para criar a revisão.");
    const unique=[...new Map(rows.filter(r=>r.outcome==="wrong").map(r=>[r.item.id,r])).values()];
    const items=unique.map(r=>{if(r.item.origin==="ai"){itemAnswer(r.item);return r.item;}const q=catalog.questions.find(q=>q.id===r.item.id);if(!q||!canTrain(q)||q.audit!.revision!==r.item.audit?.revision)throw new Error("O conteúdo conferido de uma questão não está disponível nesta versão. Preserve as fontes da tentativa.");return r.item;});
    const a=await saveAttempt(attemptFromItems(items,`Revisão · ${items.length} erros selecionados`,"review"),null);setAttempts(prior=>[a,...prior]);open(a.id);
  }
  async function importBackup(file:File){if(!catalog)return;setBusy(true);try{
    if(file.size>50_000_000)throw new Error("Backup maior que 50 MB.");
    const backup=validateBackup(JSON.parse(await file.text()),new Set(catalog.questions.map(q=>q.id)),catalog.questions),summary=await mergeBackup(backup);await refreshAll();setMessage(`Backup importado: ${summary.addedAttempts} tentativas adicionadas; ${summary.keptAttempts} existentes preservadas. Metas, motivos de erro e configurações existentes também foram mantidos.`);
  }catch(e){setMessage(e instanceof Error?e.message:"Backup inválido. Nada foi importado.");}finally{setBusy(false);}}
  async function bookmark(id:string){setBusy(true);try{await setBookmark(id,!bookmarks.some(b=>b.questionId===id));setBookmarks(await readBookmarks());}catch(e){setMessage(e instanceof Error?e.message:"Falha ao salvar.");}finally{setBusy(false);}}
  const shared=catalog?{catalog,attempts,preferences,notes,onPreferences:settings,onReason:reason,onReview:review}:null;
  return <div className="app-shell"><header className="app-header"><a className="brand" href="/" aria-label="Meu preparo, início"><span className="brand-mark">i.</span><span>meu preparo<small>INSPER 2027.1</small></span></a>
    <nav aria-label="Navegação principal"><button className={tab==="proofs"&&!utility?"active":""} aria-current={tab==="proofs"&&!utility?"page":undefined} disabled={running&&tab!=="proofs"} onClick={()=>navigate("proofs")}>Provas</button><button className={tab==="review"&&!utility?"active":""} aria-current={tab==="review"&&!utility?"page":undefined} disabled={running} onClick={()=>navigate("review")}>Revisão</button></nav>
    <div className="utility-menu"><button aria-label="Menu de fontes e configurações" aria-expanded={menu} disabled={running} onClick={()=>setMenu(v=>!v)}>Mais <span aria-hidden="true">⌄</span></button>{menu&&<div className="menu-popover"><button onClick={()=>showUtility("sources")}>Fontes e acervo</button><button onClick={()=>showUtility("settings")}>Dados e configurações</button></div>}</div>
  </header><main id="main" className="content">
    {loadError?<div role="alert" className="notice"><p>{loadError}</p><button onClick={()=>window.location.reload()}>Tentar novamente</button></div>:!catalog?<div className="loading-state" role="status"><span className="loading-spinner"/>Preparando seu espaço de estudo…</div>:<>
      {message&&<div role="status" className="feedback app-feedback"><p>{message}</p><button aria-label="Fechar mensagem" onClick={()=>setMessage("")}>×</button></div>}
      {utility&&<button className="back-button" onClick={()=>setUtility(null)}>← Voltar a {tab==="proofs"?"Provas":"Revisão"}</button>}
      {utility==="sources"&&<><SourcesPanel catalog={catalog}/><CatalogBrowser catalog={catalog} savedIds={bookmarks.map(b=>b.questionId)} protectedIds={protectedIds} disabled={!storageReady||busy} onSave={bookmark}/></>}
      {utility==="settings"&&<section><div className="page-heading"><div><span className="eyebrow">Seu aplicativo</span><h1>Dados e configurações</h1><p>Seu histórico fica neste navegador. Guarde uma cópia antes de atualizar.</p></div></div><div className="panel"><h2>Backup do histórico</h2><BackupControls bookmarks={bookmarks} disabled={!storageReady||busy||running} onImport={importBackup} onMessage={setMessage}/><p className="muted">Inclui respostas, tempos, visitas registradas, motivos dos erros, metas, pesos, configurações e questões autorais completas. Credenciais do ChatGPT ficam fora do navegador e do backup. Os PDFs permanecem na pasta do aplicativo. Backups das versões anteriores continuam aceitos.</p></div><div className="panel settings-panel"><h2>Metas e pesos</h2><PersonalSettings key={JSON.stringify(preferences)} preferences={preferences} onSave={settings}/></div><div className="panel settings-panel"><h2>Integração com IA</h2><p>Use Conectar ChatGPT em Provas. O fluxo registra e autoriza este aplicativo a usar os tokens do seu plano; o login do Codex não é aproveitado. A primeira geração deve ter três questões de sistemas lineares. Não existe alternativa de API paga.</p></div></section>}
      {!utility&&tab==="proofs"&&(current?current.status==="completed"?<><button className="back-button" onClick={()=>setSelected(null)}>← Voltar a Provas</button><AttemptResult {...shared!} attempt={current}/></>:<AttemptRunner key={current.id} initial={current} onSaved={refreshAttempts} onRunningChange={setRunning} onExit={()=>{setSelected(null);refreshAttempts();}}/>:<ProofsPanel catalog={catalog} attempts={attempts} plans={plans} storageReady={storageReady} onCreate={create} onOpen={open} onSavePlan={saveConfiguration} onDeletePlan={removeConfiguration} ai={ai}/>)}
      {!utility&&tab==="review"&&<ReviewPanel {...shared!}/>}
    </>}
    <footer className="app-footer"><span>Meu preparo · Insper 2027.1</span><span>Seu ritmo. Seu histórico.</span></footer>
  </main></div>;
}
