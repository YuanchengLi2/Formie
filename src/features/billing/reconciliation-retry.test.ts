import { reconcileUntil, reconcileWithDeadline } from "./reconciliation-retry";

describe("reconcileUntil", () => {
  it("retries bounded provider propagation until the expected server state appears", async () => {
    const operation = jest.fn().mockResolvedValueOnce("expired").mockResolvedValueOnce("renewal_pending").mockResolvedValueOnce("active");
    const wait = jest.fn().mockResolvedValue(undefined);
    await expect(reconcileUntil(operation, (value) => value === "active", [0, 10, 20], wait)).resolves.toBe("active");
    expect(operation).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it("returns the final confirmed snapshot after exhausting the bounded attempts", async () => {
    const operation = jest.fn().mockResolvedValue("expired");
    await expect(reconcileUntil(operation, (value) => value === "active", [0, 1], async () => undefined)).resolves.toBe("expired");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("allows the server snapshot enough time to catch up after a completed store purchase", async () => {
    const operation = jest.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const wait = jest.fn().mockResolvedValue(undefined);

    await expect(reconcileUntil<boolean>(operation, (value) => value, undefined, wait)).resolves.toBe(true);
    expect(operation).toHaveBeenCalledTimes(5);
    expect(wait).toHaveBeenCalledTimes(4);
  });
});

describe("reconcileWithDeadline", () => {
  it("returns the last snapshot and a terminal flag after bounded retries", async () => {
    const operation = jest.fn().mockResolvedValue("checking");
    const result = await reconcileWithDeadline(operation, (value) => value === "active", [0, 10], async () => undefined);
    expect(result).toEqual({ value: "checking", satisfied: false, attempts: 2 });
  });

  it("keeps purchase confirmation open long enough for provider propagation", async () => {
    const operation = jest.fn().mockResolvedValue("checking");
    const wait = jest.fn().mockResolvedValue(undefined);
    const result = await reconcileWithDeadline(operation, (value) => value === "active", undefined, wait);

    expect(result.attempts).toBe(6);
    expect(wait).toHaveBeenCalledTimes(5);
  });
});
