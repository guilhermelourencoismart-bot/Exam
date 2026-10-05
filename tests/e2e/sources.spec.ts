import { test,expect } from "@playwright/test";
import { readFile,stat,unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
test("PDF com nome alterado é reconhecido por conteúdo e servido sem liberar treino",async({page,request})=>{
  const pdf=await readFile("public/sources/conteudo-programatico-2027-1.pdf"),sha=createHash("sha256").update(pdf).digest("hex");
  const files=[`public/sources/originals/${sha}.pdf`,`public/sources/originals/${sha}.json`];
  const existed=await Promise.all(files.map(p=>stat(p).then(()=>true).catch(()=>false)));
  try{
    await page.goto("/");await page.getByRole("button",{name:"Fontes e relatório",exact:true}).click();
    await page.getByLabel("PDFs originais").setInputFiles({name:"nome-alterado.pdf",mimeType:"application/pdf",buffer:pdf});
    await expect(page.getByText("PDFs recebidos.",{exact:false})).toBeVisible();
    // Use the digest-based source record even when a previous legitimate upload exists.
    const records=await(await request.get("/api/sources")).json();const record=records.find((r:{sha256:string})=>r.sha256===sha);
    expect(record.document).toContain("07-Anexo");expect(record.sha256).toBe(sha);
    const result=await request.get(record.url);expect(result.ok()).toBe(true);expect(await result.body()).toEqual(pdf);
    const denied=await request.post("/api/sources",{headers:{origin:"https://example.invalid"},multipart:{file:{name:"other.pdf",mimeType:"application/pdf",buffer:pdf}}});expect(denied.status()).toBe(403);
    await page.getByRole("button",{name:"Treino",exact:true}).click();await expect(page.getByText("120 questões disponíveis para este treino")).toBeVisible();
  }finally{for(let i=0;i<files.length;i++)if(!existed[i])await unlink(files[i]).catch(()=>{});}
});
