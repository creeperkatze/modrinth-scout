<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

interface Stats {
	guilds: number
	trackedProjects: number
	trackedAuthors: number
	uptime: number | null
}

const stats = ref<Stats | null>(null)

onMounted(async () => {
	try {
		const res = await fetch('/api/stats')
		if (!res.ok) throw new Error(`stats request failed with status ${res.status}`)
		stats.value = await res.json()
	} catch {
		// Stats are a nice-to-have, fail silently rather than showing a broken widget
	}
})

const cards = computed(() => {
	if (!stats.value) return []
	const list = [
		{ label: 'Servers', value: stats.value.guilds.toLocaleString() },
		{ label: 'Tracked Projects', value: stats.value.trackedProjects.toLocaleString() },
		{ label: 'Tracked Authors', value: stats.value.trackedAuthors.toLocaleString() },
	]
	if (stats.value.uptime !== null) {
		list.push({ label: 'Uptime', value: `${stats.value.uptime.toFixed(2)}%` })
	}
	return list
})
</script>

<template>
	<div v-if="cards.length" class="stats-bar">
		<div class="stats-grid">
			<article v-for="card in cards" :key="card.label" class="stat-card">
				<span class="stat-value">{{ card.value }}</span>
				<span class="stat-label">{{ card.label }}</span>
			</article>
		</div>
	</div>
</template>

<style scoped>
.stats-bar {
	position: relative;
	padding: 0 24px 16px;
}

.stats-grid {
	display: grid;
	grid-template-columns: 1fr;
	gap: 16px;
	max-width: 1152px;
	margin: 0 auto;
}

.stat-card {
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
	padding: 24px;
	border-radius: 12px;
	border: 1px solid var(--vp-c-bg-soft);
	background-color: var(--vp-c-bg-soft);
}

.stat-value {
	font-size: 2.25rem;
	font-weight: 700;
	line-height: 1;
	background-image: linear-gradient(120deg, var(--vp-c-brand-1) 30%, var(--vp-c-brand-2));
	-webkit-background-clip: text;
	background-clip: text;
	color: transparent;
}

.stat-label {
	margin-top: 4px;
	font-size: 0.875rem;
	font-weight: 500;
	color: var(--vp-c-text-2);
}

@media (min-width: 640px) {
	.stats-bar {
		padding: 0 48px 16px;
	}

	.stats-grid {
		grid-template-columns: repeat(2, 1fr);
	}
}

@media (min-width: 960px) {
	.stats-bar {
		padding: 0 64px 16px;
	}

	.stats-grid {
		grid-template-columns: repeat(4, 1fr);
	}
}
</style>
