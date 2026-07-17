const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const images = path.join(root, "assets", "images");

function pngSize(filePath) {
  const data = fs.readFileSync(filePath);
  expect(data.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

describe("FORM brand assets", () => {
  it("keeps the supplied logo as the versioned source of truth", () => {
    const source = fs.readFileSync(path.join(images, "form-logo-source.png"));
    expect(crypto.createHash("sha256").update(source).digest("hex")).toBe("9f4a57771509db66b4b1aaa668c77f66967a772d103089bcee9a9aa62294bc64");
    expect(pngSize(path.join(images, "form-logo-source.png"))).toEqual({ width: 1254, height: 1254 });
  });

  it.each([
    ["icon.png", 1024],
    ["splash-icon.png", 512],
    ["android-icon-foreground.png", 1024],
    ["android-icon-background.png", 1024],
    ["android-icon-monochrome.png", 432],
    ["favicon.png", 64],
    ["form-logo-mark.png", 256],
  ])("renders %s at the required square size", (name, size) => {
    const assetPath = path.join(images, name);
    expect(pngSize(assetPath)).toEqual({ width: size, height: size });
    if (!["android-icon-background.png", "android-icon-monochrome.png"].includes(name)) {
      expect(fs.statSync(assetPath).size).toBeGreaterThan(size * 20);
    }
  });

  it("keeps Expo pointed at the generated platform assets", () => {
    const config = require(path.join(root, "app.json")).expo;
    expect(config.icon).toBe("./assets/images/icon.png");
    expect(config.android.adaptiveIcon).toEqual(expect.objectContaining({
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    }));
    expect(config.web.favicon).toBe("./assets/images/favicon.png");
    expect(config.plugins).toContainEqual(expect.arrayContaining(["expo-splash-screen", expect.objectContaining({ image: "./assets/images/splash-icon.png" })]));
  });
});
