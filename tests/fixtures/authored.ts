import { sealQuestion,type QuestionDraft } from "../../src/domain/authored";
import { defaultPlan,type ProofPlan } from "../../src/domain/proof-plan";
export const generationId="11111111-1111-4111-8111-111111111111";
export function draft(n=1,discipline="Matemática",topic="Sistemas lineares"):QuestionDraft{
  const solutions={A:[n,n+1],B:[n+1,n],C:[0,0],D:[n+2,n+3],E:[-1,-1]};
  return {discipline,topic,stem:`Determine o par (x; y) que resolve o sistema abaixo. Exercício sintético ${n} usado exclusivamente no teste.`,
    options:Object.fromEntries(Object.entries(solutions).map(([l,v])=>[l,`(${v.join("; ")})`])) as QuestionDraft["options"],answer:"A",explanation:`Somando as equações, 2x = ${2*n}; portanto x = ${n}. Substituindo, y = ${n+1}. Alternativa A.`,
    linearSystem:{coefficients:[[1,1],[1,-1]],constants:[2*n+1,-1],optionSolutions:solutions}};
}
export function authored(n=1){return sealQuestion(draft(n),{provider:"chatgpt-plan",model:"mock-model",reviewerModel:"mock-model",generatedAt:"2026-10-06T00:00:00Z",generationId,generationTurnId:"resp_mock_generate",reviewTurnId:"resp_mock_review",verification:"linear-solver"});}
export function firstPlan():ProofPlan{return {...defaultPlan(),mode:"custom",prompt:"3 questões de sistemas lineares",lines:[{area:"Matemática",discipline:"Matemática",topic:"Sistemas lineares",quantity:3}]};}
