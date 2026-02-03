# Scheduler Bot (Telegram)

## Environment variables
- `TELEGRAM_BOT_TOKEN` (required)
- `WEB_APP_URL` (required for the mini-app button)
- `PUBLIC_BASE_URL` (required, public HTTPS base URL reachable by Telegram, e.g. `https://api.example.com`)
- `WEBHOOK_SECRET` (required, random secret used for the webhook path + header validation)
- `PORT` (optional, default `8080`)
- `DATABASE_PATH` (optional, default `./data/scheduler.db`)
- `TRAINER_TELEGRAM_ID` (optional for seeding)
- `TRAINER_NAME` (optional, default `Trainer`)

## Local webhook testing
You need a public HTTPS URL that forwards to your local bot port. A tunnel works well:

1. Start the bot locally:
   - `PORT=8080 PUBLIC_BASE_URL=https://your-tunnel.example TELEGRAM_BOT_TOKEN=... WEBHOOK_SECRET=... WEB_APP_URL=... go run ./main.go`
2. Create a tunnel to your local port (example using ngrok):
   - `ngrok http 8080`
3. Use the HTTPS URL from the tunnel as `PUBLIC_BASE_URL`.

## Verify webhook configuration
Use Telegram’s `getWebhookInfo`:

```
curl -s "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```
