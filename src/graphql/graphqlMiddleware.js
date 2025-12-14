const { graphqlHTTP } = require('express-graphql');
const schema = require('./schema');
const resolvers = require('./resolvers');

// Create root resolver object
const root = {
  ...resolvers.Query,
  ...resolvers.Mutation
};

const graphqlMiddleware = graphqlHTTP((req, res) => {
  return {
    schema: schema,
    rootValue: root,
    graphiql: process.env.NODE_ENV !== 'production', // Enable GraphiQL in development
    context: { req }, // Pass request to context for authentication
    customFormatErrorFn: (err) => {
      // Don't expose internal errors in production
      if (process.env.NODE_ENV === 'production') {
        return {
          message: err.message || 'An error occurred',
          locations: err.locations,
          path: err.path
        };
      }
      return {
        message: err.message,
        locations: err.locations,
        path: err.path,
        stack: err.stack
      };
    }
  };
});

module.exports = graphqlMiddleware;

