// import app from './app.js';
// import dotenv from 'dotenv';
// dotenv.config();


// const PORT = process.env.PORT;

// // Start Server
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });




import dns from 'dns';
import dotenv from 'dotenv';

dotenv.config();

// Fix MongoDB Atlas SRV DNS resolution
dns.setServers(['8.8.8.8', '8.8.4.4']);

// Import app AFTER DNS configuration
const {default : app} = await import('./app.js');
// import app from './app.js';

const PORT = process.env.PORT || 5000;

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
