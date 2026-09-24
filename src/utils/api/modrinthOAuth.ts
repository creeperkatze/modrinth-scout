import type { Labrinth } from '@modrinth/api-client'

import { modrinthClient } from './modrinth.js'

const AUTHORIZE_URL = 'https://modrinth.com/auth/authorize'
// Only needs to identify the user, never acts on their behalf
const SCOPES = ['USER_READ']

interface TokenResponse {
	access_token: string
	token_type: string
	expires_in: number
}

function oauthConfig() {
	return {
		clientId: process.env.MODRINTH_OAUTH_CLIENT_ID!,
		clientSecret: process.env.MODRINTH_OAUTH_CLIENT_SECRET!,
		redirectUri: process.env.MODRINTH_OAUTH_REDIRECT_URI!,
	}
}

export function buildAuthorizeUrl(state: string): string {
	const { clientId, redirectUri } = oauthConfig()
	const url = new URL(AUTHORIZE_URL)
	url.searchParams.set('client_id', clientId)
	url.searchParams.set('redirect_uri', redirectUri)
	url.searchParams.set('scope', SCOPES.join('+'))
	url.searchParams.set('state', state)
	return url.toString()
}

// Exchanges the callback code for a token and resolves the Modrinth user it belongs to.
// The token is discarded afterwards, the bot only stores the resulting user id
export async function fetchUserFromCode(code: string): Promise<Labrinth.Users.v3.User> {
	const { clientId, clientSecret, redirectUri } = oauthConfig()

	// Untyped: the token endpoint is internal and form-encoded, unlike the rest of the API
	const token = await modrinthClient.request<TokenResponse>('/oauth/token', {
		api: 'labrinth',
		version: 'internal',
		method: 'POST',
		headers: {
			Authorization: clientSecret,
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: new URLSearchParams({
			grant_type: 'authorization_code',
			code,
			redirect_uri: redirectUri,
			client_id: clientId,
		}).toString(),
		retry: false,
	})

	// Not users_v3.getAuthenticated(), which authenticates via the shared client's features
	return modrinthClient.request<Labrinth.Users.v3.User>('/user', {
		api: 'labrinth',
		version: 3,
		method: 'GET',
		headers: { Authorization: token.access_token },
	})
}
