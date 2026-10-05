import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { mergeBackup, readBookmarks, setBookmark } from "../../src/storage/indexed-db";
import { validateBackup } from "../../src/storage/backup";
const ids = new Set(["P2019-Q01", "P2019-Q02"]);
const base = { app: "insper-pessoal", schemaVersion: 1, exportedAt: "2026-10-05T00:00:00Z" };
const b1 = { questionId: "P2019-Q01", savedAt: "2026-10-05T00:00:00Z" };
describe("backup e IndexedDB", () => {
  it("rejeita formatos desconhecidos, duplicados, datas e IDs inválidos", () => {
    for (const input of [null, {}, { ...base, schemaVersion: 2, bookmarks: [] },
      { ...base, bookmarks: [b1,b1] }, { ...base, bookmarks: [{ ...b1, questionId: "inventada" }] },
      { ...base, bookmarks: [{ ...b1, savedAt: "não é data" }] }, { ...base, bookmarks: [null] }]) {
      expect(() => validateBackup(input, ids)).toThrow();
    }
  });
  it("salva, relê, remove e importa sem apagar marcações existentes", async () => {
    await setBookmark("P2019-Q01", true);
    const before = await readBookmarks(); expect(before.map(b => b.questionId)).toContain("P2019-Q01");
    const backup = validateBackup({ ...base, bookmarks: [b1, { ...b1, questionId: "P2019-Q02" }] }, ids);
    await mergeBackup(backup);
    await mergeBackup(backup); // repeatability: no duplicate or overwrite of existing savedAt
    const after = await readBookmarks(); expect(after).toHaveLength(2);
    expect(after.find(b => b.questionId === "P2019-Q01")).toEqual(before[0]);
    await setBookmark("P2019-Q01", false);
    expect((await readBookmarks()).map(b => b.questionId)).toEqual(["P2019-Q02"]);
    await setBookmark("P2019-Q02", false);
  });
});
