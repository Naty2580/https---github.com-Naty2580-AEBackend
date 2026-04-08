import swaggerJSDoc from "swagger-jsdoc";

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'ASTU EATS API',
            version: '1.0.0',
            description: 'API documentation for the ASTU Eats crowdsourced food delivery platform',
        },
        servers: [
            {
                url: 'http://localhost:3000/api/v1',
                description: 'Local development server'
            },
        ],
        components: {
            securitySchemes: {
                // Allows testing endpoints that require Auth headers right from the UI
                BearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                }
            }
        },
        security: [
            {
                BearerAuth: []
            }
        ]
    },
    // Tells Swagger to read the comments above ALL your route files (.routes.js)
    apis: ['./src/modules/**/*.routes.js']
}

export const swaggerDocs = swaggerJSDoc(options)