export const usesVoteRewards = Boolean(process.env.TOPGG_WEBHOOK_SECRET?.trim())

export const VOTE_REWARD_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours
