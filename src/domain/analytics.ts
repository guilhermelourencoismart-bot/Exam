import { areas, areaOf, topicKey, type Area } from "./classification";
import { gradeAttempt, type Attempt, type TrainingItem } from "./training";
import type { Question } from "./types";
import type { Preferences } from "./preferences";
export type ResultRow = {
  key: string; attemptId: string; title: string; date: string; item: TrainingItem;
  area: string; origin: string; kind: "full" | "thematic" | "review";
  answer: string | null; expected: string; outcome: "correct" | "wrong" | "blank";
  timeMs: number | null; visits: number | null; changes: number | null; first: boolean; firstAnswer: boolean;
};
export type AnalysisFilters = {from: string; to: string; area: string; discipline: string; topic: string; origin: string; firstOnly: boolean};
export const defaultAnalysisFilters: AnalysisFilters = {from:"",to:"",area:"",discipline:"",topic:"",origin:"",firstOnly:false};
export function kindOf(a: Attempt): ResultRow["kind"] {
  if (a.kind) return a.kind;
  return a.items.length === 60 && areas.every(area => a.items.filter(q => areaOf(q.discipline) === area).length === 15) ? "full" : "thematic";
}
export function resultRows(attempts: readonly Attempt[], questions: readonly Question[] = []): ResultRow[] {
  const qMap = new Map(questions.map(q => [q.id,q]));
  const seen = new Set<string>();
  const rows:ResultRow[]=[...attempts].filter(a => a.status === "completed" && a.finishedAt).sort((a,b) => a.finishedAt!.localeCompare(b.finishedAt!) || a.id.localeCompare(b.id)).flatMap(a =>
    gradeAttempt(a).rows.map(r => {
      const first = !seen.has(r.item.id); seen.add(r.item.id);
      const origin = r.item.origin ?? qMap.get(r.item.id)?.origin ?? (r.item.examId.startsWith("P") ? "official" : r.item.examId.startsWith("S") ? "third-party" : "unknown");
      return {key:`${a.id}::${r.item.id}`,attemptId:a.id,title:a.title,date:a.finishedAt!,item:r.item,area:areaOf(r.item.discipline),origin,kind:kindOf(a),
        answer:r.answer ?? null,expected:r.expected,outcome:r.outcome,
        timeMs:Number.isFinite(r.timeMs) && r.timeMs >= 0 ? r.timeMs : null,
        visits:a.telemetry && Number.isInteger(a.telemetry.visits[r.item.id]) ? a.telemetry.visits[r.item.id] : null,
        changes:a.telemetry && Number.isInteger(a.telemetry.answerChanges[r.item.id]) ? a.telemetry.answerChanges[r.item.id] : null,first,firstAnswer:false};
    })
  );
  const firstAnswered=new Map<string,string>(),firstSeen=new Map<string,string>();
  for(const r of rows){if(!firstSeen.has(r.item.id))firstSeen.set(r.item.id,r.key);if(r.answer!==null&&!firstAnswered.has(r.item.id))firstAnswered.set(r.item.id,r.key);}
  return rows.map(r=>({...r,firstAnswer:r.key===(firstAnswered.get(r.item.id)??firstSeen.get(r.item.id))}));
}
function localDay(date: string): string {
  return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(date));
}
export function filterResults(rows: readonly ResultRow[], f: AnalysisFilters): ResultRow[] {
  return rows.filter(r => (!f.from || localDay(r.date) >= f.from) && (!f.to || localDay(r.date) <= f.to) &&
    (!f.area || r.area === f.area) && (!f.discipline || r.item.discipline === f.discipline) && (!f.topic || topicKey(r.item.discipline,r.item.topic) === f.topic) &&
    (!f.origin || r.origin === f.origin) && (!f.firstOnly || r.firstAnswer));
}
export function summarize(rows: readonly ResultRow[]) {
  const correct = rows.filter(r => r.outcome === "correct").length, wrong = rows.filter(r => r.outcome === "wrong").length;
  const timed = rows.filter(r => r.timeMs !== null), visited = rows.filter(r => r.visits !== null), changed = rows.filter(r => r.changes !== null);
  const sumMs = timed.reduce((n,r) => n+r.timeMs!,0);
  return {total:rows.length,correct,wrong,blank:rows.length-correct-wrong,answered:correct+wrong,
    proofs:new Set(rows.map(r => r.attemptId)).size,percentage:rows.length ? correct/rows.length*100 : null,
    timeMs:timed.length ? sumMs : null,timeCount:timed.length,averageMs:timed.length ? sumMs/timed.length : null,
    visits:visited.length ? visited.reduce((n,r) => n+r.visits!,0) : null,visitsCount:visited.length,
    changes:changed.length ? changed.reduce((n,r) => n+r.changes!,0) : null,changesCount:changed.length,
    first:rows.filter(r => r.first).length,repeated:rows.filter(r => !r.first).length,
    unique:new Set(rows.map(r => r.item.id)).size};
}
export type Summary = ReturnType<typeof summarize>;
export type Group = {key:string;label:string;discipline?:string;rows:ResultRow[];stats:Summary};
export function groupResults(rows: readonly ResultRow[], dimension: "area" | "discipline" | "topic"): Group[] {
  const map = new Map<string,ResultRow[]>();
  for (const r of rows) {
    const key = dimension === "topic" ? topicKey(r.item.discipline,r.item.topic) : dimension === "area" ? r.area : r.item.discipline;
    map.set(key,[...(map.get(key) ?? []),r]);
  }
  return [...map].map(([key,rs]) => ({key,label:dimension === "topic" ? rs[0].item.topic : key,discipline:dimension === "topic" ? rs[0].item.discipline : undefined,rows:rs,stats:summarize(rs)})).sort((a,b) => a.label.localeCompare(b.label,"pt-BR"));
}
export function ranked(groups: readonly Group[], metric: "wrong" | "correct", by: "count" | "rate"): Group[] {
  return [...groups].sort((a,b) => {
    const av = by === "count" ? a.stats[metric] : a.stats[metric]/a.stats.total;
    const bv = by === "count" ? b.stats[metric] : b.stats[metric]/b.stats.total;
    return bv-av || b.stats.total-a.stats.total || a.label.localeCompare(b.label,"pt-BR");
  });
}
export function comparable(a: Attempt, b: Attempt, questions: readonly Question[] = []): boolean {
  if (kindOf(a) !== kindOf(b)) return false;
  const origin = (x:Attempt) => [...new Set(x.items.map(i => i.origin ?? questions.find(q => q.id === i.id)?.origin ?? "unknown"))].sort().join("|");
  if (origin(a) !== origin(b)) return false;
  const vector = (x:Attempt) => {
    const map = new Map<string,number>();
    for (const q of x.items) for (const key of [`area:${areaOf(q.discipline)}`,`discipline:${q.discipline}`,...(kindOf(x) === "full" ? [] : [`topic:${topicKey(q.discipline,q.topic)}`])]) map.set(key,(map.get(key)??0)+1/x.items.length);
    return map;
  };
  const av=vector(a),bv=vector(b);
  return [...new Set([...av.keys(),...bv.keys()])].every(k => Math.abs((av.get(k)??0)-(bv.get(k)??0)) <= .100001);
}
export function comparableNew(a:Attempt,b:Attempt,rows:readonly ResultRow[],questions:readonly Question[]=[]):boolean{
  const aItems=rows.filter(r=>r.attemptId===a.id&&r.first).map(r=>r.item),bItems=rows.filter(r=>r.attemptId===b.id&&r.first).map(r=>r.item);
  return !!aItems.length&&!!bItems.length&&comparable({...a,kind:kindOf(a),items:aItems},{...b,kind:kindOf(b),items:bItems},questions);
}
export function historyComparison(attempt: Attempt, attempts: readonly Attempt[], allRows: readonly ResultRow[], questions: readonly Question[] = []) {
  const previous = [...attempts].filter(a => a.status === "completed" && a.id !== attempt.id && a.finishedAt && a.finishedAt < attempt.finishedAt! && comparable(attempt,a,questions) && comparableNew(attempt,a,allRows,questions)).sort((a,b) => a.finishedAt!.localeCompare(b.finishedAt!));
  const ids = new Set(previous.map(a => a.id));
  // Evolution uses only first exposures. Repeated questions are shown separately in the report.
  const rows = allRows.filter(r => ids.has(r.attemptId) && r.first);
  const current = allRows.filter(r => r.attemptId === attempt.id && r.first);
  const points = previous.map(a => ({id:a.id,title:a.title,date:a.finishedAt!,stats:summarize(rows.filter(r => r.attemptId === a.id))})).filter(p => p.stats.total > 0);
  const currentStats=summarize(current),includingCurrent=currentStats.total ? [...points,{id:attempt.id,title:attempt.title,date:attempt.finishedAt!,stats:currentStats}] : points;
  const lastFive = includingCurrent.slice(-5), selected = new Set(lastFive.map(p => p.id));
  return {previous:points,history:summarize(rows),current:summarize(current),areas:groupResults(rows,"area"),
    best:includingCurrent.length ? Math.max(...includingCurrent.map(p => p.stats.percentage!)) : null,
    lastFive:summarize([...rows,...current].filter(r => selected.has(r.attemptId))),lastFiveCount:lastFive.length};
}
export function timeFindings(rows: readonly ResultRow[]) {
  const timed = rows.filter(r => r.timeMs !== null).sort((a,b) => a.timeMs!-b.timeMs!);
  const median = timed.length ? (timed[Math.floor((timed.length-1)/2)].timeMs!+timed[Math.floor(timed.length/2)].timeMs!)/2 : null;
  return {slow:[...timed].reverse().slice(0,8),median,
    fastWrong:median === null || timed.length < 5 ? null : timed.filter(r => r.outcome === "wrong" && r.timeMs! < median*.25),
    threshold:median === null ? null : median*.25};
}
export function recurringErrors(rows: readonly ResultRow[]) {
  const map=new Map<string,ResultRow[]>();
  for(const r of rows.filter(r => r.outcome === "wrong"))map.set(r.item.id,[...(map.get(r.item.id)??[]),r]);
  return [...map].filter(([,rs]) => rs.length > 1).map(([id,rs]) => ({id,rows:rs,count:rs.length})).sort((a,b) => b.count-a.count);
}
export function studyPriorities(rows: readonly ResultRow[], questions: readonly Question[]) {
  const lastIds=[...new Set([...rows].sort((a,b) => b.date.localeCompare(a.date)).map(r => r.attemptId))].slice(0,10);
  const recent=rows.filter(r => lastIds.includes(r.attemptId)),overall=summarize(recent);
  const official=questions.filter(q => q.origin === "official");
  return groupResults(recent,"topic").filter(g => g.stats.wrong || g.stats.blank).map(g => {
    const officialTotal=official.filter(q => q.discipline === g.discipline).length;
    const officialCount=official.filter(q => q.discipline === g.discipline && q.topic === g.label).length;
    const frequency=officialTotal ? officialCount/officialTotal : null;
    const repeated=recurringErrors(g.rows).length, wrongUnique=new Set(g.rows.filter(r => r.outcome === "wrong").map(r => r.item.id)).size;
    const recurrence=wrongUnique ? repeated/wrongUnique : 0;
    const burden=g.stats.averageMs !== null && overall.averageMs !== null && overall.averageMs > 0 ? Math.min(2,g.stats.averageMs/overall.averageMs)/2 : null;
    const components:[number,number|null][]=[[.3,frequency],[.35,g.stats.wrong/g.stats.total],[.2,recurrence],[.15,burden]];
    const weight=components.reduce((s,[w,v]) => s+(v === null ? 0 : w),0);
    const score=100*components.reduce((s,[w,v]) => s+w*(v??0),0)/weight;
    return {...g,score,officialTotal,officialCount,frequency,recurring:repeated,burden,proofs:g.stats.proofs};
  }).sort((a,b) => b.score-a.score);
}
export function weightedScore(rows: readonly ResultRow[], preferences: Preferences): number | null {
  if (!preferences.course) return null;
  let score=0,weight=0;
  for(const area of areas){const w=preferences.course.weights[area];if(w<=0)continue;
    const s=summarize(rows.filter(r => r.area === area));if(s.percentage === null)return null;
    score+=s.percentage*w;weight+=w;
  }
  return weight ? score/weight : null;
}
export function simulateGain(rows: readonly ResultRow[], selected: ReadonlySet<string>) {
  const before=summarize(rows),gain=rows.filter(r => r.outcome === "wrong" && selected.has(r.key)).length;
  return {before:before.percentage,after:before.total ? (before.correct+gain)/before.total*100 : null,gain,total:before.total};
}
