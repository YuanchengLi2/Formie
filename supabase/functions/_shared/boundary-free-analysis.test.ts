import {
  BOUNDARY_FREE_ANALYSIS_SCHEMA,
  WHOLE_VIDEO_WRITING_SCHEMA,
  WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION,
  boundaryFreeToCandidate,
  buildBoundaryFreeAnalysisPrompt,
  buildWholeVideoWritingRepairPrompt,
  buildWholeVideoWritingPrompt,
  normalizeWholeVideoWriting,
  parseWholeVideoAnalysis,
  parseWholeVideoWriting,
  type WholeVideoAnalysis,
  type WholeVideoWriting,
} from "./boundary-free-analysis";

const issue = (index: number): WholeVideoAnalysis["issues"][number] => ({
  id: `issue-${index}`,
  title: `Visible issue ${index}`,
  observation: `The visible path for issue ${index} changes during the set.`,
  mechanicalConsequence: `The visible change materially reduces control or the intended exercise stimulus for issue ${index}.`,
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
    { id: "path", label: "Pulling Path", observed: "The path changes visibly.", evidenceIds: ["issue-1"] },
    { id: "support", label: "Body Support", observed: "The torso stays supported.", evidenceIds: [] },
    { id: "alignment", label: "Joint Alignment", observed: "The elbows finish unevenly.", evidenceIds: ["issue-2"] },
    { id: "control", label: "Control", observed: "The lowering remains controlled.", evidenceIds: [] },
  ],
  muscleFocus: {
    primary: [{ name: "Latissimus dorsi", region: "lats" }],
    secondary: [{ name: "Biceps", region: "biceps" }],
    unclassified: [],
  },
  coachingItems: source.issues.map((item) => ({
    id: item.id,
    title: `Fix issue ${item.id.replace("issue-", "")}`,
    whatHappened: `The pulling path changes at issue ${item.id.replace("issue-", "")}`,
    whatHappenedDetail: `The camera shows ${item.title.toLowerCase()}. It appears at the cited moment. The same visible fault guides this coaching.`,
    whyItMatters: "Keep the pull repeatable",
    whyItMattersDetail: "This changes the dumbbell route. The row finishes from a different elbow position. A steadier route makes the set easier to repeat.",
    whatToDo: "Guide both elbows along the same route on the next set.",
    successCheck: "Both dumbbells finish at the same point.",
  })),
});

describe("focused whole-video analyst and writer contract", () => {
  it("preserves every validated issue and its frame evidence without a count cap", () => {
    const source = analysis(8);
    expect(parseWholeVideoAnalysis(source, 20_000)).toEqual(source);
    expect(parseWholeVideoAnalysis(source, 20_000).issues.map((item) => item.id)).toEqual([
      "issue-1", "issue-2", "issue-3", "issue-4", "issue-5", "issue-6", "issue-7", "issue-8",
    ]);
    expect(boundaryFreeToCandidate(source, writing(source)).priorityCorrections.map((item) => item.id)).toEqual(
      source.issues.map((item) => item.id),
    );
  });

  it("rejects duplicate issue identities and invalid frame intervals instead of silently dropping them", () => {
    const duplicate = analysis(2);
    duplicate.issues[1].id = duplicate.issues[0].id;
    expect(() => parseWholeVideoAnalysis(duplicate, 20_000)).toThrow(/unique/i);

    const invalidFrame = analysis(1);
    invalidFrame.issues[0].evidence[0].peakMs = invalidFrame.issues[0].evidence[0].endMs;
    expect(() => parseWholeVideoAnalysis(invalidFrame, 20_000)).toThrow(/startMs < peakMs < endMs/i);
  });

  it("keeps the analyst schema focused on video understanding, visibility, issues, and inline evidence", () => {
    const schema = BOUNDARY_FREE_ANALYSIS_SCHEMA as any;
    expect(schema.required).toEqual(["videoSummary", "visibility", "issues"]);
    expect(Object.keys(schema.properties)).toEqual(["videoSummary", "visibility", "issues"]);
    expect(schema.properties.issues.items.required).toEqual([
      "id", "title", "observation", "mechanicalConsequence", "prevalence", "severity", "confidence", "observedIssueRegions", "evidence",
    ]);
    expect(schema.properties.issues.items.properties.evidence.items.required).toEqual([
      "startMs", "peakMs", "endMs", "visualEvidence", "visibleBodyAreas", "confidence",
    ]);
    expect(JSON.stringify(schema)).not.toMatch(/observedRepCount|repAudit|affectedRepNumbers|movementScores|muscleFocus|coachingItems|strengths|generalGuidance|recheck/i);
    expect(JSON.stringify(schema)).not.toMatch(/minimum|maximum|minItems|maxItems/);
  });

  it("finds the four to six highest-consequence supported issues without letting recommended checks limit discovery", () => {
    const prompt = buildBoundaryFreeAnalysisPrompt(12_000);
    expect(prompt).toMatch(/complete video from beginning to end/i);
    expect(prompt).toMatch(/watch.*once/i);
    expect(prompt).toMatch(/four to six.*highest-consequence.*form (?:problems|issues)/i);
    expect(prompt).toMatch(/loss of.*support|loss of.*control/i);
    expect(prompt).toMatch(/joint.*position.*under load/i);
    expect(prompt).toMatch(/intended.*muscle.*stimulus/i);
    expect(prompt).toMatch(/exercise-specific.*setup.*bench angle.*elbow.*arm path/i);
    expect(prompt).toMatch(/do not prioritize.*easy to notice/i);
    expect(prompt).toMatch(/do not include.*minor.*optimization/i);
    expect(prompt).toMatch(/recommendations.*not.*limits/i);
    expect(BOUNDARY_FREE_ANALYSIS_SCHEMA.properties.issues.description).toMatch(/four to six.*highest-consequence/i);
    expect(prompt).toMatch(/at least one.*evidence moment/i);
    expect(prompt).toMatch(/repeated or throughout issue.*two meaningfully separated evidence moments/i);
    expect(prompt).toMatch(/beginning, middle, and end.*never invent or move a timestamp/i);
    expect(prompt).toMatch(/peakMs.*clearest.*frame/i);
    expect(prompt).toMatch(/visibility/i);
    for (const lens of ["setup", "equipment", "contact", "hands", "grip", "body position", "alignment", "posture", "support", "path", "range", "endpoints", "tempo", "control", "balance", "stability", "joint tracking", "left-right", "symmetry", "beginning", "middle", "end"]) {
      expect(prompt.toLowerCase()).toContain(lens);
    }
    expect(prompt).toMatch(/outside (?:these|those) (?:recommendations|suggestions)/i);
    expect(prompt).toMatch(/actual form fault/i);
    expect(prompt).toMatch(/do not count or audit repetitions/i);
    expect(prompt).not.toMatch(/smaller.*optimization/i);
    expect(prompt).not.toMatch(/return (?:a )?rep count|provide (?:a )?rep audit|bodyweight squat|squat arm/i);
  });

  it("keeps catalog data out of both model prompts", () => {
    const analystPrompt = buildBoundaryFreeAnalysisPrompt(12_000);
    const writerPrompt = buildWholeVideoWritingPrompt(analysis());
    expect(analystPrompt).not.toMatch(/catalog/i);
    expect(writerPrompt).not.toMatch(/catalog/i);
  });

  it("keeps analyst identity and evidence authoritative during writer assembly", () => {
    const source = analysis();
    const candidate = boundaryFreeToCandidate(source, writing(source));
    expect(candidate.priorityCorrections[0]).toMatchObject({
      id: source.issues[0].id,
      title: writing(source).coachingItems[0].title,
      detail: writing(source).coachingItems[0].whatHappenedDetail,
      severity: source.issues[0].severity,
      observedIssueRegions: source.issues[0].observedIssueRegions,
      evidence: [{ visualEvidence: source.issues[0].evidence[0].visualEvidence }],
      expandedCoaching: {
        summary: writing(source).coachingItems[0].title,
        whatHappened: writing(source).coachingItems[0].whatHappened,
      },
    });
  });

  it("requires the Flash Lite writer to cover every analyst issue exactly once and restores analyst order", () => {
    const source = analysis(8);
    const complete = writing(source);
    expect(parseWholeVideoWriting(complete, source)).toEqual(complete);
    expect(() => parseWholeVideoWriting({ ...complete, coachingItems: complete.coachingItems.slice(0, 7) }, source)).toThrow(/every analyst issue/i);
    expect(parseWholeVideoWriting({ ...complete, coachingItems: [...complete.coachingItems].reverse() }, source).coachingItems).toEqual(complete.coachingItems);
  });

  it("normalizes writer failure into complete coaching without losing analyst issues", () => {
    const source = analysis(8);
    const normalized = normalizeWholeVideoWriting(null, source);
    expect(normalized.coachingItems.map((item) => item.id)).toEqual(source.issues.map((item) => item.id));
    expect(normalized.coachingItems[0].whatHappened).not.toBe(source.issues[0].title);
    expect(normalized.coachingItems[0].whyItMatters).not.toMatch(new RegExp(source.issues[0].title, "i"));
    expect(normalized.movementScores).toHaveLength(4);
    expect(normalized.muscleFocus).toEqual({ primary: [], secondary: [], unclassified: [] });
  });

  it("salvages valid writer prose and muscle mapping when one independent field is malformed", () => {
    const source = analysis();
    const complete = writing(source);
    const normalized = normalizeWholeVideoWriting({
      ...complete,
      movementScores: complete.movementScores.slice(0, 3),
      coachingItems: [...complete.coachingItems].reverse(),
    }, source);
    expect(normalized.overallAssessment).toBe(complete.overallAssessment);
    expect(normalized.coachNote).toBe(complete.coachNote);
    expect(normalized.coachingItems).toEqual(complete.coachingItems);
    expect(normalized.muscleFocus).toEqual(complete.muscleFocus);
    expect(normalized.movementScores).toHaveLength(4);
  });

  it("gives repair the rejected output, validation reason, and complete immutable analyst result", () => {
    const source = analysis(8);
    const prompt = buildWholeVideoWritingRepairPrompt(source, undefined, { coachingItems: [] }, new Error("missing items"));
    expect(prompt).toContain("missing items");
    expect(prompt).toContain("issue-8");
    expect(prompt).toContain('\"coachingItems\":[]');
  });

  it("keeps analyst facts immutable while publishing a simple writer-generated issue title", () => {
    const itemProperties = (WHOLE_VIDEO_WRITING_SCHEMA as any).properties.coachingItems.items.properties;
    expect(itemProperties).toHaveProperty("title");
    expect(itemProperties).toHaveProperty("whatHappened");
    expect((WHOLE_VIDEO_WRITING_SCHEMA as any).properties.coachingItems.items.required).toContain("title");
    expect((WHOLE_VIDEO_WRITING_SCHEMA as any).properties.coachingItems.items.required).toContain("whatHappened");
  });

  it("rejects section headings that repeat the issue title or each other", () => {
    const source = analysis();
    const repeatedIssueTitle = writing(source);
    repeatedIssueTitle.coachingItems[0].whatHappened = source.issues[0].title;
    expect(() => parseWholeVideoWriting(repeatedIssueTitle, source)).toThrow(/whatHappened.*issue title/i);

    const repeatedSectionHeading = writing(source);
    repeatedSectionHeading.coachingItems[0].whyItMatters = repeatedSectionHeading.coachingItems[0].whatHappened;
    expect(() => parseWholeVideoWriting(repeatedSectionHeading, source)).toThrow(/section headings.*distinct/i);

    const repeatedDisplayedTitle = writing(source);
    repeatedDisplayedTitle.coachingItems[0].whatHappened = repeatedDisplayedTitle.coachingItems[0].title;
    expect(() => parseWholeVideoWriting(repeatedDisplayedTitle, source)).toThrow(/whatHappened.*displayed title/i);
  });

  it("rejects explanation prose in the short issue title field", () => {
    const source = analysis();
    const proseTitle = writing(source);
    proseTitle.coachingItems[0].title = "Your elbow moves too high during the pull, which changes where the weight finishes.";

    expect(() => parseWholeVideoWriting(proseTitle, source)).toThrow(/title.*short label/i);
  });

  it("repairs a prose-like title locally without discarding valid writer coaching", () => {
    const source = analysis();
    source.issues[0].title = "Elbow path too high";
    const proseTitle = writing(source);
    proseTitle.coachingItems[0].title = "Your elbow moves too high during the pull, which changes where the weight finishes.";

    const normalized = normalizeWholeVideoWriting(proseTitle, source);

    expect(normalized.coachingItems[0].title).toBe("Elbow path too high");
    expect(normalized.coachingItems[0].whatHappenedDetail).toBe(proseTitle.coachingItems[0].whatHappenedDetail);
    expect(normalized.coachingItems.slice(1)).toEqual(proseTitle.coachingItems.slice(1));
  });

  it("calibrates numeric scores from validated issue impact instead of trusting arbitrary writer numbers", () => {
    const source = analysis();
    const finalWriting = writing(source);
    const candidate = boundaryFreeToCandidate(source, finalWriting);
    expect(candidate.movementScores?.map((item) => item.score)).toEqual([86, 96, 92, 96]);
    expect(candidate.score).toBe(93);
    expect(candidate.muscleFocus).toEqual(finalWriting.muscleFocus);
    expect(candidate.priorityCorrections[0].observedIssueRegions).toEqual(["elbows"]);
    expect(candidate.muscleFocus.primary[0].region).toBe("lats");
    expect(candidate.didWell).toEqual([]);
    expect(candidate.coachingCues).toEqual([]);
    expect(candidate.repTimeline).toEqual([]);
  });

  it("does not spend writer output on numeric scores that the app calculates locally", () => {
    const movementItem = (WHOLE_VIDEO_WRITING_SCHEMA as any).properties.movementScores.items;
    expect(movementItem.required).not.toContain("score");
    expect(movementItem.properties).not.toHaveProperty("score");
  });

  it("chooses real evidence moments that represent more of the video when issues provide alternatives", () => {
    const source = analysis(3);
    source.issues[0].evidence.push({ ...source.issues[0].evidence[0], startMs: 1_500, peakMs: 1_800, endMs: 2_100 });
    source.issues[1].evidence.push({ ...source.issues[1].evidence[0], startMs: 8_000, peakMs: 8_300, endMs: 8_600 });
    source.issues[2].evidence.push({ ...source.issues[2].evidence[0], startMs: 5_000, peakMs: 5_300, endMs: 5_600 });

    const candidate = boundaryFreeToCandidate(source, writing(source));

    expect(candidate.priorityCorrections.map((item) => item.primaryEvidenceIndex)).toEqual([0, 1, 1]);
    expect(candidate.priorityCorrections.map((item) => item.evidence[item.primaryEvidenceIndex!].peakMs)).toEqual([1_300, 8_300, 5_300]);
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
    const candidate = boundaryFreeToCandidate(source, writing(source), declaration);
    expect(candidate.setSummary).toMatchObject({ totalReps: 10, consistentReps: null });
    expect(candidate.repTimeline).toEqual([]);
  });

  it("instructs Flash Lite to write full simple coaching without forcing terse sentences", () => {
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toMatch(/use everyday gym language/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toMatch(/technical term.*explain.*plain language/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).not.toMatch(/short sentences/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toMatch(/exactly three natural, video-specific sentences.*whatHappenedDetail/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toMatch(/whatHappened heading.*what the camera shows/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toMatch(/headings.*must.*distinct.*issue title/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toMatch(/exactly three natural, exercise-specific sentences.*whyItMattersDetail/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toMatch(/do not calculate numeric scores.*app applies one consistent.*rubric locally/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toMatch(/declaration.*final issues/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).not.toMatch(/catalog/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toMatch(/observable mechanical consequences/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toMatch(/do not claim muscle activation.*diagnose an injury.*joint health/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toMatch(/do not introduce.*new fault.*hypothetical compensation/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toMatch(/do not substitute equipment names/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toMatch(/every supplied issue/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toMatch(/exercise technique knowledge.*specific.*correction/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toMatch(/pulling (?:exercise|movement).*elbow.*destination.*toward the hips.*when appropriate/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toMatch(/intended muscle stimulus/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toMatch(/do not claim.*diagnose.*injury/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toMatch(/cannot observe.*what the person feels/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).toMatch(/do not invent.*observed fault/i);
    expect(WHOLE_VIDEO_WRITER_SYSTEM_INSTRUCTION).not.toMatch(/sentence parser|truncate/i);
  });

});
