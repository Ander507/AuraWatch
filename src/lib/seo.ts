/** Site SEO defaults — geared at “can’t find what to watch” discovery */
export const SITE = {
	name: 'AuraWatch',
	version: '0.3.0',
	url: 'https://aurawatch.org',
	title: 'AuraWatch — Can’t Decide What to Watch? Get One Perfect Pick',
	description:
		'Stuck scrolling with nothing to watch — or play? AuraWatch picks a movie, TV show, anime, song, or game that matches your vibe — by genre, decade, and titles you already love. Stop decision paralysis.',
	keywords:
		'what to watch, cant find what to watch, nothing to watch, movie recommendations, TV show recommendations, anime recommendations, song recommendations, game recommendations, video game recommendations, netflix decision fatigue, pick a movie for me, what should I watch tonight, media recommender, vibe based recommendations'
} as const;

export function seoJsonLd() {
	return {
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'WebApplication',
				'@id': `${SITE.url}/#app`,
				name: SITE.name,
				url: SITE.url,
				description: SITE.description,
				applicationCategory: 'EntertainmentApplication',
				operatingSystem: 'Web',
				offers: {
					'@type': 'Offer',
					price: '0',
					priceCurrency: 'USD'
				},
				featureList: [
					'Movie recommendations',
					'TV series recommendations',
					'Anime recommendations',
					'Song recommendations',
					'Video game recommendations',
					'Vibe and genre matching',
					'Similar-to title search',
					'Where to watch links',
					'Group Vibe Rooms'
				]
			},
			{
				'@type': 'WebSite',
				'@id': `${SITE.url}/#website`,
				name: SITE.name,
				url: SITE.url,
				description: SITE.description,
				publisher: { '@id': `${SITE.url}/#app` },
				potentialAction: {
					'@type': 'SearchAction',
					target: {
						'@type': 'EntryPoint',
						urlTemplate: `${SITE.url}/?q={search_term_string}`
					},
					'query-input': 'required name=search_term_string'
				}
			},
			{
				'@type': 'FAQPage',
				'@id': `${SITE.url}/#faq`,
				mainEntity: [
					{
						'@type': 'Question',
						name: "Can't find what to watch tonight?",
						acceptedAnswer: {
							'@type': 'Answer',
							text: 'AuraWatch recommends a movie, TV show, anime, song, or game based on your genres, decade, notes, and titles you already like — so you stop scrolling and start watching or playing.'
						}
					},
					{
						'@type': 'Question',
						name: 'How is AuraWatch different from random Netflix browsing?',
						acceptedAnswer: {
							'@type': 'Answer',
							text: 'Instead of endless rows, AuraWatch returns a short list of matches with posters, trailers or song previews, and where-to-watch, listen, or store links tailored to your vibe.'
						}
					},
					{
						'@type': 'Question',
						name: 'Does AuraWatch recommend songs too?',
						acceptedAnswer: {
							'@type': 'Answer',
							text: 'Yes. Switch to Songs mode to get track picks with Apple Music, Spotify, and YouTube listen links plus audio previews when available.'
						}
					},
					{
						'@type': 'Question',
						name: 'Can AuraWatch recommend video games?',
						acceptedAnswer: {
							'@type': 'Answer',
							text: 'Yes. Switch to Games mode for vibe-based picks enriched with IGDB covers, platforms, ESRB/PEGI ratings, and store links like Steam or Epic.'
						}
					}
				]
			}
		]
	};
}
