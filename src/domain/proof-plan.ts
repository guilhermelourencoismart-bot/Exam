import { areas, areaOf, disciplinesByArea, type Area } from "./classification";
import { searchKey } from "./catalog";
import { canTrain, createAttempt, type Attempt } from "./training";
import type { Question } from "./types";
export type PlanLine = { area: Area; discipline: string; topic: string; quantity: number };
export type ProofPlan = { mode: "full" | "custom"; origin: "ai" | "official" | "third-party";
  examId: string; lines: PlanLine[]; includeReserved: boolean; prompt: string };
export type SavedPlan = { id: string; title: string; createdAt: string; plan: ProofPlan };
export function fullLines(): PlanLine[] { return areas.map(area => ({area, discipline: "", topic: "", quantity: 15})); }
export function defaultPlan(): ProofPlan { return {mode:"full",origin:"ai",examId:"",lines:fullLines(),includeReserved:false,prompt:""}; }
export function validatePlan(plan: ProofPlan): boolean {
  return !!plan && ["full","custom"].includes(plan.mode) && ["ai","official","third-party"].includes(plan.origin) &&
    typeof plan.examId === "string" && typeof plan.prompt === "string" && plan.prompt.length <= 3000 && typeof plan.includeReserved === "boolean" &&
    Array.isArray(plan.lines) && plan.lines.length > 0 && plan.lines.length <= 30 &&
    plan.lines.every(l => areas.includes(l.area) && Number.isInteger(l.quantity) && l.quantity > 0 && l.quantity <= 400 &&
      typeof l.discipline === "string" && (!l.discipline || disciplinesByArea[l.area].includes(l.discipline)) && typeof l.topic === "string" && l.topic.length <= 200) &&
    plan.lines.reduce((n,l) => n+l.quantity,0) <= 400 &&
    (plan.mode !== "full" || (plan.lines.length === 4 && areas.every(a => plan.lines.some(l => l.area === a && l.quantity === 15 && !l.discipline && !l.topic))));
}
export function parseRequest(input: string, questions: readonly Question[]): PlanLine[] {
  const text = searchKey(input.trim());
  if (/^(uma )?prova (inteira|completa)[.!]?$/.test(text)) return fullLines();
  const chunks = text.split(/\s*(?:;|\n|,| e (?=\d))\s*/).filter(Boolean);
  const allDisciplines = Object.values(disciplinesByArea).flat();
  return chunks.map(chunk => {
    const match = chunk.match(/^(\d+)\s+(?:questoes?\s+)?(?:de\s+)?(.+?)\s*[.!]?$/);
    if (!match) throw new Error('Use quantidade e matéria ou assunto, como “5 questões de matemática”. Confira a composição antes de salvar.');
    const quantity = Number(match[1]), request = match[2].trim();
    if (quantity < 1 || quantity > 400) throw new Error("Escolha entre 1 e 400 questões.");
    const aliases: Record<string,string> = {portugues:"Língua Portuguesa",humanas:"Ciências Humanas",natureza:"Ciências da Natureza",sistemas:"Sistemas lineares"};
    const normalized = searchKey(aliases[request] ?? request);
    const discipline = allDisciplines.find(d => searchKey(d) === normalized);
    const area = areas.find(a => searchKey(a) === normalized);
    if (discipline) return {area:areaOf(discipline) as Area,discipline,topic:"",quantity};
    if (area) return {area,discipline:"",topic:"",quantity};
    const candidates = questions.filter(q => searchKey(q.topic) === normalized || searchKey(q.topic).includes(normalized));
    const keys = new Set(candidates.map(q => `${q.discipline}::${q.topic}`));
    if (keys.size !== 1) throw new Error("Não foi possível identificar uma matéria e um assunto únicos. Use os seletores para configurar esse pedido.");
    const q = candidates[0]; return {area:areaOf(q.discipline) as Area,discipline:q.discipline,topic:q.topic,quantity};
  });
}
// Most specific lines are allocated first; a question can never fill two quotas.
export function allocatePlan(plan: ProofPlan, questions: readonly Question[]) {
  const used = new Set<string>();
  const result: { line: PlanLine; available: number; selected: Question[]; missing: number; index: number }[] = [];
  const eligible = questions.filter(q => canTrain(q) && q.origin === plan.origin && (!plan.examId || q.examId === plan.examId) && (plan.includeReserved || !q.reservedForEvaluation));
  const sorted = plan.lines.map((line,index) => ({line,index})).sort((a,b) => Number(!!b.line.topic)-Number(!!a.line.topic) || Number(!!b.line.discipline)-Number(!!a.line.discipline));
  for (const {line,index} of sorted) {
    const pool = eligible.filter(q => !used.has(q.id) && areaOf(q.discipline) === line.area && (!line.discipline || q.discipline === line.discipline) && (!line.topic || q.topic === line.topic));
    const selected = pool.slice(0,line.quantity); selected.forEach(q => used.add(q.id));
    result.push({line,index,available:pool.length,selected,missing:Math.max(0,line.quantity-pool.length)});
  }
  return result.sort((a,b) => a.index-b.index);
}
export function attemptFromPlan(plan: ProofPlan, questions: readonly Question[]): Attempt {
  if (!validatePlan(plan)) throw new Error("Confira as quantidades e a composição da prova.");
  if (plan.origin === "ai") throw new Error("A geração inédita aguarda a integração real com o ChatGPT. O banco não será usado para simular geração.");
  const allocations = allocatePlan(plan,questions);
  if (allocations.some(a => a.missing)) throw new Error("Faltam questões na composição escolhida. Nenhum outro assunto foi acrescentado.");
  const selected = allocations.flatMap(a => a.selected);
  return {...createAttempt(selected,selected.length,plan.mode === "full" ? "Simulado completo · banco conferido" : "Prova personalizada · banco conferido",plan.includeReserved),kind:plan.mode === "full" ? "full" : "thematic"};
}
