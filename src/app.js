const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('../config/db');
const errorHandler = require('./utils/errorHandler');
const { initRedis } = require('./utils/cache');
const rateLimit = require('express-rate-limit');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const authRoutes = require('./routes/auth');
const itineraryRoutes = require('./routes/itineraries');
const graphqlMiddleware = require('./graphql/graphqlMiddleware');

const app = express();
const PORT = process.env.PORT || 5000;

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TMTC Travel Itinerary API',
      version: '1.0.0',
      description: 'API for managing travel itineraries',
    },
    servers: [
      {
        url: process.env.SWAGGER_SERVER_URL || 'http://localhost:5001',
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
  apis: ['./src/routes/*.js', './src/app.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Connect to database (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  // Connect to database asynchronously (non-blocking)
  connectDB().catch(err => {
    console.error('Failed to connect to database:', err.message);
  });
  
  // Initialize Redis asynchronously (non-blocking)
  initRedis().catch(err => {
    console.error('Failed to connect to Redis:', err.message);
  });
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(limiter);

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
/**
 * @swagger
 * /:
 *   get:
 *     summary: API status
 *     tags: [General]
 *     responses:
 *       200:
 *         description: API is running
 */
app.get('/', (req, res) => {
  res.json({ message: 'TMTC Travel Itinerary API is running' });
});

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [General]
 *     responses:
 *       200:
 *         description: Server is healthy
 */
app.get('/api/health', (req, res) => {
  const mongoose = require('mongoose');
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: dbStatus,
    redis: 'checking...' // Could be enhanced to check Redis status
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/itineraries', itineraryRoutes);

// GraphQL endpoint
app.use('/graphql', graphqlMiddleware);

// Error handler middleware (must be last)
app.use(errorHandler);

// Export app for testing
module.exports = app;

