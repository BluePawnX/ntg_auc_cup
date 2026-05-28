import mongoose from 'mongoose';

/**
 * Connects to MongoDB. Exits the process on failure - if the database is
 * unreachable the platform cannot run, so failing loud and early is correct.
 */
export async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('[db] MONGO_URI is not set. Copy .env.example to .env first.');
    process.exit(1);
  }
  try {
    await mongoose.connect(uri);
    console.log('[db] connected to MongoDB');
  } catch (err) {
    console.error('[db] connection failed:', err.message);
    process.exit(1);
  }
}
