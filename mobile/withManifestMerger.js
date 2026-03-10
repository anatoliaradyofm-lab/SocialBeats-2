const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withManifestMerger(config) {
    return withAndroidManifest(config, (config) => {
        const manifest = config.modResults.manifest;

        if (!manifest.$) manifest.$ = {};
        manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

        // 1) Application Node çakışmaları
        const app = manifest.application[0];
        if (app) {
            if (!app.$) app.$ = {};

            const replaceProps = [
                'android:allowBackup',
                'android:theme',
                'android:label',
                'android:icon',
                'android:roundIcon',
                'android:name',
                'android:appComponentFactory',
                'android:supportsRtl'
            ];

            const currentReplace = app.$['tools:replace'] || '';
            let toAdd = [];

            replaceProps.forEach(prop => {
                if (app.$[prop] && !currentReplace.includes(prop)) {
                    toAdd.push(prop);
                }
            });

            if (toAdd.length > 0) {
                if (currentReplace) {
                    app.$['tools:replace'] = `${currentReplace},${toAdd.join(',')}`;
                } else {
                    app.$['tools:replace'] = toAdd.join(',');
                }
            }
        }

        // 2) Ses ve İletişim çakışmaları (Örn: react-native-voice ve diğer paketler)
        if (!manifest['uses-sdk']) {
            manifest['uses-sdk'] = [{}];
        }
        const usesSdk = manifest['uses-sdk'][0];
        if (!usesSdk.$) usesSdk.$ = {};
        usesSdk.$['tools:overrideLibrary'] = "com.facebook.react,com.wenkesj.voice,com.google.android.gms.ads";

        // 3) Receiver çakışmalarını izole edelim
        if (app.receiver) {
            app.receiver.forEach(recv => {
                if (!recv.$) recv.$ = {};
                recv.$['tools:node'] = "merge";
            });
        }

        return config;
    });
};
