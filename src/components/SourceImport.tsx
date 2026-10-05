"use client";
import { useEffect,useRef,useState } from "react";
import type { ReceivedSource } from "@/server/source-intake";
export default function SourceImport(){
  const input=useRef<HTMLInputElement>(null),[received,setReceived]=useState<ReceivedSource[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  useEffect(()=>{void fetch("/api/sources").then(r=>r.json()).then(setReceived).catch(()=>setMessage("Não foi possível consultar os PDFs recebidos."));},[]);
  async function send(files:File[]){setBusy(true);setMessage("");try{
    for(const file of files){const data=new FormData();data.append("file",file);const r=await fetch("/api/sources",{method:"POST",body:data}),result=await r.json();if(!r.ok)throw new Error(result.error);}
    setReceived(await(await fetch("/api/sources")).json());setMessage("PDFs recebidos. A identificação e a revisão ainda não liberam questões automaticamente.");
  }catch(e){setReceived(await(await fetch("/api/sources")).json());setMessage(e instanceof Error?e.message:"Falha ao receber PDF.");}finally{setBusy(false);}}
  return <section className="source-import"><h3>Incorporar PDFs originais</h3><p>Selecione cadernos e gabaritos. O nome pode ter mudado: arquivos idênticos são reconhecidos pelo conteúdo (SHA-256). PDFs modificados ficam pendentes de análise de conteúdo e versão.</p>
    <button disabled={busy} onClick={()=>input.current?.click()}>{busy?"Recebendo PDFs…":"Selecionar PDFs"}</button>
    <input ref={input} hidden type="file" multiple accept="application/pdf,.pdf" aria-label="PDFs originais" onChange={e=>{const files=Array.from(e.target.files??[]);e.target.value="";if(files.length)void send(files);}}/>
    {message&&<p role="status">{message}</p>}
    <p className="muted">Receber o arquivo não confirma completude, alternativas ou gabarito. Essa conferência precisa ser feita antes da liberação. PDFs são arquivos de conteúdo na pasta do aplicativo; o backup pessoal inclui marcações e tentativas, sem os PDFs.</p>
    {received.map(r=><details key={r.sha256}><summary>{r.originalName} · recebido</summary><p>{r.document||"Identidade pendente"}</p><p>{r.status}</p><code>{r.sha256}</code><p><a href={r.url} target="_blank" rel="noreferrer">Abrir PDF recebido ↗</a></p></details>)}
  </section>;
}
