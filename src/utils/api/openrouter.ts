import { createModuleLogger } from '../logger.js'
import { aiSummaryDurationSeconds, aiSummaryRequestsTotal } from '../metrics.js'

const log = createModuleLogger('openrouter')

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_MODEL = 'qwen/qwen-2.5-7b-instruct'
const REQUEST_TIMEOUT_MS = 10_000

type OpenRouterResponse = {
	choices?: { message?: { content?: string } }[]
}

export async function prompt(
	systemPrompt: string,
	userContent: string,
	maxTokens: number,
	timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<string | null> {
	const apiKey = process.env.OPENROUTER_API_KEY
	if (!apiKey) return null

	const stopTimer = aiSummaryDurationSeconds.startTimer()
	try {
		const response = await fetch(OPENROUTER_URL, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model: OPENROUTER_MODEL,
				messages: [
					{ role: 'system', content: systemPrompt },
					{ role: 'user', content: userContent },
				],
				max_tokens: maxTokens,
				temperature: 0.3,
			}),
			signal: AbortSignal.timeout(timeoutMs),
		})

		if (!response.ok) throw new Error(`OpenRouter responded with status ${response.status}`)

		const data = (await response.json()) as OpenRouterResponse
		const content = data.choices?.[0]?.message?.content?.trim()
		aiSummaryRequestsTotal.inc({ status: 'success' })
		return content || null
	} catch (err) {
		aiSummaryRequestsTotal.inc({ status: 'error' })
		log.warn({ err }, 'OpenRouter request failed')
		return null
	} finally {
		stopTimer()
	}
}
