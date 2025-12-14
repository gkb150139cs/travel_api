const User = require('../models/User');
const Itinerary = require('../models/Itinerary');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const { sendItineraryCreatedEmail } = require('../utils/email');

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: '7d'
  });
};

// Helper to get user from request
const getUserFromRequest = (req) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return null;
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    return decoded.userId;
  } catch (error) {
    return null;
  }
};

const resolvers = {
  Query: {
    itineraries: async (args, context) => {
      const userId = getUserFromRequest(context.req);
      if (!userId) {
        throw new Error('Authentication required');
      }

      const { destination, page = 1, limit = 10, sort = 'createdAt' } = args;
      
      // Build query
      const query = { userId: new mongoose.Types.ObjectId(userId) };
      if (destination) {
        query.destination = new RegExp(destination, 'i');
      }

      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Build sort object
      const sortOrder = sort.startsWith('-') ? -1 : 1;
      const sortField = sort.replace(/^-/, '');
      const sortObj = { [sortField]: sortOrder };

      // Execute query
      const itineraries = await Itinerary.find(query)
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Itinerary.countDocuments(query);

      return {
        itineraries: itineraries.map(it => ({
          ...it.toObject(),
          _id: it._id.toString(),
          userId: it.userId.toString(),
          startDate: it.startDate.toISOString(),
          endDate: it.endDate.toISOString(),
          createdAt: it.createdAt.toISOString(),
          updatedAt: it.updatedAt.toISOString()
        })),
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      };
    },

    itinerary: async (args, context) => {
      const userId = getUserFromRequest(context.req);
      if (!userId) {
        throw new Error('Authentication required');
      }

      const { id } = args;
      
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid itinerary ID format');
      }

      const itinerary = await Itinerary.findById(id);
      if (!itinerary) {
        throw new Error('Itinerary not found');
      }

      // Check if user owns the itinerary
      if (itinerary.userId.toString() !== userId) {
        throw new Error('Access denied');
      }

      return {
        ...itinerary.toObject(),
        _id: itinerary._id.toString(),
        userId: itinerary.userId.toString(),
        startDate: itinerary.startDate.toISOString(),
        endDate: itinerary.endDate.toISOString(),
        createdAt: itinerary.createdAt.toISOString(),
        updatedAt: itinerary.updatedAt.toISOString()
      };
    },

    sharedItinerary: async (args) => {
      const { shareableId } = args;
      const itinerary = await Itinerary.findOne({ shareableId });

      if (!itinerary) {
        throw new Error('Shared itinerary not found');
      }

      return {
        ...itinerary.toObject(),
        _id: itinerary._id.toString(),
        userId: itinerary.userId.toString(),
        startDate: itinerary.startDate.toISOString(),
        endDate: itinerary.endDate.toISOString(),
        createdAt: itinerary.createdAt.toISOString(),
        updatedAt: itinerary.updatedAt.toISOString()
      };
    },

    me: async (args, context) => {
      const userId = getUserFromRequest(context.req);
      if (!userId) {
        throw new Error('Authentication required');
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      return {
        _id: user._id.toString(),
        email: user.email,
        name: user.name
      };
    }
  },

  Mutation: {
    register: async (args) => {
      const { input } = args;
      const { email, password, name } = input;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw new Error('User already exists with this email');
      }

      // Create new user
      const user = new User({ email, password, name });
      await user.save();

      // Generate token
      const token = generateToken(user._id);

      return {
        token,
        user: {
          _id: user._id.toString(),
          email: user.email,
          name: user.name
        }
      };
    },

    login: async (args) => {
      const { input } = args;
      const { email, password } = input;

      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      // Find user
      const user = await User.findOne({ email });
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Check password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        throw new Error('Invalid credentials');
      }

      // Generate token
      const token = generateToken(user._id);

      return {
        token,
        user: {
          _id: user._id.toString(),
          email: user.email,
          name: user.name
        }
      };
    },

    createItinerary: async (args, context) => {
      const userId = getUserFromRequest(context.req);
      if (!userId) {
        throw new Error('Authentication required');
      }

      const { input } = args;
      const { title, destination, startDate, endDate, activities } = input;

      const itinerary = new Itinerary({
        userId: new mongoose.Types.ObjectId(userId),
        title,
        destination,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        activities: activities || []
      });

      await itinerary.save();

      // Send email notification (non-blocking - don't fail if email fails)
      try {
        const user = await User.findById(userId);
        if (user) {
          sendItineraryCreatedEmail(user.email, user.name, itinerary).catch(err => {
            console.error('Failed to send email notification:', err.message);
          });
        }
      } catch (emailError) {
        console.error('Error getting user for email notification:', emailError.message);
      }

      return {
        ...itinerary.toObject(),
        _id: itinerary._id.toString(),
        userId: itinerary.userId.toString(),
        startDate: itinerary.startDate.toISOString(),
        endDate: itinerary.endDate.toISOString(),
        createdAt: itinerary.createdAt.toISOString(),
        updatedAt: itinerary.updatedAt.toISOString()
      };
    },

    updateItinerary: async (args, context) => {
      const userId = getUserFromRequest(context.req);
      if (!userId) {
        throw new Error('Authentication required');
      }

      const { id, input } = args;
      
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid itinerary ID format');
      }

      const itinerary = await Itinerary.findById(id);
      if (!itinerary) {
        throw new Error('Itinerary not found');
      }

      // Check if user owns the itinerary
      if (itinerary.userId.toString() !== userId) {
        throw new Error('Access denied');
      }

      // Update fields
      if (input.title !== undefined) itinerary.title = input.title;
      if (input.destination !== undefined) itinerary.destination = input.destination;
      if (input.startDate !== undefined) itinerary.startDate = new Date(input.startDate);
      if (input.endDate !== undefined) itinerary.endDate = new Date(input.endDate);
      if (input.activities !== undefined) itinerary.activities = input.activities;

      await itinerary.save();

      return {
        ...itinerary.toObject(),
        _id: itinerary._id.toString(),
        userId: itinerary.userId.toString(),
        startDate: itinerary.startDate.toISOString(),
        endDate: itinerary.endDate.toISOString(),
        createdAt: itinerary.createdAt.toISOString(),
        updatedAt: itinerary.updatedAt.toISOString()
      };
    },

    deleteItinerary: async (args, context) => {
      const userId = getUserFromRequest(context.req);
      if (!userId) {
        throw new Error('Authentication required');
      }

      const { id } = args;
      
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid itinerary ID format');
      }

      const itinerary = await Itinerary.findById(id);
      if (!itinerary) {
        throw new Error('Itinerary not found');
      }

      // Check if user owns the itinerary
      if (itinerary.userId.toString() !== userId) {
        throw new Error('Access denied');
      }

      await Itinerary.findByIdAndDelete(id);
      return true;
    },

    generateShareableLink: async (args, context) => {
      const userId = getUserFromRequest(context.req);
      if (!userId) {
        throw new Error('Authentication required');
      }

      const { id } = args;
      
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid itinerary ID format');
      }

      const itinerary = await Itinerary.findById(id);
      if (!itinerary) {
        throw new Error('Itinerary not found');
      }

      // Check if user owns the itinerary
      if (itinerary.userId.toString() !== userId) {
        throw new Error('Access denied');
      }

      // Generate shareable ID if not exists
      if (!itinerary.shareableId) {
        itinerary.shareableId = uuidv4();
        await itinerary.save();
      }

      // Return the shareable URL (Note: req object might not have full URL info in GraphQL)
      return `${process.env.BASE_URL || 'http://localhost:5000'}/api/itineraries/share/${itinerary.shareableId}`;
    }
  }
};

module.exports = resolvers;

