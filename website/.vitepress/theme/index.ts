/* eslint-disable simple-import-sort/imports */

import { createTheme, messagesFromGlob } from '../shared/theme'

import Logo from './icons/logo.svg?skipsvgo'
import { loadStats } from './stats'
import VersionLabel from './VersionLabel.vue'
// Must come after the theme so the brand colors win
import './custom.css'

export default createTheme({
	messages: messagesFromGlob(
		import.meta.glob('../../src/locales/*.json', { eager: true, import: 'default' }),
	),
	logo: Logo,
	stats: loadStats,
	showcase: [
		{ key: 'project', image: '/screenshots/project.png' },
		{ key: 'user', image: '/screenshots/user.png' },
		{ key: 'organization', image: '/screenshots/organization.png' },
		{ key: 'tracking', image: '/screenshots/tracking.png' },
		{ key: 'identify', image: '/screenshots/identify.png' },
		{ key: 'options', image: '/screenshots/options.png' },
		{ key: 'donate', image: '/screenshots/donate.png' },
	],
	showcaseFit: 'contain',
	footerLinks: [
		{ key: 'footer.privacy', link: '/privacy' },
		{ key: 'footer.terms', link: '/terms' },
	],
	enhanceApp({ app }) {
		app.component('VersionLabel', VersionLabel)
	},
})
