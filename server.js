import dns from 'dns';
import dotenv from 'dotenv';

dotenv.config();

// Fix MongoDB Atlas SRV DNS resolution
dns.setServers(['8.8.8.8', '8.8.4.4']);

// Import app AFTER DNS configuration
const { default: app } = await import('./app.js');

const PORT = process.env.PORT || 5000;

// Start Server with Graceful Error Handling
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `⚠️ Port ${PORT} is currently occupied by another process. Please stop existing background server processes.`
    );
  } else {
    console.error('Server error:', error);
  }
});