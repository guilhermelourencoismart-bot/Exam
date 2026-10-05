import { formatTime,gradeAttempt,type Attempt } from "@/domain/training";
import FacsimileViewer from "./FacsimileViewer";
export default function AttemptResult({attempt}:{attempt:Attempt}){
  const result=gradeAttempt(attempt);
  return <section aria-label="Resultado da tentativa"><h2>Treino finalizado</h2><p>{attempt.title}</p>
    <div className="stats-grid result-stats"><div className="stat"><strong>{result.correct}</strong><span>acertos</span></div>
      <div className="stat"><strong>{result.wrong}</strong><span>erros</span></div><div className="stat"><strong>{result.blank}</strong><span>em branco</span></div>
      <div className="stat"><strong>{result.percentage.toFixed(1)}%</strong><span>acertos sobre todas as questões</span></div></div>
    <p><strong>Tempo ativo total: {formatTime(result.totalMs)}</strong></p>
    <p className="muted">Pausas e tempo fora do aplicativo não entram no total. Respostas em branco ficam separadas dos erros. Os erros respondidos aparecem automaticamente no caderno de revisão.</p>
    <div className="table-scroll"><table className="results-table"><thead><tr><th>Questão</th><th>Sua resposta</th><th>Gabarito</th><th>Resultado</th><th>Tempo ativo</th></tr></thead>
      <tbody>{result.rows.map(r=><tr key={r.item.id}><td>{r.item.id}</td><td>{r.answer??"Em branco"}</td><td>{r.expected}</td>
        <td>{r.outcome==="correct"?"Acerto":r.outcome==="wrong"?"Erro":"Em branco"}</td><td>{formatTime(r.timeMs)}</td></tr>)}</tbody></table></div>
    {result.rows.map(r=><details key={r.item.id} className="result-source"><summary>Conferir {r.item.id} · versão e fonte</summary>
      <p>{r.item.audit.sourceDocument} · questão {r.item.audit.sourceNumber} nessa versão</p>
      <p>Gabarito: {r.item.audit.key!.document} · número {r.item.audit.key!.number} · página {r.item.audit.key!.page}. Letra: {r.expected}.</p>
      {r.item.audit.key!.pdfUrl && <p><a href={`${r.item.audit.key!.pdfUrl}#page=${r.item.audit.key!.page}`} target="_blank" rel="noreferrer">Abrir página do gabarito conferido ↗</a></p>}
      <p className="muted">Não há resolução oficial incorporada. O aplicativo não cria justificativas para as alternativas.</p>
      <FacsimileViewer media={r.item.audit.media}/><code>Revisão: {r.item.audit.revision}</code>
    </details>)}
  </section>;
}
