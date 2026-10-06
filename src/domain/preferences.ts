import type { Area } from "./classification";
export const errorReasons = ["interpretação", "procedimento", "cálculo", "conteúdo", "falta de tempo"] as const;
export type ErrorReason = typeof errorReasons[number];
export type ErrorNote = { id: string; attemptId: string; questionId: string; reason: ErrorReason | null; updatedAt: string };
export type Preferences = {
  id: "personal"; goalPercentage: number | null; areaGoals: Partial<Record<Area, number>>;
  course: { name: string; weights: Record<Area, number>; source: "user" } | null;
};
export const defaultPreferences: Preferences = { id: "personal", goalPercentage: null, areaGoals: {}, course: null };
