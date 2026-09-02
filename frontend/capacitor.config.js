/**
 * Capacitor Config - Wraps the React PWA as a native Android app.
 *
 * Notes for building APK on your local machine:
 * 1. Run: cd frontend && yarn install && yarn build (produces /build folder)
 * 2. npx cap add android         (first time only)
 * 3. npx cap sync android        (copy web assets to native project)
 * 4. npx cap open android        (opens Android Studio; Build > Build APK(s))
 *
 * See /app/MOBILE_APP.md for the full step-by-step guide.
 */
const config = {
  appId: 'id.makekal.bub',
  appName: 'BUB Makekal',
  webDir: 'build',
  bundledWebRuntime: false,
  server: {
    // Set to your deployed backend URL if using remote backend.
    // For pure local/offline build, leave 'url' undefined and set 'androidScheme' https to avoid mixed content.
    androidScheme: 'https',
    cleartext: true
  },
  android: {
    allowMixedContent: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#1E4620',
      androidSplashResourceName: 'splash',
      showSpinner: false
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1E4620'
    }
  }
};

module.exports = config;
