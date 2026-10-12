import { KEYWORDS } from "./data.js";

const iconKeywords = new Map(KEYWORDS.filter(k => k.icon)
  .flatMap(k => k.aliases.map(alias => [alias, k])));

export function iconKeywordAtStart(text) {
  const match = text.match(/^(?:（([^（）\n]+)）|\(([^()\n]+)\))/);
  const keyword = match && iconKeywords.get((match[1] ?? match[2]).trim());
  return keyword ? { keyword, length: match[0].length } : null;
}

// Analysis uses the keyword's meaning while the renderer preserves the icon-only syntax.
export function keywordText(text) {
  return text.replace(/（([^（）\n]+)）|\(([^()\n]+)\)/g, (whole, full, half) =>
    iconKeywords.get((full ?? half).trim())?.name ?? whole);
}
