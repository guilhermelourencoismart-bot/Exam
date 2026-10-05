export type Origin = "official" | "third-party";
export type Letter = "A" | "B" | "C" | "D" | "E";
export type Facsimile = {
  imageUrl: string; pdfUrl: string; page: number; document: string; sha256: string;
  role: string; crop: [number, number, number, number];
};
export type ContentAudit = {
  revision: string; complete: boolean; versionChecked: boolean; sharedContentChecked: boolean;
  sourceDocument: string; sourceSha256: string; sourceNumber: number;
  reviewedAt: string; reviewedBy: string; note: string; media: Facsimile[];
  key: { document: string; sha256: string; page: number; number: number; pdfUrl?: string;
    answer: Letter; appliesToSha256: string; alternativesChecked: boolean } | null;
};
export type Question = {
  id: string; examId: string; number: number; origin: Origin;
  discipline: string; macrotheme: string; topic: string; subtopic: string; skill: string;
  text: string; rawBlock: string; answer: string | null; answerStatus: string;
  answerDocument: string | null; visual: boolean; graph: boolean; table: boolean;
  stimulus: string; textStatus: string; readyForTraining: boolean;
  blockers: string[]; sharedContentStatus: string; syllabusIds: string[];
  source: { document: string; page: number; column: number; sha256: string;
    databaseSha256: string; version: string; available: boolean };
  estimates: { difficulty: number; minutesMin: number; minutesMax: number; status: string };
  partition?: string; reservedForEvaluation?: boolean; audit?: ContentAudit;
};
export type Exam = {
  id: string; title: string; origin: Origin; count: number; answers: number; date: string | null;
  dateStatus: string; document: string; readyCount: number; authenticity: string;
};
export type Claim = {
  id: string; kind: "observacao" | "calculado" | "estimativa" | "hipotese" | "documentado";
  source: "report" | "syllabus"; page: number; title: string; body: string;
  quote: string; sourceUrl: string; sourceVersion: string;
};
export type Document = {
  arquivo: string; tipo: string; paginas: number; sha256: string; available: boolean;
  url: string | null; natureza: string; origem: string; pareamento: string | null;
};
export type Catalog = {
  schemaVersion: 1; databaseSha256: string;
  questions: Question[]; exams: Exam[]; claims: Claim[]; documents: Document[];
  stats: { questions: number; official: number; thirdParty: number; answers: number;
    missingAnswers: number; visual: number; ready: number; versions: number;
    versionsNeedingReview: number; syllabusItems: number; missingDocuments: number };
  syllabus: { id: string; conteudo: string; pagina: number; nivel: string }[];
  sources: { name: string; sha256: string; pages?: number }[];
};
