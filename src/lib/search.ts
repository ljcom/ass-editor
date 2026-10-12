import type { Subtitle } from "../types/subtitle";

export function matchesSubtitle(cue: Subtitle, query: string): boolean {
  const needle = query.trim().normalize("NFC").toLocaleLowerCase();
  if (!needle) return true;
  const plainText = cue.text.replace(/\{[^}]*\}/g, "").replace(/\\[Nnh]/g, " ");
  return plainText.normalize("NFC").toLocaleLowerCase().includes(needle);
}
