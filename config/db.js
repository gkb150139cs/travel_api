const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // In test environment, skip connection if already connected (tests connect before importing app)
    if (process.env.NODE_ENV === 'test') {
      if (mongoose.connection.readyState === 1) {
        return true;
      }
      // Use MONGODB_URI_TEST if available
      const mongoURI = process.env.MONGODB_URI_TEST || process.env.MONGODB_URI || 'mongodb://localhost:27017/tmtc-test';
      const conn = await mongoose.connect(mongoURI, {
        serverSelectionTimeoutMS: 5000,
      });
      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
      return true;
    }
    
    // Production/development connection
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tmtc';
    
    // Skip connection if already connected
    if (mongoose.connection.readyState === 1) {
      return true;
    }
    
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    // In test environment, don't log errors if already connected
    if (process.env.NODE_ENV === 'test' && mongoose.connection.readyState === 1) {
      return true;
    }
    console.error('❌ Database connection error:', error.message);
    console.log('⚠️  Server will continue to run, but database operations will fail.');
    console.log('💡 To fix: Make sure MongoDB is running on', process.env.MONGODB_URI || 'mongodb://localhost:27017');
    console.log('💡 Start MongoDB with: sudo systemctl start mongod (Linux) or mongod (macOS/Windows)');
    console.log('💡 Or use Docker: docker run -d -p 27017:27017 --name mongodb mongo:7');
    return false;
  }
};

module.exports = connectDB;

