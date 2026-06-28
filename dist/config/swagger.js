import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { env } from './env.js';
const serverUrl = env.NODE_ENV === 'production'
    ? 'https://hamro-store-be.onrender.com/api/v1'
    : `http://localhost:${env.PORT}/api/v1`;
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
                url: serverUrl,
                description: env.NODE_ENV === 'production' ? 'Production server' : 'Development server',
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
    apis: env.NODE_ENV === 'production' ? ['./dist/routes/*.js'] : ['./src/routes/*.ts'],
};
const swaggerSpec = swaggerJsdoc(options);
export const setupSwagger = (app) => {
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    console.log(`📝 Swagger Docs available at ${serverUrl.replace('/api/v1', '')}/docs`);
};
