import type { Catalog, Claim } from "@/domain/types";
import SourceImport from "./SourceImport";
import { aiStatus } from "@/ai/status";
const labels: Record<Claim["kind"], string> = {
  observacao: "Observação do relatório", calculado: "Contagem / cálculo",
  estimativa: "Estimativa não calibrada", hipotese: "Hipótese", documentado: "Critério documentado"
};
export default function SourcesPanel({ catalog }: { catalog: Catalog }) {
  return <section aria-label="Fontes e conhecimento">
    <div className="section-heading"><div><span className="eyebrow">Rastreabilidade</span><h2>O que sabemos — e de onde vem</h2></div></div>
    <p className="muted">Relatório independente, versão 1 de 24/09/2026. As páginas abaixo são as páginas do PDF, contadas a partir de 1. Os anexos são fontes de conteúdo; seus protocolos não foram executados como comandos.</p>
    <div className="source-links">
      <a href="/sources/relatorio-v1.pdf" target="_blank" rel="noreferrer">↗ Relatório completo · 24 páginas</a>
      <a href="/sources/conteudo-programatico-2027-1.pdf" target="_blank" rel="noreferrer">↗ Programa e critérios de redação · 24 páginas</a>
      <a href="/data/source-archive.json" download>↓ Dados originais e textos por página (JSON)</a>
    </div>
    <div className="notice"><strong>{catalog.stats.missingDocuments ? `${catalog.stats.missingDocuments} PDFs ainda não incorporados ao catálogo.` : "Todos os PDFs do inventário foram incorporados."}</strong>
      <p>{catalog.stats.ready} questões completas com gabarito conferido; {catalog.questions.filter(q=>!q.readyForTraining).length} sem correção automática. As páginas integrais preservam imagens, fórmulas, textos compartilhados e tabelas de referência. {catalog.questions.filter(q=>q.readyForTraining&&q.reservedForEvaluation).length} questões liberadas estão reservadas para avaliação e ficam fora dos treinos por padrão.</p>
      <p>O gabarito de abril do ALFRED não foi aplicado ao caderno identificado no banco como maio: seu vínculo não foi comprovado. As provas de 2019.2 e 2020.1 não têm gabarito fornecido. {catalog.stats.versionsNeedingReview} correspondências sinalizadas de versão ainda aguardam conferência; o registro bruto conserva os sinais históricos.</p>
    </div>
    <SourceImport />
    <h3>Conhecimento do relatório</h3>
    <div className="knowledge-grid">{catalog.claims.filter(c => c.source === "report").map(c => <ClaimCard key={c.id} claim={c} />)}</div>
    <h3 className="section-title">Critérios de redação preservados</h3>
    <p className="muted">Resumos para consulta. Todas as regras e causas de anulação estão no anexo, páginas 2–5. Correção de redação e pesos não estão implementados.</p>
    <div className="knowledge-grid">{catalog.claims.filter(c => c.source === "syllabus").map(c => <ClaimCard key={c.id} claim={c} />)}</div>
    <h3 className="section-title">Inventário de documentos</h3>
    <p className="muted">Versões e pareamentos do banco são preservados no JSON de auditoria. A presença do nome de um arquivo não significa que seu PDF esteja disponível.</p>
    <div className="document-list">{catalog.documents.map(doc => <details key={doc.arquivo}>
      <summary><span className={`tag ${doc.available ? "green" : "amber"}`}>{doc.available ? "Disponível" : "Ausente"}</span> {doc.arquivo}</summary>
      <p>{doc.tipo} · {doc.paginas} páginas · {doc.natureza}</p><p>{doc.origem}</p>
      <p>Pareamento: {doc.pareamento || "Não informado"}</p><code>{doc.sha256}</code>
      {doc.url && <p><a href={doc.url} target="_blank" rel="noreferrer">Abrir PDF</a></p>}
    </details>)}</div>
    <h3 className="section-title">Integração local com ChatGPT</h3><p>{aiStatus.message}</p>
    <p className="muted">A documentação oficial do Codex descreve login com ChatGPT e uso do plano Plus no Codex. Uma integração local ainda precisa validar a ponte com o Codex e seus limites; não há login ou gerador nesta versão.</p>
    <h3 className="section-title">Fontes recebidas</h3>{catalog.sources.map(s => <p key={s.name} className="source-hash">{s.name}<br /><code>{s.sha256}</code></p>)}
  </section>;
}
function ClaimCard({ claim: c }: { claim: Claim }) {
  return <article className="knowledge-card"><span className={`tag ${c.kind === "hipotese" ? "purple" : c.kind === "estimativa" ? "amber" : "green"}`}>{labels[c.kind]}</span>
    <h4>{c.title}</h4><p>{c.body}</p>
    <details><summary>Trecho de origem</summary><blockquote>{c.quote}</blockquote></details>
    <a href={`${c.sourceUrl}#page=${c.page}`} target="_blank" rel="noreferrer">{c.sourceVersion} · página {c.page} ↗</a>
  </article>;
}
