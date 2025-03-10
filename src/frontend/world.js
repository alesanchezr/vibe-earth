/**
 * 3D Online World Visualization
 * A simple visualization of geeks coming online using Three.js on a spherical planet
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import TWEEN from '@tweenjs/tween.js';
import { Geek } from './Geek.js';
import { WebSocketClient } from './websocket-client.js';
import { ApiClient } from './api-client.js';
import { Planet } from './Planet.js';
import { Sky } from './Sky.js';
import { DebugShortcuts } from './debug-shortcuts.js';
import { Color } from 'three';
import { ColorGradient } from './helper/colorgradient';
import { PlanetMaterialWithCaustics } from './materials/OceanCausticsMaterial';

export class World {
    constructor(userId) {
        
        // Configuration
        this.config = {
            maxUsers: 100,            // Maximum number of users to show
            colors: [
                0x4285F4, // Blue
                0xEA4335, // Red
                0xFBBC05, // Yellow
                0x34A853, // Green
                0x9C27B0, // Purple
                0xFF9800  // Orange
            ],
            minSize: 15,               // Minimum user size
            maxSize: 40,               // Maximum user size
            minZoom: 0.25,             // Minimum zoom level
            maxZoom: 4.0,              // Maximum zoom level
            zoomSpeed: 0.1,            // Zoom speed factor
            collisionIterations: 5,    // Collision detection iterations
            cameraInertia: 0.95,       // Camera inertia factor
            cameraDamping: 0.2,        // Camera movement damping factor
            cameraMovementSpeed: 2.0,  // Base speed for camera movement
            maxHeight: 12000,          // Maximum camera height
            planetRadius: 3000,        // Planet radius
            dayDuration: 30 * 60 * 1000, // Day duration in milliseconds (30 minutes)
            skyColors: {
                day: 0x87CEEB,         // Sky blue
                sunset: 0xFFA07A,      // Light salmon
                night: 0x000033        // Dark blue
            },
            groundColors: {
                day: 0xA5D6A7,         // Green
                night: 0x2E7D32        // Dark green
            },
            offlineColor: 0x808080     // Gray color for offline geeks
        };
        
        // Store the user ID from Supabase
        this.userId = userId;
        
        // Initialize properties
        this.users = [];  // Array of users in the world
        this.zoomLevel = 1.0;
        this.targetZoomLevel = 1.0;
        this.lastTime = Date.now();
        this._receivedServerStats = false;  // Flag to track if we've received stats from the server
        this.showOfflineGeeks = true;      // Whether to show offline geeks
        this.isInitialized = false;        // Flag to track if the world is fully initialized
        
        // Camera tracking properties
        this.isCameraTracking = false;     // Whether the camera is tracking a geek
        this.focusedGeek = null;           // The geek being tracked
        
        // First-person perspective properties
        this.isFirstPerson = false;    // Whether we're in first-person mode
        this.firstPersonGeek = null;   // The geek we're viewing from
        this.originalCameraPosition = null; // Store original camera position for returning to third-person
        this.originalCameraRotation = null; // Store original camera rotation
        
        // Create sky color gradient
        this.skyGradient = new ColorGradient({
            stops: [
                [0, new Color(0x1a1a2e)], // Night
                [0.25, new Color(0x2a2a4a)], // Dawn
                [0.5, new Color(0x4a90e2)], // Day
                [0.75, new Color(0x2a2a4a)], // Dusk
                [1, new Color(0x1a1a2e)] // Night
            ]
        });
        
        try {
            // Initialize Three.js
            this.initThree();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Initialize UI displays
            this.updateCounterDisplay();
            
            // Create offline toggle button if the method exists
            if (typeof this.createOfflineToggleButton === 'function') {
                this.createOfflineToggleButton();
            } else {
                console.warn('createOfflineToggleButton method not found');
            }
            
            // Initialize API client
            this.apiClient = new ApiClient();
            
            // Initialize the 3D world and load initial data
            this.initializeWorld();
            
        } catch (error) {
            console.error('Error in World constructor:', error);
        }
    }
    
    /**
     * Initialize Three.js scene, camera, renderer
     */
    initThree() {
        
        try {
            // Create scene
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x87CEEB); // Default sky blue
            
            // Create camera (perspective for 3D with top-down view)
            const width = window.innerWidth;
            const height = window.innerHeight;
            const aspectRatio = width / height;
            this.camera = new THREE.PerspectiveCamera(
                60, // Field of view
                aspectRatio,
                1,
                50000 // Far plane
            );
            
            // Position camera above the planet
            const orbitHeight = this.config.planetRadius + 4500;
            this.camera.position.set(0, orbitHeight, 0);
            this.camera.lookAt(0, 0, 0);
            
            // Store the initial camera position for returning to it later
            this.initialCameraPosition = new THREE.Vector3(0, orbitHeight, 0);
            
            // Create renderer
            this.renderer = new THREE.WebGLRenderer({
                canvas: document.getElementById('worldCanvas'),
                antialias: true,
                alpha: false
            });
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.setPixelRatio(window.devicePixelRatio);
            
            // Enable shadows
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            
            // Ensure proper depth handling
            this.renderer.sortObjects = true;
            this.renderer.autoClear = true;
            
            // Add ambient light
            const ambientLight = new THREE.AmbientLight(0x404040, 1.0);
            this.scene.add(ambientLight);
            
            // Add directional light (sun)
            const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
            directionalLight.position.set(1, 1, 1).normalize();
            directionalLight.castShadow = true;
            directionalLight.shadow.mapSize.width = 2048;
            directionalLight.shadow.mapSize.height = 2048;
            directionalLight.shadow.camera.near = 0.5;
            directionalLight.shadow.camera.far = 500;
            directionalLight.shadow.camera.left = -100;
            directionalLight.shadow.camera.right = 100;
            directionalLight.shadow.camera.top = 100;
            directionalLight.shadow.camera.bottom = -100;
            this.scene.add(directionalLight);
            
            // Add a second directional light for better illumination
            const secondaryLight = new THREE.DirectionalLight(0xffffff, 0.5);
            secondaryLight.position.set(-1, 0.5, -1).normalize();
            this.scene.add(secondaryLight);
            
            console.log("Creating planet...");
            // Create the planet
            try {
                console.log("Starting planet creation...");
                this.planet = new Planet({
                    shape: 'sphere',
                    detail: 50,
                    scatter: 1.2,
                    atmosphere: {
                        enabled: true,
                        color: new THREE.Vector3(0.3, 0.6, 1.0),
                        height: 0.1
                    },
                    material: 'normal',
                    biome: {
                        noise: {
                            min: -0.05,
                            max: 0.05,
                            octaves: 4,
                            lacunarity: 2.0,
                            gain: {
                                min: 0.1,
                                max: 0.8,
                                scale: 2,
                            },
                            warp: 0.3,
                            scale: 1,
                            power: 1.5,
                        },
                        colors: [
                            [-0.5, 0x994400],  // Deep terrain
                            [-0.0, 0xccaa00],  // Beaches
                            [0.4, 0xcc7700],   // Mountains
                            [1.0, 0x002222],   // Peaks
                        ],
                        seaColors: [
                            [-1, 0x000066],    // Deep ocean
                            [-0.55, 0x0000aa], // Medium depth
                            [-0.1, 0x00f2e5],  // Shallow water
                        ],
                        seaNoise: {
                            min: -0.008,
                            max: 0.008,
                            scale: 6,
                        },
                        vegetation: {
                            items: [
                                {
                                    name: "Rock",
                                    density: 50,
                                    minimumHeight: 0.1,
                                    colors: {
                                        Gray: { array: [0x775544] },
                                    },
                                },
                                {
                                    name: "PineTree",
                                    density: 50,
                                    minimumHeight: 0.1,
                                    maximumHeight: 0.8,
                                    maximumSlope: Math.PI / 4,
                                    colors: {
                                        Brown: { array: [0x8b4513, 0x5b3105] },
                                        Green: { array: [0x22851e, 0x22a51e] },
                                        DarkGreen: { array: [0x006400] },
                                    },
                                    ground: {
                                        color: 0x229900,
                                        radius: 0.1,
                                        raise: 0.01,
                                    },
                                },
                            ],
                        },
                    }
                });
                
                // Create the planet mesh and add it to the scene
                console.log("Waiting for planet mesh creation...");
                this.planet.create().then(planetMesh => {
                    console.log("Planet mesh created successfully:", planetMesh);
                    console.log("Planet mesh properties:", {
                        visible: planetMesh.visible,
                        position: planetMesh.position,
                        scale: planetMesh.scale,
                        material: planetMesh.material,
                        geometry: planetMesh.geometry
                    });
                    
                    this.planetMesh = planetMesh;
                    this.scene.add(planetMesh);
                    console.log("Planet added to scene. Scene children:", this.scene.children);
                    
                    // Position camera relative to planet size
                    const orbitHeight = this.config.planetRadius * 1.5; // 1.5 times planet radius
                    this.camera.position.set(0, orbitHeight, 0);
                    this.camera.lookAt(0, 0, 0);
                    
                    // Update controls
                    this.controls.minDistance = this.config.planetRadius * 1.1;
                    this.controls.maxDistance = this.config.planetRadius * 5;
                    this.controls.target.set(0, 0, 0);
                    this.controls.update();
                    
                    // Mark the world as initialized
                    this.isInitialized = true;
                    
                    // Start the animation loop only after planet is ready
                    this.animate(0);
                }).catch(error => {
                    console.error("Error creating planet mesh:", error);
                });
            } catch (error) {
                console.error("Error creating planet:", error);
            }
            
            console.log("Creating sky...");
            // Create the sky
            try {
                this.sky = new Sky({
                    scene: this.scene,
                    renderer: this.renderer,
                    colors: this.config.skyColors,
                    dayDuration: this.config.dayDuration
                });
                console.log("Sky created successfully:", this.sky);
            } catch (error) {
                console.error("Error creating sky:", error);
            }
            
            // Create orbit controls
            this.controls = new OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.screenSpacePanning = false;
            this.controls.minDistance = this.config.planetRadius + 10;
            this.controls.maxDistance = this.config.planetRadius * 5;
            this.controls.maxPolarAngle = Math.PI;
            
            console.log("Three.js initialized successfully");
        } catch (error) {
            console.error("Error initializing Three.js:", error);
        }
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Window resize event
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        // Mouse wheel event for zooming
        window.addEventListener('wheel', (event) => {
            // Prevent default scrolling
            event.preventDefault();
            
            // Calculate zoom direction
            const zoomDirection = event.deltaY > 0 ? 1 : -1;
            
            // Update target zoom level
            this.targetZoomLevel += zoomDirection * this.config.zoomSpeed;
            
            // Clamp to min/max zoom
            this.targetZoomLevel = Math.max(this.config.minZoom, Math.min(this.config.maxZoom, this.targetZoomLevel));
            
            // Update the zoom indicator
            this.updateZoomIndicator();
        }, { passive: false });
        
        // Prevent context menu on right-click
        window.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Add user on stats box click
        const statsBox = document.getElementById('stats');
        if (statsBox) {
            statsBox.addEventListener('click', () => this.addRandomUser());
        }
    }
    
    /**
     * Handle window resize
     */
    onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // Update camera aspect ratio
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        // Update renderer size
        this.renderer.setSize(width, height);
    }
    
    /**
     * Update the zoom indicator with the current camera height
     */
    updateZoomIndicator() {
        const zoomValueElement = document.getElementById('zoom-value');
        const fovValueElement = document.getElementById('fov-value');
        
        if (zoomValueElement && this.camera) {
            // Calculate actual height above the planet surface in km
            const distanceFromCenter = this.camera.position.length();
            const heightAboveSurface = distanceFromCenter - this.config.planetRadius;
            
            // Convert to km and format to 1 decimal place
            const heightInKm = (heightAboveSurface / 1000).toFixed(1);
            zoomValueElement.textContent = heightInKm;
        }
        
        if (fovValueElement && this.camera) {
            // Display the actual camera FOV
            const fov = Math.round(this.camera.fov);
            fovValueElement.textContent = fov;
        }
    }
    
    /**
     * Initialize the 3D world and start the rendering loop
     */
    async initializeWorld() {
        console.log("Initializing 3D world...");
        
        try {
            // Debug THREE.js availability
            console.log("THREE.js version:", THREE.REVISION);
            console.log("OrbitControls available:", typeof OrbitControls !== 'undefined');
            console.log("TWEEN available:", typeof TWEEN !== 'undefined');
            
            // Debug planet and sky instances
            console.log("Planet instance:", this.planet);
            console.log("Sky instance:", this.sky);
            
            // Initialize debug shortcuts (admin only)
            this.debugShortcuts = new DebugShortcuts(this);
            
            // Mark the world as initialized
            this.isInitialized = true;
            
            // Start the animation loop
            this.animate(0);
            
            // Start periodic stats update
            this.startStatsUpdates();
            
            // Update user info display if the method exists
            if (typeof this.updateUserInfoDisplay === 'function') {
                this.updateUserInfoDisplay();
            } else {
                console.warn('updateUserInfoDisplay method not found');
            }
            
            console.log("3D world initialized successfully");
        } catch (error) {
            console.error("Error initializing 3D world:", error);
        }
    }
    
    /**
     * Start periodic stats updates from the server
     */
    startStatsUpdates() {
        // Only start updates if planet is ready
        if (!this.planet || !this.planet.ready) {
            console.warn('Cannot start stats updates: Planet not ready');
            return;
        }

        // Update stats immediately
        this.fetchAndUpdateStats();
        
        // Then update every 10 seconds
        setInterval(() => {
            this.fetchAndUpdateStats();
        }, 10000);
    }
    
    /**
     * Fetch stats from the server and update the display
     */
    async fetchAndUpdateStats() {
        try {
            // Check if planet is ready before proceeding
            if (!this.planet || !this.planet.ready) {
                console.warn('Cannot fetch stats: Planet not ready');
                return;
            }

            const stats = await this.apiClient.getStats();
            
            // Mark that we've received server stats
            this._receivedServerStats = true;
            
            // Update the online users counter
            const counterElement = document.getElementById('counter');
            if (counterElement && stats.totalOnlineUsers !== undefined) {
                counterElement.textContent = stats.totalOnlineUsers;
            }
            
            // Update the total users counter
            const totalCounterElement = document.getElementById('total-counter');
            if (totalCounterElement && stats.totalUsers !== undefined) {
                totalCounterElement.textContent = stats.totalUsers;
            }
            
            // Render online users if available and planet is ready
            if (stats.onlineUsers && Array.isArray(stats.onlineUsers) && this.planet && this.planet.ready) {
                // Get current user IDs in the scene
                const currentUserIds = this.users.map(user => user.id).filter(id => id !== undefined);
                
                // Add new users that aren't already in the scene
                stats.onlineUsers.forEach(userData => {
                    if (!currentUserIds.includes(userData.id)) {
                        this.addUserFromServer(userData);
                    }
                });
            }
            
            // If we have day-night cycle information and a sky, update it
            if (stats.day_night_cycle && this.sky) {
                // The sky will handle syncing internally via its syncWithServer method
                // This is just a good opportunity to sync again if needed
                this.sky.syncWithServer().catch(error => {
                    console.warn('Failed to sync sky with server:', error);
                });
            }
            
            // Initialize WebSocket client after initial data is loaded
            if (!this.wsClient && this.userId) {
                this.wsClient = new WebSocketClient(this);
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
            
            // If we failed to fetch stats, still initialize WebSocket client after a delay
            if (!this.wsClient && this.userId) {
                console.log('Failed to fetch initial data');
            }
        }
    }
    
    /**
     * Add a new user to the world
     * This is only used for manual user creation, not for users from the server
     */
    addUser() {
        // Check if we've reached the maximum number of users
        if (this.users.length >= this.config.maxUsers) {
            console.log(`Maximum number of users (${this.config.maxUsers}) reached`);
            return;
        }
        
        // Generate random properties
        const size = this.config.minSize + Math.random() * (this.config.maxSize - this.config.minSize);
        const colorIndex = Math.floor(Math.random() * this.config.colors.length);
        const color = this.config.colors[colorIndex];
        
        // Find a position that doesn't collide with existing users
        const position = this.findNonCollidingPosition(size);
        
        // Create the new user
        const user = new Geek({
            size,
            color,
            position,
            scene: this.scene,
            cameraY: this.camera.position.y,
            planetRadius: this.config.planetRadius
        });
        
        // Add to the array
        this.users.push(user);
        
        // Update the counter display
        this.updateCounterDisplay();
        
        // Notify the server about the new user
        this.wsClient.addUser({
            position: position,
            size: size,
            color: color
        });
        
    }
    
    /**
     * Add a user from server data
     * @param {Object} userData - User data from server
     */
    addUserFromServer(userData) {
        // Check if planet is ready before adding users
        if (!this.planet || !this.planet.ready) {
            console.warn('Cannot add user: Planet not ready');
            return;
        }

        // Check if we already have this user
        const existingUserIndex = this.users.findIndex(user => user.id === userData.id);
        if (existingUserIndex !== -1) {
            console.log(`User with ID ${userData.id} already exists, updating`);
            
            // Update the existing user
            const existingUser = this.users[existingUserIndex];
            
            // Update position if it has changed
            if (userData.position) {
                existingUser.targetPosition = {
                    x: userData.position.x,
                    y: userData.position.y,
                    z: userData.position.z
                };
                
                // Create a tween for smooth movement
                new TWEEN.Tween(existingUser.position)
                    .to(existingUser.targetPosition, 1000)
                    .easing(TWEEN.Easing.Quadratic.Out)
                    .start();
            }
            
            // Update other properties
            if (userData.size !== undefined) existingUser.size = userData.size;
            if (userData.color !== undefined) existingUser.updateColor(userData.color);
            if (userData.active !== undefined) existingUser.active = userData.active;
            if (userData.anon !== undefined) existingUser.anon = userData.anon;
            
            console.log('Returning existing user:', existingUser);
            return existingUser;
        }
        
        // Process position data from server
        let processedUserData = { ...userData };
        
        // Check if position is in the expected format
        if (!userData.position || 
            typeof userData.position !== 'object' || 
            userData.position.x === undefined || 
            userData.position.y === undefined || 
            userData.position.z === undefined) {
            
            // If position is not in the expected format, try to extract it from individual fields
            if (userData.position_x !== undefined && 
                userData.position_y !== undefined && 
                userData.position_z !== undefined) {
                
                processedUserData.position = {
                    x: userData.position_x,
                    y: userData.position_y,
                    z: userData.position_z
                };
            } else {
                // If no position data is available, generate a random position
                const randomPosition = this.generateRandomPosition();
                processedUserData.position = randomPosition;
                console.log('Using random position as fallback:', randomPosition);
            }
        }
        
        // Convert server data to Geek options
        const options = {
            id: processedUserData.id,
            client_id: processedUserData.client_id,
            size: processedUserData.size,
            color: processedUserData.color,
            position: processedUserData.position,
            scene: this.scene,
            cameraY: this.camera.position.y,
            planetRadius: this.config.planetRadius,
            active: processedUserData.active !== undefined ? processedUserData.active : true,
            anon: processedUserData.anon !== undefined ? processedUserData.anon : false
        };
        
        // Create the new user
        const user = new Geek(options);
        
        // Add to the array
        this.users.push(user);
        
        // Update the counter display
        this.updateCounterDisplay();
        
        return user;
    }
    
    /**
     * Remove a user by ID
     * @param {number} id The user ID
     */
    removeUserById(id) {
        const index = this.users.findIndex(user => user.id === id);
        
        if (index !== -1) {
            // Remove the user from the scene
            this.users[index].remove();
            
            // Remove from the array
            this.users.splice(index, 1);
            
            // Update the counter display
            this.updateCounterDisplay();
            
            console.log(`Removed user with ID ${id}`);
        }
    }
    
    /**
     * Clear all users from the world
     */
    clearUsers() {
        // Remove all users from the scene
        this.users.forEach(user => user.remove());
        
        // Clear the array
        this.users = [];
        
        // Update the counter display
        this.updateCounterDisplay();
        
        console.log('Cleared all users');
    }
    
    /**
     * Add a random user via API
     */
    async addRandomUser() {
        try {
            const response = await this.apiClient.addRandomUser();
            
            if (response.success) {
                // The user will be added via WebSocket broadcast
                console.log('Waiting for WebSocket to add the user...');
            }
        } catch (error) {
            console.error('Error adding random user:', error);
        }
    }
    
    /**
     * Truncate the users table (remove all users)
     */
    async truncateUsers() {
        try {
            const response = await this.apiClient.truncateUsers();
            console.log('Users truncated via API:', response);
            
            if (response.success) {
                // The users will be cleared via WebSocket broadcast
                console.log('Waiting for WebSocket to clear users...');
            }
        } catch (error) {
            console.error('Error truncating users:', error);
        }
    }
    
    /**
     * Update the counter display with the local count of users
     * Note: This is now only used for immediate feedback when adding/removing users locally
     * The actual count will be updated by fetchAndUpdateStats() with server data
     */
    updateCounterDisplay() {
        try {
            
            const counterElement = document.getElementById('counter');
            if (counterElement) {
                // Count only active users
                const activeUserCount = this.users.filter(user => user && user.active).length;
                counterElement.textContent = activeUserCount;
            }
            
            // Also update total counter if available
            const totalCounterElement = document.getElementById('total-counter');
            if (totalCounterElement) {
                totalCounterElement.textContent = this.users.length;
            }
        } catch (error) {
            console.error("Error updating counter display:", error);
        }
    }
    
    /**
     * Find a position on the planet surface that doesn't collide with existing users
     * @param {number} radius Radius of the new user
     * @returns {Object} Position {x, y, z} on the planet surface
     */
    findNonCollidingPosition(radius) {
        // Generate a random position on the sphere
        const position = this.planet.getRandomPosition();
        
        // Check for collisions with existing users
        for (let i = 0; i < this.config.collisionIterations; i++) {
            if (!this.hasNearbyCollision(position, radius)) {
                return position;
            }
            
            // Try a new random position
            const newPosition = this.planet.getRandomPosition();
            position.x = newPosition.x;
            position.y = newPosition.y;
            position.z = newPosition.z;
        }
        
        // If we couldn't find a non-colliding position after several attempts, just return the last one
        return position;
    }
    
    /**
     * Check if a position collides with any existing users
     * @param {Object} position Position to check
     * @param {number} radius Radius of the new user
     * @returns {boolean} True if there's a collision
     */
    hasNearbyCollision(position, radius) {
        for (const user of this.users) {
            const dx = user.position.x - position.x;
            const dy = user.position.y - position.y;
            const dz = user.position.z - position.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            // Check if the distance is less than the sum of the radii
            if (distance < radius + user.size) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Animation loop
     * @param {number} currentTime Current time in milliseconds
     */
    animate(currentTime) {
        // Request next frame
        requestAnimationFrame(this.animate.bind(this));
        
        try {
            // Only proceed if the world is initialized
            if (!this.isInitialized) {
                return;
            }
            
            // Calculate delta time in seconds
            const deltaTime = (currentTime - (this.lastTime || currentTime)) / 1000;
            this.lastTime = currentTime;
            
            // Cap delta time to prevent large jumps
            const dt = Math.min(deltaTime, 0.1);
            
            // Update orbit controls if available
            if (this.controls) {
                this.controls.update();
            }
            
            // Update zoom indicator with current camera height
            this.updateZoomIndicator();
            
            // Update all users
            for (const user of this.users) {
                user.update(dt, currentTime / 1000);
            }
            
            // Handle camera tracking for falling geeks
            if (this.isCameraTracking && this.focusedGeek) {
                // Store the current camera position for use when the geek lands
                this.lastTrackingCameraPosition = this.camera.position.clone();
                
                // Check if the geek is still falling
                if (this.focusedGeek.isSimulating) {
                    // Update camera position to follow the falling geek
                    this.updateCameraForFallingGeek(this.focusedGeek);
                } else {
                    // Geek has landed, stop tracking
                    this.isCameraTracking = false;
                    
                    // Return the camera to the sky view if returnToSkyAfterLanding is true
                    if (this.returnToSkyAfterLanding) {
                        // Use the last tracking camera position for a smooth transition
                        this.returnCameraToSky(this.lastTrackingCameraPosition);
                    }
                }
            }
            
            // Update day/night cycle if sky and planet are available
            if (this.sky && this.planet) {
                this.sky.update(dt, this.lerpColor.bind(this), (timeOfDay) => {
                    this.planet.updateColor(timeOfDay, this.lerpColor.bind(this));
                });
            }
            
            // Update TWEEN animations
            TWEEN.update();
            
            // Update planet materials if needed
            if (this.planetMesh && this.planetMesh.material instanceof PlanetMaterialWithCaustics) {
                this.planetMesh.material.update();
            }
            
            // Render the scene
            this.renderer.render(this.scene, this.camera);
        } catch (error) {
            console.error('Error in animation loop:', error);
        }
    }
    
    /**
     * Interpolate between two colors
     * @param {number} color1 First color in hex format
     * @param {number} color2 Second color in hex format
     * @param {number} t Interpolation factor (0 to 1)
     * @returns {number} Interpolated color in hex format
     */
    lerpColor(color1, color2, t) {
        const r1 = (color1 >> 16) & 255;
        const g1 = (color1 >> 8) & 255;
        const b1 = color1 & 255;
        
        const r2 = (color2 >> 16) & 255;
        const g2 = (color2 >> 8) & 255;
        const b2 = color2 & 255;
        
        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);
        
        return (r << 16) | (g << 8) | b;
    }
    
    /**
     * Create or activate the user's geek
     */
    async createOrActivateUserGeek() {
        console.log('createOrActivateUserGeek called, userId:', this.userId);
        
        if (!this.userId) {
            console.error('createOrActivateUserGeek: userId is null or undefined');
            return;
        }
        
        try {
            // The user's geek is created during anonymous authentication
            // This method is now just for activating an existing geek
            
            // Find the user's geek
            const userGeek = this.findUserGeek();
            
            if (userGeek) {
                // Focus the camera on the user's geek
                // The camera will automatically position itself to see the drop animation
                // if the geek is still falling
                this.focusCameraOnGeek(userGeek);
            } else {
                console.error('User geek not found, it should have been created during authentication');
                // console.log('Current users:', this.users.map(u => ({ id: u.id, client_id: u.client_id })));
                
                // If for some reason the geek wasn't created during authentication,
                // we could try to create it here, but that's handled by the server now
            }
        } catch (error) {
            console.error('Error activating user geek:', error);
        }
    }
    
    /**
     * Find the user's geek in the world
     * @returns {Object|null} The user's geek or null if not found
     */
    findUserGeek() {
        
        if (!this.userId) {
            console.error('findUserGeek: userId is null or undefined');
            return null;
        }
        
        const userGeek = this.users.find(user => user.client_id === this.userId);
        
        return userGeek;
    }
    
    /**
     * Focus the camera on a specific geek
     * @param {Object} geek The geek to focus on
     * @param {boolean} [returnToSky=true] Whether to return to sky view after the geek lands
     */
    focusCameraOnGeek(geek, returnToSky = true) {
        
        if (!geek) {
            console.error('focusCameraOnGeek: geek is null or undefined');
            return;
        }
        
        if (!geek.mesh) {
            console.error('focusCameraOnGeek: geek.mesh is null or undefined');
            return;
        }
        
        // Store the geek we're focusing on
        this.focusedGeek = geek;
        
        // Store whether to return to sky view after the geek lands
        this.returnToSkyAfterLanding = returnToSky;
        
        // If the geek is still falling, set up continuous tracking
        if (geek.isSimulating) {
            this.isCameraTracking = true;
            
            // Initial camera positioning
            this.updateCameraForFallingGeek(geek);
            
            // We'll continue tracking in the animate method
            return;
        }
        
        // For geeks that are already on the surface, just do a one-time camera move
        // Get the geek's position
        const position = geek.mesh.position.clone();
        
        // Calculate a position slightly above and behind the geek
        const offset = position.clone().normalize().multiplyScalar(300);
        const targetPosition = position.clone().add(offset);
        
        console.log('Moving camera to position:', targetPosition);
        
        // Animate the camera to the new position
        new TWEEN.Tween(this.camera.position)
            .to({
                x: targetPosition.x,
                y: targetPosition.y,
                z: targetPosition.z
            }, 2000)
            .easing(TWEEN.Easing.Cubic.InOut)
            .start();
        
        // Make the camera look at the geek
        this.camera.lookAt(position);
        
        // Update the controls target to the geek's position
        this.controls.target.copy(position);
        
        // If returnToSky is true, set a timeout to return to sky view
        if (returnToSky) {
            setTimeout(() => {
                // Pass the current camera position for a smooth transition
                this.returnCameraToSky(this.camera.position.clone());
            }, 5000); // Wait 5 seconds before returning to sky view
        }
    }
    
    /**
     * Update the user info display
     */
    updateUserInfoDisplay() {
        // Find the user's geek
        const userGeek = this.findUserGeek();
        
        // Update the user status display
        const userStatusElement = document.getElementById('user-status');
        if (userStatusElement && userGeek) {
            if (userGeek.active) {
                userStatusElement.textContent = 'Connected';
                userStatusElement.style.color = '#4CAF50'; // Green
            } else {
                userStatusElement.textContent = 'Disconnected';
                userStatusElement.style.color = '#EA4335'; // Red
            }
        }
        
        // Update the user type display
        const userTypeElement = document.getElementById('user-type');
        if (userTypeElement && userGeek) {
            if (userGeek.anon) {
                userTypeElement.textContent = 'Anonymous User';
            } else {
                userTypeElement.textContent = 'Registered User';
            }
        }
        
        // Update the user ID display
        const userIdElement = document.getElementById('user-id');
        if (userIdElement && this.userId) {
            // Show only the first 8 characters of the user ID for privacy
            const shortId = this.userId.substring(0, 8) + '...';
            userIdElement.textContent = shortId;
        }
    }
    
    /**
     * Update a user's status (active/inactive)
     * @param {string} clientId - The client ID of the user to update
     * @param {boolean} active - Whether the user is active
     */
    updateUserStatus(clientId, active) {
        
        // Find the user with this client ID
        const user = this.users.find(u => u.client_id === clientId);
        
        if (!user) {
            console.warn(`No user found with client ID ${clientId}`);
            return;
        }
        
        // Update the active status
        user.active = active;
        
        // If the user is now active, restore their original color
        if (active) {
            if (user.originalColor) {
                user.updateColor(user.originalColor);
                user.originalColor = null;
            }
            
            // Make sure the user is visible
            if (user.mesh) {
                user.mesh.visible = true;
            }
        } else {
            // User is now inactive
            
            // Store original color if not already stored
            if (!user.originalColor) {
                user.originalColor = user.color.clone();
            }
            
            // Set to offline color (gray)
            user.updateColor(new THREE.Color(this.config.offlineColor));
            
            // Hide if offline geeks are not shown
            if (user.mesh) {
                user.mesh.visible = this.showOfflineGeeks;
            }
        }
        
        // Update the counter display
        this.updateCounterDisplay();
        
        // Update the user info display if this is the current user
        if (clientId === this.userId) {
            this.updateUserInfoDisplay();
        }
    }
    
    /**
     * Create a toggle button for showing/hiding offline geeks
     */
    createOfflineToggleButton() {
        try {
            
            // Create the button container
            const buttonContainer = document.createElement('div');
            buttonContainer.id = 'offline-toggle';
            buttonContainer.style.position = 'fixed';
            buttonContainer.style.bottom = '20px';
            buttonContainer.style.left = '20px';
            buttonContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            buttonContainer.style.color = 'white';
            buttonContainer.style.padding = '10px';
            buttonContainer.style.borderRadius = '5px';
            buttonContainer.style.cursor = 'pointer';
            buttonContainer.style.zIndex = '1000';
            buttonContainer.style.display = 'flex';
            buttonContainer.style.alignItems = 'center';
            buttonContainer.style.transition = 'background-color 0.3s';
            
            // Create the checkbox
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = 'offline-checkbox';
            checkbox.checked = this.showOfflineGeeks;
            checkbox.style.marginRight = '10px';
            
            // Create the label
            const label = document.createElement('label');
            label.htmlFor = 'offline-checkbox';
            label.textContent = 'Show Offline Geeks';
            
            // Add elements to the container
            buttonContainer.appendChild(checkbox);
            buttonContainer.appendChild(label);
            
            // Add event listener
            checkbox.addEventListener('change', (event) => {
                this.showOfflineGeeks = event.target.checked;
                this.updateOfflineGeeksVisibility();
            });
            
            // Add hover effect
            buttonContainer.addEventListener('mouseenter', () => {
                buttonContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
            });
            
            buttonContainer.addEventListener('mouseleave', () => {
                buttonContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            });
            
            // Add to the document
            document.body.appendChild(buttonContainer);
            
        } catch (error) {
            console.error("Error creating offline toggle button:", error);
        }
    }
    
    /**
     * Update the visibility of offline geeks based on the toggle state
     */
    updateOfflineGeeksVisibility() {
        try {
            
            for (const user of this.users) {
                if (user && user.active === false) {
                    if (user.mesh) {
                        user.mesh.visible = this.showOfflineGeeks;
                    }
                }
            }
        } catch (error) {
            console.error("Error updating offline geeks visibility:", error);
        }
    }
    
    /**
     * Update camera position for a falling geek
     * @param {Object} geek The geek that is falling
     */
    updateCameraForFallingGeek(geek) {
        if (!geek || !geek.mesh) {
            console.error('updateCameraForFallingGeek: geek or geek.mesh is null or undefined');
            return;
        }
        
        // Get the geek's current position
        const position = geek.mesh.position.clone();
        
        // Calculate a position behind and above the geek
        // The offset is larger for falling geeks to get a better view
        const directionToCenter = position.clone().normalize();
        const offset = directionToCenter.multiplyScalar(400); // Larger offset for better view
        
        // Add a height offset to see the drop better
        const upVector = new THREE.Vector3(0, 1, 0);
        const heightOffset = upVector.clone().multiplyScalar(200);
        
        // Calculate the target camera position
        const targetPosition = position.clone().add(offset).add(heightOffset);
        
        // Set camera position directly for smooth tracking
        this.camera.position.copy(targetPosition);
        
        // Make the camera look at the geek
        this.camera.lookAt(position);
        
        // Update the controls target to the geek's position
        this.controls.target.copy(position);
    }
    
    /**
     * Return the camera to the sky view
     * @param {THREE.Vector3} [startPosition] Optional starting position for the camera animation
     */
    returnCameraToSky(startPosition) {
        
        if (!this.initialCameraPosition) {
            console.warn('Initial camera position not set, using default');
            this.initialCameraPosition = new THREE.Vector3(0, this.config.planetRadius + 4500, 0);
        }
        
        // Find the current user's geek
        const userGeek = this.findUserGeek();
        
        // Use the current camera position as the starting point if not provided
        const currentPosition = startPosition || this.camera.position.clone();
        
        // Calculate a smooth path from current position to sky position
        // We'll keep the x and z coordinates but smoothly transition the y coordinate
        const targetPosition = {
            x: this.initialCameraPosition.x,
            y: this.initialCameraPosition.y,
            z: this.initialCameraPosition.z
        };
        // Animate the camera to the initial position with a smooth path
        new TWEEN.Tween(currentPosition)
            .to(targetPosition, 2500) // Slightly longer duration for smoother effect
            .easing(TWEEN.Easing.Cubic.InOut)
            .onUpdate(() => {
                // Update the camera position during the animation
                this.camera.position.set(
                    currentPosition.x,
                    currentPosition.y,
                    currentPosition.z
                );
            })
            .start();
        
        // Rotate the planet to keep the user in view if we have a user geek and the planet
        if (userGeek && userGeek.mesh && this.planet && this.planet.mesh) {
            // Use the rotate method from the Planet class
            this.planet.rotate({
                targetPosition: userGeek.mesh.position.clone()
            });
        }
        
        // Set the controls target to the center of the planet
        this.controls.target.set(0, 0, 0);
        
        // Make the camera look at the center of the planet
        this.camera.lookAt(0, 0, 0);
    }
    
    // Update the dispose method to clean up planet resources
    dispose() {
        if (this.planet) {
            this.planet.dispose();
        }
        // ... rest of dispose code ...
    }

    update(timeOfDay) {
        // Update sky color
        const skyColor = this.skyGradient.get(timeOfDay);
        this.scene.background = skyColor;

        // Update planet colors
        if (this.planet) {
            this.planet.updateColor(timeOfDay);
        }
    }
}