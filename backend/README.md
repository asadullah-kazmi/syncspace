# SyncSpace Backend

Express.js backend API with TypeScript.

## Getting Started

### Installation

```bash
npm install
```

### Environment Setup

Copy `.env.example` to `.env` and configure your environment variables:

```bash
cp .env.example .env
```

### Development

Run the development server with hot reload:

```bash
npm run dev
```

### Build

Compile TypeScript to JavaScript:

```bash
npm run build
```

### Production

Run the compiled application:

```bash
npm start
```

### Available Scripts

- `npm run dev` - Start development server with nodemon
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## Project Structure

```
src/
├── controllers/    # Request handlers
├── middleware/     # Express middleware
├── models/         # Data models
├── routes/         # API routes
├── services/       # Business logic
├── types/          # TypeScript type definitions
├── utils/          # Utility functions
└── index.ts        # Application entry point
```

## Tech Stack

- **Express.js** - Web framework
- **TypeScript** - Type safety
- **Nodemon** - Development auto-reload
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **CORS** - Cross-origin resource sharing
- **dotenv** - Environment variables

## API Endpoints

### Health Check

```
GET /api/health
```

Returns API status and timestamp.
