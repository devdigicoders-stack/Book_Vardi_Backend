import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';

// 2. Helper to resolve modules safely
const require = createRequire(import.meta.url);
const requireBackend = (moduleName) => {
  try {
    return require(moduleName);
  } catch (err) {
    const resolvedPath = path.join(process.cwd(), 'node_modules', moduleName);
    return require(resolvedPath);
  }
};

const { MongoClient } = requireBackend('mongodb');
const dotenv = requireBackend('dotenv');

// 3. Load environment variables
const envPath = fs.existsSync(path.join(process.cwd(), '.env'))
  ? path.join(process.cwd(), '.env')
  : path.join(process.cwd(), 'Book_Vardi_Backend', '.env');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

// 4. Configuration parameters
const LOCAL_URI = process.env.LOCAL_MONGODB_URI || 'mongodb://127.0.0.1:27017/bookvardi_db_final';
const LOCAL_DB_NAME = process.env.LOCAL_DB_NAME || 'bookvardi_db_final';

// Support Atlas connection link via CLI arg, .env, or default fallback
const argAtlasUri = process.argv[2];
const envAtlasUri = process.env.ATLAS_URI || process.env.MONGODB_ATLAS_URI || 
  (process.env.MONGODB_URI && process.env.MONGODB_URI.includes('mongodb+srv') ? process.env.MONGODB_URI : null);
const DEFAULT_ATLAS_URI = 'mongodb+srv://gauravguptacse22:kI1L4K98uV5wO3ZJ@cluster0.1nslq.mongodb.net/schoolkart_db?retryWrites=true&w=majority&appName=Cluster0';

const TARGET_ATLAS_URI = argAtlasUri || envAtlasUri || DEFAULT_ATLAS_URI;
const TARGET_DB_NAME = process.argv[3] || process.env.TARGET_DB_NAME || 'bookvardi_db_final';

console.log('====================================================');
console.log('🚀 MONGO DB CLONING SCRIPT: Localhost -> MongoDB Atlas');
console.log('====================================================');
console.log(`📍 Source (Local) : ${LOCAL_URI}`);
console.log(`☁️  Target (Atlas) : ${TARGET_ATLAS_URI.replace(/:([^@]+)@/, ':****@')}`);
console.log(`📁 Target DB Name : ${TARGET_DB_NAME}`);
console.log('====================================================\n');

async function cloneDatabase() {
  let localClient;
  let atlasClient;

  try {
    // Connect to Localhost MongoDB
    console.log('🔌 Connecting to Localhost MongoDB...');
    localClient = new MongoClient(LOCAL_URI, { connectTimeoutMS: 10000 });
    await localClient.connect();
    const localDb = localClient.db();
    console.log(`✅ Connected to Local MongoDB [${localDb.databaseName}] successfully.`);

    // Connect to MongoDB Atlas
    console.log('🔌 Connecting to MongoDB Atlas...');
    atlasClient = new MongoClient(TARGET_ATLAS_URI, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000
    });
    await atlasClient.connect();
    const atlasDb = TARGET_DB_NAME ? atlasClient.db(TARGET_DB_NAME) : atlasClient.db();
    console.log(`✅ Connected to MongoDB Atlas DB [${atlasDb.databaseName}] successfully.`);

    // Fetch all collections from local DB
    const collections = await localDb.listCollections().toArray();
    console.log(`\n📦 Found ${collections.length} collection(s) in Local DB.\n`);

    if (collections.length === 0) {
      console.warn('⚠️ No collections found in local database to clone.');
      return;
    }

    let totalDocsCloned = 0;

    for (const colInfo of collections) {
      const colName = colInfo.name;
      // Skip system collections
      if (colName.startsWith('system.')) continue;

      console.log(`🔄 Processing collection: [${colName}]...`);

      const localCol = localDb.collection(colName);
      const atlasCol = atlasDb.collection(colName);

      // Fetch all documents from local collection
      const docs = await localCol.find({}).toArray();
      const count = docs.length;

      if (count === 0) {
        console.log(`   └─ ⚪ Empty collection. Skipping document insertion.`);
      } else {
        // Drop existing target collection to ensure clean clone
        try {
          await atlasCol.drop();
          console.log(`   └─ 🗑️ Cleared existing collection on Atlas.`);
        } catch (err) {
          // Collection didn't exist yet on Atlas, safe to ignore
        }

        // Insert documents in batches of 500
        const BATCH_SIZE = 500;
        for (let i = 0; i < docs.length; i += BATCH_SIZE) {
          const batch = docs.slice(i, i + BATCH_SIZE);
          await atlasCol.insertMany(batch);
        }
        console.log(`   └─ ✅ Inserted ${count} document(s) into Atlas.`);
        totalDocsCloned += count;
      }

      // Recreate custom indexes (excluding default _id_ index)
      try {
        const indexes = await localCol.indexes();
        const customIndexes = indexes.filter(idx => idx.name !== '_id_');
        if (customIndexes.length > 0) {
          const indexSpecs = customIndexes.map(idx => {
            const { key, name, v, ns, ...options } = idx;
            return { key, name, ...options };
          });
          await atlasCol.createIndexes(indexSpecs);
          console.log(`   └─ 🔑 Recreated ${customIndexes.length} custom index(es).`);
        }
      } catch (idxErr) {
        console.warn(`   └─ ⚠️ Index cloning note for [${colName}]: ${idxErr.message}`);
      }
    }

    console.log('\n====================================================');
    console.log(`🎉 CLONING COMPLETE! Total Documents Cloned: ${totalDocsCloned}`);
    console.log('====================================================\n');
  } catch (error) {
    console.error('\n❌ Error cloning database:', error.message);
  } finally {
    if (localClient) await localClient.close();
    if (atlasClient) await atlasClient.close();
    console.log('🔌 Closed MongoDB connections.');
  }
}

cloneDatabase();
