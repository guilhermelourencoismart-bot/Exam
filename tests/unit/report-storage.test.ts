import "fake-indexeddb/auto";
import { beforeEach,describe,expect,it } from "vitest";
import { createAttempt,finishAttempt } from "../../src/domain/training";
import { defaultPlan } from "../../src/domain/proof-plan";
import { defaultPreferences } from "../../src/domain/preferences";
import { validateBackup } from "../../src/storage/backup";
import { exportBackup,mergeBackup,readAttempts,readErrorNotes,readPlans,readPreferences,saveAttempt,saveErrorNote,savePlan,savePreferences } from "../../src/storage/indexed-db";
import { trainingCatalog } from "../fixtures/catalog";
const qs=trainingCatalog().questions,ids=new Set(qs.map(q=>q.id));
const reset=async()=>new Promise<void>((resolve,reject)=>{const r=indexedDB.deleteDatabase("insper-pessoal-v1");r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);});
beforeEach(reset);
describe("migração e backup dos relatórios",()=>{
 it("migra banco v2 preservando tentativas sem inventar telemetria",async()=>{
  const old=createAttempt(qs,1,"Antiga");delete old.telemetry;delete old.kind;old.items.forEach(i=>delete i.origin);
  await new Promise<void>((resolve,reject)=>{const r=indexedDB.open("insper-pessoal-v1",2);r.onupgradeneeded=()=>{r.result.createObjectStore("bookmarks",{keyPath:"questionId"});r.result.createObjectStore("attempts",{keyPath:"id"});};r.onsuccess=()=>{const db=r.result,tx=db.transaction("attempts","readwrite");tx.objectStore("attempts").put(old);tx.oncomplete=()=>{db.close();resolve();};};r.onerror=()=>reject(r.error);});
  expect(await readAttempts()).toEqual([old]);expect((await readAttempts())[0].telemetry).toBeUndefined();expect(await readPreferences()).toEqual(defaultPreferences);expect(await readPlans()).toEqual([]);
  const b=validateBackup({app:"insper-pessoal",schemaVersion:2,exportedAt:new Date().toISOString(),bookmarks:[],attempts:[old]},ids,qs);expect(b.attempts[0]).toEqual(old);
 });
 it("exporta e restaura metas, pesos, motivos, configurações e telemetria; importação preserva existentes",async()=>{
  let a=createAttempt(qs,2,"Nova");a.answers[qs[0].id]="E";a=await saveAttempt(finishAttempt(a),null);
  const prefs={...defaultPreferences,goalPercentage:80,areaGoals:{Matemática:85},course:{name:"Meu curso",source:"user" as const,weights:{Matemática:2,Português:1,"Ciências Humanas":0,"Ciências da Natureza":0}}};
  await savePreferences(prefs);await savePlan({id:"plan-1",title:"Pedido inédito",createdAt:new Date().toISOString(),plan:defaultPlan()});
  await saveErrorNote({id:`${a.id}::${qs[0].id}`,attemptId:a.id,questionId:qs[0].id,reason:"cálculo",updatedAt:new Date().toISOString()});
  const backup=validateBackup(await exportBackup(),ids,qs);expect(backup.schemaVersion).toBe(3);expect(backup.attempts[0].telemetry).toEqual(a.telemetry);
  await reset();await mergeBackup(backup);expect(await readAttempts()).toEqual([a]);expect(await readPreferences()).toEqual(prefs);expect((await readErrorNotes())[0].reason).toBe("cálculo");expect(await readPlans()).toHaveLength(1);
  await savePreferences({...prefs,goalPercentage:90});await mergeBackup(backup);expect((await readPreferences()).goalPercentage).toBe(90);
 });
 it("rejeita campos novos adulterados sem aceitar erro em branco, pesos presumidos ou visitas negativas",async()=>{
  const a=await saveAttempt(finishAttempt(createAttempt(qs,2,"Nova")),null),b=await exportBackup();
  const changes=[(x:typeof b)=>{x.attempts[0].telemetry!.visits[qs[0].id]=-1;},(x:typeof b)=>{x.preferences=[{...defaultPreferences,goalPercentage:101}];},(x:typeof b)=>{x.errorNotes=[{id:`${a.id}::${qs[0].id}`,attemptId:a.id,questionId:qs[0].id,reason:"conteúdo",updatedAt:new Date().toISOString()}];},(x:typeof b)=>{x.plans=[{id:"invalid",title:"Incompleta",createdAt:new Date().toISOString(),plan:{...defaultPlan(),lines:[]}}];}];
  for(const edit of changes){const copy=structuredClone(b);edit(copy);expect(()=>validateBackup(copy,ids,qs)).toThrow();}
  expect(await readAttempts()).toEqual([a]);
 });
 it("não associa um motivo importado ao acerto de uma tentativa existente com mesmo ID",async()=>{
  const a=createAttempt(qs,1,"Local");a.answers[qs[0].id]="A";await saveAttempt(finishAttempt(a),null);
  const backup=await exportBackup();backup.attempts[0].answers[qs[0].id]="E";
  backup.errorNotes=[{id:`${a.id}::${qs[0].id}`,attemptId:a.id,questionId:qs[0].id,reason:"cálculo",updatedAt:new Date().toISOString()}];
  await mergeBackup(validateBackup(backup,ids,qs));expect((await readAttempts())[0].answers[qs[0].id]).toBe("A");expect(await readErrorNotes()).toEqual([]);
  expect(validateBackup(await exportBackup(),ids,qs).attempts).toHaveLength(1);
 });
});
