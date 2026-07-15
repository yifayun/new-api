import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

export type UiTheme = 'default' | 'aliyun' | 'tencent'

const UI_THEME_STORAGE_KEY = 'ui_theme'

type UiThemeProviderState = {
  uiTheme: UiTheme
  setUiTheme: (theme: UiTheme) => void
  resetUiTheme: () => void
}

const UiThemeContext = createContext<UiThemeProviderState | null>(null)

function readUiThemeFromStorage(): UiTheme | null {
  try {
    const raw = window.localStorage.getItem(UI_THEME_STORAGE_KEY)
    if (raw === 'default' || raw === 'aliyun' || raw === 'tencent') return raw
  } catch {
    /* empty */
  }
  return null
}

function writeUiThemeToStorage(theme: UiTheme | null) {
  try {
    if (theme == null) window.localStorage.removeItem(UI_THEME_STORAGE_KEY)
    else window.localStorage.setItem(UI_THEME_STORAGE_KEY, theme)
  } catch {
    /* empty */
  }
}

async function ensureAliyunStylesLoaded() {
  // Ant Design v5 recommended: reset.css
  await import('antd/dist/reset.css')
}

async function ensureTencentStylesLoaded() {
  await import('tdesign-react/es/style/index.css')
}

export function UiThemeProvider(props: { children: React.ReactNode }) {
  const [uiTheme, _setUiTheme] = useState<UiTheme>(() => {
    if (typeof window === 'undefined') return 'default'
    return readUiThemeFromStorage() ?? 'default'
  })

  // Load component-library styles on-demand to avoid affecting default theme.
  useEffect(() => {
    if (uiTheme === 'aliyun') {
      void ensureAliyunStylesLoaded()
    } else if (uiTheme === 'tencent') {
      void ensureTencentStylesLoaded()
    }
  }, [uiTheme])

  // Tag on <html> for theme-specific overrides if needed.
  useEffect(() => {
    const root = window.document.documentElement
    root.dataset.uiTheme = uiTheme
  }, [uiTheme])

  const value = useMemo<UiThemeProviderState>(() => {
    return {
      uiTheme,
      setUiTheme: (theme) => {
        writeUiThemeToStorage(theme)
        _setUiTheme(theme)
      },
      resetUiTheme: () => {
        writeUiThemeToStorage(null)
        _setUiTheme('default')
      },
    }
  }, [uiTheme])

  return <UiThemeContext value={value}>{props.children}</UiThemeContext>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUiTheme() {
  const ctx = useContext(UiThemeContext)
  if (!ctx) throw new Error('useUiTheme must be used within UiThemeProvider')
  return ctx
}

