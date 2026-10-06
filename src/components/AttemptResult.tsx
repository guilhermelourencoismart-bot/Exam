import { resultRows } from "@/domain/analytics";
import type { ComponentProps } from "react";
import AnalyticsReport from "./AnalyticsReport";
type Props=Omit<ComponentProps<typeof AnalyticsReport>,"rows"|"allRows"> & {attempt:NonNullable<ComponentProps<typeof AnalyticsReport>["attempt"]>};
export default function AttemptResult(props:Props){
  const allRows=resultRows(props.attempts,props.catalog.questions),rows=allRows.filter(r=>r.attemptId===props.attempt.id);
  return <section aria-label="Resultado da prova"><div className="page-heading"><div><span className="eyebrow">Prova finalizada</span><h1>Seu resultado, por inteiro.</h1><p>{props.attempt.title}</p></div><span className="pill">{props.attempt.items.length} questões</span></div><AnalyticsReport {...props} rows={rows} allRows={allRows}/></section>;
}
