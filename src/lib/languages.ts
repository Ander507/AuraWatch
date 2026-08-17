/** TMDB-ish locale codes for titles / overviews. Default English. */

export type LangOption = { code: string; label: string };

export const CONTENT_LANGUAGES: LangOption[] = [
	{ code: 'en-US', label: 'English' },
	{ code: 'es-ES', label: 'Español' },
	{ code: 'fr-FR', label: 'Français' },
	{ code: 'de-DE', label: 'Deutsch' },
	{ code: 'it-IT', label: 'Italiano' },
	{ code: 'pt-BR', label: 'Português (Brasil)' },
	{ code: 'pt-PT', label: 'Português (Portugal)' },
	{ code: 'ja-JP', label: '日本語' },
	{ code: 'ko-KR', label: '한국어' },
	{ code: 'zh-CN', label: '中文 (简体)' },
	{ code: 'zh-TW', label: '中文 (繁體)' },
	{ code: 'ar-SA', label: 'العربية' },
	{ code: 'hi-IN', label: 'हिन्दी' },
	{ code: 'nl-NL', label: 'Nederlands' },
	{ code: 'pl-PL', label: 'Polski' },
	{ code: 'sv-SE', label: 'Svenska' },
	{ code: 'tr-TR', label: 'Türkçe' },
	{ code: 'ru-RU', label: 'Русский' },
	{ code: 'da-DK', label: 'Dansk' },
	{ code: 'nb-NO', label: 'Norsk' }
];

export const DEFAULT_LANGUAGE = 'en-US';

const ALLOWED = new Set(CONTENT_LANGUAGES.map((l) => l.code));

export function normalizeLanguage(raw: unknown): string {
	const s = String(raw || '')
		.trim()
		.replace('_', '-');
	if (!s) return DEFAULT_LANGUAGE;
	if (ALLOWED.has(s)) return s;
	// "es" → "es-ES" if we have that family
	const lower = s.toLowerCase();
	const hit = CONTENT_LANGUAGES.find(
		(l) => l.code.toLowerCase() === lower || l.code.toLowerCase().startsWith(lower + '-')
	);
	return hit?.code || DEFAULT_LANGUAGE;
}

export function getLanguageLabel(code: string): string {
	const n = normalizeLanguage(code);
	return CONTENT_LANGUAGES.find((l) => l.code === n)?.label || n;
}
