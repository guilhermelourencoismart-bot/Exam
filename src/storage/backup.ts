import type { Attempt } from "../domain/training";
import { canTrain, gradeAttempt, letters } from "../domain/training";
import type { Question } from "../domain/types";
export type Bookmark = { questionId: string; savedAt: string };
export type Backup = { app: "insper-pessoal"; schemaVersion: 2; exportedAt: string; bookmarks: Bookmark[]; attempts: Attempt[] };
function isDate(s: unknown): s is string { return typeof s === "string" && Number.isFinite(Date.parse(s)); }
function fail(): never { throw new Error("Backup contém tentativa, resposta, tempo ou versão de conteúdo inválidos. Nada foi importado."); }
export function validateBackup(input: unknown, knownIds: ReadonlySet<string>, questions: readonly Question[] = []): Backup {
  if (!input || typeof input !== "object") throw new Error("Arquivo de backup inválido.");
  const b = input as { app?: string; schemaVersion?: number; exportedAt?: string; bookmarks?: Bookmark[]; attempts?: Attempt[] };
  if (b.app !== "insper-pessoal" || ![1,2].includes(b.schemaVersion as number) || !Array.isArray(b.bookmarks) ||
      b.bookmarks.length > 100_000 || !isDate(b.exportedAt)) throw new Error("Formato ou versão de backup incompatível.");
  const ids = new Set<string>();
  const bookmarks = b.bookmarks.map(item => {
    if (!item || typeof item.questionId !== "string" || !knownIds.has(item.questionId) || !isDate(item.savedAt) || ids.has(item.questionId))
      throw new Error("Backup contém questão desconhecida, data inválida ou registro duplicado. Nada foi importado.");
    ids.add(item.questionId); return { questionId: item.questionId, savedAt: item.savedAt };
  });
  let attempts: Attempt[] = [];
  if (b.schemaVersion === 2) {
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
            item.reservedForEvaluation !== !!q.reservedForEvaluation) fail();
        const answer = a.answers[item.id];
        if ((answer !== null && !letters.includes(answer)) || typeof a.reviewFlags[item.id] !== "boolean" ||
            !Number.isFinite(a.timesMs[item.id]) || a.timesMs[item.id] < 0) fail();
        itemIds.add(item.id);
      }
      for (const map of [a.answers,a.timesMs,a.reviewFlags])
        if (Object.keys(map).length !== itemIds.size || Object.keys(map).some(id => !itemIds.has(id))) fail();
      if (Math.abs(Object.values(a.timesMs).reduce((x,y) => x+y,0) - a.totalMs) > .01) fail();
      gradeAttempt(a);
      return { id:a.id,title:a.title,status:a.status,createdAt:a.createdAt,updatedAt:a.updatedAt,finishedAt:a.finishedAt,
        revision:a.revision,items:structuredClone(a.items),answers:{...a.answers},reviewFlags:{...a.reviewFlags},
        timesMs:{...a.timesMs},totalMs:a.totalMs,currentIndex:a.currentIndex };
    });
  }
  return { app:"insper-pessoal",schemaVersion:2,exportedAt:b.exportedAt,bookmarks,attempts };
}
