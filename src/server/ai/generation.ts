import { randomUUID } from "node:crypto";
import type { Catalog } from "@/domain/types";
import { areaOf,disciplinesByArea } from "@/domain/classification";
import { searchKey } from "@/domain/catalog";
import { validatePlan,type ProofPlan } from "@/domain/proof-plan";
import { questionIdentity,sealQuestion,validateDraft,verifyLinear,type QuestionDraft } from "@/domain/authored";
import type { GenerationJob,PlanProvider } from "@/ai/protocol";
import { readPrivate,writePrivate } from "./local-files";
import { AiError,safeAiError } from "./errors";
export const batchSize=5;
const object=(properties:Record<string,unknown>)=>({type:"object",additionalProperties:false,properties,required:Object.keys(properties)});
const string={type:"string"},letters=["A","B","C","D","E"];
const optionProperties=Object.fromEntries(letters.map(l=>[l,string]));
export const draftSchema=object({questions:{type:"array",items:object({discipline:string,topic:string,stem:string,options:object(optionProperties),answer:{type:"string",enum:letters},explanation:string,
  linearSystem:{anyOf:[{type:"null"},object({coefficients:{type:"array",items:{type:"array",items:{type:"integer"}}},constants:{type:"array",items:{type:"integer"}},optionSolutions:object(Object.fromEntries(letters.map(l=>[l,{type:"array",items:{type:"number"}}])))})]}})}});
export const reviewSchema=object({reviews:{type:"array",items:object({index:{type:"integer"},approved:{type:"boolean"},answer:{type:"string",enum:letters},explanation:string,reason:string})}});
export type Slot={discipline:string;topic:string};
export function isFirstTest(plan:ProofPlan){return plan.mode==="custom"&&plan.lines.length===1&&plan.lines[0].quantity===3&&plan.lines[0].discipline==="Matemática"&&searchKey(plan.lines[0].topic)==="sistemas lineares";}
export function blueprint(plan:ProofPlan,catalog:Catalog):Slot[]{
  if(!validatePlan(plan)||plan.origin!=="ai")throw new AiError("plan","Confira as matérias, os assuntos e as quantidades.");
  const result:Slot[]=[];
  for(const line of plan.lines){
    const disciplines=(line.discipline?[line.discipline]:disciplinesByArea[line.area]).filter(d=>!line.topic||catalog.questions.some(q=>q.discipline===d&&q.topic===line.topic));
    if(!disciplines.length)throw new AiError("classification","O assunto não corresponde a esta matéria ou disciplina.");
    for(let i=0;i<line.quantity;i++){
      const discipline=disciplines[i%disciplines.length];
      const topics=[...new Set(catalog.questions.filter(q=>q.discipline===discipline).map(q=>q.topic))].sort();
      if(!topics.length||(line.topic&&!topics.includes(line.topic)))throw new AiError("classification","O assunto não corresponde à classificação desta disciplina. Escolha a disciplina e o assunto nos seletores.");
      result.push({discipline,topic:line.topic||topics[Math.floor(i/disciplines.length)%topics.length]});
    }
  }
  if(plan.mode==="full"&&["Matemática","Português","Ciências Humanas","Ciências da Natureza"].some(a=>result.filter(s=>areaOf(s.discipline)===a).length!==15))throw new AiError("composition","A composição da prova completa precisa ter 15 questões por área.");
  return result;
}
export function generationPrompt(slots:Slot[],first:boolean,avoid:string[],retry:string){return `Gere exatamente ${slots.length} questões novas de vestibular, estilo de dificuldade Insper, sem reproduzir provas ou usar um banco. Esta é criação autoral, não prova oficial. Cada questão deve ser independente, completa, resolvível sem arquivos, imagens, pesquisa ou contexto externo, com cinco alternativas A–E distintas e exatamente uma correta. Textos de apoio devem ser autorais e estar incluídos no enunciado. Use fórmulas em texto Unicode legível, não HTML/LaTeX e não links. Inclua resolução detalhada coerente com o gabarito. Não invente citações históricas ou fontes. Siga exatamente a classificação e a ordem de cada posição: ${JSON.stringify(slots)}.
${first?"As três questões devem ser de sistemas lineares 2×2 ou 3×3 com solução única, coeficientes e constantes inteiros, alternativas contendo os vetores de solução. Varie o contexto e a dificuldade.":""}
Para sistemas lineares com alternativas de solução, forneça linearSystem com coefficients, constants e optionSolutions. A interface exibirá as equações a partir desses dados. O stem deve explicar as incógnitas e pedir a solução, sem escrever outro sistema. Cada texto de alternativa deve ser exatamente '(x; y)' ou '(x; y; z)' com os valores de optionSolutions, separados por '; '. Para outros tipos de questão use linearSystem=null.
Não repita os seguintes enunciados já aceitos: ${JSON.stringify(avoid)}.
${retry?`O lote anterior não foi aprovado: ${retry}. Refaça o lote inteiro corrigindo o problema.`:""}`;}
export function reviewPrompt(questions:QuestionDraft[]){return `Resolva independentemente estas questões, sem acesso a um gabarito anterior. Confira integridade, ausência de referências externas, única alternativa correta, compatibilidade entre texto, alternativas e dados do sistema (que serão exibidos literalmente) e adequação ao assunto. Para cada índice zero-based retorne approved, answer, explanation e reason. Se houver ambiguidade, dado faltante, múltiplas respostas, fatos duvidosos ou sistema inconsistente, approved=false. Não aprove questões só pela aparência. As explicações devem mostrar o raciocínio. Questões: ${JSON.stringify(questions.map(({answer,explanation,...q})=>q))}`;}
function checkReviews(input:any,questions:QuestionDraft[]){
  if(!input||!Array.isArray(input.reviews)||input.reviews.length!==questions.length)throw new Error("Revisão incompleta.");
  for(let i=0;i<questions.length;i++){const r=input.reviews[i];if(!r||r.index!==i||r.approved!==true||r.answer!==questions[i].answer||typeof r.explanation!=="string"||r.explanation.trim().length<15)throw new Error("O revisor encontrou ambiguidade ou discordou do gabarito.");}
}
export class GenerationManager{
  private jobs=new Map<string,GenerationJob>();private controllers=new Map<string,AbortController>();private exclusions=new Map<string,Set<string>>();
  private starting=false;
  private tasks=new Map<string,Promise<void>>();
  constructor(private provider:PlanProvider,private catalog:()=>Promise<Catalog>){}
  async start(plan:ProofPlan,existingIds:string[]=[]){
    if(this.controllers.size||this.starting)throw new AiError("busy","Já há uma geração em andamento. Aguarde ou cancele antes de iniciar outra.",409);
    this.starting=true;try{
    const state=await this.provider.status();if(state.status!=="connected")throw new AiError("authentication",state.message||"Conecte o ChatGPT antes de gerar.",401);
    if(!state.inferenceValidated&&!isFirstTest(plan))throw new AiError("first_test","Faça primeiro o teste de três questões de sistemas lineares. Após exibi-las, as demais quantidades serão liberadas.",409);
    const slots=blueprint(plan,await this.catalog()),now=new Date().toISOString();
    const job:GenerationJob={id:randomUUID(),plan:structuredClone(plan),status:"generating",total:slots.length,accepted:0,message:"Preparando o primeiro lote…",createdAt:now,updatedAt:now,questions:[]};
    this.exclusions.set(job.id,new Set(existingIds));await this.save(job);this.run(job,slots);return structuredClone(job);
    }finally{this.starting=false;}
  }
  private async save(job:GenerationJob){job.updatedAt=new Date().toISOString();await writePrivate(`generation-${job.id}.json`,JSON.stringify(job));this.jobs.set(job.id,structuredClone(job));}
  private run(job:GenerationJob,slots:Slot[]){const controller=new AbortController();this.controllers.set(job.id,controller);
    const task=this.process(job,slots,controller.signal).catch(async e=>{this.controllers.delete(job.id);job.status=controller.signal.aborted?"cancelled":"failed";job.message=e instanceof AiError?e.message:safeAiError(e).message;await this.save(job);}).catch(()=>{job.status="failed";job.message="Não foi possível salvar os lotes no computador. Confira o espaço e as permissões da pasta privada antes de retomar.";this.jobs.set(job.id,structuredClone(job));}).finally(()=>{if(this.controllers.get(job.id)===controller)this.controllers.delete(job.id);if(this.tasks.get(job.id)===task)this.tasks.delete(job.id);});
    this.tasks.set(job.id,task);
  }
  private async process(job:GenerationJob,slots:Slot[],signal:AbortSignal){
    const seen=this.exclusions.get(job.id)||new Set<string>();job.questions.forEach(q=>seen.add(q.id));
    for(let offset=job.questions.length;offset<slots.length;offset+=batchSize){
      const batch=slots.slice(offset,offset+batchSize);let failure="";let accepted=false;
      for(let tries=0;tries<2&&!accepted;tries++){
        if(signal.aborted)throw new AiError("cancelled","Geração cancelada.",409);
        job.status="generating";job.message=`Gerando questões ${offset+1}–${offset+batch.length} de ${job.total}…`;await this.save(job);
        const generated=await this.provider.infer(generationPrompt(batch,isFirstTest(job.plan),job.questions.map(q=>q.stem),failure),draftSchema,signal);
        let drafts:QuestionDraft[];
        try{const value=generated.value as any;if(!value||!Array.isArray(value.questions)||value.questions.length!==batch.length)throw new Error("Quantidade incorreta no lote.");
          drafts=value.questions.map(validateDraft);const ids=drafts.map(questionIdentity);
          if(new Set(ids).size!==ids.length||ids.some(id=>seen.has(id)))throw new Error("O lote contém questão repetida.");
          if(drafts.some((q,i)=>q.discipline!==batch[i].discipline||q.topic!==batch[i].topic))throw new Error("O lote não respeitou os assuntos solicitados.");
          if(drafts.some(q=>q.linearSystem&&!verifyLinear(q))||(isFirstTest(job.plan)&&drafts.some(q=>!q.linearSystem)))throw new Error("O cálculo independente não confirmou a resposta do sistema.");
        }catch(e){failure=e instanceof Error?e.message:"Formato inválido.";continue;}
        job.status="reviewing";job.message=`Revisando questões ${offset+1}–${offset+batch.length}…`;await this.save(job);
        const reviewed=await this.provider.infer(reviewPrompt(drafts),reviewSchema,signal);
        try{checkReviews(reviewed.value,drafts);}catch(e){failure=e instanceof Error?e.message:"Revisão recusada.";continue;}
        if(signal.aborted)throw new AiError("cancelled","Geração cancelada.",409);
        const questions=drafts.map((q,i)=>sealQuestion({...q,explanation:(reviewed.value as {reviews:{explanation:string}[]}).reviews[i].explanation},{provider:"chatgpt-plan",model:generated.model,reviewerModel:reviewed.model,generatedAt:new Date().toISOString(),generationId:job.id,generationTurnId:generated.turnId,reviewTurnId:reviewed.turnId,verification:q.linearSystem?"linear-solver":"model-review"}));
        job.questions.push(...questions);questions.forEach(q=>seen.add(q.id));job.accepted=job.questions.length;accepted=true;await this.save(job);
      }
      if(!accepted)throw new AiError("quality",`O lote não passou pela revisão: ${failure} Nenhuma prova incompleta foi criada. Você pode tentar novamente.`,422);
    }
    if(signal.aborted)throw new AiError("cancelled","Geração cancelada.",409);
    if(job.questions.length!==job.total)throw new AiError("quantity","A quantidade completa não foi confirmada.",422);
    this.controllers.delete(job.id);job.status="completed";job.message=`${job.total} questões inéditas geradas e revisadas. Prontas para abrir.`;await this.save(job);
  }
  async get(id:string){if(!/^[a-f0-9-]{36}$/.test(id))throw new AiError("job","Geração desconhecida.",404);
    let job=this.jobs.get(id);if(!job){const text=await readPrivate(`generation-${id}.json`);if(!text)throw new AiError("job","Geração não encontrada neste computador.",404);job=JSON.parse(text) as GenerationJob;
      if(["generating","reviewing"].includes(job.status)){job.status="failed";job.message="O servidor foi reiniciado durante a geração. Retome para completar os lotes; nenhuma prova parcial foi criada.";await this.save(job);}this.jobs.set(id,job);}
    return structuredClone(job);
  }
  async cancel(id:string){await this.get(id);if(!this.controllers.has(id))throw new AiError("job","Esta geração já terminou.",409);this.controllers.get(id)!.abort();await this.tasks.get(id);return this.get(id);}
  async resume(id:string,existingIds:string[]=[]){if(this.controllers.size||this.starting)throw new AiError("busy","Aguarde a geração em andamento.",409);this.starting=true;try{const job=await this.get(id);
    if(!["failed","cancelled"].includes(job.status))throw new AiError("job","Esta geração não precisa ser retomada.",409);
    if((await this.provider.status()).status!=="connected")throw new AiError("authentication","Conecte o ChatGPT antes de retomar.",401);
    if(!(await this.provider.status()).inferenceValidated&&!isFirstTest(job.plan))throw new AiError("first_test","Faça o teste de três sistemas com esta conexão antes de retomar uma prova maior.",409);
    const slots=blueprint(job.plan,await this.catalog());this.exclusions.set(id,new Set(existingIds));job.status="generating";await this.save(job);this.run(job,slots);return structuredClone(job);
    }finally{this.starting=false;}}
  async cancelAll(){for(const id of this.controllers.keys())await this.cancel(id);}
}
