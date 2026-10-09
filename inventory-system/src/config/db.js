const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is not defined in environment variables');
  await mongoose.connect(uri);
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
};

module.exports = connectDB;
