import { randomUUID } from "node:crypto";
import type { ConnectionState,InferenceResult,PlanProvider } from "@/ai/protocol";
import type { Credential,Vault } from "./vault";
import { AiError,safeAiError } from "./errors";
import { LocalOAuth,RESOURCE,requiredScopes,tokenRequest } from "./oauth";
export type AvailableModel={id:string};
export async function consumeResponse(response:Response,signal?:AbortSignal):Promise<{value:unknown;id:string}>{
  if(!response.ok){
    if(response.status===429)throw new AiError("plan_limit","O limite do ChatGPT foi atingido. Aguarde a renovação do plano e tente novamente. Nenhuma API paga será usada.",429);
    throw safeAiError(new Error(`${response.status} ${response.status===403?"forbidden":response.status===401?"authentication":"connection"}`));
  }
  if(!response.body)throw new AiError("stream","A OpenAI retornou uma resposta sem conteúdo.",502);
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer="",size=0,text="",completed:any=null;
  function event(block:string){const lines=block.split(/\r?\n/).filter(l=>l.startsWith("data:")).map(l=>l.slice(5).trimStart());if(!lines.length)return;
    const data=lines.join("\n");if(data==="[DONE]")return;let e:any;try{e=JSON.parse(data);}catch{throw new AiError("stream","A OpenAI retornou um evento ilegível. A prova não foi criada.",502);}
    if(e.type==="response.output_text.delta")text+=e.delta||"";
    if(e.type==="response.incomplete")throw new AiError("incomplete","A resposta da IA ficou incompleta. Nenhuma questão desse lote foi liberada; retome a geração para tentar novamente.",502);
    if(["response.failed","error"].includes(e.type))throw safeAiError(new Error(`${e.error?.code||e.response?.error?.code||"stream interrupted"}`));
    if(e.type==="response.completed"){
      if(e.response?.status!=="completed"||typeof e.response.id!=="string")throw new AiError("stream","A OpenAI não confirmou a conclusão da resposta.",502);
      completed=e.response;
    }
  }
  try{for(;;){if(signal?.aborted)throw new AiError("cancelled","Geração cancelada.",409);const r=await reader.read();if(r.done){buffer+=decoder.decode();break;}size+=r.value.length;if(size>8_000_000)throw new AiError("stream","Resposta da IA maior que o limite permitido.",502);buffer+=decoder.decode(r.value,{stream:true});
    let boundary:number;while((boundary=buffer.search(/\r?\n\r?\n/))>=0){const block=buffer.slice(0,boundary),sep=buffer.slice(boundary).match(/^\r?\n\r?\n/)![0].length;buffer=buffer.slice(boundary+sep);event(block);}
  }if(buffer.trim())event(buffer);
  }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  if(!completed)throw new AiError("stream","A conexão terminou sem response.completed. Nenhuma questão desse lote foi liberada.",502);
  const outputs=completed.output?.flatMap((i:any)=>i.type==="message"?(i.content||[]):[])||[];
  if(outputs.some((c:any)=>c.type==="refusal"))throw new AiError("refusal","A IA recusou este pedido. Ajuste o pedido e tente novamente.",422);
  const final=outputs.filter((c:any)=>c.type==="output_text").map((c:any)=>c.text).join("")||text;
  try{return {value:JSON.parse(final),id:completed.id};}catch{throw new AiError("format","A IA não devolveu o JSON esperado. Nenhuma prova foi criada.",502);}
}
export class ChatGPTPlanProvider implements PlanProvider{
  readonly session=randomUUID();private credential:Credential|null=null;private loaded=false;private refreshPromise:Promise<Credential>|null=null;
  private models:AvailableModel[]=[];private selectedModel:string|null=null;private lastError="";
  private seenLogin=0;private epoch=0;
  private rejected=false;
  constructor(private vault:Vault,readonly oauth:LocalOAuth,private fetcher:typeof fetch=fetch){}
  async reload(){this.epoch++;this.credential=await this.vault.read();this.loaded=true;this.models=[];this.selectedModel=null;this.lastError="";this.rejected=false;this.seenLogin=this.oauth.completed;}
  private async account(){if(!this.loaded)await this.reload();if(!this.credential)throw new AiError("authentication","Conecte o ChatGPT pelo aplicativo antes de gerar.",401);
    if(!requiredScopes.every(s=>this.credential!.scope.split(/\s+/).includes(s)))throw new AiError("scope","Esta autorização não permite usar os tokens do plano. Reconecte.",403);
    if(this.credential.expiresAt>Date.now()+60000)return this.credential;
    if(!this.credential.refreshToken)throw new AiError("authentication","A conexão expirou. Clique em Conectar ChatGPT para autorizar novamente.",401);
    if(!this.refreshPromise)this.refreshPromise=this.refresh(this.credential).finally(()=>{this.refreshPromise=null;});return this.refreshPromise;
  }
  private async refresh(prior:Credential){
    const epoch=this.epoch;
    const tokens=await tokenRequest({grant_type:"refresh_token",client_id:prior.clientId,refresh_token:prior.refreshToken!,resource:RESOURCE},this.fetcher,prior.scope);
    const next={...prior,accessToken:tokens.access_token,refreshToken:tokens.refresh_token||prior.refreshToken,expiresAt:Date.now()+tokens.expires_in*1000,scope:tokens.scope};
    if(epoch!==this.epoch)throw new AiError("authentication","A conexão mudou durante a renovação. Tente novamente.",401);
    await this.vault.save(next);this.credential=next;return next;
  }
  async status():Promise<ConnectionState>{
    let credential:Credential|null=null;try{if(!this.loaded||this.seenLogin!==this.oauth.completed)await this.reload();credential=this.credential;
      if(credential&&!this.oauth.connecting)credential=await this.account();
    }catch(e){this.lastError=safeAiError(e).message;credential=null;}
    return {status:this.oauth.connecting?"connecting":credential&&!this.rejected?"connected":this.lastError?"error":"disconnected",registeredClientConfigured:!!credential?.clientId,
      plan:null,model:this.selectedModel,message:this.oauth.connecting?this.oauth.message:this.lastError||this.oauth.message||(credential?"ChatGPT autorizado para este aplicativo.":"Conecte seu ChatGPT para criar questões inéditas."),
      inferenceValidated:!!credential?.lastDisplayedGenerationAt,lastSuccessfulInferenceAt:credential?.lastSuccessfulInferenceAt||null,limits:[],session:this.session};
  }
  async availableModels(){const credential=await this.account();const response=await this.fetcher(`${RESOURCE}/models`,{headers:{Authorization:`Bearer ${credential.accessToken}`},redirect:"error",signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw safeAiError(new Error(`${response.status} ${response.status===429?"rate limit":response.status===403?"forbidden":"connection"}`));
    const data=await response.json();if(!Array.isArray(data.data))throw new AiError("models","A OpenAI não retornou os modelos disponíveis para sua autorização.",502);
    this.models=data.data.filter((m:any)=>typeof m.id==="string"&&/^gpt-(?:4|5|6)/.test(m.id)&&!/(audio|realtime|image|tts|transcribe|search|codex)/i.test(m.id)).map((m:any)=>({id:m.id}));
    if(!this.models.length)throw new AiError("models","Nenhum modelo de texto compatível foi disponibilizado para esta autorização do ChatGPT.",403);
    const preferred=["gpt-5.4","gpt-5.2","gpt-5.1","gpt-5","gpt-4.1","gpt-4o"];
    this.selectedModel=preferred.find(id=>this.models.some(m=>m.id===id))||this.models.map(m=>m.id).sort()[0];return this.models;
  }
  async infer(prompt:string,schema:unknown,signal?:AbortSignal):Promise<InferenceResult>{
    try{
      if(this.oauth.connecting)throw new AiError("connecting","Conclua a autorização no navegador antes de gerar.",409);
      const credential=await this.account();if(!this.selectedModel)await this.availableModels();
      const epoch=this.epoch;
      const timeout=AbortSignal.timeout(240000),combined=signal?AbortSignal.any([signal,timeout]):timeout;
      const response=await this.fetcher(`${RESOURCE}/responses`,{method:"POST",redirect:"error",signal:combined,
        headers:{Authorization:`Bearer ${credential.accessToken}`,"Content-Type":"application/json"},
        body:JSON.stringify({model:this.selectedModel,store:false,stream:true,input:[{role:"developer",content:[{type:"input_text",text:"Crie e revise conteúdo educacional autoral em português brasileiro. Responda estritamente no JSON fornecido. Não acesse ferramentas, não atribua conteúdo ao Insper e não reproduza provas existentes."}]},{role:"user",content:[{type:"input_text",text:prompt}]}],text:{format:{type:"json_schema",name:"insper_output",strict:true,schema}}})});
      const result=await consumeResponse(response,combined);
      if(epoch!==this.epoch)throw new AiError("authentication","A conexão mudou durante a geração. Tente novamente.",401);
      const current=await this.account();this.credential={...current,lastSuccessfulInferenceAt:new Date().toISOString()};await this.vault.save(this.credential);this.lastError="";
      return {value:result.value,model:this.selectedModel!,turnId:result.id};
    }catch(e){const error=safeAiError(e);this.lastError=error.message;if(["authentication","authorization","scope"].includes(error.code))this.rejected=true;throw error;}
  }
  async displayed(){const c=await this.account();if(!c.lastSuccessfulInferenceAt)throw new AiError("validation","Nenhuma inferência autenticada foi concluída.",409);this.credential={...c,lastDisplayedGenerationAt:new Date().toISOString()};await this.vault.save(this.credential);}
  async connected(){await this.reload();await this.availableModels();return this.status();}
  async disconnect(){this.epoch++;await this.oauth.disconnect();this.credential=null;this.loaded=true;this.models=[];this.selectedModel=null;this.lastError="";this.rejected=false;}
}
