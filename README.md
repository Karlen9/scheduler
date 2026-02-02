# Scheduler - Telegram Bot with Mini App

A Telegram bot with a mini-app built using Go and Next.js.

## Project Structure

```
scheduler/
├── bot/          # Go Telegram bot
│   ├── main.go
│   ├── go.mod
│   └── go.sum
├── mini-app/     # Next.js mini-app
│   ├── src/
│   │   └── app/
│   │       ├── page.tsx
│   │       ├── layout.tsx
│   │       └── globals.css
│   ├── package.json
│   └── ...
└── README.md
```

## Setup Instructions

### 1. Create a Telegram Bot

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the prompts
3. Save the bot token you receive

### 2. Deploy the Mini App

The mini-app needs to be deployed to a public HTTPS URL. Options:
- Vercel (recommended for Next.js)
- Netlify
- Your own server with HTTPS

To deploy on Vercel:
```bash
cd mini-app
bunx vercel
```

### 3. Configure the Bot

Set the environment variables:
```bash
export TELEGRAM_BOT_TOKEN="your-bot-token-from-botfather"
export WEB_APP_URL="https://your-deployed-mini-app-url.com"
```

### 4. Run the Bot

```bash
cd bot
go run main.go
```

## Development

### Mini App (Next.js)
```bash
cd mini-app
bun dev
```

The mini-app will run on http://localhost:3000

### Bot (Go)
```bash
cd bot
TELEGRAM_BOT_TOKEN=your-token WEB_APP_URL=https://your-url.com go run main.go
```

## Usage

1. Start a chat with your bot on Telegram
2. Send `/start`
3. Click "Open Scheduler" button
4. In the mini-app, click "Current Time" to see the current date and time
