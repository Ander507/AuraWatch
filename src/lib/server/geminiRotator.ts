// ============================================
// gemini key picker + model discovery
// .env: GEMINI_API_KEYS=key1,key2,key3
// model lookup ported from gemini.py get_available_model()
// ============================================

import { env } from '$env/dynamic/private';

let startIdx = 0;

// Map<keyPrefix, expiresAt>
const badKeys = new Map<string, number>();
const BAD_TTL_MS = 1000 * 60 * 5;

// cache model name per key so we dont list models every request
// values look like "models/gemini-2.0-flash" (with the models/ prefix!!)
const modelCache = new Map<string, string>();

// Prefer these before listModels — cuts a cold-start RTT when cache is empty (Vercel).
const KNOWN_FLASH_MODELS = [
	'models/gemini-2.5-flash',
	'models/gemini-2.0-flash',
	'models/gemini-flash-latest',
	'models/gemini-1.5-flash'
];

function keyId(k: string) {
	return k.slice(0, 12);
}

function markBad(k: string, why?: string) {
	console.log('marking key bad', keyId(k), why || '');
	badKeys.set(keyId(k), Date.now() + BAD_TTL_MS);
}

function isBad(k: string) {
	const until = badKeys.get(keyId(k));
	if (!until) return false;
	if (Date.now() > until) {
		badKeys.delete(keyId(k));
		return false;
	}
	return true;
}

function looksLikePlaceholder(k: string) {
	const lower = k.toLowerCase();
	if (/^api\d/i.test(k)) return true;
	if (lower.includes('your_key')) return true;
	if (lower === 'changeme' || lower === 'todo') return true;
	return false;
}

export function grabKeysFromEnv(): string[] {
	const raw = env.GEMINI_API_KEYS || '';
	const keys = raw
		.split(',')
		.map((x) => x.trim())
		.filter((x) => x.length > 8 && !looksLikePlaceholder(x));

	if (!keys.length) {
		for (let i = 1; i <= 6; i++) {
			const v = env[`GEMINI_API_KEY_${i}`];
			if (typeof v === 'string' && v.trim().length > 8 && !looksLikePlaceholder(v.trim())) {
				keys.push(v.trim());
			}
		}
	}

	return keys;
}

export function howManyKeysWeGot() {
	return grabKeysFromEnv().length;
}

/**
 * port of gemini.py get_available_model(key)
 * prefers flash for speed, falls back to first gemini w/ generateContent
 * returns full name like "models/gemini-2.0-flash" or null
 */
export async function getAvailableModel(apiKey: string): Promise<string | null> {
	const cached = modelCache.get(keyId(apiKey));
	if (cached) return cached;

	// Optimistic seed: skip listModels on cold start. callGeminiFlash rediscovers on 404.
	const seed = KNOWN_FLASH_MODELS[0];
	modelCache.set(keyId(apiKey), seed);
	return seed;
}

/** Force listModels discovery (used by /api/health warm-up + 404 recovery). */
export async function discoverModelViaList(apiKey: string): Promise<string | null> {
	const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
	try {
		const resp = await fetch(url);
		if (resp.status !== 200) return null;

		const data = await resp.json();
		const models: any[] = data?.models || [];

		for (const model of models) {
			const name: string | undefined = model?.name;
			const methods: string[] = model?.supportedGenerationMethods || [];
			if (
				name &&
				name.toLowerCase().includes('gemini') &&
				methods.includes('generateContent') &&
				name.toLowerCase().includes('flash')
			) {
				modelCache.set(keyId(apiKey), name);
				return name;
			}
		}

		for (const model of models) {
			const name: string | undefined = model?.name;
			const methods: string[] = model?.supportedGenerationMethods || [];
			if (
				name &&
				name.toLowerCase().includes('gemini') &&
				methods.includes('generateContent')
			) {
				modelCache.set(keyId(apiKey), name);
				return name;
			}
		}

		return null;
	} catch {
		return null;
	}
}

export async function pingKeyToSeeIfItWorks(apiKey: string) {
	// if we can resolve a model, key is good enough
	const model = await getAvailableModel(apiKey);
	if (!model) return { ok: false as const, err: 'No accessible model (key may be invalid or region-locked)' };
	return { ok: true as const, model };
}

export function getNextGeminiKey(): string {
	const theKeys = grabKeysFromEnv();
	if (!theKeys.length) throw new Error('no GEMINI_API_KEYS in .env');

	for (let i = 0; i < theKeys.length; i++) {
		const idx = (startIdx + i) % theKeys.length;
		const k = theKeys[idx];
		if (!isBad(k)) {
			startIdx = (idx + 1) % theKeys.length;
			return k;
		}
	}

	const k = theKeys[startIdx % theKeys.length];
	startIdx = (startIdx + 1) % theKeys.length;
	return k;
}

export async function getWorkingGeminiKey(): Promise<{ key: string; model: string }> {
	const theKeys = grabKeysFromEnv();
	if (!theKeys.length) {
		throw new Error('no GEMINI_API_KEYS in .env (want: GEMINI_API_KEYS=key1,key2,key3)');
	}

	const n = theKeys.length;
	let lastErr = 'no keys left';

	for (let i = 0; i < n; i++) {
		const idx = (startIdx + i) % n;
		const k = theKeys[idx];
		if (isBad(k)) {
			lastErr = 'all keys on cooldown';
			continue;
		}

		const model = await getAvailableModel(k);
		if (model) {
			startIdx = (idx + 1) % n;
			return { key: k, model };
		}

		markBad(k, 'no model');
		lastErr = 'No accessible model';
	}

	throw new Error(lastErr);
}

export async function callGeminiFlash(
	promptText: string,
	opts?: { model?: string; json?: boolean; maxOutputTokens?: number }
) {
	const theKeys = grabKeysFromEnv();
	if (!theKeys.length) throw new Error('no GEMINI_API_KEYS configured');

	const body: Record<string, any> = {
		contents: [{ parts: [{ text: promptText }] }],
		generationConfig: {
			temperature: 0.7,
			// bumping token limits and sanitizing gemini response strings so json parsing never crashes into catalog fallback
			maxOutputTokens: opts?.maxOutputTokens ?? 4096,
			// json mime makes gemini less chaotic (sometimes)
			...(opts?.json ? { responseMimeType: 'application/json' } : {})
		}
	};

	let lastErr: any = null;

	for (let i = 0; i < theKeys.length; i++) {
		const idx = (startIdx + i) % theKeys.length;
		const keyToUse = theKeys[idx];
		if (isBad(keyToUse) && i < theKeys.length - 1) continue;

		// discover model for THIS key (dont hardcode gemini-1.5-flash — google yeeted it)
		// opts.model can override, otherwise list models like gemini.py
		let modelPath = opts?.model || (await getAvailableModel(keyToUse));
		if (!modelPath) {
			markBad(keyToUse, 'no model');
			lastErr = new Error('No accessible model (key may be invalid or region-locked)');
			continue;
		}

		// python does: /v1beta/{model}:generateContent where model already has "models/" prefix
		// if someone passes bare "gemini-2.0-flash" we patch it
		if (!modelPath.startsWith('models/')) {
			modelPath = `models/${modelPath}`;
		}

		const url = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${keyToUse}`;

		try {
			const res = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (res.status === 429) {
				markBad(keyToUse, '429 quota/rate');
				lastErr = new Error('rate limited (429)');
				continue;
			}

			if (res.status === 403) {
				const txt = await res.text();
				markBad(keyToUse, '403');
				lastErr = new Error(`gemini sad: 403 ${txt.slice(0, 120)}`);
				continue;
			}

			if (res.status === 404) {
				// model gone for this key — try next known flash, then listModels
				modelCache.delete(keyId(keyToUse));
				let retryModel: string | null = null;
				const failed = modelPath;
				for (const candidate of KNOWN_FLASH_MODELS) {
					if (candidate === failed) continue;
					retryModel = candidate;
					break;
				}
				if (!retryModel) {
					retryModel = await discoverModelViaList(keyToUse);
				} else {
					modelCache.set(keyId(keyToUse), retryModel);
				}
				if (retryModel && retryModel !== modelPath) {
					const retryUrl = `https://generativelanguage.googleapis.com/v1beta/${retryModel}:generateContent?key=${keyToUse}`;
					const res2 = await fetch(retryUrl, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(body)
					});
					if (res2.ok) {
						const data = await res2.json();
						const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
						startIdx = (idx + 1) % theKeys.length;
						return {
							text: typeof txt === 'string' ? txt : JSON.stringify(txt),
							raw: data,
							keyUsed: keyId(keyToUse),
							model: retryModel
						};
					}
					// known seed failed — fall through to listModels once
					if (!retryModel.includes('flash-latest')) {
						const listed = await discoverModelViaList(keyToUse);
						if (listed && listed !== retryModel) {
							const res3 = await fetch(
								`https://generativelanguage.googleapis.com/v1beta/${listed}:generateContent?key=${keyToUse}`,
								{
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify(body)
								}
							);
							if (res3.ok) {
								const data = await res3.json();
								const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
								startIdx = (idx + 1) % theKeys.length;
								return {
									text: typeof txt === 'string' ? txt : JSON.stringify(txt),
									raw: data,
									keyUsed: keyId(keyToUse),
									model: listed
								};
							}
						}
					}
				}
				const txt = await res.text();
				// dont mark key bad forever on 404 — model name issue not key issue
				lastErr = new Error(`model not found: ${txt.slice(0, 120)}`);
				continue;
			}

			if (!res.ok) {
				const txt = await res.text();
				lastErr = new Error(`gemini sad: ${res.status} ${txt.slice(0, 200)}`);
				continue;
			}

			const data = await res.json();
			const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
			const finishReason = data?.candidates?.[0]?.finishReason;
			if (finishReason && finishReason !== 'STOP') {
				console.warn('gemini finishReason', finishReason, 'len', String(txt).length);
			}

			startIdx = (idx + 1) % theKeys.length;

			return {
				text: typeof txt === 'string' ? txt : JSON.stringify(txt),
				raw: data,
				keyUsed: keyId(keyToUse),
				model: modelPath,
				finishReason
			};
		} catch (err) {
			lastErr = err;
			markBad(keyToUse, 'network?');
		}
	}

	throw lastErr || new Error('none of the GEMINI_API_KEYS worked rip');
}
