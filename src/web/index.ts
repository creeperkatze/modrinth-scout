import { timingSafeEqual } from 'node:crypto'
import { createRequire } from 'node:module'

import type { VoteCreatePayload } from '@top-gg/sdk'
import { Webhook } from '@top-gg/sdk'
import type { Client } from 'discord.js'
import express from 'express'
import { pinoHttp } from 'pino-http'

import { notifyAccountLinked } from '../commands/account.js'
import { usesAccountLinking } from '../config/accountLinking.js'
import { usesBetterStack } from '../config/betterstack.js'
import { usesDonatorPerks } from '../config/donatorPerks.js'
import { usesVoteRewards } from '../config/voteRewards.js'
import { queries } from '../db/queries.js'
import { fetchUserFromCode } from '../utils/api/modrinthOAuth.js'
import { getUptime } from '../utils/betterstack.js'
import { createModuleLogger } from '../utils/logger.js'
import { register } from '../utils/metrics.js'

const log = createModuleLogger('web')

const require = createRequire(import.meta.url)
const { version } = require('../../package.json') as { version: string }

function isAuthorizedMetricsRequest(authHeader: string | undefined, token: string): boolean {
	if (!authHeader?.startsWith('Bearer ')) return false
	const provided = Buffer.from(authHeader.slice('Bearer '.length))
	const expected = Buffer.from(token)
	return provided.length === expected.length && timingSafeEqual(provided, expected)
}

function escapeHtml(value: string): string {
	return value.replace(
		/[&<>"']/g,
		(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
	)
}

// Shown in the browser tab Modrinth redirects back to
function linkResultPage(title: string, message: string): string {
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)} | Modrinth Scout</title><style>body{font-family:system-ui,sans-serif;background:#16181c;color:#e6e6e6;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px;box-sizing:border-box;text-align:center}main{max-width:420px}h1{font-size:1.5rem}</style></head><body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></main></body></html>`
}

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

export function startWebServer(client: Client) {
	const app = express()
	app.disable('x-powered-by')
	app.use(
		pinoHttp({
			logger: log,
			customLogLevel: (req, res, err) => {
				if (err || res.statusCode >= 500) return 'error'
				if (res.statusCode >= 400) return 'warn'
				return 'debug'
			},
		}),
	)

	const port = parseInt(process.env.PORT ?? '3000')
	const metricsToken = process.env.METRICS_TOKEN

	app.get('/api/metrics', async (req, res) => {
		if (!metricsToken || !isAuthorizedMetricsRequest(req.headers.authorization, metricsToken)) {
			res.status(401).json({ error: 'unauthorized' })
			return
		}
		res.set('Content-Type', register.contentType)
		res.end(await register.metrics())
	})

	app.get('/api/stats', async (_req, res) => {
		const [guilds, trackedProjects, trackedAuthors, uptime] = await Promise.all([
			queries.countConfiguredGuilds(),
			queries.countAllTrackedProjects(),
			queries.countAllTrackedAuthors(),
			getUptime(),
		])
		res.json({ guilds, trackedProjects, trackedAuthors, uptime, version })
	})

	if (usesDonatorPerks) {
		app.use(express.urlencoded({ extended: true }))
		const verificationToken = process.env.KOFI_VERIFICATION_TOKEN

		app.post('/api/kofi', async (req, res) => {
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
	}

	const webhookSecret = process.env.TOPGG_WEBHOOK_SECRET
	if (usesVoteRewards && webhookSecret) {
		const webhook = new Webhook(webhookSecret, {
			error: (err) => log.error({ err }, 'top.gg webhook error'),
		})

		app.post(
			'/api/topgg',
			webhook.listener(async (payload, req) => {
				if (payload.type !== 'vote.create') return

				const { platformId: discordUserId } = (payload.data as VoteCreatePayload).user
				const guildId = await queries.extendVoteReward(discordUserId)
				req.log.info({ discordUserId, guildId }, 'top.gg vote processed')
			}),
		)
	}

	if (usesAccountLinking) {
		app.get('/api/modrinth/callback', async (req, res) => {
			const { code, state } = req.query
			if (typeof code !== 'string' || typeof state !== 'string') {
				res
					.status(400)
					.send(
						linkResultPage(
							'Linking cancelled',
							'No account was linked. Run /account link in Discord to try again.',
						),
					)
				return
			}

			const discordUserId = await queries.consumeLinkState(state)
			if (!discordUserId) {
				res
					.status(400)
					.send(
						linkResultPage(
							'Link expired',
							'This link has expired or was already used. Run /account link in Discord to get a new one.',
						),
					)
				return
			}

			let user
			try {
				user = await fetchUserFromCode(code)
			} catch (err) {
				req.log.error({ err, discordUserId }, 'Modrinth OAuth exchange failed')
				res
					.status(502)
					.send(
						linkResultPage(
							'Something went wrong',
							'Modrinth did not confirm your account. Run /account link in Discord to try again.',
						),
					)
				return
			}

			await queries.linkAccount(discordUserId, user.id, user.username)
			req.log.info({ discordUserId, modrinthUserId: user.id }, 'Modrinth account linked')
			res.send(
				linkResultPage(
					'Account linked',
					`Your Discord account is now linked to ${user.username} on Modrinth. You can close this tab.`,
				),
			)
			await notifyAccountLinked(client, discordUserId, user)
		})
	}

	app.use((req, res) => {
		res.status(404).json({ error: 'not_found' })
	})

	app.listen(port, () => {
		log.info(
			{
				port,
				webhookConfigured: usesDonatorPerks,
				voteRewardsConfigured: usesVoteRewards,
				accountLinkingConfigured: usesAccountLinking,
				betterStackConfigured: usesBetterStack,
				metricsEnabled: Boolean(metricsToken),
			},
			'Web server started',
		)
	})
}
