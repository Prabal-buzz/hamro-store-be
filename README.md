# Hamro Store Backend API Boilerplate

A production-ready, clean-architecture Express API boilerplate built with **TypeScript**, configured as an ES Module (ESM), featuring automatic type checking, live reloading, input validation, and structured error handling.

## Features

- **TypeScript Support**: Configured for ESM compilation.
- **Hot Reloading**: Fast local development via `tsx` watch mode.
- **Environment Validation**: Zod-validated configuration ensuring the server fails fast if variables are missing/malformed.
- **Security**: Built-in protection headers using `helmet` and custom `cors`.
- **Structured Error Handling**:
  - `AppError` class for operational errors.
  - Global error handling middleware distinguishes between development details and safe production responses.
  - Not-Found middleware catches unmatched endpoints.
- **Graceful Shutdown**: Listens to process signals (`SIGINT`/`SIGTERM`) to cleanly release resources and close HTTP connections.

## Directory Structure

```
be/
├── src/
│   ├── config/          # Configuration & environment variable schemas
│   │   └── env.ts
│   ├── middlewares/     # Express route middlewares
│   │   ├── error.middleware.ts
│   │   └── not-found.middleware.ts
│   ├── routes/          # API route definitions
│   │   ├── health.route.ts
│   │   └── index.ts
│   ├── utils/           # Helper utility classes and functions
│   │   └── app-error.ts
│   ├── app.ts           # Express Application initialization
│   └── index.ts         # Server entry point
├── .env                 # Environment variables
├── tsconfig.json        # TypeScript configuration
└── package.json         # Package configuration
```

## Getting Started

### Prerequisites

- Node.js (version 20 or higher recommended)
- npm (or yarn)

### Installation

Install dependencies:

```bash
npm install
```

### Environment Setup

Copy `.env.example` to `.env` and fill out relevant environment variables:

```bash
cp .env.example .env
```

### Development

Start the development server with live reload:

```bash
npm run dev
```

The API will be available at [http://localhost:5000/api/v1](http://localhost:5000/api/v1).

### Build for Production

Compile TypeScript into the `/dist` directory:

```bash
npm run build
```

### Run Production

Start the compiled JavaScript application:

```bash
npm run start
```

## API Endpoints

- **GET `/api/v1/health`**
  - Check system status and uptime.
