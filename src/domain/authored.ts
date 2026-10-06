import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { areaOf } from "./classification";
import type { Letter } from "./types";
import { searchKey } from "./catalog";

export type QuestionDraft = { discipline: string; topic: string; stem: string;
  options: Record<Letter,string>; answer: Letter; explanation: string;
  linearSystem: { coefficients: number[][]; constants: number[]; optionSolutions: Record<Letter,number[]> } | null };
export type AuthoredQuestion = QuestionDraft & { schemaVersion:1; id:string; revision:string;
  provenance:{provider:"chatgpt-plan"; model:string; reviewerModel:string; generatedAt:string;
    generationId:string; generationTurnId:string; reviewTurnId:string; verification:"linear-solver"|"model-review"} };
const abc = ["A","B","C","D","E"] as const;
function canonical(value:unknown):unknown{
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>[k,canonical(v)]));
  return value;
}
export function digest(value:unknown) { return bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(canonical(value))))); }
function nonempty(x:unknown,limit=20000):x is string{return typeof x==="string"&&x.trim().length>0&&x.length<=limit;}
function record(x:unknown):x is Record<string,unknown>{return !!x&&typeof x==="object"&&!Array.isArray(x);}
function exact(x:Record<string,unknown>,keys:readonly string[]){return Object.keys(x).sort().join("|") === [...keys].sort().join("|");}
export function validateDraft(input:unknown):QuestionDraft{
  if(!record(input)||!exact(input,["discipline","topic","stem","options","answer","explanation","linearSystem"])||
    !nonempty(input.discipline,100)||areaOf(input.discipline)==="Não classificada"||!nonempty(input.topic,200)||
    !nonempty(input.stem)||!nonempty(input.explanation)||!abc.includes(input.answer as Letter)||!record(input.options)||!exact(input.options,abc)||
    abc.some(l=>!nonempty((input.options as Record<string,unknown>)[l],4000)))throw new Error("A IA devolveu uma questão incompleta ou fora do formato. Nada foi liberado.");
  const q=input as QuestionDraft;
  if(new Set(abc.map(l=>q.options[l].trim().toLowerCase())).size!==5)throw new Error("As cinco alternativas precisam ser diferentes.");
  if(/(?:figura|gráfico|imagem|texto) (?:abaixo|acima|a seguir)|considere a figura|ver imagem/i.test(q.stem))throw new Error("A questão depende de um elemento não incorporado. Solicite uma questão autossuficiente.");
  if(q.linearSystem!==null){
    const s=q.linearSystem,n=s?.coefficients?.length;
    if(!record(s)||!exact(s,["coefficients","constants","optionSolutions"])||!Array.isArray(s.coefficients)||n<2||n>3||
      s.coefficients.some(r=>!Array.isArray(r)||r.length!==n||r.some(v=>!Number.isSafeInteger(v)||Math.abs(v)>10000))||
      !Array.isArray(s.constants)||s.constants.length!==n||s.constants.some(v=>!Number.isSafeInteger(v)||Math.abs(v)>1000000)||
      !record(s.optionSolutions)||!exact(s.optionSolutions,abc)||abc.some(l=>!Array.isArray(s.optionSolutions[l])||s.optionSolutions[l].length!==n||s.optionSolutions[l].some(v=>!Number.isFinite(v)||Math.abs(v)>1000000)))throw new Error("Dados do sistema linear inválidos.");
    if(abc.some(l=>q.options[l]!==`(${s.optionSolutions[l].join("; ")})`))throw new Error("As alternativas escritas não correspondem às soluções do sistema.");
  }
  return structuredClone(q);
}
// Solve by pivoted elimination; never execute model-provided code.
export function verifyLinear(q:QuestionDraft):boolean{
  const s=q.linearSystem;if(!s)return false;
  const n=s.coefficients.length,m=s.coefficients.map((r,i)=>[...r,s.constants[i]]);
  for(let c=0;c<n;c++){
    let p=c;for(let r=c+1;r<n;r++)if(Math.abs(m[r][c])>Math.abs(m[p][c]))p=r;
    if(Math.abs(m[p][c])<1e-10)return false;
    [m[p],m[c]]=[m[c],m[p]];const div=m[c][c];for(let j=c;j<=n;j++)m[c][j]/=div;
    for(let r=0;r<n;r++)if(r!==c){const factor=m[r][c];for(let j=c;j<=n;j++)m[r][j]-=factor*m[c][j];}
  }
  const correct=abc.filter(l=>s.optionSolutions[l].every((v,i)=>Math.abs(v-m[i][n])<1e-7));
  return correct.length===1&&correct[0]===q.answer;
}
export function questionIdentity(q:QuestionDraft){
  const normalized=(s:string)=>searchKey(s).replace(/\s+/g," ").trim();
  const system=q.linearSystem?.coefficients.map((r,i)=>[...r,q.linearSystem!.constants[i]]).sort((a,b)=>JSON.stringify(a)<JSON.stringify(b)?-1:JSON.stringify(a)>JSON.stringify(b)?1:0)||null;
  return `AI-${digest({stem:normalized(q.stem),options:Object.values(q.options).map(normalized).sort(),system})}`;
}
export function sealQuestion(q:QuestionDraft,provenance:AuthoredQuestion["provenance"]):AuthoredQuestion{
  const core={...validateDraft(q),schemaVersion:1 as const,id:questionIdentity(q),provenance};
  return {...core,revision:digest(core)};
}
export function validateAuthored(input:unknown):AuthoredQuestion{
  if(!record(input)||!exact(input,["discipline","topic","stem","options","answer","explanation","linearSystem","schemaVersion","id","revision","provenance"]))throw new Error("Questão autoral inválida.");
  const {schemaVersion,id,revision,provenance,...draft}=input;
  const q=validateDraft(draft);
  if(schemaVersion!==1||id!==questionIdentity(q)||!record(provenance)||!exact(provenance,["provider","model","reviewerModel","generatedAt","generationId","generationTurnId","reviewTurnId","verification"])||
    provenance.provider!=="chatgpt-plan"||!nonempty(provenance.model,200)||!nonempty(provenance.reviewerModel,200)||!nonempty(provenance.generationId,128)||
    !nonempty(provenance.generationTurnId,128)||!nonempty(provenance.reviewTurnId,128)||!nonempty(provenance.generatedAt,100)||!Number.isFinite(Date.parse(provenance.generatedAt))||
    !["linear-solver","model-review"].includes(provenance.verification as string)||
    (provenance.verification==="linear-solver"&&!verifyLinear(q)))throw new Error("Revisão ou identidade da questão autoral inválida.");
  const sealed=sealQuestion(q,provenance as AuthoredQuestion["provenance"]);
  if(revision!==sealed.revision)throw new Error("O conteúdo ou o gabarito da questão autoral foi alterado.");
  return sealed;
}
