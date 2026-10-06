export class AiError extends Error{
  constructor(public code:string,message:string,public status=400){super(message);}
}
export function safeAiError(error:unknown):AiError{
  if(error instanceof AiError)return error;
  const text=error instanceof Error?error.message:String(error);
  if(/429|rate.?limit|usage.?limit|quota|limit.reached/i.test(text))return new AiError("plan_limit","O limite do seu plano foi atingido. Espere a renovação indicada pelo ChatGPT e tente novamente. O aplicativo não usará API paga.",429);
  if(/401|unauthor|expired|authentication|invalid_token|(?:access|refresh)[_ -]?token/i.test(text))return new AiError("authentication","A autorização expirou ou foi recusada. Reconecte o ChatGPT pelo aplicativo.",401);
  if(/403|forbidden|client.*invalid|invalid.*client|access_denied/i.test(text))return new AiError("authorization","A OpenAI recusou a autorização deste aplicativo. Confira o registro e o Client ID próprio; login no Codex não concede essa autorização.",403);
  if(/timeout|timed out/i.test(text))return new AiError("connection","A OpenAI demorou demais para responder. Retome a geração; nenhum lote incompleto foi liberado.",504);
  if(/abort|cancel/i.test(text))return new AiError("cancelled","Geração cancelada. Nenhuma prova incompleta foi criada.",409);
  if(/ENOENT|Cannot find|Cannot resolve|codex.*not.*found/i.test(text))return new AiError("installation","O componente Codex não foi encontrado. Na pasta do aplicativo execute npm ci e reinicie npm run dev.",503);
  if(/timeout|timed out|ECONN|fetch failed|network|connection|stream|disconnected/i.test(text))return new AiError("connection","A conexão com a OpenAI foi interrompida ou demorou demais. Confira a internet e tente novamente; seu histórico está preservado.",503);
  return new AiError("provider","O componente de IA não concluiu a operação. Reconecte e tente novamente. Consulte as instruções de IA se o erro persistir.",502);
}
