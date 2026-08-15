<script setup lang="ts">
import GithubIcon from './icons/github.svg'
import TopggIcon from './icons/topgg.svg'
</script>

<template>
	<div class="mt-6">
		<div class="-m-1.5 flex flex-wrap">
			<div class="p-1.5">
				<a
					href="https://top.gg/bot/1496760658732122152"
					target="_blank"
					rel="noreferrer"
					class="inline-flex h-9.5 items-center gap-2 rounded-[20px] border border-(--vp-button-brand-border) bg-(--vp-button-brand-bg) px-5 text-sm font-semibold text-(--vp-button-brand-text) no-underline! transition-colors duration-200 hover:border-(--vp-button-brand-hover-border) hover:bg-(--vp-button-brand-hover-bg) hover:text-(--vp-button-brand-hover-text)"
				>
					<TopggIcon class="size-4 shrink-0" />
					Add to Discord
				</a>
			</div>
			<div class="p-1.5">
				<a
					href="https://top.gg/bot/1496760658732122152/vote"
					target="_blank"
					rel="noreferrer"
					class="inline-flex h-9.5 items-center gap-2 rounded-[20px] border border-transparent bg-[#ff3366] px-5 text-sm font-semibold text-white no-underline! transition-colors duration-200 hover:bg-[#e62958]"
				>
					<TopggIcon class="size-4 shrink-0" />
					Vote
				</a>
			</div>
			<div class="p-1.5">
				<a
					href="https://github.com/creeperkatze/modrinth-scout"
					target="_blank"
					rel="noreferrer"
					class="inline-flex h-9.5 items-center gap-2 rounded-[20px] border border-(--vp-button-alt-border) bg-(--vp-button-alt-bg) px-5 text-sm font-semibold text-(--vp-button-alt-text) no-underline! transition-colors duration-200 hover:border-(--vp-button-alt-hover-border) hover:bg-(--vp-button-alt-hover-bg) hover:text-(--vp-button-alt-hover-text)"
				>
					<GithubIcon class="size-4 shrink-0" />
					GitHub
				</a>
			</div>
		</div>
	</div>
</template>
