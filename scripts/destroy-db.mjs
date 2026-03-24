import mongoose from 'mongoose';

// No need for dotenv if we run with node --env-file=.env.local
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Error: MONGODB_URI is not defined.');
  console.log('Please run with: node --env-file=.env.local scripts/destroy-db.mjs');
  process.exit(1);
}

async function clearDB() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected.');

    const collections = ['users', 'messages', 'userlocations'];
    
    for (const colName of collections) {
      console.log(`Clearing collection: ${colName}...`);
      try {
        await mongoose.connection.collection(colName).deleteMany({});
        console.log(`Successfully cleared ${colName}.`);
      } catch (err) {
        if (err.code === 26) {
          console.log(`Collection ${colName} does not exist, skipping.`);
        } else {
          console.error(`Error clearing ${colName}:`, err.message);
        }
      }
    }

    console.log('\nDatabase cleanup complete.');
    process.exit(0);
  } catch (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }
}

clearDB();
