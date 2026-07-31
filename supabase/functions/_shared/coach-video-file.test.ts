import { ensureCoachVideoFile } from "./coach-video-file";

const session = {
  id: "11111111-1111-4111-8111-111111111111",
  videoPath: "user/session/original.mp4",
  geminiFileName: "files/expired",
  geminiFileUri: "gemini://expired",
  geminiFileState: "ACTIVE" as const,
};

describe("coach video file cache", () => {
  it("refreshes an active session file before reusing it", async () => {
    const getFile = jest.fn(async () => ({ name: "files/current", uri: "gemini://current", mimeType: "video/mp4", state: "ACTIVE" as const }));
    const uploadSessionVideo = jest.fn();
    const saveSessionFile = jest.fn(async () => undefined);
    await expect(ensureCoachVideoFile(session, { getFile, uploadSessionVideo, saveSessionFile, wait: async () => undefined })).resolves.toMatchObject({ name: "files/current" });
    expect(getFile).toHaveBeenCalledWith("files/expired");
    expect(uploadSessionVideo).not.toHaveBeenCalled();
  });

  it("reuploads the private original after the cached Gemini file expires", async () => {
    const getFile = jest.fn(async () => { throw new Error("Gemini file status failed: 404"); });
    const uploaded = { name: "files/new", uri: "gemini://new", mimeType: "video/mp4", state: "ACTIVE" as const };
    const uploadSessionVideo = jest.fn(async () => uploaded);
    const saveSessionFile = jest.fn(async () => undefined);
    await expect(ensureCoachVideoFile(session, { getFile, uploadSessionVideo, saveSessionFile, wait: async () => undefined })).resolves.toEqual(uploaded);
    expect(uploadSessionVideo).toHaveBeenCalledWith(session);
    expect(saveSessionFile).toHaveBeenCalledWith(session.id, uploaded);
  });

  it("polls a processing upload and rejects a failed file", async () => {
    const processing = { ...session, geminiFileName: null, geminiFileUri: null, geminiFileState: null };
    const uploadSessionVideo = jest.fn(async () => ({ name: "files/new", uri: "gemini://new", mimeType: "video/mp4", state: "PROCESSING" as const }));
    const getFile = jest.fn()
      .mockResolvedValueOnce({ name: "files/new", uri: "gemini://new", mimeType: "video/mp4", state: "PROCESSING" })
      .mockResolvedValueOnce({ name: "files/new", uri: "gemini://new", mimeType: "video/mp4", state: "ACTIVE" });
    await expect(ensureCoachVideoFile(processing, { getFile, uploadSessionVideo, saveSessionFile: async () => undefined, wait: async () => undefined })).resolves.toMatchObject({ state: "ACTIVE" });
    const failedUpload = jest.fn(async () => ({ name: "files/bad", uri: "gemini://bad", mimeType: "video/mp4", state: "FAILED" as const }));
    await expect(ensureCoachVideoFile(processing, { getFile: jest.fn(), uploadSessionVideo: failedUpload, saveSessionFile: async () => undefined, wait: async () => undefined })).rejects.toThrow(/processing failed/i);
  });

  it("persists a new processing upload before waiting and keeps polling beyond the old short window", async () => {
    const processing = { ...session, geminiFileName: null, geminiFileUri: null, geminiFileState: null };
    const pending = { name: "files/slow", uri: "gemini://slow", mimeType: "video/mp4", state: "PROCESSING" as const };
    const active = { ...pending, state: "ACTIVE" as const };
    const uploadSessionVideo = jest.fn(async () => pending);
    const getFile = jest.fn()
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(active);
    const saveSessionFile = jest.fn(async () => undefined);
    const wait = jest.fn(async () => undefined);

    await expect(ensureCoachVideoFile(processing, { getFile, uploadSessionVideo, saveSessionFile, wait })).resolves.toEqual(active);
    expect(uploadSessionVideo).toHaveBeenCalledTimes(1);
    expect(saveSessionFile.mock.calls[0]).toEqual([processing.id, pending]);
    expect(saveSessionFile.mock.calls.at(-1)).toEqual([processing.id, active]);
    expect(wait).toHaveBeenCalledWith(30_000);
  });
});
