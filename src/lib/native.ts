import { Capacitor } from '@capacitor/core'

// Outils pour l'app mobile (Android / iOS, via Capacitor). Sur le web, ils retombent sur le comportement du navigateur.
export const isNative = Capacitor.isNativePlatform()
export const platform = Capacitor.getPlatform() // 'web' | 'ios' | 'android'

// Adresse publique de la web app : sert aux liens « rejoindre » exportés et aux e-mails de connexion.
export const WEB_URL = 'https://beyondthetrack.github.io/beyond_events/app/'

// Enregistre un fichier (CSV, GPX) : téléchargement sur le web, feuille de partage sur mobile.
export async function saveFile(name: string, content: string, mime: string) {
  if (!isNative) {
    const url = URL.createObjectURL(new Blob([content], { type: mime }))
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    return
  }
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
  const { Share } = await import('@capacitor/share')
  const safe = name.replace(/[^\w.\-]+/g, '_')
  const res = await Filesystem.writeFile({ path: safe, data: content, directory: Directory.Cache, encoding: Encoding.UTF8 })
  await Share.share({ title: name, url: res.uri, dialogTitle: name })
}

// Réglages au démarrage de l'app mobile : barre d'état, bouton retour Android, écran de démarrage.
export async function initNative() {
  if (!isNative) return
  document.documentElement.classList.add('native', `native-${platform}`)
  const [{ StatusBar, Style }, { App }, { SplashScreen }] = await Promise.all([
    import('@capacitor/status-bar'), import('@capacitor/app'), import('@capacitor/splash-screen'),
  ])
  try { await StatusBar.setStyle({ style: Style.Dark }) } catch { /* indisponible */ }
  if (platform === 'android') {
    try { await StatusBar.setBackgroundColor({ color: '#0F1B2D' }) } catch { /* indisponible */ }
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack && window.location.hash && window.location.hash !== '#/') window.history.back()
      else App.exitApp()
    })
  }
  setTimeout(() => { SplashScreen.hide().catch(() => {}) }, 300)
}
