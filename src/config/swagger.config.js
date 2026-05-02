import swaggerJSDoc from 'swagger-jsdoc';
import config from './env.config.js';

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ASTU Eats API Specification',
      version: '1.0.0',
      description: 'Enterprise REST API documentation for the ASTU Eats Campus Delivery Platform.',
      contact: {
        name: 'Engineering Team'
      }
    },
    servers: [
      {
        url: `http://localhost:${config.PORT}/api/v1`,
        description: 'Development Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT Access Token. Do not include "Bearer " in the input field.'
        },
      },
    },
    // Applies Bearer auth globally to all routes unless overridden
    security: [{ bearerAuth: [] }], 
  },
  // Tells Swagger where to find the API definitions
  apis: ['./src/modules/**/*.routes.js'],
};

export const swaggerSpec = swaggerJSDoc(swaggerOptions);
