type CoachingEvidence = {
  peakMs?: number;
  startMs: number;
  repNumber: number | null;
  phase: string | null;
  visualEvidence: string;
};

type CoachingAction = {
  instruction: string;
  cue: string;
  successCheck: string | null;
  applyWhen: string;
};

type ExpandedCoaching = {
  summary: string;
  whatHappened: string;
  whyItMatters: string;
  whatToDo: string;
  successCheck: string;
};

export type CoachingContractFinding = {
  title: string;
  detail: string;
  whyItMatters: string;
  correction: string | null;
  cue: string | null;
  actionableCorrection?: CoachingAction | null;
  expandedCoaching?: ExpandedCoaching;
  evidence: CoachingEvidence[];
  primaryEvidenceIndex?: number;
};

type VisibleQuality = "path" | "range" | "control" | "stability" | "repeatability";

const IMPERATIVE_START = /^(?:Aim|Bend|Control|Drive|Extend|Finish|Focus|Guide|Hinge|Hold|Keep|Let|Lift|Lock|Lower|Maintain|Match|Move|Pause|Place|Point|Press|Pull|Raise|Reach|Rotate|Set|Sit|Slow|Stand|Start|Stop|Use|Watch)\b/i;
const TIMING_LANGUAGE = /\b(?:at the|beginning|bottom|concentric|during|eccentric|end|final|first|later|lowering|middle|rep(?:etition)?\s*\d+|setup|throughout|top|transition)\b/i;
const UNSUPPORTED_CAUSE_LANGUAGE = /\b(?:activat(?:e|es|ed|ing|ion)|compensat(?:e|es|ed|ing|ion)|engag(?:e|es|ed|ing)|force|injur(?:y|ies)|internal|isolat(?:e|es|ed|ing|ion)|joint|lat(?:s)?|leverage|load distribution|momentum|muscles?|pain|pressure|strain|stress|target(?:s|ed|ing)?|trap(?:s|ezius)?|tissue|work happens|work shifts)\b/i;
const TECHNICAL_COACHING_JARGON = /\b(?:biomechan(?:ic|ical|ics)|center of mass|concentric|eccentric|implement|kinematic(?:s)?|kinetic chain|posterior chain|proprioception|sagittal plane|frontal plane|transverse plane|scapul(?:a|ar)|thoracic|lumbar|cervical|trajectory|dorsiflex(?:ion)?|plantar flex(?:ion)?|pronat(?:e|ion)|supinat(?:e|ion)|torque|valgus|varus|lockout|hyperextension|peak extension|peak height|neutral joints?|descent|(?:moves?|rolls?|bends?) into extension|reversal|cited)\b/i;
const VISIBLE_EFFECT_LANGUAGE = /\b(?:consistent|control|end position|path|range|repeat(?:able|ability|ed|ing)?|repetition|stability|stable)\b/i;

function oneSentence(value: string): string {
  const trimmed = value.trim();
  const first = trimmed.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? trimmed;
  return /[.!?]$/.test(first) ? first : `${first}.`;
}

function sentenceList(value: string | null | undefined, limit: number): string[] {
  if (!value?.trim()) return [];
  return (value.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [value])
    .map((sentence) => oneSentence(sentence))
    .filter(Boolean)
    .slice(0, limit);
}

function uniqueSentences(values: string[], limit: number): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = normalizedWords(value);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  }).slice(0, limit);
}

function normalizedWords(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

const OBSERVATION_STOP_WORDS = new Set(["a", "an", "and", "as", "at", "be", "becomes", "by", "during", "for", "from", "in", "is", "it", "of", "on", "or", "that", "the", "this", "to", "with", "your"]);

function isSpecificObservation(value: string, context: string): boolean {
  if (TIMING_LANGUAGE.test(value)) return true;
  const contextWords = new Set(normalizedWords(context).split(" ").filter((word) => word.length > 3 && !OBSERVATION_STOP_WORDS.has(word)));
  const observationWords = new Set(normalizedWords(value).split(" ").filter((word) => word.length > 3 && !OBSERVATION_STOP_WORDS.has(word)));
  let overlap = 0;
  for (const word of observationWords) {
    if (contextWords.has(word)) overlap += 1;
  }
  return overlap >= 2;
}

function sentenceCase(value: string): string {
  return value.length === 0 ? value : `${value[0].toLocaleUpperCase()}${value.slice(1)}`;
}

function hasEquipmentMismatch(value: string, context: string): boolean {
  return /\bdumbbells?\b/i.test(context) && /\bbar(?:bell)? path\b/i.test(value);
}

function isVisibleCopy(value: string, context: string): boolean {
  return !UNSUPPORTED_CAUSE_LANGUAGE.test(value)
    && !TECHNICAL_COACHING_JARGON.test(value)
    && !hasEquipmentMismatch(value, context);
}

function primaryEvidence(finding: CoachingContractFinding): CoachingEvidence | null {
  const selected = finding.primaryEvidenceIndex;
  return Number.isInteger(selected) && Number(selected) >= 0 && Number(selected) < finding.evidence.length
    ? finding.evidence[Number(selected)]
    : finding.evidence[0] ?? null;
}

function timingPhrase(evidence: CoachingEvidence | null): string {
  if (!evidence) return "at the clearest moment";
  const phase = evidence.phase?.trim().replaceAll("_", " ");
  const plainPhase = phase === "concentric"
    ? "lifting"
    : phase === "eccentric"
      ? "lowering"
      : phase === "transition"
        ? "change of direction"
        : phase;
  if (plainPhase && evidence.repNumber !== null) {
    if (plainPhase === "top" || plainPhase === "bottom") return `at the ${plainPhase} of rep ${evidence.repNumber}`;
    if (plainPhase === "setup") return `during the setup for rep ${evidence.repNumber}`;
    return `during the ${plainPhase} part of rep ${evidence.repNumber}`;
  }
  if (evidence.repNumber !== null) return `during rep ${evidence.repNumber}`;
  if (plainPhase) return `during the ${plainPhase} part of the rep`;
  const timeMs = evidence.peakMs ?? evidence.startMs;
  return `around ${(timeMs / 1_000).toFixed(1)} seconds`;
}

function withTiming(value: string, evidence: CoachingEvidence | null): string {
  const sentence = oneSentence(value);
  if (TIMING_LANGUAGE.test(sentence)) return sentence;
  return `${sentence.replace(/[.!?]$/, "")} ${timingPhrase(evidence)}.`;
}

function visibleQuality(finding: CoachingContractFinding): VisibleQuality {
  const source = [
    finding.title,
    finding.detail,
    finding.whyItMatters,
    ...finding.evidence.map((item) => item.visualEvidence),
  ].join(" ");
  if (/\b(?:path|track|travel|arc|drift|flare|line)\b/i.test(source)) return "path";
  if (/\b(?:depth|endpoint|end position|lockout|range|bottom|finish)\b/i.test(source)) return "range";
  if (/\b(?:bounce|control|drop|fast|slow|speed|tempo|wobble)\b/i.test(source)) return "control";
  if (/\b(?:balance|head|hip|knee|neck|shoulder|stability|stable|stance|torso)\b/i.test(source)) return "stability";
  return "repeatability";
}

function whyFallback(quality: VisibleQuality): string {
  switch (quality) {
    case "path": return "That makes the movement path less repeatable from rep to rep.";
    case "range": return "That makes the visible end position and range less consistent from rep to rep.";
    case "control": return "That makes the repetition harder to control and repeat.";
    case "stability": return "That makes your position less steady and harder to repeat.";
    case "repeatability": return "That makes the repetition less consistent from start to finish.";
  }
}

function instructionFallback(quality: VisibleQuality): string {
  switch (quality) {
    case "path": return "Guide the weight along the same visible path on every rep.";
    case "range": return "Reach the same visible end position on every rep.";
    case "control": return "Control the weight at the same speed through every rep.";
    case "stability": return "Keep that body position steady through every rep.";
    case "repeatability": return "Repeat the same visible position and path on every rep.";
  }
}

function successCheckFallback(quality: VisibleQuality): string {
  switch (quality) {
    case "path": return "The weight follows the same visible path on every rep.";
    case "range": return "Each rep reaches the same visible end position.";
    case "control": return "The final rep moves at the same controlled speed as the first.";
    case "stability": return "That body position stays steady through every rep.";
    case "repeatability": return "The final rep matches the first in visible position and path.";
  }
}

function mechanicsFallback(quality: VisibleQuality): string {
  switch (quality) {
    case "path": return "When that body position changes, the weight follows a different path instead of one repeatable line.";
    case "range": return "When the endpoint changes, each repetition covers a different visible range.";
    case "control": return "When the speed changes, the weight is harder to guide through the same path.";
    case "stability": return "When that support position moves, the rest of the repetition has a less steady base.";
    case "repeatability": return "When the start or finish changes, the next repetition is harder to match.";
  }
}

function validInstruction(value: string, context: string): string | null {
  const sentence = oneSentence(value);
  if (IMPERATIVE_START.test(sentence) && isVisibleCopy(sentence, context)) return sentenceCase(sentence);
  const clauses = sentence.replace(/[.!?]$/, "").split(/\s+(?:and|but)\s+|[;,]\s*/i);
  const safeClause = clauses.find((clause) => IMPERATIVE_START.test(clause.trim()) && isVisibleCopy(clause, context));
  return safeClause ? sentenceCase(oneSentence(safeClause)) : null;
}

function safeObservation(finding: CoachingContractFinding, context: string): string {
  if (isVisibleCopy(finding.detail, context)) return withTiming(finding.detail, primaryEvidence(finding));
  const evidence = primaryEvidence(finding);
  if (evidence && isVisibleCopy(evidence.visualEvidence, context)) return withTiming(evidence.visualEvidence, evidence);
  return `This movement issue is visible ${timingPhrase(evidence)}.`;
}

function summaryFallback(quality: VisibleQuality): string {
  switch (quality) {
    case "path": return "Weight path";
    case "range": return "Range of motion";
    case "control": return "Movement control";
    case "stability": return "Body position";
    case "repeatability": return "Rep consistency";
  }
}

export function enforceCorrectionCoaching<T extends CoachingContractFinding>(finding: T): T {
  const evidence = primaryEvidence(finding);
  const context = [finding.detail, ...finding.evidence.map((item) => item.visualEvidence)].join(" ");
  const quality = visibleQuality(finding);
  const detail = safeObservation(finding, context);
  const originalWhy = oneSentence(finding.whyItMatters);
  const whyItMatters = isVisibleCopy(originalWhy, context) && VISIBLE_EFFECT_LANGUAGE.test(originalWhy)
    ? originalWhy
    : whyFallback(quality);
  const requestedInstruction = finding.actionableCorrection?.instruction ?? finding.correction ?? finding.cue ?? "";
  const instruction = (requestedInstruction ? validInstruction(requestedInstruction, context) : null)
    ?? instructionFallback(quality);
  const requestedCorrection = finding.correction ? oneSentence(finding.correction) : null;
  const correction = (requestedCorrection ? validInstruction(requestedCorrection, context) : null) ?? instruction;
  const requestedSuccessCheck = finding.actionableCorrection?.successCheck;
  const oneSentenceSuccessCheck = requestedSuccessCheck ? oneSentence(requestedSuccessCheck) : null;
  const successCheck = oneSentenceSuccessCheck
    && isVisibleCopy(oneSentenceSuccessCheck, context)
    && normalizedWords(oneSentenceSuccessCheck) !== normalizedWords(instruction)
    ? oneSentenceSuccessCheck
    : successCheckFallback(quality);
  const objectiveFallback = uniqueSentences([
    detail,
    ...finding.evidence.map((moment) => withTiming(moment.visualEvidence, moment)),
    `The clearest example appears ${timingPhrase(evidence)}.`,
    `This position change is visible ${timingPhrase(evidence)}.`,
  ], 4);
  const requestedWhatHappened = sentenceList(finding.expandedCoaching?.whatHappened, 4)
    .filter((sentence) => isVisibleCopy(sentence, context) && isSpecificObservation(sentence, context));
  const whatHappened = requestedWhatHappened.length >= 1
    ? uniqueSentences(requestedWhatHappened, 4)
    : uniqueSentences([...requestedWhatHappened, ...objectiveFallback], 4);
  const whyTeaching = uniqueSentences([
    ...sentenceList(finding.expandedCoaching?.whyItMatters, 3).filter((sentence) => isVisibleCopy(sentence, context)),
    whyItMatters,
    mechanicsFallback(quality),
  ], 3);
  const expandedInstruction = finding.expandedCoaching?.whatToDo
    ? validInstruction(finding.expandedCoaching.whatToDo, context)
    : null;
  const whatToDo = expandedInstruction ?? instruction;
  const requestedExpandedSuccess = finding.expandedCoaching?.successCheck
    ? oneSentence(finding.expandedCoaching.successCheck)
    : null;
  const expandedSuccess = requestedExpandedSuccess
    && isVisibleCopy(requestedExpandedSuccess, context)
    && normalizedWords(requestedExpandedSuccess) !== normalizedWords(whatToDo)
    ? requestedExpandedSuccess
    : successCheck;
  const requestedCue = finding.actionableCorrection?.cue ?? finding.cue ?? "";
  const cue = requestedCue && isVisibleCopy(requestedCue, context)
    ? requestedCue
    : whatToDo.replace(/[.!?]$/, "");
  const requestedApplyWhen = finding.actionableCorrection?.applyWhen ?? "";
  const applyWhen = requestedApplyWhen && isVisibleCopy(requestedApplyWhen, context)
    ? requestedApplyWhen
    : timingPhrase(evidence);

  return {
    ...finding,
    detail,
    whyItMatters,
    correction,
    expandedCoaching: {
      summary: oneSentence(
        finding.expandedCoaching?.summary && isVisibleCopy(finding.expandedCoaching.summary, context)
          ? finding.expandedCoaching.summary
          : isVisibleCopy(finding.title, context)
            ? finding.title
            : summaryFallback(quality),
      ),
      whatHappened: whatHappened.join(" "),
      whyItMatters: whyTeaching.join(" "),
      whatToDo,
      successCheck: expandedSuccess,
    },
    actionableCorrection: {
      instruction: whatToDo,
      cue,
      successCheck: expandedSuccess,
      applyWhen,
    },
  };
}
