/**
 * Geek World Backend Server
 * WebSocket server for real-time geek data
 */
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

// Create Express app
const app = express();
app.use(express.json());
app.use(cors());

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server
const wss = new WebSocket.Server({ server });

// Set to store active WebSocket connections
const clients = new Set();

// Configuration
const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;

// Initialize database connection
let db;

// Connect to database
async function connectToDatabase() {
  try {
    db = new Pool({
      connectionString: DATABASE_URL,
    });
    
    // Test the connection
    const result = await db.query('SELECT NOW()');
    console.log('Connected to database:', result.rows[0].now);
    
    return true;
  } catch (error) {
    console.error('Error connecting to database:', error);
    return false;
  }
}

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, '../../')));

// API routes
app.get('/api/stats', async (req, res) => {
  try {
    // Get total number of users from database
    const totalResult = await db.query('SELECT COUNT(*) FROM geeks');
    const totalUsers = parseInt(totalResult.rows[0].count);
    
    // Get online users (users created in the last 5 minutes)
    const onlineTimeThreshold = new Date();
    onlineTimeThreshold.setMinutes(onlineTimeThreshold.getMinutes() - 5); // Consider users from last 5 minutes as "online"
    
    const onlineUsersResult = await db.query(
      'SELECT id FROM geeks WHERE created_at > $1 ORDER BY created_at DESC',
      [onlineTimeThreshold]
    );
    
    const onlineUserIds = onlineUsersResult.rows.map(user => user.id);
    const totalOnlineUsers = onlineUserIds.length;
    
    // Calculate day-night cycle
    // Use a fixed start time (server start time) to ensure consistency across clients
    const DAY_DURATION = 30 * 60 * 1000; // 30 minutes for a full day-night cycle
    const START_TIME = global.SERVER_START_TIME || (global.SERVER_START_TIME = Date.now());
    const elapsedTime = Date.now() - START_TIME;
    const currentTimeOfDay = (elapsedTime / DAY_DURATION) % 1; // Value between 0 and 1
    
    res.json({
      totalUsers,
      totalOnlineUsers,
      onlineUserIds,
      // Add day-night cycle information
      day_night_cycle: {
        duration: DAY_DURATION,
        current: currentTimeOfDay
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to add a random user
app.post('/api/users/random', async (req, res) => {
  try {
    // Generate random position on the planet surface
    const position = generateRandomPosition();
    
    // Generate random size between 15-40
    const size = Math.floor(Math.random() * 25) + 15;
    
    // Select random color from the list
    const colors = [
        '#4285F4', // Blue
        '#EA4335', // Red
        '#FBBC05', // Yellow
        '#34A853', // Green
        '#9C27B0', // Purple
        '#FF9800'  // Orange
    ];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    // Create new user in database
    const result = await db.query(
        'INSERT INTO geeks (position_x, position_y, position_z, size, color, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *',
        [position.x, position.y, position.z, size, color]
    );
    
    const newUser = result.rows[0];
    console.log('Added random user:', newUser);
    
    // Broadcast to all clients
    broadcastUserAdded(newUser);
    
    // Return success response
    res.json({
        success: true,
        user: newUser
    });
  } catch (error) {
    console.error('Error adding random user:', error);
    res.status(500).json({
        success: false,
        error: 'Failed to add random user'
    });
  }
});

// API endpoint to add a custom user
app.post('/api/users', async (req, res) => {
  try {
    const { position_x, position_y, position_z, size, color } = req.body;
    
    // Validate input
    if (!position_x || !position_y || !position_z || !size || !color) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    // Create new user in database
    const result = await db.query(
      'INSERT INTO users (position_x, position_y, position_z, size, color, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *',
      [position_x, position_y, position_z, size, color]
    );
    
    const newUser = result.rows[0];
    console.log('Added custom user:', newUser);
    
    // Broadcast to all clients
    broadcastUserAdded(newUser);
    
    // Return success response
    res.json({
      success: true,
      user: newUser
    });
  } catch (error) {
    console.error('Error adding custom user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add custom user'
    });
  }
});

// API endpoint to truncate the users table
app.post('/api/truncate-users', async (req, res) => {
  try {
    // Truncate the users table
    await db.query('TRUNCATE TABLE users');
    console.log('Truncated users table');
    
    // Broadcast to all clients
    broadcastTruncateUsers();
    
    // Return success response
    res.json({
      success: true,
      message: 'Users table truncated'
    });
  } catch (error) {
    console.error('Error truncating users table:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to truncate users table'
    });
  }
});

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('New WebSocket connection established');
  
  // Add this client to the active connections
  clients.add(ws);
  console.log(`Active connections: ${clients.size}`);
  
  // Send initial data to the client
  sendInitialData(ws);
  
  // Handle messages from the client
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received WebSocket message:', data);
      
      switch (data.type) {
        case 'add_user':
          // Handle adding a user
          await handleAddUser(data, ws);
          break;
          
        case 'remove_user':
          // Handle removing a user
          await handleRemoveUser(data, ws);
          break;
          
        case 'truncate_users':
          // Handle truncating the users table
          await handleTruncateUsers(ws);
          break;
          
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  });
  
  // Handle client disconnection
  ws.on('close', () => {
    console.log('WebSocket connection closed');
    clients.delete(ws);
    console.log(`Active connections: ${clients.size}`);
  });
});

/**
 * Send initial data to a client
 * @param {WebSocket} ws The WebSocket connection
 */
async function sendInitialData(ws) {
  try {
    // Get all users from the database
    const result = await db.query('SELECT * FROM geeks ORDER BY created_at DESC LIMIT 100');
    const users = result.rows;
    
    // Send the initial data
    ws.send(JSON.stringify({
      type: 'initial',
      users: users
    }));
    
    console.log(`Sent initial data with ${users.length} users`);
  } catch (error) {
    console.error('Error sending initial data:', error);
  }
}

/**
 * Handle adding a user
 * @param {Object} data The message data
 * @param {WebSocket} ws The WebSocket connection
 */
async function handleAddUser(data, ws) {
  try {
    // Extract user data
    const { position, size, color } = data;
    
    // Validate required fields
    if (!position || !size || !color) {
      console.error('Missing required fields for adding user');
      return;
    }
    
    // Insert the user into the database
    const result = await db.query(
      'INSERT INTO users (position_x, position_y, position_z, size, color, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *',
      [position.x, position.y, position.z, size, color]
    );
    
    const newUser = result.rows[0];
    console.log('Added user:', newUser);
    
    // Broadcast to all clients
    broadcastUserAdded(newUser);
  } catch (error) {
    console.error('Error adding user:', error);
  }
}

/**
 * Handle removing a user
 * @param {Object} data The message data
 * @param {WebSocket} ws The WebSocket connection
 */
async function handleRemoveUser(data, ws) {
  try {
    // Extract user ID
    const { id } = data;
    
    // Validate required fields
    if (id === undefined) {
      console.error('Missing user ID for removing user');
      return;
    }
    
    // Delete the user from the database
    const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
    
    if (result.rowCount > 0) {
      const removedUser = result.rows[0];
      console.log('Removed user:', removedUser);
      
      // Broadcast to all clients
      broadcastToAll({
        type: 'remove_user',
        id: id
      });
    } else {
      console.log(`User with ID ${id} not found`);
    }
  } catch (error) {
    console.error('Error removing user:', error);
  }
}

/**
 * Handle truncating the users table
 * @param {WebSocket} ws The WebSocket connection
 */
async function handleTruncateUsers(ws) {
  try {
    // Truncate the users table
    await db.query('TRUNCATE TABLE users');
    console.log('Truncated users table');
    
    // Broadcast to all clients
    broadcastTruncateUsers();
  } catch (error) {
    console.error('Error truncating users table:', error);
  }
}

// Broadcast a message to all connected clients
function broadcastToAll(data) {
  console.log(`Broadcasting message of type ${data.type} to ${wss.clients.size} clients`);
  
  let sentCount = 0;
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
      sentCount++;
    }
  });
  
  console.log(`Message sent to ${sentCount} clients`);
}

/**
 * Generate a random position on the planet surface
 * @returns {Object} Position object with x, y, z coordinates
 */
function generateRandomPosition() {
  // Generate random spherical coordinates
  const radius = 3000; // Planet radius
  const theta = Math.random() * Math.PI * 2; // Longitude (0 to 2π)
  const phi = Math.acos(2 * Math.random() - 1); // Latitude (0 to π)
  
  // Convert to Cartesian coordinates
  const x = radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.sin(phi) * Math.sin(theta);
  const z = radius * Math.cos(phi);
  
  return { x, y, z };
}

/**
 * Broadcast a user added event to all connected clients
 * @param {Object} user The user that was added
 */
function broadcastUserAdded(user) {
  broadcastToAll({
    type: 'new_user',
    user: user
  });
}

/**
 * Broadcast a truncate users event to all connected clients
 */
function broadcastTruncateUsers() {
  broadcastToAll({
    type: 'clear_all_users'
  });
}

// Start the server
server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  // Connect to database
  const dbConnected = await connectToDatabase();
  if (!dbConnected) {
    console.error('Failed to connect to database. Server may not function correctly.');
  }
  
  console.log(`API endpoints available:`);
  console.log(`- GET /api/stats - Get active user count`);
  console.log(`- POST /api/users/random - Add a random user`);
  console.log(`- POST /api/users - Add a custom user`);
  console.log(`- POST /api/truncate-users - Remove all users`);
}); 