import { executeProviderDeletion } from "./provider-deletion";

const dependencies = () => ({ revokeApple: jest.fn(async () => undefined), deleteGeminiFile: jest.fn(async () => undefined), deleteRevenueCatCustomer: jest.fn(async () => undefined) });

it("dispatches only the exact provider operation and validates its secret payload", async () => {
  const deps = dependencies();
  await executeProviderDeletion({ provider: "apple", operation: "revoke_authorization", payload: { refreshToken: "token" } }, deps);
  expect(deps.revokeApple).toHaveBeenCalledWith("token");
  expect(deps.deleteGeminiFile).not.toHaveBeenCalled();
  await expect(executeProviderDeletion({ provider: "gemini", operation: "delete_file", payload: {} }, deps)).rejects.toMatchObject({ code: "INVALID_DELETION_PAYLOAD", transient: false });
});

it("classifies rate limits and provider outages as transient without leaking payloads", async () => {
  const deps = dependencies();
  deps.deleteGeminiFile.mockRejectedValue(Object.assign(new Error("private file failed"), { httpStatus: 503 }));
  await expect(executeProviderDeletion({ provider: "gemini", operation: "delete_file", payload: { fileName: "files/private" } }, deps)).rejects.toMatchObject({ code: "HTTP_503", transient: true });
});
