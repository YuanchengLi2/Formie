import { fireEvent, render } from "@testing-library/react-native";

import type { ReviewFrameGroups } from "@/features/analysis/review-frames";

import { CoachingReviewCarousel } from "./coaching-review-carousel";

const finding = { id: "finding", title: "Level shoulders" } as never;
const evidence = { startMs: 1_000, endMs: 1_500, visualEvidence: "Shoulders differ" } as never;
const frame = (id: string, purpose: "observed" | "why" | "next", timeMs: number) => ({ id, purpose, title: `${purpose} ${id}`, body: `Body ${id}`, findingId: "finding", finding, evidence, timeMs });

describe("CoachingReviewCarousel", () => {
  it("switches purposes, wraps frames, and exposes generous controls", async () => {
    const groups: ReviewFrameGroups = {
      observed: [frame("o1", "observed", 1_000), frame("o2", "observed", 2_000)],
      why: [frame("w1", "why", 1_000)],
      next: [frame("n1", "next", 1_000), frame("n2", "next", 2_000)],
    };
    const onSelectFrame = jest.fn();
    const screen = await render(<CoachingReviewCarousel groups={groups} onSelectFrame={onSelectFrame} />);

    expect(screen.getByText("What happened")).toBeTruthy();
    await fireEvent.press(screen.getByText("What to do next"));
    expect(screen.getByText("1 of 2")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Next review frame"));
    expect(onSelectFrame).toHaveBeenLastCalledWith(groups.next[1]);
    await fireEvent.press(screen.getByLabelText("Next review frame"));
    expect(onSelectFrame).toHaveBeenLastCalledWith(groups.next[0]);
    expect(screen.getByLabelText("Previous review frame")).toHaveStyle({ minWidth: 48, minHeight: 48 });
    await fireEvent.press(screen.getByLabelText("Select review frame 2"));
    expect(onSelectFrame).toHaveBeenLastCalledWith(groups.next[1]);
  });
});
