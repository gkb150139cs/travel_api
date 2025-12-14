const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    let user = await User.findById(decoded.userId);
    
    // In test environment, retry user lookup (handles timing issues with Docker)
    if (!user && process.env.NODE_ENV === 'test') {
      // Retry up to 3 times with small delays
      for (let i = 0; i < 3 && !user; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        user = await User.findById(decoded.userId);
      }
    }

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = user;
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

module.exports = authenticate;

