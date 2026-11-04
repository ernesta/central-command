// Bundled locally so the app works offline; no runtime font requests.
import '@fontsource/newsreader/600.css'
import '@fontsource/newsreader/700.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
// Urdu and Arabic: only the Arabic-script subset, after the Latin fonts in the font stacks (`tokens.css`), so Latin text
// never comes from it. Text in these scripts is tagged `lang="ur"` (`lib/auto-lang.ts`), which gives it the Urdu digits.
import '@fontsource/noto-naskh-arabic/arabic-400.css'
import '@fontsource/noto-naskh-arabic/arabic-500.css'
import '@fontsource/noto-naskh-arabic/arabic-600.css'
import '@fontsource/noto-naskh-arabic/arabic-700.css'
