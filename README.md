# Book_Vardi_Backend

## Environment Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update the `.env` file with your actual values:
   - Replace `MONGO_URI` with your MongoDB connection string
   - Set a secure `JWT_SECRET` for production
   - Configure `PORT` if needed

## Development

```bash
npm install
npm run dev
```

## Production

```bash
npm install --production
npm start
```

## Environment Variables

- `MONGO_URI`: MongoDB connection string
- `PORT`: Server port (default: 5000)
- `JWT_SECRET`: Secret key for JWT tokens
- `NODE_ENV`: Environment (development/production)

## Database Initialization

```bash
npm run init-db
```

This creates:
- Default admin: admin@admin.com / admin123
- Sample categories, products, users, stores, delivery boys