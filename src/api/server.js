import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import swaggerUi from 'swagger-ui-express'
import { swaggerDocs } from '../config/swagger.config.js';

import cors from 'cors';

import v1Routes from './routes.v1.js';
import { globalErrorHandler } from './middlewares/error.middleware.js';
import { NotFoundError } from '../core/errors/domain.errors.js';

BigInt.prototype.toJSON = function() {
  return this.toString();
};

const app = express();

// 1. Security & Utility Middlewares
app.use(helmet()); // Secure HTTP headers
app.use(morgan('dev'));

app.use(cors({
  origin: '*', // Adjust this in production based on frontend domains
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true
}));

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

export { app };