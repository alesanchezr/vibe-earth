/**
 * Geek Class
 * Represents a geek in the online world visualization
 */
import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';

/**
 * Represents a geek in the 3D world as a cute water drop
 */
export class Geek {
    /**
     * Create a new Geek
     * @param {Object} options - Configuration options
     * @param {number} [options.id] - Server-side ID of the geek (if from server)
     * @param {number} options.size - Size of the geek bubble
     * @param {number} options.color - Color of the geek bubble (hex)
     * @param {Object} options.position - Position {x, y, z} on the planet surface
     * @param {THREE.Scene} options.scene - The Three.js scene to add to
     * @param {number} options.cameraY - Optional camera height
     * @param {number} options.planetRadius - Radius of the planet
     */
    constructor(options) {
        console.log("Creating geek with options:", options);
        
        this.id = options.id; // May be undefined for locally created geeks
        this.size = options.size;
        
        // Debug the color value
        console.log("Color value:", options.color, "Type:", typeof options.color);
        
        // Convert color to THREE.Color object immediately
        try {
            // Handle specific problematic color values
            if (options.color === 4359668 || options.color === 3450963 || options.color === 10233776) {
                // These specific color values are causing issues, map them to known good colors
                const colorMap = {
                    4359668: "#428A4F",  // Green
                    3450963: "#34A853",  // Green
                    10233776: "#9C27B0"  // Purple
                };
                console.log(`Handling problematic color value ${options.color}`);
                this.color = new THREE.Color(colorMap[options.color]);
            }
            // Handle numeric color values
            else if (typeof options.color === 'number') {
                // Convert number to hex string (e.g., 0xFF0000 to "#FF0000")
                const hexString = '#' + options.color.toString(16).padStart(6, '0');
                console.log("Converted to hex string:", hexString);
                this.color = new THREE.Color(hexString);
            }
            // Handle existing THREE.Color objects
            else if (options.color instanceof THREE.Color) {
                console.log("Already a THREE.Color");
                this.color = options.color;
            }
            // Handle other formats (strings, etc.)
            else {
                console.log("Creating new THREE.Color from:", options.color);
                this.color = new THREE.Color(options.color);
            }
        } catch (error) {
            console.error("Error creating THREE.Color:", error);
            // Fallback to a default color
            this.color = new THREE.Color("#4285F4"); // Default to blue
        }
        
        this.planetRadius = options.planetRadius || 3000;
        
        // Store the position on the planet surface
        this.position = {
            x: options.position.x,
            y: options.position.y,
            z: options.position.z
        };
        
        // Calculate the normal vector at this position (for orientation)
        this.normal = this.calculateNormal();
        
        this.scene = options.scene;
        this.cameraY = options.cameraY || 12000;
        
        // Animation properties
        this.floatSpeed = 0.5 + Math.random() * 0.5;
        this.floatAmplitude = 5 + Math.random() * 5;
        this.floatOffset = Math.random() * Math.PI * 2;
        this.isFloating = false; // Start with floating disabled until physics simulation completes
        
        // Physics properties for falling onto the planet
        // Calculate a random starting position high above the planet
        const startDirection = new THREE.Vector3(
            Math.random() - 0.5,
            Math.random() - 0.5,
            Math.random() - 0.5
        ).normalize();
        
        const startDistance = this.planetRadius + 3000; // Start 3000 units above the planet (increased)
        const startPosition = startDirection.multiplyScalar(startDistance);
        
        // Set initial position for physics simulation
        this.position = {
            x: startPosition.x,
            y: startPosition.y,
            z: startPosition.z
        };
        
        // Calculate velocity towards the planet center
        const toCenter = new THREE.Vector3(0, 0, 0).sub(startPosition).normalize();
        const speed = 400 + Math.random() * 200; // Increased speed for larger planet
        
        this.velocity = {
            x: toCenter.x * speed,
            y: toCenter.y * speed,
            z: toCenter.z * speed
        };
        
        this.isSimulating = true; // Whether physics simulation is active
        
        // Create the mesh
        this.mesh = this.createMesh();
        console.log("Geek mesh created:", this.mesh);
        
        // Add to scene
        this.scene.add(this.mesh);
        
        // Set the initial position
        this.mesh.position.set(this.position.x, this.position.y, this.position.z);
        
        // Orient the mesh to face away from the planet center
        this.orientToSurface();
        
        // Create comet tail effect
        this.cometTail = this.createCometTail();
        
        // Initialize timer for particle emission
        this.lastParticleTime = 0;
        this.particleEmissionRate = 0.2; // Particles per second
        
        console.log("Geek created successfully with ID:", this.id);
    }
    
    /**
     * Calculate the normal vector at the current position on the planet
     * @returns {THREE.Vector3} Normal vector
     */
    calculateNormal() {
        // For a sphere, the normal is simply the normalized position vector from the center
        const normal = new THREE.Vector3(
            this.position.x,
            this.position.y,
            this.position.z
        ).normalize();
        
        return normal;
    }
    
    /**
     * Orient the mesh to face away from the planet center
     */
    orientToSurface() {
        if (!this.mesh) return;
        
        // Calculate the normal at the current position
        this.normal = this.calculateNormal();
        
        // Create a quaternion that rotates from the default up vector (0,1,0)
        // to the normal vector
        const upVector = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(upVector, this.normal);
        
        // Apply the rotation to the mesh
        this.mesh.quaternion.copy(quaternion);
    }
    
    /**
     * Create the mesh for this geek as a cute water drop with a face
     * @returns {THREE.Group} The created mesh group
     */
    createMesh() {
        // Create a group to hold all the parts of the water drop
        const group = new THREE.Group();
        
        // Create the main water drop body (teardrop shape)
        const dropGeometry = new THREE.SphereGeometry(this.size, 16, 16);
        
        // Slightly squash the sphere to make it more drop-like
        dropGeometry.scale(1, 1.2, 1);
        
        // Create material with no specular highlights to prevent whitish appearance
        const dropMaterial = new THREE.MeshLambertMaterial({
            color: this.color,
            transparent: true,
            opacity: 0.9,
            emissive: this.color.clone().multiplyScalar(0.2), // Slight self-illumination
            emissiveIntensity: 0.2,
            reflectivity: 0,
            flatShading: false
        });
        
        const dropBody = new THREE.Mesh(dropGeometry, dropMaterial);
        
        // Add a slight taper at the top for a water drop look
        dropBody.scale.set(1, 1, 1);
        dropBody.position.y = this.size * 0.2; // Raise slightly to account for the taper
        
        // Add the body to the group
        group.add(dropBody);
        
        // Create the face (only visible when zoomed in)
        this.createFace(group);
        
        // Position the entire group so the bottom of the drop is at y=0
        group.position.y = this.size;
        
        // Add a slight random rotation for more visual interest
        group.rotation.y = Math.random() * Math.PI * 2;
        
        return group;
    }
    
    /**
     * Create a cute face for the water drop
     * @param {THREE.Group} group The group to add the face to
     */
    createFace(group) {
        // Create eyes (white spheres with black pupils)
        const eyeSize = this.size * 0.2;
        const eyeSpacing = this.size * 0.3;
        const eyeHeight = this.size * 0.3;
        const eyeForward = this.size * 0.7; // Position eyes toward the front
        
        // Eye whites
        const eyeGeometry = new THREE.SphereGeometry(eyeSize, 8, 8);
        const eyeMaterial = new THREE.MeshLambertMaterial({
            color: new THREE.Color(0xffffff),
            transparent: false,
            emissive: new THREE.Color(0x444444),
            emissiveIntensity: 0.1
        });
        
        // Left eye
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-eyeSpacing, eyeHeight, eyeForward);
        group.add(leftEye);
        
        // Right eye
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(eyeSpacing, eyeHeight, eyeForward);
        group.add(rightEye);
        
        // Pupils (small black spheres)
        const pupilSize = eyeSize * 0.5;
        const pupilGeometry = new THREE.SphereGeometry(pupilSize, 6, 6);
        const pupilMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x000000) });
        
        // Left pupil
        const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
        leftPupil.position.set(0, 0, eyeSize * 0.6);
        leftEye.add(leftPupil);
        
        // Right pupil
        const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
        rightPupil.position.set(0, 0, eyeSize * 0.6);
        rightEye.add(rightPupil);
        
        // Create a happy mouth (curved line)
        const mouthWidth = this.size * 0.5;
        const mouthHeight = this.size * 0.1;
        const mouthY = eyeHeight - this.size * 0.4;
        
        // Create a smile using a curved tube geometry
        const curve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(-mouthWidth/2, mouthY, eyeForward),
            new THREE.Vector3(0, mouthY - mouthHeight, eyeForward + mouthHeight * 0.5),
            new THREE.Vector3(mouthWidth/2, mouthY, eyeForward)
        );
        
        const mouthGeometry = new THREE.TubeGeometry(curve, 10, mouthHeight * 0.3, 8, false);
        const mouthMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x000000) });
        const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
        
        group.add(mouth);
        
        // Randomly add rosy cheeks to some water drops
        if (Math.random() > 0.5) {
            const cheekSize = this.size * 0.15;
            const cheekGeometry = new THREE.SphereGeometry(cheekSize, 8, 8);
            const cheekMaterial = new THREE.MeshLambertMaterial({
                color: new THREE.Color(0xff9999),
                transparent: true,
                opacity: 0.6
            });
            
            // Left cheek
            const leftCheek = new THREE.Mesh(cheekGeometry, cheekMaterial);
            leftCheek.position.set(-eyeSpacing * 1.2, mouthY + cheekSize, eyeForward - cheekSize * 0.5);
            group.add(leftCheek);
            
            // Right cheek
            const rightCheek = new THREE.Mesh(cheekGeometry, cheekMaterial);
            rightCheek.position.set(eyeSpacing * 1.2, mouthY + cheekSize, eyeForward - cheekSize * 0.5);
            group.add(rightCheek);
        }
    }
    
    /**
     * Update physics simulation for falling onto the planet
     * @param {number} deltaTime Time since last update in seconds
     */
    updatePhysics(deltaTime) {
        if (!this.isSimulating) return;
        
        // Calculate gravitational force towards the planet center
        const position = new THREE.Vector3(this.position.x, this.position.y, this.position.z);
        const distanceToCenter = position.length();
        
        // Direction towards planet center
        const toCenter = position.clone().negate().normalize();
        
        // Gravitational acceleration (stronger when closer to the planet)
        const gravity = 1500; // Increased gravity strength for larger planet
        const gravityForce = gravity * (this.planetRadius / distanceToCenter);
        
        // Apply gravity
        this.velocity.x += toCenter.x * gravityForce * deltaTime;
        this.velocity.y += toCenter.y * gravityForce * deltaTime;
        this.velocity.z += toCenter.z * gravityForce * deltaTime;
        
        // Update position
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
        this.position.z += this.velocity.z * deltaTime;
        
        // Update mesh position
        this.mesh.position.set(this.position.x, this.position.y, this.position.z);
        
        // Update comet tail
        this.updateCometTail();
        
        // Possibly emit a trailing particle
        this.lastParticleTime += deltaTime;
        if (this.lastParticleTime > 1 / this.particleEmissionRate) {
            this.emitTrailingParticle();
            this.lastParticleTime = 0;
        }
        
        // Orient to face away from the planet center
        this.orientToSurface();
        
        // Check if we've hit the planet surface
        const newDistanceToCenter = Math.sqrt(
            this.position.x * this.position.x +
            this.position.y * this.position.y +
            this.position.z * this.position.z
        );
        
        if (newDistanceToCenter <= this.planetRadius + this.size * 0.5) {
            // We've hit the surface, stop physics simulation
            this.isSimulating = false;
            
            // Position exactly on the surface
            const surfacePosition = new THREE.Vector3(
                this.position.x,
                this.position.y,
                this.position.z
            ).normalize().multiplyScalar(this.planetRadius + this.size * 0.5);
            
            this.position.x = surfacePosition.x;
            this.position.y = surfacePosition.y;
            this.position.z = surfacePosition.z;
            
            // Update mesh position
            this.mesh.position.set(this.position.x, this.position.y, this.position.z);
            
            // Orient to face away from the planet center
            this.orientToSurface();
            
            // Remove comet tail
            if (this.cometTail) {
                this.scene.remove(this.cometTail);
                this.cometTail = null;
            }
            
            // Create dust particles
            this.createDustParticles(15);
            
            // Start floating animation
            this.isFloating = true;
            
            // Initialize wandering behavior
            this.initializeWandering();
            
            // Animate the entry
            this.animateEntry();
            
            // Create a circular wave animation when the geek drops onto the planet
            this.createDropWave();
        }
    }
    
    /**
     * Create dust particles effect
     * @param {number} particleCount Number of particles to create
     */
    createDustParticles(particleCount = 15) {
        // Create a group to hold all particles
        const particles = new THREE.Group();
        particles.renderOrder = 10; // Set high render order for the group
        
        // Position the particle group at the geek's position
        const offsetPosition = new THREE.Vector3(
            this.position.x,
            this.position.y,
            this.position.z
        ).add(this.normal.clone().multiplyScalar(0.5)); // Offset slightly to avoid z-fighting
        
        particles.position.set(offsetPosition.x, offsetPosition.y, offsetPosition.z);
        
        // Add particles to the scene
        this.scene.add(particles);
        
        // Create local references to avoid "this" context issues in animations
        const normal = this.normal.clone();
        const size = this.size;
        const color = this.color;
        const scene = this.scene;
        
        for (let i = 0; i < particleCount; i++) {
            // Create a small sphere for each particle
            const particleSize = size * 0.1 + Math.random() * size * 0.15;
            const particleGeometry = new THREE.SphereGeometry(particleSize, 8, 8);
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.5, // Reduced opacity
                depthTest: true, // Enable depth testing
                depthWrite: true, // Write to depth buffer
                blending: THREE.NormalBlending // Use normal blending instead of additive
            });
            
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            particle.renderOrder = 10; // Set high render order for each particle
            
            // Position at the center initially
            particle.position.set(0, 0, 0);
            
            // Add to the group
            particles.add(particle);
            
            // Calculate random direction in the hemisphere facing away from the planet center
            const randomDirection = new THREE.Vector3(
                Math.random() - 0.5,
                Math.random() * 0.8, // Bias upward
                Math.random() - 0.5
            );
            
            // Project onto tangent plane and normalize
            const dotProduct = randomDirection.dot(normal);
            randomDirection.sub(normal.clone().multiplyScalar(dotProduct));
            randomDirection.normalize();
            
            // Add some component in the normal direction
            randomDirection.add(normal.clone().multiplyScalar(0.5 + Math.random() * 0.5));
            randomDirection.normalize();
            
            // Animate the particle
            const distance = size * (2 + Math.random() * 6); // Increased distance for larger planet
            const duration = 500 + Math.random() * 500;
            
            // Create the animation
            new TWEEN.Tween(particle.position)
                .to({
                    x: randomDirection.x * distance,
                    y: randomDirection.y * distance,
                    z: randomDirection.z * distance
                }, duration)
                .easing(TWEEN.Easing.Cubic.Out)
                .start();
                
            // Fade out
            new TWEEN.Tween(particleMaterial)
                .to({ opacity: 0 }, duration)
                .easing(TWEEN.Easing.Cubic.In)
                .onComplete(() => {
                    // Remove the particle when animation completes
                    particles.remove(particle);
                    particleGeometry.dispose();
                    particleMaterial.dispose();
                    
                    // If this was the last particle, remove the group
                    if (particles.children.length === 0) {
                        scene.remove(particles);
                    }
                })
                .start();
        }
    }
    
    /**
     * Update floating animation
     * @param {number} time Current time in seconds
     */
    updateFloating(time) {
        if (!this.isFloating) return;
        
        // Calculate the float offset from the surface
        const floatOffset = Math.sin(time * this.floatSpeed + this.floatOffset) * this.floatAmplitude;
        
        // Calculate the position with the float offset along the normal
        const basePosition = new THREE.Vector3(
            this.position.x,
            this.position.y,
            this.position.z
        );
        
        // Add the float offset along the normal vector
        const floatVector = this.normal.clone().multiplyScalar(floatOffset);
        const floatPosition = basePosition.add(floatVector);
        
        // Update the mesh position
        this.mesh.position.set(floatPosition.x, floatPosition.y, floatPosition.z);
        
        // Update wandering behavior
        if (this.wandering) {
            this.updateWandering(time);
        }
    }
    
    /**
     * Initialize wandering behavior
     */
    initializeWandering() {
        this.wandering = {
            active: Math.random() < 0.7, // 70% chance to start wandering
            basePosition: new THREE.Vector3(this.position.x, this.position.y, this.position.z),
            maxDistance: this.size * (5 + Math.random() * 3), // 5-8 times the size (increased for larger planet)
            direction: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
            speed: 10 + Math.random() * 15, // Increased speed for larger planet
            moving: true,
            nextStateChange: Math.random() * 5 + 3, // 3-8 seconds until next state change
            lastStateChangeTime: 0
        };
        
        // Create a rotation matrix for the tangent plane at this point on the sphere
        this.createTangentSpace();
    }
    
    /**
     * Create a local tangent space for movement on the sphere surface
     */
    createTangentSpace() {
        // The normal is already calculated
        this.normal = this.calculateNormal();
        
        // Create two perpendicular vectors in the tangent plane
        this.tangent1 = new THREE.Vector3(1, 0, 0);
        if (Math.abs(this.normal.dot(this.tangent1)) > 0.9) {
            // If normal is close to x-axis, use y-axis as a starting point
            this.tangent1.set(0, 1, 0);
        }
        
        // Make tangent1 perpendicular to normal
        this.tangent1.sub(this.normal.clone().multiplyScalar(this.normal.dot(this.tangent1)));
        this.tangent1.normalize();
        
        // tangent2 is perpendicular to both normal and tangent1
        this.tangent2 = new THREE.Vector3().crossVectors(this.normal, this.tangent1);
    }
    
    /**
     * Update wandering behavior
     * @param {number} time Current time in seconds
     */
    updateWandering(time) {
        if (!this.wandering || !this.wandering.active) return;
        
        // Check if it's time to change state (moving/paused)
        if (time - this.wandering.lastStateChangeTime > this.wandering.nextStateChange) {
            this.wandering.moving = !this.wandering.moving;
            this.wandering.lastStateChangeTime = time;
            this.wandering.nextStateChange = Math.random() * 7 + 3; // 3-10 seconds
            
            if (this.wandering.moving) {
                // Prepare to move with a little squash animation
                this.prepareToMove();
                // Change direction when starting to move
                this.changeWanderingDirection();
            }
        }
        
        if (!this.wandering.moving) return;
        
        // Update position in the tangent plane
        const moveStep = this.wandering.speed * 0.01;
        
        // Calculate movement vector in the tangent plane
        const movementVector = new THREE.Vector3()
            .addScaledVector(this.tangent1, this.wandering.direction.x * moveStep)
            .addScaledVector(this.tangent2, this.wandering.direction.z * moveStep);
        
        // Update position
        const newPosition = new THREE.Vector3(
            this.position.x,
            this.position.y,
            this.position.z
        ).add(movementVector);
        
        // Project back onto the sphere surface
        newPosition.normalize().multiplyScalar(this.planetRadius + this.size * 0.5);
        
        // Check distance from base position
        const distanceFromBase = newPosition.distanceTo(
            new THREE.Vector3(
                this.wandering.basePosition.x,
                this.wandering.basePosition.y,
                this.wandering.basePosition.z
            )
        );
        
        // If too far, change direction to head back
        if (distanceFromBase > this.wandering.maxDistance) {
            // Calculate direction back to base
            const toBase = new THREE.Vector3(
                this.wandering.basePosition.x - this.position.x,
                this.wandering.basePosition.y - this.position.y,
                this.wandering.basePosition.z - this.position.z
            ).normalize();
            
            // Project onto tangent plane
            this.wandering.direction.x = toBase.dot(this.tangent1);
            this.wandering.direction.z = toBase.dot(this.tangent2);
            this.wandering.direction.normalize();
        } else if (Math.random() < 0.01) {
            // Randomly change direction occasionally
            this.changeWanderingDirection();
        }
        
        // Update position
        this.position.x = newPosition.x;
        this.position.y = newPosition.y;
        this.position.z = newPosition.z;
        
        // Update normal and tangent space at the new position
        this.normal = this.calculateNormal();
        this.createTangentSpace();
        
        // Orient to face the movement direction
        this.orientToMovement();
    }
    
    /**
     * Orient the mesh to face the movement direction
     */
    orientToMovement() {
        if (!this.mesh || !this.wandering) return;
        
        // Create a quaternion that rotates from the default up vector (0,1,0)
        // to the normal vector
        const upVector = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(upVector, this.normal);
        
        // Create a rotation around the normal axis based on movement direction
        const angle = Math.atan2(this.wandering.direction.z, this.wandering.direction.x);
        const normalRotation = new THREE.Quaternion().setFromAxisAngle(this.normal, angle);
        
        // Combine the rotations
        quaternion.multiply(normalRotation);
        
        // Apply the rotation to the mesh with smooth interpolation
        this.mesh.quaternion.slerp(quaternion, 0.1);
    }
    
    /**
     * Animate the entry of this geek
     */
    animateEntry() {
        // Create a cute squash and stretch animation for impact
        
        // First, squash the water drop
        new TWEEN.Tween(this.mesh.scale)
            .to({ x: 1.3, y: 0.7, z: 1.3 }, 150)
            .easing(TWEEN.Easing.Cubic.Out)
            .onComplete(() => {
                // Then bounce back with a slight overshoot
                new TWEEN.Tween(this.mesh.scale)
                    .to({ x: 0.9, y: 1.2, z: 0.9 }, 150)
                    .easing(TWEEN.Easing.Cubic.Out)
                    .onComplete(() => {
                        // Finally settle to normal scale
                        new TWEEN.Tween(this.mesh.scale)
                            .to({ x: 1, y: 1, z: 1 }, 200)
                            .easing(TWEEN.Easing.Elastic.Out)
                            .start();
                    })
                    .start();
            })
            .start();
        
        // Make the water drop do a happy little wiggle
        this.wiggleHappily();
    }
    
    /**
     * Make the water drop do a happy little wiggle
     */
    wiggleHappily() {
        // Check if mesh exists
        if (!this.mesh) {
            console.warn('Cannot wiggle: mesh is null');
            return;
        }
        
        // Find the face parts
        if (this.mesh.children.length < 3) {
            console.warn('Cannot wiggle: not enough children in mesh');
            return;
        }
        
        // Wiggle the entire drop from side to side
        const originalRotation = this.mesh.rotation.y;
        const wiggleAmount = 0.2;
        
        // First wiggle left
        new TWEEN.Tween(this.mesh.rotation)
            .to({ y: originalRotation - wiggleAmount }, 150)
            .easing(TWEEN.Easing.Cubic.Out)
            .onComplete(() => {
                // Check if mesh still exists
                if (!this.mesh) return;
                
                // Then wiggle right
                new TWEEN.Tween(this.mesh.rotation)
                    .to({ y: originalRotation + wiggleAmount }, 300)
                    .easing(TWEEN.Easing.Cubic.InOut)
                    .onComplete(() => {
                        // Check if mesh still exists
                        if (!this.mesh) return;
                        
                        // Then back to center
                        new TWEEN.Tween(this.mesh.rotation)
                            .to({ y: originalRotation }, 150)
                            .easing(TWEEN.Easing.Cubic.In)
                            .start();
                    })
                    .start();
            })
            .start();
        
        // Make the eyes do a happy squint
        setTimeout(() => {
            // Check if mesh still exists
            if (!this.mesh || this.mesh.children.length < 3) return;
            
            const leftEye = this.mesh.children[1];
            const rightEye = this.mesh.children[2];
            
            if (leftEye && rightEye) {
                // Squint eyes (scale down vertically, scale up horizontally)
                new TWEEN.Tween(leftEye.scale)
                    .to({ y: 0.6, x: 1.2, z: 1.2 }, 300)
                    .easing(TWEEN.Easing.Cubic.Out)
                    .onComplete(() => {
                        // Check if mesh still exists
                        if (!this.mesh || !leftEye) return;
                        
                        // Return to normal after a delay
                        setTimeout(() => {
                            // Check if mesh still exists
                            if (!this.mesh || !leftEye) return;
                            
                            new TWEEN.Tween(leftEye.scale)
                                .to({ y: 1, x: 1, z: 1 }, 300)
                                .easing(TWEEN.Easing.Cubic.InOut)
                                .start();
                        }, 500);
                    })
                    .start();
                    
                new TWEEN.Tween(rightEye.scale)
                    .to({ y: 0.6, x: 1.2, z: 1.2 }, 300)
                    .easing(TWEEN.Easing.Cubic.Out)
                    .onComplete(() => {
                        // Check if mesh still exists
                        if (!this.mesh || !rightEye) return;
                        
                        // Return to normal after a delay
                        setTimeout(() => {
                            // Check if mesh still exists
                            if (!this.mesh || !rightEye) return;
                            
                            new TWEEN.Tween(rightEye.scale)
                                .to({ y: 1, x: 1, z: 1 }, 300)
                                .easing(TWEEN.Easing.Cubic.InOut)
                                .start();
                        }, 500);
                    })
                    .start();
            }
        }, 150);
    }
    
    /**
     * Animate the exit of this geek
     * @param {Function} onComplete Callback when animation completes
     */
    animateExit(onComplete) {
        // Check if mesh exists
        if (!this.mesh) {
            console.warn('Cannot animate exit: mesh is null');
            if (onComplete) onComplete();
            return;
        }
        
        // Stop floating
        this.isFloating = false;
        
        // Make the water drop look surprised
        this.lookSurprised();
        
        // After the surprised look, start rising and fading
        setTimeout(() => {
            // Check if mesh still exists
            if (!this.mesh) {
                if (onComplete) onComplete();
                return;
            }
            
            // Animate moving up and fading out
            const startY = this.mesh.position.y;
            
            // First, make the drop stretch upward as if being pulled
            new TWEEN.Tween(this.mesh.scale)
                .to({ y: 1.5, x: 0.8, z: 0.8 }, 400)
                .easing(TWEEN.Easing.Cubic.Out)
                .start();
            
            // Then move upward
            new TWEEN.Tween(this.mesh.position)
                .to({ y: startY + 150 }, 1000)
                .easing(TWEEN.Easing.Cubic.InOut)
                .start();
            
            // Find the body (first child)
            if (!this.mesh.children || this.mesh.children.length === 0) {
                console.warn('Cannot animate exit: no children in mesh');
                setTimeout(() => {
                    if (onComplete) onComplete();
                }, 1000);
                return;
            }
            
            const body = this.mesh.children[0];
            if (body && body.material) {
                // Fade out the body
                new TWEEN.Tween(body.material)
                    .to({ opacity: 0 }, 800)
                    .easing(TWEEN.Easing.Cubic.In)
                    .delay(200)
                    .onComplete(() => {
                        if (onComplete) onComplete();
                    })
                    .start();
            } else {
                // Fallback if body not found
                setTimeout(() => {
                    if (onComplete) onComplete();
                }, 1000);
            }
            
            // Add a spin as it rises
            new TWEEN.Tween(this.mesh.rotation)
                .to({ y: this.mesh.rotation.y + Math.PI * 2 }, 1000)
                .easing(TWEEN.Easing.Cubic.InOut)
                .start();
        }, 500);
    }
    
    /**
     * Make the water drop look surprised
     */
    lookSurprised() {
        // Check if mesh exists
        if (!this.mesh) {
            console.warn('Cannot look surprised: mesh is null');
            return;
        }
        
        // Find the face parts
        if (this.mesh.children.length < 4) {
            console.warn('Cannot look surprised: not enough children in mesh');
            return;
        }
        
        const leftEye = this.mesh.children[1];
        const rightEye = this.mesh.children[2];
        const mouth = this.mesh.children[3];
        
        if (!leftEye || !rightEye || !mouth) {
            console.warn('Cannot look surprised: missing face parts');
            return;
        }
        
        // Make eyes wide open
        new TWEEN.Tween(leftEye.scale)
            .to({ y: 1.3, x: 1.3, z: 1.3 }, 300)
            .easing(TWEEN.Easing.Cubic.Out)
            .start();
            
        new TWEEN.Tween(rightEye.scale)
            .to({ y: 1.3, x: 1.3, z: 1.3 }, 300)
            .easing(TWEEN.Easing.Cubic.Out)
            .start();
            
        // Make mouth open in surprise
        if (mouth.scale) {
            new TWEEN.Tween(mouth.scale)
                .to({ y: 1.5, x: 1.5, z: 1.5 }, 300)
                .easing(TWEEN.Easing.Cubic.Out)
                .start();
        }
    }
    
    /**
     * Change the wandering direction
     */
    changeWanderingDirection() {
        const wp = this.wandering;
        
        // If near the boundary, turn back toward center
        const dx = this.position.x - wp.basePosition.x;
        const dz = this.position.z - wp.basePosition.z;
        const distanceFromStart = Math.sqrt(dx * dx + dz * dz);
        
        if (distanceFromStart > wp.maxDistance * 0.7) {
            // Close to max distance, turn back toward center
            const angleToCenter = Math.atan2(wp.basePosition.z - this.position.z, wp.basePosition.x - this.position.x);
            wp.direction.x = Math.cos(angleToCenter);
            wp.direction.z = Math.sin(angleToCenter);
        } else {
            // Otherwise, choose a random new direction
            wp.direction.x = Math.random() - 0.5;
            wp.direction.z = Math.random() - 0.5;
            wp.direction.normalize();
        }
    }
    
    /**
     * Smooth rotation between angles
     * @param {number} current Current angle
     * @param {number} target Target angle
     * @param {number} factor Smoothing factor (0-1)
     * @returns {number} New angle
     */
    smoothRotation(current, target, factor) {
        // Normalize angles
        while (current > Math.PI) current -= Math.PI * 2;
        while (current < -Math.PI) current += Math.PI * 2;
        while (target > Math.PI) target -= Math.PI * 2;
        while (target < -Math.PI) target += Math.PI * 2;
        
        // Find shortest direction
        let delta = target - current;
        if (delta > Math.PI) delta -= Math.PI * 2;
        if (delta < -Math.PI) delta += Math.PI * 2;
        
        // Apply smoothing
        return current + delta * factor;
    }
    
    /**
     * Animate preparation to move
     */
    prepareToMove() {
        // Do a little anticipation squash before moving
        new TWEEN.Tween(this.mesh.scale)
            .to({ y: 0.9, x: 1.1, z: 1.1 }, 300)
            .easing(TWEEN.Easing.Cubic.Out)
            .onComplete(() => {
                new TWEEN.Tween(this.mesh.scale)
                    .to({ y: 1, x: 1, z: 1 }, 200)
                    .easing(TWEEN.Easing.Cubic.Out)
                    .start();
            })
            .start();
    }
    
    /**
     * Make the water drop blink its eyes
     */
    blinkEyes() {
        // Find the eye meshes (first two children after the body)
        const leftEye = this.mesh.children[1];
        const rightEye = this.mesh.children[2];
        
        if (!leftEye || !rightEye) return;
        
        // Store original scale
        const originalScaleY = leftEye.scale.y;
        
        // Close eyes (squash vertically)
        new TWEEN.Tween(leftEye.scale)
            .to({ y: 0.1 }, 100)
            .easing(TWEEN.Easing.Cubic.Out)
            .onComplete(() => {
                // Open eyes
                new TWEEN.Tween(leftEye.scale)
                    .to({ y: originalScaleY }, 100)
                    .easing(TWEEN.Easing.Cubic.Out)
                    .start();
            })
            .start();
            
        new TWEEN.Tween(rightEye.scale)
            .to({ y: 0.1 }, 100)
            .easing(TWEEN.Easing.Cubic.Out)
            .onComplete(() => {
                new TWEEN.Tween(rightEye.scale)
                    .to({ y: originalScaleY }, 100)
                    .easing(TWEEN.Easing.Cubic.Out)
                    .start();
            })
            .start();
    }
    
    /**
     * Update this geek
     * @param {number} deltaTime Time since last update in seconds
     * @param {number} time Current time in seconds
     */
    update(deltaTime, time) {
        if (this.isSimulating) {
            this.updatePhysics(deltaTime);
        } else {
            this.updateFloating(time);
            
            // If we still have a comet tail after landing, remove it
            if (this.cometTail) {
                this.scene.remove(this.cometTail);
                this.cometTail = null;
            }
        }
    }
    
    /**
     * Get the current position
     * @returns {Object} Position {x, y, z}
     */
    getPosition() {
        return {
            x: this.position.x,
            y: this.position.y,
            z: this.position.z
        };
    }
    
    /**
     * Check if this geek collides with the given position
     * @param {Object} position Position to check {x, y, z}
     * @param {number} otherRadius Radius of the other object
     * @returns {boolean} True if collision detected
     */
    collidesWithPosition(position, otherRadius) {
        const dx = this.position.x - position.x;
        const dy = this.position.y - position.y;
        const dz = this.position.z - position.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        return distance < (this.size + otherRadius);
    }
    
    /**
     * Remove this geek from the scene
     */
    remove() {
        if (this.mesh) {
            // Remove from scene
            this.scene.remove(this.mesh);
            
            // Dispose of geometries and materials
            if (this.mesh.children) {
                this.mesh.children.forEach(child => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(material => material.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                });
            }
            
            // Clear references
            this.mesh = null;
        }
        
        // Remove comet tail if it exists
        if (this.cometTail) {
            this.scene.remove(this.cometTail);
            
            // Dispose of geometries and materials
            this.cometTail.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => material.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
            
            this.cometTail = null;
        }
    }
    
    /**
     * Create a circular wave animation when the geek drops onto the planet
     */
    createDropWave() {
        // Create a single wave for simplicity
        const wavePosition = new THREE.Vector3().copy(this.position);
        
        // Create a ring geometry for the wave - keep it extremely small relative to geek size
        const ringGeometry = new THREE.RingGeometry(this.size * 0.075, this.size * 0.1, 12);
        
        // Create a material for the wave - increase opacity for more visibility
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: this.color,
            transparent: true,
            opacity: 0.8, // Increased opacity for brightness
            side: THREE.DoubleSide
        });
        
        // Create the wave mesh
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        
        // Position the ring at the geek's position
        ring.position.copy(wavePosition);
        
        // By default, ring geometry is created in the XY plane
        // We need to rotate it 90 degrees around X axis to make it perpendicular to Y
        ring.rotation.x = Math.PI / 2;
        
        // Then orient it to match the normal of the planet surface
        // Create a rotation matrix that aligns the ring with the surface normal
        const upVector = new THREE.Vector3(0, 1, 0);
        const normalizedNormal = this.normal.clone().normalize();
        
        // Only apply rotation if normal is not already aligned with up vector
        if (Math.abs(normalizedNormal.dot(upVector)) < 0.99) {
            const rotationAxis = new THREE.Vector3().crossVectors(upVector, normalizedNormal).normalize();
            const angle = Math.acos(upVector.dot(normalizedNormal));
            ring.rotateOnAxis(rotationAxis, angle);
        }
        
        // Add the ring to the scene
        this.scene.add(ring);
        
        // Store the creation time
        const startTime = Date.now();
        const duration = 500; // Keep the short animation duration
        const maxScale = this.size * 0.75; // Keep the small maximum scale
        
        // Create an animation function that will be called on each frame
        const animateRing = () => {
            // Calculate how much time has passed
            const elapsedTime = Date.now() - startTime;
            const progress = Math.min(elapsedTime / duration, 1);
            
            // Use easeOutQuad for smoother animation
            const easeOutProgress = 1 - (1 - progress) * (1 - progress);
            
            // Calculate the current scale based on progress
            const currentScale = easeOutProgress * maxScale;
            
            // Apply the scale to the ring
            ring.scale.set(currentScale, currentScale, 1);
            
            // Calculate opacity (starts at 0.8, fades to 0)
            const opacity = 0.8 * (1 - easeOutProgress);
            ringMaterial.opacity = opacity;
            
            // Continue the animation if not complete
            if (progress < 1) {
                requestAnimationFrame(animateRing);
            } else {
                // Clean up when animation is complete
                this.scene.remove(ring);
                ringGeometry.dispose();
                ringMaterial.dispose();
            }
        };
        
        // Start the animation
        animateRing();
        
        // Create a second wave with slight delay for better effect
        setTimeout(() => {
            if (!this.mesh) return; // Safety check in case geek was removed
            
            const ringGeometry2 = new THREE.RingGeometry(this.size * 0.09, this.size * 0.115, 12);
            const ringMaterial2 = new THREE.MeshBasicMaterial({
                color: this.color,
                transparent: true,
                opacity: 0.7, // Increased opacity for second ring
                side: THREE.DoubleSide
            });
            
            const ring2 = new THREE.Mesh(ringGeometry2, ringMaterial2);
            ring2.position.copy(wavePosition);
            
            // Apply the same rotation to the second ring
            ring2.rotation.x = Math.PI / 2;
            
            // Apply the same orientation as the first ring
            if (Math.abs(normalizedNormal.dot(upVector)) < 0.99) {
                const rotationAxis = new THREE.Vector3().crossVectors(upVector, normalizedNormal).normalize();
                const angle = Math.acos(upVector.dot(normalizedNormal));
                ring2.rotateOnAxis(rotationAxis, angle);
            }
            
            this.scene.add(ring2);
            
            const startTime2 = Date.now();
            const duration2 = 600; // Keep the short duration for second wave
            
            const animateRing2 = () => {
                const elapsedTime = Date.now() - startTime2;
                const progress = Math.min(elapsedTime / duration2, 1);
                const easeOutProgress = 1 - (1 - progress) * (1 - progress);
                
                const currentScale = easeOutProgress * maxScale * 0.6; // Smaller scale for second wave
                ring2.scale.set(currentScale, currentScale, 1);
                
                const opacity = 0.7 * (1 - easeOutProgress);
                ringMaterial2.opacity = opacity;
                
                if (progress < 1) {
                    requestAnimationFrame(animateRing2);
                } else {
                    this.scene.remove(ring2);
                    ringGeometry2.dispose();
                    ringMaterial2.dispose();
                }
            };
            
            animateRing2();
        }, 60); // Keep the short delay between waves
    }
    
    /**
     * Create a comet-like tail effect for the falling geek
     * @returns {THREE.Object3D} The comet tail object
     */
    createCometTail() {
        // Create a group to hold the tail particles
        const tailGroup = new THREE.Group();
        this.scene.add(tailGroup);
        
        // Number of particles in the tail
        const particleCount = 25;
        
        // Create a slightly lighter color for the tail start
        const tailStartColor = new THREE.Color(this.color).multiplyScalar(1.2);
        
        // Create particles for the tail
        for (let i = 0; i < particleCount; i++) {
            // Size decreases as we go further back in the tail
            const sizeFactor = 1 - (i / particleCount) * 0.8;
            const particleSize = this.size * 0.8 * sizeFactor;
            
            // Calculate color - gradient from lighter to original color
            const t = i / particleCount;
            const particleColor = new THREE.Color().lerpColors(
                tailStartColor,
                this.color,
                t
            );
            
            // Create particle geometry and material
            const particleGeometry = new THREE.SphereGeometry(particleSize, 8, 8);
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: particleColor,
                transparent: true,
                opacity: 0.8 * (1 - i / particleCount), // Fade out towards the end of the tail
                depthWrite: false // Prevent z-fighting
            });
            
            // Create the particle mesh
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            particle.renderOrder = 5; // Ensure it renders behind the geek
            
            // Store the index for position calculation
            particle.userData.index = i;
            
            // Add to the tail group
            tailGroup.add(particle);
        }
        
        // Store the previous positions for the tail effect
        this.previousPositions = [];
        
        // Add a subtle glow effect at the head of the tail
        const glowGeometry = new THREE.SphereGeometry(this.size * 1.2, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: tailStartColor,
            transparent: true,
            opacity: 0.3,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        
        const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
        glowMesh.userData.isGlow = true;
        tailGroup.add(glowMesh);
        
        return tailGroup;
    }
    
    /**
     * Update the comet tail positions based on the geek's movement
     */
    updateCometTail() {
        if (!this.cometTail) return;
        
        // Add current position to the history
        this.previousPositions.unshift({
            x: this.position.x,
            y: this.position.y,
            z: this.position.z
        });
        
        // Limit the history length
        const maxHistory = 25;
        if (this.previousPositions.length > maxHistory) {
            this.previousPositions = this.previousPositions.slice(0, maxHistory);
        }
        
        // Update each particle in the tail
        this.cometTail.children.forEach(particle => {
            // Handle the glow effect separately
            if (particle.userData.isGlow) {
                particle.position.set(this.position.x, this.position.y, this.position.z);
                return;
            }
            
            const index = particle.userData.index;
            
            // Calculate position based on index
            // Higher indices = further back in the tail
            if (index < this.previousPositions.length) {
                const pos = this.previousPositions[index];
                
                // Add a slight offset to create a more interesting trail
                // The offset increases as we go further back in the tail
                const offsetFactor = index / this.previousPositions.length;
                const offset = new THREE.Vector3(
                    (Math.sin(index * 0.5) * offsetFactor * this.size * 0.5),
                    (Math.cos(index * 0.5) * offsetFactor * this.size * 0.5),
                    (Math.sin(index * 0.3) * offsetFactor * this.size * 0.5)
                );
                
                particle.position.set(
                    pos.x + offset.x,
                    pos.y + offset.y,
                    pos.z + offset.z
                );
                
                // Make sure the particle is visible
                particle.visible = true;
            } else {
                // If we don't have enough history yet, hide the particle
                particle.visible = false;
            }
        });
    }
    
    /**
     * Emit a small trailing particle that breaks off from the comet tail
     */
    emitTrailingParticle() {
        if (!this.cometTail || this.previousPositions.length < 5) return;
        
        // Choose a random position from the tail (not too close to the head)
        const minIndex = 3;
        const maxIndex = Math.min(10, this.previousPositions.length - 1);
        const index = minIndex + Math.floor(Math.random() * (maxIndex - minIndex));
        
        // Get the position from the tail
        const pos = this.previousPositions[index];
        
        // Create a small particle
        const particleSize = this.size * 0.2 + Math.random() * this.size * 0.1;
        const particleGeometry = new THREE.SphereGeometry(particleSize, 6, 6);
        
        // Use a color between the tail start and end
        const t = index / this.previousPositions.length;
        const tailStartColor = new THREE.Color(this.color).multiplyScalar(1.2);
        const particleColor = new THREE.Color().lerpColors(
            tailStartColor,
            this.color,
            t
        );
        
        const particleMaterial = new THREE.MeshBasicMaterial({
            color: particleColor,
            transparent: true,
            opacity: 0.6,
            depthWrite: false
        });
        
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        
        // Position at the chosen point in the tail
        particle.position.set(pos.x, pos.y, pos.z);
        
        // Add some random velocity
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 20
        );
        
        // Add to scene
        this.scene.add(particle);
        
        // Animate the particle
        const duration = 500 + Math.random() * 500;
        
        // Move the particle
        new TWEEN.Tween(particle.position)
            .to({
                x: particle.position.x + velocity.x,
                y: particle.position.y + velocity.y,
                z: particle.position.z + velocity.z
            }, duration)
            .easing(TWEEN.Easing.Cubic.Out)
            .start();
        
        // Fade out
        new TWEEN.Tween(particleMaterial)
            .to({ opacity: 0 }, duration)
            .easing(TWEEN.Easing.Cubic.In)
            .onComplete(() => {
                // Remove the particle when animation completes
                this.scene.remove(particle);
                particleGeometry.dispose();
                particleMaterial.dispose();
            })
            .start();
    }
} 