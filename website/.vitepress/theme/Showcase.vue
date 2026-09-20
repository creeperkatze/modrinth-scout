<script setup lang="ts">
interface ShowcaseItem {
	title: string
	details: string
	image: string
}

const items: ShowcaseItem[] = [
	{
		title: 'Every project detail, right in Discord',
		details:
			'`/project` brings up downloads, followers, versions, loaders, and categories, with buttons straight to the source, wiki, issues, and Discord.',
		image: '/screenshots/project.png',
	},
	{
		title: 'Look up any creator',
		details:
			'`/user` shows a profile, badges, and top projects at a glance, so you never have to leave Discord to check who made something.',
		image: '/screenshots/user.png',
	},
	{
		title: 'Or the whole team behind it',
		details:
			'`/organization` does the same for teams, with combined download counts and their most popular projects.',
		image: '/screenshots/organization.png',
	},
	{
		title: 'One dashboard for everything you track',
		details:
			'`/tracking manage` lets you pause notifications, set the channel and ping role, and track whole authors, so every new project they publish gets picked up automatically.',
		image: '/screenshots/tracking.png',
	},
	{
		title: 'Identify a mod by its file',
		details:
			'Drop a .jar into `/identify` and get back the exact Modrinth project and version it came from.',
		image: '/screenshots/identify.png',
	},
	{
		title: 'Turn features on or off, per server',
		details:
			'`/options` controls auto-embeds for plain Modrinth links, jar identification in chat, and changelog summaries.',
		image: '/screenshots/options.png',
	},
	{
		title: 'Support development, unlock perks',
		details:
			'Modrinth Scout is free to use. Donating on Ko-fi raises your tracking limits and speeds up update checks.',
		image: '/screenshots/donate.png',
	},
]

function renderDetails(details: string): string {
	return details.replace(/`([^`]+)`/g, '<code>$1</code>')
}
</script>

<template>
	<div class="showcase">
		<div class="container">
			<div class="showcase-inner">
				<article
					v-for="(item, index) in items"
					:key="item.title"
					class="showcase-row"
					:class="{ reverse: index % 2 === 1 }"
				>
					<div class="showcase-media">
						<img :src="item.image" :alt="item.title" loading="lazy" decoding="async" />
					</div>
					<div class="showcase-text">
						<h3>{{ item.title }}</h3>
						<p v-html="renderDetails(item.details)"></p>
					</div>
				</article>
			</div>
		</div>
	</div>
</template>

<style scoped>
.showcase {
	position: relative;
	padding: 32px 24px 8px;
}

.container {
	max-width: 1152px;
	margin: 0 auto;
}

.showcase-inner {
	display: flex;
	flex-direction: column;
	gap: 64px;
}

.showcase-row {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 24px;
}

.showcase-media {
	flex: 1 1 0;
	width: 100%;
	height: 340px;
	display: flex;
	align-items: center;
	justify-content: center;
	background-color: var(--vp-c-bg-soft);
	border-radius: 12px;
	padding: 20px;
}

.showcase-media img {
	max-width: 100%;
	max-height: 100%;
	width: auto;
	height: auto;
	border-radius: 8px;
}

.showcase-text {
	flex: 1 1 0;
	width: 100%;
}

.showcase-text h3 {
	font-size: 1.25rem;
	font-weight: 600;
	line-height: 1.4;
	margin: 0 0 8px;
	letter-spacing: -0.01em;
}

.showcase-text p {
	font-size: 0.95rem;
	line-height: 1.6;
	color: var(--vp-c-text-2);
	margin: 0;
}

.showcase-text p :deep(code) {
	font-size: 0.85em;
	font-family: var(--vp-font-family-mono);
	background-color: var(--vp-c-bg-soft);
	border-radius: 4px;
	padding: 2px 6px;
	color: var(--vp-c-text-1);
}

@media (min-width: 640px) {
	.showcase {
		padding-top: 48px;
		padding-left: 48px;
		padding-right: 48px;
	}

	.showcase-media {
		height: 420px;
	}
}

@media (min-width: 768px) {
	.showcase-row {
		flex-direction: row;
		align-items: center;
		gap: 48px;
	}

	.showcase-row.reverse {
		flex-direction: row-reverse;
	}
}

@media (min-width: 960px) {
	.showcase {
		padding-left: 64px;
		padding-right: 64px;
	}
}
</style>
