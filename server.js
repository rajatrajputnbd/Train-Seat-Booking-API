const express = require('express');
const cors = require('cors');
require('dotenv').config();
const bodyParser = require('body-parser');
const routes = require('./routes'); // Import routes

const app = express();

// Middleware setup
app.use(bodyParser.json());
app.use(cors({ origin: 'http://localhost:3000' }));  // Enable CORS for React app

// Use routes
// app.use(routes);
app.use('/api', routes); // Prefix routes with '/api' for cleaner paths

// Start the server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
