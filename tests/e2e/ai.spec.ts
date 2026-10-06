import { test,expect,type BrowserContext } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { authored,generationId } from "../fixtures/authored";
import type { ConnectionState,GenerationJob } from "../../src/ai/protocol";
import { utility,total } from "./helpers";
// All OpenAI calls in this file are replaced in the browser. This never authenticates a person.
async function simulatedOAuth(context:BrowserContext){
 const state:ConnectionState={status:"disconnected",registeredClientConfigured:false,plan:null,model:null,message:"Conecte seu ChatGPT para criar questões inéditas.",inferenceValidated:false,lastSuccessfulInferenceAt:null,limits:[],session:"csrf-mock-session"};
 let job:GenerationJob|null=null,reads=0,displayed=0;
 await context.route("https://auth.openai.com/**",r=>r.fulfill({contentType:"text/html",body:"<p>Autorização simulada: nenhuma conta real.</p>"}));
 await context.route("**/api/ai/*",async r=>{
  const action=new URL(r.request().url()).pathname.split("/").pop();
  if(action==="status")return r.fulfill({json:state});
  if(action==="connect"){state.status="connected";state.registeredClientConfigured=true;state.message="ChatGPT autorizado para este aplicativo (mock).";return r.fulfill({json:{authUrl:"https://auth.openai.com/api/accounts/authorize?client_id=dynamic_agent_client&state=mock"}});}
  if(action==="generate"){
   const body=r.request().postDataJSON();expect(body.plan.lines[0].quantity).toBe(3);expect(body.plan.lines[0].topic).toBe("Sistemas lineares");expect(r.request().headers()["x-insper-session"]).toBe(state.session);
   const now=new Date().toISOString();job={id:generationId,plan:body.plan,status:"generating",total:3,accepted:0,message:"Gerando lote simulado…",createdAt:now,updatedAt:now,questions:[]};return r.fulfill({status:202,json:job});
  }
  if(action==="job"&&job){reads++;if(reads<2){job.status="reviewing";job.message="Revisando lote simulado…";}else{job.status="completed";job.accepted=3;job.message="3 questões simuladas revisadas para o teste";job.questions=[authored(1),authored(2),authored(3)];}return r.fulfill({json:job});}
  if(action==="displayed"){displayed++;state.inferenceValidated=true;state.lastSuccessfulInferenceAt=new Date().toISOString();state.model="mock-model";return r.fulfill({json:state});}
  if(action==="disconnect"){state.status="disconnected";return r.fulfill({json:state});}
  return r.fulfill({status:404,json:{error:"Operação não simulada"}});
 });
 return {state,displayed:()=>displayed};
}
test("SIMULADO: conectar, gerar três sistemas, treinar, recuperar, corrigir, revisar e restaurar backup",async({context,page,browser})=>{
 const mocked=await simulatedOAuth(context);await page.goto("/");const popupPromise=page.waitForEvent("popup");await page.getByRole("button",{name:"Conectar ChatGPT",exact:true}).click();const popup=await popupPromise;await popup.close();
 await expect(page.getByText("ChatGPT conectado",{exact:true})).toBeVisible();await page.getByRole("button",{name:"Testar 3 questões de sistemas lineares",exact:true}).click();
 await expect(page.getByRole("heading",{name:"3 questões de sistemas lineares",exact:true})).toBeVisible();await expect(page.locator(".linear-system")).toContainText("1x + 1y = 3");await expect(page.getByRole("button",{name:"Iniciar ou retomar"})).toBeEnabled();await expect.poll(mocked.displayed).toBe(1);expect(mocked.state.inferenceValidated).toBe(true);
 await expect(page.locator(".resolution")).toHaveCount(0);await page.getByRole("button",{name:"Iniciar ou retomar"}).click();await page.getByRole("radio",{name:"Alternativa A",exact:true}).check();await page.getByRole("button",{name:"Próxima questão →",exact:true}).click();await page.getByRole("radio",{name:"Alternativa B",exact:true}).check();await page.getByRole("button",{name:"Pausar",exact:true}).click();await expect(page.getByRole("button",{name:"Iniciar ou retomar"})).toBeEnabled();const time=await total(page);await page.waitForTimeout(1200);expect(await total(page)).toBe(time);
 await page.reload();await expect(page.getByRole("button",{name:"Iniciar ou retomar"})).toBeEnabled();expect(await total(page)).toBe(time);await expect(page.getByRole("radio",{name:"Alternativa B",exact:true})).toBeChecked();await page.getByRole("button",{name:"Iniciar ou retomar"}).click();await page.getByRole("button",{name:"Ir para questão 3",exact:true}).click();await page.getByRole("button",{name:"Finalizar prova",exact:true}).click();await page.getByRole("button",{name:"Confirmar finalização",exact:true}).click();
 await expect(page.getByTestId("summary-correct")).toHaveText("1 / 3 acertos");await expect(page.getByTestId("summary-percentage")).toHaveText("33.3%");await expect(page.getByTestId("summary-wrong")).toHaveText("1");await expect(page.getByTestId("summary-blank")).toHaveText("1");await page.locator(".result-source summary").first().click();await expect(page.getByRole("heading",{name:"Resolução autoral por IA"}).first()).toBeVisible();await expect(page.locator(".resolution").first()).toContainText("não é resolução oficial");
 await utility(page);const [download]=await Promise.all([page.waitForEvent("download"),page.getByRole("button",{name:"Exportar backup"}).click()]);const bytes=await readFile((await download.path())!),backup=JSON.parse(bytes.toString());expect(backup.schemaVersion).toBe(4);expect(backup.attempts[0].items[0].author).toBeDefined();expect(bytes.toString()).not.toMatch(/accessToken|refreshToken|csrf-mock-session/);
 const restored=await browser.newContext();try{await simulatedOAuth(restored);const p=await restored.newPage();await p.goto("/");await utility(p);await p.getByLabel("Arquivo de backup").setInputFiles({name:"authored-backup.json",mimeType:"application/json",buffer:bytes});await expect(p.getByText(/Backup importado:/)).toBeVisible();await p.getByRole("button",{name:"Revisão",exact:true}).click();await expect(p.getByTestId("summary-correct")).toHaveText("1 / 3 acertos");await p.getByLabel("Origem da revisão").selectOption("ai");await expect(p.getByTestId("summary-percentage")).toHaveText("33.3%");await p.getByRole("button",{name:"Selecionar todos os erros"}).click();await p.getByRole("button",{name:/Criar lista de revisão/}).click();await expect(p.locator(".authored-content")).toContainText("Exercício sintético 2");await expect(p.getByRole("button",{name:"Iniciar ou retomar"})).toBeEnabled();}finally{await restored.close();}
});
for(const width of [1440,390])test(`SIMULADO: conexão e questões autorais responsivas em ${width}px`,async({context,page})=>{
 await simulatedOAuth(context);await page.setViewportSize({width,height:width===390?844:1000});await page.goto("/");await expect(page.getByRole("button",{name:"Conectar ChatGPT",exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`/tmp/insper-v4-connection-${width}.png`,fullPage:true});
 const popup=page.waitForEvent("popup");await page.getByRole("button",{name:"Conectar ChatGPT",exact:true}).click();await (await popup).close();await page.getByRole("button",{name:"Testar 3 questões de sistemas lineares"}).click();await expect(page.locator(".authored-content")).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`/tmp/insper-v4-authored-${width}.png`,fullPage:true});
});
