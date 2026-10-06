import type { Attempt } from "../domain/training";
import { canTrain, gradeAttempt, letters } from "../domain/training";
import type { Question } from "../domain/types";
import { areas } from "../domain/classification";
import { errorReasons, type ErrorNote, type Preferences } from "../domain/preferences";
import { validatePlan, type SavedPlan } from "../domain/proof-plan";
export type Bookmark = { questionId: string; savedAt: string };
export type Backup = { app: "insper-pessoal"; schemaVersion: 3; exportedAt: string; bookmarks: Bookmark[]; attempts: Attempt[];
  preferences?: Preferences[]; errorNotes?: ErrorNote[]; plans?: SavedPlan[] };
function isDate(s: unknown): s is string { return typeof s === "string" && Number.isFinite(Date.parse(s)); }
function fail(): never { throw new Error("Backup contém tentativa, resposta, tempo ou versão de conteúdo inválidos. Nada foi importado."); }
export function validateBackup(input: unknown, knownIds: ReadonlySet<string>, questions: readonly Question[] = []): Backup {
  if (!input || typeof input !== "object") throw new Error("Arquivo de backup inválido.");
  const b = input as Partial<Omit<Backup,"schemaVersion">> & {schemaVersion?:number};
  if (b.app !== "insper-pessoal" || ![1,2,3].includes(b.schemaVersion as number) || !Array.isArray(b.bookmarks) ||
      b.bookmarks.length > 100_000 || !isDate(b.exportedAt)) throw new Error("Formato ou versão de backup incompatível.");
  const ids = new Set<string>();
  const bookmarks = b.bookmarks.map(item => {
    if (!item || typeof item.questionId !== "string" || !knownIds.has(item.questionId) || !isDate(item.savedAt) || ids.has(item.questionId))
      throw new Error("Backup contém questão desconhecida, data inválida ou registro duplicado. Nada foi importado.");
    ids.add(item.questionId); return { questionId: item.questionId, savedAt: item.savedAt };
  });
  let attempts: Attempt[] = [];
  if (b.schemaVersion === 2 || b.schemaVersion === 3) {
    if (!Array.isArray(b.attempts) || b.attempts.length > 10_000) fail();
    const attemptIds = new Set<string>();
    attempts = b.attempts.map(a => {
      if (!a || typeof a.id !== "string" || !a.id || a.id.length > 128 || attemptIds.has(a.id) ||
          typeof a.title !== "string" || a.title.length > 300 || !isDate(a.createdAt) || !isDate(a.updatedAt) ||
          !["paused","completed"].includes(a.status) || !Number.isInteger(a.revision) || a.revision < 0 ||
          !Array.isArray(a.items) || !a.items.length || a.items.length > 400 ||
          !Number.isInteger(a.currentIndex) || a.currentIndex < 0 || a.currentIndex >= a.items.length ||
          !Number.isFinite(a.totalMs) || a.totalMs < 0 || a.totalMs > 3.6e10 || !a.answers || !a.reviewFlags || !a.timesMs ||
          (a.status === "completed" ? !isDate(a.finishedAt) : a.finishedAt !== null)) fail();
      attemptIds.add(a.id);
      const itemIds = new Set<string>();
      for (const item of a.items) {
        if (!item || itemIds.has(item.id)) fail();
        const q = questions.find(q => q.id === item.id);
        // A backup cannot supply an unverified or altered answer key.
        if (!q || !canTrain(q) || JSON.stringify(item.audit) !== JSON.stringify(q.audit) ||
            item.examId !== q.examId || item.number !== q.number || item.discipline !== q.discipline ||
            item.topic !== q.topic || item.partition !== (q.partition || "não informado") ||
            item.reservedForEvaluation !== !!q.reservedForEvaluation || (item.origin !== undefined && item.origin !== q.origin) || item.resolution !== undefined) fail();
        const answer = a.answers[item.id];
        if ((answer !== null && !letters.includes(answer)) || typeof a.reviewFlags[item.id] !== "boolean" ||
            !Number.isFinite(a.timesMs[item.id]) || a.timesMs[item.id] < 0) fail();
        itemIds.add(item.id);
      }
      for (const map of [a.answers,a.timesMs,a.reviewFlags])
        if (Object.keys(map).length !== itemIds.size || Object.keys(map).some(id => !itemIds.has(id))) fail();
      if (Math.abs(Object.values(a.timesMs).reduce((x,y) => x+y,0) - a.totalMs) > .01) fail();
      if(a.kind !== undefined && !["full","thematic","review"].includes(a.kind))fail();
      if(a.kind === "full" && (a.items.length !== 60 || !areas.every(area=>a.items.filter(q=>area === (q.discipline === "Matemática" ? "Matemática" : q.discipline === "Língua Portuguesa" ? "Português" : ["História","Geografia","Sociologia","Filosofia"].includes(q.discipline) ? "Ciências Humanas" : ["Física","Química","Biologia"].includes(q.discipline) ? "Ciências da Natureza" : "")).length === 15)))fail();
      if(a.telemetry){
        if(a.telemetry.version!==1)fail();
        for(const map of [a.telemetry.visits,a.telemetry.answerChanges]){
          if(!map || Object.keys(map).length!==itemIds.size || Object.keys(map).some(id=>!itemIds.has(id)) || Object.values(map).some(n=>!Number.isInteger(n)||n<0||n>1_000_000))fail();
        }
      }
      if(a.essay && (typeof a.essay.comment!=="string" || typeof a.essay.source!=="string" || !a.essay.source || !Array.isArray(a.essay.criteria) || !a.essay.criteria.length || a.essay.criteria.length>20 || a.essay.criteria.some(c=>typeof c.name!=="string"||typeof c.comment!=="string"||!Number.isFinite(c.score)||!Number.isFinite(c.max)||c.max<=0||c.score<0||c.score>c.max)))fail();
      gradeAttempt(a);
      return { id:a.id,title:a.title,status:a.status,createdAt:a.createdAt,updatedAt:a.updatedAt,finishedAt:a.finishedAt,
        revision:a.revision,items:structuredClone(a.items),answers:{...a.answers},reviewFlags:{...a.reviewFlags},
        timesMs:{...a.timesMs},totalMs:a.totalMs,currentIndex:a.currentIndex,
        ...(a.kind ? {kind:a.kind} : {}),...(a.telemetry ? {telemetry:structuredClone(a.telemetry)} : {}),...(a.essay ? {essay:structuredClone(a.essay)} : {}) };
    });
  }
  const preferences:Preferences[]=[],errorNotes:ErrorNote[]=[],plans:SavedPlan[]=[];
  if(b.schemaVersion===3){
    if(!Array.isArray(b.preferences)||b.preferences.length>1||!Array.isArray(b.errorNotes)||b.errorNotes.length>100_000||!Array.isArray(b.plans)||b.plans.length>1000)fail();
    for(const p of b.preferences){
      if(!p || p.id!=="personal" || (p.goalPercentage!==null && (!Number.isFinite(p.goalPercentage)||p.goalPercentage<0||p.goalPercentage>100)) || !p.areaGoals || Object.entries(p.areaGoals).some(([area,n])=>!areas.includes(area as typeof areas[number])||!Number.isFinite(n)||n<0||n>100))fail();
      if(p.course && (typeof p.course.name!=="string" || !p.course.name.trim() || p.course.name.length>200 || p.course.source!=="user" || !p.course.weights || areas.some(area=>!Number.isFinite(p.course!.weights[area])||p.course!.weights[area]<0||p.course!.weights[area]>1000) || Object.keys(p.course.weights).length!==4 || areas.every(area=>p.course!.weights[area]===0)))fail();
      preferences.push(structuredClone(p));
    }
    const noteIds=new Set<string>();
    for(const n of b.errorNotes){const a=attempts.find(a=>a.id===n?.attemptId);
      if(!n||typeof n.id!=="string"||noteIds.has(n.id)||n.id!==`${n.attemptId}::${n.questionId}`||!isDate(n.updatedAt)||!a||a.status!=="completed"||!gradeAttempt(a).rows.some(r=>r.item.id===n.questionId&&r.outcome==="wrong")||(n.reason!==null&&!errorReasons.includes(n.reason)))fail();
      noteIds.add(n.id);errorNotes.push(structuredClone(n));
    }
    const planIds=new Set<string>();
    for(const p of b.plans){if(!p||typeof p.id!=="string"||!p.id||p.id.length>128||planIds.has(p.id)||typeof p.title!=="string"||p.title.length>300||!isDate(p.createdAt)||!validatePlan(p.plan))fail();planIds.add(p.id);plans.push(structuredClone(p));}
  }
  return { app:"insper-pessoal",schemaVersion:3,exportedAt:b.exportedAt,bookmarks,attempts,preferences,errorNotes,plans };
}
