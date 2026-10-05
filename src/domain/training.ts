import { filterQuestions, type Filters } from "./catalog";
import type { ContentAudit, Letter, Question } from "./types";
export const letters: readonly Letter[] = ["A", "B", "C", "D", "E"];
const shaPattern = /^[a-f0-9]{64}$/;
export function canTrain(q: Question): boolean {
  const a = q.audit;
  return !!(q.readyForTraining && a?.complete && a.versionChecked && a.sharedContentChecked &&
    shaPattern.test(a.revision) && shaPattern.test(a.sourceSha256) &&
    a.media.length && a.media.every(m => shaPattern.test(m.sha256) && m.imageUrl.startsWith("/sources/rendered/") && m.page >= 1) &&
    a.key?.alternativesChecked && a.key.appliesToSha256 === a.sourceSha256 &&
    shaPattern.test(a.key.sha256) && letters.includes(a.key.answer));
}
export type TrainingItem = {
  id: string; examId: string; number: number; discipline: string; topic: string;
  partition: string; reservedForEvaluation: boolean; audit: ContentAudit;
};
export type Attempt = {
  id: string; title: string; createdAt: string; updatedAt: string; finishedAt: string | null;
  status: "paused" | "completed"; revision: number; items: TrainingItem[];
  answers: Record<string, Letter | null>; reviewFlags: Record<string, boolean>;
  timesMs: Record<string, number>; totalMs: number; currentIndex: number;
};
export function availableForTraining(questions: Question[], filters: Filters, includeReserved = false): Question[] {
  return filterQuestions(questions, filters).filter(q => canTrain(q) && (includeReserved || !q.reservedForEvaluation));
}
export function createAttempt(questions: Question[], quantity: number, title: string,
  includeReserved = false, id = crypto.randomUUID(), now = new Date().toISOString()): Attempt {
  const eligible = questions.filter(q => canTrain(q) && (includeReserved || !q.reservedForEvaluation));
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > eligible.length) {
    throw new Error(`Há ${eligible.length} questões liberadas neste recorte. Escolha uma quantidade entre 1 e ${eligible.length}; nenhum outro assunto será acrescentado.`);
  }
  const items = eligible.slice(0, quantity).map(q => ({
    id: q.id, examId: q.examId, number: q.number, discipline: q.discipline, topic: q.topic,
    partition: q.partition || "não informado", reservedForEvaluation: !!q.reservedForEvaluation,
    audit: structuredClone(q.audit!)
  }));
  return { id, title, createdAt: now, updatedAt: now, finishedAt: null, status: "paused", revision: 0,
    items, answers: Object.fromEntries(items.map(q => [q.id, null])),
    reviewFlags: Object.fromEntries(items.map(q => [q.id, false])),
    timesMs: Object.fromEntries(items.map(q => [q.id, 0])), totalMs: 0, currentIndex: 0 };
}
export function addElapsed(attempt: Attempt, deltaMs: number): Attempt {
  if (attempt.status === "completed" || !Number.isFinite(deltaMs) || deltaMs < 0) throw new Error("Tempo inválido para esta tentativa.");
  const id = attempt.items[attempt.currentIndex].id;
  return { ...attempt, totalMs: attempt.totalMs + deltaMs,
    timesMs: { ...attempt.timesMs, [id]: attempt.timesMs[id] + deltaMs } };
}
export function gradeAttempt(attempt: Attempt) {
  const rows = attempt.items.map(q => {
    const answer = attempt.answers[q.id];
    if (!q.audit.key?.alternativesChecked || q.audit.key.appliesToSha256 !== q.audit.sourceSha256) {
      throw new Error("Gabarito não conferido para a versão desta tentativa.");
    }
    return { item: q, answer, expected: q.audit.key.answer, timeMs: attempt.timesMs[q.id],
      outcome: answer === null ? "blank" as const : answer === q.audit.key.answer ? "correct" as const : "wrong" as const };
  });
  const correct = rows.filter(r => r.outcome === "correct").length;
  return { rows, correct, wrong: rows.filter(r => r.outcome === "wrong").length,
    blank: rows.filter(r => r.outcome === "blank").length, percentage: correct / rows.length * 100,
    totalMs: attempt.totalMs };
}
export function finishAttempt(attempt: Attempt, now = new Date().toISOString()): Attempt {
  if (attempt.status === "completed") throw new Error("Esta tentativa já foi finalizada.");
  gradeAttempt(attempt);
  return { ...attempt, status: "completed", finishedAt: now, updatedAt: now };
}
export function reviewErrors(attempts: Attempt[]) {
  return attempts.filter(a => a.status === "completed").flatMap(a =>
    gradeAttempt(a).rows.filter(r => r.outcome === "wrong").map(r => ({ ...r, attemptId: a.id,
      attemptTitle: a.title, finishedAt: a.finishedAt! }))
  ).sort((a,b) => b.finishedAt.localeCompare(a.finishedAt));
}
export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 3600).toString().padStart(2,"0")}:${Math.floor(s / 60 % 60).toString().padStart(2,"0")}:${(s % 60).toString().padStart(2,"0")}`;
}
// A monotonic clock; no persisted wall-clock interval is ever charged on recovery.
export class ActiveClock {
  private anchor: number | null = null;
  get running() { return this.anchor !== null; }
  resume(now: number) { if (this.anchor === null) this.anchor = now; }
  preview(now: number) { return this.anchor === null ? 0 : Math.max(0, now - this.anchor); }
  checkpoint(now: number) { const delta = this.preview(now); if (this.anchor !== null) this.anchor = now; return delta; }
  pause(now: number) { const delta = this.checkpoint(now); this.anchor = null; return delta; }
}
