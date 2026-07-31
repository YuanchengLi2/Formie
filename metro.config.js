const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.maxWorkers = 1;
config.resolver.assetExts.push("glb");

module.exports = config;
