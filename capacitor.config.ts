import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'fr.beyondthetrack.events',
  appName: 'Beyond Events',
  webDir: 'dist',
  backgroundColor: '#0F1B2D',
  plugins: {
    SplashScreen: { launchShowDuration: 900, backgroundColor: '#0F1B2D', showSpinner: false },
    StatusBar: { style: 'DARK', backgroundColor: '#0F1B2D', overlaysWebView: false },
  },
  ios: { contentInset: 'never' },
  android: { allowMixedContent: false },
}

export default config
