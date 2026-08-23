const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const config = getDefaultConfig(__dirname);

config.maxWorkers = 1;
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
