import express from 'express'
import { pinoHttp } from 'pino-http'

import { queries } from '../db/queries.js'
import { createModuleLogger } from '../utils/logger.js'

const log = createModuleLogger('web')

interface KofiPayload {
	verification_token: string
	from_name: string
	message: string | null
	amount: string
	email: string
	currency: string
	kofi_transaction_id: string
	type: string
	discord_userid: string | null
}

export function startWebServer() {
	const app = express()
	app.disable('x-powered-by')
	app.use(pinoHttp({ logger: log }))
	app.use(express.urlencoded({ extended: true }))

	const port = parseInt(process.env.WEB_PORT!)
	const verificationToken = process.env.KOFI_VERIFICATION_TOKEN

	app.post('/kofi', async (req, res) => {
		let payload: KofiPayload
		try {
			payload = JSON.parse(req.body.data)
		} catch {
			req.log.warn('Ko-fi webhook received invalid JSON payload')
			res.status(400).json({ error: 'invalid_payload' })
			return
		}

		if (!verificationToken || payload.verification_token !== verificationToken) {
			req.log.warn(
				{ transactionId: payload.kofi_transaction_id ?? null },
				'Ko-fi webhook received invalid verification token',
			)
			res.status(401).json({ error: 'unauthorized' })
			return
		}

		res.status(200).json({ ok: true })

		const discordUserId = payload.discord_userid ?? null

		try {
			await queries.createDonation({
				discordUserId,
				email: payload.email,
				transactionId: payload.kofi_transaction_id,
			})
		} catch (err) {
			// Ko-fi retried a webhook we already processed, ignore
			if ((err as { code?: number }).code === 11000) {
				req.log.warn(
					{ transactionId: payload.kofi_transaction_id, discordUserId },
					'Duplicate Ko-fi transaction ignored',
				)
				return
			}
			throw err
		}

		req.log.info(
			{
				transactionId: payload.kofi_transaction_id,
				amount: payload.amount,
				currency: payload.currency,
				type: payload.type,
				discordUserId,
			},
			'Ko-fi payment received',
		)
	})

	app.use((req, res) => {
		res.status(404).json({ error: 'not_found' })
	})

	app.listen(port, () => {
		log.info({ port, webhookConfigured: Boolean(verificationToken) }, 'Web server started')
	})
}
