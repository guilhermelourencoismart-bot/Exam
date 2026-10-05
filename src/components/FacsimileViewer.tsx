"use client";
import { useRef,useState } from "react";
import type { Facsimile } from "@/domain/types";
export default function FacsimileViewer({media}:{media:Facsimile[]}){
  const dialog=useRef<HTMLDialogElement>(null),[selected,setSelected]=useState<Facsimile|null>(null),[zoom,setZoom]=useState(1);
  return <div className="facsimiles">{media.map((m,i)=><figure key={m.imageUrl}>
    <figcaption>{m.role} · página {m.page}</figcaption>
    <button className="image-button" aria-label={`Ampliar ${m.role}, página ${m.page}`} onClick={()=>{setSelected(m);setZoom(1);dialog.current?.showModal();}}>
      {/* Native images preserve source pixels; no format-changing image optimization. */}
      <img src={m.imageUrl} alt={`${m.role}: fac-símile da página ${m.page}`} />
    </button>
    <a href={`${m.pdfUrl}#page=${m.page}`} target="_blank" rel="noreferrer">Abrir página original ↗</a>
  </figure>)}
    <dialog ref={dialog} className="image-dialog"><div className="dialog-toolbar"><strong>{selected?.role}</strong>
      <button onClick={()=>setZoom(z=>Math.max(1,z-.5))} disabled={zoom<=1}>−</button><span>{Math.round(zoom*100)}%</span>
      <button onClick={()=>setZoom(z=>Math.min(4,z+.5))} disabled={zoom>=4}>+</button><button onClick={()=>dialog.current?.close()}>Fechar imagem</button></div>
      <div className="image-scroll">{selected&&<img src={selected.imageUrl} alt={selected.role} style={{width:`${zoom*100}%`,maxWidth:"none"}}/>}</div>
    </dialog>
  </div>;
}
