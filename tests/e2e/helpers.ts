import { expect,type Page,type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readFile as readAsync } from "node:fs/promises";
import { trainingCatalog } from "../fixtures/catalog";
import { areaOf } from "../../src/domain/classification";
import { addElapsed,answerAttempt,createAttempt,finishAttempt,navigateAttempt,type Attempt } from "../../src/domain/training";
import type { Catalog,Question } from "../../src/domain/types";
export const realCatalog=JSON.parse(readFileSync("public/data/catalog.json","utf8")) as Catalog;
export async function utility(page:Page,name="Dados e configurações"){
 await page.getByRole("button",{name:"Menu de fontes e configurações"}).click();await page.getByRole("button",{name,exact:true}).click();
}
export async function bank(page:Page,exam="",discipline="Matemática",quantity=1){
 await page.goto("/");await page.getByRole("button",{name:/^Banco conferido/}).click();await page.getByRole("button",{name:"Prova personalizada",exact:true}).click();
 if(exam)await page.getByLabel("Prova de origem",{exact:true}).selectOption(exam);
 await page.getByLabel("Matéria 1",{exact:true}).selectOption(areaOf(discipline));await page.getByLabel("Disciplina 1",{exact:true}).selectOption(discipline);await page.getByLabel("Quantidade 1",{exact:true}).fill(String(quantity));
}
export async function fixtures(context:BrowserContext){
 await context.route("**/data/catalog.json",route=>route.fulfill({json:trainingCatalog()}));await context.route("**/sources/rendered/test-*.png",async route=>{const name=new URL(route.request().url()).pathname.split("/").pop()!;await route.fulfill({contentType:"image/png",body:await readAsync(`tests/fixtures/${name}`)});});
}
export async function total(page:Page){return Number(await page.getByTestId("total-time").getAttribute("data-ms"));}
export function knownAttempt(qs:Question[],correctIds:Set<string>,blankIds:Set<string>,id:string,date:string,ms:number):Attempt{
 let a=createAttempt(qs,qs.length,id,false,id,date);delete a.telemetry;
 for(let i=0;i<qs.length;i++){const q=qs[i];a=navigateAttempt(a,i);a=addElapsed(a,ms);a=answerAttempt(a,q.id,blankIds.has(q.id)?null:correctIds.has(q.id)?q.audit!.key!.answer:q.audit!.key!.answer==="A"?"B":"A");}return finishAttempt(a,date);
}
export async function importAttempts(page:Page,attempts:Attempt[]){
 await utility(page);await expect(page.getByRole("button",{name:"Importar backup"})).toBeEnabled();
 await page.getByLabel("Arquivo de backup").setInputFiles({name:"known-v2.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify({app:"insper-pessoal",schemaVersion:2,exportedAt:new Date().toISOString(),bookmarks:[],attempts}))});
 await expect(page.getByText(/Backup importado:/)).toBeVisible();
}
