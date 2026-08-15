<script setup lang="ts">
import HeartIcon from './icons/heart.svg'
</script>

<template>
	<a
		href="https://ko-fi.com/creeperkatze"
		target="_blank"
		rel="noopener noreferrer"
		class="ml-4 inline-flex! items-center gap-1.5 rounded-full bg-(--vp-c-brand-bg) text-[13px] font-medium text-white! no-underline transition-opacity duration-150"
		aria-label="Donate on Ko-fi"
	>
		<HeartIcon class="size-4 shrink-0" />
		Donate
	</a>
</template>

<style scoped>
a {
	padding: 4px 12px;
}

a:hover {
	opacity: 0.8;
}
</style>
