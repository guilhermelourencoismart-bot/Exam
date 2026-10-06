import { mkdir,readFile,writeFile,rename,unlink } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
export function privateDirectory(){
  const dir=path.resolve(process.env.INSPER_LOCAL_DATA_DIR||path.join(process.env.LOCALAPPDATA||homedir(),"InsperPreparo"));
  const relative=path.relative(process.cwd(),dir);
  if(relative===""||(!relative.startsWith(".."+path.sep)&&relative!==".."&&!path.isAbsolute(relative)))throw new Error("O armazenamento protegido deve ficar fora da pasta do aplicativo.");
  return dir;
}
export async function writePrivate(name:string,value:string){
  const dir=privateDirectory();await mkdir(dir,{recursive:true,mode:0o700});
  const temp=path.join(dir,`${name}.${randomUUID()}.tmp`),target=path.join(dir,name);
  try{await writeFile(temp,value,{mode:0o600,flag:"wx"});await rename(temp,target);}finally{await unlink(temp).catch(()=>{});}
}
export async function readPrivate(name:string){try{return await readFile(path.join(privateDirectory(),name),"utf8");}catch(e){if((e as NodeJS.ErrnoException).code==="ENOENT")return null;throw e;}}
export async function removePrivate(name:string){await unlink(path.join(privateDirectory(),name)).catch(e=>{if(e.code!=="ENOENT")throw e;});}
