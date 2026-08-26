// bumping token limits and sanitizing gemini response strings so json parsing never crashes into catalog fallback

/** peel ```json fences and leading junk before the first object/array */
export function stripJsonFences(raw: string): string {
	let s = (raw || '').trim();
	if (s.startsWith('```')) {
		s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
	}
	const a = s.search(/[\[{]/);
	if (a > 0) s = s.slice(a);
	return s.trim();
}

/** gemini keeps putting raw double quotes inside strings and breaking the parser */
export function escapeInternalQuotes(jsonish: string): string {
	let out = '';
	let inString = false;
	let escaped = false;
	for (let i = 0; i < jsonish.length; i++) {
		const c = jsonish[i];
		if (escaped) {
			out += c;
			escaped = false;
			continue;
		}
		if (c === '\\' && inString) {
			out += c;
			escaped = true;
			continue;
		}
		if (c === '"') {
			if (!inString) {
				inString = true;
				out += c;
			} else {
				const rest = jsonish.slice(i + 1);
				if (/^\s*[,:}\]]/.test(rest) || /^\s*$/.test(rest)) {
					inString = false;
					out += c;
				} else {
					out += '\\"';
				}
			}
			continue;
		}
		out += c;
	}
	return out;
}

/** close cut-off strings / braces when max tokens chops the reply mid-JSON */
export function closeTruncatedJson(jsonish: string): string {
	let inString = false;
	let escaped = false;
	const stack: string[] = [];

	for (let i = 0; i < jsonish.length; i++) {
		const c = jsonish[i];
		if (inString) {
			if (escaped) {
				escaped = false;
				continue;
			}
			if (c === '\\') {
				escaped = true;
				continue;
			}
			if (c === '"') inString = false;
			continue;
		}
		if (c === '"') {
			inString = true;
			continue;
		}
		if (c === '{') stack.push('}');
		else if (c === '[') stack.push(']');
		else if (c === '}' || c === ']') {
			if (stack.length && stack[stack.length - 1] === c) stack.pop();
		}
	}

	let out = jsonish;
	if (escaped) out += ' ';
	if (inString) out += '"';
	out = out.replace(/,\s*$/, '');
	while (stack.length) out += stack.pop();
	return out;
}

export function repairJsonText(raw: string): string {
	let s = stripJsonFences(raw);
	s = s.replace(/^\uFEFF/, '');
	s = s.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"');
	s = s.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
	s = s.replace(/,\s*([}\]])/g, '$1');
	s = escapeInternalQuotes(s);
	s = closeTruncatedJson(s);
	s = s.replace(/,\s*([}\]])/g, '$1');
	return s;
}

export function safeParseGeminiJson(raw: string): any {
	const tries = [
		repairJsonText(raw),
		closeTruncatedJson(escapeInternalQuotes(stripJsonFences(raw))),
		stripJsonFences(raw),
		(raw || '').trim()
	];
	let lastErr: unknown = null;
	for (const t of tries) {
		if (!t) continue;
		try {
			return JSON.parse(t);
		} catch (e) {
			lastErr = e;
		}
	}
	const snippet = String(raw || '').slice(0, 600);
	console.error(
		'gemini json parse failed',
		lastErr instanceof Error ? lastErr.message : lastErr,
		'snippet:',
		snippet
	);
	throw lastErr || new Error('model spat out unparseable junk');
}
