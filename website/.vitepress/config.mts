import tailwindcss from '@tailwindcss/vite'
import svgLoader from 'vite-svg-loader'
import { defineConfig } from 'vitepress'

const title = 'Modrinth Scout'
const description = 'A Discord bot for discovering, exploring, and tracking projects on Modrinth.'
const url = 'https://modrinth-scout.creeperkatze.dev'
const image = `${url}/banner.png`

export default defineConfig({
	title,
	description,
	cleanUrls: true,
	head: [
		['link', { rel: 'icon', type: 'image/png', href: '/favicon.png' }],
		['meta', { property: 'og:type', content: 'website' }],
		['meta', { property: 'og:url', content: url }],
		['meta', { property: 'og:title', content: title }],
		['meta', { property: 'og:description', content: description }],
		['meta', { property: 'og:image', content: image }],
		['meta', { name: 'twitter:card', content: 'summary_large_image' }],
		['meta', { name: 'twitter:title', content: title }],
		['meta', { name: 'twitter:description', content: description }],
		['meta', { name: 'twitter:image', content: image }],
	],
	vite: {
		plugins: [tailwindcss(), svgLoader()],
	},
	themeConfig: {
		logo: '/icon.svg',
		siteTitle: false,
		nav: [{ text: 'Status', link: 'https://status.creeperkatze.dev', target: '_blank' }],
		socialLinks: [
			{ icon: 'github', link: 'https://github.com/creeperkatze/modrinth-scout' },
			{ icon: 'discord', link: 'https://link.creeperkatze.dev/discord' },
		],
	},
})
