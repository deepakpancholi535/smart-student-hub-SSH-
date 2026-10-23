import { config } from './config/env.js';
import { connectDatabase } from './config/database.js';
import app from './app.js';

try {
  await connectDatabase(config.mongoUri);
  app.listen(config.port, () => {
    console.log(`Smart Student Hub API listening on port ${config.port}`);
  });
} catch (error) {
  console.error('Unable to start Smart Student Hub API:', error.message);
  process.exitCode = 1;
}
