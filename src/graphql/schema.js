const { buildSchema } = require('graphql');

const schema = buildSchema(`
  type Activity {
    time: String!
    description: String!
    location: String!
  }

  type Itinerary {
    _id: ID!
    userId: ID!
    title: String!
    destination: String!
    startDate: String!
    endDate: String!
    activities: [Activity!]!
    shareableId: String
    createdAt: String!
    updatedAt: String!
  }

  type User {
    _id: ID!
    email: String!
    name: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type ItineraryConnection {
    itineraries: [Itinerary!]!
    total: Int!
    page: Int!
    pages: Int!
  }

  input ActivityInput {
    time: String!
    description: String!
    location: String!
  }

  input CreateItineraryInput {
    title: String!
    destination: String!
    startDate: String!
    endDate: String!
    activities: [ActivityInput!]
  }

  input UpdateItineraryInput {
    title: String
    destination: String
    startDate: String
    endDate: String
    activities: [ActivityInput!]
  }

  input RegisterInput {
    email: String!
    password: String!
    name: String!
  }

  input LoginInput {
    email: String!
    password: String!
  }

  type Query {
    # Get all itineraries for the authenticated user
    itineraries(
      destination: String
      page: Int = 1
      limit: Int = 10
      sort: String = "createdAt"
    ): ItineraryConnection!

    # Get a single itinerary by ID
    itinerary(id: ID!): Itinerary

    # Get shared itinerary by shareableId (public)
    sharedItinerary(shareableId: String!): Itinerary

    # Get current user info
    me: User
  }

  type Mutation {
    # Authentication
    register(input: RegisterInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!

    # Itinerary mutations
    createItinerary(input: CreateItineraryInput!): Itinerary!
    updateItinerary(id: ID!, input: UpdateItineraryInput!): Itinerary!
    deleteItinerary(id: ID!): Boolean!
    generateShareableLink(id: ID!): String!
  }
`);

module.exports = schema;

