import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { emptyFilters, filterQuestions } from "../../src/domain/catalog";
import type { Catalog } from "../../src/domain/types";
const data = JSON.parse(readFileSync("public/data/catalog.json", "utf8")) as Catalog;
describe("catálogo extraído", () => {
  it("mantém itens únicos e separa seleção de terceiros", () => {
    expect(data.questions).toHaveLength(400);
    expect(new Set(data.questions.map(q => q.id)).size).toBe(400);
    expect(filterQuestions(data.questions, { ...emptyFilters, origin: "official" })).toHaveLength(280);
    expect(filterQuestions(data.questions, { ...emptyFilters, origin: "third-party" })).toHaveLength(120);
    expect(data.exams).toHaveLength(7);
  });
  it("combina disciplina, tema e origem sem perder os critérios", () => {
    const result = filterQuestions(data.questions, { ...emptyFilters, origin: "official", discipline: "Matemática", topic: "Sistemas lineares" });
    expect(result).toHaveLength(7);
    expect(result.every(q => q.discipline === "Matemática" && q.origin === "official")).toBe(true);
    expect(filterQuestions(data.questions, { ...emptyFilters, exam: "P2026A" })).toHaveLength(60);
  });
  it("busca sem acentos e restringe marcações", () => {
    expect(filterQuestions(data.questions, { ...emptyFilters, search: "função" }).map(q => q.id))
      .toEqual(filterQuestions(data.questions, { ...emptyFilters, search: "FUNCAO" }).map(q => q.id));
    expect(filterQuestions(data.questions, { ...emptyFilters, savedOnly: true }, ["P2019-Q01"]).map(q => q.id)).toEqual(["P2019-Q01"]);
    expect(filterQuestions(data.questions, { ...emptyFilters, search: "inexistente-xyz" })).toEqual([]);
  });
  it("libera somente fontes completas com chave comprovada da mesma versão", () => {
    const ready=data.questions.filter(q => q.readyForTraining);
    expect(ready).toHaveLength(240);
    expect(ready.every(q=>q.audit?.complete&&q.audit.sharedContentChecked&&q.audit.key?.alternativesChecked&&q.audit.key.appliesToSha256===q.audit.sourceSha256)).toBe(true);
    expect(ready.every(q=>q.audit!.key!.answer===q.answer&&q.audit!.sourceNumber===q.number)).toBe(true);
    expect(data.questions.filter(q => q.answer === null)).toHaveLength(160);
    expect(data.questions.filter(q=>!q.readyForTraining).every(q=>q.blockers.length>0&&q.audit?.complete&&q.audit.key===null)).toBe(true);
    expect(data.questions.every(q => q.source.available)).toBe(true);
    expect(data.documents.filter(d => !d.available)).toHaveLength(0);
    expect(data.stats.versionsNeedingReview).toBe(0);
    expect(ready.filter(q=>q.reservedForEvaluation)).toHaveLength(60);
    expect(data.questions.find(q=>q.id==='P2026A-Q04')!.audit!.media.map(m=>m.page)).toEqual([3,4]);
    expect(data.questions.find(q=>q.id==='S2026A-Q32')!.audit!.media.map(m=>m.page)).toEqual([11,12]);
    expect(data.questions.find(q=>q.id==='P2026A-Q53')!.audit!.media.map(m=>m.page)).toEqual([16,19]);
  });
  it("preserva todos os campos e todas as ocorrências no arquivo de auditoria", () => {
    const archive = JSON.parse(readFileSync("public/data/source-archive.json", "utf8"));
    expect(archive.databaseSha256).toBe(data.databaseSha256);
    expect(archive.tables.versoes).toHaveLength(700);
    expect(archive.tables.questoes).toHaveLength(400);
    expect(archive.reportPages).toHaveLength(24);
    expect(archive.syllabusPages).toHaveLength(24);
    for (const record of archive.tables.questoes) expect(JSON.parse(record.row.dados_json)).toEqual(record.decoded);
  });
});
