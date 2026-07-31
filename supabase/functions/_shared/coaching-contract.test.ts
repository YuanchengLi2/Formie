import { enforceCorrectionCoaching } from "./coaching-contract";

function sentenceCount(value: string): number {
  return value.match(/[^.!?]+[.!?]+(?:["'”’)]*)|[^.!?]+$/g)?.filter((sentence) => sentence.trim()).length ?? 0;
}

function displayedSentenceCount(finding: ReturnType<typeof rowFinding>): number {
  return [
    finding.detail,
    finding.whyItMatters,
    finding.actionableCorrection?.instruction,
    finding.actionableCorrection?.successCheck,
  ].filter((value): value is string => Boolean(value)).reduce((total, value) => total + sentenceCount(value), 0);
}

function rowFinding() {
  return {
    id: "corr-path",
    title: "Pull path trajectory",
    detail: "The dumbbell travels straight upward toward the chest instead of sweeping back toward the hip.",
    whyItMatters: "Pulling straight up limits your back leverage and shifts the path into your upper shoulder area.",
    correction: "Guide the dumbbell back toward your hip.",
    cue: "Sweep toward the hip.",
    actionableCorrection: {
      instruction: "Guide the dumbbell back toward your hip in a sweeping arc.",
      cue: "Sweep toward the hip.",
      successCheck: "Your dumbbell finishes near your hip with your forearm angled slightly backward.",
      applyWhen: "During the pull.",
    },
    evidence: [{
      startMs: 6_000,
      peakMs: 6_400,
      endMs: 6_800,
      repNumber: 3,
      phase: "top",
      visualEvidence: "The dumbbell finishes near the chest on rep 3.",
      visibleBodyAreas: ["dumbbell", "elbow", "torso"],
      confidence: 0.94,
    }],
  };
}

describe("enforceCorrectionCoaching", () => {
  it("turns unsupported row explanations into four direct evidence-grounded coaching sentences", () => {
    const result = enforceCorrectionCoaching(rowFinding());
    const combined = [
      result.detail,
      result.whyItMatters,
      result.actionableCorrection?.instruction,
      result.actionableCorrection?.successCheck,
    ].join(" ");

    expect(result.detail).toMatch(/rep 3|top/i);
    expect(result.whyItMatters).toMatch(/path|range|control|stability|repeat/i);
    expect(combined).not.toMatch(/leverage|muscle|trap|joint|strain|stress|involvement|bar path/i);
    expect(result.actionableCorrection?.instruction).toMatch(/^(Keep|Guide|Move|Pull|Lower|Raise|Press|Start|Hold|Control)\b/);
    expect(displayedSentenceCount(result)).toBe(4);
  });

  it("reduces a legacy multi-sentence observation to one sentence and keeps the issue at four total", () => {
    const result = enforceCorrectionCoaching({
      ...rowFinding(),
      detail: "During the lowering phase, your elbows drift outward. This happens consistently across the set.",
      evidence: [{ ...rowFinding().evidence[0], phase: "eccentric", repNumber: 1 }],
    });

    expect(sentenceCount(result.detail)).toBe(1);
    expect(result.detail).toContain("During the lowering phase");
    expect(displayedSentenceCount(result)).toBe(4);
  });

  it("replaces a descriptive next step with an imperative instruction", () => {
    const result = enforceCorrectionCoaching({
      ...rowFinding(),
      actionableCorrection: {
        ...rowFinding().actionableCorrection,
        instruction: "Your elbow position should stay steady.",
      },
    });

    expect(result.actionableCorrection?.instruction).toMatch(/^[A-Z][a-z]+\b/);
    expect(result.actionableCorrection?.instruction).not.toMatch(/^Your\b/);
    expect(displayedSentenceCount(result)).toBe(4);
  });

  it("capitalizes a valid imperative clause returned in lowercase", () => {
    const result = enforceCorrectionCoaching({
      ...rowFinding(),
      actionableCorrection: {
        ...rowFinding().actionableCorrection,
        instruction: "lock your upper arms in place and move only at the elbow joint.",
      },
    });

    expect(result.actionableCorrection?.instruction).toBe("Lock your upper arms in place.");
    expect(displayedSentenceCount(result)).toBe(4);
  });

  it("adds a distinct visible success check when the writer omits one", () => {
    const result = enforceCorrectionCoaching({
      ...rowFinding(),
      actionableCorrection: {
        ...rowFinding().actionableCorrection,
        successCheck: null,
      },
    });

    expect(result.actionableCorrection?.successCheck).toMatch(/[.!?]$/);
    expect(result.actionableCorrection?.successCheck).not.toBe(result.actionableCorrection?.instruction);
    expect(displayedSentenceCount(result)).toBe(4);
  });

  it("builds personalized tab copy when historical coaching has no expanded sections", () => {
    const result = enforceCorrectionCoaching(rowFinding());
    const whatHappened = result.expandedCoaching?.whatHappened ?? "";
    const whyItMatters = result.expandedCoaching?.whyItMatters ?? "";

    expect(whatHappened).toMatch(/rep 3/i);
    expect(sentenceCount(whatHappened)).toBeGreaterThanOrEqual(3);
    expect(sentenceCount(whatHappened)).toBeLessThanOrEqual(4);
    expect(sentenceCount(whyItMatters)).toBeGreaterThanOrEqual(2);
    expect(result.expandedCoaching?.whatToDo).toBe(result.actionableCorrection?.instruction);
    expect(result.expandedCoaching?.successCheck).toBe(result.actionableCorrection?.successCheck);
  });

  it("keeps primary video evidence when the writer returns four generic observation sentences", () => {
    const result = enforceCorrectionCoaching({
      ...rowFinding(),
      expandedCoaching: {
        summary: "The path changes.",
        whatHappened: "The path changes. The finish moves. The position differs. The movement becomes uneven.",
        whyItMatters: "A changing path is harder to repeat.",
        whatToDo: "Guide the dumbbell toward your hip.",
        successCheck: "The dumbbell finishes beside your hip.",
      },
    });

    expect(result.expandedCoaching?.whatHappened).toMatch(/rep 3|top/i);
    expect(sentenceCount(result.expandedCoaching?.whatHappened ?? "")).toBeGreaterThanOrEqual(3);
    expect(sentenceCount(result.expandedCoaching?.whatHappened ?? "")).toBeLessThanOrEqual(4);
  });

  it("replaces a hidden-body success claim with a visible check", () => {
    const result = enforceCorrectionCoaching({
      ...rowFinding(),
      expandedCoaching: {
        summary: "The path changes.",
        whatHappened: "The dumbbell finishes near the chest on rep 3. The elbow ends beside the ribs. The path stays vertical.",
        whyItMatters: "That path is harder to repeat.",
        whatToDo: "Guide the dumbbell toward your hip.",
        successCheck: "You feel your lat activate.",
      },
    });

    expect(result.expandedCoaching?.successCheck).not.toMatch(/feel|activate/i);
    expect(result.expandedCoaching?.successCheck).toMatch(/visible|path|position|rep|weight|dumbbell|forearm|hip/i);
  });

  it("keeps compliant legacy fields while adding tab-specific coaching", () => {
    const compliant = {
      ...rowFinding(),
      detail: "During the top of rep 3, the dumbbell finishes beside the chest instead of beside the hip.",
      whyItMatters: "That makes the dumbbell path less repeatable from rep to rep.",
    };

    const result = enforceCorrectionCoaching(compliant);

    expect(result).toMatchObject({
      detail: compliant.detail,
      whyItMatters: compliant.whyItMatters,
      correction: compliant.correction,
      actionableCorrection: compliant.actionableCorrection,
    });
    expect(result.expandedCoaching?.whatHappened).toMatch(/rep 3/i);
  });

  it("uses the selected primary evidence when adding the issue timing", () => {
    const result = enforceCorrectionCoaching({
      ...rowFinding(),
      primaryEvidenceIndex: 1,
      evidence: [
        { ...rowFinding().evidence[0], repNumber: 1, phase: "concentric" },
        { ...rowFinding().evidence[0], repNumber: 4, phase: "top", peakMs: 10_400 },
      ],
    });

    expect(result.detail).toMatch(/top of rep 4/i);
    expect(result.detail).not.toMatch(/rep 1/i);
  });

  it("uses plain phase grammar for lifting and lowering evidence", () => {
    const result = enforceCorrectionCoaching({
      ...rowFinding(),
      evidence: [{ ...rowFinding().evidence[0], repNumber: 2, phase: "concentric" }],
    });

    expect(result.detail).toContain("during the lifting part of rep 2");
    expect(result.detail).not.toContain("concentric");
  });

  it("keeps a safe imperative clause when a second clause contains an unsupported mechanism", () => {
    const result = enforceCorrectionCoaching({
      ...rowFinding(),
      actionableCorrection: {
        ...rowFinding().actionableCorrection,
        instruction: "Keep your upper arms fixed in place and move only at the elbow joint.",
      },
    });

    expect(result.actionableCorrection?.instruction).toBe("Keep your upper arms fixed in place.");
  });

  it("replaces vague posture explanations with a visible stability consequence", () => {
    const result = enforceCorrectionCoaching({
      ...rowFinding(),
      title: "Head position",
      detail: "Your head tilts upward as the dumbbell reaches the top.",
      whyItMatters: "Extending your neck creates an uneven spine position and disrupts your back posture.",
      evidence: [{
        ...rowFinding().evidence[0],
        visualEvidence: "The head tilts upward at the top of rep 3.",
        visibleBodyAreas: ["head", "neck", "torso"],
      }],
    });

    expect(result.whyItMatters).toBe("That makes your position less steady and harder to repeat.");
  });

  it("falls back to everyday coaching when legacy copy contains biomechanics jargon", () => {
    const result = enforceCorrectionCoaching({
      ...rowFinding(),
      title: "Scapular kinematics",
      detail: "Thoracic extension increases during the concentric phase.",
      whyItMatters: "The altered center of mass changes the implement trajectory.",
      correction: "Maintain scapular retraction during the concentric phase.",
      actionableCorrection: {
        instruction: "Maintain scapular retraction during the concentric phase.",
        cue: "Retract the scapula.",
        successCheck: "The implement trajectory remains consistent.",
        applyWhen: "During the concentric phase.",
      },
      evidence: [{
        ...rowFinding().evidence[0],
        phase: "concentric",
        visualEvidence: "The chest rises as the dumbbell reaches the top of rep 3.",
      }],
    });
    const userFacing = [
      result.detail,
      result.whyItMatters,
      result.correction,
      result.expandedCoaching?.whatHappened,
      result.expandedCoaching?.whyItMatters,
      result.expandedCoaching?.whatToDo,
      result.expandedCoaching?.successCheck,
    ].filter(Boolean).join(" ");

    expect(userFacing).toContain("chest");
    expect(userFacing).toContain("dumbbell");
    expect(userFacing).not.toMatch(/biomechan|center of mass|concentric|eccentric|implement|kinematic|scapul|thoracic|trajectory|lockout|reversal|cited/i);
  });
});
