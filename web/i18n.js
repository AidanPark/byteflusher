// i18n module for ByteFlusher Web UI
// - Detects browser language (ko → Korean, else → English)
// - Loads JSON translation files from ../lang/
// - Provides t() for string lookup with {placeholder} substitution
// - applyDom() applies translations to data-i18n / data-i18n-placeholder / data-i18n-html attributes

let _strings = {};
let _lang = 'en';
let _locale = 'en-US';

export function getLang() {
  return _lang;
}

export function getLocale() {
  return _locale;
}

function resolve(key) {
  if (!key) return undefined;
  const parts = key.split('.');
  let obj = _strings;
  for (const p of parts) {
    if (obj == null || typeof obj !== 'object') return undefined;
    obj = obj[p];
  }
  return typeof obj === 'string' ? obj : undefined;
}

export function t(key, params) {
  let s = resolve(key);
  if (s === undefined) return key;
  if (params && typeof params === 'object') {
    for (const [k, v] of Object.entries(params)) {
      s = s.replaceAll(`{${k}}`, String(v ?? ''));
    }
  }
  return s;
}

export function applyDom(root) {
  const base = root || document;

  const textEls = base.querySelectorAll('[data-i18n]');
  for (const el of textEls) {
    const key = el.getAttribute('data-i18n');
    const val = resolve(key);
    if (val !== undefined) el.textContent = val;
  }

  const phEls = base.querySelectorAll('[data-i18n-placeholder]');
  for (const el of phEls) {
    const key = el.getAttribute('data-i18n-placeholder');
    const val = resolve(key);
    if (val !== undefined) el.placeholder = val;
  }

  const htmlEls = base.querySelectorAll('[data-i18n-html]');
  for (const el of htmlEls) {
    const key = el.getAttribute('data-i18n-html');
    const val = resolve(key);
    if (val !== undefined) el.innerHTML = val;
  }
}

async function loadJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function initI18n({ basePath = '..' } = {}) {
  const navLang = (navigator.language || '').toLowerCase();
  const isKo = navLang.startsWith('ko');
  _lang = isKo ? 'ko' : 'en';
  _locale = isKo ? 'ko-KR' : 'en-US';

  // Always load English as fallback
  const enData = await loadJson(`${basePath}/lang/en.json`);
  if (enData) {
    _strings = enData;
  }

  // If Korean, load and merge (overrides English)
  if (isKo) {
    const koData = await loadJson(`${basePath}/lang/ko.json`);
    if (koData) {
      _strings = deepMerge(_strings, koData);
    }
  }

  // Update html lang attribute
  document.documentElement.lang = _lang;

  applyDom();
}

function deepMerge(base, override) {
  const result = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object') {
      result[k] = deepMerge(base[k], v);
    } else {
      result[k] = v;
    }
  }
  return result;
}
