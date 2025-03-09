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
const { createClient } = require('@supabase/supabase-js');
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

// Supabase configuration from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // Use service key for admin operations

// Create Supabase client if configured
const supabase = SUPABASE_URL && SUPABASE_SERVICE_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null;

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
    
    // Get online users (active users)
    const onlineUsersResult = await db.query(
      'SELECT id, position_x, position_y, position_z, size, color, client_id, active, anon FROM geeks WHERE active = true ORDER BY created_at DESC',
      []
    );
    
    // Include full user data instead of just IDs
    const onlineUsers = onlineUsersResult.rows.map(user => ({
      id: user.id,
      position: {
        x: user.position_x,
        y: user.position_y,
        z: user.position_z
      },
      size: user.size,
      color: user.color,
      client_id: user.client_id,
      active: user.active,
      anon: user.anon
    }));
    const totalOnlineUsers = onlineUsers.length;
    
    // Get all users (including inactive ones)
    const allUsersResult = await db.query(
      'SELECT id, position_x, position_y, position_z, size, color, client_id, active, anon FROM geeks ORDER BY created_at DESC LIMIT 100',
      []
    );
    
    // Include full user data
    const allUsers = allUsersResult.rows.map(user => ({
      id: user.id,
      position: {
        x: user.position_x,
        y: user.position_y,
        z: user.position_z
      },
      size: user.size,
      color: user.color,
      client_id: user.client_id,
      active: user.active,
      anon: user.anon
    }));
    
    // Calculate day-night cycle
    // Use a fixed start time (server start time) to ensure consistency across clients
    const DAY_DURATION = 30 * 60 * 1000; // 30 minutes for a full day-night cycle
    const START_TIME = global.SERVER_START_TIME || (global.SERVER_START_TIME = Date.now());
    const elapsedTime = Date.now() - START_TIME;
    const currentTimeOfDay = (elapsedTime / DAY_DURATION) % 1; // Value between 0 and 1
    
    res.json({
      totalUsers,
      totalOnlineUsers,
      onlineUsers,
      allUsers,
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
    // Get client_id from request body if provided
    const { client_id } = req.body;
    
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
    
    // Check if a geek with this client_id already exists
    if (client_id) {
      const existingResult = await db.query(
        'SELECT * FROM geeks WHERE client_id = $1',
        [client_id]
      );
      
      if (existingResult.rows.length > 0) {
        // Update the existing geek to be active
        const updateResult = await db.query(
          'UPDATE geeks SET active = true, updated_at = NOW() WHERE client_id = $1 RETURNING *',
          [client_id]
        );
        
        const updatedUser = updateResult.rows[0];
        console.log('Activated existing user:', updatedUser);
        
        // Broadcast the user status change
        broadcastUserStatusChange(client_id, true);
        
        // Return success response
        return res.json({
          success: true,
          user: updatedUser
        });
      }
    }
    
    // Create new user in database
    let query, params;
    if (client_id) {
      query = 'INSERT INTO geeks (position_x, position_y, position_z, size, color, client_id, anon, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *';
      params = [position.x, position.y, position.z, size, color, client_id, false];
    } else {
      query = 'INSERT INTO geeks (position_x, position_y, position_z, size, color, anon, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *';
      params = [position.x, position.y, position.z, size, color, false];
    }
    
    const result = await db.query(query, params);
    
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

// API endpoint to truncate the users table
app.post('/api/truncate-users', async (req, res) => {
  try {
    // Truncate the geeks table
    await db.query('TRUNCATE TABLE geeks');
    console.log('Truncated geeks table');
    
    // Broadcast to all clients
    broadcastTruncateUsers();
    
    // Return success response
    res.json({
      success: true,
      message: 'Geeks table truncated'
    });
  } catch (error) {
    console.error('Error truncating geeks table:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to truncate geeks table'
    });
  }
});

// API endpoint for anonymous authentication
app.post('/api/auth/anonymous', async (req, res) => {
  try {
    // Check if Supabase is configured
    if (!supabase) {
      console.error('Supabase is not configured. Authentication failed.');
      return res.status(503).json({
        success: false,
        error: 'Authentication supabase service unavailable'
      });
    }
    
    // Sign up the user with Supabase
    const { data, error } = await supabase.auth.signInAnonymously()
    
    if (error) {
      console.error('Error signing up anonymous user:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create anonymous user'
      });
    }
    
    console.log('Created anonymous user:', data.user.id);
    
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
    
    // Create new geek in database for this anonymous user
    const result = await db.query(
        'INSERT INTO geeks (position_x, position_y, position_z, size, color, client_id, anon, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *',
        [position.x, position.y, position.z, size, color, data.user.id, true]
    );
    
    const newUser = result.rows[0];
    console.log('Added anonymous user geek:', newUser);
    
    // Broadcast to all clients
    broadcastUserAdded(newUser);
    
    // Return the user data to the client
    res.json({
      success: true,
      user: {
        id: data.user.id
      },
      session: {
        access_token: data.session.access_token
      }
    });
  } catch (error) {
    console.error('Error in anonymous authentication:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// API endpoint to verify a token
app.post('/api/auth/verify', async (req, res) => {
  try {
    const { token } = req.body;
    
    // Check if token is provided
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token is required'
      });
    }
    
    // Check if Supabase is configured
    if (!supabase) {
      console.error('Supabase is not configured. Token verification failed.');
      return res.status(503).json({
        success: false,
        error: 'Authentication supabase service unavailable'
      });
    }
    
    // Verify the token with Supabase
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.error('Error verifying token:', error);
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }
    
    // Return the user data to the client
    res.json({
      success: true,
      user: {
        id: data.user.id
      }
    });
  } catch (error) {
    console.error('Error in token verification:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection');
  
  // We'll set the client ID after receiving it from the client
  ws.clientId = null;
  
  // Add to active clients
  clients.add(ws);
  console.log(`Active connections: ${clients.size}`);
  
  // Handle incoming messages
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received message:', data);
      
      // Handle different message types
      switch (data.type) {
        case 'spawn_user':
          // Client is telling us their Supabase user ID
          const { clientId, token } = data;
          
          // Verify the token if provided
          if (token) {
            // Check if Supabase is configured
            if (!supabase) {
              console.error('Supabase is not configured. Token verification failed.');
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Authentication service unavailable'
              }));
              return;
            }
            
            // Verify with Supabase
            try {
              const { data: userData, error } = await supabase.auth.getUser(token);
              if (error || !userData || userData.user.id !== clientId) {
                console.warn(`Invalid token for client ID ${clientId}`);
                // Send error message to client
                ws.send(JSON.stringify({
                  type: 'error',
                  message: 'Invalid authentication token'
                }));
                return;
              }
            } catch (error) {
              console.error('Error verifying token:', error);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Error verifying authentication token'
              }));
              return;
            }
          } else {
            // No token provided
            console.warn(`No token provided for client ID ${clientId}`);
            ws.send(JSON.stringify({
              type: 'warning',
              message: 'No authentication token provided'
            }));
            // Continue anyway for backward compatibility
          }
          
          // Token is valid or not provided (for backward compatibility)
          ws.clientId = clientId;
          console.log(`Client set ID to: ${ws.clientId}`);
          
          // If client has a client ID, mark their geek as active or create a new one
          if (ws.clientId) {
            try {
              // Check if the user already exists
              const existingResult = await db.query(
                'SELECT * FROM geeks WHERE client_id = $1',
                [ws.clientId]
              );
              
              if (existingResult.rows.length > 0) {
                // User exists, update to active
                const updateResult = await db.query(
                  'UPDATE geeks SET active = true, updated_at = NOW() WHERE client_id = $1 RETURNING *',
                  [ws.clientId]
                );
                
                if (updateResult.rows.length > 0) {
                  const user = updateResult.rows[0];
                  console.log('Activated existing user:', user);
                  
                  // Broadcast the user status change
                  broadcastUserStatusChange(ws.clientId, true);
                  
                  // Broadcast the user to the client who just connected
                  broadcastUserAdded(user);
                }
              } else {
                // User doesn't exist, create a new one
                console.log('Creating new user for client ID:', ws.clientId);
                
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
                
                // Create new geek in database
                const result = await db.query(
                  'INSERT INTO geeks (position_x, position_y, position_z, size, color, client_id, anon, active, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING *',
                  [position.x, position.y, position.z, size, color, ws.clientId, true, true]
                );
                
                const newUser = result.rows[0];
                console.log('Created new user:', newUser);
                
                // Broadcast to all clients
                broadcastUserAdded(newUser);
              }
            } catch (error) {
              console.error('Error handling spawn_user:', error);
            }
          }
          break;
          
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  });
  
  // Handle client disconnection
  ws.on('close', async () => {
    console.log('WebSocket connection closed');
    clients.delete(ws);
    console.log(`Active connections: ${clients.size}`);
    
    // Mark the user's geek as inactive (offline) if we have a client ID
    if (ws.clientId) {
      try {
        await db.query(
          'UPDATE geeks SET active = false, updated_at = NOW() WHERE client_id = $1',
          [ws.clientId]
        );
        
        // Broadcast the user status change
        broadcastUserStatusChange(ws.clientId, false);
      } catch (error) {
        console.error('Error updating user status on disconnect:', error);
      }
    }
  });
});


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
 * Broadcast a new user to all connected clients
 * @param {Object} user The user data
 */
function broadcastUserAdded(user) {
  const message = JSON.stringify({
    type: 'new_user',
    user: user
  });
  
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

/**
 * Broadcast a truncate users event to all connected clients
 */
function broadcastTruncateUsers() {
  const message = JSON.stringify({
    type: 'clear_all_users'
  });
  
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

/**
 * Broadcast a user status change event to all connected clients
 * @param {string} clientId The Supabase user ID of the user
 * @param {boolean} isActive Whether the user is active or inactive
 */
function broadcastUserStatusChange(clientId, isActive) {
  const message = JSON.stringify({
    type: 'user_status',
    clientId: clientId,
    active: isActive
  });
  
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
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
  console.log(`- GET /api/stats - Get active user count and geek data`);
  console.log(`- POST /api/users/random - Add a random user`);
  console.log(`- POST /api/truncate-users - Remove all users`);
  console.log(`- POST /api/auth/anonymous - Authenticate anonymously and create geek`);
  console.log(`- POST /api/auth/verify - Verify a token`);
}); 