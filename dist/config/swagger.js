import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { env } from './env.js';
const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Hamro Store API',
            version: '1.0.0',
            description: 'API documentation for the Hamro Store backend',
        },
        servers: [
            {
                url: `http://localhost:${env.PORT}/api/v1`,
                description: 'Development server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
    },
    apis: ['./src/routes/*.ts', './dist/routes/*.js'],
};
const swaggerSpec = swaggerJsdoc(options);
export const setupSwagger = (app) => {
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    console.log(`📝 Swagger Docs available at http://localhost:${env.PORT}/docs`);
};
