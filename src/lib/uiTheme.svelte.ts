export type UiTheme = 'desktop' | 'minimal';
export type DeskMode = 'light' | 'dark';

export const UI_THEME_KEY = 'aurawatch_ui';
export const DESK_MODE_KEY = 'aurawatch_desk_mode';

// one shared theme blob so /list/[slug] and the home page don't drift
export const ui = $state({
	theme: 'desktop' as UiTheme,
	deskMode: 'light' as DeskMode
});

export function themeBackground(theme: UiTheme = ui.theme, deskMode: DeskMode = ui.deskMode) {
	if (theme === 'minimal') return '#0E0E12';
	return deskMode === 'dark' ? '#0b0d11' : '#7b8a9d';
}

export function applyThemeToDocument(
	theme: UiTheme = ui.theme,
	deskMode: DeskMode = ui.deskMode
) {
	if (typeof document === 'undefined') return;
	document.documentElement.dataset.ui = theme;
	document.documentElement.dataset.desk = theme === 'desktop' ? deskMode : '';
	document.documentElement.style.colorScheme = theme === 'minimal' || deskMode === 'dark' ? 'dark' : 'light';
	const bg = themeBackground(theme, deskMode);
	document.body.style.background = bg;
	const meta = document.querySelector('meta[name="theme-color"]');
	if (meta) meta.setAttribute('content', bg);
}

export function setUiTheme(theme: UiTheme) {
	ui.theme = theme;
	try {
		localStorage.setItem(UI_THEME_KEY, theme);
	} catch {
		/* shrug */
	}
	applyThemeToDocument();
}

export function setDeskMode(mode: DeskMode) {
	ui.deskMode = mode;
	try {
		localStorage.setItem(DESK_MODE_KEY, mode);
	} catch {
		/* shrug */
	}
	applyThemeToDocument();
}

export function hydrateUiTheme() {
	try {
		const saved = localStorage.getItem(UI_THEME_KEY);
		if (saved === 'minimal' || saved === 'desktop') {
			ui.theme = saved;
		}
		const desk = localStorage.getItem(DESK_MODE_KEY);
		if (desk === 'light' || desk === 'dark') {
			ui.deskMode = desk;
		}
	} catch {
		/* shrug */
	}
	applyThemeToDocument();
}
