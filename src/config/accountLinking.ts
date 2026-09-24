export const usesAccountLinking = Boolean(
	process.env.MODRINTH_OAUTH_CLIENT_ID?.trim() &&
	process.env.MODRINTH_OAUTH_CLIENT_SECRET?.trim() &&
	process.env.MODRINTH_OAUTH_REDIRECT_URI?.trim(),
)

// How long a /account link button stays usable before the user has to run the command again
export const LINK_STATE_TTL_MS = 10 * 60 * 1000 // 10 minutes
