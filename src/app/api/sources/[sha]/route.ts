import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
export const runtime="nodejs";
export async function GET(_request:Request,{params}:{params:Promise<{sha:string}>}){
  const {sha}=await params;
  if(!/^[a-f0-9]{64}$/.test(sha))return new NextResponse("Arquivo inválido",{status:400});
  try{
    const bytes=await readFile(path.join(process.cwd(),"public/sources/originals",sha+".pdf"));
    return new NextResponse(bytes,{headers:{"Content-Type":"application/pdf","Content-Disposition":`inline; filename="${sha}.pdf"`,"Cache-Control":"private, max-age=31536000, immutable"}});
  }catch(e){if((e as NodeJS.ErrnoException).code==="ENOENT")return new NextResponse("PDF não encontrado",{status:404});throw e;}
}
