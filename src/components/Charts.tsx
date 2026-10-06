import { areas } from "@/domain/classification";
import type { Group } from "@/domain/analytics";
export type PlotPoint = {label:string;value:number|null;detail:string};
export function LineChart({title,points,suffix="%"}:{title:string;points:PlotPoint[];suffix?:string}){
  const valid=points.filter(p=>p.value!==null);
  if(!valid.length)return <div className="chart-empty"><h3>{title}</h3><p>Dados insuficientes</p></div>;
  const max=suffix==="%"?100:Math.max(1,...valid.map(p=>p.value!))*1.15;
  const x=(i:number)=>48+(points.length===1?194:i/(points.length-1)*388),y=(v:number)=>164-v/max*126;
  let segments:string[]=[];let segment="";
  points.forEach((p,i)=>{if(p.value===null){if(segment)segments.push(segment);segment="";}else segment+=`${x(i)},${y(p.value)} `;});if(segment)segments.push(segment);
  return <figure className="chart"><figcaption>{title}</figcaption><svg viewBox="0 0 480 205" role="img" aria-label={title}>
    {[0,.5,1].map(f=><g key={f}><line x1="48" x2="444" y1={y(f*max)} y2={y(f*max)} stroke="var(--line)"/><text x="39" y={y(f*max)+4} textAnchor="end" className="axis-label">{Math.round(f*max)}{suffix}</text></g>)}
    {segments.map((s,i)=><polyline key={i} points={s} fill="none" stroke="var(--accent)" strokeWidth="2.5"/>)}
    {points.map((p,i)=><g key={i}>{p.value!==null&&<circle cx={x(i)} cy={y(p.value)} r="4.5" fill="var(--accent)" tabIndex={0}><title>{p.label}: {p.value.toFixed(1)}{suffix}. {p.detail}</title></circle>}
      {(points.length<8||i===0||i===points.length-1)&&<text x={x(i)} y="187" textAnchor="middle" className="axis-label">{p.label}</text>}</g>)}
  </svg><details className="chart-data"><summary>Ver valores do gráfico</summary><ul>{points.map((p,i)=><li key={i}>{p.label}: {p.value===null?"dados insuficientes":`${p.value.toFixed(1)}${suffix}`} · {p.detail}</li>)}</ul></details></figure>;
}
export function RadarChart({current,history}:{current:Group[];history:Group[]}){
  const cx=190,cy=153,r=94,point=(i:number,value:number)=>{const angle=-Math.PI/2+i*Math.PI/2;return [cx+Math.cos(angle)*r*value/100,cy+Math.sin(angle)*r*value/100];};
  const series=(groups:Group[])=>areas.map(a=>groups.find(g=>g.key===a)?.stats.percentage??null);
  const now=series(current),before=series(history);
  return <figure className="chart radar"><figcaption>Seu desempenho por área</figcaption><svg viewBox="0 0 380 305" role="img" aria-label="Radar do desempenho atual e histórico pessoal comparável">
    {[25,50,75,100].map(value=><polygon key={value} points={areas.map((_,i)=>point(i,value).join(",")).join(" ")} fill="none" stroke="var(--line)"/>)}
    {areas.map((a,i)=>{const [x,y]=point(i,100);const labels=["Matemática","Português","Humanas","Natureza"];return <g key={a}><line x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line)"/><text x={x} y={y+(i===0?-15:i===2?24:5)} dx={i===1?12:i===3?-12:0} textAnchor={i===1?"start":i===3?"end":"middle"} className="axis-label">{labels[i]}</text></g>;})}
    {before.every(v=>v!==null)&&<polygon points={before.map((v,i)=>point(i,v!).join(",")).join(" ")} fill="var(--accent-soft)" fillOpacity=".3" stroke="var(--muted)" strokeDasharray="5 4"/>}
    {now.every(v=>v!==null)&&<polygon points={now.map((v,i)=>point(i,v!).join(",")).join(" ")} fill="var(--accent-soft)" fillOpacity=".3" stroke="var(--accent)" strokeWidth="2"/>}
    {before.map((v,i)=>v===null?null:<circle key={`history-${i}`} cx={point(i,v)[0]} cy={point(i,v)[1]} r="5" fill="white" stroke="var(--muted)"><title>{areas[i]} · histórico: {v.toFixed(1)}%</title></circle>)}
    {now.map((v,i)=>v===null?null:<circle key={i} cx={point(i,v)[0]} cy={point(i,v)[1]} r="4" fill="var(--accent)"><title>{areas[i]}: {v.toFixed(1)}%</title></circle>)}
  </svg><div className="chart-legend"><span><i/>Atual · primeiras exposições</span><span><i className="historic"/>Histórico comparável</span></div>
    <p className="muted">Áreas sem respostas avaliáveis não são desenhadas como zero.</p><details className="chart-data"><summary>Ver valores do radar</summary>{areas.map((a,i)=><p key={a}>{a}: atual {now[i]===null?"dados insuficientes":`${now[i]!.toFixed(1)}%`}; histórico {before[i]===null?"dados insuficientes":`${before[i]!.toFixed(1)}%`}</p>)}</details></figure>;
}
