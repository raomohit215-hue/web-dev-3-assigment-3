require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectDB();
    const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

    const shutdown = async () => {
      server.close(async () => {
        await mongoose.connection.close();
        process.exit(0);
      });
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    console.error('Startup failed:', err.message);
    process.exit(1);
  }
})();
