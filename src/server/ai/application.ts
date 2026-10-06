import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Catalog } from "@/domain/types";
import { LocalVault } from "./vault";
import { LocalInstallation,LocalOAuth } from "./oauth";
import { ChatGPTPlanProvider } from "./provider";
import { GenerationManager } from "./generation";
function createApplication(){
  const vault=new LocalVault(),installation=new LocalInstallation(),oauth=new LocalOAuth(vault,installation),provider=new ChatGPTPlanProvider(vault,oauth);
  let catalog:Promise<Catalog>|null=null;
  const manager=new GenerationManager(provider,()=>catalog??=readFile(path.join(process.cwd(),"public/data/catalog.json"),"utf8").then(JSON.parse));
  return {oauth,provider,manager};
}
type Application=ReturnType<typeof createApplication>;
const scope=globalThis as typeof globalThis&{insperAiApplication?:Application};
export function aiApplication(){return scope.insperAiApplication??=createApplication();}
