import { exactFrameUploadPaths } from "./exact-frame-requests";

describe("exact frame upload paths", () => {
  it("enumerates every preallocated frame slot for cleanup", () => {
    const paths = exactFrameUploadPaths("user-1", "session-1");

    expect(paths).toHaveLength(25);
    expect(paths[0]).toBe("user-1/session-1/exact-frames/00.jpg");
    expect(paths[24]).toBe("user-1/session-1/exact-frames/24.jpg");
  });
});
