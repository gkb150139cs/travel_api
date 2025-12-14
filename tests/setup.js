// Jest setup file for Docker container configuration
// This file runs before all tests

// Check if we're running tests against Docker containers
const USE_DOCKER = process.env.USE_DOCKER === 'true' || process.env.CI === 'true';

if (USE_DOCKER) {
  // Use Docker container endpoints
  process.env.MONGODB_URI_TEST = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27019/tmtc-test';
  process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6381';
  console.log('🐳 Running tests against Docker containers');
  console.log(`   MongoDB: ${process.env.MONGODB_URI_TEST}`);
  console.log(`   Redis: ${process.env.REDIS_URL}`);
} else {
  // Use local services (default)
  process.env.MONGODB_URI_TEST = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/tmtc-test';
  process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
  console.log('💻 Running tests against local services');
  console.log(`   MongoDB: ${process.env.MONGODB_URI_TEST}`);
  console.log(`   Redis: ${process.env.REDIS_URL}`);
}

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
process.env.EMAIL_ENABLED = 'false'; // Disable email in tests

// Increase timeout for Docker container connections
jest.setTimeout(30000); // 30 seconds

