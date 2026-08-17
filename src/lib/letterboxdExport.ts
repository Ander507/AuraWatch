// letterboxd api is private, so we'll just format it as a markdown checklist for them

export type LetterboxdPick = {
	title: string;
	year?: string | null;
};

/** Turn movie/TV picks into a markdown checklist ready to paste into Letterboxd notes / lists. */
export function formatLetterboxdChecklist(items: LetterboxdPick[]): string {
	const lines = items
		.map((item) => {
			const title = (item.title || '').trim();
			if (!title) return null;
			const year = item.year != null ? String(item.year).trim() : '';
			const label = year ? `${title} (${year})` : title;
			return `- [ ] ${label}`;
		})
		.filter((line): line is string => line != null);

	return ['# AuraWatch picks', '', ...lines].join('\n');
}
