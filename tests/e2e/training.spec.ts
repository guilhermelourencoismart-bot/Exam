import { test,expect,type Page,type BrowserContext } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { trainingCatalog } from "../fixtures/catalog";
async function fixtures(context:BrowserContext){
  await context.route("**/data/catalog.json",route=>route.fulfill({json:trainingCatalog()}));
  await context.route("**/sources/rendered/test-*.png",async route=>{
    const name=new URL(route.request().url()).pathname.split("/").pop()!;
    await route.fulfill({contentType:"image/png",body:await readFile(`tests/fixtures/${name}`)});
  });
}
async function total(page:Page){return Number(await page.getByTestId("total-time").getAttribute("data-ms"));}
test("treino real disponível; quantidade insuficiente não é completada silenciosamente",async({page})=>{
  await page.goto("/");await page.getByRole("button",{name:"Treino",exact:true}).click();
  await expect(page.getByText("120 questões disponíveis para este treino")).toBeVisible();
  await page.getByRole("combobox",{name:"Disciplina do treino",exact:true}).selectOption("Matemática");
  await page.getByRole("combobox",{name:"Assunto do treino",exact:true}).selectOption("Sistemas lineares");
  await page.getByLabel("Quantidade de questões").fill("5");
  await expect(page.getByText("2 questões disponíveis para este treino")).toBeVisible();
  await expect(page.getByText("Faltam 3 questões para a quantidade escolhida.",{exact:false})).toBeVisible();
  await expect(page.getByRole("button",{name:"Criar lista de treino"})).toBeDisabled();
});
test("fluxo completo sintético: respostas, navegação, pausas, recuperação, correção e backup",async({page,context,browser})=>{
  await fixtures(context);await page.goto("/");await page.getByRole("button",{name:"Treino",exact:true}).click();
  await expect(page.getByText("3 questões disponíveis para este treino")).toBeVisible();
  await page.getByLabel("Quantidade de questões").fill("3");await page.getByRole("button",{name:"Criar lista de treino"}).click();
  await expect(page.getByRole("button",{name:"Iniciar ou retomar"})).toBeEnabled();
  await expect(page.getByText("Resposta informada:",{exact:false})).toHaveCount(0);
  await page.getByRole("button",{name:"Iniciar ou retomar"}).click();
  await page.getByRole("radio",{name:"Alternativa A",exact:true}).check();
  await expect(page.getByRole("radio",{name:"Alternativa A",exact:true})).toBeChecked();
  await expect.poll(()=>total(page)).toBeGreaterThan(1000);
  await page.getByRole("button",{name:"Próxima questão →"}).click();
  await expect(page.getByText("Questão 2 de 3",{exact:false})).toBeVisible();
  await page.getByRole("radio",{name:"Alternativa A",exact:true}).check();
  await page.getByLabel("Marcar para revisar nesta tentativa").check();
  await page.getByRole("button",{name:"Pausar",exact:true}).click();
  await expect(page.getByRole("button",{name:"Iniciar ou retomar"})).toBeEnabled();
  const paused=await total(page);await page.waitForTimeout(1500);expect(await total(page)).toBe(paused);
  await page.reload();await expect(page.getByText("Questão 2 de 3",{exact:false})).toBeVisible();
  await expect(page.getByRole("radio",{name:"Alternativa A",exact:true})).toBeChecked();
  await expect(page.getByLabel("Marcar para revisar nesta tentativa")).toBeChecked();
  expect(await total(page)).toBe(paused);
  await page.getByRole("button",{name:"Iniciar ou retomar"}).click();
  await page.getByRole("button",{name:"Questão anterior",exact:false}).click();
  await expect(page.getByRole("radio",{name:"Alternativa A",exact:true})).toBeChecked();
  await page.getByRole("button",{name:"Ir para questão 3",exact:true}).click();
  await expect(page.getByRole("radio",{name:"Alternativa A",exact:true})).not.toBeChecked();
  await page.getByRole("button",{name:"Finalizar treino",exact:true}).click();
  await page.getByRole("button",{name:"Confirmar finalização"}).click();
  await expect(page.getByRole("heading",{name:"Treino finalizado"})).toBeVisible();
  const rows=page.locator(".results-table tbody tr");await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("Acerto");await expect(rows.nth(1)).toContainText("Erro");await expect(rows.nth(2)).toContainText("Em branco");
  await expect(page.getByText("33.3%",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Caderno de revisão",exact:true}).click();
  await expect(page.locator(".result-source")).toHaveCount(1);await expect(page.locator(".result-source")).toContainText("TEST-Q2");
  await page.getByRole("button",{name:"Questões",exact:true}).click();await page.getByRole("button",{name:"Marcar TEST-Q1 para revisar",exact:true}).click();
  const [download]=await Promise.all([page.waitForEvent("download"),page.getByRole("button",{name:"Exportar backup"}).click()]);
  const backup=await readFile((await download.path())!),parsed=JSON.parse(backup.toString());
  expect(parsed.schemaVersion).toBe(2);expect(parsed.attempts).toHaveLength(1);expect(parsed.bookmarks).toHaveLength(1);
  expect(parsed.attempts[0].status).toBe("completed");expect(parsed.attempts[0].totalMs).toBeGreaterThanOrEqual(paused);
  const sum=Object.values(parsed.attempts[0].timesMs).reduce<number>((sum,value)=>sum+Number(value),0);expect(sum).toBeCloseTo(parsed.attempts[0].totalMs);
  const restored=await browser.newContext();await fixtures(restored);const restoredPage=await restored.newPage();
  await restoredPage.goto("/");await expect(restoredPage.getByRole("button",{name:"Importar backup"})).toBeEnabled();
  await restoredPage.getByLabel("Arquivo de backup").setInputFiles({name:"backup.json",mimeType:"application/json",buffer:backup});
  await expect(restoredPage.getByText("1 marcação local")).toBeVisible();await restoredPage.getByRole("button",{name:"Treino",exact:true}).click();
  await restoredPage.getByRole("button",{name:"Ver resultado",exact:true}).click();await expect(restoredPage.getByText("33.3%",{exact:true})).toBeVisible();
  await restoredPage.getByRole("button",{name:"Caderno de revisão",exact:true}).click();await expect(restoredPage.locator(".result-source")).toHaveCount(1);
  await restored.close();
});
test("questão completa sem chave permanece consulta; reserva exige inclusão explícita; imagem amplia",async({page,context})=>{
  await fixtures(context);await page.goto("/");
  const card=page.locator(".question-card").filter({hasText:"TEST-Q5"});await expect(card).toContainText("Completa · sem correção");
  await page.getByRole("button",{name:"Treino",exact:true}).click();await expect(page.getByText("3 questões disponíveis para este treino")).toBeVisible();
  await page.getByLabel("Incluir reservadas para avaliação",{exact:false}).check();await expect(page.getByText("4 questões disponíveis para este treino")).toBeVisible();
  await page.getByLabel("Quantidade de questões").fill("1");await page.getByRole("button",{name:"Criar lista de treino"}).click();
  await page.getByRole("button",{name:"Ampliar",exact:false}).click();await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button",{name:"+",exact:true}).click();await expect(page.getByText("150%",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Fechar imagem"}).click();await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("link",{name:"Abrir página original"})).toHaveAttribute("href","/sources/fixture.pdf#page=1");
});
test("backup antigo é migrado no navegador sem apagar marcações",async({page})=>{
  await page.goto("/");await expect(page.getByRole("button",{name:"Importar backup"})).toBeEnabled();
  const old={app:"insper-pessoal",schemaVersion:1,exportedAt:new Date().toISOString(),bookmarks:[{questionId:"P2019-Q01",savedAt:new Date().toISOString()}]};
  await page.getByLabel("Arquivo de backup").setInputFiles({name:"v1.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(old))});
  await expect(page.getByText("1 marcação local")).toBeVisible();await page.reload();await expect(page.getByText("1 marcação local")).toBeVisible();
});
test("fechar aba ativa recupera como pausada e não cobra tempo fechado",async({page,context})=>{
  await fixtures(context);await page.goto("/");await page.getByRole("button",{name:"Treino",exact:true}).click();
  await page.getByLabel("Quantidade de questões").fill("1");await page.getByRole("button",{name:"Criar lista de treino"}).click();
  await page.getByRole("button",{name:"Iniciar ou retomar"}).click();
  await page.getByRole("radio",{name:"Alternativa A",exact:true}).check();
  await expect.poll(()=>total(page)).toBeGreaterThan(1200);const before=await total(page);
  await page.close();await new Promise(resolve=>setTimeout(resolve,1600));
  const reopened=await context.newPage();await reopened.goto("/");
  await expect(reopened.getByRole("button",{name:"Iniciar ou retomar"})).toBeEnabled();
  await expect(reopened.getByRole("radio",{name:"Alternativa A",exact:true})).toBeChecked();
  const recovered=await total(reopened);expect(recovered).toBeLessThan(before+1000);
  await reopened.waitForTimeout(1200);expect(await total(reopened)).toBe(recovered);
});
