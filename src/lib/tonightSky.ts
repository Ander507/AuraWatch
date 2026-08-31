/** Sniff the actual night so Surprise Me isn't rolling summer-beach at 1am in sleet. */

export type TonightSky = {
	tempC: number | null;
	code: number | null;
	label: string;
	vibe: string;
	hourHint: string;
	preferShort: boolean;
	source: 'weather' | 'clock';
};

function hourHint(d = new Date()): { hint: string; preferShort: boolean } {
	const h = d.getHours();
	if (h >= 0 && h < 6) {
		return { hint: 'dead hours — keep it short or hypnotic', preferShort: true };
	}
	if (h < 12) {
		return { hint: 'morning brain — lighter or backgroundable', preferShort: false };
	}
	if (h < 17) {
		return { hint: 'afternoon hang — something you can pause', preferShort: false };
	}
	if (h < 21) {
		return { hint: 'prime time — commit to a real pick', preferShort: false };
	}
	return { hint: 'late night — one sitting, no 3-hour epics', preferShort: true };
}

function skyFromCode(code: number, tempC: number | null): { label: string; vibe: string } {
	if (code === 0) {
		return {
			label: tempC != null && tempC <= 4 ? 'clear & freezing' : 'clear night',
			vibe:
				tempC != null && tempC <= 4
					? 'crystal-clear freezing night, sharp and lonely'
					: 'clear sky, cinematic and a little restless'
		};
	}
	if (code <= 3) {
		return { label: 'hazy', vibe: 'soft overcast, low-stakes cozy' };
	}
	if (code <= 48) {
		return { label: 'fog', vibe: 'foggy, muffled, slow-burn mystery' };
	}
	if (code <= 57) {
		return { label: 'drizzle', vibe: 'rainy-window melancholic, stay in' };
	}
	if (code <= 67) {
		return { label: 'rain', vibe: 'hard rain, thunder optional, bunker movie' };
	}
	if (code <= 77) {
		return { label: 'snow', vibe: 'snowed-in, warm indoor, found family' };
	}
	if (code <= 82) {
		return { label: 'downpour', vibe: 'violent rain, tense and loud' };
	}
	if (code <= 86) {
		return { label: 'snow squall', vibe: 'blizzard isolation, cabin fever' };
	}
	return { label: 'storm', vibe: 'storm night, electric and a bit unwise' };
}

export function clockOnlySky(d = new Date()): TonightSky {
	const { hint, preferShort } = hourHint(d);
	return {
		tempC: null,
		code: null,
		label: hint.split(' — ')[0] || 'tonight',
		vibe: preferShort ? 'late-night one-sitting pick' : 'something that fits this hour',
		hourHint: hint,
		preferShort,
		source: 'clock'
	};
}

export async function readTonightSky(): Promise<TonightSky> {
	const clock = clockOnlySky();
	if (typeof navigator === 'undefined' || !navigator.geolocation) return clock;

	const pos = await new Promise<GeolocationPosition | null>((resolve) => {
		const t = setTimeout(() => resolve(null), 4500);
		navigator.geolocation.getCurrentPosition(
			(p) => {
				clearTimeout(t);
				resolve(p);
			},
			() => {
				clearTimeout(t);
				resolve(null);
			},
			{ maximumAge: 30 * 60 * 1000, timeout: 4000, enableHighAccuracy: false }
		);
	});
	if (!pos) return clock;

	try {
		const url = `https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current=temperature_2m,weather_code&forecast_days=1`;
		const res = await fetch(url);
		if (!res.ok) return clock;
		const data = await res.json();
		const tempC =
			typeof data?.current?.temperature_2m === 'number' ? data.current.temperature_2m : null;
		const code =
			typeof data?.current?.weather_code === 'number' ? data.current.weather_code : 0;
		const sky = skyFromCode(code, tempC);
		return {
			tempC,
			code,
			label: sky.label,
			vibe: sky.vibe,
			hourHint: clock.hourHint,
			preferShort: clock.preferShort,
			source: 'weather'
		};
	} catch {
		return clock;
	}
}

export function skyHeadline(sky: TonightSky): string {
	const temp = sky.tempC != null ? `${Math.round(sky.tempC)}°` : '';
	const bits = [sky.label, temp, sky.hourHint].filter(Boolean);
	return bits.join(' · ');
}
