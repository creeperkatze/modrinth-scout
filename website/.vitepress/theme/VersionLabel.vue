<script setup lang="ts">
defineProps<{ version: string }>()
</script>

<template>
	<span class="version-label">v{{ version }}</span>
</template>

<style scoped>
.version-label {
	display: flex;
	align-items: center;
	padding: 0 12px;
	line-height: var(--vp-nav-height);
	font-size: 14px;
	font-weight: 500;
	color: var(--vp-c-text-2);
}
</style>
