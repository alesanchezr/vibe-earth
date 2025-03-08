/**
 * Planet class for handling planet rendering and properties
 */
import * as THREE from 'three';

export class Planet {
    /**
     * Create a new planet
     * @param {Object} options Planet options
     * @param {THREE.Scene} options.scene The scene to add the planet to
     * @param {number} options.radius The radius of the planet
     * @param {Object} options.colors The colors for the planet
     * @param {number} options.colors.day The day color of the planet
     * @param {number} options.colors.night The night color of the planet
     */
    constructor(options) {
        this.scene = options.scene;
        this.radius = options.radius || 3000;
        this.colors = options.colors || {
            day: 0xA5D6A7,   // Green
            night: 0x2E7D32   // Dark green
        };
        
        // Create the planet mesh
        this.createMesh();
        
        // Add to scene
        this.scene.add(this.mesh);
    }
    
    /**
     * Create the planet mesh
     */
    createMesh() {
        // Create the planet geometry
        const geometry = new THREE.SphereGeometry(this.radius, 64, 64);
        
        // Create the planet material
        this.material = new THREE.MeshPhongMaterial({
            color: this.colors.day,
            emissive: 0x103810, // Very slight green glow
            emissiveIntensity: 0.2,
            shininess: 30,
            flatShading: false,
            transparent: false, // No transparency
            opacity: 1.0, // Fully opaque
            side: THREE.FrontSide, // Only render front side
            depthWrite: true, // Ensure depth is written
            depthTest: true // Ensure depth testing is enabled
        });
        
        // Create the mesh
        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.position.set(0, 0, 0);
        
        // Add the mesh to the scene
        this.scene.add(this.mesh);
        
        console.log("Planet mesh created:", this.mesh);
    }
    
    /**
     * Update the planet color based on time of day
     * @param {number} timeOfDay Time of day (0-1, where 0 is midnight, 0.5 is noon)
     * @param {Function} lerpColor Color interpolation function
     */
    updateColor(timeOfDay, lerpColor) {
        let color;
        
        if (timeOfDay > 0.25 && timeOfDay < 0.75) {
            // Daytime
            const dayProgress = (timeOfDay - 0.25) / 0.5; // 0 to 1 during day
            
            if (dayProgress < 0.1) {
                // Sunrise
                const t = dayProgress / 0.1;
                color = lerpColor(this.colors.night, this.colors.day, t);
            } else if (dayProgress > 0.9) {
                // Sunset
                const t = (dayProgress - 0.9) / 0.1;
                color = lerpColor(this.colors.day, this.colors.night, t);
            } else {
                // Full day
                color = this.colors.day;
            }
        } else {
            // Nighttime
            color = this.colors.night;
        }
        
        // Update the material color
        this.material.color.setHex(color);
    }
    
    /**
     * Get the position on the planet surface at the given spherical coordinates
     * @param {number} theta Longitude (0 to 2π)
     * @param {number} phi Latitude (0 to π)
     * @returns {THREE.Vector3} Position on the planet surface
     */
    getPositionAt(theta, phi) {
        const x = this.radius * Math.sin(phi) * Math.cos(theta);
        const y = this.radius * Math.sin(phi) * Math.sin(theta);
        const z = this.radius * Math.cos(phi);
        
        return new THREE.Vector3(x, y, z);
    }
    
    /**
     * Get a random position on the planet surface
     * @returns {THREE.Vector3} Random position on the planet surface
     */
    getRandomPosition() {
        const theta = Math.random() * Math.PI * 2; // Longitude (0 to 2π)
        const phi = Math.acos(2 * Math.random() - 1); // Latitude (0 to π)
        
        return this.getPositionAt(theta, phi);
    }
    
    /**
     * Calculate the normal vector at the given position on the planet
     * @param {THREE.Vector3} position Position on the planet
     * @returns {THREE.Vector3} Normal vector
     */
    getNormalAt(position) {
        // For a sphere, the normal is simply the normalized position vector from the center
        return position.clone().normalize();
    }
    
    /**
     * Check if a position is on the planet surface
     * @param {THREE.Vector3} position Position to check
     * @param {number} tolerance Distance tolerance
     * @returns {boolean} True if the position is on the planet surface
     */
    isOnSurface(position, tolerance = 0.1) {
        const distance = position.length();
        return Math.abs(distance - this.radius) <= tolerance;
    }
    
    /**
     * Dispose of the planet resources
     */
    dispose() {
        if (this.mesh) {
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material) this.mesh.material.dispose();
            this.scene.remove(this.mesh);
        }
    }
} 