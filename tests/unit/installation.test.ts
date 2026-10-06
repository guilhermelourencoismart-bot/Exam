import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import { mkdtemp,readFile,rm,writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { LocalInstallation,LocalOAuth } from "../../src/server/ai/oauth";
import type { Vault } from "../../src/server/ai/vault";

let folder="";
const uuid="6ff47b2b-180f-40e2-a37b-3221cb53b2d0";
const auths:LocalOAuth[]=[];
const vault:Vault={read:async()=>null,save:vi.fn(),clear:vi.fn()};
const file=()=>path.join(folder,"installation.json");
beforeEach(async()=>{folder=await mkdtemp(path.join(tmpdir(),"insper-installation-test-"));vi.stubEnv("INSPER_LOCAL_DATA_DIR",folder);});
afterEach(async()=>{auths.splice(0).forEach(a=>a.stop());vi.unstubAllEnvs();vi.clearAllMocks();await rm(folder,{recursive:true,force:true});});

describe("identificador persistente da instalação OAuth",()=>{
 it("cria UUIDv4 no formato URN e reutiliza o arquivo em novos processos",async()=>{
  const install=await new LocalInstallation().read();
  expect(install.hostId).toMatch(/^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(install.clientId).toBeNull();expect(JSON.parse(await readFile(file(),"utf8"))).toEqual(install);
  expect(await new LocalInstallation().read()).toEqual(install);
 });
 it("migra UUIDv4 puro preservando UUID, Client ID e arquivos pessoais",async()=>{
  const credentialFile=path.join(folder,"credential.json"),jobFile=path.join(folder,"generation-test.json");
  await writeFile(credentialFile,"synthetic-credential-sentinel");await writeFile(jobFile,"synthetic-proof-sentinel");
  await writeFile(file(),JSON.stringify({hostId:uuid,clientId:"app_insper_test123"}));
  const migrated={hostId:`urn:uuid:${uuid}`,clientId:"app_insper_test123"};
  expect(await new LocalInstallation().read()).toEqual(migrated);
  expect(JSON.parse(await readFile(file(),"utf8"))).toEqual(migrated);
  expect(await new LocalInstallation().read()).toEqual(migrated);
  expect(await readFile(credentialFile,"utf8")).toBe("synthetic-credential-sentinel");
  expect(await readFile(jobFile,"utf8")).toBe("synthetic-proof-sentinel");
 });
 it("migra UUIDv4 em maiúsculas sem alterar seu conteúdo e conserva Client ID nulo",async()=>{
  await writeFile(file(),JSON.stringify({hostId:uuid.toUpperCase(),clientId:null}));
  expect(await new LocalInstallation().read()).toEqual({hostId:`urn:uuid:${uuid.toUpperCase()}`,clientId:null});
 });
 it("preserva o identificador já em formato URN sem regravar ou regenerar",async()=>{
  const install={hostId:`urn:uuid:${uuid}`,clientId:"app_insper_test123"};
  const original=JSON.stringify(install,null,2);await writeFile(file(),original);
  expect(await new LocalInstallation().read()).toEqual(install);
  expect(await new LocalInstallation().read()).toEqual(install);
  expect(await readFile(file(),"utf8")).toBe(original);
 });
 it("envia o URN criado ou migrado na URL efetiva e omite a sugestão de nome com Client ID emitido",async()=>{
  for(const clientId of [null,"app_insper_test123"]){
   if(clientId)await writeFile(file(),JSON.stringify({hostId:uuid,clientId}));
   const oauth=new LocalOAuth(vault,new LocalInstallation());auths.push(oauth);
   const first=new URL((await oauth.start()).authUrl),stored=await new LocalInstallation().read();oauth.stop();
   expect(first.searchParams.get("ext_agent_host_id")).toBe(stored.hostId);
   expect(stored.hostId.startsWith("urn:uuid:")).toBe(true);
   expect(first.searchParams.get("client_id")).toBe(clientId||"dynamic_agent_client");
   expect(first.searchParams.get("agent_name_hint")).toBe(clientId?null:"Meu preparo Insper");
   const next=new URL((await oauth.start()).authUrl);oauth.stop();
   expect(next.searchParams.get("ext_agent_host_id")).toBe(stored.hostId);
   expect(next.searchParams.get("state")).not.toBe(first.searchParams.get("state"));
  }
  expect(vault.save).not.toHaveBeenCalled();expect(vault.clear).not.toHaveBeenCalled();
 });
});
