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

const VALID = new Set(WATCH_REGIONS.map((r) => r.code));
const LABEL_BY_CODE = new Map(WATCH_REGIONS.map((r) => [r.code, r.label]));

export function getRegionLabel(code: string): string {
	const c = String(code || '')
		.trim()
		.toUpperCase();
	return LABEL_BY_CODE.get(c) || c;
}

/** Guess region from browser locale (en-US → US). Returns null if unknown. */
export function detectRegionFromLocale(locale?: string | null): string | null {
	const raw = (locale || (typeof navigator !== 'undefined' ? navigator.language : '') || '')
		.trim()
		.toUpperCase();
	if (!raw) return null;

	// en-US / en_US
	const parts = raw.split(/[-_]/);
	const maybe = (parts[1] || parts[0] || '').slice(0, 2);
	if (VALID.has(maybe)) return maybe;

	// bare language fallbacks that usually map ok
	const langMap: Record<string, string> = {
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
		NB: 'NO',
		NN: 'NO',
		PL: 'PL',
		HI: 'IN'
	};
	const lang = parts[0];
	const mapped = langMap[lang];
	return mapped && VALID.has(mapped) ? mapped : null;
}

export function normalizeRegion(code?: string | null, fallback = 'US') {
	const c = String(code || '')
		.trim()
		.toUpperCase()
		.slice(0, 2);
	return VALID.has(c) ? c : fallback;
}
