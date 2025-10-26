

const mongoose = require('mongoose');
const { MONGO_URI } = require('./constants');

const connectDB = async () => {
  try {
    if (!MONGO_URI) {
      throw new Error('MONGO_URI is not defined. Please check your .env file.');
    }
    
    console.log('Connecting to MongoDB...');
    console.log('MongoDB URI:', MONGO_URI.replace(/\/\/.*@/, '//***:***@'));

    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000, 
      bufferCommands: false, 
      maxPoolSize: 10, 
      socketTimeoutMS: 45000, 
      family: 4 
    });
    
    console.log('MongoDB connected successfully');
    console.log('Database name:', mongoose.connection.db.databaseName);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code
    });
    throw error; 
  }
};

module.exports = connectDB;
