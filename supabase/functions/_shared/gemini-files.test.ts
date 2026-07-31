import { createGeminiFilesClient } from "./gemini-files";

describe("Gemini Files client", () => {
  it("uploads, polls, and deletes a video without analysis behavior", async () => {
    const fetcher = jest.fn()
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { "x-goog-upload-url": "https://upload.example/file" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ file: { name: "files/one", uri: "https://files.example/one", mimeType: "video/mp4", state: "ACTIVE" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ name: "files/one", uri: "https://files.example/one", mimeType: "video/mp4", state: "ACTIVE" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = createGeminiFilesClient({ apiKey: "secret", fetcher });
    const file = await client.uploadVideo({ body: new Uint8Array([1]), contentLength: 1, mimeType: "video/mp4", displayName: "set.mp4" });
    await expect(client.getFile(file.name)).resolves.toEqual(file);
    await expect(client.deleteFile(file.name)).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
});
