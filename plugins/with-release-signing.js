// Expo config plugin: wires release signing into android/app/build.gradle so
// `expo prebuild --clean` never loses it. No secrets are written to the repo:
// the generated Gradle code loads a keystore.properties file at build time from
//   $RELEASE_KEYSTORE_PROPERTIES  (env; no machine-specific path is committed)  or the optional plugin `propertiesPath` option
// (a leading ~ is expanded). Keys are matched by suffix, case/underscore-insensitive:
//   ...storeFile, ...storePassword, ...keyAlias, ...keyPassword
// e.g. storeFile=... or URBAN_UPLOAD_STORE_FILE=... both work.
// If no complete keystore config is found, any release build (assemble/bundle/package ...Release) FAILS
// with a clear error; it never falls back to debug signing. Debug builds are unaffected.
// EAS cloud builds (EAS_BUILD=true) are exempt because EAS injects its own managed signing credentials.
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
}
def releaseSigningGet = { String suffix ->
    def e = releaseSigningProps.find { k, v -> k.toString().replace('_', '').toLowerCase().endsWith(suffix) }
    return e?.value?.toString()
}
def releaseSigningStoreFile = null
if (releaseSigningGet('storefile') != null) {
    def sfPath = releaseSigningGet('storefile')
    if (sfPath.startsWith('~')) sfPath = System.getProperty('user.home') + sfPath.substring(1)
    releaseSigningStoreFile = new File(sfPath).isAbsolute() ? new File(sfPath) : new File(releaseSigningFile != null ? releaseSigningFile.parentFile : rootDir, sfPath)
}
def releaseSigningReady = releaseSigningStoreFile != null && releaseSigningStoreFile.exists() &&
    releaseSigningGet('storepassword') && releaseSigningGet('keyalias') && releaseSigningGet('keypassword')
def releaseSigningManaged = System.getenv('EAS_BUILD') == 'true'
gradle.taskGraph.whenReady { graph ->
    if (!releaseSigningReady && !releaseSigningManaged &&
        graph.allTasks.any { it.name ==~ /(?i)(assemble|bundle|package|sign|validateSigning)\\w*release\\w*/ }) {
        throw new GradleException("with-release-signing: release keystore missing or incomplete (looked at: " + releaseSigningPath +
            "). Set RELEASE_KEYSTORE_PROPERTIES or the plugin propertiesPath to a keystore.properties containing storeFile, storePassword, keyAlias, keyPassword. Refusing to sign a release with the debug key.")
    }
}
`;
    g = g.replace(/\nandroid\s*\{/, `${loader}\nandroid {`);
    // add a release signingConfig next to debug
    g = g.replace(/signingConfigs\s*\{/, `signingConfigs {
        release {
            if (releaseSigningReady) {
                storeFile releaseSigningStoreFile
                storePassword releaseSigningGet('storepassword')
                keyAlias releaseSigningGet('keyalias')
                keyPassword releaseSigningGet('keypassword')
            }
        }`);
    // point the release buildType at it
    g = g.replace(/(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/,
      '$1signingConfig signingConfigs.release');
    cfg.modResults.contents = g;
    return cfg;
  });
};
