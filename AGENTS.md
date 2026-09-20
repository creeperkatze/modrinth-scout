# Modrinth Scout

Discord bot for discovering, exploring, and tracking projects on Modrinth. Built with discord.js, TypeScript, MongoDB (Mongoose), and Express.

Package manager: **pnpm**.

## Commands

```bash
pnpm dev # Run with tsx in watch mode, no build step needed
pnpm build # Compile with tsc to dist/
pnpm start # Run the compiled bot from dist/
pnpm lint # Lint
pnpm lint:fix # Lint and auto-fix fixable issues
pnpm test # Run tests with vitest
pnpm test:coverage  # Run tests with coverage
```

Run `pnpm lint:fix` after making changes. Style (tabs, single quotes, no semicolons, trailing commas, 100-char lines, LF) is enforced by `.prettierrc`, not by convention docs.

## Further reading

- [Architecture](docs/architecture.md), file-by-file map of `src/`
- [Modrinth API conventions](docs/modrinth-api.md), how to call `modrinthClient`, typed vs. untyped endpoints
- [Tracking system](docs/tracking.md), the unified tracking collection and notification override chain
- [Donator perks & vote rewards](docs/donation.md)
- [Logging](docs/logging.md)
