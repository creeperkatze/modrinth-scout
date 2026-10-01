import type { Stat } from '../shared/theme'

interface BotStats {
	guilds: number
	trackedProjects: number
	trackedAuthors: number
	uptime: number | null
}

function formatUptime(value: number, locale: string): string {
	// Truncate instead of rounding so e.g. 99.996% never displays as 100.00%
	const format = new Intl.NumberFormat(locale, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
		roundingMode: 'trunc',
	})
	return `${format.format(value)}%`
}

export async function loadStats(): Promise<Stat[]> {
	const res = await fetch('/api/stats')
	if (!res.ok) throw new Error(`stats request failed with status ${res.status}`)
	const stats = (await res.json()) as BotStats

	const list: Stat[] = [
		{ label: (t) => t('stats.servers'), value: stats.guilds },
		{ label: (t) => t('stats.trackedProjects'), value: stats.trackedProjects },
		{ label: (t) => t('stats.trackedAuthors'), value: stats.trackedAuthors },
	]
	if (stats.uptime !== null) {
		list.push({ label: (t) => t('stats.uptime'), value: stats.uptime, format: formatUptime })
	}
	return list
}
