import { searchKey } from "./catalog";
export const areas = ["Matemática", "Português", "Ciências Humanas", "Ciências da Natureza"] as const;
export type Area = typeof areas[number];
export const disciplinesByArea: Record<Area, readonly string[]> = {
  Matemática: ["Matemática"], Português: ["Língua Portuguesa"],
  "Ciências Humanas": ["História", "Geografia", "Filosofia", "Sociologia"],
  "Ciências da Natureza": ["Física", "Química", "Biologia"]
};
export function areaOf(discipline: string): Area | "Não classificada" {
  return areas.find(a => disciplinesByArea[a].some(d => searchKey(d) === searchKey(discipline))) ?? "Não classificada";
}
export const originLabels: Record<string, string> = {official: "Questões oficiais", "third-party": "Simulados de terceiros", ai: "Inéditas por IA"};
export function topicKey(discipline: string, topic: string) { return `${discipline}::${topic}`; }
