import "fake-indexeddb/auto";
import { beforeEach,describe,expect,it } from "vitest";
import { emptyFilters } from "../../src/domain/catalog";
import { ActiveClock,addElapsed,availableForTraining,canTrain,createAttempt,finishAttempt,gradeAttempt,reviewErrors } from "../../src/domain/training";
import { exportBackup,mergeBackup,readAttempts,readBookmarks,saveAttempt } from "../../src/storage/indexed-db";
import { validateBackup } from "../../src/storage/backup";
import { trainingCatalog,trainingQuestion } from "../fixtures/catalog";
const qs=trainingCatalog().questions;
beforeEach(async()=>{await new Promise<void>((resolve,reject)=>{const r=indexedDB.deleteDatabase("insper-pessoal-v1");r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);});});
describe("treino e versão",()=>{
  it("exige completude, mídia e pareamento de alternativas; exclui reservadas por padrão",()=>{
    expect(availableForTraining(qs,emptyFilters)).toHaveLength(3);
    expect(availableForTraining(qs,emptyFilters,true)).toHaveLength(4);
    const q=trainingQuestion(1);q.audit!.key!.appliesToSha256="c".repeat(64);expect(canTrain(q)).toBe(false);
    const withoutKey=trainingQuestion(5);expect(canTrain(withoutKey)).toBe(false);
  });
  it("não completa uma lista com outra disciplina ou sem gabarito",()=>{
    expect(()=>createAttempt(qs,4,"Sistemas")).toThrow("Há 3 questões");
    const available=availableForTraining(qs,{...emptyFilters,discipline:"Biologia"});
    expect(available).toEqual([]);expect(()=>createAttempt(available,1,"Biologia")).toThrow();
  });
  it("corrige com a versão conferida, separando branco de erro",()=>{
    let a=createAttempt(qs,3,"Teste");a.answers={"TEST-Q1":"A","TEST-Q2":"A","TEST-Q3":null};
    a=addElapsed(a,5000);a.currentIndex=1;a=addElapsed(a,7000);a=finishAttempt(a);
    const r=gradeAttempt(a);expect(r.correct).toBe(1);expect(r.wrong).toBe(1);expect(r.blank).toBe(1);
    expect(r.percentage).toBeCloseTo(100/3);expect(r.totalMs).toBe(12000);
    expect(r.rows[0].expected).toBe("A"); // database placeholder E must never be used
    expect(reviewErrors([a]).map(e=>e.item.id)).toEqual(["TEST-Q2"]);
  });
  it("um relógio monotônico não conta pausa nem tempo fechado",()=>{
    const c=new ActiveClock();c.resume(100);expect(c.checkpoint(2100)).toBe(2000);
    expect(c.pause(3100)).toBe(1000);expect(c.checkpoint(100000)).toBe(0);
    c.resume(200000);expect(c.checkpoint(201000)).toBe(1000);expect(c.pause(202000)).toBe(1000);
  });
  it("migra a base v1 sem perder marcações",async()=>{
    await new Promise<void>((resolve,reject)=>{const r=indexedDB.open("insper-pessoal-v1",1);
      r.onupgradeneeded=()=>r.result.createObjectStore("bookmarks",{keyPath:"questionId"});
      r.onsuccess=()=>{const db=r.result,tx=db.transaction("bookmarks","readwrite");tx.objectStore("bookmarks").put({questionId:"TEST-Q1",savedAt:new Date().toISOString()});tx.oncomplete=()=>{db.close();resolve();};};r.onerror=()=>reject(r.error);});
    expect((await readBookmarks())[0].questionId).toBe("TEST-Q1");expect(await readAttempts()).toEqual([]);
  });
  it("respostas, tempos e posição persistem; escrita concorrente é rejeitada",async()=>{
    let a=await saveAttempt(createAttempt(qs,3,"Teste"),null);const old=structuredClone(a);
    a.answers["TEST-Q1"]="B";a=addElapsed(a,3500);a.currentIndex=1;a=await saveAttempt(a,a.revision);
    expect((await readAttempts())[0]).toEqual(a);
    await expect(saveAttempt(old,old.revision)).rejects.toThrow("outra aba");
    const finished=await saveAttempt(finishAttempt(a),a.revision);
    await expect(saveAttempt({...finished,status:"paused"},finished.revision)).rejects.toThrow("finalizada");
  });
  it("backup restaura tentativas e não aceita troca de gabarito ou tempo inconsistente",async()=>{
    const a=await saveAttempt(finishAttempt(createAttempt(qs,3,"Teste")),null);
    const backup=await exportBackup(),ids=new Set(qs.map(q=>q.id));
    const parsed=validateBackup(backup,ids,qs);expect(parsed.attempts[0]).toEqual(a);
    const forged=structuredClone(backup);forged.attempts[0].items[0].audit!.key!.answer="E";
    expect(()=>validateBackup(forged,ids,qs)).toThrow("versão");
    const badTime=structuredClone(backup);badTime.attempts[0].totalMs=5000;
    expect(()=>validateBackup(badTime,ids,qs)).toThrow();
    await new Promise<void>(resolve=>{const r=indexedDB.deleteDatabase("insper-pessoal-v1");r.onsuccess=()=>resolve();});
    await mergeBackup(parsed);expect(await readAttempts()).toEqual([a]);
    expect((await mergeBackup(parsed)).keptAttempts).toBe(1);expect(await readAttempts()).toHaveLength(1);
  });
  it("aceita backup da primeira etapa, sem tentar inventar tentativas",()=>{
    const parsed=validateBackup({app:"insper-pessoal",schemaVersion:1,exportedAt:new Date().toISOString(),bookmarks:[]},new Set());
    expect(parsed.schemaVersion).toBe(3);expect(parsed.attempts).toEqual([]);
  });
});
