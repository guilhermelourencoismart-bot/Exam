import { afterEach,beforeAll,describe,expect,it,vi } from "vitest";
import { createHash } from "node:crypto";
import { SignJWT,generateKeyPair,exportJWK,errors as joseErrors } from "jose";
import { AUTH,TOKEN,RESOURCE,SCOPES,LocalOAuth,authorizationUrl,verifyIdToken,tokenRequest,idTokenDiagnostic,type Installation,type InstallationStore } from "../../src/server/ai/oauth";
import { ChatGPTPlanProvider } from "../../src/server/ai/provider";
import type { Credential,Vault } from "../../src/server/ai/vault";
import { dpapiScript } from "../../src/server/ai/vault";
import { secureLocalRequest } from "../../src/server/ai/http";
class MemoryVault implements Vault{value:Credential|null=null;async read(){return this.value;}async save(v:Credential){this.value=structuredClone(v);}async clear(){this.value=null;}}
class MemoryInstallation implements InstallationStore{value:Installation={hostId:"urn:uuid:6ff47b2b-180f-40e2-a37b-3221cb53b2d0",clientId:null};async read(){return {...this.value};}async save(v:Installation){this.value={...v};}}
const auths:LocalOAuth[]=[];afterEach(()=>auths.splice(0).forEach(a=>a.stop()));
describe("OAuth local: protocolo simulado, sem conta real",()=>{
 it("registra o aplicativo dinamicamente com PKCE S256, nonce, state e instalação estável",()=>{
  const i={hostId:"urn:uuid:6ff47b2b-180f-40e2-a37b-3221cb53b2d0",clientId:null},url=new URL(authorizationUrl(i,"http://127.0.0.1:1234/auth/callback","state1","nonce1","verifier1"));
  expect(url.origin+url.pathname).toBe(AUTH);expect(url.searchParams.get("client_id")).toBe("dynamic_agent_client");expect(url.searchParams.get("agent_name_hint")).toBe("Meu preparo Insper");expect(url.searchParams.get("ext_agent_host_id")).toBe(i.hostId);
  expect(url.searchParams.get("code_challenge")).toBe(createHash("sha256").update("verifier1").digest("base64url"));expect(url.searchParams.get("code_challenge_method")).toBe("S256");expect(url.searchParams.get("resource")).toBe(RESOURCE);expect(url.searchParams.get("scope")).toBe(SCOPES);
 });
 it("callback real em loopback valida state e troca código com o Client ID emitido; login seguinte o reutiliza",async()=>{
  const vault=new MemoryVault(),installation=new MemoryInstallation();let tokenForm:URLSearchParams|undefined,verificationNonce="";
  const network=vi.fn(async(url:any,init:any)=>{expect(url).toBe(TOKEN);tokenForm=new URLSearchParams(init.body);return Response.json({access_token:"synthetic_access",refresh_token:"synthetic_refresh",id_token:"synthetic_id",token_type:"Bearer",expires_in:3600,scope:SCOPES});}) as unknown as typeof fetch;
  const oauth=new LocalOAuth(vault,installation,network,async(t,c,n)=>{expect(t).toBe("synthetic_id");expect(c).toBe("app_insper_test123");verificationNonce=n;return {sub:"test-person",email:"test@example.invalid"};});auths.push(oauth);
  const url=new URL((await oauth.start()).authUrl),redirect=url.searchParams.get("redirect_uri")!;
  const invalid=await fetch(`${redirect}?code=synthetic_code&client_id=app_insper_test123&state=wrong`);expect(invalid.status).toBe(400);expect(network).not.toHaveBeenCalled();expect(oauth.connecting).toBe(true);
  const callback=new URL(redirect);callback.search=new URLSearchParams({code:"synthetic_code",client_id:"app_insper_test123",state:url.searchParams.get("state")!}).toString();const r=await fetch(callback);expect(r.status).toBe(200);expect(await r.text()).not.toMatch(/synthetic_access|synthetic_refresh|synthetic_code/);
  expect(tokenForm!.get("redirect_uri")).toBe(redirect);expect(tokenForm!.get("client_id")).toBe("app_insper_test123");expect(tokenForm!.get("resource")).toBe(RESOURCE);expect(tokenForm!.has("client_secret")).toBe(false);
  expect(createHash("sha256").update(tokenForm!.get("code_verifier")!).digest("base64url")).toBe(url.searchParams.get("code_challenge"));expect(verificationNonce).toBe(url.searchParams.get("nonce"));expect(vault.value?.scope).toBe(SCOPES);
  const next=new URL((await oauth.start()).authUrl);expect(next.searchParams.get("client_id")).toBe("app_insper_test123");expect(next.searchParams.has("agent_name_hint")).toBe(false);expect(next.searchParams.get("ext_agent_host_id")).toBe(url.searchParams.get("ext_agent_host_id"));expect(next.searchParams.get("state")).not.toBe(url.searchParams.get("state"));expect(next.searchParams.get("nonce")).not.toBe(url.searchParams.get("nonce"));
 });
 it("recusa consentimento, registro incompleto e permissões ausentes sem salvar credenciais",async()=>{
  for(const mode of ["denied","missing-registration","missing-scope"]){
   const vault=new MemoryVault(),network=vi.fn(async()=>Response.json({access_token:"synthetic_access",id_token:"synthetic_id",token_type:"Bearer",expires_in:3600,scope:"openid resource.invoke"})) as unknown as typeof fetch;
   const oauth=new LocalOAuth(vault,new MemoryInstallation(),network,async()=>({sub:"test"}));auths.push(oauth);const url=new URL((await oauth.start()).authUrl),callback=new URL(url.searchParams.get("redirect_uri")!);
   callback.searchParams.set("state",url.searchParams.get("state")!);if(mode==="denied")callback.searchParams.set("error","access_denied");else{callback.searchParams.set("code","synthetic_code");if(mode!=="missing-registration")callback.searchParams.set("client_id","app_insper_test123");}
   expect((await fetch(callback)).status).toBe(403);expect(vault.value).toBeNull();
  }
 });
 it("a troca não aceita token de API, scope omitido ou token inválido; refresh pode conservar scope já concedido",async()=>{
  const mock=(scope?:string,token_type="Bearer")=>(async()=>Response.json({access_token:"synthetic",expires_in:3600,token_type,...(scope?{scope}:{})})) as typeof fetch;
  await expect(tokenRequest({grant_type:"authorization_code"},mock())).rejects.toThrow("autorização");await expect(tokenRequest({grant_type:"authorization_code"},mock(SCOPES,"ApiKey"))).rejects.toThrow();
  expect((await tokenRequest({grant_type:"refresh_token"},mock(),SCOPES)).scope).toBe(SCOPES);
 });
 it("protege as rotas contra origem externa, Host de DNS rebinding e sessão ausente",()=>{
  const req=(host:string,origin:string,session="s")=>new Request(`http://${host}/api/ai/connect`,{method:"POST",headers:{host,origin,"x-insper-session":session}});
  expect(()=>secureLocalRequest(req("127.0.0.1:3000","http://127.0.0.1:3000"),"s")).not.toThrow();
  for(const r of [req("evil.example:3000","http://evil.example:3000"),req("127.0.0.1:3000","https://evil.example"),req("127.0.0.1:3000","http://127.0.0.1:3000","")])expect(()=>secureLocalRequest(r,"s")).toThrow();
 });
 it("DPAPI usa usuário atual e stdin, sem credencial interpolada em comando",()=>{
  expect(dpapiScript(false)).toContain("::Protect");expect(dpapiScript(true)).toContain("::Unprotect");expect(dpapiScript(false)).toContain("::CurrentUser");expect(dpapiScript(false)).toContain("[Console]::In.ReadToEnd()");
 });
});
describe("verificação criptográfica real de tokens sintéticos",()=>{
 let privateKey:CryptoKey,publicJwk:any;
 beforeAll(async()=>{const keys=await generateKeyPair("RS256");privateKey=keys.privateKey;publicJwk={...await exportJWK(keys.publicKey),kid:"test-key"};});
 const issuer="https://auth.openai.com",client="app_insper_test123";
 function network(){return (async(url:any)=>String(url).includes("openid-configuration")?Response.json({issuer,jwks_uri:`${issuer}/keys`}):Response.json({keys:[publicJwk]})) as typeof fetch;}
 async function signed(overrides:Record<string,unknown>={}){return new SignJWT({nonce:"nonce-test",sub:"person-test",iss:issuer,aud:client,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600,...overrides}).setProtectedHeader({alg:"RS256",kid:"test-key"}).sign(privateKey);}
 it("confere assinatura, issuer, audience, expiração e nonce",async()=>{
  expect((await verifyIdToken(await signed(),client,"nonce-test",network())).sub).toBe("person-test");
  for(const changes of [{iss:"https://evil.example"},{aud:"another-app"},{exp:1},{nonce:"wrong"}])await expect(verifyIdToken(await signed(changes),client,"nonce-test",network())).rejects.toThrow();
  const other=await generateKeyPair("RS256"),bad=await new SignJWT({nonce:"nonce-test"}).setSubject("test").setIssuer(issuer).setAudience(client).setIssuedAt().setExpirationTime("1h").setProtectedHeader({alg:"RS256",kid:"test-key"}).sign(other.privateKey);await expect(verifyIdToken(bad,client,"nonce-test",network())).rejects.toThrow("assinatura");
 });
 it.each([
  [{iss:"https://issuer-sensitive.invalid"},"ERR_JWT_CLAIM_VALIDATION_FAILED","issuer.descoberta"],
  [{aud:"sensitive-wrong-client"},"ERR_JWT_CLAIM_VALIDATION_FAILED","audience.clientId_emitido"],
  [{exp:1},"ERR_JWT_EXPIRED","exp.relogio"],
  [{iat:Math.floor(Date.now()/1000)-3600},"ERR_JWT_EXPIRED","iat.maxTokenAge_10m"],
  [{iat:Math.floor(Date.now()/1000)+3600},"ERR_JWT_CLAIM_VALIDATION_FAILED","iat.relogio"],
  [{nbf:Math.floor(Date.now()/1000)+3600},"ERR_JWT_CLAIM_VALIDATION_FAILED","nbf.relogio"],
  [{iat:"sensitive-iat"},"ERR_JWT_CLAIM_VALIDATION_FAILED","iat"],
  [{nonce:"sensitive-wrong-nonce"},"INSPER_ID_TOKEN_NONCE_MISMATCH","nonce.mesma_tentativa"],
  [{nonce:123},"INSPER_ID_TOKEN_NONCE_INVALID","nonce.mesma_tentativa"],
 ])("rejeita a falha %j e retorna código %s e verificação %s sem dados do token",async(overrides,code,check)=>{
  const token=await signed({...overrides,email:"sensitive-person@example.invalid"});
  const error=await verifyIdToken(token,client,"nonce-test",network()).catch(e=>e);
  expect(error.status).toBe(403);expect(error.code).toBe("identity");
  expect(error.message).toContain(`código=${code}; verificação=${check};`);
  expect(error.message).not.toMatch(/sensitive|person-test|nonce-test|app_insper_test123|https:\/\//);
  expect(error.message).not.toContain(token);
 });
 it("distingue assinatura inválida de chave não encontrada e JWKS inválido",async()=>{
  const other=await generateKeyPair("RS256"),wrongJwk={...await exportJWK(other.publicKey),kid:"test-key"};
  for(const [keys,code,check] of [
   [{keys:[wrongJwk]},"ERR_JWS_SIGNATURE_VERIFICATION_FAILED","assinatura"],
   [{keys:[{...publicJwk,kid:"sensitive-unknown-key"}]},"ERR_JWKS_NO_MATCHING_KEY","jwks.selecao_chave"],
   [{keys:"sensitive-invalid"},"ERR_JWKS_INVALID","jwks.formato"],
  ] as const){
   const fetcher=(async(url:any)=>String(url).includes("openid-configuration")?Response.json({issuer,jwks_uri:`${issuer}/keys`}):Response.json(keys)) as typeof fetch;
   await expect(verifyIdToken(await signed(),client,"nonce-test",fetcher)).rejects.toThrow(`código=${code}; verificação=${check};`);
  }
 });
 it("mantém as exigências de campos obrigatórios e o limite adicional de idade",async()=>{
  const payload={nonce:"nonce-test",sub:"person-test",iss:issuer,aud:client,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600};
  for(const claim of ["exp","iat","nonce"]){
   const missing:Record<string,unknown>={...payload};delete missing[claim];
   const token=await new SignJWT(missing).setProtectedHeader({alg:"RS256",kid:"test-key"}).sign(privateKey);
   await expect(verifyIdToken(token,client,"nonce-test",network())).rejects.toThrow("campo_obrigatorio_ausente");
  }
  // exp still in the future cannot bypass the independent 10-minute age check.
  await expect(verifyIdToken(await signed({iat:Math.floor(Date.now()/1000)-700}),client,"nonce-test",network())).rejects.toThrow("idade_maxima_excedida");
 });
 it("mostra o diagnóstico no callback e no estado da conexão sem salvar credenciais",async()=>{
  const token=await signed({aud:"sensitive-wrong-client",email:"sensitive-person@example.invalid"}),vault=new MemoryVault(),installation=new MemoryInstallation();
  const fetcher=(async(url:any)=>String(url)===TOKEN?Response.json({access_token:"sensitive-access",refresh_token:"sensitive-refresh",id_token:token,token_type:"Bearer",expires_in:3600,scope:SCOPES}):network()(url)) as typeof fetch;
  const oauth=new LocalOAuth(vault,installation,fetcher);auths.push(oauth);
  const authUrl=new URL((await oauth.start()).authUrl),callback=new URL(authUrl.searchParams.get("redirect_uri")!);
  callback.search=new URLSearchParams({code:"sensitive-code",client_id:client,state:authUrl.searchParams.get("state")!}).toString();
  const response=await fetch(callback),html=await response.text();
  expect(response.status).toBe(403);expect(html).toContain("ERR_JWT_CLAIM_VALIDATION_FAILED");expect(html).toContain("audience.clientId_emitido");
  const status=await new ChatGPTPlanProvider(vault,oauth,fetcher).status();expect(status.message).toBe(oauth.message);expect(status.message).toContain("audience.clientId_emitido");
  for(const value of [token,"sensitive",authUrl.toString(),callback.toString(),authUrl.searchParams.get("nonce")!,authUrl.searchParams.get("state")!]){expect(html).not.toContain(value);expect(status.message).not.toContain(value);}
  expect(vault.value).toBeNull();expect(installation.value.clientId).toBeNull();expect(oauth.completed).toBe(0);
 });
});
describe("diagnóstico seguro: não encaminha mensagens nem propriedades arbitrárias",()=>{
 it("usa exclusivamente rótulos fixos mesmo quando o erro contém segredos ou HTML",()=>{
  const secret="<script>sensitive-token-person-url</script>";
  const claimError=new joseErrors.JWTClaimValidationFailed(secret,{email:secret},secret,secret);claimError.code=secret;
  for(const error of [claimError,new Error(secret),new TypeError(secret),new joseErrors.JOSEAlgNotAllowed(secret),new joseErrors.JWKInvalid(secret),new joseErrors.JWKSMultipleMatchingKeys(secret)]){
   const diagnostic=idTokenDiagnostic(error);expect(diagnostic.code).toBe("identity");expect(diagnostic.message).toContain("Diagnóstico seguro: código=");expect(diagnostic.message).not.toContain(secret);expect(diagnostic.message).not.toMatch(/<|>|sensitive/);
  }
  expect(idTokenDiagnostic(claimError).message).toContain("ERR_JWT_CLAIM_VALIDATION_FAILED; verificação=claims");
 });
});
