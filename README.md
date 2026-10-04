# Imposter Game

Monorepo for the Imposter Game website/backend and native Android client.

## Projects

| Project | Location | Purpose |
| --- | --- | --- |
| Website and backend | [`website/`](website/) | Next.js website, Node.js API/realtime server, database migrations, contracts, tests, and deployment documentation |
| Android app | [`android app/`](android%20app/) | Native Kotlin and Jetpack Compose client |

## Development

Run website and backend commands from `website/`:

```powershell
cd website
Copy-Item .env.example .env
npm ci
npm run migrate:up
npm run dev
```

Run Android commands from `android app/`:

```powershell
cd "android app"
.\gradlew.bat quality
.\gradlew.bat assembleDebug
```

Each project has its own README with complete setup and verification instructions.
