export const supporterPerksEnabled = Boolean(process.env.KOFI_VERIFICATION_TOKEN?.trim())

export function hasSupporterPerks(isSupporter?: boolean | null) {
	return !supporterPerksEnabled || Boolean(isSupporter)
}
