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

The `/help` command shows:

**Modrinth Scout**

Yet another Discord bot for discovering, exploring and tracking projects on Modrinth.

### General

- `/search` &middot; Search for projects on Modrinth
- `/project` &middot; Look up a Modrinth project
- `/version` &middot; Look up a version of a Modrinth project
- `/random` &middot; Returns a random project from Modrinth
- `/user` &middot; Look up a Modrinth user
- `/organization` &middot; Look up a Modrinth organization
- `/collection` &middot; Look up a Modrinth collection

### Tracking

- `/tracking setup` &middot; Set the channel where update notifications will be posted
- `/tracking add` &middot; Start tracking a Modrinth project
- `/tracking remove` &middot; Stop tracking a project
- `/tracking list` &middot; Show all projects tracked in this server
- `/tracking pause` &middot; Pause tracking notifications without removing tracked projects
- `/tracking resume` &middot; Resume tracking notifications for this server
- `/tracking disable` &middot; Disable tracking and remove all tracked projects

### Support

- `/support info` &middot; Show Ko-fi support info and perks
- `/support list` &middot; Show public supporters
- `/support activate` &middot; Activate supporter perks using your Ko-fi account
- `/support status` &middot; Check the supporter status of this server

### Miscellaneous

- `/statistics` &middot; Show Modrinth and bot statistics
- `/ping` &middot; Replies with Pong!

`v1.0.27` &middot; Made with &hearts; by Creeperkatze

## 🚀 Self-hosting

The recommended deployment is Docker Compose with the published container image on GHCR.

**Prerequisites:** [Docker](https://www.docker.com/) and an [application](https://discord.com/developers/home) on Discord.

**1. Create `docker-compose.yml`**

```yaml
services:
  bot:
    image: ghcr.io/creeperkatze/modrinth-scout:latest
    restart: unless-stopped
    env_file: .env
    depends_on:
      - mongodb
    networks:
      - backend

  mongodb:
    image: mongo:8
    restart: unless-stopped
    volumes:
      - mongodb-data:/data/db
    networks:
      - backend

volumes:
  mongodb-data:

networks:
  backend:
    driver: bridge
    internal: true
```

**2. Create `.env`**

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id
MONGODB_URI=mongodb://mongodb:27017/modrinth_scout
```

**3. Start**

```bash
docker compose up -d
```

Slash commands are deployed automatically during startup.

## 👨‍💻 Development

```bash
pnpm dev
```

Runs the bot with `tsx` in watch mode, no build step needed. Deploy commands to a dev guild for instant updates:

```bash
DEV_GUILD_ID=your_guild_id
```

## Contributing

Contributions are always welcome!

Please ensure you run `pnpm lint` before opening a pull request.
