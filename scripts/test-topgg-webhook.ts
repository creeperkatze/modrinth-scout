import 'dotenv/config'

import { createHmac } from 'node:crypto'

const port = process.env.PORT ?? '3000'
const secret = process.env.TOPGG_WEBHOOK_SECRET

const discordUserId = process.argv[2]
if (!discordUserId) {
	console.error('Usage: tsx scripts/test-topgg-webhook.ts <discord-user-id>')
	process.exit(1)
}
if (!secret) {
	console.error('TOPGG_WEBHOOK_SECRET is not set')
	process.exit(1)
}

const payload = {
	type: 'vote.create',
	data: {
		id: '808499215864008704',
		weight: 1,
		created_at: new Date().toISOString(),
		expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
		project: {
			id: '803190510032756736',
			type: 'bot',
			platform: 'discord',
			platform_id: '160105994217586689',
		},
		query: {},
		user: {
			id: 'top.gg id',
			platform_id: discordUserId,
			name: 'Jo Example',
			avatar_url: null,
		},
	},
}

const body = JSON.stringify(payload)
const timestamp = Math.floor(Date.now() / 1000)
const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')

const res = await fetch(`http://localhost:${port}/topgg`, {
	method: 'POST',
	headers: {
		'Content-Type': 'application/json',
		'x-topgg-signature': `t=${timestamp},v1=${signature}`,
	},
	body,
})

console.log(`${res.status} ${res.statusText}`)
console.log(await res.text())
