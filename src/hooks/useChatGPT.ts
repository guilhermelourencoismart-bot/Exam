"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import type { ConnectionState,GenerationJob } from "@/ai/protocol";
import type { ProofPlan } from "@/domain/proof-plan";
const pointer="insper-ai-generation-v1";
async function response<T>(url:string,init?:RequestInit):Promise<T>{const r=await fetch(url,{cache:"no-store",...init}),body=await r.json();if(!r.ok)throw new Error(body.error||"Não foi possível acessar a conexão local.");return body;}
export function useChatGPT(){
  const [connection,setConnection]=useState<ConnectionState|null>(null),[job,setJob]=useState<GenerationJob|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[authUrl,setAuthUrl]=useState("");
  const session=useRef("");const refresh=useCallback(async()=>{const c=await response<ConnectionState>("/api/ai/status");session.current=c.session;setConnection(c);return c;},[]);
  const post=useCallback(async<T,>(action:string,body?:unknown):Promise<T>=>{
    if(!session.current)await refresh();
    return response<T>(`/api/ai/${action}`,{method:"POST",headers:{"Content-Type":"application/json","X-Insper-Session":session.current},body:JSON.stringify(body||{})});
  },[refresh]);
  useEffect(()=>{let active=true;let timer:ReturnType<typeof setTimeout>;
    async function poll(){try{const c=await refresh();if(active){if(c.status!=="connecting")setAuthUrl("");timer=setTimeout(poll,c.status==="connecting"?1500:15000);}}catch(e){if(active){setError(e instanceof Error?e.message:"Conexão local indisponível.");timer=setTimeout(poll,15000);}}}
    void poll();return()=>{active=false;clearTimeout(timer);};
  },[refresh]);
  useEffect(()=>{const id=localStorage.getItem(pointer);if(id)void response<GenerationJob>(`/api/ai/job?id=${encodeURIComponent(id)}`).then(setJob).catch(e=>{setError(e.message);localStorage.removeItem(pointer);});},[]);
  useEffect(()=>{if(!job||!["generating","reviewing"].includes(job.status))return;let active=true;let timer:ReturnType<typeof setTimeout>;
    async function poll(){try{const next=await response<GenerationJob>(`/api/ai/job?id=${encodeURIComponent(job!.id)}`);if(active){setJob(next);setError("");if(["generating","reviewing"].includes(next.status))timer=setTimeout(poll,1000);else void refresh();}}catch(e){if(active){setError(e instanceof Error?e.message:"Não foi possível consultar a geração.");timer=setTimeout(poll,3000);}}}
    timer=setTimeout(poll,700);return()=>{active=false;clearTimeout(timer);};
  },[job?.id,job?.status,refresh]);
  async function connect(){
    const popup=window.open("about:blank","insper-chatgpt-authorization","popup,width=620,height=780");setBusy(true);setError("");
    try{const value=await post<{authUrl:string}>("connect");const url=new URL(value.authUrl);if(url.protocol!=="https:"||url.hostname!=="auth.openai.com")throw new Error("A conexão não retornou um endereço oficial.");setAuthUrl(value.authUrl);if(popup)popup.location.replace(value.authUrl);await refresh();}
    catch(e){popup?.close();setError(e instanceof Error?e.message:"Não foi possível iniciar a autorização.");}finally{setBusy(false);}
  }
  async function disconnect(){setBusy(true);try{setConnection(await post<ConnectionState>("disconnect"));setAuthUrl("");if(job&&["generating","reviewing"].includes(job.status))setJob(await response<GenerationJob>(`/api/ai/job?id=${job.id}`));}catch(e){setError(e instanceof Error?e.message:"Falha ao desconectar.");}finally{setBusy(false);}}
  async function cancelLogin(){setConnection(await post<ConnectionState>("cancel-login"));setAuthUrl("");}
  async function generate(plan:ProofPlan,existingIds:string[]){setError("");const value=await post<GenerationJob>("generate",{plan,existingIds});setJob(value);localStorage.setItem(pointer,value.id);}
  async function cancel(){try{if(job)setJob(await post<GenerationJob>("cancel",{id:job.id}));}catch(e){setError(e instanceof Error?e.message:"Falha ao cancelar.");}}
  async function resume(existingIds:string[]){try{if(job){setError("");const value=await post<GenerationJob>("resume",{id:job.id,existingIds});setJob(value);}}catch(e){setError(e instanceof Error?e.message:"Falha ao retomar.");}}
  const acknowledge=useCallback(async(id:string,questionId:string)=>{setConnection(await post<ConnectionState>("displayed",{id,questionId}));},[post]);
  function dismiss(){localStorage.removeItem(pointer);setJob(null);}
  return {connection,job,error,busy,authUrl,connect,disconnect,cancelLogin,generate,cancel,resume,refresh,acknowledge,dismiss};
}
export type ChatGPTController=ReturnType<typeof useChatGPT>;
