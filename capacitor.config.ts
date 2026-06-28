import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.finfree.app',
  appName: 'FinFree',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#02050e',
      showSpinner: false,
    },
    Preferences: {
      group: 'finfree',
    },
  },
  server: {
    // In development, point to local dev server; in production, use bundled assets
    androidScheme: 'https',
  },
};

export default config;
