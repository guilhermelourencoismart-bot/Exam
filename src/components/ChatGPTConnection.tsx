"use client";
import type { ChatGPTController } from "@/hooks/useChatGPT";
import { siwcDocs } from "@/ai/protocol";
export default function ChatGPTConnection({ai,onTest,existingIds}:{ai:ChatGPTController;onTest:()=>void;existingIds:string[]}){
  const c=ai.connection,working=!!ai.job&&["generating","reviewing"].includes(ai.job.status);
  return <div className="ai-connection" aria-label="Conexão ChatGPT"><div className="connection-heading"><div><strong><span className={`connection-dot ${c?.status==="connected"?"online":""}`}/>{c?.status==="connected"?"ChatGPT conectado":c?.status==="connecting"?"Autorização em andamento":"Seu ChatGPT, neste aplicativo"}</strong><p>{c?.message||"Conferindo a conexão local…"}</p></div><div className="button-row">
    {c?.status==="connecting"?<button disabled={ai.busy} onClick={()=>void ai.cancelLogin().catch(()=>{})}>Cancelar conexão</button>:<button disabled={ai.busy||working} onClick={()=>void ai.connect()}>{ai.busy?"Conectando…":c?.status==="connected"?"Reconectar ChatGPT":"Conectar ChatGPT"}</button>}
    {c?.status==="connected"&&<button className="text-button" disabled={ai.busy} onClick={()=>void ai.disconnect()}>Desconectar</button>}
  </div></div>
    {ai.authUrl&&<p><a href={ai.authUrl} target="_blank" rel="noreferrer">Abrir autorização oficial do ChatGPT</a><span className="muted"> · use este link se a janela não abriu.</span></p>}
    {c?.status==="connected"&&!c.inferenceValidated&&!working&&<div className="first-ai-test"><p>Primeiro teste: três questões inéditas de sistemas lineares. A geração será validada após as questões aparecerem aqui.</p><button className="primary" onClick={onTest}>Testar 3 questões de sistemas lineares</button></div>}
    {c?.inferenceValidated&&<p className="muted">Geração autenticada e exibida neste aplicativo.{c.model?` Modelo: ${c.model}.`:""}</p>}
    {ai.job&&<div className="generation-progress" role="status"><div><strong>{ai.job.message}</strong><span>{ai.job.accepted}/{ai.job.total} revisadas</span></div><progress max={ai.job.total} value={ai.job.accepted}/><div className="button-row">
      {working?<button onClick={()=>void ai.cancel().catch(()=>{})}>Cancelar geração</button>:ai.job.status==="completed"?<button onClick={ai.dismiss}>Fechar progresso</button>:<><button disabled={c?.status!=="connected"||ai.busy} onClick={()=>void ai.resume(existingIds).catch(()=>{})}>Retomar geração</button><button onClick={ai.dismiss}>Descartar pedido</button></>}
    </div></div>}
    {ai.error&&<p role="alert" className="feedback">{ai.error}</p>}
    <details className="connection-details"><summary>Sobre a conexão e os limites</summary><p>A autorização registra este aplicativo e permite usar os tokens do seu plano. Credenciais ficam protegidas no servidor deste computador. O aplicativo não recebe o login do Codex, não pede chave de API e não usa cobrança de API como alternativa.</p><p>Gerar e revisar consome os limites disponíveis do ChatGPT. Limites só serão mostrados se a OpenAI os informar. Revisão por IA pode falhar; suas resoluções são autorais.</p><a href={siwcDocs} target="_blank" rel="noreferrer">Fluxo oficial Sign in with ChatGPT</a></details>
  </div>;
}
