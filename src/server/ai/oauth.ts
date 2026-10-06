import { createServer,type Server } from "node:http";
import { randomBytes,createHash,timingSafeEqual,randomUUID } from "node:crypto";
import { createLocalJWKSet,jwtVerify,errors as joseErrors,type JWTPayload } from "jose";
import { readPrivate,writePrivate } from "./local-files";
import type { Credential,Vault } from "./vault";
import { AiError,safeAiError } from "./errors";
export const AUTH="https://auth.openai.com/api/accounts/authorize",TOKEN="https://auth.openai.com/api/accounts/oauth/token";
export const RESOURCE="https://api.openai.com/v1";
export const SCOPES="openid profile email offline_access resource.invoke chatgpt.tokens.use.direct";
export const requiredScopes=["resource.invoke","chatgpt.tokens.use.direct"];
export type Installation={hostId:string;clientId:string|null};
export interface InstallationStore{read():Promise<Installation>;save(value:Installation):Promise<void>}
const bareUuidV4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class LocalInstallation implements InstallationStore{
  async read(){const text=await readPrivate("installation.json");if(text){const v=JSON.parse(text);if(typeof v.hostId!=="string"||!v.hostId||(v.clientId!==null&&typeof v.clientId!=="string"))throw new AiError("registration","Registro local inválido. Consulte as instruções de IA.");
      // Migrate the old UUID representation without changing the installation or issued Client ID.
      if(bareUuidV4.test(v.hostId)){v.hostId=`urn:uuid:${v.hostId}`;await this.save(v);}return v as Installation;}
    const value={hostId:`urn:uuid:${randomUUID()}`,clientId:null};await this.save(value);return value;}
  async save(value:Installation){await writePrivate("installation.json",JSON.stringify(value));}
}
export function secretEqual(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export function authorizationUrl(installation:Installation,redirectUri:string,state:string,nonce:string,verifier:string){
  const url=new URL(AUTH);url.search=new URLSearchParams({response_type:"code",client_id:installation.clientId||"dynamic_agent_client",
    ...(!installation.clientId?{agent_name_hint:"Meu preparo Insper"}:{}),ext_agent_host_id:installation.hostId,redirect_uri:redirectUri,scope:SCOPES,resource:RESOURCE,
    code_challenge:createHash("sha256").update(verifier).digest("base64url"),code_challenge_method:"S256",state,nonce}).toString();return url.toString();
}
export type TokenReply={access_token:string;refresh_token?:string;id_token?:string;expires_in:number;scope:string;token_type:string};
export async function tokenRequest(fields:Record<string,string>,fetcher:typeof fetch=fetch,priorScope?:string):Promise<TokenReply>{
  const response=await fetcher(TOKEN,{method:"POST",redirect:"error",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams(fields),signal:AbortSignal.timeout(30000)});
  if(!response.ok){if(response.status===400||response.status===401)throw new AiError("authentication","A OpenAI recusou ou expirou esta autorização. Conecte novamente.",401);throw safeAiError(new Error(`${response.status} authorization`));}
  const value=await response.json();
  if(fields.grant_type==="refresh_token"&&value.scope===undefined&&priorScope)value.scope=priorScope;
  if(typeof value.access_token!=="string"||!value.access_token||typeof value.token_type!=="string"||value.token_type.toLowerCase()!=="bearer"||
    !Number.isFinite(value.expires_in)||value.expires_in<=0||typeof value.scope!=="string"||!requiredScopes.every(s=>value.scope.split(/\s+/).includes(s)))throw new AiError("scope","A autorização não concedeu uso direto dos tokens do ChatGPT. Conecte novamente e confira o consentimento do plano.",403);
  return value;
}
function identityDiagnostic(code:string,verification:string,reason:string,guidance=""){
  return new AiError("identity",`Conexão rejeitada. Diagnóstico seguro: código=${code}; verificação=${verification}; motivo=${reason}.${guidance?` ${guidance}`:""}`,403);
}
// Never render/log the original error, message, payload, header, key ID or claim value.
// Only fixed labels and allowlisted JOSE error classes may cross the server boundary.
export function idTokenDiagnostic(error:unknown):AiError{
  if(error instanceof joseErrors.JWTExpired||error instanceof joseErrors.JWTClaimValidationFailed){
    const code=error instanceof joseErrors.JWTExpired?joseErrors.JWTExpired.code:joseErrors.JWTClaimValidationFailed.code;
    const claim=error.claim,reason=error.reason==="missing"?"campo_obrigatorio_ausente":error.reason==="invalid"?"tipo_invalido":"verificacao_rejeitada";
    if(claim==="iat"&&error.reason==="check_failed"){
      if(error instanceof joseErrors.JWTExpired)return identityDiagnostic(code,"iat.maxTokenAge_10m","idade_maxima_excedida","Confira o relógio do Windows e inicie uma nova conexão. A validade exp e o limite adicional de 10 minutos são verificações diferentes.");
      return identityDiagnostic(code,"iat.relogio","emissao_no_futuro","Confira data, hora e sincronização do relógio do Windows.");
    }
    const checks:Record<string,string>={iss:"issuer.descoberta",aud:"audience.clientId_emitido",exp:"exp.relogio",iat:"iat",nbf:"nbf.relogio",nonce:"nonce.mesma_tentativa",sub:"subject",typ:"tipo_token"};
    const check=Object.hasOwn(checks,claim)?checks[claim]:"claims";
    return identityDiagnostic(code,check,claim==="exp"&&error instanceof joseErrors.JWTExpired?"token_expirado":reason,
      claim==="exp"||claim==="nbf"?"Confira o relógio do Windows e inicie uma nova conexão.":"");
  }
  if(error instanceof joseErrors.JWSSignatureVerificationFailed)return identityDiagnostic(joseErrors.JWSSignatureVerificationFailed.code,"assinatura","assinatura_nao_confirmada");
  if(error instanceof joseErrors.JWKSNoMatchingKey)return identityDiagnostic(joseErrors.JWKSNoMatchingKey.code,"jwks.selecao_chave","nenhuma_chave_compativel");
  if(error instanceof joseErrors.JWKSMultipleMatchingKeys)return identityDiagnostic(joseErrors.JWKSMultipleMatchingKeys.code,"jwks.selecao_chave","multiplas_chaves_compativeis");
  if(error instanceof joseErrors.JWKSInvalid)return identityDiagnostic(joseErrors.JWKSInvalid.code,"jwks.formato","conjunto_de_chaves_invalido");
  if(error instanceof joseErrors.JWKInvalid)return identityDiagnostic(joseErrors.JWKInvalid.code,"jwk.formato","chave_invalida");
  if(error instanceof joseErrors.JOSEAlgNotAllowed)return identityDiagnostic(joseErrors.JOSEAlgNotAllowed.code,"assinatura.algoritmo","algoritmo_nao_permitido");
  if(error instanceof joseErrors.JOSENotSupported)return identityDiagnostic(joseErrors.JOSENotSupported.code,"assinatura.algoritmo","recurso_nao_suportado");
  if(error instanceof joseErrors.JWSInvalid)return identityDiagnostic(joseErrors.JWSInvalid.code,"jws.formato","assinatura_estruturada_invalida");
  if(error instanceof joseErrors.JWTInvalid)return identityDiagnostic(joseErrors.JWTInvalid.code,"jwt.formato","token_estruturado_invalido");
  if(error instanceof SyntaxError)return identityDiagnostic("INSPER_ID_TOKEN_INVALID_JSON","jwks.formato","json_invalido");
  if(error instanceof TypeError)return identityDiagnostic("INSPER_ID_TOKEN_TYPE_ERROR","chave_ou_configuracao","tipo_invalido");
  return identityDiagnostic("INSPER_ID_TOKEN_UNKNOWN_ERROR","validacao_id_token","falha_nao_classificada");
}
export async function verifyIdToken(idToken:string,clientId:string,nonce:string,fetcher:typeof fetch=fetch):Promise<JWTPayload>{
  const response=await fetcher("https://auth.openai.com/.well-known/openid-configuration",{redirect:"error",signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw safeAiError(new Error(`${response.status} network`));const metadata=await response.json();
  const issuer=new URL(metadata.issuer),jwksUrl=new URL(metadata.jwks_uri);
  if(issuer.protocol!=="https:"||issuer.hostname!=="auth.openai.com"||issuer.port||jwksUrl.protocol!=="https:"||jwksUrl.hostname!=="auth.openai.com"||jwksUrl.port||issuer.username||jwksUrl.username)throw new AiError("identity","Metadados de identidade fora do domínio oficial. A conexão foi rejeitada.",403);
  const keys=await fetcher(jwksUrl,{redirect:"error",signal:AbortSignal.timeout(20000)});if(!keys.ok)throw safeAiError(new Error(`${keys.status} network`));
  let payload:JWTPayload;try{({payload}=await jwtVerify(idToken,createLocalJWKSet(await keys.json()),{issuer:metadata.issuer,audience:clientId,algorithms:["RS256","PS256","ES256","EdDSA"],requiredClaims:["exp","iat","sub","nonce"],clockTolerance:10,maxTokenAge:"10m"}));}
  catch(error){throw idTokenDiagnostic(error);}
  if(typeof payload.nonce!=="string")throw identityDiagnostic("INSPER_ID_TOKEN_NONCE_INVALID","nonce.mesma_tentativa","tipo_invalido");
  if(!secretEqual(payload.nonce,nonce))throw identityDiagnostic("INSPER_ID_TOKEN_NONCE_MISMATCH","nonce.mesma_tentativa","nonce_divergente","Feche a janela antiga e inicie uma nova conexão no aplicativo.");
  if(!payload.sub)throw identityDiagnostic("INSPER_ID_TOKEN_SUBJECT_INVALID","subject","identidade_ausente");
  return payload;
}
export class LocalOAuth{
  private server:Server|null=null;private timer:ReturnType<typeof setTimeout>|null=null;private pending=false;
  message="";connecting=false;
  completed=0;private epoch=0;
  constructor(private vault:Vault,private installation:InstallationStore,private fetcher:typeof fetch=fetch,
    private verify:(token:string,clientId:string,nonce:string)=>Promise<JWTPayload>=(t,c,n)=>verifyIdToken(t,c,n,fetcher)){}
  async start(){
    if(this.connecting)throw new AiError("connecting","Já existe uma autorização aberta. Conclua ou cancele antes de tentar novamente.",409);
    const epoch=++this.epoch;this.connecting=true;this.pending=false;this.message="Aguardando seu consentimento no navegador…";
    let install:Installation;try{install=await this.installation.read();}catch(e){this.connecting=false;throw e;}
    if(epoch!==this.epoch)throw new AiError("cancelled","A autorização foi cancelada.",409);
    const state=randomBytes(32).toString("base64url"),nonce=randomBytes(32).toString("base64url"),verifier=randomBytes(48).toString("base64url");
    const server=createServer(async(req,res)=>{
      res.setHeader("Cache-Control","no-store");res.setHeader("Referrer-Policy","no-referrer");res.setHeader("Content-Type","text/html; charset=utf-8");res.setHeader("Content-Security-Policy","default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'");
      const page=(message:string,status=200)=>{res.writeHead(status);res.end(`<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width"><title>Meu preparo</title><body style="font:18px system-ui;padding:40px;max-width:650px;margin:auto"><h1>Meu preparo · ChatGPT</h1><p>${message}</p><p>Volte à aba do aplicativo.</p></body></html>`);};
      const address=server.address();if(!address||typeof address==="string")return page("Callback indisponível.",400);
      if(req.method!=="GET"||req.headers.host!==`127.0.0.1:${address.port}`||!req.url||req.url.length>16000)return page("Solicitação inválida.",400);
      const url=new URL(req.url,`http://127.0.0.1:${address.port}`);if(url.pathname!=="/auth/callback")return page("Página não encontrada.",404);
      if(["state","code","client_id"].some(k=>url.searchParams.getAll(k).length>1))return page("Parâmetros de autorização duplicados.",400);
      if(!secretEqual(url.searchParams.get("state")||"",state))return page("Estado da autorização inválido. Tente conectar novamente.",400);
      if(this.pending)return page("Esta autorização já está sendo processada.",409);this.pending=true;
      try{
        if(url.searchParams.has("error"))throw new AiError("consent","Você recusou a autorização ou a OpenAI não permitiu o uso do plano. Nenhuma conexão foi criada.",403);
        const code=url.searchParams.get("code"),issuedId=url.searchParams.get("client_id")||install.clientId;
        if(!code||!issuedId||issuedId==="dynamic_agent_client"||!/^[A-Za-z0-9_-]{5,200}$/.test(issuedId)||(install.clientId&&issuedId!==install.clientId))throw new AiError("registration","O callback não trouxe um registro próprio válido para este aplicativo. A conexão foi rejeitada.",403);
        const redirectUri=`http://127.0.0.1:${address.port}/auth/callback`;
        const tokens=await tokenRequest({grant_type:"authorization_code",client_id:issuedId,code,code_verifier:verifier,redirect_uri:redirectUri,resource:RESOURCE},this.fetcher);
        if(typeof tokens.id_token!=="string")throw new AiError("identity","A OpenAI não retornou o ID token necessário para validar esta conexão.",403);
        const identity=await this.verify(tokens.id_token,issuedId,nonce);
        if(epoch!==this.epoch)throw new AiError("cancelled","Esta autorização foi cancelada.",409);
        const prior=await this.vault.read().catch(()=>null);
        const credential:Credential={accessToken:tokens.access_token,refreshToken:tokens.refresh_token||null,expiresAt:Date.now()+tokens.expires_in*1000,
          scope:tokens.scope,clientId:issuedId,subject:identity.sub!,email:typeof identity.email==="string"?identity.email:null,
          lastSuccessfulInferenceAt:prior&&prior.subject===identity.sub&&prior.clientId===issuedId?prior.lastSuccessfulInferenceAt:null,
          lastDisplayedGenerationAt:prior&&prior.subject===identity.sub&&prior.clientId===issuedId?prior.lastDisplayedGenerationAt:null};
        await this.installation.save({...install,clientId:issuedId});if(epoch!==this.epoch)throw new AiError("cancelled","Esta autorização foi cancelada.",409);await this.vault.save(credential);this.completed++;
        this.message="ChatGPT conectado com autorização própria para uso do plano.";page("Conexão autorizada e identidade validada. Você já pode gerar as três questões de teste.");
      }catch(e){const error=safeAiError(e);if(epoch===this.epoch)this.message=error.message;page(error.message,error.status);}finally{if(epoch===this.epoch)this.stop();}
    });
    this.server=server;
    try{await new Promise<void>((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});}
    catch(e){this.stop();throw safeAiError(e);}
    const address=server.address();if(!address||typeof address==="string"){this.stop();throw new AiError("callback","Não foi possível abrir o callback local.",503);}
    this.timer=setTimeout(()=>{this.message="A autorização expirou após cinco minutos. Clique em Conectar ChatGPT novamente.";this.stop();},5*60*1000);this.timer.unref();
    return {authUrl:authorizationUrl(install,`http://127.0.0.1:${address.port}/auth/callback`,state,nonce,verifier)};
  }
  stop(){this.epoch++;if(this.timer)clearTimeout(this.timer);this.timer=null;this.server?.close();this.server=null;this.connecting=false;}
  async disconnect(){this.stop();await this.vault.clear();this.message="ChatGPT desconectado. Seu histórico e as questões geradas continuam salvos.";}
}
