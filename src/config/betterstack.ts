export const usesBetterStack = Boolean(
	process.env.BETTERSTACK_API_TOKEN?.trim() && process.env.BETTERSTACK_MONITOR_ID?.trim(),
)
