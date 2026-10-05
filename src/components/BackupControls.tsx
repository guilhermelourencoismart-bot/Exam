"use client";
import { useRef,useState } from "react";
import type { Bookmark } from "@/storage/backup";
import { exportBackup } from "@/storage/indexed-db";
export default function BackupControls({bookmarks,disabled,onImport,onMessage}:{bookmarks:Bookmark[];disabled:boolean;onImport:(file:File)=>Promise<void>;onMessage:(message:string)=>void}){
  const input=useRef<HTMLInputElement>(null),[exporting,setExporting]=useState(false);
  async function download(){setExporting(true);try{
    const backup=await exportBackup(),url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download="insper-backup.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    onMessage(`Backup exportado: ${backup.bookmarks.length} marcações e ${backup.attempts.length} tentativas, com respostas e tempos. Os PDFs ficam separados na pasta do aplicativo.`);
  }catch(e){onMessage(e instanceof Error?e.message:"Falha ao exportar backup.");}finally{setExporting(false);}}
  return <div className="backup-controls"><span>{bookmarks.length} {bookmarks.length===1?"marcação local":"marcações locais"}</span>
    <button disabled={disabled||exporting} onClick={()=>void download()}>Exportar backup</button>
    <button disabled={disabled||exporting} onClick={()=>input.current?.click()}>Importar backup</button>
    <input ref={input} type="file" accept="application/json,.json" aria-label="Arquivo de backup" hidden onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)void onImport(file);}}/>
  </div>;
}
