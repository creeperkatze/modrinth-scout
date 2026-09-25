export const usesLinking = Boolean(
	process.env.MODRINTH_OAUTH_CLIENT_ID?.trim() &&
	process.env.MODRINTH_OAUTH_CLIENT_SECRET?.trim() &&
	process.env.MODRINTH_OAUTH_REDIRECT_URI?.trim(),
)

export const WEBSITE_URL = (process.env.WEBSITE_URL?.trim() ?? '').replace(/\/$/, '')

// How long a link setup stays usable before the user has to run the command again
export const PENDING_ACCOUNT_TTL_MS = 10 * 60 * 1000 // 10 minutes
