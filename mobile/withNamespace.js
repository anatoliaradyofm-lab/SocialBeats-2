const { withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = function withNamespace(config) {
    return withProjectBuildGradle(config, config => {
        if (config.modResults.language === 'groovy') {
            config.modResults.contents += `
subprojects { subproject ->
    afterEvaluate {
        if((subproject.plugins.hasPlugin('android') || subproject.plugins.hasPlugin('com.android.library'))) {
            android {
                if (namespace == null) {
                    namespace subproject.group
                }
            }
        }
    }
}
`;
        }
        return config;
    });
};
