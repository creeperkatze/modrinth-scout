# Donator perks & vote rewards

`hasActivePerks(config)` (`db/queries.ts`) is the single source of truth for whether a guild gets donator-tier limits/interval, true for a permanent donator (`isDonator`) or a guild with an unexpired `voteRewardExpiresAt`. Always gate new donator-tier checks through `hasActivePerks`, not `isDonator` directly, so vote rewards stay in sync.

Vote rewards come from top.gg: `/vote claim` (Manage Server perm) links the clicking user's Discord ID to that guild via the `votes` collection (`schemas/vote.ts`, one guild per user, overwritten on re-link). The `/topgg` webhook only identifies the voter, so on each `vote.create` event it looks up that link and pushes `voteRewardExpiresAt` to `VOTE_REWARD_DURATION_MS` (24h) from now. Any guild's linked user voting extends the same guild.
