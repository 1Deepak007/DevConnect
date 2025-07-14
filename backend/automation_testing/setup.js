// test environment variables here.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'your_test_jwt_secret'; // Use a strong, unique secret for tests
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/devconnect_test'; // Example, will be overridden by in-memory
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'; // Ensure Redis is available for tests

// You might also want to explicitly set NODE_ENV to 'test' here
process.env.NODE_ENV = 'test';