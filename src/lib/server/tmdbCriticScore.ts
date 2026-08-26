/** Map TMDB's 0–10 vote average to a 0–100 critic-style meter for RT-like badges. */
export function tmdbCriticPercent(voteAverage: number | null | undefined): number | null {
	if (voteAverage == null || !Number.isFinite(voteAverage) || voteAverage <= 0) return null;
	return Math.max(1, Math.min(100, Math.round(voteAverage * 10)));
}
