import type { CapacitorConfig } from '@capacitor/cli'

const liveReload = process.env.CAP_LIVE_RELOAD === '1'

const config: CapacitorConfig = {
  appId: 'com.arivusystems.arivu',
  appName: 'Arivu',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    ...(liveReload
      ? {
          url: process.env.CAP_DEV_SERVER_URL || 'http://10.0.2.2:5174',
          cleartext: true
        }
      : {})
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      launchFadeOutDuration: 200,
      backgroundColor: '#6049E7'
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
}

export default config
