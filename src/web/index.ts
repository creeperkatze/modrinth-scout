import express from 'express'

import { queries } from '../db/queries.js'
import { logger } from '../utils/logger.js'

const log = logger.child({ module: 'web' })

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
	app.use(express.urlencoded({ extended: true }))

	const port = process.env.PORT ? parseInt(process.env.PORT) : 3000
	const verificationToken = process.env.KOFI_VERIFICATION_TOKEN

	app.post('/kofi', async (req, res) => {
		let payload: KofiPayload
		try {
			payload = JSON.parse(req.body.data)
		} catch {
			req.socket.destroy()
			return
		}

		if (!verificationToken || payload.verification_token !== verificationToken) {
			log.warn('Ko-fi webhook received with invalid verification token')
			req.socket.destroy()
			return
		}

		const discordUserId = payload.discord_userid ?? null

		log.info(
			{ from: payload.from_name, amount: payload.amount, type: payload.type, discordUserId },
			'Ko-fi payment received',
		)

		try {
			await queries.createDonation({
				discordUserId,
				email: payload.email,
				transactionId: payload.kofi_transaction_id,
			})
		} catch (err) {
			// Ko-fi retried a webhook we already processed, ignore
			if ((err as { code?: number }).code === 11000) {
				log.warn(
					{ transactionId: payload.kofi_transaction_id },
					'Duplicate Ko-fi transaction ignored',
				)
				res.status(200).send('OK')
				return
			}
			throw err
		}

		res.status(200).send('OK')
	})

	app.use((req) => {
		req.socket.destroy()
	})

	app.listen(port, () => {
		log.info({ port }, 'Web server started')
	})
}
