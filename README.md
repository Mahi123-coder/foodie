# Food Delivery App

A learning-focused full-stack food delivery application built with React, Node.js/Express, and MongoDB.

## Stack
- Frontend: React + Vite
- Backend: Node.js + Express
- Database: MongoDB + Mongoose
- Auth: JWT + bcrypt

## Run
### Backend
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Set `MONGODB_URI` in `.env` to your MongoDB connection string.

### Frontend
```bash
cd frontend
npm install
npm run dev
```

The frontend expects the API at `http://localhost:5000/api`.
