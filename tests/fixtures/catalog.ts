// Synthetic fixtures used ONLY by tests via request interception. No production fallback.
import { readFileSync } from "node:fs";
import type { Catalog,Question } from "../../src/domain/types";
const base=JSON.parse(readFileSync("public/data/catalog.json","utf8")) as Catalog;
export function trainingQuestion(n:number):Question {
  const sha="a".repeat(64),keySha="b".repeat(64);
  const q:Question={...structuredClone(base.questions[0]),id:`TEST-Q${n}`,examId:"TEST",number:n,
    discipline:"Matemática",topic:"Sistemas lineares",subtopic:"Fixture sintética",text:"CONTEÚDO SINTÉTICO, SEM VALOR DE PROVA",
    partition:n===4?"teste":"treino",reservedForEvaluation:n===4,answer:"E",readyForTraining:n!==5,blockers:[],
    audit:{revision:n.toString().repeat(64),complete:true,versionChecked:true,sharedContentChecked:true,
      sourceDocument:"CADERNO-SINTETICO.pdf",sourceSha256:sha,sourceNumber:n,reviewedAt:"2026-10-05",reviewedBy:"Fixture de teste",
      note:"Não é uma questão oficial nem conteúdo liberado para usuário.",
      media:[{imageUrl:`/sources/rendered/test-${n}.png`,pdfUrl:"/sources/fixture.pdf",document:"CADERNO-SINTETICO.pdf",sha256:sha,page:1,crop:[0,0,1,1],role:"Questão sintética com gráfico e alternativas"}],
      key:n===5?null:{document:"GABARITO-SINTETICO.pdf",sha256:keySha,page:1,number:n,answer:(["A","B","C","D"] as const)[n-1],appliesToSha256:sha,alternativesChecked:true}}};
  return q;
}
export function trainingCatalog():Catalog{
  const questions=[1,2,3,4,5].map(trainingQuestion);
  return {...structuredClone(base),questions,exams:[{id:"TEST",title:"Fixture sintética de teste",origin:"official",count:5,answers:4,date:null,dateStatus:"Teste",document:"CADERNO-SINTETICO.pdf",readyCount:4,authenticity:"SINTÉTICO PARA TESTE"}],stats:{...base.stats,questions:5,official:5,thirdParty:0,ready:4}};
}
