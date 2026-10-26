import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { translations } from '../i18n/translations';

const LanguageContext = createContext(null);

const STORAGE_KEY = 'civicsarthi_lang';

/**
 * Creates a smart translation function supporting:
 * 1. Function call: t('skipToContent') or t('citizenDashboard.title')
 * 2. Property access: t.skipToContent or t.logoTagline
 * 3. Parameter interpolation: t('showingCount', { count: 5 }) -> replaces {count}
 * 4. Fallback from hi -> en -> key
 */
function createTranslateProxy(currentLang) {
  const currentDict = translations[currentLang] || translations.en || {};
  const enDict = translations.en || {};

  const translate = (key, params) => {
    if (!key || typeof key !== 'string') return '';

    // Direct lookup
    let str = currentDict[key];

    // Dot-notation lookup (e.g. 'common.submit')
    if (str === undefined && key.includes('.')) {
      str = key.split('.').reduce((obj, k) => (obj && obj[k] !== undefined ? obj[k] : undefined), currentDict);
    }

    // Fallback to English dictionary
    if (str === undefined) {
      str = enDict[key];
      if (str === undefined && key.includes('.')) {
        str = key.split('.').reduce((obj, k) => (obj && obj[k] !== undefined ? obj[k] : undefined), enDict);
      }
    }

    // Final fallback to key itself
    if (str === undefined) {
      str = key;
    }

    if (typeof str === 'function') {
      return str(params);
    }

    // String interpolation for {param} placeholders
    if (typeof str === 'string' && params && typeof params === 'object') {
      return str.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? params[k] : `{${k}}`));
    }

    return str;
  };

  return new Proxy(translate, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop === 'string') {
        return target(prop);
      }
      return undefined;
    }
  });
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === 'hi' ? 'hi' : 'en';
    } catch {
      return 'en';
    }
  });

  const setLanguage = useCallback((newLang) => {
    const validLang = newLang === 'hi' ? 'hi' : 'en';
    setLangState(validLang);
    try {
      localStorage.setItem(STORAGE_KEY, validLang);
      document.documentElement.lang = validLang;
    } catch (e) {
      console.warn('Could not persist language preference:', e);
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(lang === 'en' ? 'hi' : 'en');
  }, [lang, setLanguage]);

  // Keep in sync with other browser tabs or direct localStorage changes
  useEffect(() => {
    try {
      document.documentElement.lang = lang;
    } catch {}

    const handleStorage = (e) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'en' || e.newValue === 'hi')) {
        setLangState(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [lang]);

  const t = useMemo(() => createTranslateProxy(lang), [lang]);

  // Specialized helpers for domain enums
  const tStatus = useCallback((code) => {
    if (!code) return '';
    return t(`status.${code}`) || code;
  }, [t]);

  const tPriority = useCallback((priority) => {
    if (!priority) return '';
    return t(`priority.${priority}`) || priority;
  }, [t]);

  const tCategory = useCallback((category) => {
    if (!category) return '';
    return t(`category.${category}`) || category;
  }, [t]);

  const tDepartment = useCallback((deptId) => {
    if (!deptId) return '';
    return t(`department.${deptId}`) || deptId;
  }, [t]);

  const tResolutionOutcome = useCallback((outcome) => {
    if (!outcome) return '';
    return t(`resolutionOutcome.${outcome}`) || outcome;
  }, [t]);

  const tVerificationMethod = useCallback((method) => {
    if (!method) return '';
    return t(`verificationMethod.${method}`) || method;
  }, [t]);

  const tExceptionReason = useCallback((reason) => {
    if (!reason) return '';
    return t(`exceptionReason.${reason}`) || reason;
  }, [t]);

  const formatDate = useCallback((dateInput, options = {}) => {
    if (!dateInput) return '';
    try {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return String(dateInput);
      const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
      const defaultOpts = { day: '2-digit', month: 'short', year: 'numeric', ...options };
      return d.toLocaleDateString(locale, defaultOpts);
    } catch {
      return String(dateInput);
    }
  }, [lang]);

  const value = useMemo(() => ({
    lang,
    setLanguage,
    toggleLanguage,
    t,
    tStatus,
    tPriority,
    tCategory,
    tDepartment,
    tResolutionOutcome,
    tVerificationMethod,
    tExceptionReason,
    formatDate
  }), [
    lang,
    setLanguage,
    toggleLanguage,
    t,
    tStatus,
    tPriority,
    tCategory,
    tDepartment,
    tResolutionOutcome,
    tVerificationMethod,
    tExceptionReason,
    formatDate
  ]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    // Graceful fallback if rendered outside provider (e.g. isolated test or story)
    const fallbackT = createTranslateProxy('en');
    return {
      lang: 'en',
      setLanguage: () => {},
      toggleLanguage: () => {},
      t: fallbackT,
      tStatus: (c) => c,
      tPriority: (p) => p,
      tCategory: (c) => c,
      tDepartment: (d) => d,
      tResolutionOutcome: (o) => o,
      tVerificationMethod: (m) => m,
      tExceptionReason: (r) => r,
      formatDate: (d) => String(d)
    };
  }
  return context;
}
