/** Anti-vibe / exclusion constraints for Gemini prompts */

export function parseAntiVibe(raw: unknown): string {
	return String(raw ?? '')
		.trim()
		.replace(/\s+/g, ' ')
		.slice(0, 280);
}

export function antiVibePromptBlock(anti: string): string {
	if (!anti) return '';
	return `- Anti-vibe / Exclude (HARD): MUST NOT include or resemble: '${anti}'`;
}

export function antiVibeStrictRule(anti: string): string {
	if (!anti) return '';
	return `CRITICAL RULE: The recommendation MUST NOT contain any elements of: ${anti}. Reject anything that leans into those themes, tones, tropes, or genres — even as a subplot.`;
}
