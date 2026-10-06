import { NextRequest,NextResponse } from "next/server";
import { AiError } from "./errors";
import { secretEqual } from "./oauth";
export function secureLocalRequest(request:Request,session?:string){
  const host=request.headers.get("host")||"",origin=request.headers.get("origin");
  if(!/^(127\.0\.0\.1|localhost):\d+$/.test(host)||request.headers.get("sec-fetch-site")==="cross-site")throw new AiError("local_only","Abra o aplicativo neste computador em http://127.0.0.1:3000.",403);
  if(origin&&origin!==`http://${host}`)throw new AiError("origin","Solicitação fora da origem local do aplicativo.",403);
  if(request.method!=="GET"&&(!origin||!session||!secretEqual(request.headers.get("x-insper-session")||"",session)))throw new AiError("session","Recarregue a página local antes de conectar ou gerar.",403);
}
export async function readJson(request:NextRequest){
  if(!request.headers.get("content-type")?.startsWith("application/json"))throw new AiError("body","Envie uma solicitação JSON.");
  const reader=request.body?.getReader();if(!reader)throw new AiError("body","Solicitação vazia.");let size=0;const chunks:Uint8Array[]=[];
  try{for(;;){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>512000)throw new AiError("body","Solicitação maior que o limite permitido.",413);chunks.push(r.value);}return JSON.parse(Buffer.concat(chunks).toString("utf8"));}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export function json(value:unknown,status=200){return NextResponse.json(value,{status,headers:{"Cache-Control":"no-store"}});}
