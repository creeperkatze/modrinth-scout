import { OpenRouter } from '@openrouter/sdk'

import { createModuleLogger } from '../logger.js'
import { aiSummaryDurationSeconds, aiSummaryRequestsTotal } from '../metrics.js'

const log = createModuleLogger('openrouter')

const OPENROUTER_MODEL = 'qwen/qwen-2.5-7b-instruct'
const REQUEST_TIMEOUT_MS = 10_000

const client = new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })

export async function prompt(
	systemPrompt: string,
	userContent: string,
	maxTokens: number,
	timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<string | null> {
	if (!process.env.OPENROUTER_API_KEY) return null

	const stopTimer = aiSummaryDurationSeconds.startTimer()
	try {
		const result = await client.chat.send(
			{
				chatRequest: {
					model: OPENROUTER_MODEL,
					messages: [
						{ role: 'system', content: systemPrompt },
						{ role: 'user', content: userContent },
					],
					maxTokens,
					temperature: 0.3,
					stream: false,
				},
			},
			{ timeoutMs },
		)

		if (!('choices' in result)) throw new Error('OpenRouter returned a streaming response')

		const content = result.choices[0]?.message.content
		const text = typeof content === 'string' ? content.trim() : null
		aiSummaryRequestsTotal.inc({ status: 'success' })
		return text || null
	} catch (err) {
		aiSummaryRequestsTotal.inc({ status: 'error' })
		log.warn({ err }, 'OpenRouter request failed')
		return null
	} finally {
		stopTimer()
	}
}
