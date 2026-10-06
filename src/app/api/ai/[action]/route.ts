import type { NextRequest } from "next/server";
import { aiApplication } from "@/server/ai/application";
import { AiError,safeAiError } from "@/server/ai/errors";
import { json,readJson,secureLocalRequest } from "@/server/ai/http";
export const runtime="nodejs",dynamic="force-dynamic";
export async function GET(request:NextRequest,{params}:{params:Promise<{action:string}>}){
  try{secureLocalRequest(request);const app=aiApplication(),{action}=await params;
    if(action==="status")return json(await app.provider.status());
    if(action==="job")return json(await app.manager.get(request.nextUrl.searchParams.get("id")||""));
    throw new AiError("route","Operação desconhecida.",404);
  }catch(e){const error=safeAiError(e);return json({error:error.message,code:error.code},error.status);}
}
export async function POST(request:NextRequest,{params}:{params:Promise<{action:string}>}){
  try{const app=aiApplication();secureLocalRequest(request,app.provider.session);const {action}=await params;
    if(action==="connect")return json(await app.oauth.start());
    if(action==="disconnect"){await app.manager.cancelAll();await app.provider.disconnect();return json(await app.provider.status());}
    if(action==="cancel-login"){app.oauth.stop();app.oauth.message="Autorização cancelada. Clique em Conectar ChatGPT quando quiser tentar novamente.";return json(await app.provider.status());}
    const body=await readJson(request);
    const existing=body.existingIds??[];if(!Array.isArray(existing)||existing.length>5000||existing.some((id:unknown)=>typeof id!=="string"||id.length>128))throw new AiError("body","Lista de questões existentes inválida.");
    if(action==="generate")return json(await app.manager.start(body.plan,existing),202);
    if(action==="resume")return json(await app.manager.resume(body.id,existing),202);
    if(action==="cancel")return json(await app.manager.cancel(body.id));
    if(action==="displayed"){const job=await app.manager.get(body.id);
      if(job.status!=="completed"||!job.questions.length||!job.questions.some(q=>q.id===body.questionId))throw new AiError("validation","A geração completa ainda não foi exibida.",409);
      await app.provider.displayed();return json(await app.provider.status());}
    throw new AiError("route","Operação desconhecida.",404);
  }catch(e){const error=safeAiError(e);return json({error:error.message,code:error.code},error.status);}
}
