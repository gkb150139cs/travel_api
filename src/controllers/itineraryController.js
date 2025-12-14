const Itinerary = require('../models/Itinerary');
const User = require('../models/User');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { getCache, setCache, deleteCache } = require('../utils/cache');
const { sendItineraryCreatedEmail } = require('../utils/email');

const createItinerary = async (req, res) => {
  try {
    const { title, destination, startDate, endDate, activities } = req.body;

    const itinerary = new Itinerary({
      userId: req.userId,
      title,
      destination,
      startDate,
      endDate,
      activities: activities || []
    });

    await itinerary.save();

    // Send email notification (non-blocking - don't fail if email fails)
    try {
      const user = await User.findById(req.userId);
      if (user) {
        sendItineraryCreatedEmail(user.email, user.name, itinerary).catch(err => {
          console.error('Failed to send email notification:', err.message);
        });
      }
    } catch (emailError) {
      console.error('Error getting user for email notification:', emailError.message);
    }

    res.status(201).json({
      message: 'Itinerary created successfully',
      itinerary
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: Object.values(error.errors)[0].message });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getItineraries = async (req, res) => {
  try {
    const { destination, page = 1, limit = 10, sort = 'createdAt' } = req.query;
    const userId = req.userId;

    // Build query
    const query = { userId };
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

    res.json({
      itineraries,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getItineraryById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid itinerary ID format' });
    }
    
    const cacheKey = `itinerary:${id}`;

    // Try to get from cache
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log("cached", JSON.stringify(cached));
      return res.json(cached);
    }

    const itinerary = await Itinerary.findById(id);
    if (!itinerary) {
      return res.status(404).json({ message: 'Itinerary not found' });
    }

    // Check if user owns the itinerary
    const itineraryUserId = itinerary.userId.toString();
    const requestUserId = req.userId.toString();
    if (itineraryUserId !== requestUserId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Cache the result (5 minutes)
    await setCache(cacheKey, itinerary, 300);

    res.json({ itinerary });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const updateItinerary = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid itinerary ID format' });
    }
    
    const { title, destination, startDate, endDate, activities } = req.body;

    const itinerary = await Itinerary.findById(id);

    if (!itinerary) {
      return res.status(404).json({ message: 'Itinerary not found' });
    }

    // Check if user owns the itinerary
    const itineraryUserId = itinerary.userId.toString();
    const requestUserId = req.userId.toString();
    if (itineraryUserId !== requestUserId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update fields
    if (title) itinerary.title = title;
    if (destination) itinerary.destination = destination;
    if (startDate) itinerary.startDate = startDate;
    if (endDate) itinerary.endDate = endDate;
    if (activities) itinerary.activities = activities;

    await itinerary.save();

    // Invalidate cache
    await deleteCache(`itinerary:${id}`);

    res.json({
      message: 'Itinerary updated successfully',
      itinerary
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: Object.values(error.errors)[0].message });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const deleteItinerary = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid itinerary ID format' });
    }

    const itinerary = await Itinerary.findById(id);

    if (!itinerary) {
      return res.status(404).json({ message: 'Itinerary not found' });
    }

    // Check if user owns the itinerary
    const itineraryUserId = itinerary.userId.toString();
    const requestUserId = req.userId.toString();
    if (itineraryUserId !== requestUserId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await Itinerary.findByIdAndDelete(id);

    // Invalidate cache
    await deleteCache(`itinerary:${id}`);

    res.json({ message: 'Itinerary deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const generateShareableLink = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid itinerary ID format' });
    }

    const itinerary = await Itinerary.findById(id);

    if (!itinerary) {
      return res.status(404).json({ message: 'Itinerary not found' });
    }

    // Check if user owns the itinerary
    const itineraryUserId = itinerary.userId.toString();
    const requestUserId = req.userId.toString();
    if (itineraryUserId !== requestUserId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Generate shareable ID if not exists
    if (!itinerary.shareableId) {
      itinerary.shareableId = uuidv4();
      await itinerary.save();
    }

    const shareableUrl = `${req.protocol}://${req.get('host')}/api/itineraries/share/${itinerary.shareableId}`;

    res.json({
      message: 'Shareable link generated',
      shareableUrl,
      shareableId: itinerary.shareableId
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getSharedItinerary = async (req, res) => {
  try {
    const { shareableId } = req.params;

    const itinerary = await Itinerary.findOne({ shareableId });

    if (!itinerary) {
      return res.status(404).json({ message: 'Shared itinerary not found' });
    }

    // Return itinerary without sensitive data
    const sharedItinerary = {
      _id: itinerary._id,
      title: itinerary.title,
      destination: itinerary.destination,
      startDate: itinerary.startDate,
      endDate: itinerary.endDate,
      activities: itinerary.activities,
      createdAt: itinerary.createdAt,
      updatedAt: itinerary.updatedAt
    };

    res.json({ itinerary: sharedItinerary });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  createItinerary,
  getItineraries,
  getItineraryById,
  updateItinerary,
  deleteItinerary,
  generateShareableLink,
  getSharedItinerary
};

