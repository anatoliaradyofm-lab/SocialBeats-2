const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
    /node_modules\/lightningcss-darwin-arm64/,
    /node_modules\/lightningcss-darwin-x64/,
    /node_modules\/lightningcss-linux-arm64-gnu/,
    /node_modules\/lightningcss-linux-arm64-musl/,
    /node_modules\/lightningcss-linux-x64-gnu/,
    /node_modules\/lightningcss-linux-x64-musl/,
    /node_modules\/lightningcss-win32-arm64-msvc/,
];

config.resolver.extraNodeModules = {
    'react-native-google-mobile-ads': path.resolve(__dirname, 'mockAds.js'),
};

module.exports = config;
