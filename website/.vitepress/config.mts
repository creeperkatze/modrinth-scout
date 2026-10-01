import { defineSiteConfig, readMessages } from './shared/config'

const version = process.env.VERSION

export default defineSiteConfig(
	{
		title: 'Modrinth Scout',
		url: 'https://modrinth-scout.creeperkatze.dev',
		repo: 'creeperkatze/modrinth-scout',
		messages: readMessages(new URL('../src/locales', import.meta.url)),
		nav: (t) => [
			{ text: t('nav.status'), link: 'https://status.creeperkatze.dev', target: '_blank' },
			...(version ? [{ component: 'VersionLabel', props: { version } }] : []),
		],
		socialLinks: [{ icon: 'discord', link: 'https://link.creeperkatze.dev/discord' }],
	},
	{
		themeConfig: {
			logo: '/icon.svg',
			siteTitle: false,
		},
	},
)
