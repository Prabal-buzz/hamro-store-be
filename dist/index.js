import http from 'http';
import app from './app.js';
import { env } from './config/env.js';
// Handle uncaught exceptions before doing anything else
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
    console.error(err.name, err.message, err.stack);
    process.exit(1);
});
const server = http.createServer(app);
const startServer = () => {
    const port = env.PORT;
    server.listen(port, () => {
        console.log(`🚀 Server running in ${env.NODE_ENV} mode on port ${port}`);
    });
};
startServer();
// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION! 💥 Shutting down...');
    console.error(err?.name || 'Error', err?.message || err);
    // Gracefully close server before exiting
    server.close(() => {
        process.exit(1);
    });
});
// Graceful shutdown on SIGTERM / SIGINT
const handleGracefulShutdown = (signal) => {
    console.log(`\n👋 ${signal} received. Shutting down gracefully...`);
    server.close(() => {
        console.log('💥 Process terminated!');
        process.exit(0);
    });
    // Force shutdown after 10 seconds if closing server takes too long
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
