import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import swaggerUi from 'swagger-ui-express'
import { swaggerDocs } from '../config/swagger.config.js';

import cors from 'cors';

import { timeoutService } from "../modules/orders/timeout.service.js"
import v1Routes from './routes.v1.js';
import { globalErrorHandler } from './middlewares/error.middleware.js';
import { NotFoundError } from '../core/errors/domain.errors.js';

BigInt.prototype.toJSON = function() {
  return this.toString();
};

 

const app = express();

// 1. Security & Utility Middlewares
app.use(helmet()); // Secure HTTP headers

const allowedOrigins = [
  'http://localhost:3000', // React/Next.js default
  'http://localhost:5173', // Vite default
  'http://127.0.0.1:5173', // Vite alternate
  process.env.FRONTEND_URL  // Production URL
].filter(Boolean); // Remove undefined values

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`[CORS Blocked] Origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], // OPTIONS is required for preflight
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'], // Explicitly allow headers
  credentials: true // REQUIRED for HttpOnly cookies
}));

app.use(morgan('dev'));



// Payload parsers
app.use(express.json({ limit: '1mb' })); // Prevent large payload DOS attacks
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// serve the swagger api docimentation ui
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs))

// 2. API Routing
app.use('/api/v1', v1Routes);


// 3. Catch-all for undefined routes
app.use((req, res, next) => {
  next(new NotFoundError(`The route ${req.originalUrl} does not exist on this server.`));
});

// 4. Global Error Handling (Must be the last middleware)
app.use(globalErrorHandler);

timeoutService.sweepOrphanedOrders().catch(console.error);

export { app };