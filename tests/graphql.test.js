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
 * Standard test user credentials
 * Always use login to get Bearer token for authentication
 */
const TEST_USER = {
  email: 'user@example.com',
  password: 'string',
  name: 'Test User'
};

/**
 * Helper function to login and get Bearer token via REST API
 * Always use login instead of registration for getting tokens
 * 
 * @returns {Promise<string>} JWT Bearer token
 */
const loginAndGetToken = async () => {
  // Ensure user exists (register if needed)
  try {
    await request(app)
      .post('/api/auth/register')
      .send(TEST_USER);
  } catch (e) {
    // User might already exist, that's okay
  }
  
  // Login to get token
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({
      email: TEST_USER.email,
      password: TEST_USER.password
    });
  
  if (loginRes.statusCode !== 200) {
    throw new Error(`Login failed: ${loginRes.statusCode} - ${JSON.stringify(loginRes.body)}`);
  }
  
  if (!loginRes.body || !loginRes.body.token) {
    throw new Error(`Login response missing token: ${JSON.stringify(loginRes.body)}`);
  }
  
  return loginRes.body.token;
};

/**
 * Helper function to make GraphQL requests with Bearer token authentication
 * All protected GraphQL queries/mutations MUST use Bearer token authentication
 * Format: Authorization: Bearer <token>
 * 
 * @param {string} query - GraphQL query or mutation string
 * @param {object} variables - GraphQL variables object
 * @param {string|null} token - JWT authentication token (required for protected operations)
 * @returns {object} SuperTest request object with Bearer token header if token provided
 */
const graphqlRequest = (query, variables = {}, token = null) => {
  const req = request(app)
    .post('/graphql')
    .send({ query, variables });
  
  // Always use Bearer token format when token is provided
  // This ensures consistent authentication across all protected GraphQL operations
  if (token) {
    req.set('Authorization', `Bearer ${token}`);
  }
  
  return req;
};

describe('GraphQL API', () => {
  let authToken;
  let userId;
  let itineraryId;

  beforeAll(async () => {
    // Clean up
    await User.deleteMany({});
    await Itinerary.deleteMany({});
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Itinerary.deleteMany({});
  });

  describe('Authentication Mutations', () => {
    describe('register', () => {
      const registerMutation = `
        mutation Register($input: RegisterInput!) {
          register(input: $input) {
            token
            user {
              _id
              email
              name
            }
          }
        }
      `;

      it('should register a new user', async () => {
        const variables = {
          input: {
            email: 'test@example.com',
            password: 'password123',
            name: 'Test User'
          }
        };

        const res = await graphqlRequest(registerMutation, variables);

        expect(res.statusCode).toBe(200);
        expect(res.body.data).toBeDefined();
        expect(res.body.data.register).toHaveProperty('token');
        expect(res.body.data.register.user.email).toBe('test@example.com');
        expect(res.body.data.register.user.name).toBe('Test User');
      });

      it('should not register duplicate email', async () => {
        // Use unique email for first registration
        const uniqueEmail = `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
        
        // Register first user
        await graphqlRequest(registerMutation, {
          input: {
            email: uniqueEmail,
            password: 'password123',
            name: 'Test User'
          }
        });

        // Try to register again with same email
        const res = await graphqlRequest(registerMutation, {
          input: {
            email: uniqueEmail,
            password: 'password123',
            name: 'Test User 2'
          }
        });

        // GraphQL may return 200 or 500 for errors, but errors should be in body.errors
        expect([200, 500]).toContain(res.statusCode);
        expect(res.body.errors).toBeDefined();
        const errorMessage = res.body.errors[0].message;
        expect(errorMessage).toMatch(/already exists|duplicate key/i);
      });

      it('should validate required fields', async () => {
        const res = await graphqlRequest(registerMutation, {
          input: {
            email: 'test@example.com'
            // Missing password and name - GraphQL will validate this
          }
        });

        // GraphQL validation errors can return 400, 200, or 500 with errors
        expect([200, 400, 500]).toContain(res.statusCode);
        // If it's a validation error, it should have errors in the body
        if (res.statusCode === 200 || res.statusCode === 500) {
          expect(res.body.errors).toBeDefined();
        }
      });
    });

    describe('login', () => {
      const loginMutation = `
        mutation Login($input: LoginInput!) {
          login(input: $input) {
            token
            user {
              _id
              email
              name
            }
          }
        }
      `;

      beforeEach(async () => {
        // Register a user first
        await graphqlRequest(`
          mutation {
            register(input: {
              email: "test@example.com",
              password: "password123",
              name: "Test User"
            }) {
              token
            }
          }
        `);
      });

      it('should login with valid credentials', async () => {
        const variables = {
          input: {
            email: 'test@example.com',
            password: 'password123'
          }
        };

        const res = await graphqlRequest(loginMutation, variables);

        expect(res.statusCode).toBe(200);
        expect(res.body.data).toBeDefined();
        expect(res.body.data.login).toHaveProperty('token');
        expect(res.body.data.login.user.email).toBe('test@example.com');
      });

      it('should not login with invalid credentials', async () => {
        const variables = {
          input: {
            email: 'test@example.com',
            password: 'wrongpassword'
          }
        };

        const res = await graphqlRequest(loginMutation, variables);

        // GraphQL may return 200 or 500 for errors
        expect([200, 500]).toContain(res.statusCode);
        expect(res.body.errors).toBeDefined();
        expect(res.body.errors[0].message).toContain('Invalid credentials');
      });
    });
  });

  describe('Itinerary Queries', () => {
    beforeEach(async () => {
      // Ensure test user exists
      try {
        await request(app)
          .post('/api/auth/register')
          .send(TEST_USER);
      } catch (e) {
        // User might already exist, that's okay
      }
      
      // Always use login to get Bearer token
      authToken = await loginAndGetToken();
      
      // Get userId from token
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(authToken, process.env.JWT_SECRET || 'test-secret-key');
      userId = decoded.userId.toString();
      
      // Verify user exists - wait for database to sync
      let testUser = userId ? await User.findById(userId) : null;
      let retries = 10;
      while (!testUser && retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
        testUser = await User.findOne({ email: TEST_USER.email });
        if (testUser) {
          userId = testUser._id.toString();
        } else if (userId) {
          testUser = await User.findById(userId);
        }
        retries--;
      }
      
      // If still not found, try finding by email as final fallback
      if (!testUser) {
        testUser = await User.findOne({ email: TEST_USER.email });
        if (testUser) {
          userId = testUser._id.toString();
        }
      }
      
      expect(userId).toBeTruthy();
      expect(authToken).toBeTruthy();
      
      // If user is still null, wait longer and retry (critical for authentication)
      if (!testUser && userId) {
        // Wait up to 2 seconds for user to be visible
        for (let i = 0; i < 20 && !testUser; i++) {
          await new Promise(resolve => setTimeout(resolve, 100));
          testUser = await User.findById(userId);
        }
      }
      
      // If still not found, try finding by email as fallback
      if (!testUser) {
        testUser = await User.findOne({ email: TEST_USER.email });
        if (testUser) {
          userId = testUser._id.toString();
        }
      }
      
      // CRITICAL: Ensure user is definitely in database before tests run
      if (!testUser) {
        // One final attempt with longer wait
        await new Promise(resolve => setTimeout(resolve, 500));
        testUser = await User.findById(userId);
        if (!testUser) {
          testUser = await User.findOne({ email: TEST_USER.email });
          if (testUser) {
            userId = testUser._id.toString();
          }
        }
      }
      
      // If user still doesn't exist, this is a critical failure
      if (!testUser) {
        throw new Error(`CRITICAL: User not found in database after all retries. userId: ${userId}, email: ${TEST_USER.email}. Authentication will fail.`);
      }
      
      // Verify user can be found by the auth middleware (same query it uses)
      const authUser = await User.findById(userId);
      if (!authUser) {
        throw new Error(`CRITICAL: User not findable by auth middleware. userId: ${userId}`);
      }
      
      // Clean up any existing itineraries for this user to avoid conflicts
      if (userId) {
        const userIdObj = new mongoose.Types.ObjectId(userId);
        await Itinerary.deleteMany({ userId: userIdObj });
      }
    });

    describe('itineraries query', () => {
      const itinerariesQuery = `
        query GetItineraries($destination: String, $page: Int, $limit: Int, $sort: String) {
          itineraries(destination: $destination, page: $page, limit: $limit, sort: $sort) {
            itineraries {
              _id
              title
              destination
              startDate
              endDate
              activities {
                time
                description
                location
              }
            }
            total
            page
            pages
          }
        }
      `;

      beforeEach(async () => {
        // Ensure userId is available and valid
        expect(userId).toBeTruthy();
        expect(authToken).toBeTruthy();
        
        // Verify userId is a valid ObjectId string
        if (!mongoose.Types.ObjectId.isValid(userId)) {
          throw new Error(`Invalid userId: ${userId}`);
        }
        
        // Verify user exists before creating itineraries
        let testUser = await User.findById(userId);
        if (!testUser) {
          // Wait and retry
          await new Promise(resolve => setTimeout(resolve, 200));
          testUser = await User.findById(userId);
          if (!testUser) {
            testUser = await User.findOne({ email: TEST_USER.email });
            if (testUser) {
              userId = testUser._id.toString();
            }
          }
        }
        
        if (!testUser) {
          throw new Error(`User not found with userId: ${userId}. Cannot create itineraries.`);
        }
        
        // Clean up any existing itineraries first
        const userIdObj = new mongoose.Types.ObjectId(userId);
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
        
        // Verify itineraries were created
        expect(created).toHaveLength(2);
        expect(created[0]._id).toBeTruthy();
        expect(created[1]._id).toBeTruthy();
        
        // Wait a moment for database to sync
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Verify they exist in database with retries
        let count = await Itinerary.countDocuments({ userId: userIdObj });
        let retries = 5;
        while (count < 2 && retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 200));
          count = await Itinerary.countDocuments({ userId: userIdObj });
          retries--;
        }
        
        expect(count).toBe(2);
      });

      it('should get all itineraries', async () => {
        // Verify itineraries exist in database before querying
        const userIdObj = new mongoose.Types.ObjectId(userId);
        const count = await Itinerary.countDocuments({ userId: userIdObj });
        expect(count).toBeGreaterThanOrEqual(2);
        
        const res = await graphqlRequest(itinerariesQuery, {}, authToken);

        expect(res.statusCode).toBe(200);
        expect(res.body.data).toBeDefined();
        if (res.body.errors) {
          console.error('GraphQL errors:', JSON.stringify(res.body.errors, null, 2));
        }
        expect(res.body.errors).toBeUndefined();
        expect(res.body.data.itineraries.itineraries).toHaveLength(2);
        expect(res.body.data.itineraries.total).toBe(2);
      });

      it('should filter by destination', async () => {
        const variables = { destination: 'Paris' };
        const res = await graphqlRequest(itinerariesQuery, variables, authToken);

        expect(res.statusCode).toBe(200);
        expect(res.body.data.itineraries.itineraries).toHaveLength(1);
        expect(res.body.data.itineraries.itineraries[0].destination).toBe('Paris');
      });

      it('should support pagination', async () => {
        // Verify itineraries exist before querying
        const userIdObj = new mongoose.Types.ObjectId(userId);
        const totalCount = await Itinerary.countDocuments({ userId: userIdObj });
        expect(totalCount).toBeGreaterThanOrEqual(2);
        
        const variables = { page: 1, limit: 1 };
        const res = await graphqlRequest(itinerariesQuery, variables, authToken);

        expect(res.statusCode).toBe(200);
        if (res.body.errors) {
          console.error('GraphQL errors:', JSON.stringify(res.body.errors, null, 2));
        }
        expect(res.body.errors).toBeUndefined();
        expect(res.body.data.itineraries.itineraries).toHaveLength(1);
        expect(res.body.data.itineraries.page).toBe(1);
        expect(res.body.data.itineraries.pages).toBeGreaterThanOrEqual(2);
      });

      it('should require authentication', async () => {
        const res = await graphqlRequest(itinerariesQuery, {});

        // GraphQL may return 200 or 500 for errors
        expect([200, 500]).toContain(res.statusCode);
        expect(res.body.errors).toBeDefined();
        expect(res.body.errors[0].message).toContain('Authentication required');
      });
    });

    describe('itinerary query', () => {
      const itineraryQuery = `
        query GetItinerary($id: ID!) {
          itinerary(id: $id) {
            _id
            title
            destination
            startDate
            endDate
            activities {
              time
              description
              location
            }
          }
        }
      `;

      beforeEach(async () => {
        const userIdObj = new mongoose.Types.ObjectId(userId);
        const itinerary = await Itinerary.create({
          userId: userIdObj,
          title: 'Paris Trip',
          destination: 'Paris',
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-06-05'),
          activities: [
            {
              time: '10:00',
              description: 'Visit Eiffel Tower',
              location: 'Eiffel Tower'
            }
          ]
        });
        itineraryId = itinerary._id.toString();
      });

      it('should get itinerary by id', async () => {
        const variables = { id: itineraryId };
        const res = await graphqlRequest(itineraryQuery, variables, authToken);

        expect(res.statusCode).toBe(200);
        expect(res.body.data).toBeDefined();
        expect(res.body.data.itinerary._id).toBe(itineraryId);
        expect(res.body.data.itinerary.title).toBe('Paris Trip');
      });

      it('should return error for non-existent itinerary', async () => {
        const fakeId = new mongoose.Types.ObjectId().toString();
        const variables = { id: fakeId };
        const res = await graphqlRequest(itineraryQuery, variables, authToken);

        expect(res.statusCode).toBe(200);
        expect(res.body.errors).toBeDefined();
        expect(res.body.errors[0].message).toContain('not found');
      });

      it('should require authentication', async () => {
        const variables = { id: itineraryId };
        const res = await graphqlRequest(itineraryQuery, variables);

        expect(res.statusCode).toBe(200);
        expect(res.body.errors).toBeDefined();
        expect(res.body.errors[0].message).toContain('Authentication required');
      });
    });

    describe('me query', () => {
      const meQuery = `
        query {
          me {
            _id
            email
            name
          }
        }
      `;

      it('should get current user info', async () => {
        const res = await graphqlRequest(meQuery, {}, authToken);

        expect(res.statusCode).toBe(200);
        expect(res.body.data).toBeDefined();
        expect(res.body.data.me.email).toBe(TEST_USER.email);
        expect(res.body.data.me.name).toBe('Test User');
      });

      it('should require authentication', async () => {
        const res = await graphqlRequest(meQuery, {});

        expect(res.statusCode).toBe(200);
        expect(res.body.errors).toBeDefined();
        expect(res.body.errors[0].message).toContain('Authentication required');
      });
    });
  });

  describe('Itinerary Mutations', () => {
    beforeEach(async () => {
      // Ensure test user exists
      try {
        await request(app)
          .post('/api/auth/register')
          .send(TEST_USER);
      } catch (e) {
        // User might already exist, that's okay
      }
      
      // Always use login to get Bearer token
      authToken = await loginAndGetToken();
      
      // Get userId from token
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(authToken, process.env.JWT_SECRET || 'test-secret-key');
      userId = decoded.userId.toString();

      // Verify user exists
      const user = await User.findOne({ email: TEST_USER.email });
      if (user) {
        userId = user._id.toString();
      }
      expect(user).toBeTruthy();
    });

    describe('createItinerary', () => {
      const createMutation = `
        mutation CreateItinerary($input: CreateItineraryInput!) {
          createItinerary(input: $input) {
            _id
            title
            destination
            startDate
            endDate
            activities {
              time
              description
              location
            }
          }
        }
      `;

      it('should create a new itinerary', async () => {
        const variables = {
          input: {
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
          }
        };

        const res = await graphqlRequest(createMutation, variables, authToken);

        expect(res.statusCode).toBe(200);
        expect(res.body.data).toBeDefined();
        expect(res.body.data.createItinerary.title).toBe('Paris Trip');
        expect(res.body.data.createItinerary.destination).toBe('Paris');
        expect(res.body.data.createItinerary.activities).toHaveLength(1);
      });

      it('should require authentication', async () => {
        const variables = {
          input: {
            title: 'Paris Trip',
            destination: 'Paris',
            startDate: '2024-06-01',
            endDate: '2024-06-05'
          }
        };

        const res = await graphqlRequest(createMutation, variables);

        // GraphQL may return 200 or 500 for errors
        expect([200, 500]).toContain(res.statusCode);
        expect(res.body.errors).toBeDefined();
        expect(res.body.errors[0].message).toContain('Authentication required');
      });
    });

    describe('updateItinerary', () => {
      const updateMutation = `
        mutation UpdateItinerary($id: ID!, $input: UpdateItineraryInput!) {
          updateItinerary(id: $id, input: $input) {
            _id
            title
            destination
          }
        }
      `;

      beforeEach(async () => {
        const userIdObj = new mongoose.Types.ObjectId(userId);
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
        const variables = {
          id: itineraryId,
          input: {
            title: 'Updated Paris Trip'
          }
        };

        const res = await graphqlRequest(updateMutation, variables, authToken);

        expect(res.statusCode).toBe(200);
        expect(res.body.data).toBeDefined();
        expect(res.body.data.updateItinerary.title).toBe('Updated Paris Trip');
      });

      it('should require authentication', async () => {
        const variables = {
          id: itineraryId,
          input: {
            title: 'Updated Title'
          }
        };

        const res = await graphqlRequest(updateMutation, variables);

        // GraphQL may return 200 or 500 for errors
        expect([200, 500]).toContain(res.statusCode);
        expect(res.body.errors).toBeDefined();
        expect(res.body.errors[0].message).toContain('Authentication required');
      });
    });

    describe('deleteItinerary', () => {
      const deleteMutation = `
        mutation DeleteItinerary($id: ID!) {
          deleteItinerary(id: $id)
        }
      `;

      beforeEach(async () => {
        const userIdObj = new mongoose.Types.ObjectId(userId);
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
        const variables = { id: itineraryId };
        const res = await graphqlRequest(deleteMutation, variables, authToken);

        expect(res.statusCode).toBe(200);
        expect(res.body.data).toBeDefined();
        expect(res.body.data.deleteItinerary).toBe(true);

        // Verify it's deleted
        const itinerary = await Itinerary.findById(itineraryId);
        expect(itinerary).toBeNull();
      });

      it('should require authentication', async () => {
        const variables = { id: itineraryId };
        const res = await graphqlRequest(deleteMutation, variables);

        // GraphQL may return 200 or 500 for errors
        expect([200, 500]).toContain(res.statusCode);
        expect(res.body.errors).toBeDefined();
        expect(res.body.errors[0].message).toContain('Authentication required');
      });
    });

    describe('generateShareableLink', () => {
      const shareMutation = `
        mutation GenerateShareableLink($id: ID!) {
          generateShareableLink(id: $id)
        }
      `;

      beforeEach(async () => {
        const userIdObj = new mongoose.Types.ObjectId(userId);
        const itinerary = await Itinerary.create({
          userId: userIdObj,
          title: 'Paris Trip',
          destination: 'Paris',
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-06-05')
        });
        itineraryId = itinerary._id.toString();
      });

      it('should generate shareable link', async () => {
        const variables = { id: itineraryId };
        const res = await graphqlRequest(shareMutation, variables, authToken);

        expect(res.statusCode).toBe(200);
        expect(res.body.data).toBeDefined();
        expect(res.body.data.generateShareableLink).toContain('/api/itineraries/share/');
      });

      it('should require authentication', async () => {
        const variables = { id: itineraryId };
        const res = await graphqlRequest(shareMutation, variables);

        // GraphQL may return 200 or 500 for errors
        expect([200, 500]).toContain(res.statusCode);
        expect(res.body.errors).toBeDefined();
        expect(res.body.errors[0].message).toContain('Authentication required');
      });
    });
  });

  describe('Shared Itinerary Query', () => {
    let shareableId;

    beforeEach(async () => {
      // Register user and create itinerary
      const registerRes = await graphqlRequest(`
        mutation {
          register(input: {
            email: "test@example.com",
            password: "password123",
            name: "Test User"
          }) {
            token
            user {
              _id
            }
          }
        }
      `);

      authToken = registerRes.body.data.register.token;
      userId = registerRes.body.data.register.user._id;

      // Create itinerary with shareableId
      const userIdObj = new mongoose.Types.ObjectId(userId);
      const itinerary = await Itinerary.create({
        userId: userIdObj,
        title: 'Paris Trip',
        destination: 'Paris',
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-05'),
        shareableId: 'test-shareable-id-123'
      });
      shareableId = itinerary.shareableId;
    });

    it('should get shared itinerary without authentication', async () => {
      const query = `
        query GetSharedItinerary($shareableId: String!) {
          sharedItinerary(shareableId: $shareableId) {
            _id
            title
            destination
            startDate
            endDate
          }
        }
      `;

      const variables = { shareableId };
      const res = await graphqlRequest(query, variables);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.sharedItinerary.title).toBe('Paris Trip');
      expect(res.body.data.sharedItinerary.destination).toBe('Paris');
    });

    it('should return error for invalid shareableId', async () => {
      const query = `
        query GetSharedItinerary($shareableId: String!) {
          sharedItinerary(shareableId: $shareableId) {
            _id
            title
          }
        }
      `;

      const variables = { shareableId: 'invalid-id' };
      const res = await graphqlRequest(query, variables);

      expect(res.statusCode).toBe(200);
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].message).toContain('not found');
    });
  });
});

