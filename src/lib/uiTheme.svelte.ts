export type UiTheme = 'desktop' | 'minimal';

export const UI_THEME_KEY = 'aurawatch_ui';

// one shared theme blob so /list/[slug] and the home page don't drift
export const ui = $state({
	theme: 'desktop' as UiTheme
});

export function applyThemeToDocument(theme: UiTheme) {
	if (typeof document === 'undefined') return;
	document.documentElement.dataset.ui = theme;
	document.body.style.background = theme === 'minimal' ? '#0E0E12' : '#7b8a9d';
	const meta = document.querySelector('meta[name="theme-color"]');
	if (meta) meta.setAttribute('content', theme === 'minimal' ? '#0E0E12' : '#7B8A9D');
}

export function setUiTheme(theme: UiTheme) {
	ui.theme = theme;
	try {
		localStorage.setItem(UI_THEME_KEY, theme);
	} catch {
		/* shrug */
	}
	applyThemeToDocument(theme);
}

export function hydrateUiTheme() {
	try {
		const saved = localStorage.getItem(UI_THEME_KEY);
		if (saved === 'minimal' || saved === 'desktop') {
			ui.theme = saved;
		}
	} catch {
		/* shrug */
	}
	applyThemeToDocument(ui.theme);
}
