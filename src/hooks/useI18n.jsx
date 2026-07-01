import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { DEFAULT_TRANSLATIONS, LANGUAGES } from '../i18n'
import * as eventsService from '../services/eventsService'

const I18nContext = createContext(null)
const STORAGE_KEY = 'cclx-lang'
const DEFAULT_LANG = 'pt'

function interpolate(str, vars) {
  if (!vars) return str
  let out = str
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(v)
  }
  return out
}

/**
 * I18nProvider — idioma ativo (persistido em localStorage) + dicionário por
 * omissão com sobreposições geridas pelo admin (app_settings via /data/translations).
 * `t(key, vars)` resolve: override[lang] → default[lang] → default[pt] → key.
 */
export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG
  )
  const [overrides, setOverrides] = useState({})
  const [logoUrl, setLogoUrl] = useState(null)

  const refreshTranslations = useCallback(() => {
    return eventsService
      .getTranslations()
      .then((o) => setOverrides(o && typeof o === 'object' ? o : {}))
      .catch(() => {})
  }, [])

  const refreshBranding = useCallback(() => {
    return eventsService
      .getBranding()
      .then((b) => setLogoUrl(b?.logoUrl || null))
      .catch(() => {})
  }, [])

  useEffect(() => {
    let alive = true
    eventsService
      .getTranslations()
      .then((o) => {
        if (alive) setOverrides(o && typeof o === 'object' ? o : {})
      })
      .catch(() => {})
    eventsService
      .getBranding()
      .then((b) => {
        if (alive) setLogoUrl(b?.logoUrl || null)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const setLang = useCallback((l) => {
    if (LANGUAGES.some((x) => x.code === l)) {
      setLangState(l)
      try {
        localStorage.setItem(STORAGE_KEY, l)
      } catch {
        /* ignora */
      }
    }
  }, [])

  const t = useCallback(
    (key, vars) => {
      const o = overrides?.[lang]?.[key]
      const d = DEFAULT_TRANSLATIONS[lang]?.[key]
      const fb = DEFAULT_TRANSLATIONS[DEFAULT_LANG]?.[key]
      const raw = o ?? d ?? fb ?? key
      return interpolate(raw, vars)
    },
    [lang, overrides]
  )

  const value = useMemo(() => {
    const entity = t('entity')
    const entities = t('entities')
    return {
      lang,
      setLang,
      t,
      entity,
      entities,
      languages: LANGUAGES,
      overrides,
      refreshTranslations,
      logoUrl,
      refreshBranding,
    }
  }, [lang, setLang, t, overrides, refreshTranslations, logoUrl, refreshBranding])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    // Fallback defensivo: fora do provider devolve PT por omissão.
    return {
      lang: DEFAULT_LANG,
      setLang: () => {},
      t: (key, vars) => interpolate(DEFAULT_TRANSLATIONS[DEFAULT_LANG]?.[key] ?? key, vars),
      entity: DEFAULT_TRANSLATIONS[DEFAULT_LANG].entity,
      entities: DEFAULT_TRANSLATIONS[DEFAULT_LANG].entities,
      languages: LANGUAGES,
      overrides: {},
      refreshTranslations: () => Promise.resolve(),
      logoUrl: null,
      refreshBranding: () => Promise.resolve(),
    }
  }
  return ctx
}
