<script lang="ts">
	import './layout.css';
	import { dev } from '$app/environment';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';
	import { SITE, seoJsonLd } from '$lib/seo';

	injectAnalytics({ mode: dev ? 'development' : 'production' });

	let { children } = $props();

	const jsonLd = seoJsonLd();
</script>

<svelte:head>
	<title>{SITE.title}</title>
	<meta name="description" content={SITE.description} />
	<meta name="keywords" content={SITE.keywords} />
	<meta name="author" content="AuraWatch" />
	<meta name="robots" content="index, follow, max-image-preview:large" />
	<meta name="googlebot" content="index, follow" />
	<meta
		name="google-site-verification"
		content="xsUD-hMJpuROysPiXFy9UytXpXlyX66gkDON_xda4AE"
	/>
	<link rel="canonical" href={SITE.url} />

	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={SITE.name} />
	<meta property="og:url" content={SITE.url} />
	<meta property="og:title" content={SITE.title} />
	<meta property="og:description" content={SITE.description} />
	<meta property="og:locale" content="en_US" />

	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={SITE.title} />
	<meta name="twitter:description" content={SITE.description} />

	<meta name="application-name" content={SITE.name} />
	<meta name="apple-mobile-web-app-title" content={SITE.name} />

	{@html `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`}
</svelte:head>

<!-- making sure the outermost shell can't stretch past the phone and leave that black void -->
<div class="w-full max-w-full overflow-x-hidden">
	{@render children()}
	<!-- dropping the legally required amazon disclaimer in the footer so our affiliate account doesn't get nuked -->
	<!-- keeping the text small and muted so it doesn't ruin the brutalist aesthetic -->
	<footer
		class="w-full text-xs text-gray-500 dark:text-zinc-500 text-center p-4 max-lg:pb-24"
	>
		<!-- making sure it sits above the mobile bottom nav so it's actually visible -->
		AuraWatch is a free service. 'Buy on Amazon' links are affiliate links. As an Amazon Associate,
		we earn from qualifying purchases.
	</footer>
</div>
