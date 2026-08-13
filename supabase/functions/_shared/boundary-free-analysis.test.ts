import {
  BOUNDARY_FREE_ANALYSIS_SCHEMA,
  WHOLE_VIDEO_WRITING_SCHEMA,
  WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION,
  boundaryFreeToCandidate,
  buildBoundaryFreeAnalysisPrompt,
  buildWholeVideoWritingPrompt,
  limitWholeVideoAnalysis,
  type ExerciseCatalogContext,
  type WholeVideoAnalysis,
  type WholeVideoWriting,
} from "./boundary-free-analysis";

const catalog: ExerciseCatalogContext = {
  id: 201,
  name: "Chest-Supported Dumbbell Row",
  family: "row",
  mechanics: {
    equipmentClass: "dumbbell",
    movementFamily: "row",
    support: "chest-supported",
    trajectory: "free-path",
    laterality: "bilateral",
    stance: "standard",
    grip: "neutral",
    angle: "incline",
  },
};

const issue = (index: number): WholeVideoAnalysis["issues"][number] => ({
  id: `issue-${index}`,
  title: `Visible issue ${index}`,
  observation: `The visible path for issue ${index} changes during the set.`,
  prevalence: index === 1 ? "throughout" : "repeated",
  severity: index === 1 ? "high" : "important",
  confidence: 0.9,
  observedIssueRegions: index === 1 ? ["elbows"] : ["shoulders"],
  evidence: [{
    startMs: index * 1_000,
    peakMs: index * 1_000 + 300,
    endMs: index * 1_000 + 600,
    visualEvidence: `Issue ${index} is visible at the cited moment.`,
    visibleBodyAreas: ["dumbbell", "elbow", "torso"],
    confidence: 0.9,
  }],
});

const analysis = (count = 4): WholeVideoAnalysis => ({
  videoSummary: "The complete row set is visible from a front-side view.",
  visibility: {
    cameraView: "front-side",
    clearlyVisible: ["dumbbells", "elbows", "torso"],
    partlyVisible: ["shoulders"],
    notVisible: ["feet"],
  },
  issues: Array.from({ length: count }, (_, index) => issue(index + 1)),
});

const writing = (source: WholeVideoAnalysis): WholeVideoWriting => ({
  overallAssessment: "The support stays steady, while the pulling path needs attention.",
  coachNote: "Match the dumbbell path on the next set.",
  movementScores: [
    { id: "path", label: "Pulling Path", score: 72, observed: "The path changes visibly.", evidenceIds: ["issue-1"] },
    { id: "support", label: "Body Support", score: 88, observed: "The torso stays supported.", evidenceIds: [] },
    { id: "alignment", label: "Joint Alignment", score: 76, observed: "The elbows finish unevenly.", evidenceIds: ["issue-2"] },
    { id: "control", label: "Control", score: 81, observed: "The lowering remains controlled.", evidenceIds: [] },
  ],
  muscleFocus: {
    primary: [{ name: "Latissimus dorsi", region: "lats" }],
    secondary: [{ name: "Biceps", region: "biceps" }],
    unclassified: [],
  },
  coachingItems: source.issues.map((item) => ({
    id: item.id,
    whatHappenedDetail: `The camera shows ${item.title.toLowerCase()}. It appears at the cited moment. The same visible fault guides this coaching.`,
    whyItMatters: "Keep the pull repeatable",
    whyItMattersDetail: "This changes the dumbbell route. The row finishes from a different elbow position. A steadier route makes the set easier to repeat.",
    whatToDo: "Guide both elbows along the same route on the next set.",
    successCheck: "Both dumbbells finish at the same point.",
  })),
});

describe("focused whole-video analyst and writer contract", () => {
  it("limits structured analyst output to the first six ranked issues without rejecting three", () => {
    expect(limitWholeVideoAnalysis(analysis(3)).issues).toHaveLength(3);
    expect(limitWholeVideoAnalysis(analysis(7)).issues.map((item) => item.id)).toEqual([
      "issue-1", "issue-2", "issue-3", "issue-4", "issue-5", "issue-6",
    ]);
  });

  it("keeps the analyst schema focused on video understanding, visibility, issues, and inline evidence", () => {
    const schema = BOUNDARY_FREE_ANALYSIS_SCHEMA as any;
    expect(schema.required).toEqual(["videoSummary", "visibility", "issues"]);
    expect(Object.keys(schema.properties)).toEqual(["videoSummary", "visibility", "issues"]);
    expect(schema.properties.issues.items.required).toEqual([
      "id", "title", "observation", "prevalence", "severity", "confidence", "observedIssueRegions", "evidence",
    ]);
    expect(schema.properties.issues.items.properties.evidence.items.required).toEqual([
      "startMs", "peakMs", "endMs", "visualEvidence", "visibleBodyAreas", "confidence",
    ]);
    expect(JSON.stringify(schema)).not.toMatch(/observedRepCount|repAudit|affectedRepNumbers|movementScores|muscleFocus|coachingItems|strengths|generalGuidance|recheck/i);
    expect(JSON.stringify(schema)).not.toMatch(/minimum|maximum|minItems|maxItems/);
  });

  it("asks the analyst to watch once, search broadly, rank candidates, and respect visibility", () => {
    const prompt = buildBoundaryFreeAnalysisPrompt(12_000, undefined, catalog);
    expect(prompt).toMatch(/complete video from beginning to end/i);
    expect(prompt).toMatch(/watch.*once/i);
    expect(prompt).toMatch(/internal candidate list/i);
    expect(prompt).toMatch(/compare.*importance.*confidence.*usefulness/i);
    expect(prompt).toMatch(/strongest 4(?:–|-| to )6/i);
    expect(prompt).toMatch(/visibility/i);
    for (const lens of ["hands", "grip", "equipment", "contact", "body", "joint alignment", "support", "path", "range", "control", "balance", "stability", "left-right imbalance"]) {
      expect(prompt.toLowerCase()).toContain(lens);
    }
    expect(prompt).toMatch(/outside (?:these|those) suggestions/i);
    expect(prompt).toMatch(/actual form fault/i);
    expect(prompt).toMatch(/do not count or audit repetitions/i);
    expect(prompt).not.toMatch(/return (?:a )?rep count|provide (?:a )?rep audit|bodyweight squat|squat arm/i);
  });

  it("passes neutral catalog mechanics to both model prompts", () => {
    const analystPrompt = buildBoundaryFreeAnalysisPrompt(12_000, undefined, catalog);
    const writerPrompt = buildWholeVideoWritingPrompt(analysis(), undefined, catalog);
    for (const value of Object.values(catalog.mechanics)) {
      expect(analystPrompt).toContain(value);
      expect(writerPrompt).toContain(value);
    }
    expect(analystPrompt).toMatch(/context.*not.*required fault/i);
    expect(writerPrompt).toMatch(/context.*not.*proof/i);
  });

  it("keeps analyst identity and evidence authoritative during writer assembly", () => {
    const source = analysis();
    const candidate = boundaryFreeToCandidate(source, writing(source), undefined, { catalog });
    expect(candidate.priorityCorrections[0]).toMatchObject({
      id: source.issues[0].id,
      title: source.issues[0].title,
      detail: writing(source).coachingItems[0].whatHappenedDetail,
      severity: source.issues[0].severity,
      observedIssueRegions: source.issues[0].observedIssueRegions,
      evidence: [{ visualEvidence: source.issues[0].evidence[0].visualEvidence }],
      expandedCoaching: {
        summary: source.issues[0].title,
        whatHappened: source.issues[0].title,
      },
    });
  });

  it("does not let the writer replace issue titles because the writer schema has no title field", () => {
    const itemProperties = (WHOLE_VIDEO_WRITING_SCHEMA as any).properties.coachingItems.items.properties;
    expect(itemProperties).not.toHaveProperty("title");
    expect(itemProperties).not.toHaveProperty("whatHappened");
  });

  it("uses writer scores and muscle focus while keeping issue highlights separate", () => {
    const source = analysis();
    const finalWriting = writing(source);
    const candidate = boundaryFreeToCandidate(source, finalWriting, undefined, { catalog });
    expect(candidate.movementScores).toEqual(finalWriting.movementScores);
    expect(candidate.muscleFocus).toEqual(finalWriting.muscleFocus);
    expect(candidate.priorityCorrections[0].observedIssueRegions).toEqual(["elbows"]);
    expect(candidate.muscleFocus.primary[0].region).toBe("lats");
    expect(candidate.didWell).toEqual([]);
    expect(candidate.coachingCues).toEqual([]);
    expect(candidate.repTimeline).toEqual([]);
  });

  it("keeps only declared repetitions in the set summary", () => {
    const declaration = {
      exercise: { source: "catalog" as const, catalogExerciseId: 201, label: "Chest-Supported Dumbbell Row" },
      amount: { kind: "reps" as const, value: 10, countScope: "total" as const },
      load: { kind: "known" as const, value: 35, unit: "lb" as const, scope: "per_hand" as const },
      side: "bilateral" as const,
      styles: [],
      focusNote: null,
    };
    const source = analysis();
    const candidate = boundaryFreeToCandidate(source, writing(source), declaration, { catalog });
    expect(candidate.setSummary).toMatchObject({ totalReps: 10, consistentReps: null });
    expect(candidate.repTimeline).toEqual([]);
  });

  it("instructs Flash Lite to write specific three-sentence coaching without a sentence parser", () => {
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toMatch(/everyday gym language/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toMatch(/technical terms?.*explain/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toMatch(/exactly three natural, video-specific sentences.*whatHappenedDetail/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toMatch(/exactly three natural, exercise-specific sentences.*whyItMattersDetail/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toMatch(/minor isolated issues.*must not make.*entire performance.*poor/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toMatch(/0-to-100 scale.*never.*0-to-10/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toMatch(/declaration.*catalog mechanics.*final issues/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toMatch(/observable mechanical consequences/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toMatch(/do not claim.*muscle activation.*joint health.*injury risk/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toMatch(/do not introduce.*new fault.*hypothetical compensation/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toMatch(/do not substitute equipment names/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toMatch(/do not describe.*target muscles.*working harder/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toMatch(/muscle names belong only in muscleFocus/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toMatch(/do not add an ideal path, direction, or endpoint/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).not.toMatch(/sentence parser|truncate/i);
  });
});
