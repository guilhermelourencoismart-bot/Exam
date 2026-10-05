import { NextRequest, NextResponse } from "next/server";
import { receivedSources, receivePdf } from "@/server/source-intake";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){return NextResponse.json(await receivedSources());}
export async function POST(request:NextRequest){
  const host=request.headers.get("host")||"",origin=request.headers.get("origin");
  let sameOrigin=false;try{sameOrigin=!!origin&&new URL(origin).host===host;}catch{}
  if(!/^(127\.0\.0\.1|localhost):\d+$/.test(host)||!sameOrigin)
    return NextResponse.json({error:"Envie o PDF a partir do aplicativo aberto neste computador."},{status:403});
  try{
    // Bound the multipart body before parsing it, including chunked requests.
    const limit=33*1024*1024,reader=request.body?.getReader();
    if(!reader)throw new Error("PDF não recebido.");
    const chunks:Uint8Array[]=[];let size=0;
    for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new Error("Selecione um PDF com até 32 MB.");}chunks.push(value);}
    const body=Buffer.concat(chunks);
    const form=await new Response(body,{headers:{"content-type":request.headers.get("content-type")||""}}).formData();
    const file=form.get("file");if(!(file instanceof File))throw new Error("Selecione um arquivo PDF.");
    return NextResponse.json(await receivePdf(new Uint8Array(await file.arrayBuffer()),file.name));
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Não foi possível incorporar o PDF."},{status:400});}
}
