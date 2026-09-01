import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

import restaurantRoutes from './routes/restaurants.js';
import authRoutes from './routes/auth.js';
import orderRoutes from './routes/orders.js';
import adminRoutes from './routes/adminRoutes.js';
import aiRoutes from './routes/ai.js';


// =============================================================
// EXPRESS APP
// =============================================================

const app = express();


// =============================================================
// ENVIRONMENT
// =============================================================

const PORT = process.env.PORT || 5000;

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI;


// =============================================================
// BASIC CHECK
// =============================================================

console.log('==============================================');
console.log('Starting Foodie backend...');
console.log('PORT:', PORT);
console.log(
  'MONGO_URI configured:',
  Boolean(MONGO_URI)
);
console.log(
  'GEMINI_API_KEY configured:',
  Boolean(process.env.GEMINI_API_KEY)
);
console.log('==============================================');


// =============================================================
// MIDDLEWARE
// =============================================================

app.use(
  cors({
    origin: '*'
  })
);

app.use(express.json());


// =============================================================
// HEALTH CHECK
// =============================================================

app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Foodie backend is running 🚀'
  });
});


app.get('/api', (req, res) => {
  res.status(200).json({
    message: 'Foodie API is running 🚀'
  });
});


// =============================================================
// ROUTES
// =============================================================

app.use(
  '/api/restaurants',
  restaurantRoutes
);

app.use(
  '/api/auth',
  authRoutes
);

app.use(
  '/api/orders',
  orderRoutes
);

app.use(
  '/api/admin',
  adminRoutes
);

app.use(
  '/api/ai',
  aiRoutes
);


// =============================================================
// 404 HANDLER
// =============================================================

app.use((req, res) => {
  res.status(404).json({
    message: 'API route not found',
    path: req.originalUrl
  });
});


// =============================================================
// ERROR HANDLER
// =============================================================

app.use((error, req, res, next) => {
  console.error(
    '=============================================='
  );

  console.error(
    'SERVER ERROR'
  );

  console.error(
    error
  );

  console.error(
    '=============================================='
  );

  res.status(500).json({
    message:
      error?.message ||
      'Internal server error'
  });
});


// =============================================================
// START SERVER
// =============================================================

async function startServer() {

  try {

    // ---------------------------------------------------------
    // CHECK MONGODB URL
    // ---------------------------------------------------------

    if (!MONGO_URI) {

      console.error(
        'MONGO_URI / MONGODB_URI is missing.'
      );

      process.exit(1);

    }


    // ---------------------------------------------------------
    // CONNECT TO MONGODB
    // ---------------------------------------------------------

    await mongoose.connect(
      MONGO_URI
    );


    console.log(
      'MongoDB connected successfully ✅'
    );


    // ---------------------------------------------------------
    // START EXPRESS
    // ---------------------------------------------------------

    app.listen(
      PORT,
      '0.0.0.0',
      () => {

        console.log(
          '=============================================='
        );

        console.log(
          `Foodie backend running on port ${PORT} 🚀`
        );

        console.log(
          '=============================================='
        );

      }
    );

  } catch (error) {

    console.error(
      '=============================================='
    );

    console.error(
      'SERVER STARTUP ERROR'
    );

    console.error(
      error
    );

    console.error(
      '=============================================='
    );

    process.exit(1);

  }

}


// =============================================================
// START APPLICATION
// =============================================================

startServer();