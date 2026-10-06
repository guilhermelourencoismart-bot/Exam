import { test,expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { utility } from "./helpers";
test("duas entradas principais, acervo no menu e filtros preservados",async({page})=>{
 await page.goto("/");await expect(page.getByRole("navigation",{name:"Navegação principal"}).getByRole("button")).toHaveCount(2);
 await expect(page.getByRole("button",{name:"Gerar prova inédita"})).toBeEnabled();await expect(page.getByRole("button",{name:"Conectar ChatGPT",exact:true})).toBeEnabled();await utility(page,"Fontes e acervo");await expect(page.getByText("400 registros encontrados")).toBeVisible();
 await page.getByLabel("Origem do acervo").selectOption("official");await page.getByLabel("Disciplina do acervo").selectOption("Matemática");await page.getByLabel("Assunto do acervo").selectOption("Sistemas lineares");await expect(page.locator(".question-card")).toHaveCount(7);
 await page.getByLabel("Buscar questão").fill("nada-xyz");await expect(page.getByText("0 registros encontrados")).toBeVisible();await page.getByLabel("Buscar questão").fill("");await page.getByLabel("Prova do acervo").selectOption("P2026A");await expect(page.locator(".question-card")).toHaveCount(1);
});
test("conteúdo completo sem gabarito continua apenas consultável",async({page})=>{
 await page.goto("/");await utility(page,"Fontes e acervo");const first=page.locator(".question-card").first();await first.getByText("Consultar extração e fonte").click();await expect(first.getByText("Completa sem correção automática.")).toBeVisible();await expect(first.getByText("Fonte original",{exact:true})).toBeVisible();await first.getByText("Ver resposta registrada no banco").click();await expect(first.getByText("Sem resposta utilizável.",{exact:false})).toBeVisible();
});
test("marcações e backups sobrevivem à atualização da interface",async({page})=>{
 await page.goto("/");await utility(page,"Fontes e acervo");await page.getByRole("button",{name:"Marcar P2019-Q01 para revisar",exact:true}).click();await utility(page);await expect(page.getByText("1 marcação local")).toBeVisible();
 const [download]=await Promise.all([page.waitForEvent("download"),page.getByRole("button",{name:"Exportar backup"}).click()]);const contents=await readFile((await download.path())!,"utf8");expect(JSON.parse(contents).schemaVersion).toBe(3);
 await page.reload();await utility(page,"Fontes e acervo");await expect(page.getByRole("button",{name:"Desmarcar P2019-Q01 para revisar",exact:true})).toBeVisible();await page.getByRole("button",{name:"Desmarcar P2019-Q01 para revisar",exact:true}).click();
 await utility(page);await page.getByLabel("Arquivo de backup").setInputFiles({name:"backup.json",mimeType:"application/json",buffer:Buffer.from(contents)});await expect(page.getByText("1 marcação local")).toBeVisible();
 await page.getByLabel("Arquivo de backup").setInputFiles({name:"invalid.json",mimeType:"application/json",buffer:Buffer.from('{"schemaVersion":99}')});await expect(page.getByText("Formato ou versão de backup incompatível.")).toBeVisible();await expect(page.getByText("1 marcação local")).toBeVisible();
});
test("fontes têm páginas, hipóteses e PDFs íntegros",async({page,request})=>{
 await page.goto("/");await utility(page,"Fontes e acervo");await expect(page.getByText("Todos os PDFs do inventário foram incorporados.")).toBeVisible();const claim=page.locator(".knowledge-card").filter({hasText:"Retorno de estudo é hipótese pedagógica"});await expect(claim.getByRole("link")).toHaveAttribute("href","/sources/relatorio-v1.pdf#page=9");
 for(const url of ["/sources/relatorio-v1.pdf","/sources/conteudo-programatico-2027-1.pdf"]){const r=await request.get(url);expect(r.ok()).toBe(true);expect((await r.body()).subarray(0,5).toString()).toBe("%PDF-");}
});
test("configuração e acervo no celular sem rolagem horizontal",async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto("/");await expect(page.getByRole("heading",{name:"Como você quer praticar?"})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await utility(page,"Fontes e acervo");await page.getByLabel("Disciplina do acervo").selectOption("Biologia");await expect(page.locator(".question-card")).toHaveCount(20);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
