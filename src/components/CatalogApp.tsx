"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { emptyFilters, filterQuestions, uniqueOptions, type Filters } from "@/domain/catalog";
import type { Catalog, Exam } from "@/domain/types";
import { mergeBackup, readAttempts, readBookmarks, setBookmark } from "@/storage/indexed-db";
import { validateBackup, type Bookmark } from "@/storage/backup";
import QuestionCard from "./QuestionCard";
import SourcesPanel from "./SourcesPanel";
import BackupControls from "./BackupControls";
import TrainingPanel from "./TrainingPanel";
import ReviewPanel from "./ReviewPanel";
import type { Attempt } from "@/domain/training";
type Tab = "questions" | "exams" | "sources" | "training" | "review";
const PAGE_SIZE = 20;
export default function CatalogApp() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<Tab>("questions");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [trainingRunning, setTrainingRunning] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [protectedIds, setProtectedIds] = useState<string[]>([]);
  const updateProtection = useCallback((attempts: Attempt[]) => {
    const ids=[...new Set(attempts.filter(a=>a.status!=="completed").flatMap(a=>a.items.map(q=>q.id)))].sort();
    setProtectedIds(prior=>prior.join("|")===ids.join("|")?prior:ids);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/catalog.json", { signal: controller.signal }).then(async r => {
      if (!r.ok) throw new Error("Falha ao carregar o catálogo.");
      const data = await r.json();
      if (data.schemaVersion !== 1 || !Array.isArray(data.questions)) throw new Error("Versão de dados incompatível.");
      setCatalog(data);
    }).catch(e => { if (e.name !== "AbortError") setLoadError(e.message); });
    void Promise.all([readBookmarks(),readAttempts()]).then(([b,a]) => {
      setBookmarks(b); updateProtection(a); setStorageReady(true);
      if(a.some(attempt=>attempt.status==="paused"))setTab("training");
    })
      .catch(() => setMessage("Armazenamento local indisponível. A consulta funciona, mas marcações e backup estão desativados."));
    return () => controller.abort();
  }, []);
  const savedIds = useMemo(() => bookmarks.map(b => b.questionId), [bookmarks]);
  const filtered = useMemo(() => catalog ? filterQuestions(catalog.questions, filters, savedIds) : [], [catalog, filters, savedIds]);
  const scoped = useMemo(() => catalog ? filterQuestions(catalog.questions,
    { ...emptyFilters, origin: filters.origin, exam: filters.exam }) : [], [catalog, filters.origin, filters.exam]);
  const disciplines = uniqueOptions(scoped.map(q => q.discipline));
  const topics = uniqueOptions(scoped.filter(q => !filters.discipline || q.discipline === filters.discipline).map(q => q.topic));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  function updateFilters(patch: Partial<Filters>) { setFilters(f => ({ ...f, ...patch })); setPage(1); }
  async function toggleBookmark(id: string) {
    setBusy(true);
    try {
      await setBookmark(id, !savedIds.includes(id)); setBookmarks(await readBookmarks());
      setMessage(savedIds.includes(id) ? "Marcação removida." : "Questão marcada para revisão. Ainda não é um registro de resposta.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  }
  async function importBackup(file: File) {
    if (!catalog) return;
    setBusy(true);
    try {
      if (file.size > 50_000_000) throw new Error("Backup maior que o limite de 50 MB desta versão.");
      const backup = validateBackup(JSON.parse(await file.text()), new Set(catalog.questions.map(q => q.id)), catalog.questions);
      const imported=await mergeBackup(backup); setBookmarks(await readBookmarks());
      updateProtection(await readAttempts()); setRefreshSignal(v=>v+1);
      setMessage(`Backup importado. Suas marcações anteriores foram preservadas. ${imported.addedAttempts} tentativas adicionadas; ${imported.keptAttempts} tentativas já existentes foram mantidas sem sobrescrita.`);
    } catch (e) { setMessage(e instanceof SyntaxError ? "O arquivo não é um JSON válido. Nada foi importado." : e instanceof Error ? e.message : "Arquivo inválido. Nada foi importado."); }
    finally { setBusy(false); }
  }
  function consultExam(exam: Exam) {
    setFilters({ ...emptyFilters, origin: exam.origin, exam: exam.id }); setPage(1); setTab("questions");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="Meu preparo, início"><span className="brand-mark">i.</span><span>meu preparo<small>INSPER · 2027.1</small></span></a>
      <div className="sidebar-caption">SEU ESPAÇO DE ESTUDO</div>
      <nav aria-label="Navegação principal">{([
        ["questions", "01", "Questões"], ["exams", "02", "Provas"], ["sources", "03", "Fontes e relatório"], ["training", "04", "Treino"], ["review", "05", "Caderno de revisão"]
      ] as const).map(([key, n, label]) => <button key={key} className={tab === key ? "active" : ""}
        aria-label={label} aria-current={tab === key ? "page" : undefined} onClick={() => setTab(key)}><span aria-hidden="true">{n}</span>{label}</button>)}</nav>
      <div className="sidebar-foot"><span className="local-dot" /> Aplicativo pessoal<br /><small>Dados locais. Sem banco remoto.<br />Etapa 2 · treino e fontes</small></div>
    </aside>
    <main id="main">
      <header className="topbar"><span>PREPARAÇÃO COM FONTES</span><span className="tag">Segunda etapa</span></header>
      <div className="content">
        <div className="intro"><span className="eyebrow">Insper 2027.1</span><h1>Seu ponto de partida.</h1><p>Conheça as provas, encontre assuntos e organize o que quer revisar.</p></div>
        {loadError ? <div role="alert" className="notice"><p>{loadError}</p><button onClick={() => window.location.reload()}>Tentar novamente</button></div>
          : !catalog ? <p role="status">Carregando os dados validados…</p> : <>
          <div className="stats-grid">
            <Stat value={catalog.stats.questions} label="questões no catálogo" />
            <Stat value={catalog.stats.official} label="itens de seleção¹" />
            <Stat value={catalog.stats.thirdParty} label="itens de terceiros" />
            <Stat value={catalog.stats.ready} label="prontas para treino" />
          </div>
          <div className="notice availability"><div className="notice-symbol">i</div><div><strong>O acervo está disponível para consulta.</strong><p>{catalog.stats.ready ? `${catalog.stats.ready} questões têm conteúdo e gabarito conferidos. Os demais registros permanecem identificados com seus bloqueios.` : "Os cadernos e gabaritos originais ainda não foram fornecidos e conferidos. As 400 questões reais continuam bloqueadas para correção automática; o treino só aceita conteúdo validado."}</p></div></div>
          <BackupControls bookmarks={bookmarks} disabled={!storageReady || busy || trainingRunning} onImport={importBackup} onMessage={setMessage} />
          {trainingRunning && <p className="muted">Pause o treino para exportar ou importar um backup consistente.</p>}
          {message && <p role="status" className="feedback">{message}</p>}
          {tab === "questions" && <section aria-label="Catálogo de questões">
            <div className="section-heading"><div><span className="eyebrow">Explore o acervo</span><h2>Questões por assunto</h2></div><span className="muted">{filtered.length} resultados</span></div>
            <div className="filters">
              <label className="search-field">Buscar no texto ou assunto<input placeholder="Ex.: sistemas, genética, interpretação…" value={filters.search} onChange={e => updateFilters({ search: e.target.value })} type="search" /></label>
              <label>Origem<select value={filters.origin} onChange={e => updateFilters({ origin: e.target.value, exam: "", discipline: "", topic: "" })}><option value="">Todas as origens</option><option value="official">Seleção · Insper/Vunesp¹</option><option value="third-party">Simulados de terceiros · ALFRED</option></select></label>
              <label>Prova<select value={filters.exam} onChange={e => updateFilters({ exam: e.target.value, discipline: "", topic: "" })}><option value="">Todas as provas</option>{catalog.exams.filter(e => !filters.origin || e.origin === filters.origin).map(e => <option key={e.id} value={e.id}>{e.title}</option>)}</select></label>
              <label>Disciplina<select value={filters.discipline} onChange={e => updateFilters({ discipline: e.target.value, topic: "" })}><option value="">Todas as disciplinas</option>{disciplines.map(d => <option key={d}>{d}</option>)}</select></label>
              <label>Assunto<select value={filters.topic} onChange={e => updateFilters({ topic: e.target.value })}><option value="">Todos os assuntos</option>{topics.map(t => <option key={t}>{t}</option>)}</select></label>
              <div className="filter-actions"><label className="checkbox"><input type="checkbox" checked={filters.savedOnly} onChange={e => updateFilters({ savedOnly: e.target.checked })} />Só marcadas para revisar</label><button onClick={() => { setFilters(emptyFilters); setPage(1); }}>Limpar filtros</button></div>
            </div>
            <p className="result-count" role="status">{filtered.length ? `Mostrando ${(currentPage - 1)*PAGE_SIZE + 1}–${Math.min(currentPage*PAGE_SIZE, filtered.length)} de ${filtered.length} questões` : "Nenhuma questão encontrada. Tente outro assunto ou limpe os filtros."}</p>
            <div className="questions-grid">{filtered.slice((currentPage-1)*PAGE_SIZE, currentPage*PAGE_SIZE).map(q => <QuestionCard key={q.id} question={q} catalog={catalog} saved={savedIds.includes(q.id)} hideAnswer={protectedIds.includes(q.id)} disabled={!storageReady || busy} onSave={() => void toggleBookmark(q.id)} />)}</div>
            <div className="pagination"><button disabled={currentPage === 1} onClick={() => setPage(currentPage-1)}>← Anterior</button><span>Página {currentPage} de {totalPages}</span><button disabled={currentPage === totalPages} onClick={() => setPage(currentPage+1)}>Próxima →</button></div>
          </section>}
          {tab === "exams" && <section aria-label="Catálogo de provas">
            <div className="section-heading"><div><span className="eyebrow">Sete conjuntos canônicos</span><h2>Conheça as provas</h2></div></div>
            {(["official", "third-party"] as const).map(origin => <div key={origin}><h3 className="section-title">{origin === "official" ? "Seleção · Insper/Vunesp¹" : "Simulados de terceiros · ALFRED"}</h3>
              <div className="exams-grid">{catalog.exams.filter(e => e.origin === origin).map(e => <article className="exam-card" key={e.id}>
                <span className="eyebrow">{e.id}</span><h3>{e.title}</h3><p>{e.count} questões · {e.answers} respostas registradas</p>
                <p className="muted">{e.date ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(e.date+"T12:00:00Z")) : "Data não comprovada"} · {e.dateStatus}</p>
                <span className={`tag ${e.readyCount ? "green" : "amber"}`}>{e.readyCount ? `${e.readyCount} questões liberadas` : "Sem correção automática"}</span>
                {catalog.questions.some(q=>q.examId===e.id&&q.reservedForEvaluation)&&<p className="notice small">Reservada para avaliação. Sua inclusão no treino exige marcar a opção correspondente.</p>}
                {catalog.documents.find(d=>d.arquivo===e.document)?.url&&<p><a href={catalog.documents.find(d=>d.arquivo===e.document)!.url!} target="_blank" rel="noreferrer">Abrir caderno original ↗</a></p>}
                <p className="muted">{e.authenticity}</p>
                <button className="primary" onClick={() => consultExam(e)}>Consultar questões →</button>
              </article>)}</div></div>)}
          </section>}
          {tab === "sources" && <SourcesPanel catalog={catalog} />}
          {tab === "training" && <TrainingPanel catalog={catalog} storageReady={storageReady} refreshSignal={refreshSignal} onRunningChange={setTrainingRunning} onAttemptsChange={updateProtection} />}
          {tab === "review" && <ReviewPanel refreshSignal={refreshSignal} />}
          <footer><p>¹ Seleção conforme a classificação documental do banco. Autenticidade externa não verificada.</p><p>Marcações ficam no IndexedDB deste navegador e deste endereço. Exporte um backup antes de limpar os dados do navegador. Tentativas e tempos também ficam neste navegador. Redação e geração por IA ficam para as próximas etapas.</p></footer>
        </>}
      </div>
    </main>
  </div>;
}
function Stat({ value, label }: { value: number; label: string }) {
  return <div className="stat"><strong>{value}</strong><span>{label}</span></div>;
}
