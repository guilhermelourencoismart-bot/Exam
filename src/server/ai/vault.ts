import { spawn } from "node:child_process";
import { createCipheriv,createDecipheriv,randomBytes } from "node:crypto";
import { readPrivate,writePrivate,removePrivate } from "./local-files";
import { AiError } from "./errors";
export type Credential={accessToken:string;refreshToken:string|null;expiresAt:number;scope:string;clientId:string;subject:string;email:string|null;
  lastSuccessfulInferenceAt:string|null;lastDisplayedGenerationAt:string|null};
export interface Vault{read():Promise<Credential|null>;save(value:Credential):Promise<void>;clear():Promise<void>}
export function dpapiScript(decrypt:boolean){
  // Secret bytes arrive on stdin, never in command arguments or scripts written to disk.
  return `Add-Type -AssemblyName System.Security; $b = [Convert]::FromBase64String([Console]::In.ReadToEnd()); $r = [System.Security.Cryptography.ProtectedData]::${decrypt?"Unprotect":"Protect"}($b, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($r))`;
}
async function dpapi(bytes:Buffer,decrypt:boolean):Promise<Buffer>{return new Promise((resolve,reject)=>{
  const p=spawn("powershell.exe",["-NoProfile","-NonInteractive","-Command",dpapiScript(decrypt)],{shell:false,windowsHide:true,stdio:["pipe","pipe","pipe"]});
  let out="";const timer=setTimeout(()=>{p.kill();reject(new AiError("credential_storage","O Windows demorou para proteger as credenciais. Tente novamente.",503));},15000);
  p.stdout.on("data",b=>{out+=b.toString();if(out.length>1_000_000){p.kill();reject(new AiError("credential_storage","Falha ao proteger credenciais no Windows.",503));}});p.stderr.resume();
  p.on("error",()=>{clearTimeout(timer);reject(new AiError("credential_storage","O Windows PowerShell não está disponível para proteger as credenciais com DPAPI.",503));});
  p.on("exit",code=>{clearTimeout(timer);if(code!==0||!/^[A-Za-z0-9+/=]+$/.test(out))reject(new AiError("credential_storage","O Windows não conseguiu abrir o armazenamento protegido. Reconecte com o mesmo usuário do Windows.",503));else resolve(Buffer.from(out,"base64"));});
  p.stdin.end(bytes.toString("base64"));
});}
async function unixKey(){let key=await readPrivate("vault.key");if(!key){key=randomBytes(32).toString("base64");await writePrivate("vault.key",key);}return Buffer.from(key,"base64");}
export class LocalVault implements Vault{
  private tail:Promise<void>=Promise.resolve();
  private enqueue(action:()=>Promise<void>){const next=this.tail.then(action);this.tail=next.catch(()=>{});return next;}
  save(value:Credential){const copy=structuredClone(value);return this.enqueue(()=>this.saveNow(copy));}
  private async saveNow(value:Credential){
    const bytes=Buffer.from(JSON.stringify(value));
    if(process.platform==="win32"){await writePrivate("credential.json",JSON.stringify({version:1,protection:"windows-dpapi",ciphertext:(await dpapi(bytes,false)).toString("base64")}));return;}
    const nonce=randomBytes(12),cipher=createCipheriv("aes-256-gcm",await unixKey(),nonce),ciphertext=Buffer.concat([cipher.update(bytes),cipher.final()]);
    await writePrivate("credential.json",JSON.stringify({version:1,protection:"unix-owner-file",nonce:nonce.toString("base64"),tag:cipher.getAuthTag().toString("base64"),ciphertext:ciphertext.toString("base64")}));
  }
  async read():Promise<Credential|null>{await this.tail;const text=await readPrivate("credential.json");if(!text)return null;
    try{const v=JSON.parse(text);let bytes:Buffer;
      if(process.platform==="win32"&&v.protection==="windows-dpapi")bytes=await dpapi(Buffer.from(v.ciphertext,"base64"),true);
      else if(process.platform!=="win32"&&v.protection==="unix-owner-file"){const cipher=createDecipheriv("aes-256-gcm",await unixKey(),Buffer.from(v.nonce,"base64"));cipher.setAuthTag(Buffer.from(v.tag,"base64"));bytes=Buffer.concat([cipher.update(Buffer.from(v.ciphertext,"base64")),cipher.final()]);}
      else throw new Error("protection");
      const c=JSON.parse(bytes.toString());if(typeof c.accessToken!=="string"||!c.accessToken||typeof c.clientId!=="string"||!Number.isFinite(c.expiresAt)||typeof c.scope!=="string"||!c.scope.split(/\s+/).includes("chatgpt.tokens.use.direct"))throw new Error("credential");return c;
    }catch{throw new AiError("credential_storage","Não foi possível abrir as credenciais protegidas. Reconecte o ChatGPT neste computador.",503);}
  }
  clear(){return this.enqueue(()=>removePrivate("credential.json"));}
}
