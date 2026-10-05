import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Catalog } from "../domain/types";
export type ReceivedSource={sha256:string;url:string;originalName:string;document:string|null;status:string};
const folder=()=>path.join(process.cwd(),"public","sources","originals");
export async function receivePdf(bytes:Uint8Array,originalName:string):Promise<ReceivedSource>{
  if(bytes.length>32*1024*1024 || bytes.length<5 || Buffer.from(bytes.subarray(0,5)).toString()!=="%PDF-")
    throw new Error("Selecione um PDF válido com até 32 MB.");
  const sha256=createHash("sha256").update(bytes).digest("hex");
  const catalog=JSON.parse(await readFile(path.join(process.cwd(),"public/data/catalog.json"),"utf8")) as Catalog;
  const match=catalog.documents.find(d=>d.sha256===sha256);
  await mkdir(folder(),{recursive:true});
  const target=path.join(folder(),sha256+".pdf");
  try{await writeFile(target,bytes,{flag:"wx"});}catch(e){
    if((e as NodeJS.ErrnoException).code!=="EEXIST")throw e;
    if(createHash("sha256").update(await readFile(target)).digest("hex")!==sha256)throw new Error("Arquivo existente inconsistente; não foi sobrescrito.");
  }
  const result={sha256,url:`/api/sources/${sha256}`,originalName:originalName.slice(0,200),
    document:match?.arquivo??null,status:match?"Identidade reconhecida pelo SHA-256; aguarda conferência visual e gabarito":"Nome ignorado para identificação; aguarda análise de conteúdo e versão"};
  await writeFile(path.join(folder(),sha256+".json"),JSON.stringify(result,null,2),{flag:"wx"}).catch(e=>{if((e as NodeJS.ErrnoException).code!=="EEXIST")throw e;});
  return result;
}
export async function receivedSources():Promise<ReceivedSource[]>{
  let names:string[];try{names=await readdir(folder());}catch(e){if((e as NodeJS.ErrnoException).code==="ENOENT")return [];throw e;}
  return Promise.all(names.filter(n=>/^[a-f0-9]{64}\.json$/.test(n)).sort().map(async n=>JSON.parse(await readFile(path.join(folder(),n),"utf8")) as ReceivedSource));
}
