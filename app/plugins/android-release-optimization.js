const { withGradleProperties } = require('@expo/config-plugins');

function setGradleProperty(properties, key, value) {
  const existing = properties.find(
    (item) => item.type === 'property' && item.key === key,
  );
  if (existing) {
    existing.value = value;
    return;
  }
  properties.push({ type: 'property', key, value });
}

module.exports = function withAndroidReleaseOptimization(config) {
  return withGradleProperties(config, (config) => {
    // Expo's generated Android project reads these properties for release builds.
    // R8 removes unused Java/Kotlin bytecode and shrinkResources removes Android
    // resources which become unreachable after minification.
    setGradleProperty(
      config.modResults,
      'android.enableMinifyInReleaseBuilds',
      'true',
    );
    setGradleProperty(
      config.modResults,
      'android.enableShrinkResourcesInReleaseBuilds',
      'true',
    );
    return config;
  });
};
