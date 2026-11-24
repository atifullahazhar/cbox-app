/**
 * Optional Capacitor configuration for wrapping the built Cbox frontend (dist/)
 * into a native Android package (APK/AAB) in the future.
 * Note: Cbox ships as an installable Progressive Web App (PWA) by default;
 * a PWA is NOT a Play Store APK. See docs/PWA_AND_CAPACITOR.md for setup steps.
 */
const config = {
  appId: 'app.cbox.social',
  appName: 'Cbox',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
