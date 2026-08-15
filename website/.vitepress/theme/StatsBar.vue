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
	<div v-if="stats" class="relative px-6 pb-4 sm:px-12 vp:px-16">
		<div class="mx-auto max-w-6xl">
			<div class="-m-2 flex flex-wrap">
				<div v-for="card in cards" :key="card.label" class="w-full p-2 sm:w-1/2 vp:w-1/4">
					<article
						class="flex h-full flex-col items-center rounded-xl border border-(--vp-c-bg-soft) bg-(--vp-c-bg-soft) p-6 text-center"
					>
						<span class="stat-value">{{ card.value }}</span>
						<span class="mt-1 text-sm font-medium text-(--vp-c-text-2)">{{ card.label }}</span>
					</article>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
.stat-value {
	font-size: 2.25rem;
	font-weight: 700;
	line-height: 1;
	background-image: linear-gradient(120deg, var(--vp-c-brand-1) 30%, var(--vp-c-brand-2));
	-webkit-background-clip: text;
	background-clip: text;
	color: transparent;
}
</style>
