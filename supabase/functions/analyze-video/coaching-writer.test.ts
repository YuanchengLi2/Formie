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

    await expect(writeValidatedCoaching({ write, repair, parse, normalize: () => "normalized" })).resolves.toBe("clean");
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
      normalize: () => "normalized",
    })).resolves.toBe("clean");
    expect(repair).not.toHaveBeenCalled();
  });

  it("normalizes a still-invalid repair instead of failing finalization", async () => {
    const repair = jest.fn(async () => ({ copy: "still rough" }));
    const normalize = jest.fn(() => "safe coaching");
    await expect(writeValidatedCoaching({
      write: async () => ({ copy: "rough" }),
      repair,
      parse: () => { throw new Error("writer contract invalid"); },
      normalize,
    })).resolves.toBe("safe coaching");
    expect(repair).toHaveBeenCalledTimes(1);
    expect(normalize).toHaveBeenCalledWith({ copy: "still rough" });
  });

  it("normalizes saved analyst facts when the writer provider is unavailable", async () => {
    const normalize = jest.fn(() => "safe analyst coaching");
    await expect(writeValidatedCoaching({
      write: async () => { throw new Error("writer timed out"); },
      repair: async () => ({ copy: "unused" }),
      parse: () => { throw new Error("unused"); },
      normalize,
    })).resolves.toBe("safe analyst coaching");
    expect(normalize).toHaveBeenCalledWith(null);
  });

  it("normalizes the first writer response when the cleanup provider is unavailable", async () => {
    const normalize = jest.fn(() => "safe first response");
    const first = { copy: "rough" };
    await expect(writeValidatedCoaching({
      write: async () => first,
      repair: async () => { throw new Error("cleanup timed out"); },
      parse: () => { throw new Error("writer contract invalid"); },
      normalize,
    })).resolves.toBe("safe first response");
    expect(normalize).toHaveBeenCalledWith(first);
  });
});
