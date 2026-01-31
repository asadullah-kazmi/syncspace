# SyncSpace Backend - Docker Guide

## Quick Start

### Build the Docker Image

```bash
docker build -t syncspace-backend .
```

### Run the Container

```bash
docker run -d \
  --name syncspace-backend \
  -p 5000:5000 \
  -e NODE_ENV=production \
  -e MONGODB_URI=mongodb://your-mongo-host:27017/syncspace \
  -e JWT_SECRET=your-secret-key-here \
  -e CORS_ORIGIN=http://localhost:3000 \
  syncspace-backend
```

### Using Docker Compose

Create a `docker-compose.yml`:

```yaml
version: '3.8'

services:
  backend:
    build: .
    ports:
      - '5000:5000'
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/syncspace
      - JWT_SECRET=${JWT_SECRET}
      - CORS_ORIGIN=http://localhost:3000
    depends_on:
      - mongo
    restart: unless-stopped

  mongo:
    image: mongo:7
    ports:
      - '27017:27017'
    volumes:
      - mongo-data:/data/db
    restart: unless-stopped

volumes:
  mongo-data:
```

Run with:

```bash
docker-compose up -d
```

## Production Deployment

### Environment Variables

Required environment variables:

- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT tokens (min 32 characters)
- `CORS_ORIGIN` - Frontend URL (e.g., https://app.example.com)
- `PORT` - Optional, defaults to 5000

### Build Optimization

The Dockerfile uses multi-stage builds to minimize final image size:

- **Builder stage**: Compiles TypeScript
- **Production stage**: Only contains compiled code and runtime dependencies

### Security Features

- ✅ Runs as non-root user (nodejs:1001)
- ✅ Alpine Linux base (minimal attack surface)
- ✅ Only production dependencies included
- ✅ Health check endpoint configured

### Health Check

The container includes a health check that monitors `/api/health`:

```bash
docker ps  # Check health status
```

### Logs

View application logs:

```bash
docker logs -f syncspace-backend
```

## Development

For development, mount your source code as a volume:

```bash
docker run -d \
  --name syncspace-dev \
  -p 5000:5000 \
  -v $(pwd):/app \
  -e NODE_ENV=development \
  syncspace-backend npm run dev
```

## Troubleshooting

### Container won't start

Check logs:

```bash
docker logs syncspace-backend
```

### Connection issues

Verify environment variables:

```bash
docker exec syncspace-backend env
```

### Database connection failed

Ensure MongoDB is accessible from the container:

```bash
docker exec syncspace-backend ping mongo
```
