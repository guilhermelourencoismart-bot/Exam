import "fake-indexeddb/auto";
import { beforeEach,describe,expect,it } from "vitest";
import { createHash } from "node:crypto";
import { digest,questionIdentity,sealQuestion,validateAuthored,validateDraft,verifyLinear } from "../../src/domain/authored";
import { authoredItems,attemptFromItems,createAttempt,finishAttempt,gradeAttempt,itemAnswer } from "../../src/domain/training";
import { resultRows,summarize } from "../../src/domain/analytics";
import { validateBackup } from "../../src/storage/backup";
import { exportBackup,mergeBackup,readAttempts,saveAttempt } from "../../src/storage/indexed-db";
import { trainingCatalog } from "../fixtures/catalog";
import { authored,draft } from "../fixtures/authored";
const qs=trainingCatalog().questions,known=new Set(qs.map(q=>q.id));
const reset=async()=>new Promise<void>((resolve,reject)=>{const r=indexedDB.deleteDatabase("insper-pessoal-v1");r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);});
beforeEach(reset);
describe("conteúdo autoral e preservação dos dados",()=>{
 it("calcula hashes iguais aos do Node e valida a identidade imutável",()=>{
  expect(digest({texto:"á λ"})).toBe(createHash("sha256").update(JSON.stringify({texto:"á λ"})).digest("hex"));
  expect(digest({B:"opção B",A:"opção A"})).toBe(digest({A:"opção A",B:"opção B"}));
  const original=draft(),rotated=draft();[rotated.options.A,rotated.options.B]=[rotated.options.B,rotated.options.A];expect(questionIdentity(rotated)).toBe(questionIdentity(original));
  const another=draft();another.linearSystem!.coefficients=[[2,2],[1,-1]];another.linearSystem!.constants=[6,-1];expect(questionIdentity(another)).not.toBe(questionIdentity(original));
  const q=authored();expect(validateAuthored(q)).toEqual(q);const altered=structuredClone(q);altered.answer="B";expect(()=>validateAuthored(altered)).toThrow();
 });
 it("confere a única solução, rejeita sistemas singulares, alternativas incoerentes e lacunas",()=>{
  expect(verifyLinear(draft())).toBe(true);const wrong=draft();wrong.answer="B";expect(verifyLinear(wrong)).toBe(false);
  const singular=draft();singular.linearSystem!.coefficients=[[1,1],[2,2]];expect(verifyLinear(singular)).toBe(false);
  const mismatch=draft();mismatch.options.A="(99; 100)";expect(()=>validateDraft(mismatch)).toThrow("alternativas escritas");
  const missing=draft();missing.stem="Observe a figura abaixo e resolva.";expect(()=>validateDraft(missing)).toThrow("elemento");
  const duplicate=draft();duplicate.options.B=duplicate.options.A;expect(()=>validateDraft(duplicate)).toThrow();
 });
 it("corrige a mesma versão autoral e mantém o gabarito documental dos itens antigos",()=>{
  const ai=attemptFromItems(authoredItems([authored(1),authored(2),authored(3)]),"Sintético");ai.answers[ai.items[0].id]="A";ai.answers[ai.items[1].id]="B";
  expect(gradeAttempt(ai)).toMatchObject({correct:1,wrong:1,blank:1});expect(gradeAttempt(ai).percentage).toBeCloseTo(100/3);
  const official=createAttempt(qs,1,"Antiga");expect(itemAnswer(official.items[0])).toBe("A");
  const mixed=structuredClone(ai.items[0]);mixed.audit=official.items[0].audit;expect(()=>itemAnswer(mixed)).toThrow();
 });
 it("restaura backup 4 sem perder snapshots, tempos, resolução ou tentativas oficiais",async()=>{
  const old=await saveAttempt(finishAttempt(createAttempt(qs,1,"Antiga")),null);
  let a=attemptFromItems(authoredItems([authored(1),authored(2)]),"Sintético");a.answers[a.items[0].id]="A";a.timesMs[a.items[0].id]=30000;a.totalMs=30000;a=await saveAttempt(finishAttempt(a),null);
  const raw=await exportBackup(),backup=validateBackup(raw,known,qs);expect(backup.schemaVersion).toBe(4);expect(JSON.stringify(raw)).not.toMatch(/accessToken|refreshToken|credential|session/);
  await reset();await mergeBackup(backup);expect((await readAttempts()).sort((x,y)=>x.id.localeCompare(y.id))).toEqual([old,a].sort((x,y)=>x.id.localeCompare(y.id)));
  const altered=structuredClone(backup);altered.attempts.find(x=>x.id===a.id)!.items[0].author!.options.A="alterada";expect(()=>validateBackup(altered,known,qs)).toThrow();
  const fake=structuredClone(backup);fake.attempts.find(x=>x.id===a.id)!.items[0].id=qs[0].id;expect(()=>validateBackup(fake,known,qs)).toThrow();
 });
 it("inclui autoria nos indicadores, identifica repetições e rejeita conflitos de versão na importação",async()=>{
  const items=authoredItems([authored()]);let first=attemptFromItems(items,"Primeira"),repeat=attemptFromItems(items,"Revisão","review");first.answers[items[0].id]="B";repeat.answers[items[0].id]="A";
  first=finishAttempt(first,"2026-10-01T00:00:00Z");repeat=finishAttempt(repeat,"2026-10-02T00:00:00Z");
  const rows=resultRows([first,repeat]);expect(summarize(rows)).toMatchObject({correct:1,wrong:1,total:2,repeated:1});expect(rows[0].area).toBe("Matemática");expect(rows[0].origin).toBe("ai");expect(rows[1].first).toBe(false);
  await saveAttempt(first,null);const backup=await exportBackup();const changed=structuredClone(repeat);const author=changed.items[0].author!;author.explanation+=" Outro detalhe.";
  changed.items[0].author=sealQuestion({...draft(),explanation:author.explanation},author.provenance);changed.items[0].resolution!.text=author.explanation;
  backup.attempts=[changed];await expect(mergeBackup(validateBackup(backup,known,qs))).rejects.toThrow("conflitantes");expect(await readAttempts()).toHaveLength(1);
 });
});
