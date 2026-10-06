import { describe,expect,it } from "vitest";
import { readFileSync } from "node:fs";
import { areas } from "../../src/domain/classification";
import { comparable,comparableNew,defaultAnalysisFilters,filterResults,groupResults,historyComparison,ranked,recurringErrors,resultRows,simulateGain,studyPriorities,summarize,timeFindings,weightedScore } from "../../src/domain/analytics";
import { addElapsed,answerAttempt,createAttempt,finishAttempt,navigateAttempt,type Attempt } from "../../src/domain/training";
import { allocatePlan,attemptFromPlan,defaultPlan,fullLines,parseRequest } from "../../src/domain/proof-plan";
import { defaultPreferences } from "../../src/domain/preferences";
import { trainingQuestion } from "../fixtures/catalog";
import type { Catalog,Question } from "../../src/domain/types";
const catalog=JSON.parse(readFileSync("public/data/catalog.json","utf8")) as Catalog;
function q(n:number,discipline="Matemática",topic="Sistemas lineares"):Question{
 const base=trainingQuestion(1);return {...base,id:`ANALYTICS-${n}`,number:n,discipline,topic};
}
function completed(qs:Question[],outcomes:("correct"|"wrong"|"blank")[],date:string,id:string,times=qs.map(()=>1000)){
 let a=createAttempt(qs,qs.length,id,false,id,date);
 qs.forEach((question,i)=>{a=answerAttempt(a,question.id,outcomes[i]==="blank"?null:outcomes[i]==="correct"?"A":"E");a=navigateAttempt(a,i);a=addElapsed(a,times[i]);});
 return finishAttempt(a,date);
}
const qs=Array.from({length:10},(_,i)=>q(i+1));
describe("indicadores com resultados conhecidos",()=>{
 it("pondera tamanhos diferentes; separa brancos, repetições e tentativas não finalizadas",()=>{
  const a=completed(qs.slice(0,2),["correct","blank"],"2026-10-01T15:00:00Z","small",[60000,60000]);
  const b=completed(qs,["wrong",...Array(9).fill("correct")],"2026-10-02T15:00:00Z","large",Array(10).fill(30000));
  const pending=createAttempt(qs,1,"Ainda aberta");const rows=resultRows([b,pending,a],qs),s=summarize(rows);
  expect(s).toMatchObject({proofs:2,total:12,correct:10,wrong:1,blank:1,answered:11,first:10,repeated:2,timeCount:12,timeMs:420000,averageMs:35000});
  expect(s.percentage).toBeCloseTo(83.333333);expect(s.percentage).not.toBe(70);
  const first=filterResults(rows,{...defaultAnalysisFilters,firstOnly:true});expect(new Set(first.map(r=>r.item.id)).size).toBe(10);expect(first).toHaveLength(10);expect(summarize(first).correct).toBe(10);
  expect(first.find(r=>r.item.id===qs[1].id)!.attemptId).toBe("large"); // first actual answer, not earlier blank
  expect(rows.filter(r=>r.first).map(r=>r.attemptId)).toEqual(["small","small",...Array(8).fill("large")]);
 });
 it("usa denominadores de área, disciplina e assunto; percentual de brancos é avaliável",()=>{
  const questions=[q(1),q(2),q(3,"Física","Dinâmica"),q(4,"Química","Soluções"),q(5,"História","Brasil"),q(6,"Língua Portuguesa","Argumentação")];
  const rows=resultRows([completed(questions,["correct","blank","wrong","correct","correct","wrong"],"2026-10-01T15:00:00Z","areas",[1000,3000,5000,7000,11000,13000])],questions);
  const groups=groupResults(rows,"area");expect(groups).toHaveLength(4);expect(groups.find(g=>g.key==="Matemática")!.stats).toMatchObject({total:2,correct:1,blank:1,percentage:50,timeMs:4000,averageMs:2000});
  expect(groups.find(g=>g.key==="Ciências da Natureza")!.stats).toMatchObject({total:2,correct:1,wrong:1,timeMs:12000,averageMs:6000});
  expect(groupResults(rows,"discipline")).toHaveLength(5);expect(groupResults(rows,"topic")).toHaveLength(5);
 });
 it("não inventa tempo, visitas e mudanças ausentes",()=>{
  const a=completed(qs.slice(0,2),["correct","wrong"],"2026-10-01T15:00:00Z","old");delete a.telemetry;delete a.timesMs[qs[0].id];
  const rows=resultRows([a],qs),s=summarize(rows);expect(rows[0].timeMs).toBeNull();expect(s).toMatchObject({timeCount:1,timeMs:1000,averageMs:1000,visits:null,changes:null});
  expect(summarize([])).toMatchObject({percentage:null,timeMs:null,averageMs:null,visits:null,changes:null});
 });
 it("registra visitas e mudanças sem contar primeira escolha, mesma alternativa ou pausa",()=>{
  let a=createAttempt(qs,2,"Nova");expect(a.telemetry!.visits[qs[0].id]).toBe(1);expect(a.telemetry!.visits[qs[1].id]).toBe(0);
  a=answerAttempt(a,qs[0].id,"A");a=answerAttempt(a,qs[0].id,"A");expect(a.telemetry!.answerChanges[qs[0].id]).toBe(0);
  a=answerAttempt(a,qs[0].id,"B");a=answerAttempt(a,qs[0].id,null);expect(a.telemetry!.answerChanges[qs[0].id]).toBe(2);
  a=navigateAttempt(a,1);a=navigateAttempt(a,0);a=navigateAttempt(a,0);expect(a.telemetry!.visits[qs[0].id]).toBe(2);
  const old={...a,telemetry:undefined};expect(navigateAttempt(old,1).telemetry).toBeUndefined();expect(answerAttempt(old,qs[0].id,"E").telemetry).toBeUndefined();
 });
 it("compara composição, origem e tipo; histórico exclui questões repetidas",()=>{
  const a=completed(qs.slice(0,2),["correct","wrong"],"2026-10-01T15:00:00Z","a");
  const b=completed(qs,["wrong",...Array(9).fill("correct")],"2026-10-02T15:00:00Z","b");
  expect(comparable(a,b,qs)).toBe(true);
  const otherTopic=createAttempt([q(20,"Matemática","Função afim")],1,"Outro assunto");expect(comparable(a,otherTopic,qs)).toBe(false);
  const third={...b,items:b.items.map(i=>({...i,origin:"third-party" as const}))};expect(comparable(a,third,qs)).toBe(false);
  expect(comparable(a,{...a,kind:"review"},qs)).toBe(false);
  const rows=resultRows([a,b],qs),history=historyComparison(b,[a,b],rows,qs);expect(history.history.total).toBe(2);expect(history.current.total).toBe(8);expect(history.current.percentage).toBe(100);
  expect(history.best).toBe(100);expect(history.lastFive.total).toBe(10);expect(history.lastFiveCount).toBe(2);expect(history.lastFive.percentage).toBe(90);
 });
 it("filtra período em Brasília sem transformar repetição fora do período em questão nova",()=>{
  const a=completed([qs[0]],["correct"],"2026-10-01T01:00:00Z","a"),b=completed([qs[0]],["wrong"],"2026-10-06T01:00:00Z","b");
  const rows=resultRows([a,b],qs);expect(filterResults(rows,{...defaultAnalysisFilters,from:"2026-10-05",to:"2026-10-05"})).toHaveLength(1);
  expect(filterResults(rows,{...defaultAnalysisFilters,from:"2026-10-05",firstOnly:true})).toEqual([]);expect(rows[1].first).toBe(false);
 });
 it("reconfere composição depois de excluir repetições, sem comparar só Física com quatro áreas",()=>{
  const original=catalog.questions.filter(q=>q.examId==="P2026A"),replacement=catalog.questions.filter(q=>q.examId==="P2026B"&&q.discipline==="Física").slice(0,2);
  const removed=new Set(original.filter(q=>q.discipline==="Física").slice(0,2).map(q=>q.id)),mixed=[...original.filter(q=>!removed.has(q.id)),...replacement];
  const a=finishAttempt(createAttempt(original,60,"Original",false,"a","2026-10-01T15:00:00Z"),"2026-10-01T15:00:00Z"),b=finishAttempt(createAttempt(mixed,60,"Repetidas com duas novas",false,"b","2026-10-02T15:00:00Z"),"2026-10-02T15:00:00Z");
  const rows=resultRows([a,b],catalog.questions);expect(comparable(a,b,catalog.questions)).toBe(true);expect(rows.filter(r=>r.attemptId==="b"&&r.first)).toHaveLength(2);
  expect(comparableNew(a,b,rows,catalog.questions)).toBe(false);expect(historyComparison(b,[a,b],rows,catalog.questions).history.total).toBe(0);
 });
 it("nota ponderada usa somente pesos explícitos e requer as áreas com peso positivo",()=>{
  const questions=[q(1),q(2),q(3,"Língua Portuguesa","Argumentação")],rows=resultRows([completed(questions,["correct","wrong","correct"],"2026-10-01T15:00:00Z","weighted")],questions);
  const p={...defaultPreferences,course:{name:"Meu curso",source:"user" as const,weights:{Matemática:1,Português:1,"Ciências Humanas":0,"Ciências da Natureza":0}}};
  expect(weightedScore(rows,defaultPreferences)).toBeNull();expect(weightedScore(rows,p)).toBe(75);p.course.weights["Ciências da Natureza"]=1;expect(weightedScore(rows,p)).toBeNull();
 });
 it("simula apenas erros selecionados sem modificar acertos, brancos ou histórico",()=>{
  const a=completed(qs.slice(0,3),["correct","wrong","blank"],"2026-10-01T15:00:00Z","scenario"),rows=resultRows([a],qs),selected=new Set(rows.map(r=>r.key));
  const result=simulateGain(rows,selected);expect(result.gain).toBe(1);expect(result.before).toBeCloseTo(100/3);expect(result.after).toBeCloseTo(200/3);expect(summarize(rows).correct).toBe(1);
 });
 it("separa rankings por quantidade e taxa e contextualiza a amostra",()=>{
  const questions=[...qs,q(99,"Física","Dinâmica")],a=completed(questions,[...Array(8).fill("correct"),"wrong","wrong","wrong"],"2026-10-01T15:00:00Z","ranking"),groups=groupResults(resultRows([a],questions),"discipline");
  expect(ranked(groups,"wrong","count")[0].label).toBe("Matemática");expect(ranked(groups,"wrong","rate")[0].label).toBe("Física");expect(ranked(groups,"wrong","rate")[0].stats.total).toBe(1);
 });
 it("prioridades explicitam frequência, recorrência, amostra e tempo; erro rápido não é diagnóstico",()=>{
  const a=completed(qs,["wrong",...Array(9).fill("correct")],"2026-10-01T15:00:00Z","a",[10,...Array(9).fill(1000)]),b=completed([qs[0]],["wrong"],"2026-10-02T15:00:00Z","b",[2000]);
  const rows=resultRows([a,b],qs),priorities=studyPriorities(rows,qs);expect(priorities[0]).toMatchObject({officialCount:10,officialTotal:10,frequency:1,recurring:1,proofs:2});expect(priorities[0].stats.total).toBe(11);expect(priorities[0].score).toBeGreaterThan(0);
  expect(recurringErrors(rows)[0].count).toBe(2);expect(timeFindings(rows).fastWrong).toHaveLength(1);expect(timeFindings(rows.slice(0,2)).fastWrong).toBeNull();
 });
});
describe("composição e pedidos de provas",()=>{
 it("interpreta pedidos conhecidos sem chamar isso de geração",()=>{
  expect(parseRequest("5 questões de matemática; 20 questões de português",catalog.questions).map(l=>[l.area,l.quantity])).toEqual([["Matemática",5],["Português",20]]);
  expect(parseRequest("20 questões de sistemas",catalog.questions)[0]).toMatchObject({discipline:"Matemática",topic:"Sistemas lineares",quantity:20});expect(parseRequest("uma prova inteira",catalog.questions)).toEqual(fullLines());
  expect(()=>parseRequest("faça algo bem legal",catalog.questions)).toThrow();expect(()=>attemptFromPlan(defaultPlan(),catalog.questions)).toThrow("integração real");
 });
 it("monta 60 questões reais, 15 por área, com origem explícita",()=>{
  const plan={...defaultPlan(),origin:"official" as const,examId:"P2026A"},a=attemptFromPlan(plan,catalog.questions);expect(a.items).toHaveLength(60);expect(a.kind).toBe("full");
  for(const area of areas)expect(allocatePlan(plan,catalog.questions).find(l=>l.line.area===area)!.selected).toHaveLength(15);
  expect(a.items.every(i=>i.origin==="official")).toBe(true);expect(new Set(a.items.map(q=>q.id)).size).toBe(60);
 });
 it("não completa faltas com outro assunto e não duplica cotas sobrepostas",()=>{
  const plan={...defaultPlan(),mode:"custom" as const,origin:"official" as const,lines:[{area:"Matemática" as const,discipline:"Matemática",topic:"Sistemas lineares",quantity:5}]};
  expect(allocatePlan(plan,catalog.questions)[0].missing).toBe(3);expect(()=>attemptFromPlan(plan,catalog.questions)).toThrow("Faltam");
  const overlapping={...plan,lines:[{...plan.lines[0],topic:"",quantity:1},{...plan.lines[0],quantity:1}]};const a=allocatePlan(overlapping,qs.slice(0,2));expect(new Set(a.flatMap(x=>x.selected.map(q=>q.id))).size).toBe(2);
 });
});
