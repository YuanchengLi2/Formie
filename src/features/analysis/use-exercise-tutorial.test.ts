import { useExerciseTutorial } from "./use-exercise-tutorial";

const mockUseQuery = jest.fn((options: unknown) => options);

jest.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => mockUseQuery(options),
}));
jest.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: jest.fn() } },
}));
jest.mock("./api", () => ({ getExerciseTutorial: jest.fn() }));

describe("useExerciseTutorial", () => {
  it("revalidates through the server whenever a saved result is reopened", () => {
    useExerciseTutorial("session-1", true);

    expect(mockUseQuery).toHaveBeenCalledWith(expect.objectContaining({
      queryKey: ["exercise-tutorial", "session-1"],
      enabled: true,
      staleTime: 0,
      refetchOnMount: "always",
    }));
  });
});
