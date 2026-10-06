import { afterEach,beforeEach,describe,expect,it } from "vitest";
import { mkdtemp,readFile,rm,stat } from "node:fs/promises";
import { LocalVault,type Credential } from "../../src/server/ai/vault";
import { SCOPES } from "../../src/server/ai/oauth";
import { privateDirectory } from "../../src/server/ai/local-files";
let folder="",prior:string|undefined;
beforeEach(async()=>{prior=process.env.INSPER_LOCAL_DATA_DIR;folder=await mkdtemp("/tmp/insper-vault-test-");process.env.INSPER_LOCAL_DATA_DIR=folder;});
afterEach(async()=>{if(prior===undefined)delete process.env.INSPER_LOCAL_DATA_DIR;else process.env.INSPER_LOCAL_DATA_DIR=prior;await rm(folder,{recursive:true,force:true});});
const synthetic:Credential={accessToken:"access_token_synthetic_only",refreshToken:"refresh_token_synthetic_only",scope:SCOPES,clientId:"app_insper_test123",subject:"test-person",email:null,expiresAt:Date.now()+3600000,lastSuccessfulInferenceAt:null,lastDisplayedGenerationAt:null};
describe("proteção local: credenciais exclusivamente sintéticas",()=>{
 it("grava cifrado fora do projeto, lê em nova instância e remove ao desconectar",async()=>{
  const vault=new LocalVault();await vault.save(synthetic);const disk=await readFile(`${folder}/credential.json`,"utf8");expect(disk).not.toMatch(/access_token_synthetic_only|refresh_token_synthetic_only/);expect((await stat(`${folder}/credential.json`)).mode&0o777).toBe(0o600);expect(await new LocalVault().read()).toEqual(synthetic);await vault.clear();expect(await vault.read()).toBeNull();
 });
 it("serializa gravação e remoção; o logout não deixa credencial reaparecer",async()=>{
  const vault=new LocalVault();await Promise.all([vault.save(synthetic),vault.clear()]);expect(await vault.read()).toBeNull();
 });
 it("recusa armazenamento dentro da pasta do aplicativo",()=>{process.env.INSPER_LOCAL_DATA_DIR=`${process.cwd()}/public/private`;expect(()=>privateDirectory()).toThrow("fora");});
});
