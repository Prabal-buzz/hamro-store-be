# Hamro Store Backend — Setup Guide

---

## Option A: Docker (recommended)

Run the entire stack (PostgreSQL + backend + frontend) with a single command.

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### Steps

```bash
# From the repo root (Hamro Store/)

# 1. Copy env file and adjust if needed
cp .env.example .env

# 2. Build and start everything
docker compose up --build

# 3. Open the app
#    Frontend  → http://localhost:3000
#    Backend   → http://localhost:5001/api/v1
#    Swagger   → http://localhost:5001/api-docs
```

The backend container automatically:
- Pushes the Prisma schema to the database
- Seeds 7 default user accounts
- Starts the Express server

### Useful Docker commands

```bash
docker compose up -d            # run in background
docker compose logs -f backend  # tail backend logs
docker compose logs -f frontend # tail frontend logs
docker compose down             # stop all containers
docker compose down -v          # stop + wipe the database volume
docker compose up --build       # rebuild after code changes
```

### Prisma Studio (visual DB browser)

```bash
# With containers running, open a shell into the backend container:
docker compose exec backend sh

# Then inside the container:
npx prisma studio
```

---

## Option B: Manual (local PostgreSQL)

### Prerequisites
- PostgreSQL 14+ running locally (default port 5432)
- Node.js 18+

### Steps

```bash
cd be

# 1. Install dependencies
npm install

# 2. Create the database
psql -U postgres -c "CREATE DATABASE hamro_store;"

# 3. Generate the Prisma client
npm run db:generate

# 4. Push the schema (creates all tables)
npm run db:push

# 5. Seed default users
npm run db:seed

# 6. Start the dev server
npm run dev
```

The API will be available at `http://localhost:5000/api/v1`.

Update `hamro-store-fe/.env.local` if needed:
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/v1
```

---

## Default accounts (both options)

| Role     | Email                     | Password    | Category              |
|----------|---------------------------|-------------|-----------------------|
| Admin    | admin@hamrostore.com      | password123 | —                     |
| Customer | customer@hamrostore.com   | password123 | —                     |
| Vendor 1 | vendor@hamrostore.com     | password123 | Non Veg               |
| Vendor 2 | vendor2@hamrostore.com    | password123 | Vegetables and Fruits |
| Vendor 3 | vendor3@hamrostore.com    | password123 | Grocery               |
| Vendor 4 | vendor4@hamrostore.com    | password123 | Spices                |
| Vendor 5 | vendor5@hamrostore.com    | password123 | Beverages             |

---

## Environment variables

### Backend (`be/.env`)
| Variable       | Default                          | Description              |
|----------------|----------------------------------|--------------------------|
| `DATABASE_URL` | `postgresql://...@localhost/...` | PostgreSQL connection URL |
| `PORT`         | `5000`                           | HTTP port                |
| `JWT_SECRET`   | `super-secret-key-...`           | Change in production     |
| `JWT_EXPIRES_IN` | `1d`                           | Token lifetime           |
| `CORS_ORIGIN`  | `*`                              | Allowed origin           |

### Frontend (`hamro-store-fe/.env.local`)
| Variable                    | Default                           | Description           |
|-----------------------------|-----------------------------------|-----------------------|
| `NEXT_PUBLIC_API_BASE_URL`  | `http://localhost:5001/api/v1`    | Backend API base URL  |

---

## Useful backend scripts

```bash
npm run db:generate   # regenerate Prisma client after schema changes
npm run db:push       # push schema changes to the database
npm run db:migrate    # create and run a new migration
npm run db:seed       # seed default users
npm run db:studio     # open Prisma Studio
npm run db:reset      # wipe + re-migrate (destructive)
npm run build         # compile TypeScript
npm run dev           # start with hot reload
```
