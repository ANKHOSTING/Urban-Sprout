// Expo config plugin: wires release signing into android/app/build.gradle so
// `expo prebuild --clean` never loses it. No secrets are written to the repo:
// the generated Gradle code loads a keystore.properties file at build time from
//   $RELEASE_KEYSTORE_PROPERTIES  (env, preferred)  or  the plugin's `propertiesPath` option
// (a leading ~ is expanded). Keys are matched by suffix, case/underscore-insensitive:
//   ...storeFile, ...storePassword, ...keyAlias, ...keyPassword
// e.g. storeFile=... or URBAN_UPLOAD_STORE_FILE=... both work.
// If no file is found, the release build falls back to debug signing (with a warning).
const { withAppBuildGradle } = require('@expo/config-plugins');

const MARK = '// @with-release-signing';

module.exports = function withReleaseSigning(config, props = {}) {
  const defPath = props.propertiesPath || '';
  return withAppBuildGradle(config, (cfg) => {
    let g = cfg.modResults.contents;
    if (g.includes(MARK)) return cfg;
    const loader = `
${MARK}
def releaseSigningProps = new Properties()
def releaseSigningPath = System.getenv('RELEASE_KEYSTORE_PROPERTIES') ?: '${defPath}'
if (releaseSigningPath.startsWith('~')) releaseSigningPath = System.getProperty('user.home') + releaseSigningPath.substring(1)
def releaseSigningFile = releaseSigningPath ? new File(releaseSigningPath) : null
if (releaseSigningFile != null && releaseSigningFile.exists()) {
    releaseSigningFile.withInputStream { releaseSigningProps.load(it) }
} else {
    logger.warn("with-release-signing: no keystore.properties found; release uses debug signing")
}
def releaseSigningGet = { String suffix ->
    def e = releaseSigningProps.find { k, v -> k.toString().replace('_', '').toLowerCase().endsWith(suffix) }
    return e?.value?.toString()
}
def releaseSigningReady = releaseSigningGet('storefile') != null
`;
    g = g.replace(/\nandroid\s*\{/, `${loader}\nandroid {`);
    // add a release signingConfig next to debug
    g = g.replace(/signingConfigs\s*\{/, `signingConfigs {
        release {
            if (releaseSigningReady) {
                def sf = releaseSigningGet('storefile')
                if (sf.startsWith('~')) sf = System.getProperty('user.home') + sf.substring(1)
                storeFile new File(sf).isAbsolute() ? new File(sf) : file(sf)
                storePassword releaseSigningGet('storepassword')
                keyAlias releaseSigningGet('keyalias')
                keyPassword releaseSigningGet('keypassword')
            }
        }`);
    // point the release buildType at it
    g = g.replace(/(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/,
      '$1signingConfig releaseSigningReady ? signingConfigs.release : signingConfigs.debug');
    cfg.modResults.contents = g;
    return cfg;
  });
};
