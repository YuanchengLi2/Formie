import { writeValidatedCoaching } from "./coaching-writer";

describe("validated coaching writer", () => {
  it("repairs rejected coaching once without rerunning video analysis", async () => {
    const write = jest.fn(async () => ({ copy: "rough" }));
    const repair = jest.fn(async () => ({ copy: "clean" }));
    const parse = jest.fn((value: unknown) => {
      const copy = (value as { copy?: string }).copy;
      if (copy !== "clean") throw new Error("unsupported coaching language");
      return copy;
    });

    await expect(writeValidatedCoaching({ write, repair, parse })).resolves.toBe("clean");
    expect(write).toHaveBeenCalledTimes(1);
    expect(repair).toHaveBeenCalledWith({ rejected: { copy: "rough" }, validationError: expect.any(Error) });
    expect(repair).toHaveBeenCalledTimes(1);
  });

  it("does not call repair when the first writer response is valid", async () => {
    const repair = jest.fn(async () => ({ copy: "unused" }));
    await expect(writeValidatedCoaching({
      write: async () => ({ copy: "clean" }),
      repair,
      parse: (value) => (value as { copy: string }).copy,
    })).resolves.toBe("clean");
    expect(repair).not.toHaveBeenCalled();
  });

  it("surfaces a second invalid response so durable finalization retry can take over", async () => {
    await expect(writeValidatedCoaching({
      write: async () => ({ copy: "rough" }),
      repair: async () => ({ copy: "still rough" }),
      parse: () => { throw new Error("writer contract invalid"); },
    })).rejects.toThrow("writer contract invalid");
  });
});
