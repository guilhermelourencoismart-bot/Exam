import FacsimileViewer from "./FacsimileViewer";
import type { Catalog, Question } from "@/domain/types";
export default function QuestionCard({ question: q, catalog, saved, disabled, onSave, hideAnswer }: {
  question: Question; catalog: Catalog; saved: boolean; disabled: boolean; onSave: () => void; hideAnswer?: boolean;
}) {
  return <article className="question-card">
    <div className="card-top"><span className="eyebrow">{q.id} · {q.discipline}</span>
      <button className="bookmark" aria-label={`${saved ? "Desmarcar" : "Marcar"} ${q.id} para revisar`}
        aria-pressed={saved} disabled={disabled} onClick={onSave}>{saved ? "★ Marcada" : "☆ Marcar"}</button>
    </div>
    <h3>{q.topic}</h3><p className="subtopic">{q.subtopic}</p>
    <p className="excerpt">{q.text}</p>
    <div className="tags"><span className={`tag ${q.origin === "official" ? "green" : "purple"}`}>
      {q.origin === "official" ? "Seleção · Insper/Vunesp¹" : "Terceiros · ALFRED"}</span>
      <span className={`tag ${q.readyForTraining ? "green" : "amber"}`}>{q.readyForTraining ? "Treino liberado" : q.audit?.complete && q.audit.sharedContentChecked ? "Completa · sem correção" : "Somente consulta"}</span>{q.reservedForEvaluation && <span className="tag purple">Reservada para avaliação</span>}{q.visual && !q.audit?.complete && <span className="tag">Visual não conferido</span>}
    </div>
    <details className="question-detail"><summary>Consultar extração e fonte</summary>
      {!q.readyForTraining && <div className="notice small"><strong>{q.audit?.complete && q.audit.sharedContentChecked ? "Completa sem correção automática." : "Não pronta para treino."}</strong>
        <ul>{q.blockers.map(reason => <li key={reason}>{reason}</li>)}</ul>
      </div>}
      {q.reservedForEvaluation && <p className="notice small">Reservada para avaliação na base original. Consultar seu conteúdo expõe essa reserva.</p>}
      {q.audit && <FacsimileViewer media={q.audit.media} />}
      <h4>Bloco textual extraído, sem alterações</h4>
      <p className="muted">Pode conter alternativas e trechos de outras questões. Não é uma reconstrução validada.</p>
      <div className="raw-text">{q.rawBlock}</div>
      <dl className="metadata">
        <dt>Microcompetência</dt><dd>{q.skill}</dd>
        <dt>Estímulo</dt><dd>{q.stimulus}</dd>
        <dt>Fonte original</dt><dd>{q.source.document} · página {q.source.page} · coluna {q.source.column}</dd>
        <dt>Versão</dt><dd>Registro canônico {q.id}. {q.source.version}. {q.audit ? `Versão exibida: ${q.audit.sourceDocument}, questão ${q.audit.sourceNumber}; conferida por ${q.audit.reviewedBy} em ${q.audit.reviewedAt}.` : q.source.available ? "PDF recebido; conferência visual pendente." : "PDF não fornecido."}</dd>
        <dt>Texto compartilhado</dt><dd>{q.sharedContentStatus}</dd>
        <dt>Dificuldade / tempo</dt><dd><strong>Estimativas não calibradas:</strong> {q.estimates.difficulty}/5 · {q.estimates.minutesMin}–{q.estimates.minutesMax} minutos. Não são acertos nem tempo medidos.</dd>
        <dt>Programa 2027.1</dt><dd>{q.syllabusIds.map(id => {
          const item = catalog.syllabus.find(s => s.id === id);
          return item && <a className="syllabus-link" key={id} href={`/sources/conteudo-programatico-2027-1.pdf#page=${item.pagina}`} target="_blank" rel="noreferrer">{id} · {item.conteudo} (p. {item.pagina})</a>;
        })}</dd>
      </dl>
      {hideAnswer ? <p className="muted">Gabarito oculto: esta questão faz parte de uma tentativa ainda aberta.</p> : <details><summary>Ver resposta registrada no banco</summary>
        {q.audit?.key && <p>Gabarito da versão conferida: <strong>{q.audit.key.answer}</strong>. {q.audit.key.document} · página {q.audit.key.page} · número {q.audit.key.number}. O treino usa esta versão, sem transportar a letra de outra prova.</p>}
        <p>{q.answer ? `Resposta informada: ${q.answer}.` : "Sem resposta utilizável."} {q.answerStatus}.</p>
        <p className="muted">{q.answerDocument || "Documento de gabarito não pareado."} {q.answer && !q.audit?.key && "Letra não revalidada nesta versão; confira o motivo do bloqueio."}</p>
      </details>
      }
      <details><summary>Identificadores de auditoria (SHA-256)</summary>
        <p>Documento original: <code>{q.source.sha256}</code></p>
        <p>SQLite: <code>{q.source.databaseSha256}</code></p>
      </details>
    </details>
  </article>;
}
