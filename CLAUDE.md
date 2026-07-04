# Modrinth Scout

Discord bot for discovering, exploring, and tracking projects on Modrinth. Built with discord.js, TypeScript, MongoDB (Mongoose), and Express.

## Commands

```bash
pnpm dev # Run with tsx in watch mode, no build step needed
pnpm build # Compile with tsc to dist/
pnpm start # Run the compiled bot from dist/
pnpm lint # Lint
pnpm lint:fix # Lint and auto-fix fixable issues
pnpm test # Run tests with vitest
pnpm test:coverage # Run tests with coverage
```

Deploy commands to a dev guild for instant slash-command updates by setting `DISCORD_GUILD_ID` in `.env`.

## Architecture

- `src/index.ts`: entrypoint — Discord client setup, lifecycle events, graceful shutdown
- `src/commands/`: one file per slash command, registered in `src/commands/index.ts`
- `src/utils/api.ts`: `modrinthClient`, a `GenericModrinthClient` from `@modrinth/api-client`; import and call it directly wherever Modrinth data is needed
- `src/config/modrinth.ts`: app-level Modrinth constants (`PROJECT_TYPES`, `SORT_OPTIONS`, `ProjectType`, `SearchIndex`) used to build slash command choices
- `src/utils/embeds/`: builds Discord embed/component payloads (`CardPayload`) from Modrinth API types
- `src/utils/commands.ts`: command registry, interaction routing (buttons, select menus, modals, cooldowns), and command deployment
- `src/utils/poller.ts`: background polling loop that checks tracked projects for new versions and notifies configured channels
- `src/db/`: Mongoose schemas and queries (`src/db/queries.ts`) for tracked projects, server config, and supporters
- `src/config/supporterPerks.ts`: gates supporter-only features behind `KOFI_VERIFICATION_TOKEN`
- `src/web/`: Express server handling the Ko-fi donation webhook (only started when supporter perks are enabled)

## Key conventions

- **API calls**: use `modrinthClient` from `utils/api.ts` everywhere; it's a plain `GenericModrinthClient` instance, no wrapper layer. Typed endpoints go through `modrinthClient.labrinth.<module>.<method>()`; endpoints without a typed method (random project with facets, user projects as v3 shape, `/statistics`) use `modrinthClient.request<T>(path, { api: 'labrinth', version: 3, method: 'GET', params })` directly at the call site. There is no response caching — every call hits the API.
- **Types**: use types from `@modrinth/api-client` directly (e.g. `import type { Labrinth } from '@modrinth/api-client'`, then `Labrinth.Projects.v3.Project`). Do not derive local `Modrinth*` type aliases.
- **`moduleResolution: Bundler`**: `tsconfig.json` intentionally uses `Bundler` resolution (not `NodeNext`) because `@modrinth/api-client`'s published `.d.ts` files use extensionless relative specifiers that fail to resolve under strict `NodeNext` rules. Since this project still ships real ESM output run via `node dist/index.js`, keep writing explicit `.js` extensions on all relative imports in `src/` — `tsc` won't enforce it under `Bundler`, but Node's runtime ESM loader still requires it.
- **Style**: Prettier — tabs, single quotes, no semicolons, trailing commas, 100-char lines, LF line endings.
- **Logging**: structured logging via `pino`; get a scoped logger with `createModuleLogger('module-name')` from `utils/logger.ts` and pass context as the first (object) argument, message as the second.
