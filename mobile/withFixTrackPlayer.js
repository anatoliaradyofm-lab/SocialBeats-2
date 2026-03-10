const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withFixTrackPlayer(config) {
    return withAppBuildGradle(config, (config) => {
        if (config.modResults.language === 'groovy') {
            const buildGradle = config.modResults.contents;
            if (!buildGradle.includes('missingDimensionStrategy')) {
                config.modResults.contents = buildGradle.replace(
                    /defaultConfig\s*{/,
                    `defaultConfig {
        missingDimensionStrategy 'react-native-camera', 'general'`
                );
            }
        }
        return config;
    });
};
