/**
 * Sky class for handling sky, sun, and day/night cycle
 */
import * as THREE from 'three';
import { ApiClient } from './api-client.js';

export class Sky {
    /**
     * Create a new sky
     * @param {Object} options Sky options
     * @param {THREE.Scene} options.scene The scene to add the sky to
     * @param {THREE.Renderer} options.renderer The renderer
     * @param {Object} options.colors The colors for the sky
     * @param {number} options.colors.day The day color of the sky
     * @param {number} options.colors.sunset The sunset/sunrise color of the sky
     * @param {number} options.colors.night The night color of the sky
     * @param {number} options.dayDuration The duration of a full day/night cycle in milliseconds
     * @param {string} options.starsTexturePath Path to the stars texture (optional)
     * @param {string} options.moonTexturePath Path to the moon texture (optional)
     */
    constructor(options) {
        this.scene = options.scene;
        this.renderer = options.renderer;
        this.colors = options.colors || {
            day: 0x0066cc,    // Strong saturated blue for better visibility
            sunset: 0xFFA07A,  // Light salmon
            night: 0x000033    // Dark blue
        };
        this.dayDuration = options.dayDuration || 30 * 60 * 1000; // 30 minutes by default
        this.starsTexturePath = options.starsTexturePath || 'assets/textures/stars.jpg';
        this.moonTexturePath = options.moonTexturePath || 'assets/textures/moon.jpg';
        
        // Initialize time of day
        this.timeOfDay = 0; // 0 to 1, where 0 is midnight, 0.5 is noon
        this.lastServerSync = 0; // Last time we synced with the server
        this.serverTimeOffset = 0; // Offset between client and server time
        this.isInitialized = false; // Flag to indicate if the sky is fully initialized
        
        // Create the sun, moon, and stars
        this.createSun();
        this.createMoon();
        this.createStars();
        
        // Create lights
        this.createLights();
        
        // Sync with server time
        this.apiClient = new ApiClient();
        this.syncWithServer().then(() => {
            // Now that we have the time, update everything
            this.isInitialized = true;
            this.update(0, THREE.Color.prototype.lerp);
        }).catch(error => {
            console.error('Failed to sync with server:', error);
            // Fall back to local time
            this.initTimeOfDay();
            this.isInitialized = true;
            this.update(0, THREE.Color.prototype.lerp);
        });
    }
    
    /**
     * Create the sun
     */
    createSun() {
        // Create the sun geometry
        const sunGeometry = new THREE.SphereGeometry(500, 32, 32);
        
        // Create the sun material
        const sunMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFFF00, // Yellow
            transparent: true, // Enable transparency for fade in/out
            opacity: 1.0
        });
        
        // Create the sun mesh
        this.sun = new THREE.Mesh(sunGeometry, sunMaterial);
        this.sun.position.set(10000, 0, 0); // Start at east position
        this.scene.add(this.sun);
    }
    
    /**
     * Create the moon
     */
    createMoon() {
        // Create the moon geometry (slightly smaller than the sun)
        const moonGeometry = new THREE.SphereGeometry(400, 32, 32);
        
        // Create a texture loader
        const textureLoader = new THREE.TextureLoader();
        
        // Create the moon material
        const moonMaterial = new THREE.MeshBasicMaterial({
            color: 0xDDDDDD, // Slightly off-white
            emissive: 0x222222, // Slight glow
            transparent: true, // Enable transparency for fade in/out
            opacity: 0.0 // Start invisible
        });
        
        // Try to load a moon texture if available
        const moonTexturePath = this.moonTexturePath || 'assets/textures/moon.jpg';
        textureLoader.load(moonTexturePath, 
            // Success callback
            (texture) => {
                moonMaterial.map = texture;
                moonMaterial.needsUpdate = true;
            },
            // Progress callback
            undefined,
            // Error callback
            (error) => {
                console.log('Moon texture not found, using basic material', error);
            }
        );
        
        // Create the moon mesh
        this.moon = new THREE.Mesh(moonGeometry, moonMaterial);
        
        // Position the moon opposite to the sun (180 degrees offset)
        this.moon.position.set(-10000, 0, 0);
        this.scene.add(this.moon);
    }
    
    /**
     * Create stars using a texture-based skybox
     */
    createStars() {
        // Create a texture loader
        const textureLoader = new THREE.TextureLoader();
        
        // Load the stars texture
        textureLoader.load(this.starsTexturePath, (texture) => {
            // Create a large sphere geometry for the night sky
            const skyRadius = 30000;
            const skyGeometry = new THREE.SphereGeometry(skyRadius, 32, 32);
            
            // The sphere needs to be rendered from the inside, so we need to flip the normals
            skyGeometry.scale(-1, 1, 1);
            
            // Create a material with the stars texture
            const skyMaterial = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.BackSide, // Render the inside of the sphere
                transparent: true,
                opacity: 0 // Start with invisible stars
            });
            
            // Create the sky mesh
            this.stars = new THREE.Mesh(skyGeometry, skyMaterial);
            this.scene.add(this.stars);
        }, undefined, (error) => {
            console.error('Error loading stars texture:', error);
            
            // Fallback to the original implementation if texture loading fails
            this.createStarsFallback();
        });
    }
    
    /**
     * Fallback method to create stars programmatically if texture loading fails
     */
    createStarsFallback() {
        const starsGeometry = new THREE.BufferGeometry();
        const starsMaterial = new THREE.PointsMaterial({
            color: 0xFFFFFF,
            size: 1.5,
            sizeAttenuation: false
        });
        
        const starsCount = 5000;
        const starsPositions = new Float32Array(starsCount * 3);
        
        for (let i = 0; i < starsCount; i++) {
            const i3 = i * 3;
            // Create stars in a large sphere around the scene
            const radius = 30000;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            starsPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
            starsPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            starsPositions[i3 + 2] = radius * Math.cos(phi);
        }
        
        starsGeometry.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3));
        this.stars = new THREE.Points(starsGeometry, starsMaterial);
        this.scene.add(this.stars);
        
        // Initially hide stars (they'll be shown at night)
        this.stars.visible = false;
    }
    
    /**
     * Create lights
     */
    createLights() {
        // Add ambient light
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(this.ambientLight);
        
        // Add directional light (sun)
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        this.directionalLight.position.set(10000, 5000, 0); // Start at a visible position
        this.directionalLight.lookAt(0, 0, 0);
        
        // Add shadow support
        this.directionalLight.castShadow = true;
        this.directionalLight.shadow.mapSize.width = 2048;
        this.directionalLight.shadow.mapSize.height = 2048;
        this.directionalLight.shadow.camera.near = 500;
        this.directionalLight.shadow.camera.far = 15000;
        
        this.scene.add(this.directionalLight);
        
        // Add a subtle hemisphere light for better planet illumination
        this.hemisphereLight = new THREE.HemisphereLight(0xf0f8ff, 0x080820, 0.3);
        this.scene.add(this.hemisphereLight);
        
        console.log("Lights created:", {
            ambient: this.ambientLight,
            directional: this.directionalLight,
            hemisphere: this.hemisphereLight
        });
    }
    
    /**
     * Initialize time of day based on user's local time (fallback when server sync fails)
     */
    initTimeOfDay() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();
        
        // Convert to a value between 0 and 1
        this.timeOfDay = (hours * 3600 + minutes * 60 + seconds) / 86400;
        
        console.log(`Using local time as fallback: ${this.timeOfDay.toFixed(2)}`);
    }
    
    /**
     * Sync the time of day with the server
     * @returns {Promise} A promise that resolves when the sync is complete
     */
    async syncWithServer() {
        try {
            const data = await this.apiClient.getStats();
            
            if (data && data.day_night_cycle) {
                const { duration, current } = data.day_night_cycle;
                
                // Update day duration if provided by server
                if (duration) {
                    this.dayDuration = duration;
                }
                
                // Set the time of day from server
                if (current !== undefined) {
                    this.timeOfDay = current;
                    
                    // Calculate server time offset for future updates
                    this.lastServerSync = Date.now();
                    this.serverTimeOffset = current;
                    
                    console.log(`Synced with server time: ${current.toFixed(2)}, duration: ${duration}ms`);
                    
                    // Expose the control methods to the global scope for inspector console access
                    if (typeof window !== 'undefined' && !window.setTimeOfDay) {
                        window.setTimeOfDay = this.setTimeOfDay.bind(this);
                        window.getTimeOfDay = this.getTimeOfDay.bind(this);
                        window.toggleDayNight = this.toggleDayNight.bind(this);
                        window.syncWithServer = this.syncWithServer.bind(this);
                        console.log('Sky controls available in console:');
                        console.log('  setTimeOfDay(value) - Change time (0-1)');
                        console.log('  getTimeOfDay()      - Get current time info');
                        console.log('  toggleDayNight()    - Toggle between day and night');
                        console.log('  syncWithServer()    - Sync time with server');
                    }
                    
                    return data;
                }
            }
            
            console.warn('Invalid server data format, using local time');
            this.initTimeOfDay();
            throw new Error('Invalid server data format');
        } catch (error) {
            console.error('Failed to sync with server time:', error);
            this.initTimeOfDay();
            throw error;
        }
    }
    
    /**
     * Manually set the time of day
     * @param {number} value Time of day value between 0 and 1 (0 = midnight, 0.5 = noon)
     * @returns {Object} Current sky state information
     */
    setTimeOfDay(value) {
        // Ensure value is between 0 and 1
        this.timeOfDay = Math.max(0, Math.min(1, value));
        
        // Update the scene immediately
        this.update(0);
        
        // Return information about the current state for console feedback
        const timeInfo = this.getTimeInfo();
        console.log(`Time set to: ${timeInfo.label} (${timeInfo.formattedTime})`);
        
        return {
            timeOfDay: this.timeOfDay,
            ...timeInfo,
            sunPosition: this.sun ? { ...this.sun.position } : null,
            starsVisible: this.stars ? this.stars.visible : false,
            starsOpacity: this.stars && this.stars.isMesh ? this.stars.material.opacity : 'N/A'
        };
    }
    
    /**
     * Get formatted time information based on current timeOfDay
     * @returns {Object} Time information
     */
    getTimeInfo() {
        // Convert timeOfDay to hours and minutes
        const totalSeconds = this.timeOfDay * 86400;
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        
        // Format time as HH:MM
        const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        
        // Determine time label
        let label;
        if (this.timeOfDay < 0.25) {
            label = 'Night';
        } else if (this.timeOfDay < 0.3) {
            label = 'Sunrise';
        } else if (this.timeOfDay < 0.7) {
            label = 'Day';
        } else if (this.timeOfDay < 0.8) {
            label = 'Sunset';
        } else {
            label = 'Night';
        }
        
        return { formattedTime, label };
    }
    
    /**
     * Update the sky based on time of day
     * @param {number} deltaTime Time since last update in seconds
     * @param {Function} lerpColor Color interpolation function
     * @param {Function} updatePlanetColor Function to update the planet color
     */
    update(deltaTime, lerpColor, updatePlanetColor) {
        // Skip updates until initialization is complete
        if (!this.isInitialized) {
            return;
        }
        
        // If we've synced with the server, use the calculated time
        // Otherwise, update time of day based on deltaTime
        if (this.lastServerSync > 0) {
            this.timeOfDay = this.calculateCurrentTime();
        } else {
            // Legacy behavior: update time based on deltaTime
            const timeElapsed = deltaTime / this.dayDuration;
            this.timeOfDay = (this.timeOfDay + timeElapsed) % 1;
        }
        
        // Calculate sun and moon position
        const sunAngle = this.timeOfDay * Math.PI * 2;
        const moonAngle = (this.timeOfDay + 0.5) % 1 * Math.PI * 2; // Moon is opposite to the sun
        
        const sunX = Math.cos(sunAngle) * 10000;
        const sunY = Math.sin(sunAngle) * 10000;
        const sunZ = 0;
        
        const moonX = Math.cos(moonAngle) * 10000;
        const moonY = Math.sin(moonAngle) * 10000;
        const moonZ = 0;
        
        // Update sun position and visibility
        if (this.sun) {
            this.sun.position.set(sunX, sunY, sunZ);
            
            // Sun is visible during day and transitions (not at night)
            // Fully visible from 0.3 to 0.7, fades in/out during transitions
            let sunVisibility = 1;
            
            if (this.timeOfDay < 0.2) {
                // Late night to dawn: sun is hidden
                sunVisibility = 0;
            } else if (this.timeOfDay < 0.3) {
                // Dawn to morning: sun fades in
                sunVisibility = (this.timeOfDay - 0.2) / 0.1;
            } else if (this.timeOfDay > 0.8) {
                // Night: sun is hidden
                sunVisibility = 0;
            } else if (this.timeOfDay > 0.7) {
                // Evening to dusk: sun fades out
                sunVisibility = 1 - (this.timeOfDay - 0.7) / 0.1;
            }
            
            // Apply visibility (using opacity for smoother transition)
            if (sunVisibility <= 0) {
                this.sun.visible = false;
            } else {
                this.sun.visible = true;
                if (this.sun.material) {
                    const originalColor = this.sun.material.color.getHex();
                    this.sun.material.opacity = sunVisibility;
                    
                    // Make sun more reddish during sunrise/sunset
                    if (this.timeOfDay > 0.2 && this.timeOfDay < 0.3) {
                        // Sunrise: more reddish
                        this.sun.material.color.setHex(0xFF7700);
                    } else if (this.timeOfDay > 0.7 && this.timeOfDay < 0.8) {
                        // Sunset: more reddish
                        this.sun.material.color.setHex(0xFF7700);
                    } else {
                        // Normal day: yellow
                        this.sun.material.color.setHex(0xFFFF00);
                    }
                }
            }
        }
        
        // Update moon position and visibility
        if (this.moon) {
            this.moon.position.set(moonX, moonY, moonZ);
            
            // Moon is visible during night and transitions (not during day)
            // Fully visible from 0.0 to 0.2 and 0.8 to 1.0, fades in/out during transitions
            let moonVisibility = 0;
            
            if (this.timeOfDay < 0.2) {
                // Night to dawn: moon is fully visible
                moonVisibility = 1;
            } else if (this.timeOfDay < 0.3) {
                // Dawn to morning: moon fades out
                moonVisibility = 1 - (this.timeOfDay - 0.2) / 0.1;
            } else if (this.timeOfDay > 0.8) {
                // Evening to night: moon is fully visible
                moonVisibility = 1;
            } else if (this.timeOfDay > 0.7) {
                // Afternoon to evening: moon fades in
                moonVisibility = (this.timeOfDay - 0.7) / 0.1;
            }
            
            // Apply visibility
            if (moonVisibility <= 0) {
                this.moon.visible = false;
            } else {
                this.moon.visible = true;
                if (this.moon.material) {
                    this.moon.material.opacity = moonVisibility;
                }
            }
        }
        
        // Update directional light position to match the visible celestial body
        if (this.directionalLight) {
            // During day, light comes from sun; during night, a dimmer light comes from moon
            if (this.timeOfDay >= 0.3 && this.timeOfDay <= 0.7) {
                // Day: light from sun
                this.directionalLight.position.copy(this.sun.position);
                this.directionalLight.intensity = 1.0;
            } else if (this.timeOfDay < 0.2 || this.timeOfDay > 0.8) {
                // Night: dimmer light from moon
                this.directionalLight.position.copy(this.moon.position);
                this.directionalLight.intensity = 0.3;
            } else {
                // Transition: interpolate between sun and moon
                if (this.timeOfDay < 0.3) {
                    // Dawn to morning
                    const t = (this.timeOfDay - 0.2) / 0.1;
                    this.directionalLight.position.lerpVectors(this.moon.position, this.sun.position, t);
                    this.directionalLight.intensity = 0.3 + 0.7 * t;
                } else {
                    // Evening to dusk
                    const t = (this.timeOfDay - 0.7) / 0.1;
                    this.directionalLight.position.lerpVectors(this.sun.position, this.moon.position, t);
                    this.directionalLight.intensity = 1.0 - 0.7 * t;
                }
            }
            
            this.directionalLight.lookAt(0, 0, 0);
        }
        
        // Update sky color and lighting
        this.updateSkyColor(lerpColor);
        
        // Update planet color if callback provided
        if (updatePlanetColor) {
            updatePlanetColor(this.timeOfDay);
        }
        
        // Handle stars visibility based on time of day
        if (this.stars) {
            if (this.stars.isMesh) {
                // For texture-based stars, adjust opacity
                const isNight = this.timeOfDay < 0.2 || this.timeOfDay > 0.8;
                
                // Calculate opacity based on time of day
                let opacity = 0;
                
                if (isNight) {
                    // Full night (midnight): opacity = 1
                    // Transition periods: fade in/out
                    if (this.timeOfDay < 0.2) {
                        // Morning transition (fade out)
                        opacity = 1 - (this.timeOfDay / 0.2);
                    } else {
                        // Evening transition (fade in)
                        opacity = (this.timeOfDay - 0.8) / 0.2;
                    }
                }
                
                // Apply opacity
                this.stars.material.opacity = Math.max(0, Math.min(1, opacity));
                
                // Keep the mesh visible if there's any opacity
                this.stars.visible = opacity > 0;
            } else {
                // For point-based stars, just toggle visibility
                this.stars.visible = this.timeOfDay < 0.2 || this.timeOfDay > 0.8;
            }
        }
    }
    
    /**
     * Update the sky color based on time of day
     * @param {Function} lerpColor Color interpolation function
     */
    updateSkyColor(lerpColor) {
        // If lerpColor is not provided, use a simple fallback
        const lerp = lerpColor || ((color1, color2, t) => {
            // Simple hex color lerp fallback
            const c1 = new THREE.Color(color1);
            const c2 = new THREE.Color(color2);
            const result = new THREE.Color().copy(c1).lerp(c2, t);
            return result.getHex();
        });
        
        let skyColor;
        let lightIntensity;
        
        if (this.timeOfDay > 0.25 && this.timeOfDay < 0.75) {
            // Daytime
            const dayProgress = (this.timeOfDay - 0.25) / 0.5; // 0 to 1 during day
            
            if (dayProgress < 0.1) {
                // Sunrise
                const t = dayProgress / 0.1;
                skyColor = lerp(this.colors.sunset, this.colors.day, t);
                lightIntensity = 0.3 + t * 0.7;
            } else if (dayProgress > 0.9) {
                // Sunset
                const t = (dayProgress - 0.9) / 0.1;
                skyColor = lerp(this.colors.day, this.colors.sunset, t);
                lightIntensity = 1.0 - t * 0.7;
            } else {
                // Full day
                skyColor = this.colors.day;
                lightIntensity = 1.0;
            }
        } else {
            // Nighttime
            const nightProgress = (this.timeOfDay < 0.25) ? 
                this.timeOfDay / 0.25 : 
                (1 - this.timeOfDay) / 0.25;
            
            if (nightProgress < 0.2) {
                // Transition to/from night
                const t = nightProgress / 0.2;
                skyColor = lerp(this.colors.night, this.colors.sunset, t);
                lightIntensity = 0.3 * t;
            } else {
                // Full night
                skyColor = this.colors.night;
                lightIntensity = 0.3;
            }
        }
        
        // Update scene background and renderer clear color
        if (this.scene.background) {
            this.scene.background.setHex(skyColor);
        } else {
            this.scene.background = new THREE.Color(skyColor);
        }
        
        if (this.renderer) {
            this.renderer.setClearColor(skyColor, 1);
        }
        
        // Update light intensity
        if (this.directionalLight) {
            this.directionalLight.intensity = Math.max(0.5, lightIntensity);
        }
        
        if (this.ambientLight) {
            this.ambientLight.intensity = Math.max(0.3, 0.2 + lightIntensity * 0.3);
        }
        
    }
    
    /**
     * Get the current time of day
     * @returns {Object} Time of day information
     */
    getTimeOfDay() {
        const timeInfo = this.getTimeInfo();
        
        return {
            value: this.timeOfDay,
            ...timeInfo,
            sunPosition: this.sun ? { ...this.sun.position } : null,
            starsVisible: this.stars ? this.stars.visible : false,
            starsOpacity: this.stars && this.stars.isMesh ? this.stars.material.opacity : 'N/A'
        };
    }
    
    /**
     * Dispose of the sky resources
     */
    dispose() {
        // Dispose of sun resources
        if (this.sun) {
            if (this.sun.geometry) this.sun.geometry.dispose();
            if (this.sun.material) this.sun.material.dispose();
            this.scene.remove(this.sun);
        }
        
        // Dispose of moon resources
        if (this.moon) {
            if (this.moon.geometry) this.moon.geometry.dispose();
            if (this.moon.material) {
                if (this.moon.material.map) this.moon.material.map.dispose();
                this.moon.material.dispose();
            }
            this.scene.remove(this.moon);
        }
        
        // Dispose of stars resources
        if (this.stars) {
            if (this.stars.geometry) this.stars.geometry.dispose();
            if (this.stars.material) {
                // Dispose of the texture if it exists
                if (this.stars.material.map) {
                    this.stars.material.map.dispose();
                }
                this.stars.material.dispose();
            }
            this.scene.remove(this.stars);
        }
        
        // Remove lights
        if (this.ambientLight) this.scene.remove(this.ambientLight);
        if (this.directionalLight) this.scene.remove(this.directionalLight);
        if (this.hemisphereLight) this.scene.remove(this.hemisphereLight);
    }
    
    /**
     * Toggle between day and night
     * @returns {Object} Current sky state information
     */
    toggleDayNight() {
        // If it's currently day (between 0.3 and 0.7), set to night (0)
        // If it's currently night or transition, set to day (0.5)
        const isDay = this.timeOfDay >= 0.3 && this.timeOfDay <= 0.7;
        
        if (isDay) {
            return this.setTimeOfDay(0); // Set to midnight
        } else {
            return this.setTimeOfDay(0.5); // Set to noon
        }
    }
    
    /**
     * Calculate the current time of day based on server sync and elapsed time
     * @returns {number} Current time of day (0-1)
     */
    calculateCurrentTime() {
        // If we haven't synced with the server yet, use the current timeOfDay
        if (this.lastServerSync === 0) {
            return this.timeOfDay;
        }
        
        // Calculate elapsed time since last server sync
        const elapsedSinceSync = Date.now() - this.lastServerSync;
        
        // Calculate how much the time of day has advanced
        const timeAdvance = (elapsedSinceSync / this.dayDuration) % 1;
        
        // Calculate the new time of day
        return (this.serverTimeOffset + timeAdvance) % 1;
    }
} 