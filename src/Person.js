/**
 * Person Class
 * Represents a person in the online world visualization
 */
import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';

/**
 * Represents a person in the 3D world
 */
export class Person {
    /**
     * Create a new Person
     * @param {Object} options - Configuration options
     * @param {number} options.size - Size of the person bubble
     * @param {number} options.color - Color of the person bubble (hex)
     * @param {Object} options.position - Position {x, y} in the scene
     * @param {THREE.Scene} options.scene - The Three.js scene to add to
     * @param {number} options.cameraY - Optional camera height
     */
    constructor(options) {
        this.size = options.size;
        this.color = options.color;
        
        // Handle both position formats (x,y) or (x,z)
        this.position = {
            x: options.position.x,
            y: 0, // In 3D, y is up/down
            z: options.position.z || options.position.y // Support both z and y for backward compatibility
        };
        
        this.scene = options.scene;
        this.cameraY = options.cameraY || 4000; // Get camera height or default to 4km
        
        // Animation properties
        this.floatSpeed = 0.5 + Math.random() * 0.5;
        this.floatAmplitude = 2 + Math.random() * 3;
        this.floatOffset = Math.random() * Math.PI * 2;
        this.originalY = this.position.y;
        this.isFloating = false; // Start with floating disabled until physics simulation completes
        
        // Physics properties - EXTREME SPEED with NO BOUNCING
        // Add small random horizontal velocity for more interesting falling motion
        this.velocity = { 
            x: (Math.random() - 0.5) * 50, // Increased random x velocity
            y: -200, // Much higher initial downward velocity
            z: (Math.random() - 0.5) * 50  // Increased random z velocity
        };
        this.acceleration = { x: 0, y: -500, z: 0 }; // Extreme gravity acceleration
        this.isSimulating = true; // Whether physics simulation is active
        this.groundLevel = 0; // Y-coordinate of the ground
        
        // Create the mesh
        this.mesh = this.createMesh();
        
        // Add to scene
        this.scene.add(this.mesh);
        
        // Start position high above the camera
        const startHeight = this.cameraY + 1000; // 1000 units above the camera (which is now at 4km)
        this.mesh.position.set(this.position.x, startHeight, this.position.z);
        
        // Set the initial position for physics simulation
        this.position.y = startHeight;
    }
    
    /**
     * Create the mesh for this person
     * @returns {THREE.Mesh} The created mesh
     */
    createMesh() {
        // Create a 3D cylinder for the person
        const height = this.size * 2;
        const geometry = new THREE.CylinderGeometry(this.size, this.size * 1.2, height, 16);
        
        // Create material with no specular highlights to prevent whitish appearance
        const material = new THREE.MeshLambertMaterial({
            color: this.color,
            transparent: true,
            opacity: 0.9,
            emissive: new THREE.Color(this.color).multiplyScalar(0.2), // Slight self-illumination
            emissiveIntensity: 0.2,
            reflectivity: 0,
            flatShading: false
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        
        // Adjust the position so the bottom of the cylinder is at y=0 when on ground
        mesh.position.y = height / 2;
        
        // Add a slight random rotation for more visual interest
        mesh.rotation.y = Math.random() * Math.PI * 2;
        
        return mesh;
    }
    
    /**
     * Start the floating animation after impact
     */
    animateEntry() {
        // Create a subtle scale animation for impact
        new TWEEN.Tween(this.mesh.scale)
            .to({ x: 1.2, y: 0.8, z: 1.2 }, 100)
            .easing(TWEEN.Easing.Cubic.Out)
            .onComplete(() => {
                // Return to normal scale
                new TWEEN.Tween(this.mesh.scale)
                    .to({ x: 1, y: 1, z: 1 }, 300)
                    .easing(TWEEN.Easing.Elastic.Out)
                    .start();
            })
            .start();
    }
    
    /**
     * Update physics simulation
     * @param {number} deltaTime Time since last update in seconds
     */
    updatePhysics(deltaTime) {
        if (!this.isSimulating) return;
        
        // Cap deltaTime to prevent issues with very large jumps
        const dt = Math.min(deltaTime, 0.05);
        
        // Apply acceleration to velocity
        this.velocity.x += this.acceleration.x * dt;
        this.velocity.y += this.acceleration.y * dt;
        this.velocity.z += this.acceleration.z * dt;
        
        // Apply terminal velocity limit for more realistic falling
        const terminalVelocity = -3000; // Extreme terminal velocity
        if (this.velocity.y < terminalVelocity) {
            this.velocity.y = terminalVelocity;
        }
        
        // Apply velocity to position
        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;
        this.position.z += this.velocity.z * dt;
        
        // Check for ground collision
        if (this.position.y < this.groundLevel + this.size) {
            // Stop at ground level - no bouncing
            this.position.y = this.groundLevel + this.size;
            
            // Create impact wave effect
            this.createImpactWave();
            
            // Stop simulating immediately
            this.isSimulating = false;
            this.isFloating = true;
            
            // Start floating animation
            this.animateEntry();
        }
        
        // Update mesh position
        this.mesh.position.set(this.position.x, this.position.y + this.size, this.position.z);
    }
    
    /**
     * Create an expanding wave effect at the impact point
     */
    createImpactWave() {
        // Calculate impact force based on velocity
        const impactForce = Math.min(Math.abs(this.velocity.y) / 100, 10);
        const maxRadius = this.size * 10 * impactForce; // Scale wave size with impact force
        
        // For performance with many people, only create the main wave and flash
        this.createWaveRing(0.1, 0.5, maxRadius, 800, 0.7); // Main wave
        
        // Add a flash of light at impact point
        const flashGeometry = new THREE.CircleGeometry(this.size * 2, 16);
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        flash.position.set(this.position.x, 0.2, this.position.z);
        flash.rotation.x = Math.PI / 2;
        this.scene.add(flash);
        
        // Animate the flash fading quickly
        new TWEEN.Tween(flashMaterial)
            .to({ opacity: 0 }, 200)
            .easing(TWEEN.Easing.Cubic.Out)
            .onComplete(() => {
                this.scene.remove(flash);
                flashMaterial.dispose();
                flashGeometry.dispose();
            })
            .start();
        
        // Only create dust particles for larger people (performance optimization)
        if (this.size > 25 && Math.random() < 0.3) {
            this.createDustParticles(5); // Reduced particle count
        }
    }
    
    /**
     * Create a single wave ring with the given parameters
     */
    createWaveRing(innerRadius, outerRadius, maxRadius, duration, opacity) {
        // Create a ring geometry for the wave
        const waveGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 16);
        const waveMaterial = new THREE.MeshBasicMaterial({
            color: 0xdddddd,
            transparent: true,
            opacity: opacity,
            side: THREE.DoubleSide
        });
        
        const wave = new THREE.Mesh(waveGeometry, waveMaterial);
        
        // Position the wave at ground level
        wave.position.set(this.position.x, 0.1, this.position.z); // Slightly above ground to avoid z-fighting
        wave.rotation.x = Math.PI / 2; // Rotate to be horizontal
        
        // Add to scene
        this.scene.add(wave);
        
        // Scale animation
        new TWEEN.Tween(wave.scale)
            .to({ x: maxRadius, y: maxRadius, z: 1 }, duration)
            .easing(TWEEN.Easing.Cubic.Out)
            .start();
        
        // Opacity animation
        new TWEEN.Tween(waveMaterial)
            .to({ opacity: 0 }, duration)
            .easing(TWEEN.Easing.Cubic.Out)
            .onComplete(() => {
                // Remove the wave from the scene when animation completes
                this.scene.remove(wave);
                waveMaterial.dispose();
                waveGeometry.dispose();
            })
            .start();
    }
    
    /**
     * Create dust particles that fly outward from the impact point
     * @param {number} particleCount Number of particles to create
     */
    createDustParticles(particleCount = 10) {
        const particleSize = this.size / 6;
        
        for (let i = 0; i < particleCount; i++) {
            // Create a small sphere for each particle
            const geometry = new THREE.SphereGeometry(particleSize * (0.5 + Math.random() * 0.5), 4, 4);
            const material = new THREE.MeshBasicMaterial({
                color: 0xcccccc,
                transparent: true,
                opacity: 0.5 + Math.random() * 0.3
            });
            
            const particle = new THREE.Mesh(geometry, material);
            
            // Position at impact point
            particle.position.set(
                this.position.x,
                0.1 + Math.random() * 0.3,
                this.position.z
            );
            
            this.scene.add(particle);
            
            // Random direction outward
            const angle = Math.random() * Math.PI * 2;
            const distance = this.size * (2 + Math.random() * 3);
            
            // Calculate target position
            const targetX = this.position.x + Math.cos(angle) * distance;
            const targetY = 0.5 + Math.random() * 1.5; // Lower height
            const targetZ = this.position.z + Math.sin(angle) * distance;
            
            // Animate position - flying outward and up, then down
            new TWEEN.Tween(particle.position)
                .to({ x: targetX, y: targetY, z: targetZ }, 200 + Math.random() * 100)
                .easing(TWEEN.Easing.Cubic.Out)
                .onComplete(() => {
                    // Fall back down
                    new TWEEN.Tween(particle.position)
                        .to({ y: 0 }, 100 + Math.random() * 150)
                        .easing(TWEEN.Easing.Cubic.In)
                        .start();
                })
                .start();
            
            // Animate opacity - fade out
            new TWEEN.Tween(material)
                .to({ opacity: 0 }, 300 + Math.random() * 200)
                .easing(TWEEN.Easing.Cubic.In)
                .delay(200)
                .onComplete(() => {
                    this.scene.remove(particle);
                    material.dispose();
                    geometry.dispose();
                })
                .start();
        }
    }
    
    /**
     * Drop the person to the ground
     */
    drop() {
        this.isSimulating = true;
        this.isFloating = false;
        this.velocity = { x: 0, y: 0, z: 0 };
    }
    
    /**
     * Animate the exit of this person
     * @param {Function} onComplete Callback when animation completes
     */
    animateExit(onComplete) {
        // Stop floating
        this.isFloating = false;
        
        // Animate moving up and fading out
        const startY = this.mesh.position.y;
        
        new TWEEN.Tween(this.mesh.position)
            .to({ y: startY + 100 }, 1000)
            .easing(TWEEN.Easing.Quadratic.Out)
            .start();
            
        new TWEEN.Tween(this.mesh.material)
            .to({ opacity: 0 }, 1000)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onComplete(() => {
                if (onComplete) onComplete();
            })
            .start();
    }
    
    /**
     * Update the floating animation
     * @param {number} time Current time in seconds
     */
    updateFloating(time) {
        if (!this.isFloating) return;
        
        // Calculate floating height based on sine wave
        const floatHeight = this.floatAmplitude * Math.sin(time * this.floatSpeed + this.floatOffset);
        
        // Apply to mesh position
        this.mesh.position.y = this.originalY + this.size + floatHeight;
        
        // Add a gentle rotation
        this.mesh.rotation.y += 0.01;
    }
    
    /**
     * Update this person
     * @param {number} deltaTime Time since last update in seconds
     * @param {number} time Current time in seconds
     */
    update(deltaTime, time) {
        if (this.isSimulating) {
            this.updatePhysics(deltaTime);
        } else if (this.isFloating) {
            this.updateFloating(time);
        }
    }
    
    /**
     * Get the current position
     * @returns {Object} Position with x, y, z coordinates
     */
    getPosition() {
        return {
            x: this.mesh.position.x,
            y: this.mesh.position.y,
            z: this.mesh.position.z
        };
    }
    
    /**
     * Check if this person collides with the given position
     * @param {Object} position Position to check
     * @param {number} otherRadius Radius of the other object
     * @returns {boolean} True if collision detected
     */
    collidesWithPosition(position, otherRadius) {
        const dx = this.mesh.position.x - position.x;
        const dz = this.mesh.position.z - position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        return distance < (this.size + otherRadius);
    }
    
    /**
     * Remove this person from the scene
     */
    remove() {
        if (this.mesh && this.scene) {
            this.scene.remove(this.mesh);
            
            // Dispose of geometry and material
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material) this.mesh.material.dispose();
        }
    }
} 