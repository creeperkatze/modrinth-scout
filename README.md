# <img src=".github/assets/logo.png" alt="Modrinth Scout" height="100">

Yet another Discord bot for discovering, exploring and tracking projects on Modrinth.

![GitHub Branch Check Runs](https://img.shields.io/github/check-runs/creeperkatze/modrinth-scout/main?labelColor=0d143c)
![GitHub Issues](https://img.shields.io/github/issues/creeperkatze/modrinth-scout?labelColor=0d143c)
![GitHub Pull Requests](https://img.shields.io/github/issues-pr/creeperkatze/modrinth-scout?labelColor=0d143c)
![GitHub Repo stars](https://img.shields.io/github/stars/creeperkatze/modrinth-scout?style=flat&labelColor=0d143c)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/creeperkatze)

> [!NOTE]
> This bot is not associated with or endorsed by Modrinth.

## ✨ Commands

### General

| Command | Description |
|---------|-------------|
| `/search` | Search for projects on Modrinth with pagination and filters |
| `/project` | Look up a Modrinth project |
| `/random` | Returns a random project from Modrinth |
| `/user` | Look up a Modrinth user |
| `/organization` | Look up a Modrinth organization |
| `/collection` | Look up a Modrinth collection |

### Tracking

Requires the **Manage Server** permission. Run `/tracking setup` first to configure a notification channel.

| Command | Description |
|---------|-------------|
| `/tracking setup` | Set the channel and optional ping role for update notifications |
| `/tracking add` | Start tracking a project (name, slug, ID, or URL). Optionally filter by release channel (release, beta, alpha) |
| `/tracking remove` | Stop tracking a project (name, slug, ID, or URL) |
| `/tracking list` | Show all tracked projects with their release channel filters |
| `/tracking pause` | Pause notifications without removing tracked projects |
| `/tracking resume` | Resume tracking notifications |
| `/tracking disable` | Disable tracking and remove all tracked projects |

### Miscellaneous

| Command | Description |
|---------|-------------|
| `/statistics` | Show Modrinth and bot statistics |
| `/support` | Support the development of this bot |
| `/ping` | Check bot latency |

## 🚀 Self-hosting

**Prerequisites:** [Node.js](https://nodejs.org) 22+, [pnpm](https://pnpm.io), and a [MongoDB](https://www.mongodb.com) instance.

**1. Clone and install**

```bash
git clone https://github.com/creeperkatze/modrinth-scout.git
cd modrinth-scout
pnpm install
```

**2. Configure**

Create a `.env` file in the project root:

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id
MONGODB_URI=mongodb://localhost:27017/modrinth_scout
```

`MONGODB_URI` defaults to `mongodb://localhost:27017/modrinth_scout` if omitted.

**3. Deploy slash commands**

```bash
pnpm deploy
```

**4. Run**

```bash
pnpm build
pnpm start
```

## 👨‍💻 Development

```bash
pnpm dev
```

Runs the bot with `tsx` in watch mode, no build step needed. Deploy commands to a dev guild for instant updates:

```bash
DEV_GUILD_ID=your_guild_id
```

## 🤝 Contributing

Contributions are always welcome!

Please ensure you run `pnpm lint` before opening a pull request.
