const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Requis par expo-sqlite sur web: SQLite est charge via un module WASM.
config.resolver.assetExts.push('wasm');

module.exports = config;
