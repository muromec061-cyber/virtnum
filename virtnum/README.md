# VirtNum — Virtual Numbers for Telegram

A full-stack SaaS platform for purchasing and managing virtual phone numbers for Telegram registration.

## Stack

| Layer      | Tech                                        |
|------------|---------------------------------------------|
| Frontend   | Next.js 14, TypeScript, TailwindCSS, Zustand |
| Backend    | Node.js, Express, Prisma ORM                |
| Database   | PostgreSQL 16                               |
| Realtime   | WebSocket (ws)                              |
| Auth       | JWT (access + refresh tokens)               |
| Deploy     | Docker Compose + Nginx                      |

---

## Quick Start (Docker)

### 1. Clone & configure

```bash
git clone <your-repo> virtnum
cd virtnum
cp .env.example .env
# Edit .env — set strong passwords and JWT secrets
```

### 2. Generate secrets

```bash
# Generate JWT secrets (run twice for access + refresh)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Deploy

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

App will be available at **http://localhost**

---

## Development (Local)

### Prerequisites
- Node.js 20+
- Docker (for PostgreSQL)
- npm

### Run

```bash
chmod +x scripts/dev.sh
./scripts/dev.sh
```

Or manually:

```bash
# Terminal 1 — Postgres
docker compose up -d postgres

# Terminal 2 — Backend
cd backend
cp ../.env.example .env   # edit DATABASE_URL to localhost
npm install
npx prisma generate
npx prisma migrate dev --name init
npx ts-node prisma/seed.ts
npm run dev

# Terminal 3 — Frontend
cd frontend
echo "NEXT_PUBLIC_API_URL=http://localhost:4000/api" > .env.local
echo "NEXT_PUBLIC_WS_URL=ws://localhost:4000/ws" >> .env.local
npm install
npm run dev
```

---

## Default Credentials

| Role  | Email                  | Password    |
|-------|------------------------|-------------|
| Admin | admin@virtnum.io       | Admin123!   |
| Demo  | demo@virtnum.io        | User1234!   |

---

## API Reference

### Auth
| Method | Endpoint             | Description         |
|--------|----------------------|---------------------|
| POST   | /api/auth/register   | Register user       |
| POST   | /api/auth/login      | Login               |
| POST   | /api/auth/refresh    | Refresh tokens      |
| POST   | /api/auth/logout     | Logout              |
| GET    | /api/auth/me         | Get current user    |

### Numbers
| Method | Endpoint                | Description          |
|--------|-------------------------|----------------------|
| GET    | /api/numbers            | List numbers         |
| GET    | /api/numbers/telegram   | Telegram numbers     |
| GET    | /api/numbers/:id        | Get number           |
| POST   | /api/numbers            | Create (admin)       |
| PUT    | /api/numbers/:id        | Update (admin)       |
| DELETE | /api/numbers/:id        | Delete (admin)       |

### Orders
| Method | Endpoint              | Description         |
|--------|-----------------------|---------------------|
| GET    | /api/orders           | List orders         |
| POST   | /api/orders           | Create order        |
| GET    | /api/orders/:id       | Get order           |
| POST   | /api/orders/:id/cancel| Cancel order        |

### SMS
| Method | Endpoint                    | Description              |
|--------|-----------------------------|--------------------------|
| GET    | /api/sms/order/:orderId     | SMS for order            |
| GET    | /api/sms/number/:numberId   | SMS for number           |
| POST   | /api/sms/incoming           | Receive SMS (webhook)    |
| POST   | /api/sms/simulate           | Simulate SMS (admin)     |

### Users
| Method | Endpoint                         | Description            |
|--------|----------------------------------|------------------------|
| GET    | /api/users/profile               | Get profile            |
| GET    | /api/users/balance               | Get balance            |
| POST   | /api/users/balance/topup         | Top up balance         |
| GET    | /api/users/transactions          | Transaction history    |
| GET    | /api/users/notifications         | Notifications          |
| PUT    | /api/users/notifications/:id/read| Mark read              |
| GET    | /api/users/favorites             | Favorites              |
| POST   | /api/users/favorites/:numberId   | Toggle favorite        |

### Admin
| Method | Endpoint         | Description        |
|--------|------------------|--------------------|
| GET    | /api/admin/stats | Platform stats     |
| GET    | /api/admin/logs  | Action logs        |

---

## WebSocket Events

Connect to `ws://host/ws` and authenticate:

```json
{ "type": "auth", "token": "<access_token>" }
```

Incoming events:
| Event                  | Description                         |
|------------------------|-------------------------------------|
| `sms_received`         | New SMS arrived for your number     |
| `order_update`         | Your order status changed           |
| `number_status_update` | A number's availability changed     |
| `number_update`        | Number data updated                 |

---

## SMS Webhook (for real SMS gateway)

Send incoming SMS to your server:

```bash
POST /api/sms/incoming
Content-Type: application/json

{
  "number": "+79161234567",
  "sender": "Telegram",
  "text": "Your code is 12345",
  "apiKey": "<SMS_GATEWAY_API_KEY>"
}
```

The API extracts the confirmation code automatically and pushes it to the user via WebSocket.

---

## Project Structure

```
virtnum/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      # DB schema
│   │   └── seed.ts            # Initial data
│   └── src/
│       ├── index.ts           # Entry point
│       ├── middleware/        # Auth, rate limit, validation, logging
│       ├── routes/            # API routes
│       ├── services/          # Background jobs
│       ├── websocket/         # WS manager
│       └── utils/             # JWT, password, logger
├── frontend/
│   └── src/
│       ├── app/               # Next.js pages
│       │   ├── auth/          # Login / Register
│       │   ├── dashboard/     # User dashboard
│       │   └── admin/         # Admin panel
│       ├── components/        # UI components
│       ├── hooks/             # Custom hooks
│       ├── lib/               # API client, WebSocket
│       ├── store/             # Zustand state
│       └── types/             # TypeScript types
├── nginx/nginx.conf           # Reverse proxy config
├── docker-compose.yml
├── .env.example
└── scripts/
    ├── deploy.sh
    └── dev.sh
```

---

## Production Checklist

- [ ] Change all passwords in `.env`
- [ ] Generate strong JWT secrets (64+ chars)
- [ ] Set `SMS_GATEWAY_API_KEY` to a random secret
- [ ] Configure your domain in `nginx.conf`
- [ ] Add SSL certificate to `nginx/ssl/`
- [ ] Set `FRONTEND_URL` and `NEXT_PUBLIC_API_URL` to your domain
- [ ] Connect a real SMS gateway and point it to `POST /api/sms/incoming`
