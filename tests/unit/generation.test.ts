import { afterEach,beforeEach,describe,expect,it } from "vitest";
import { mkdtemp,readFile,rm } from "node:fs/promises";
import type { PlanProvider,ConnectionState,InferenceResult } from "../../src/ai/protocol";
import type { Catalog } from "../../src/domain/types";
import { areaOf,areas } from "../../src/domain/classification";
import { defaultPlan } from "../../src/domain/proof-plan";
import { GenerationManager,blueprint,draftSchema,reviewSchema,type Slot } from "../../src/server/ai/generation";
import { draft,firstPlan } from "../fixtures/authored";
const catalog=JSON.parse(await readFile("public/data/catalog.json","utf8")) as Catalog;
let folder="",prior:string|undefined;
beforeEach(async()=>{prior=process.env.INSPER_LOCAL_DATA_DIR;folder=await mkdtemp("/tmp/insper-generation-test-");process.env.INSPER_LOCAL_DATA_DIR=folder;});
afterEach(async()=>{if(prior===undefined)delete process.env.INSPER_LOCAL_DATA_DIR;else process.env.INSPER_LOCAL_DATA_DIR=prior;await rm(folder,{recursive:true,force:true});});
class MockProvider implements PlanProvider{
  calls=0;draftCalls=0;reviewCalls=0;last:any[]=[];firstValidated=true;rejectReview=false;failAfter=Infinity;
  async status(){return {status:"connected",inferenceValidated:this.firstValidated,message:"MOCK ONLY"} as ConnectionState;}
  async infer(prompt:string,schema:unknown):Promise<InferenceResult>{
    this.calls++;if(this.calls>this.failAfter)throw new Error("429 rate limit");let value:unknown;
    if(schema===draftSchema){this.draftCalls++;const slots=JSON.parse(prompt.match(/posição: (\[.*?\])\./)![1]) as Slot[];
      this.last=slots.map((s,i)=>{const q=draft(this.draftCalls*10+i,s.discipline,s.topic);if(s.topic!=="Sistemas lineares"){q.linearSystem=null;q.stem=`Enunciado sintético ${this.draftCalls*10+i}; somente para testar cotas e lotes.`;}return q;});value={questions:this.last};
    }else{expect(schema).toBe(reviewSchema);this.reviewCalls++;value={reviews:this.last.map((q,i)=>({index:i,approved:!this.rejectReview,answer:"A",explanation:q.explanation+" Revisão independente.",reason:this.rejectReview?"Ambiguidade sintética":"Conferido no mock"}))};}
    return {value,model:"mock-model",turnId:`resp_mock_${this.calls}`};
  }
}
async function terminal(manager:GenerationManager,id:string){for(let i=0;i<200;i++){const j=await manager.get(id);if(["completed","failed","cancelled"].includes(j.status))return j;await new Promise(r=>setTimeout(r,5));}throw new Error("Job não terminou.");}
describe("geração: chamadas simuladas, sem inferência autenticada",()=>{
 it("o primeiro teste exige três sistemas; libera apenas depois da revisão e do cálculo independente",async()=>{
  const provider=new MockProvider();provider.firstValidated=false;const m=new GenerationManager(provider,async()=>catalog);
  await expect(m.start(defaultPlan())).rejects.toThrow("primeiro");const job=await m.start(firstPlan());expect(job.questions).toHaveLength(0);const final=await terminal(m,job.id);
  expect(final.status).toBe("completed");expect(final.questions).toHaveLength(3);expect(final.questions.every(q=>q.provenance.verification==="linear-solver")).toBe(true);expect(provider.calls).toBe(2);expect(final.questions.every(q=>q.id.startsWith("AI-")&&q.explanation.endsWith("Revisão independente."))).toBe(true);
 });
 it("cria prova completa com 60 questões e 15 por área, em 12 lotes revisados",async()=>{
  const provider=new MockProvider(),manager=new GenerationManager(provider,async()=>catalog),slots=blueprint(defaultPlan(),catalog);
  expect(slots).toHaveLength(60);for(const area of areas)expect(slots.filter(s=>areaOf(s.discipline)===area)).toHaveLength(15);
  const j=await manager.start(defaultPlan()),final=await terminal(manager,j.id);expect(final.status).toBe("completed");expect(final.questions).toHaveLength(60);expect(provider.draftCalls).toBe(12);expect(provider.reviewCalls).toBe(12);expect(new Set(final.questions.map(q=>q.id)).size).toBe(60);
 });
 it("rejeita revisão discordante, não cria prova parcial nem usa banco como substituição",async()=>{
  const p=new MockProvider();p.rejectReview=true;const m=new GenerationManager(p,async()=>catalog),j=await m.start(firstPlan()),final=await terminal(m,j.id);
  expect(final.status).toBe("failed");expect(final.questions).toHaveLength(0);expect(final.message).toContain("não passou");expect(p.calls).toBe(4);
 });
 it("salva lotes concluídos quando o plano limita a geração; retoma e recupera após reinício",async()=>{
  const p=new MockProvider();p.failAfter=2;const m=new GenerationManager(p,async()=>catalog),plan=firstPlan();plan.lines[0].quantity=7;
  const j=await m.start(plan),failed=await terminal(m,j.id);expect(failed.status).toBe("failed");expect(failed.accepted).toBe(5);expect(failed.total).toBe(7);expect(failed.message).toContain("limite");
  p.failAfter=Infinity;await m.resume(j.id);const complete=await terminal(m,j.id);expect(complete.status).toBe("completed");expect(complete.questions).toHaveLength(7);expect(complete.questions.slice(0,5)).toEqual(failed.questions);
  const recovered=await new GenerationManager(p,async()=>catalog).get(j.id);expect(recovered.questions).toEqual(complete.questions);
 });
 it("rejeita pedidos simultâneos e mantém a classificação do assunto sem completar com outros",async()=>{
  const p=new MockProvider(),m=new GenerationManager(p,async()=>catalog);const first=m.start(firstPlan());await expect(m.start(firstPlan())).rejects.toThrow("andamento");const j=await first;expect((await terminal(m,j.id)).questions.every(q=>q.topic==="Sistemas lineares")).toBe(true);
  const plan=firstPlan();plan.lines[0].topic="Assunto inexistente";expect(()=>blueprint(plan,catalog)).toThrow("assunto");
 });
});
