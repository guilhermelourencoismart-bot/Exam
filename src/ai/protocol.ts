import type { AuthoredQuestion } from "@/domain/authored";
import type { ProofPlan } from "@/domain/proof-plan";
export const siwcDocs="https://developers.openai.com/siwc/token-sharing-open-source";
export type ConnectionState={status:"unconfigured"|"disconnected"|"connecting"|"connected"|"error";
  registeredClientConfigured:boolean;plan:string|null;model:string|null;message:string;
  inferenceValidated:boolean;lastSuccessfulInferenceAt:string|null;limits:{usedPercent:number;resetsAt:number|null}[];session:string};
export type GenerationJob={id:string;plan:ProofPlan;status:"generating"|"reviewing"|"completed"|"failed"|"cancelled";
  total:number;accepted:number;message:string;createdAt:string;updatedAt:string;questions:AuthoredQuestion[]};
export type InferenceResult={value:unknown;model:string;turnId:string};
export interface PlanProvider{status():Promise<ConnectionState>;infer(prompt:string,schema:unknown,signal?:AbortSignal):Promise<InferenceResult>}
