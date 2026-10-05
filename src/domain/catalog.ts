import type { Question } from "./types";
export type Filters = {
  origin: string; exam: string; discipline: string; topic: string; search: string; savedOnly: boolean;
};
export const emptyFilters: Filters = { origin: "", exam: "", discipline: "", topic: "", search: "", savedOnly: false };
export function searchKey(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}
export function filterQuestions(questions: Question[], filters: Filters, savedIds: readonly string[] = []): Question[] {
  const terms = searchKey(filters.search.trim()).split(/\s+/).filter(Boolean);
  return questions.filter(q =>
    (!filters.origin || q.origin === filters.origin) &&
    (!filters.exam || q.examId === filters.exam) &&
    (!filters.discipline || q.discipline === filters.discipline) &&
    (!filters.topic || q.topic === filters.topic) &&
    (!filters.savedOnly || savedIds.includes(q.id)) &&
    terms.every(term => searchKey([q.id, q.text, q.rawBlock, q.topic, q.subtopic, q.skill].join(" ")).includes(term))
  );
}
export function uniqueOptions(values: string[]): string[] {
  return [...new Set(values)].sort((a,b) => a.localeCompare(b, "pt-BR"));
}
