<script setup lang="ts">
import { CheckIcon, XIcon } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'

type Status = 'success' | 'cancelled' | 'expired' | 'error'

const RESULTS: Record<Status, { title: string; message?: string }> = {
	success: { title: 'Account linked' },
	cancelled: {
		title: 'Linking cancelled',
		message: 'No account was linked. Run `/account link` in Discord to try again.',
	},
	expired: {
		title: 'Link expired',
		message:
			'This link has expired or was already used. Run `/account link` in Discord to get a new one.',
	},
	error: {
		title: 'Something went wrong',
		message: 'Modrinth did not confirm your account. Run `/account link` in Discord to try again.',
	},
}

const status = ref<Status | null>(null)
const username = ref('')
const avatarUrl = ref<string | null>(null)

function renderMessage(message: string): string {
	return message.replace(/`([^`]+)`/g, '<code>$1</code>')
}

const result = computed(() => (status.value ? RESULTS[status.value] : null))
const profileUrl = computed(() => `https://modrinth.com/user/${encodeURIComponent(username.value)}`)

onMounted(async () => {
	const params = new URLSearchParams(window.location.search)
	const value = params.get('status')
	status.value = value && Object.hasOwn(RESULTS, value) ? (value as Status) : 'error'
	username.value = params.get('username') ?? ''

	if (status.value !== 'success' || !username.value) return
	try {
		// Looked up from the username rather than passed in the URL, so the page never shows an
		// arbitrary image. The avatar is a nice-to-have, the card still works without it
		const res = await fetch(
			`https://api.modrinth.com/v3/user/${encodeURIComponent(username.value)}`,
		)
		if (res.ok) avatarUrl.value = ((await res.json()) as { avatar_url?: string }).avatar_url ?? null
	} catch {
		// Keep the placeholder avatar
	}
})
</script>

<template>
	<div v-if="result" class="link-result">
		<article class="card">
			<div class="badge" :class="{ 'icon-only': status !== 'success' }">
				<template v-if="status === 'success'">
					<img v-if="avatarUrl" class="avatar" :src="avatarUrl" alt="" />
					<div v-else class="avatar" />
					<span class="status success">
						<CheckIcon :stroke-width="3" aria-hidden="true" />
					</span>
				</template>
				<span v-else class="status error">
					<XIcon :stroke-width="2.5" aria-hidden="true" />
				</span>
			</div>

			<h1>{{ result.title }}</h1>
			<p v-if="status === 'success'">
				Your Discord account is now linked to
				<a :href="profileUrl" target="_blank" rel="noopener">{{ username }}</a>
				on Modrinth.
			</p>
			<p v-else v-html="renderMessage(result.message ?? '')"></p>

			<p class="hint">You can close this tab.</p>
		</article>
	</div>
</template>

<style scoped>
.link-result {
	display: grid;
	place-items: center;
	min-height: calc(100vh - var(--vp-nav-height) - 160px);
	padding: 48px 24px;
}

.card {
	width: 100%;
	max-width: 400px;
	padding: 32px 28px;
	text-align: center;
	background: var(--vp-c-bg-soft);
	border: 1px solid var(--vp-c-bg-soft);
	border-radius: 12px;
}

.badge {
	position: relative;
	width: 88px;
	height: 88px;
	margin: 0 auto 20px;
}

.avatar {
	display: block;
	width: 88px;
	height: 88px;
	border-radius: 50%;
	object-fit: cover;
	background: var(--vp-c-default-soft);
}

.status {
	position: absolute;
	right: -2px;
	bottom: -2px;
	display: grid;
	place-items: center;
	width: 32px;
	height: 32px;
	border-radius: 50%;
	border: 4px solid var(--vp-c-bg-soft);
}

.status svg {
	width: 16px;
	height: 16px;
	color: #fff;
}

.badge.icon-only .status {
	position: static;
	width: 88px;
	height: 88px;
	border: 0;
}

.badge.icon-only .status svg {
	width: 40px;
	height: 40px;
}

.success {
	background: var(--vp-c-brand-1);
}

.error {
	background: var(--vp-c-danger-1);
}

h1 {
	margin: 0 0 8px;
	font-size: 22px;
	font-weight: 700;
	line-height: 1.3;
}

p {
	margin: 0;
	color: var(--vp-c-text-2);
	font-size: 15px;
	line-height: 1.5;
}

p a {
	color: var(--vp-c-text-1);
	font-weight: 700;
	text-decoration: none;
}

p :deep(code) {
	font-size: 0.85em;
	font-family: var(--vp-font-family-mono);
	background-color: var(--vp-c-default-soft);
	border-radius: 4px;
	padding: 2px 6px;
	color: var(--vp-c-text-1);
}

.hint {
	margin-top: 16px;
	font-size: 13px;
}
</style>
