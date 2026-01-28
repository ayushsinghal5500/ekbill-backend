import 'dotenv/config';  
import express from 'express';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import cors from 'cors';
import logger from './config/logger.js';
import pool from './config/dbConnection.js'; 
import authRouter from './routes/authRoutes.js';
import categoryRouter from './routes/categoryRoutes.js';
import businessRouter from './routes/businessRouter.js';
import quickBillRouter from './routes/quickbillRoutes.js'; 
import customerRouter from './routes/customerRoutes.js'; 
import productRouter from './routes/productRouter.js';
import billRouter from './routes/billRoutes.js';
import dashboardRouter from './routes/dashboardRoutes.js';
import reportRouter from './routes/reportRoutes.js';
import storeRouter from './routes/storeRoutes.js';

import './utils/expiryAlert.js';


export const app = express();

// Middleware
app.use(logger); 
app.use(compression());
app.use(cookieParser());
const allowedOrigins = process.env.PUBLIC_STORE_BASE_URL
  ? process.env.PUBLIC_STORE_BASE_URL.split(',')
  : [];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // Postman / mobile apps

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  },
  credentials: true
}));

app.use(express.json({limit:"2mb"}));
app.use(express.urlencoded({extended:true}));

app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the EkBill API',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
  });
});


app.use('/api/auth', authRouter);
app.use('/api/category', categoryRouter);
app.use('/api/business', businessRouter);
app.use('/api/customer', customerRouter);
app.use('/api/product', productRouter);
app.use('/api/quickbill', quickBillRouter);
app.use('/api/bill', billRouter);
app.use ('/api/dashboard', dashboardRouter);
app.use('/api/report', reportRouter);
app.use('/api/store', storeRouter);