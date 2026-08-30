const dns = require('dns');

if (!process.env.VERCEL) {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch (e) {
    // Ignore DNS override errors in restricted environments
  }
}

const mongoose = require('mongoose');

let isConnected = false;

async function connectDB() {
  if (isConnected || mongoose.connection.readyState === 1) {
    return;
  }

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/trackathlete';

  try {
    console.log('Connecting to MongoDB Atlas cluster...');

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000
    });

    isConnected = true;
    console.log('MongoDB Atlas connected successfully!');
  } catch (err) {
    console.error('MongoDB Atlas connection error:', err.message);
    throw err;
  }
}

module.exports = connectDB;