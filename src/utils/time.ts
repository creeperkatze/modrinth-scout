export function toDate(value: string | Date): Date {
	return new Date(value)
}

export function toUnixTimestamp(value: string | Date): number {
	return Math.floor(toDate(value).getTime() / 1000)
}

export function formatDiscordDate(value: string | Date, style: string = 'f'): string {
	const timestamp = toUnixTimestamp(value)
	return `<t:${timestamp}:${style}>`
}
