const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Allows local LAN HTTP backend testing (e.g. http://192.168.x.x:4000) in preview APKs
 * while keeping HTTPS production URLs working seamlessly.
 */
module.exports = function withCleartextTraffic(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app && app.$) {
      app.$['android:usesCleartextTraffic'] = 'true';
    }
    return cfg;
  });
};
