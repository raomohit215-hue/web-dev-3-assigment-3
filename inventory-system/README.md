# Inventory & Data Management System

REST API built with Node.js, Express, Mongoose and dotenv.

## Setup
```bash
npm install
cp .env.example .env     # set MONGO_URI
npm run dev              # or npm start
```

## Structure
```
src/
  server.js              entry point, DB connect, graceful shutdown
  app.js                 express app, routes, error middleware
  config/db.js           mongoose connection
  models/Product.js      schema + validation + virtuals
  controllers/           business logic
  routes/                route definitions
  middleware/            validate.js, errorHandler.js
  utils/                 AppError, catchAsync
```

## Endpoints
| Method | Route | Purpose |
|---|---|---|
| POST | /api/products | Create product |
| GET | /api/products | List (filter / sort / paginate) |
| GET | /api/products/:id | Single product |
| PUT/PATCH | /api/products/:id | Update details |
| PATCH | /api/products/:id/restock | Atomically add stock `{ "quantity": 20 }` |
| PATCH | /api/products/:id/sale | Atomically remove stock (409 if insufficient) |
| DELETE | /api/products/:id | Delete |
| GET | /api/products/reports/low-stock | quantity <= lowStockThreshold |
| GET | /api/products/reports/category-summary | Aggregation per category |

### List query params
`category`, `supplier`, `minPrice`, `maxPrice`, `inStock=true|false`, `search`,
`sort=price,-createdAt` (name, price, quantity, category, createdAt, updatedAt),
`page` (default 1), `limit` (default 10, max 100)

Example: `GET /api/products?category=electronics&minPrice=100&sort=-price&page=1&limit=5`

## Sample requests
```bash
curl -X POST localhost:5000/api/products -H "Content-Type: application/json" -d '{
  "name":"Wireless Mouse","sku":"MOU-001","category":"Electronics",
  "price":799,"quantity":40,"lowStockThreshold":10,"supplier":"Logi Ltd"}'

curl -X PATCH localhost:5000/api/products/<id>/sale    -H "Content-Type: application/json" -d '{"quantity":5}'
curl -X PATCH localhost:5000/api/products/<id>/restock -H "Content-Type: application/json" -d '{"quantity":20}'
curl localhost:5000/api/products/reports/low-stock
curl localhost:5000/api/products/reports/category-summary
```

## Design notes
- **Safe stock changes:** sale uses one `findOneAndUpdate` with `{quantity: {$gte: qty}}` + `$inc`, so concurrent sales cannot oversell. Restock uses atomic `$inc`.
- **Validation layers:** middleware (whitelist fields, type checks, ObjectId format) then Mongoose schema rules.
- **Errors:** one central handler maps ValidationError -> 400, CastError -> 400, duplicate key -> 409, unknown route -> 404.
- **Quantity** is not editable via PUT/PATCH, only via restock/sale, keeping stock changes explicit.
