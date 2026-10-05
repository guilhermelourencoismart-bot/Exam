"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import { ActiveClock,addElapsed,finishAttempt,type Attempt } from "@/domain/training";
import { readAttempt,saveAttempt } from "@/storage/indexed-db";
export function useAttemptSession(initial:Attempt,onSaved:()=>void,onRunningChange:(running:boolean)=>void){
  const [attempt,setAttempt]=useState(initial),[running,setRunning]=useState(false),[pending,setPending]=useState(false);
  const [error,setError]=useState(""),[extraMs,setExtraMs]=useState(0);
  const current=useRef(initial),clock=useRef(new ActiveClock()),mounted=useRef(false),saving=useRef(false);
  const tail=useRef<Promise<unknown>>(Promise.resolve()),release=useRef<(()=>void)|null>(null);
  const savedCallback=useRef(onSaved),runningCallback=useRef(onRunningChange);
  savedCallback.current=onSaved;runningCallback.current=onRunningChange;
  const publishRunning=useCallback((value:boolean)=>{if(mounted.current)setRunning(value);runningCallback.current(value);},[]);
  const releaseLock=useCallback(()=>{release.current?.();release.current=null;},[]);
  const commit=useCallback((edit:(a:Attempt)=>Attempt=(a)=>a,pause=false,optimistic=false)=>{
    if(optimistic&&mounted.current)setAttempt(view=>edit(view));
    const operation=async()=>{
      if(current.current.status==="completed")return current.current;
      saving.current=true;if(mounted.current)setPending(true);
      try{
        const now=performance.now(),delta=pause?clock.current.pause(now):clock.current.checkpoint(now);
        if(pause&&mounted.current)setRunning(false);
        const prior=current.current,next=edit(addElapsed(prior,delta));
        const saved=await saveAttempt(next,prior.revision);
        current.current=saved;if(mounted.current){setAttempt(saved);setExtraMs(0);}
        if(pause)publishRunning(false);
        savedCallback.current();return saved;
      }catch(e){
        clock.current.pause(performance.now());publishRunning(false);releaseLock();
        if(mounted.current)setAttempt(current.current);
        if(mounted.current)setError(e instanceof Error?e.message:"Falha ao salvar. O treino foi pausado.");
        throw e;
      }finally{saving.current=false;if(mounted.current)setPending(false);}
    };
    const result=tail.current.then(operation);tail.current=result.catch(()=>{});return result;
  },[publishRunning,releaseLock]);
  const pause=useCallback(async()=>{try{await commit(a=>a,true);}finally{releaseLock();}},[commit,releaseLock]);
  const resume=useCallback(async()=>{
    if(error||current.current.status==="completed"||document.visibilityState!=="visible")return;
    if(!navigator.locks){setError("Use um navegador atualizado para retomar o treino com proteção entre abas.");return;}
    if(!release.current){
      const ready=new Promise<boolean>(resolve=>{
        void navigator.locks.request(`insper-attempt:${initial.id}`,{ifAvailable:true},async lock=>{
          if(!lock){resolve(false);return;}
          await new Promise<void>(unlock=>{release.current=unlock;resolve(true);});
        }).catch(()=>resolve(false));
      });
      if(!await ready){if(mounted.current)setError("Esta tentativa está em uso em outra aba. Pause lá e reabra aqui.");return;}
      if(!mounted.current){releaseLock();return;}
    }
    try{
      const latest=await readAttempt(initial.id);if(!latest||latest.status==="completed")throw new Error("Tentativa já finalizada ou indisponível. Volte à lista.");
      if(!mounted.current){releaseLock();return;}
      current.current=latest;setAttempt(latest);clock.current.resume(performance.now());publishRunning(true);
    }catch(e){releaseLock();setError(e instanceof Error?e.message:"Falha ao retomar.");}
  },[error,initial.id,publishRunning,releaseLock]);
  useEffect(()=>{
    mounted.current=true;let lastSaved=performance.now();
    const tick=setInterval(()=>{
      if(!clock.current.running)return;
      const now=performance.now();setExtraMs(clock.current.preview(now));
      if(now-lastSaved>=1000&&!saving.current){lastSaved=now;void commit().catch(()=>{});}
    },200);
    const stop=()=>{if(clock.current.running)void pause().catch(()=>{});};
    const visibility=()=>{if(document.visibilityState!=="visible")stop();};
    document.addEventListener("visibilitychange",visibility);window.addEventListener("pagehide",stop);
    return()=>{
      mounted.current=false;clearInterval(tick);document.removeEventListener("visibilitychange",visibility);window.removeEventListener("pagehide",stop);
      if(clock.current.running)void pause().catch(()=>{});else releaseLock();
    };
  },[commit,pause,releaseLock]);
  async function finish(){await commit(a=>finishAttempt(a),true);releaseLock();}
  return {attempt,running,pending,error,extraMs,resume,pause,commit,finish};
}
