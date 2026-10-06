"use client";
import { useMemo,useState } from "react";
import { areas, originLabels } from "@/domain/classification";
import { comparable, comparableNew, groupResults, historyComparison, ranked, recurringErrors, simulateGain, studyPriorities, summarize, timeFindings, weightedScore, type Group, type ResultRow } from "@/domain/analytics";
import { formatTime, type Attempt } from "@/domain/training";
import type { Catalog } from "@/domain/types";
import type { ErrorNote, ErrorReason, Preferences } from "@/domain/preferences";
import { LineChart, RadarChart, type PlotPoint } from "./Charts";
import QuestionReview from "./QuestionReview";
import ErrorNotebook from "./ErrorNotebook";
import PersonalSettings from "./PersonalSettings";
export const percentage=(n:number|null)=>n===null?"Dados insuficientes":`${n.toFixed(1)}%`;
export const duration=(n:number|null)=>n===null?"Dados insuficientes":formatTime(n);
const kindLabels={full:"Simulados completos",thematic:"Listas temáticas",review:"Listas de revisão"};
const day=(s:string)=>new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"2-digit",timeZone:"America/Sao_Paulo"}).format(new Date(s));
type Props={rows:ResultRow[];allRows:ResultRow[];attempts:Attempt[];catalog:Catalog;attempt?:Attempt;preferences:Preferences;notes:ErrorNote[];
  onPreferences:(p:Preferences)=>Promise<void>;onReason:(row:ResultRow,reason:ErrorReason|null)=>Promise<void>;onReview:(rows:ResultRow[])=>Promise<void>};
export default function AnalyticsReport(p:Props){
  const {rows,allRows,attempts,catalog,preferences}=p;
  const [selected,setSelected]=useState(new Set<string>()),[reviewLimit,setReviewLimit]=useState(12),[rankDimension,setRankDimension]=useState<"area"|"discipline"|"topic">("topic");
  const s=useMemo(()=>summarize(rows),[rows]),byArea=useMemo(()=>groupResults(rows,"area"),[rows]),byDiscipline=useMemo(()=>groupResults(rows,"discipline"),[rows]),byTopic=useMemo(()=>groupResults(rows,"topic"),[rows]);
  const findings=useMemo(()=>timeFindings(rows),[rows]),priorities=useMemo(()=>studyPriorities(rows,catalog.questions),[rows,catalog]);
  const reference=p.attempt??[...attempts].filter(a=>a.status==="completed"&&rows.some(r=>r.attemptId===a.id)).sort((a,b)=>b.finishedAt!.localeCompare(a.finishedAt!))[0];
  const comparison=reference?historyComparison(reference,attempts,allRows,catalog.questions):null;
  const radarCurrent=reference?groupResults(allRows.filter(r=>r.attemptId===reference.id&&r.first),"area"):[];
  const score=weightedScore(rows,preferences),simulation=simulateGain(rows,selected),recurrent=recurringErrors(rows);
  const rankGroups=rankDimension==="area"?byArea:rankDimension==="discipline"?byDiscipline:byTopic;
  const progress=preferences.goalPercentage===null||s.percentage===null?null:preferences.goalPercentage-s.percentage;
  return <div className="analytics-report">
    <section className="result-overview" aria-label="Resumo de resultados"><div className="score-card"><span className="eyebrow">{p.attempt?"Seu resultado":"Desempenho consolidado"}</span>
      <strong data-testid="summary-percentage">{percentage(s.percentage)}</strong><span data-testid="summary-correct">{s.correct} / {s.total} acertos</span>
      <p>{s.total?"Acertos ÷ questões avaliáveis, incluindo as deixadas em branco.":"Finalize uma prova para começar seu histórico."}</p></div>
      <div className="summary-grid"><Metric label="Provas finalizadas" value={s.proofs}/><Metric label="Questões respondidas" value={s.answered}/>
        <Metric label="Erros respondidos" value={s.wrong} testId="summary-wrong"/><Metric label="Em branco" value={s.blank} testId="summary-blank"/>
        <Metric label="Tempo ativo" value={duration(s.timeMs)} testId="summary-time"/><Metric label="Média por questão" value={duration(s.averageMs)} testId="summary-average"/></div>
    </section>
    <p className="sample-note">Tempo conhecido em {s.timeCount} de {s.total} questões. Média = soma dos tempos conhecidos ÷ {s.timeCount} questões com tempo registrado. Pausas excluídas.</p>
    <div className="exposure-strip"><span><strong>{s.first}</strong> primeiras exposições finalizadas</span><span><strong>{s.repeated}</strong> ocorrências repetidas</span><span><strong>{s.unique}</strong> questões distintas</span></div>
    <section className="report-section"><div className="section-heading"><h2>As quatro áreas</h2><span className="muted">Amostra de cada área</span></div><div className="area-grid">
      {areas.map(area=>{const a=byArea.find(g=>g.key===area)?.stats??summarize([]),goal=preferences.areaGoals[area];return <article className="area-card" key={area}><span>{area}</span><strong>{a.percentage===null?"—":percentage(a.percentage)}</strong>
        {a.percentage!==null?<div className="progress-track"><i style={{width:`${a.percentage}%`}}/></div>:<small>Dados insuficientes</small>}<p>{a.total?`${a.correct} / ${a.total} acertos`:"Sem questões neste recorte"}</p><small>{a.timeMs===null?"Tempo não registrado":`${duration(a.timeMs)} ativo · ${a.timeCount} tempos registrados`}</small>
        {goal!==undefined&&<small>Meta {goal}% · {a.percentage===null?"distância indisponível":a.percentage>=goal?"atingida":`${(goal-a.percentage).toFixed(1)} pontos percentuais restantes`}</small>}</article>;})}
    </div>{byArea.some(g=>g.key==="Não classificada")&&<p className="muted">{byArea.find(g=>g.key==="Não classificada")!.stats.total} questões sem área reconhecida. Elas entram no total, sem redistribuição automática.</p>}</section>
    <section className="report-section"><div className="section-heading"><h2>Histórico e evolução</h2><span className="muted">Composições semelhantes</span></div>
      <div className="history-grid"><RadarChart current={radarCurrent} history={comparison?.areas??[]}/><div className="history-summary"><span className="eyebrow">Primeiras exposições · provas comparáveis</span>
        <h3>{reference?.title??"Seu histórico começa aqui"}</h3><Metric label="Melhor resultado comparável" value={percentage(comparison?.best??null)}/>
        <Metric label="Últimas cinco comparáveis" value={percentage(comparison?.lastFive.percentage??null)}/><p className="muted">{comparison?.lastFiveCount??0} provas com questões novas na amostra · {comparison?.lastFive.total??0} questões. A média é ponderada pela quantidade de questões, incluindo esta prova quando houver primeiras exposições.</p>
        <p className="muted">Radar: última prova selecionada versus anteriores de mesma origem e tipo, com diferença de até 10 pontos percentuais nas proporções por área e disciplina; listas também exigem assuntos semelhantes. Essa regra é conferida novamente nas primeiras exposições, após excluir repetições.</p>
      </div></div>
      {(["full","thematic","review"] as const).map(kind=><Chronology key={kind} kind={kind} rows={allRows} attempts={attempts} catalog={catalog} individual={p.attempt}/>) }
    </section>
    <section className="report-section"><div className="section-heading"><h2>Por disciplina</h2></div><Breakdown groups={byDiscipline}/></section>
    <section className="report-section"><div className="section-heading"><h2>Por assunto</h2><span className="muted">Classificação preservada</span></div><Breakdown groups={byTopic} topic/></section>
    {!p.attempt&&<section className="report-section"><div className="section-heading"><h2>Mais erros e mais acertos</h2><label>Agrupar rankings por<select value={rankDimension} onChange={e=>setRankDimension(e.target.value as typeof rankDimension)}><option value="area">Matéria / área</option><option value="discipline">Disciplina</option><option value="topic">Assunto</option></select></label></div>
      <div className="ranking-grid">{(["wrong","correct"] as const).flatMap(metric=>(["count","rate"] as const).map(by=><Ranking key={`${metric}-${by}`} groups={rankGroups} metric={metric} by={by}/>))}</div>
    </section>}
    <section className="report-section"><div className="section-heading"><h2>Como você usou o tempo</h2></div><div className="report-columns">
      <div className="panel"><h3>Distribuição por área</h3>{byArea.length?byArea.map(g=><div className="time-distribution" key={g.key}><span>{g.label}</span><strong>{duration(g.stats.timeMs)}</strong><div className="progress-track"><i style={{width:`${s.timeMs&&g.stats.timeMs!==null?g.stats.timeMs/s.timeMs*100:0}%`}}/></div><small>{g.stats.timeCount} registros · média {duration(g.stats.averageMs)}</small></div>):<p>Dados insuficientes</p>}</div>
      <div className="panel"><h3>Visitas e mudanças de resposta</h3><Metric label={`Visitas registradas · ${s.visitsCount}/${s.total} questões`} value={s.visits??"Dados insuficientes"}/><Metric label={`Mudanças registradas · ${s.changesCount}/${s.total} questões`} value={s.changes??"Dados insuficientes"}/>
        <p className="muted">Visita: primeira exibição ou entrada em outra questão. Retomar a pausa na mesma questão não adiciona visita. A primeira escolha não é mudança; trocar ou apagar uma resposta escolhida é. Registros antigos permanecem indisponíveis.</p>
        {rows.filter(r=>(r.changes??0)>0).slice(0,5).map(r=><p className="mini-row" key={r.key}>{r.item.id}<strong>{r.changes} mudanças · {r.visits??"—"} visitas</strong></p>)}</div>
    </div><div className="report-columns"><div className="panel"><h3>Questões mais demoradas</h3><TimeList rows={findings.slow}/></div><div className="panel"><h3>Erros muito rápidos</h3>
      <p className="muted">Sinal para conferir: erro com tempo abaixo de 25% da mediana deste recorte. Exige pelo menos 5 tempos registrados; não determina o motivo do erro.</p>
      {findings.fastWrong===null?<p>Dados insuficientes</p>:findings.fastWrong.length?<><p className="muted">Limiar: {duration(findings.threshold)} · {s.timeCount} registros</p><TimeList rows={findings.fastWrong.slice(0,8)}/></>:<p>Nenhum erro atende ao limiar neste recorte.</p>}</div></div>
      <details className="panel"><summary>Erros recorrentes</summary>{recurrent.length?recurrent.map(r=><p key={r.id}>{r.id} · {r.rows[0].item.topic} · {r.count} erros em {new Set(r.rows.map(x=>x.attemptId)).size} provas</p>):<p>Nenhum erro repetido neste recorte. A análise de primeiras exposições exclui repetições.</p>}</details>
    </section>
    <section className="report-section"><div className="section-heading"><div><span className="eyebrow">Próximo passo</span><h2>Prioridades de estudo</h2></div></div>
      <p className="muted">Índice heurístico, de 0 a 100: 30% frequência no acervo oficial da disciplina, 35% taxa de erros nas últimas 10 provas deste recorte, 20% recorrência do mesmo erro e 15% tempo relativo. Componentes sem dados são omitidos e os pesos restantes são normalizados. O índice não prevê sua nota.</p>
      {!priorities.length?<p className="empty-state compact">Dados insuficientes para priorizar erros. Resolva uma prova ou amplie os filtros.</p>:<div className="priorities">{priorities.slice(0,10).map((g,i)=><article className="priority-card" key={g.key}><span className="priority-position">{i+1}</span><div><h3>{g.label}</h3><span className="muted">{g.discipline} · prioridade {g.score.toFixed(0)}/100</span>
        <p>{g.stats.wrong} erros e {g.stats.blank} brancos em {g.stats.total} questões de {g.proofs} provas; {g.recurring} questões com erros recorrentes.</p>
        <p className="muted">Frequência observada: {g.officialCount}/{g.officialTotal} questões oficiais da disciplina ({g.frequency===null?"dados insuficientes":`${(g.frequency*100).toFixed(1)}%`}). Tempo médio: {duration(g.stats.averageMs)} sobre {g.stats.timeCount} registros.</p></div></article>)}</div>}
    </section>
    <section className="report-section"><div className="section-heading"><h2>Metas e nota ponderada</h2></div><div className="report-columns">
      <div className="panel"><h3>Meta pessoal</h3><strong className="large-value">{preferences.goalPercentage===null?"Não definida":`${preferences.goalPercentage}%`}</strong><p>{progress===null?"Defina uma meta para acompanhar a distância.":progress<=0?"Meta atingida neste recorte.":`Faltam ${progress.toFixed(1)} pontos percentuais neste recorte.`}</p></div>
      <div className="panel"><h3>{preferences.course?`Nota · ${preferences.course.name}`:"Nota ponderada por curso"}</h3><strong className="large-value">{score===null?"Dados insuficientes":`${score.toFixed(1)} / 100`}</strong><p className="muted">{preferences.course?"Pesos configurados por você. Soma de (percentual por área × peso) ÷ soma dos pesos. Não é nota oficial nem nota de corte.":"Configure os pesos do curso. Nenhum peso ou nota de corte foi presumido."}</p></div>
    </div><details className="panel"><summary>Editar metas e pesos</summary><PersonalSettings key={JSON.stringify(preferences)} preferences={preferences} onSave={p.onPreferences}/></details></section>
    <ErrorNotebook rows={[...rows].reverse()} notes={p.notes} onReason={p.onReason} selected={selected} onSelection={setSelected} onReview={p.onReview}/>
    <section className="scenario panel"><span className="tag">Simulação</span><h3>Se você acertasse os erros selecionados</h3><div className="scenario-values"><strong>{percentage(simulation.before)}</strong><span>→</span><strong>{percentage(simulation.after)}</strong></div>
      <p>{simulation.gain} acertos adicionais em {simulation.total} questões avaliáveis. Selecione erros no caderno acima para explorar o cenário. A simulação mantém composição, brancos e tempo; não altera seu resultado nem estima um ganho garantido.</p></section>
    {p.attempt&&<section className="report-section"><div className="section-heading"><h2>Revisão questão por questão</h2></div><div className="table-scroll"><table className="results-table"><thead><tr><th>Questão</th><th>Sua resposta</th><th>Gabarito</th><th>Resultado</th><th>Tempo</th><th>Visitas</th><th>Mudanças</th></tr></thead><tbody>{rows.map(r=><tr key={r.key}><td>{r.item.id}</td><td>{r.answer??"Em branco"}</td><td>{r.expected}</td><td>{r.outcome==="correct"?"Acerto":r.outcome==="wrong"?"Erro":"Em branco"}</td><td>{duration(r.timeMs)}</td><td>{r.visits??"Não registrado"}</td><td>{r.changes??"Não registrado"}</td></tr>)}</tbody></table></div>
      <div className="question-review-list">{rows.slice(0,reviewLimit).map(r=><QuestionReview key={r.key} row={r}/>)}</div>{rows.length>reviewLimit&&<button onClick={()=>setReviewLimit(n=>n+20)}>Mostrar mais questões</button>}</section>}
    <section className="panel essay-panel"><span className="eyebrow">Redação</span><h3>{p.attempt?.essay?"Correção recebida":!p.attempt&&attempts.some(a=>rows.some(r=>r.attemptId===a.id)&&a.essay)?"Correções recebidas":"Não avaliada"}</h3>
      {p.attempt?.essay?<><p>{p.attempt.essay.source}</p>{p.attempt.essay.criteria.map((c,i)=><p key={i}><strong>{c.name}: {c.score}/{c.max}</strong><br/>{c.comment}</p>)}<p>{p.attempt.essay.comment}</p></>:<p className="muted">Não há correção de redação incorporada{p.attempt?" nesta prova":" neste painel"}.</p>}
      {!p.attempt&&attempts.filter(a=>rows.some(r=>r.attemptId===a.id)&&a.essay).map(a=><details key={a.id}><summary>{a.title} · correção recebida</summary><p>{a.essay!.source}</p>{a.essay!.criteria.map((c,i)=><p key={i}>{c.name}: {c.score}/{c.max} · {c.comment}</p>)}<p>{a.essay!.comment}</p></details>)}
    </section>
  </div>;
}
export function Metric({label,value,testId}:{label:string;value:string|number;testId?:string}){return <div className="metric"><strong data-testid={testId}>{value}</strong><span>{label}</span></div>;}
function Breakdown({groups,topic=false}:{groups:Group[];topic?:boolean}){return groups.length?<div className="table-scroll"><table className="breakdown-table"><caption>Percentual = acertos ÷ questões avaliáveis. Tempo médio usa apenas as questões com tempo conhecido.</caption><thead><tr><th>{topic?"Assunto / disciplina":"Disciplina"}</th><th>Questões</th><th>Acertos</th><th>Erros</th><th>Brancos</th><th>Acerto (%)</th><th>Tempo médio</th><th>Tempos registrados</th></tr></thead><tbody>{groups.map(g=><tr key={g.key}><td><strong>{g.label}</strong>{topic&&<small>{g.discipline}</small>}</td><td>{g.stats.total}</td><td>{g.stats.correct}</td><td>{g.stats.wrong}</td><td>{g.stats.blank}</td><td>{percentage(g.stats.percentage)}</td><td>{duration(g.stats.averageMs)}</td><td>{g.stats.timeCount}/{g.stats.total}</td></tr>)}</tbody></table></div>:<p className="empty-state compact">Dados insuficientes</p>;}
function TimeList({rows}:{rows:ResultRow[]}){return rows.length?<ol className="time-list">{rows.map(r=><li key={r.key}><span><strong>{r.item.id}</strong><small>{r.item.discipline} · {r.item.topic}</small></span><strong>{duration(r.timeMs)}</strong></li>)}</ol>:<p>Dados insuficientes</p>;}
function Ranking({groups,metric,by}:{groups:Group[];metric:"wrong"|"correct";by:"count"|"rate"}){return <div className="panel ranking"><h3>{metric==="wrong"?"Mais erros":"Mais acertos"} · {by==="count"?"quantidade":"taxa percentual"}</h3>{!groups.length?<p>Dados insuficientes</p>:<ol>{ranked(groups,metric,by).slice(0,5).map(g=><li key={g.key}><div><strong>{g.label}</strong><small>{g.discipline} · {g.stats.total} questões</small></div><span>{by==="count"?g.stats[metric]:`${(g.stats[metric]/g.stats.total*100).toFixed(1)}%`}<small>{g.stats[metric]}/{g.stats.total}</small></span></li>)}</ol>}</div>;}
function Chronology({kind,rows,attempts,catalog,individual}:{kind:ResultRow["kind"];rows:ResultRow[];attempts:Attempt[];catalog:Catalog;individual?:Attempt}){
  const candidates=[...attempts].filter(a=>a.status==="completed"&&rows.some(r=>r.attemptId===a.id&&r.kind===kind)).sort((a,b)=>a.finishedAt!.localeCompare(b.finishedAt!));
  const [referenceId,setReferenceId]=useState("");
  if(!candidates.length || (individual && !candidates.some(a=>a.id===individual.id)))return null;
  const reference=candidates.find(a=>a.id===(individual?.id??referenceId))??candidates[candidates.length-1];
  const comparableAttempts=candidates.filter(a=>comparable(reference,a,catalog.questions)&&(a.id===reference.id||comparableNew(reference,a,rows,catalog.questions))&&(!individual||a.finishedAt!<=individual.finishedAt!));
  const points=comparableAttempts.map(a=>{const subset=rows.filter(r=>r.attemptId===a.id&&r.first);return {a,stats:summarize(subset)};});
  const percentPoints:PlotPoint[]=points.map(({a,stats})=>({label:day(a.finishedAt!),value:stats.percentage,detail:`${a.title} · ${stats.correct}/${stats.total} questões novas`}));
  const timePoints:PlotPoint[]=points.map(({a,stats})=>({label:day(a.finishedAt!),value:stats.averageMs===null?null:stats.averageMs/1000,detail:`${stats.timeCount} questões com tempo; pausas excluídas`}));
  const evolutionRows=rows.filter(r=>r.first&&comparableAttempts.some(a=>a.id===r.attemptId));
  const evolution=(dimension:"area"|"topic")=>groupResults(evolutionRows,dimension).map(g=>{
    const ids=[...new Set(g.rows.map(r=>r.attemptId))];const first=summarize(g.rows.filter(r=>r.attemptId===ids[0])),last=summarize(g.rows.filter(r=>r.attemptId===ids[ids.length-1]));
    return {...g,first,last,delta:ids.length>1&&first.percentage!==null&&last.percentage!==null?last.percentage-first.percentage:null};
  });
  return <div className="chronology-group"><div className="section-heading"><h3>{kindLabels[kind]}</h3>{!individual&&<label>Composição de referência<select aria-label={`Referência ${kindLabels[kind]}`} value={reference.id} onChange={e=>setReferenceId(e.target.value)}>{candidates.map(a=><option value={a.id} key={a.id}>{a.title} · {day(a.finishedAt!)}</option>)}</select></label>}</div>
    <p className="muted">{comparableAttempts.length} provas de composição semelhante a “{reference.title}”. Gráficos usam apenas primeiras exposições; uma prova sem questões novas aparece sem valor. Datas em ordem cronológica.</p>
    <div className="report-columns"><LineChart title="Percentual de acerto por prova" points={percentPoints}/><LineChart title="Tempo médio por questão" points={timePoints} suffix="s"/></div>
    <details className="panel"><summary>Evolução por matéria e assunto neste grupo comparável</summary>{(["area","topic"] as const).map(dimension=><div className="table-scroll" key={dimension}><table><thead><tr><th>{dimension==="area"?"Matéria":"Assunto"}</th><th>Primeira prova</th><th>Última prova</th><th>Variação</th></tr></thead><tbody>{evolution(dimension).map(g=><tr key={g.key}><td>{g.label}<small>{g.discipline}</small></td><td>{percentage(g.first.percentage)} · n={g.first.total}</td><td>{percentage(g.last.percentage)} · n={g.last.total}</td><td>{g.delta===null?"Dados insuficientes":`${g.delta>=0?"+":""}${g.delta.toFixed(1)} p.p.`}</td></tr>)}</tbody></table></div>)}</details>
  </div>;
}
