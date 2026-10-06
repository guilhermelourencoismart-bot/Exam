import type { AuthoredQuestion } from "@/domain/authored";
export function linearEquation(coefficients:number[],constant:number){const variables=["x","y","z"];return coefficients.map((v,i)=>`${i?(v<0?" − ":" + "):v<0?"−":""}${Math.abs(v)}${variables[i]}`).join("")+` = ${constant}`;}
export default function AuthoredContent({question,options=false}:{question:AuthoredQuestion;options?:boolean}){
  return <div className="authored-content"><p className="raw-text authored-stem">{question.stem}</p>{question.linearSystem&&<div className="linear-system" aria-label="Sistema de equações">{question.linearSystem.coefficients.map((r,i)=><p key={i}>{linearEquation(r,question.linearSystem!.constants[i])}</p>)}</div>}
    {options&&<ol className="authored-review-options" type="A">{["A","B","C","D","E"].map(l=><li key={l}><span className="raw-text">{question.options[l as keyof typeof question.options]}</span></li>)}</ol>}
  </div>;
}
