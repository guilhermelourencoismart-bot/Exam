import { describe,expect,it,vi } from "vitest";
import { ChatGPTPlanProvider,consumeResponse } from "../../src/server/ai/provider";
import { LocalOAuth,SCOPES,TOKEN } from "../../src/server/ai/oauth";
import type { Credential,Vault } from "../../src/server/ai/vault";
const initial=():Credential=>({accessToken:"synthetic_oauth_access",refreshToken:"synthetic_oauth_refresh",expiresAt:Date.now()+3600000,scope:SCOPES,clientId:"app_insper_test123",subject:"synthetic_person",email:null,lastSuccessfulInferenceAt:null,lastDisplayedGenerationAt:null});
class MemoryVault implements Vault{value:Credential|null=initial();async read(){return this.value;}async save(v:Credential){this.value=structuredClone(v);}async clear(){this.value=null;}}
export function sse(value:unknown,complete=true){const response={id:"resp_synthetic",status:"completed",output:[{type:"message",content:[{type:"output_text",text:JSON.stringify(value)}]}]};
 return new Response(`data: ${JSON.stringify({type:"response.output_text.delta",delta:JSON.stringify(value)})}\r\n\r\n${complete?`data: ${JSON.stringify({type:"response.completed",response})}\r\n\r\ndata: [DONE]\r\n\r\n`:""}`,{headers:{"Content-Type":"text/event-stream"}});
}
describe("inferência direta: protocolo simulado, nunca uma chamada real",()=>{
 it("só aceita response.completed, incluindo UTF-8 dividido entre chunks",async()=>{
  expect((await consumeResponse(sse({texto:"ação"}))).value).toEqual({texto:"ação"});await expect(consumeResponse(sse({texto:"ação"},false))).rejects.toThrow("response.completed");
  const bytes=new TextEncoder().encode(await sse({texto:"á"}).text());const response=new Response(new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=3)c.enqueue(bytes.slice(i,i+3));c.close();}}));expect((await consumeResponse(response)).value).toEqual({texto:"á"});
 });
 it("não libera recusa, JSON inválido, resposta incompleta ou limite",async()=>{
  await expect(consumeResponse(new Response("",{status:429}))).rejects.toMatchObject({code:"plan_limit"});
  for(const event of [{type:"response.failed",response:{error:{code:"rate_limit_exceeded"}}},{type:"response.incomplete",response:{incomplete_details:{reason:"max_output_tokens"}}},{type:"response.completed",response:{id:"resp_x",status:"completed",output:[{type:"message",content:[{type:"refusal",refusal:"Não"}]}]}}])await expect(consumeResponse(new Response(`data: ${JSON.stringify(event)}\n\n`))).rejects.toThrow();
 });
 it("usa Bearer OAuth, Responses oficial, store=false e streaming; validação exige exibição",async()=>{
  const v=new MemoryVault(),network=vi.fn(async(url:any,init:any)=>{
    expect(init.headers.Authorization).toBe("Bearer synthetic_oauth_access");
    if(String(url).endsWith("/models"))return Response.json({data:[{id:"gpt-5.4"},{id:"gpt-image-1"}]});
    expect(url).toBe("https://api.openai.com/v1/responses");const body=JSON.parse(init.body);expect(body.store).toBe(false);expect(body.stream).toBe(true);expect(body.text.format.type).toBe("json_schema");return sse({questions:[]});
  }) as unknown as typeof fetch;
  const oauth=new LocalOAuth(v,{read:async()=>({hostId:"test",clientId:null}),save:async()=>{}},network),p=new ChatGPTPlanProvider(v,oauth,network);
  expect((await p.status()).inferenceValidated).toBe(false);expect((await p.infer("teste",{type:"object"})).value).toEqual({questions:[]});expect((await p.status()).lastSuccessfulInferenceAt).not.toBeNull();expect((await p.status()).inferenceValidated).toBe(false);
  await p.displayed();expect((await p.status()).inferenceValidated).toBe(true);expect(JSON.stringify(await p.status())).not.toMatch(/synthetic_oauth_access|synthetic_oauth_refresh|synthetic_person/);await p.disconnect();expect(v.value).toBeNull();expect((await p.status()).status).toBe("disconnected");
 });
 it("renova uma única vez com refresh_token e Client ID próprio, sem chave de API",async()=>{
  const v=new MemoryVault();v.value!.expiresAt=1;let refreshes=0;
  const network=vi.fn(async(url:any,init:any)=>{expect(url).toBe(TOKEN);refreshes++;const body=new URLSearchParams(init.body);expect(body.get("client_id")).toBe("app_insper_test123");expect(body.get("grant_type")).toBe("refresh_token");return Response.json({access_token:"synthetic_new",expires_in:3600,token_type:"Bearer",scope:SCOPES});}) as unknown as typeof fetch;
  const oauth=new LocalOAuth(v,{read:async()=>({hostId:"test",clientId:null}),save:async()=>{}},network),p=new ChatGPTPlanProvider(v,oauth,network);await p.reload();const states=await Promise.all([p.status(),p.status()]);expect(states.every(s=>s.status==="connected")).toBe(true);expect(refreshes).toBe(1);expect(v.value?.accessToken).toBe("synthetic_new");
 });
 it("não mostra conectado quando a autorização expirou e a renovação foi recusada",async()=>{
  const v=new MemoryVault();v.value!.expiresAt=1;const network=(async()=>new Response("",{status:401})) as typeof fetch;
  const oauth=new LocalOAuth(v,{read:async()=>({hostId:"test",clientId:null}),save:async()=>{}},network),p=new ChatGPTPlanProvider(v,oauth,network);expect((await p.status()).status).toBe("error");expect((await p.status()).message).toContain("autorização");
 });
});
