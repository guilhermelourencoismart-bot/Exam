import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("consulta, filtros combinados, prova e vazio", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Mostrando 1–20 de 400 questões")).toBeVisible();
  await page.getByRole("combobox", { name: "Origem", exact: true }).selectOption("official");
  await page.getByRole("combobox", { name: "Disciplina", exact: true }).selectOption("Matemática");
  await page.getByRole("combobox", { name: "Assunto", exact: true }).selectOption("Sistemas lineares");
  await expect(page.getByText("Mostrando 1–7 de 7 questões")).toBeVisible();
  await expect(page.locator(".question-card")).toHaveCount(7);
  await page.getByLabel("Buscar no texto ou assunto").fill("nada-xyz");
  await expect(page.getByText("Nenhuma questão encontrada.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await page.getByRole("button", { name: "Próxima →" }).click();
  await expect(page.getByText("Mostrando 21–40 de 400 questões")).toBeVisible();
  await page.getByRole("button", { name: "Provas", exact: true }).click();
  await expect(page.locator(".exam-card")).toHaveCount(7);
  const exam = page.locator(".exam-card").filter({ hasText: "Aplicação A" });
  await exam.getByRole("button", { name: "Consultar questões" }).click();
  await expect(page.getByText("Mostrando 1–20 de 60 questões")).toBeVisible();
});
test("conteúdo completo sem gabarito permite consulta sem correção", async ({ page }) => {
  await page.goto("/");
  const first = page.locator(".question-card").first();
  await first.getByText("Consultar extração e fonte").click();
  await expect(first.getByText("Completa sem correção automática.")).toBeVisible();
  await expect(first.getByText("Fonte original", { exact: true })).toBeVisible();
  await expect(first.getByText("página 3 · coluna 1", { exact: false })).toBeVisible();
  await first.getByText("Ver resposta registrada no banco").click();
  await expect(first.getByText("Sem resposta utilizável.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: /iniciar treino|responder/i })).toHaveCount(0);
});
test("IndexedDB persiste e backup realmente exporta e importa", async ({ page }) => {
  await page.goto("/");
  const mark = page.getByRole("button", { name: "Marcar P2019-Q01 para revisar", exact: true });
  await mark.click();
  await expect(page.getByText("1 marcação local")).toBeVisible();
  await page.reload();
  await expect(page.getByText("1 marcação local")).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Exportar backup" }).click()]);
  const contents = await readFile((await download.path())!, "utf8");
  expect(JSON.parse(contents).bookmarks[0].questionId).toBe("P2019-Q01");
  await page.getByRole("button", { name: "Desmarcar P2019-Q01 para revisar", exact: true }).click();
  await expect(page.getByText("0 marcações locais")).toBeVisible();
  await page.getByLabel("Arquivo de backup").setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(contents) });
  await expect(page.getByText("1 marcação local")).toBeVisible();
  await page.getByLabel("Só marcadas para revisar").check();
  await expect(page.getByText("Mostrando 1–1 de 1 questões")).toBeVisible();
  await page.getByLabel("Arquivo de backup").setInputFiles({ name: "invalid.json", mimeType: "application/json", buffer: Buffer.from('{"schemaVersion":99}') });
  await expect(page.getByText("Formato ou versão de backup incompatível.")).toBeVisible();
  await expect(page.getByText("1 marcação local")).toBeVisible();
  await page.getByLabel("Arquivo de backup").setInputFiles({ name: "broken.json", mimeType: "application/json", buffer: Buffer.from('{') });
  await expect(page.getByText("O arquivo não é um JSON válido. Nada foi importado.")).toBeVisible();
  await expect(page.getByText("1 marcação local")).toBeVisible();
});
test("fontes têm páginas, hipóteses e PDFs legíveis disponíveis", async ({ page, request }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Fontes e relatório", exact: true }).click();
  await expect(page.getByText("Todos os PDFs do inventário foram incorporados.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Retorno de estudo é hipótese pedagógica" })).toBeVisible();
  const claim = page.locator(".knowledge-card").filter({ hasText: "Retorno de estudo é hipótese pedagógica" });
  await expect(claim.getByRole("link")).toHaveAttribute("href", "/sources/relatorio-v1.pdf#page=9");
  for (const url of ["/sources/relatorio-v1.pdf", "/sources/conteudo-programatico-2027-1.pdf"]) {
    const response = await request.get(url); expect(response.ok()).toBe(true);
    expect((await response.body()).subarray(0,5).toString()).toBe("%PDF-");
  }
});
test("consulta no celular sem rolagem horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText("Mostrando 1–20 de 400 questões")).toBeVisible();
  await page.getByRole("combobox", { name: "Disciplina", exact: true }).selectOption("Biologia");
  await expect(page.locator(".question-card")).toHaveCount(20);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
