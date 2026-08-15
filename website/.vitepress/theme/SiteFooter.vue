<script setup lang="ts">
import HeartIcon from './icons/heart.svg'
</script>

<template>
	<footer
		class="relative z-(--vp-z-index-footer) border-t border-(--vp-c-gutter) bg-(--vp-c-bg) px-6 py-8 md:px-8"
	>
		<div class="mx-auto max-w-(--vp-layout-max-width) text-center">
			<p class="text-sm leading-6 font-medium text-(--vp-c-text-2)">
				Made with
				<HeartIcon class="inline-block! size-3.5 -translate-y-px" />
				by
				<a
					href="https://github.com/creeperkatze"
					target="_blank"
					rel="noopener noreferrer"
					class="text-(--vp-c-text-1)! underline decoration-1 underline-offset-2 hover:opacity-80"
					>Creeperkatze</a
				>
				· Not affiliated with Modrinth
			</p>
			<p class="text-sm leading-6 font-medium text-(--vp-c-text-2)">
				<a
					href="/privacy"
					class="text-(--vp-c-text-1)! underline decoration-1 underline-offset-2 hover:opacity-80"
					>Privacy</a
				>
				·
				<a
					href="/terms"
					class="text-(--vp-c-text-1)! underline decoration-1 underline-offset-2 hover:opacity-80"
					>Terms</a
				>
			</p>
		</div>
	</footer>
</template>
