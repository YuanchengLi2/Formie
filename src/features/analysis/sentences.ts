const PROTECTED_PERIOD = "\uE000";
const ABBREVIATION = /\b(?:e\.g|i\.e|u\.s|u\.k|vs|mr|mrs|ms|dr|st|no|rep)\./gi;

export function normalizeAnalysisText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function segmentAnalysisSentences(value: string): string[] {
  const normalized = normalizeAnalysisText(value);
  if (!normalized) return [];
  const protectedText = normalized
    .replace(/(?<=\d)\.(?=\d)/g, PROTECTED_PERIOD)
    .replace(ABBREVIATION, (match) => match.replaceAll(".", PROTECTED_PERIOD));
  return (protectedText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [])
    .map((sentence) => sentence.replaceAll(PROTECTED_PERIOD, ".").trim())
    .filter(Boolean);
}

export function countAnalysisSentences(value: string): number {
  return segmentAnalysisSentences(value).length;
}

export function limitAnalysisSentences(value: string, maximum = 3): string {
  return segmentAnalysisSentences(value).slice(0, Math.max(0, maximum)).join(" ");
}
