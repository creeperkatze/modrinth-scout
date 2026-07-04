import { createRequire } from 'node:module'

import { GenericModrinthClient } from '@modrinth/api-client'

const require = createRequire(import.meta.url)
const { version } = require('../../package.json') as { version: string }

const USER_AGENT = `creeperkatze/modrinth-scout/${version} (contact@creeperkatze.dev)`

export const modrinthClient = new GenericModrinthClient({
	userAgent: USER_AGENT,
})
