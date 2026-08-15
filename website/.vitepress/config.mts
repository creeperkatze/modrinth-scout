import tailwindcss from '@tailwindcss/vite'
import svgLoader from 'vite-svg-loader'
import { defineConfig } from 'vitepress'

export default defineConfig({
	title: 'Modrinth Scout',
	description: 'A Discord bot for discovering, exploring, and tracking projects on Modrinth.',
	cleanUrls: true,
	head: [['link', { rel: 'icon', type: 'image/png', href: '/favicon.png' }]],
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
		footer: {
			message: '<a href="/privacy">Privacy</a> · <a href="/terms">Terms</a>',
		},
	},
})
