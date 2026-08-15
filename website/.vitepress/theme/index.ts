/* eslint-disable simple-import-sort/imports */

import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'

import DonateButton from './DonateButton.vue'
import HeroActions from './HeroActions.vue'
import HeroLogo from './HeroLogo.vue'
import StatsBar from './StatsBar.vue'
import './tailwind.css'
import './custom.css'

export default {
	extends: DefaultTheme,
	Layout() {
		return h(DefaultTheme.Layout, null, {
			'nav-bar-content-after': () => h(DonateButton),
			'home-hero-info-before': () => h(HeroLogo),
			'home-hero-actions-after': () => h(HeroActions),
			'home-features-before': () => h(StatsBar),
		})
	},
}
