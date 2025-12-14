const mongoose = require('mongoose');

// Connect to test database BEFORE importing app (so models use the test connection)
beforeAll(async () => {
  const mongoURI = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/tmtc-test';
  try {
    // Close any existing connections and clear models
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    // Clear models cache
    mongoose.models = {};
    mongoose.modelSchemas = {};
    
    await mongoose.connect(mongoURI);
    console.log('Test database connected');
  } catch (error) {
    console.error('Test database connection error:', error);
    throw error;
  }
});

const request = require('supertest');
// Import app after connection is established
const app = require('../src/app');
const User = require('../src/models/User');
const Itinerary = require('../src/models/Itinerary');


/**
 * Helper function to create authenticated request with Bearer token
 * All protected routes MUST use Bearer token authentication
 * Format: Authorization: Bearer <token>
 * 
 * @param {string} method - HTTP method (get, post, put, delete)
 * @param {string} url - API endpoint URL
 * @param {string} token - JWT authentication token
 * @returns {object} SuperTest request object with Bearer token header
 */
const authenticatedRequest = (method, url, token) => {
  if (!token) {
    throw new Error('Authentication token is required for protected routes. Use Bearer token format.');
  }
  const req = request(app)[method.toLowerCase()](url);
  return req.set('Authorization', `Bearer ${token}`);
};

describe('Itinerary Endpoints', () => {
  let authToken;
  let userId;

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    // Clean up first
    await Itinerary.deleteMany({});
    await User.deleteMany({});

    // Use a unique email for each test run to avoid duplicate key errors
    const uniqueEmail = `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
    
    // Create a user and get token
    const userRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: uniqueEmail,
        password: 'password123',
        name: 'Test User'
      });

    // Log error if registration fails
    if (userRes.statusCode !== 201) {
      console.error('User registration failed:', userRes.statusCode, userRes.body);
    }

    expect(userRes.statusCode).toBe(201);
    expect(userRes.body).toHaveProperty('token');
    expect(userRes.body).toHaveProperty('user');

    authToken = userRes.body.token;
    
    // Always extract userId from JWT token as primary source (most reliable)
    if (authToken) {
      const jwt = require('jsonwebtoken');
      try {
        const decoded = jwt.verify(authToken, process.env.JWT_SECRET || 'test-secret-key');
        if (decoded.userId) {
          userId = decoded.userId.toString();
        }
      } catch (e) {
        // If JWT decode fails, fall back to response
        userId = userRes.body.user.id || userRes.body.user._id;
        if (userId) {
          userId = userId.toString();
        }
      }
    } else {
      // Fallback to response if no token
      userId = userRes.body.user.id || userRes.body.user._id;
      if (userId) {
        userId = userId.toString();
      }
    }
    
    // Verify the user exists in the database (wait a bit for DB to sync if needed)
    let user = userId ? await User.findById(userId) : null;
    let retries = 10;
    while (!user && retries > 0 && userId) {
      await new Promise(resolve => setTimeout(resolve, 100));
      user = await User.findById(userId);
      retries--;
    }
    
    // If still not found, try finding by email as fallback
    if (!user) {
      user = await User.findOne({ email: uniqueEmail });
      if (user) {
        userId = user._id.toString();
      }
    }
    
    // Verify we have at least userId and token
    expect(userId).toBeTruthy();
    expect(authToken).toBeTruthy();
    
    // If user is still null, wait longer and retry (critical for authentication)
    if (!user && userId) {
      // Wait up to 2 seconds for user to be visible
      for (let i = 0; i < 20 && !user; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        user = await User.findById(userId);
      }
    }
    
    // If still not found, try one more time to find by email
    if (!user) {
      console.warn('User not immediately visible in database after registration. Retrying...');
      user = await User.findOne({ email: uniqueEmail });
      if (user) {
        userId = user._id.toString();
        console.log('Found user by email, updated userId:', userId);
      } else {
        // Last resort: ensure userId is set from token (critical for tests to continue)
        if (authToken) {
          const jwt = require('jsonwebtoken');
          try {
            const decoded = jwt.verify(authToken, process.env.JWT_SECRET || 'test-secret-key');
            if (decoded.userId) {
              userId = decoded.userId.toString();
              // Try to find user one more time
              user = await User.findById(userId);
              if (!user) {
                console.warn('User still not found, but token is valid. Tests may fail authentication.');
              }
            }
          } catch (e) {
            console.error('Failed to decode token:', e.message);
          }
        }
      }
    }
    
    // Verify token is valid by decoding it
    if (authToken) {
      const jwt = require('jsonwebtoken');
      try {
        const decoded = jwt.verify(authToken, process.env.JWT_SECRET || 'test-secret-key');
        expect(decoded.userId).toBeTruthy();
        // Ensure userId matches token
        if (decoded.userId.toString() !== userId) {
          userId = decoded.userId.toString();
          user = await User.findById(userId);
        }
      } catch (e) {
        throw new Error(`Invalid auth token: ${e.message}`);
      }
    }
    
    // Final verification - we must have userId and authToken
    expect(userId).toBeTruthy();
    expect(authToken).toBeTruthy();
    
    // CRITICAL: Ensure user is definitely in database before tests run
    // This is essential for authentication middleware to work
    if (!user) {
      // One final attempt with longer wait
      await new Promise(resolve => setTimeout(resolve, 500));
      user = await User.findById(userId);
      if (!user) {
        user = await User.findOne({ email: uniqueEmail });
        if (user) {
          userId = user._id.toString();
        }
      }
    }
    
    // If user still doesn't exist, this is a critical failure
    if (!user) {
      throw new Error(`CRITICAL: User not found in database after all retries. userId: ${userId}, email: ${uniqueEmail}. Authentication will fail.`);
    }
    
    // Verify user can be found by the auth middleware (same query it uses)
    const authUser = await User.findById(userId);
    if (!authUser) {
      throw new Error(`CRITICAL: User not findable by auth middleware. userId: ${userId}`);
    }
  });

  describe('POST /api/itineraries', () => {
    it('should create a new itinerary', async () => {
      const res = await request(app)
        .post('/api/itineraries')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Paris Trip',
          destination: 'Paris',
          startDate: '2024-06-01',
          endDate: '2024-06-05',
          activities: [
            {
              time: '10:00',
              description: 'Visit Eiffel Tower',
              location: 'Eiffel Tower'
            }
          ]
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.itinerary).toHaveProperty('_id');
      expect(res.body.itinerary.title).toBe('Paris Trip');
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/itineraries')
        .send({
          title: 'Paris Trip',
          destination: 'Paris',
          startDate: '2024-06-01',
          endDate: '2024-06-05'
        });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/itineraries', () => {
    beforeEach(async () => {
      // Ensure userId and authToken are set from outer beforeEach
      expect(userId).toBeTruthy();
      expect(authToken).toBeTruthy();
      
      // If somehow missing, fail with clear error
      if (!userId || !authToken) {
        throw new Error(`Setup failed: userId=${userId}, authToken=${!!authToken}. Outer beforeEach should have set these.`);
      }
      
      // Verify user exists and can be found by auth middleware
      const verifyUser = await User.findById(userId);
      if (!verifyUser) {
        // Wait a bit and retry
        await new Promise(resolve => setTimeout(resolve, 200));
        const retryUser = await User.findById(userId);
        if (!retryUser) {
          throw new Error(`User not found for authentication. userId: ${userId}`);
        }
      }
      
      // Ensure userId is a valid ObjectId
      const userIdObj = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
      
      // Clean up any existing itineraries for this user first
      await Itinerary.deleteMany({ userId: userIdObj });
      
      // Create test itineraries
      const created = await Itinerary.create([
        {
          userId: userIdObj,
          title: 'Paris Trip',
          destination: 'Paris',
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-06-05')
        },
        {
          userId: userIdObj,
          title: 'London Trip',
          destination: 'London',
          startDate: new Date('2024-07-01'),
          endDate: new Date('2024-07-05')
        }
      ]);
      
      // Verify creation
      expect(created).toHaveLength(2);
      
      // Double-check they're in the database
      const verifyCount = await Itinerary.countDocuments({ userId: userIdObj });
      if (verifyCount < 2) {
        // Retry creation if needed
        await new Promise(resolve => setTimeout(resolve, 200));
        const retryCount = await Itinerary.countDocuments({ userId: userIdObj });
        if (retryCount < 2) {
          throw new Error(`Failed to create itineraries. Expected 2, found ${retryCount}`);
        }
      }
      
      // Wait for database to sync
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    it('should get all itineraries', async () => {
      const res = await request(app)
        .get('/api/itineraries')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.itineraries).toHaveLength(2);
      expect(res.body).toHaveProperty('pagination');
    });

    it('should filter by destination', async () => {
      // Verify setup
      expect(authToken).toBeTruthy();
      expect(userId).toBeTruthy();
      
      const res = await request(app)
        .get('/api/itineraries?destination=Paris')
        .set('Authorization', `Bearer ${authToken}`);

      if (res.statusCode === 401) {
        console.error('Auth failed. Token:', authToken ? 'present' : 'missing');
      }
      
      expect(res.statusCode).toBe(200);
      expect(res.body.itineraries).toHaveLength(1);
      expect(res.body.itineraries[0].destination).toBe('Paris');
    });

    it('should support pagination', async () => {
      const res = await request(app)
        .get('/api/itineraries?page=1&limit=1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.itineraries).toHaveLength(1);
      expect(res.body.pagination.limit).toBe(1);
    });
  });

  describe('GET /api/itineraries/:id', () => {
    let itineraryId;

    beforeEach(async () => {
      // Ensure userId is set and valid
      expect(userId).toBeTruthy();
      expect(authToken).toBeTruthy();
      
      const userIdObj = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
      
      const itinerary = await Itinerary.create({
        userId: userIdObj,
        title: 'Paris Trip',
        destination: 'Paris',
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-05')
      });
      itineraryId = itinerary._id.toString();
    });

    it('should get itinerary by id', async () => {
      const res = await request(app)
        .get(`/api/itineraries/${itineraryId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.itinerary._id).toBe(itineraryId);
    });

    it('should return 404 for non-existent itinerary', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/itineraries/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('PUT /api/itineraries/:id', () => {
    let itineraryId;

    beforeEach(async () => {
      const userIdObj = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
      
      const itinerary = await Itinerary.create({
        userId: userIdObj,
        title: 'Paris Trip',
        destination: 'Paris',
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-05')
      });
      itineraryId = itinerary._id.toString();
    });

    it('should update itinerary', async () => {
      const res = await request(app)
        .put(`/api/itineraries/${itineraryId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Paris Trip'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.itinerary.title).toBe('Updated Paris Trip');
    });
  });

  describe('DELETE /api/itineraries/:id', () => {
    let itineraryId;

    beforeEach(async () => {
      const userIdObj = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
      
      const itinerary = await Itinerary.create({
        userId: userIdObj,
        title: 'Paris Trip',
        destination: 'Paris',
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-05')
      });
      itineraryId = itinerary._id.toString();
    });

    it('should delete itinerary', async () => {
      const res = await request(app)
        .delete(`/api/itineraries/${itineraryId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);

      const checkRes = await request(app)
        .get(`/api/itineraries/${itineraryId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(checkRes.statusCode).toBe(404);
    });
  });
});

