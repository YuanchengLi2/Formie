const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const config = getDefaultConfig(__dirname);

config.maxWorkers = 1;
if (process.platform === "win32") {
  config.resolver.useWatchman = Boolean(process.env.WATCHMAN_SOCK);
}
// metro-file-map converts Windows paths to POSIX separators before testing the
// watcher ignore pattern. Build a root expression that accepts both forms so
// large generated worktrees and the website are actually pruned.
const escapedProjectRoot = __dirname
  .split(path.sep)
  .map((segment) => segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("[\\\\/]");
const generatedWorkspaceRoots = new RegExp(`^${escapedProjectRoot}[\\\\/](?:\\.worktrees|\\.form-scaffold|\\.expo-export(?:-[^\\\\/]*)?|dist(?:-[^\\\\/]*)?|artifacts|tmp|website|\\.codex-runtime|\\.codex-tmp|\\.asset-pack-preview)(?:[\\\\/]|$)`);
config.resolver.blockList = [config.resolver.blockList, generatedWorkspaceRoots].flat();
config.resolver.assetExts.push("glb");

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "ios" || platform === "android") {
    if (moduleName === "three" || moduleName === "three/webgpu") {
      return { filePath: path.resolve(__dirname, "node_modules/three/build/three.webgpu.js"), type: "sourceFile" };
    }
    if (moduleName.startsWith("three/addons/")) {
      return { filePath: path.resolve(__dirname, "node_modules/three/examples/jsm", moduleName.slice("three/addons/".length)), type: "sourceFile" };
    }
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
