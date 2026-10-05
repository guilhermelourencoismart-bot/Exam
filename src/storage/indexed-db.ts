import type { Bookmark, Backup } from "./backup";
import type { Attempt } from "../domain/training";
// Keep the original database name. Upgrade stores without deleting bookmarks.
const DATABASE = "insper-pessoal-v1";
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve,reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("Este navegador não oferece IndexedDB."));
    const req = indexedDB.open(DATABASE,2); let blocked=false;
    req.onupgradeneeded=()=> {
      for (const [name,keyPath] of [["bookmarks","questionId"],["attempts","id"]])
        if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name,{keyPath});
    };
    req.onsuccess=()=> { if(blocked){req.result.close();return;} req.result.onversionchange=()=>req.result.close();resolve(req.result); };
    req.onerror=()=>reject(new Error("Não foi possível abrir o armazenamento local."));
    req.onblocked=()=>{blocked=true;reject(new Error("Feche as abas da versão anterior do aplicativo e recarregue esta página. Seus dados serão preservados."));};
  });
}
async function readAll<T>(store:string):Promise<T[]> {
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(store,"readonly"),req=tx.objectStore(store).getAll();
    tx.oncomplete=()=>{db.close();resolve(req.result as T[]);};
    tx.onabort=()=>{db.close();reject(new Error("Falha ao ler os dados locais."));};
  });
}
export function readBookmarks(){return readAll<Bookmark>("bookmarks");}
export function readAttempts(){return readAll<Attempt>("attempts");}
export async function readAttempt(id:string){return (await readAttempts()).find(a=>a.id===id);}
async function write<T>(stores:string[],action:(tx:IDBTransaction,done:(r:T)=>void,fail:(m:string)=>void)=>void):Promise<T> {
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(stores,"readwrite");let result:T;let error="Não foi possível salvar. Nenhuma alteração parcial foi aplicada.";
    tx.oncomplete=()=>{db.close();resolve(result!);};
    tx.onabort=()=>{db.close();reject(new Error(error));};
    try{action(tx,r=>{result=r;},m=>{error=m;tx.abort();});}catch{tx.abort();}
  });
}
export async function setBookmark(questionId:string,saved:boolean):Promise<void>{
  return write(["bookmarks"],tx=>{const s=tx.objectStore("bookmarks");if(saved)s.put({questionId,savedAt:new Date().toISOString()});else s.delete(questionId);});
}
export async function saveAttempt(attempt:Attempt,expectedRevision:number|null):Promise<Attempt>{
  return write(["attempts"],(tx,done,fail)=>{
    const store=tx.objectStore("attempts"),r=store.get(attempt.id);
    r.onsuccess=()=>{
      const prior=r.result as Attempt|undefined;
      if(expectedRevision===null?!!prior:!prior||prior.revision!==expectedRevision||prior.status==="completed"){
        fail("A tentativa foi alterada em outra aba ou já finalizada. Reabra-a antes de continuar.");return;
      }
      const saved={...attempt,revision:(prior?.revision??-1)+1,updatedAt:new Date().toISOString()};store.put(saved);done(saved);
    };
  });
}
export async function exportBackup():Promise<Backup>{
  const db=await openDatabase();return new Promise((resolve,reject)=>{
    const tx=db.transaction(["bookmarks","attempts"],"readonly"),b=tx.objectStore("bookmarks").getAll(),a=tx.objectStore("attempts").getAll();
    tx.oncomplete=()=>{db.close();resolve({app:"insper-pessoal",schemaVersion:2,exportedAt:new Date().toISOString(),bookmarks:b.result,attempts:a.result});};
    tx.onabort=()=>{db.close();reject(new Error("Falha ao exportar os dados locais."));};
  });
}
export async function mergeBackup(backup:Backup):Promise<{addedAttempts:number;keptAttempts:number}>{
  return write(["bookmarks","attempts"],(tx,done)=>{
    const summary={addedAttempts:0,keptAttempts:0};done(summary);
    for(const b of backup.bookmarks){const s=tx.objectStore("bookmarks"),r=s.get(b.questionId);r.onsuccess=()=>{if(!r.result)s.put(b);};}
    for(const a of backup.attempts){const s=tx.objectStore("attempts"),r=s.get(a.id);r.onsuccess=()=>{if(r.result)summary.keptAttempts++;else{s.put(a);summary.addedAttempts++;}};}
  });
}
