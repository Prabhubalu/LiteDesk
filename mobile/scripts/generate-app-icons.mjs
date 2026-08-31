import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const repoRoot = path.resolve(root, '..')

const BRAND_BG = '#6049E7'
const LIGHT_BG = '#FFFFFF'
/** client/public/assets/logo — wordmark paths (418×550). */
const LOGO_LIGHT_SVG = path.join(repoRoot, 'client/public/assets/logo/Logo_light.svg')
const LOGO_DARK_SVG = path.join(repoRoot, 'client/public/assets/logo/Logo_dark.svg')
const LOGO_ASPECT = 418 / 550

const ANDROID_FOREGROUND_SIZES = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432
}

const ANDROID_LAUNCHER_SIZES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192
}

const ANDROID_SPLASH_PORTRAIT = {
  'drawable-port-mdpi': [320, 480],
  'drawable-port-hdpi': [480, 800],
  'drawable-port-xhdpi': [720, 1280],
  'drawable-port-xxhdpi': [1080, 1920],
  'drawable-port-xxxhdpi': [1280, 1920]
}

const ANDROID_SPLASH_LANDSCAPE = {
  'drawable-land-mdpi': [480, 320],
  'drawable-land-hdpi': [800, 480],
  'drawable-land-xhdpi': [1280, 720],
  'drawable-land-xxhdpi': [1920, 1080],
  'drawable-land-xxxhdpi': [1920, 1280]
}

const ICON_LOGO_SCALE = 0.74
const SPLASH_LOGO_SCALE = 0.42

async function renderLogo(size, logoSvg, { background = null, logoScale = ICON_LOGO_SCALE } = {}) {
  const maxHeight = Math.round(size * logoScale)
  const maxWidth = Math.round(maxHeight * LOGO_ASPECT)
  const logo = await sharp(logoSvg).resize(maxWidth, maxHeight, { fit: 'inside' }).png().toBuffer()
  const { width = maxWidth, height = maxHeight } = await sharp(logo).metadata()

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: background || { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: logo, top: Math.round((size - height) / 2), left: Math.round((size - width) / 2) }])
    .png()
}

async function renderSplash(width, height, logoSvg, { background = BRAND_BG, logoScale = SPLASH_LOGO_SCALE } = {}) {
  const base = Math.min(width, height)
  const maxHeight = Math.round(base * logoScale)
  const maxWidth = Math.round(maxHeight * LOGO_ASPECT)
  const logo = await sharp(logoSvg).resize(maxWidth, maxHeight, { fit: 'inside' }).png().toBuffer()
  const { width: logoW = maxWidth, height: logoH = maxHeight } = await sharp(logo).metadata()

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background
    }
  })
    .composite([
      {
        input: logo,
        top: Math.round((height - logoH) / 2),
        left: Math.round((width - logoW) / 2)
      }
    ])
    .png()
}

async function writePng(filePath, buffer) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, buffer)
}

async function generateIosIcons() {
  const iconSet = path.join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset')
  const lightIcon = await renderLogo(1024, LOGO_LIGHT_SVG, { background: BRAND_BG, logoScale: ICON_LOGO_SCALE })
  const darkIcon = await renderLogo(1024, LOGO_DARK_SVG, { background: LIGHT_BG, logoScale: ICON_LOGO_SCALE })

  await writePng(path.join(iconSet, 'AppIcon-512@2x.png'), await lightIcon.toBuffer())
  await writePng(path.join(iconSet, 'AppIcon-512@2x-dark.png'), await darkIcon.toBuffer())

  const contents = {
    images: [
      {
        filename: 'AppIcon-512@2x.png',
        idiom: 'universal',
        platform: 'ios',
        size: '1024x1024'
      },
      {
        appearances: [{ appearance: 'luminosity', value: 'dark' }],
        filename: 'AppIcon-512@2x-dark.png',
        idiom: 'universal',
        platform: 'ios',
        size: '1024x1024'
      }
    ],
    info: { author: 'xcode', version: 1 }
  }
  await writeFile(path.join(iconSet, 'Contents.json'), `${JSON.stringify(contents, null, 2)}\n`)
  console.log('wrote iOS AppIcon (light + dark)')
}

async function generateAndroidIcons() {
  for (const [folder, size] of Object.entries(ANDROID_FOREGROUND_SIZES)) {
    const foreground = await (
      await renderLogo(size, LOGO_LIGHT_SVG, { logoScale: 0.62 })
    ).toBuffer()
    const base = path.join(root, `android/app/src/main/res/${folder}`)
    await writePng(path.join(base, 'ic_launcher_foreground.png'), foreground)
    console.log(`wrote ${folder}/ic_launcher_foreground.png`)
  }

  for (const [folder, size] of Object.entries(ANDROID_LAUNCHER_SIZES)) {
    const launcher = await (
      await renderLogo(size, LOGO_LIGHT_SVG, { background: BRAND_BG, logoScale: ICON_LOGO_SCALE })
    ).toBuffer()
    const base = path.join(root, `android/app/src/main/res/${folder}`)
    await writePng(path.join(base, 'ic_launcher.png'), launcher)
    await writePng(path.join(base, 'ic_launcher_round.png'), launcher)
    console.log(`wrote ${folder}/ic_launcher*.png`)
  }
}

async function generateSourceAssets() {
  const outDir = path.join(root, 'resources')
  await mkdir(outDir, { recursive: true })

  const light = await renderLogo(1024, LOGO_LIGHT_SVG, { background: BRAND_BG, logoScale: ICON_LOGO_SCALE })
  const dark = await renderLogo(1024, LOGO_DARK_SVG, { background: LIGHT_BG, logoScale: ICON_LOGO_SCALE })

  await writePng(path.join(outDir, 'icon.png'), await light.toBuffer())
  await writePng(path.join(outDir, 'icon-dark.png'), await dark.toBuffer())
  console.log('wrote resources/icon.png + icon-dark.png')
}

async function generateIosSplash() {
  const splashSet = path.join(root, 'ios/App/App/Assets.xcassets/Splash.imageset')
  const splash = await renderLogo(2732, LOGO_LIGHT_SVG, { background: BRAND_BG, logoScale: ICON_LOGO_SCALE })
  const buffer = await splash.toBuffer()

  for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
    await writePng(path.join(splashSet, name), buffer)
  }
  console.log('wrote iOS Splash.imageset')
}

async function generateAndroidSplash() {
  const writeSplash = async (folder, width, height) => {
    const image = await renderSplash(width, height, LOGO_LIGHT_SVG)
    await writePng(path.join(root, `android/app/src/main/res/${folder}/splash.png`), await image.toBuffer())
  }

  for (const [folder, [width, height]] of Object.entries(ANDROID_SPLASH_PORTRAIT)) {
    await writeSplash(folder, width, height)
    console.log(`wrote ${folder}/splash.png`)
  }

  for (const [folder, [width, height]] of Object.entries(ANDROID_SPLASH_LANDSCAPE)) {
    await writeSplash(folder, width, height)
    console.log(`wrote ${folder}/splash.png`)
  }

  const fallback = await renderSplash(480, 800, LOGO_LIGHT_SVG)
  await writePng(path.join(root, 'android/app/src/main/res/drawable/splash.png'), await fallback.toBuffer())
  console.log('wrote drawable/splash.png')
}

async function generateSplashPreview() {
  const outDir = path.join(root, 'resources')
  const splash = await renderSplash(1080, 1920, LOGO_LIGHT_SVG)
  await writePng(path.join(outDir, 'splash.png'), await splash.toBuffer())
  console.log('wrote resources/splash.png')
}

async function main() {
  await Promise.all([readFile(LOGO_LIGHT_SVG), readFile(LOGO_DARK_SVG)])
  await generateSourceAssets()
  await generateIosIcons()
  await generateAndroidIcons()
  await generateIosSplash()
  await generateAndroidSplash()
  await generateSplashPreview()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
