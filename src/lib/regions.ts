/** Full TMDB watch-provider region list (ISO 3166-1 alpha-2 → English label). */
const RAW_REGIONS: { code: string; label: string }[] = [
	{ code: 'AD', label: 'Andorra' },
	{ code: 'AE', label: 'United Arab Emirates' },
	{ code: 'AG', label: 'Antigua and Barbuda' },
	{ code: 'AL', label: 'Albania' },
	{ code: 'AO', label: 'Angola' },
	{ code: 'AR', label: 'Argentina' },
	{ code: 'AT', label: 'Austria' },
	{ code: 'AU', label: 'Australia' },
	{ code: 'AZ', label: 'Azerbaijan' },
	{ code: 'BA', label: 'Bosnia and Herzegovina' },
	{ code: 'BB', label: 'Barbados' },
	{ code: 'BE', label: 'Belgium' },
	{ code: 'BF', label: 'Burkina Faso' },
	{ code: 'BG', label: 'Bulgaria' },
	{ code: 'BH', label: 'Bahrain' },
	{ code: 'BM', label: 'Bermuda' },
	{ code: 'BO', label: 'Bolivia' },
	{ code: 'BR', label: 'Brazil' },
	{ code: 'BS', label: 'Bahamas' },
	{ code: 'BY', label: 'Belarus' },
	{ code: 'BZ', label: 'Belize' },
	{ code: 'CA', label: 'Canada' },
	{ code: 'CD', label: 'Democratic Republic of the Congo' },
	{ code: 'CH', label: 'Switzerland' },
	{ code: 'CI', label: 'Ivory Coast' },
	{ code: 'CL', label: 'Chile' },
	{ code: 'CM', label: 'Cameroon' },
	{ code: 'CO', label: 'Colombia' },
	{ code: 'CR', label: 'Costa Rica' },
	{ code: 'CU', label: 'Cuba' },
	{ code: 'CV', label: 'Cape Verde' },
	{ code: 'CY', label: 'Cyprus' },
	{ code: 'CZ', label: 'Czech Republic' },
	{ code: 'DE', label: 'Germany' },
	{ code: 'DK', label: 'Denmark' },
	{ code: 'DO', label: 'Dominican Republic' },
	{ code: 'DZ', label: 'Algeria' },
	{ code: 'EC', label: 'Ecuador' },
	{ code: 'EE', label: 'Estonia' },
	{ code: 'EG', label: 'Egypt' },
	{ code: 'ES', label: 'Spain' },
	{ code: 'FI', label: 'Finland' },
	{ code: 'FJ', label: 'Fiji' },
	{ code: 'FR', label: 'France' },
	{ code: 'GB', label: 'United Kingdom' },
	{ code: 'GF', label: 'French Guiana' },
	{ code: 'GH', label: 'Ghana' },
	{ code: 'GI', label: 'Gibraltar' },
	{ code: 'GP', label: 'Guadeloupe' },
	{ code: 'GQ', label: 'Equatorial Guinea' },
	{ code: 'GR', label: 'Greece' },
	{ code: 'GT', label: 'Guatemala' },
	{ code: 'GY', label: 'Guyana' },
	{ code: 'HK', label: 'Hong Kong' },
	{ code: 'HN', label: 'Honduras' },
	{ code: 'HR', label: 'Croatia' },
	{ code: 'HU', label: 'Hungary' },
	{ code: 'ID', label: 'Indonesia' },
	{ code: 'IE', label: 'Ireland' },
	{ code: 'IL', label: 'Israel' },
	{ code: 'IN', label: 'India' },
	{ code: 'IQ', label: 'Iraq' },
	{ code: 'IS', label: 'Iceland' },
	{ code: 'IT', label: 'Italy' },
	{ code: 'JM', label: 'Jamaica' },
	{ code: 'JO', label: 'Jordan' },
	{ code: 'JP', label: 'Japan' },
	{ code: 'KE', label: 'Kenya' },
	{ code: 'KR', label: 'South Korea' },
	{ code: 'KW', label: 'Kuwait' },
	{ code: 'LB', label: 'Lebanon' },
	{ code: 'LC', label: 'Saint Lucia' },
	{ code: 'LI', label: 'Liechtenstein' },
	{ code: 'LT', label: 'Lithuania' },
	{ code: 'LU', label: 'Luxembourg' },
	{ code: 'LV', label: 'Latvia' },
	{ code: 'LY', label: 'Libya' },
	{ code: 'MA', label: 'Morocco' },
	{ code: 'MC', label: 'Monaco' },
	{ code: 'MD', label: 'Moldova' },
	{ code: 'ME', label: 'Montenegro' },
	{ code: 'MG', label: 'Madagascar' },
	{ code: 'MK', label: 'North Macedonia' },
	{ code: 'ML', label: 'Mali' },
	{ code: 'MT', label: 'Malta' },
	{ code: 'MU', label: 'Mauritius' },
	{ code: 'MW', label: 'Malawi' },
	{ code: 'MX', label: 'Mexico' },
	{ code: 'MY', label: 'Malaysia' },
	{ code: 'MZ', label: 'Mozambique' },
	{ code: 'NE', label: 'Niger' },
	{ code: 'NG', label: 'Nigeria' },
	{ code: 'NI', label: 'Nicaragua' },
	{ code: 'NL', label: 'Netherlands' },
	{ code: 'NO', label: 'Norway' },
	{ code: 'NZ', label: 'New Zealand' },
	{ code: 'OM', label: 'Oman' },
	{ code: 'PA', label: 'Panama' },
	{ code: 'PE', label: 'Peru' },
	{ code: 'PF', label: 'French Polynesia' },
	{ code: 'PG', label: 'Papua New Guinea' },
	{ code: 'PH', label: 'Philippines' },
	{ code: 'PK', label: 'Pakistan' },
	{ code: 'PL', label: 'Poland' },
	{ code: 'PS', label: 'Palestine' },
	{ code: 'PT', label: 'Portugal' },
	{ code: 'PY', label: 'Paraguay' },
	{ code: 'QA', label: 'Qatar' },
	{ code: 'RO', label: 'Romania' },
	{ code: 'RS', label: 'Serbia' },
	{ code: 'RU', label: 'Russia' },
	{ code: 'SA', label: 'Saudi Arabia' },
	{ code: 'SC', label: 'Seychelles' },
	{ code: 'SE', label: 'Sweden' },
	{ code: 'SG', label: 'Singapore' },
	{ code: 'SI', label: 'Slovenia' },
	{ code: 'SK', label: 'Slovakia' },
	{ code: 'SM', label: 'San Marino' },
	{ code: 'SN', label: 'Senegal' },
	{ code: 'SV', label: 'El Salvador' },
	{ code: 'TC', label: 'Turks and Caicos Islands' },
	{ code: 'TD', label: 'Chad' },
	{ code: 'TH', label: 'Thailand' },
	{ code: 'TN', label: 'Tunisia' },
	{ code: 'TR', label: 'Turkey' },
	{ code: 'TT', label: 'Trinidad and Tobago' },
	{ code: 'TW', label: 'Taiwan' },
	{ code: 'TZ', label: 'Tanzania' },
	{ code: 'UA', label: 'Ukraine' },
	{ code: 'UG', label: 'Uganda' },
	{ code: 'US', label: 'United States' },
	{ code: 'UY', label: 'Uruguay' },
	{ code: 'VA', label: 'Vatican City' },
	{ code: 'VE', label: 'Venezuela' },
	{ code: 'XK', label: 'Kosovo' },
	{ code: 'YE', label: 'Yemen' },
	{ code: 'ZA', label: 'South Africa' },
	{ code: 'ZM', label: 'Zambia' },
	{ code: 'ZW', label: 'Zimbabwe' }
];

export const WATCH_REGIONS: { code: string; label: string }[] = [...RAW_REGIONS].sort((a, b) =>
	a.label.localeCompare(b.label, 'en')
);

export type WatchRegionCode = string;

export const WATCH_REGION_KEY = 'aurawatch_region';

/** Common overrides shown as chips next to Where to Watch. */
export const QUICK_WATCH_REGIONS = ['US', 'DK', 'GB', 'DE', 'CA'] as const;

const VALID = new Set(WATCH_REGIONS.map((r) => r.code));
const LABEL_BY_CODE = new Map(WATCH_REGIONS.map((r) => [r.code, r.label]));

const LANG_TO_REGION: Record<string, string> = {
	EN: 'US',
	JA: 'JP',
	KO: 'KR',
	DE: 'DE',
	FR: 'FR',
	ES: 'ES',
	IT: 'IT',
	PT: 'BR',
	NL: 'NL',
	SV: 'SE',
	DA: 'DK',
	NB: 'NO',
	NN: 'NO',
	PL: 'PL',
	HI: 'IN',
	FI: 'FI',
	EL: 'GR',
	TR: 'TR',
	CS: 'CZ',
	HU: 'HU',
	RO: 'RO',
	UK: 'UA',
	AR: 'SA',
	HE: 'IL',
	TH: 'TH',
	VI: 'US',
	ID: 'ID',
	MS: 'MY',
	ZH: 'HK'
};

// detecting user locale from browser timezone to stop defaulting all streaming providers to us
const TZ_TO_REGION: Record<string, string> = {
	'Africa/Cairo': 'EG',
	'Africa/Casablanca': 'MA',
	'Africa/Johannesburg': 'ZA',
	'Africa/Lagos': 'NG',
	'Africa/Nairobi': 'KE',
	'Africa/Tunis': 'TN',
	'America/Argentina/Buenos_Aires': 'AR',
	'America/Bogota': 'CO',
	'America/Caracas': 'VE',
	'America/Chicago': 'US',
	'America/Denver': 'US',
	'America/Edmonton': 'CA',
	'America/Guatemala': 'GT',
	'America/Halifax': 'CA',
	'America/Jamaica': 'JM',
	'America/Lima': 'PE',
	'America/Los_Angeles': 'US',
	'America/Mexico_City': 'MX',
	'America/New_York': 'US',
	'America/Panama': 'PA',
	'America/Phoenix': 'US',
	'America/Puerto_Rico': 'US',
	'America/Santiago': 'CL',
	'America/Sao_Paulo': 'BR',
	'America/St_Johns': 'CA',
	'America/Toronto': 'CA',
	'America/Vancouver': 'CA',
	'America/Winnipeg': 'CA',
	'Asia/Bangkok': 'TH',
	'Asia/Dubai': 'AE',
	'Asia/Hong_Kong': 'HK',
	'Asia/Jakarta': 'ID',
	'Asia/Jerusalem': 'IL',
	'Asia/Karachi': 'PK',
	'Asia/Kolkata': 'IN',
	'Asia/Kuala_Lumpur': 'MY',
	'Asia/Manila': 'PH',
	'Asia/Qatar': 'QA',
	'Asia/Riyadh': 'SA',
	'Asia/Seoul': 'KR',
	'Asia/Shanghai': 'HK',
	'Asia/Singapore': 'SG',
	'Asia/Taipei': 'TW',
	'Asia/Tokyo': 'JP',
	'Australia/Perth': 'AU',
	'Australia/Sydney': 'AU',
	'Europe/Amsterdam': 'NL',
	'Europe/Athens': 'GR',
	'Europe/Belgrade': 'RS',
	'Europe/Berlin': 'DE',
	'Europe/Brussels': 'BE',
	'Europe/Bucharest': 'RO',
	'Europe/Budapest': 'HU',
	'Europe/Copenhagen': 'DK',
	'Europe/Dublin': 'IE',
	'Europe/Helsinki': 'FI',
	'Europe/Istanbul': 'TR',
	'Europe/Kiev': 'UA',
	'Europe/Kyiv': 'UA',
	'Europe/Lisbon': 'PT',
	'Europe/London': 'GB',
	'Europe/Madrid': 'ES',
	'Europe/Moscow': 'RU',
	'Europe/Oslo': 'NO',
	'Europe/Paris': 'FR',
	'Europe/Prague': 'CZ',
	'Europe/Rome': 'IT',
	'Europe/Stockholm': 'SE',
	'Europe/Vienna': 'AT',
	'Europe/Warsaw': 'PL',
	'Europe/Zurich': 'CH',
	'Pacific/Auckland': 'NZ',
	'Pacific/Honolulu': 'US'
};

const CITY_TO_REGION: Record<string, string> = {
	AMSTERDAM: 'NL',
	ATHENS: 'GR',
	AUCKLAND: 'NZ',
	BANGKOK: 'TH',
	BELGRADE: 'RS',
	BERLIN: 'DE',
	BOGOTA: 'CO',
	BRUSSELS: 'BE',
	BUCHAREST: 'RO',
	BUDAPEST: 'HU',
	BUENOS_AIRES: 'AR',
	CAIRO: 'EG',
	CARACAS: 'VE',
	CASABLANCA: 'MA',
	CHICAGO: 'US',
	COPENHAGEN: 'DK',
	DENVER: 'US',
	DUBAI: 'AE',
	DUBLIN: 'IE',
	EDMONTON: 'CA',
	GUATEMALA: 'GT',
	HALIFAX: 'CA',
	HELSINKI: 'FI',
	HONG_KONG: 'HK',
	HONOLULU: 'US',
	ISTANBUL: 'TR',
	JAKARTA: 'ID',
	JAMAICA: 'JM',
	JERUSALEM: 'IL',
	JOHANNESBURG: 'ZA',
	KARACHI: 'PK',
	KIEV: 'UA',
	KOLKATA: 'IN',
	KUALA_LUMPUR: 'MY',
	KYIV: 'UA',
	LAGOS: 'NG',
	LIMA: 'PE',
	LISBON: 'PT',
	LONDON: 'GB',
	LOS_ANGELES: 'US',
	MADRID: 'ES',
	MANILA: 'PH',
	MELBOURNE: 'AU',
	MEXICO_CITY: 'MX',
	MOSCOW: 'RU',
	NAIROBI: 'KE',
	NEW_YORK: 'US',
	OSLO: 'NO',
	PANAMA: 'PA',
	PARIS: 'FR',
	PERTH: 'AU',
	PHOENIX: 'US',
	PRAGUE: 'CZ',
	QATAR: 'QA',
	RIYADH: 'SA',
	ROME: 'IT',
	SANTIAGO: 'CL',
	SAO_PAULO: 'BR',
	SEOUL: 'KR',
	SHANGHAI: 'HK',
	SINGAPORE: 'SG',
	STOCKHOLM: 'SE',
	ST_JOHNS: 'CA',
	SYDNEY: 'AU',
	TAIPEI: 'TW',
	TOKYO: 'JP',
	TORONTO: 'CA',
	TUNIS: 'TN',
	VANCOUVER: 'CA',
	VIENNA: 'AT',
	WARSAW: 'PL',
	WINNIPEG: 'CA',
	ZURICH: 'CH'
};

export function getRegionLabel(code: string): string {
	const c = String(code || '')
		.trim()
		.toUpperCase();
	return LABEL_BY_CODE.get(c) || c;
}

export function isWatchRegion(code?: string | null): boolean {
	const c = String(code || '')
		.trim()
		.toUpperCase()
		.slice(0, 2);
	return VALID.has(c);
}

function regionFromLocaleTag(tag?: string | null): string | null {
	const raw = String(tag || '').trim();
	if (!raw) return null;
	try {
		const loc = new Intl.Locale(raw);
		if (loc.region && VALID.has(loc.region.toUpperCase())) return loc.region.toUpperCase();
	} catch {
		/* old engine, fall through */
	}
	const parts = raw.toUpperCase().split(/[-_]/);
	if (parts.length >= 2 && VALID.has(parts[1].slice(0, 2))) return parts[1].slice(0, 2);
	return null;
}

function regionFromLanguageOnly(tag?: string | null): string | null {
	const raw = String(tag || '')
		.trim()
		.toUpperCase();
	if (!raw) return null;
	const lang = raw.split(/[-_]/)[0];
	const mapped = LANG_TO_REGION[lang];
	return mapped && VALID.has(mapped) ? mapped : null;
}

/** Guess region from browser locale (en-US → US). Returns null if unknown. */
export function detectRegionFromLocale(locale?: string | null): string | null {
	const raw = locale || (typeof navigator !== 'undefined' ? navigator.language : '') || '';
	return regionFromLocaleTag(raw) || regionFromLanguageOnly(raw);
}

export function detectRegionFromTimeZone(timeZone?: string | null): string | null {
	let zone = String(timeZone || '').trim();
	if (!zone && typeof Intl !== 'undefined') {
		try {
			zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
		} catch {
			zone = '';
		}
	}
	if (!zone) return null;

	const exact = TZ_TO_REGION[zone];
	if (exact && VALID.has(exact)) return exact;

	const city = zone
		.split('/')
		.pop()
		?.replace(/-/g, '_')
		.toUpperCase();
	if (city && CITY_TO_REGION[city] && VALID.has(CITY_TO_REGION[city])) {
		return CITY_TO_REGION[city];
	}

	const continent = zone.split('/')[0]?.toLowerCase();
	if (continent === 'america') return 'US';
	if (continent === 'australia') return 'AU';
	return null;
}

/** Timezone first (where you actually are), then locale country, then language map, then US. */
export function detectUserRegion(): string {
	const fromTz = detectRegionFromTimeZone();
	if (fromTz) return fromTz;

	if (typeof navigator !== 'undefined') {
		const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
		for (const tag of tags) {
			const fromTag = regionFromLocaleTag(tag);
			if (fromTag) return fromTag;
		}

		const fromLang = regionFromLanguageOnly(navigator.language);
		if (fromLang) return fromLang;
	}

	return 'US';
}

export function readStoredRegion(): string | null {
	try {
		const saved = localStorage.getItem(WATCH_REGION_KEY);
		return saved && isWatchRegion(saved) ? normalizeRegion(saved) : null;
	} catch {
		return null;
	}
}

export function writeStoredRegion(code: string) {
	try {
		localStorage.setItem(WATCH_REGION_KEY, normalizeRegion(code));
	} catch {
		/* shrug */
	}
}

export function hydrateWatchRegion(): string {
	const stored = readStoredRegion();
	if (stored) return stored;
	const detected = detectUserRegion();
	writeStoredRegion(detected);
	return detected;
}

export function normalizeRegion(code?: string | null, fallback = 'US') {
	const c = String(code || '')
		.trim()
		.toUpperCase()
		.slice(0, 2);
	return VALID.has(c) ? c : fallback;
}
