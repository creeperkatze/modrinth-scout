import { aiSummariesEnabled } from '../config/ai.js'
import { createModuleLogger } from './logger.js'
import { aiSummaryDurationSeconds, aiSummaryRequestsTotal } from './metrics.js'

const log = createModuleLogger('changelog-summary')

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_MODEL = 'qwen/qwen-2.5-7b-instruct'

const MIN_CHANGELOG_LENGTH = 40
const MAX_CHANGELOG_INPUT_LENGTH = 4000
const REQUEST_TIMEOUT_MS = 10_000

const SYSTEM_PROMPT =
	'You summarize Minecraft mod/plugin changelogs for a Discord update notification. ' +
	'Reply with a single plain-English sentence (max 25 words) describing what changed. ' +
	'No markdown, no preamble, no quotes. If the changelog has no meaningful content, reply with exactly: NONE'

type OpenRouterResponse = {
	choices?: { message?: { content?: string } }[]
}

export async function summarizeChangelog(
	projectName: string,
	changelog: string | null | undefined,
): Promise<string | null> {
	if (!aiSummariesEnabled) return null

	const trimmed = changelog?.trim()
	if (!trimmed || trimmed.length < MIN_CHANGELOG_LENGTH) return null

	const stopTimer = aiSummaryDurationSeconds.startTimer()
	try {
		const response = await fetch(OPENROUTER_URL, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model: OPENROUTER_MODEL,
				messages: [
					{ role: 'system', content: SYSTEM_PROMPT },
					{
						role: 'user',
						content: `Project: ${projectName}\n\nChangelog:\n${trimmed.slice(0, MAX_CHANGELOG_INPUT_LENGTH)}`,
					},
				],
				max_tokens: 80,
				temperature: 0.3,
			}),
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		})

		if (!response.ok) throw new Error(`OpenRouter responded with status ${response.status}`)

		const data = (await response.json()) as OpenRouterResponse
		const summary = data.choices?.[0]?.message?.content?.trim()
		aiSummaryRequestsTotal.inc({ status: 'success' })

		if (!summary || summary.toUpperCase() === 'NONE') return null
		return summary
	} catch (err) {
		aiSummaryRequestsTotal.inc({ status: 'error' })
		log.warn({ err, projectName }, 'Failed to summarize changelog')
		return null
	} finally {
		stopTimer()
	}
}
