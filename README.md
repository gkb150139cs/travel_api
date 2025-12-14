# TMTC Travel Itinerary API

A RESTful and GraphQL API for managing travel itineraries with authentication, caching, and comprehensive documentation.

## Features

- 🔐 **User Authentication** - JWT-based authentication with password hashing
- 📝 **Itinerary Management** - Create, read, update, and delete travel itineraries
- 🔍 **Search & Filter** - Filter itineraries by destination with pagination and sorting
- 🔗 **Shareable Links** - Generate shareable links for itineraries
- 📧 **Email Notifications** - Automatic email notifications when itineraries are created
- ⚡ **Performance Optimizations** - Redis caching and database indexing
- 🛡️ **Rate Limiting** - Protection against abuse
- 📚 **API Documentation** - Interactive Swagger/OpenAPI documentation
- 🚀 **GraphQL API** - Alternative GraphQL endpoint with GraphiQL interface
- 🐳 **Docker Support** - Easy deployment with Docker Compose
- 🧪 **Testing** - Comprehensive test coverage with Jest

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Cache**: Redis
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcryptjs
- **API Style**: REST & GraphQL
- **Documentation**: Swagger/OpenAPI
- **GraphQL**: express-graphql with GraphiQL
- **Testing**: Jest, Supertest

## Prerequisites

- Node.js (v18 or higher)
- MongoDB (or use Docker)
- Redis (or use Docker)
- npm or yarn

## Installation

### Option 1: Local Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd TMTC
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/tmtc
   REDIS_URL=redis://localhost:6379
   JWT_SECRET=your-secret-key-change-in-production
   NODE_ENV=development
   
   # Optional: Email notifications (set EMAIL_ENABLED=true to enable)
   EMAIL_ENABLED=false
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   ```

4. **Start MongoDB and Redis**
   
   Make sure MongoDB and Redis are running on your system:
   ```bash
   # MongoDB
   sudo systemctl start mongod  # Linux
   # or
   mongod  # macOS/Windows
   
   # Redis
   redis-server
   ```

5. **Run the application**
   ```bash
   # Development mode (with auto-reload)
   npm run dev
   
   # Production mode
   npm start
   ```

### Option 2: Docker Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd TMTC
   ```

2. **Set up environment variables**
   
   Create a `.env` file (optional, defaults are provided in docker-compose.yml):
   ```env
   JWT_SECRET=your-secret-key-change-in-production
   ```

3. **Start all services with Docker Compose**
   ```bash
   docker compose up -d
   ```

   This will start:
   - API server on port `5001` (or `5000` if available)
   - MongoDB on port `27019` (or `27017` if available)
   - Redis on port `6381` (or `6379` if available)

4. **View logs**
   ```bash
   docker compose logs -f
   ```

5. **Stop services**
   ```bash
   docker compose down
   ```

## How to Run

### Development Mode

```bash
npm run dev
```

The server will start on `http://localhost:5000` (or the port specified in your `.env` file).

### Production Mode

```bash
npm start
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

## API Documentation

### REST API Documentation

Once the server is running, you can access the interactive REST API documentation at:

**Swagger UI**: `http://localhost:5000/api-docs`

The documentation includes:
- All available endpoints
- Request/response schemas
- Authentication requirements
- Try-it-out functionality

### GraphQL API

The API also provides a GraphQL endpoint as an alternative to REST. GraphQL allows you to:
- Request only the data you need
- Get multiple resources in a single request
- Use a type system to explore the API

**GraphQL Endpoint**: `http://localhost:5000/graphql`

**GraphiQL Interface** (Development only): `http://localhost:5000/graphql`

The GraphiQL interface provides an interactive playground where you can:
- Explore the schema
- Test queries and mutations
- View documentation
- See query results in real-time

### REST API Endpoints

#### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user

#### Itineraries (Protected Routes)
- `GET /api/itineraries` - Get all itineraries (with pagination, filtering, sorting)
- `POST /api/itineraries` - Create a new itinerary
- `GET /api/itineraries/:id` - Get itinerary by ID
- `PUT /api/itineraries/:id` - Update itinerary
- `DELETE /api/itineraries/:id` - Delete itinerary
- `POST /api/itineraries/:id/share` - Generate shareable link

#### Public Routes
- `GET /api/itineraries/share/:shareableId` - Get shared itinerary (public)
- `GET /api/health` - Health check endpoint

### GraphQL API

The GraphQL API provides the same functionality as the REST API with a more flexible query interface.

#### GraphQL Queries

**Get All Itineraries**
```graphql
query {
  itineraries(page: 1, limit: 10, sort: "-createdAt") {
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
```

**Get Single Itinerary**
```graphql
query {
  itinerary(id: "itinerary_id_here") {
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
```

**Get Shared Itinerary (Public)**
```graphql
query {
  sharedItinerary(shareableId: "shareable_id_here") {
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
```

**Get Current User**
```graphql
query {
  me {
    _id
    email
    name
  }
}
```

#### GraphQL Mutations

**Register User**
```graphql
mutation {
  register(input: {
    email: "user@example.com"
    password: "password123"
    name: "John Doe"
  }) {
    token
    user {
      _id
      email
      name
    }
  }
}
```

**Login**
```graphql
mutation {
  login(input: {
    email: "user@example.com"
    password: "password123"
  }) {
    token
    user {
      _id
      email
      name
    }
  }
}
```

**Create Itinerary**
```graphql
mutation {
  createItinerary(input: {
    title: "Summer Vacation"
    destination: "Paris"
    startDate: "2024-06-01"
    endDate: "2024-06-10"
    activities: [
      {
        time: "10:00"
        description: "Visit Eiffel Tower"
        location: "Paris, France"
      }
    ]
  }) {
    _id
    title
    destination
    startDate
    endDate
  }
}
```

**Update Itinerary**
```graphql
mutation {
  updateItinerary(
    id: "itinerary_id_here"
    input: {
      title: "Updated Title"
      destination: "London"
    }
  ) {
    _id
    title
    destination
  }
}
```

**Delete Itinerary**
```graphql
mutation {
  deleteItinerary(id: "itinerary_id_here")
}
```

**Generate Shareable Link**
```graphql
mutation {
  generateShareableLink(id: "itinerary_id_here")
}
```

#### GraphQL Authentication

For protected queries and mutations, include the JWT token in the request headers:

```json
{
  "Authorization": "Bearer <your-jwt-token>"
}
```

When using GraphiQL, you can set headers in the "Query Variables" panel or use the "HTTP Headers" section at the bottom.

### Authentication

Most endpoints require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/tmtc` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `JWT_SECRET` | Secret key for JWT tokens | `your-secret-key-change-in-production` |
| `NODE_ENV` | Environment (development/production/test) | `development` |
| `EMAIL_ENABLED` | Enable email notifications | `false` |
| `SMTP_HOST` | SMTP server host | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_SECURE` | Use secure connection (SSL/TLS) | `false` |
| `SMTP_USER` | SMTP username/email | - |
| `SMTP_PASS` | SMTP password/app password | - |
| `EMAIL_FROM_NAME` | Sender name in emails | `TMTC Travel` |

### Email Configuration

Email notifications are sent when a new itinerary is created. To enable email notifications:

1. Set `EMAIL_ENABLED=true` in your `.env` file
2. Configure SMTP settings:
   ```env
   EMAIL_ENABLED=true
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   EMAIL_FROM_NAME=TMTC Travel
   ```

**For Gmail:**
- Use an [App Password](https://support.google.com/accounts/answer/185833) instead of your regular password
- Enable "Less secure app access" or use 2FA with App Password

**For other email providers:**
- Update `SMTP_HOST` and `SMTP_PORT` accordingly
- Set `SMTP_SECURE=true` for port 465 (SSL)

## Project Structure

```
TMTC/
├── config/
│   └── db.js                 # Database connection
├── src/
│   ├── controllers/          # Route controllers
│   │   ├── authController.js
│   │   └── itineraryController.js
│   ├── models/               # Mongoose models
│   │   ├── User.js
│   │   └── Itinerary.js
│   ├── routes/               # Express routes
│   │   ├── auth.js
│   │   └── itineraries.js
│   ├── graphql/              # GraphQL implementation
│   │   ├── schema.js         # GraphQL schema definition
│   │   ├── resolvers.js      # GraphQL resolvers
│   │   └── graphqlMiddleware.js  # GraphQL middleware
│   ├── utils/                # Utility functions
│   │   ├── auth.js           # JWT authentication middleware
│   │   ├── cache.js          # Redis caching utilities
│   │   └── errorHandler.js   # Error handling middleware
│   └── app.js                # Express app configuration
├── tests/                     # Test files
│   ├── auth.test.js
│   └── itinerary.test.js
├── docker-compose.yml         # Docker Compose configuration
├── Dockerfile                 # Docker image configuration
├── package.json
├── server.js                  # Application entry point
└── README.md
```

## Performance Optimizations

- **Database Indexing**: Indexes on `userId`, `destination`, and `startDate` for faster queries
- **Redis Caching**: Caching of frequently accessed data with configurable TTL
- **Query Optimization**: Pagination, filtering, and sorting support
- **Rate Limiting**: 100 requests per 15 minutes per IP address

## Testing

The project includes comprehensive tests using Jest and Supertest:

```bash
# Run tests with coverage
npm test

# Run tests in watch mode
npm run test:watch
```

## API Usage Examples

### REST API Examples

#### Register a User

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "name": "John Doe"
  }'
```

#### Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

#### Create Itinerary

```bash
curl -X POST http://localhost:5000/api/itineraries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '{
    "title": "Summer Vacation",
    "destination": "Paris",
    "startDate": "2024-06-01",
    "endDate": "2024-06-10",
    "activities": [
      {
        "time": "10:00",
        "description": "Visit Eiffel Tower",
        "location": "Paris, France"
      }
    ]
  }'
```

#### Get Itineraries with Pagination

```bash
curl -X GET "http://localhost:5000/api/itineraries?page=1&limit=10&sort=-createdAt" \
  -H "Authorization: Bearer <your-token>"
```

### GraphQL API Examples

#### Using GraphiQL

1. Navigate to `http://localhost:5000/graphql` in your browser
2. Use the interactive interface to write and test queries
3. Set headers in the bottom panel for authentication:
   ```json
   {
     "Authorization": "Bearer <your-jwt-token>"
   }
   ```

#### Using cURL

**Query Example:**
```bash
curl -X POST http://localhost:5000/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '{
    "query": "query { itineraries(page: 1, limit: 10) { itineraries { _id title destination } total } }"
  }'
```

**Mutation Example:**
```bash
curl -X POST http://localhost:5000/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '{
    "query": "mutation { createItinerary(input: { title: \"Paris Trip\" destination: \"Paris\" startDate: \"2024-06-01\" endDate: \"2024-06-10\" }) { _id title destination } }"
  }'
```

#### Using JavaScript/Fetch

```javascript
const query = `
  query {
    itineraries(page: 1, limit: 10) {
      itineraries {
        _id
        title
        destination
        startDate
        endDate
      }
      total
    }
  }
`;

fetch('http://localhost:5000/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ query })
})
  .then(res => res.json())
  .then(data => console.log(data));
```

## Troubleshooting

### MongoDB Connection Issues

- Ensure MongoDB is running: `sudo systemctl status mongod`
- Check connection string in `.env` file
- Verify MongoDB is accessible on the specified port

### Redis Connection Issues

- Ensure Redis is running: `redis-cli ping`
- Check Redis URL in `.env` file
- The app will fall back to in-memory cache if Redis is unavailable

### Port Already in Use

If you get a "port already in use" error:
- Change the `PORT` in `.env` file
- Or stop the service using that port
- For Docker, ports are automatically adjusted if conflicts occur

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Running Tests in Docker

There are several ways to run tests when using Docker:

### Option 1: Run tests in the running container

```bash
# Execute tests in the running API container
docker compose exec api npm test

# Run specific test file
docker compose exec api npm test -- tests/auth.test.js

# Run tests in watch mode
docker compose exec api npm run test:watch
```

### Option 2: Use Docker Compose test profile

```bash
# Run all tests using the test profile
docker compose --profile test -f docker-compose.test.yml up --abort-on-container-exit

# Or use the convenience script
docker compose -f docker-compose.test.yml run --rm test
```

### Option 3: Run tests in a one-off container

```bash
# Run tests in a temporary container
docker compose run --rm api npm test

# With test environment variables
docker compose run --rm -e NODE_ENV=test api npm test
```

### Option 4: Run tests during build (CI/CD)

Add to your CI/CD pipeline:
```bash
docker compose build test
docker compose -f docker-compose.test.yml up --abort-on-container-exit
```

### Test Environment Variables

When running tests in Docker, ensure these environment variables are set:
- `NODE_ENV=test`
- `MONGODB_URI_TEST` or `MONGODB_URI` pointing to test database
- `JWT_SECRET` (can use test value)
- `EMAIL_ENABLED=false` (to skip email in tests)

### Running Tests Against Docker Containers

To run tests against the running Docker containers (MongoDB and Redis):

```bash
# Option 1: Use the convenience script
npm run test:containers

# Option 2: Set environment variables manually
USE_DOCKER=true MONGODB_URI_TEST=mongodb://localhost:27019/tmtc-test npm test

# Option 3: Use Docker Compose test profile (isolated test containers)
npm run test:compose
```

**Configuration:**
- Tests automatically detect Docker containers when `USE_DOCKER=true`
- MongoDB test endpoint: `localhost:27019` (Docker port mapping)
- Redis test endpoint: `localhost:6381` (Docker port mapping)
- Test database: `tmtc-test` (separate from production)

## Support

For issues and questions, please open an issue in the repository.

