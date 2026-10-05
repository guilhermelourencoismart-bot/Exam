import { test,expect,type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import type { Catalog } from "../../src/domain/types";
const catalog=JSON.parse(readFileSync("public/data/catalog.json","utf8")) as Catalog;
const question=(id:string)=>catalog.questions.find(q=>q.id===id)!;
async function total(page:Page){return Number(await page.getByTestId("total-time").getAttribute("data-ms"));}
async function openTraining(page:Page,exam:string){
  await page.goto("/");await page.getByRole("button",{name:"Treino",exact:true}).click();
  await page.getByLabel("Prova do treino",{exact:true}).selectOption(exam);
}

test("treino real com gráfico: responder, navegar, pausar, atualizar, corrigir e restaurar backup",async({page,browser,request})=>{
  await openTraining(page,"P2026A");
  await page.getByLabel("Disciplina do treino",{exact:true}).selectOption("Química");
  await page.getByLabel("Quantidade de questões").fill("4");
  await page.getByRole("button",{name:"Criar lista de treino"}).click();
  await expect(page.getByText("P2026A-Q51",{exact:false})).toBeVisible();
  await page.getByRole("button",{name:"Iniciar ou retomar"}).click();
  await page.getByRole("radio",{name:"Alternativa B",exact:true}).check();
  await expect.poll(()=>total(page)).toBeGreaterThan(1000);
  await page.getByRole("button",{name:"Próxima questão →"}).click();
  await page.getByRole("radio",{name:"Alternativa A",exact:true}).check();
  await page.getByRole("button",{name:"Próxima questão →"}).click();
  await expect(page.getByText("P2026A-Q53",{exact:false})).toBeVisible();
  const graph=question("P2026A-Q53");expect(graph.graph).toBe(true);
  const media=graph.audit!.media.find(m=>m.page===16)!;
  const image=page.locator(`.training-question img[src="${media.imageUrl}"]`);
  await expect(image).toBeVisible();expect(await image.evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(1400);
  const original=await request.get(media.pdfUrl);expect(original.ok()).toBe(true);expect((await original.body()).subarray(0,5).toString()).toBe("%PDF-");
  await expect(page.getByRole("link",{name:"Abrir página original"}).first()).toHaveAttribute("href",`${media.pdfUrl}#page=16`);
  await page.getByRole("button",{name:/Ampliar.*página 16/}).click();
  await expect(page.getByRole("dialog")).toBeVisible();await page.getByRole("button",{name:"+",exact:true}).click();
  await expect(page.getByText("150%",{exact:true})).toBeVisible();await page.getByRole("button",{name:"Fechar imagem"}).click();
  await page.getByRole("radio",{name:"Alternativa D",exact:true}).check();
  await page.getByLabel("Marcar para revisar nesta tentativa").check();
  await page.getByRole("button",{name:"Pausar",exact:true}).click();
  await expect(page.getByRole("button",{name:"Iniciar ou retomar"})).toBeEnabled();
  const paused=await total(page);await page.waitForTimeout(1300);expect(await total(page)).toBe(paused);
  await page.reload();await expect(page.getByText("P2026A-Q53",{exact:false})).toBeVisible();
  await expect(page.getByRole("radio",{name:"Alternativa D",exact:true})).toBeChecked();
  await expect(page.getByLabel("Marcar para revisar nesta tentativa")).toBeChecked();expect(await total(page)).toBe(paused);
  await page.getByRole("button",{name:"Iniciar ou retomar"}).click();
  await page.getByRole("button",{name:"Ir para questão 4",exact:true}).click();
  await page.getByRole("button",{name:"Finalizar treino",exact:true}).click();
  await page.getByRole("button",{name:"Confirmar finalização"}).click();
  await expect(page.getByRole("heading",{name:"Treino finalizado"})).toBeVisible();
  const rows=page.locator(".results-table tbody tr");await expect(rows).toHaveCount(4);
  for(const [i,result] of ["Acerto","Erro","Acerto","Em branco"].entries())await expect(rows.nth(i)).toContainText(result);
  await expect(page.getByText("50.0%",{exact:true})).toBeVisible();
  const [download]=await Promise.all([page.waitForEvent("download"),page.getByRole("button",{name:"Exportar backup"}).click()]);
  const backup=await readFile((await download.path())!),a=JSON.parse(backup.toString()).attempts[0];
  expect(a.items.map((q:{id:string})=>q.id)).toEqual(["P2026A-Q51","P2026A-Q52","P2026A-Q53","P2026A-Q54"]);
  for(const item of a.items)expect(item.audit).toEqual(question(item.id).audit);
  expect(a.totalMs).toBeGreaterThanOrEqual(paused);
  expect(Object.values(a.timesMs).reduce<number>((s,v)=>s+Number(v),0)).toBeCloseTo(a.totalMs);
  await page.getByRole("button",{name:"Caderno de revisão",exact:true}).click();
  await expect(page.locator(".result-source")).toHaveCount(1);await expect(page.locator(".result-source")).toContainText("P2026A-Q52");
  const restored=await browser.newContext();try{
    const p=await restored.newPage();await p.goto("/");await expect(p.getByRole("button",{name:"Importar backup"})).toBeEnabled();
    await p.getByLabel("Arquivo de backup").setInputFiles({name:"real.json",mimeType:"application/json",buffer:backup});
    await p.getByRole("button",{name:"Treino",exact:true}).click();await p.getByRole("button",{name:"Ver resultado",exact:true}).click();
    await expect(p.getByText("50.0%",{exact:true})).toBeVisible();
    await p.getByRole("button",{name:"Caderno de revisão",exact:true}).click();await expect(p.locator(".result-source")).toContainText("P2026A-Q52");
  }finally{await restored.close();}
});

test("mesmo número em aplicações diferentes usa as chaves E e A dos respectivos cadernos",async({page})=>{
  for(const [exam,outcome,key] of [["P2026A","Acerto","E"],["P2026B","Erro","A"]]){
    if(exam==="P2026A")await openTraining(page,exam);
    else{await page.getByRole("button",{name:"Voltar aos treinos",exact:false}).click();await page.getByLabel("Prova do treino",{exact:true}).selectOption(exam);}
    await page.getByLabel("Quantidade de questões").fill("1");await page.getByRole("button",{name:"Criar lista de treino"}).click();
    await expect(page.getByText(`${exam}-Q01`,{exact:false})).toBeVisible();
    await page.getByRole("button",{name:"Iniciar ou retomar"}).click();await page.getByRole("radio",{name:"Alternativa E",exact:true}).check();
    await page.getByRole("button",{name:"Finalizar treino",exact:true}).click();await page.getByRole("button",{name:"Confirmar finalização"}).click();
    await expect(page.locator(".results-table tbody tr")).toContainText(outcome);
    expect(question(`${exam}-Q01`).audit!.key!.answer).toBe(key);
    await expect(page.locator(".result-source")).toContainText(question(`${exam}-Q01`).audit!.key!.document);
  }
});

test("prova reservada real só entra com opção explícita; terceiros continuam separados",async({page})=>{
  await openTraining(page,"P2026C");await expect(page.getByText("0 questões disponíveis para este treino")).toBeVisible();
  await page.getByLabel("Incluir reservadas para avaliação",{exact:false}).check();await expect(page.getByText("60 questões disponíveis para este treino")).toBeVisible();
  await page.getByLabel("Incluir reservadas para avaliação",{exact:false}).uncheck();
  await page.getByLabel("Origem do treino",{exact:true}).selectOption("third-party");
  await page.getByLabel("Prova do treino",{exact:true}).selectOption("S2026B");await expect(page.getByText("60 questões disponíveis para este treino")).toBeVisible();
  await page.getByLabel("Prova do treino",{exact:true}).selectOption("S2026A");await expect(page.getByText("0 questões disponíveis para este treino")).toBeVisible();
  await expect(page.getByRole("button",{name:"Criar lista de treino"})).toBeDisabled();
});
