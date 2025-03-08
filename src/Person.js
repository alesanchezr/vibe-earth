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
     */
    constructor(options) {
        console.log("Creating new Person with options:", {
            size: options.size,
            color: options.color.toString(16),
            position: options.position
        });
        
        this.size = options.size;
        this.color = options.color;
        
        // Handle both position formats (x,y) or (x,z)
        this.position = {
            x: options.position.x,
            y: 0, // In 3D, y is up/down
            z: options.position.z || options.position.y // Support both z and y for backward compatibility
        };
        
        console.log("Normalized position:", this.position);
        
        this.scene = options.scene;
        
        // Animation properties
        this.floatSpeed = 0.5 + Math.random() * 0.5;
        this.floatAmplitude = 2 + Math.random() * 3;
        this.floatOffset = Math.random() * Math.PI * 2;
        this.originalY = this.position.y;
        this.isFloating = false; // Start with floating disabled until physics simulation completes
        
        // Physics properties
        this.velocity = { x: 0, y: 0, z: 0 };
        this.acceleration = { x: 0, y: -9.8, z: 0 }; // Gravity acceleration (m/s²)
        this.damping = 0.6; // Energy loss on bounce (0-1)
        this.isSimulating = true; // Whether physics simulation is active
        this.groundLevel = 0; // Y-coordinate of the ground
        
        // Create the mesh
        this.mesh = this.createMesh();
        console.log("Mesh created:", this.mesh);
        
        // Add to scene
        this.scene.add(this.mesh);
        console.log("Mesh added to scene");
        
        // Start position (in the air)
        this.mesh.position.set(this.position.x, this.position.y + 200, this.position.z);
        console.log("Initial mesh position set:", this.mesh.position);
    }
    
    /**
     * Create the mesh for this person
     * @returns {THREE.Mesh} The created mesh
     */
    createMesh() {
        console.log("Creating mesh with size:", this.size);
        // Create a 3D cylinder for the person
        const height = this.size * 2;
        const geometry = new THREE.CylinderGeometry(this.size, this.size, height, 16);
        
        // Create material with phong shading for 3D look
        const material = new THREE.MeshPhongMaterial({
            color: this.color,
            transparent: true,
            opacity: 0.8,
            shininess: 30
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        
        // Adjust the position so the bottom of the cylinder is at y=0 when on ground
        mesh.position.y = height / 2;
        
        console.log("Mesh created with geometry:", geometry);
        return mesh;
    }
    
    /**
     * Start the falling animation
     */
    animateEntry() {
        // Create a tween for smooth entry animation
        const targetPosition = {
            x: this.position.x,
            y: this.position.y,
            z: this.position.z
        };
        
        new TWEEN.Tween(this.mesh.position)
            .to({ x: targetPosition.x, y: targetPosition.y + this.size, z: targetPosition.z }, 1000)
            .easing(TWEEN.Easing.Bounce.Out)
            .onComplete(() => {
                this.isFloating = true;
                this.isSimulating = false;
            })
            .start();
    }
    
    /**
     * Update physics simulation
     * @param {number} deltaTime Time since last update in seconds
     */
    updatePhysics(deltaTime) {
        if (!this.isSimulating) return;
        
        // Apply acceleration to velocity
        this.velocity.x += this.acceleration.x * deltaTime;
        this.velocity.y += this.acceleration.y * deltaTime;
        this.velocity.z += this.acceleration.z * deltaTime;
        
        // Apply velocity to position
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
        this.position.z += this.velocity.z * deltaTime;
        
        // Check for ground collision
        if (this.position.y < this.groundLevel + this.size) {
            // Bounce
            this.position.y = this.groundLevel + this.size;
            this.velocity.y = -this.velocity.y * this.damping;
            
            // Apply damping to horizontal velocity too
            this.velocity.x *= this.damping;
            this.velocity.z *= this.damping;
            
            // Stop simulating if velocity is very low
            if (Math.abs(this.velocity.y) < 0.5 && 
                Math.abs(this.velocity.x) < 0.5 && 
                Math.abs(this.velocity.z) < 0.5) {
                this.isSimulating = false;
                this.isFloating = true;
                this.animateEntry();
            }
        }
        
        // Update mesh position
        this.mesh.position.set(this.position.x, this.position.y + this.size, this.position.z);
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