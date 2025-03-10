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
     * @param {string} [options.client_id] - Client ID associated with this geek
     * @param {number} options.size - Size of the geek bubble
     * @param {number} options.color - Color of the geek bubble (hex)
     * @param {Object} options.position - Position {x, y, z} on the planet surface
     * @param {THREE.Scene} options.scene - The Three.js scene to add to
     * @param {number} options.cameraY - Optional camera height
     * @param {number} options.planetRadius - Radius of the planet
     * @param {boolean} [options.active=true] - Whether the geek is active (online)
     * @param {boolean} [options.anon=false] - Whether the geek is anonymous
     */
    constructor(options) {
        
        this.id = options.id; // May be undefined for locally created geeks
        this.client_id = options.client_id; // Client ID associated with this geek
        this.size = options.size;
        this.active = options.active !== undefined ? options.active : true;
        this.anon = options.anon !== undefined ? options.anon : false;
        
        
        // Handle different color formats
        if (typeof options.color === 'string') {
            // If it's a hex string like "#FF0000"
            this.color = new THREE.Color(options.color);
        } else if (typeof options.color === 'number') {
            // If it's a number like 0xFF0000
            this.color = new THREE.Color(options.color);
        } else if (options.color instanceof THREE.Color) {
            // If it's already a THREE.Color
            this.color = options.color.clone();
        } else {
            // Default to a random color
            console.warn("Invalid color format, using default");
            this.color = new THREE.Color(0x4285F4);
        }
        
        // Store the planet radius
        this.planetRadius = options.planetRadius || 3000;
        
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
        
        // Store the target position (where the geek should be on the planet surface)
        if (options.position && 
            options.position.x !== undefined && 
            options.position.y !== undefined && 
            options.position.z !== undefined) {
            
            this.targetPosition = {
                x: options.position.x,
                y: options.position.y,
                z: options.position.z
            };
        } else if (options.position_x !== undefined && 
                  options.position_y !== undefined && 
                  options.position_z !== undefined) {
            
            // Handle position from individual fields
            this.targetPosition = {
                x: options.position_x,
                y: options.position_y,
                z: options.position_z
            };
        } else {
            // Default target position is the same as initial position
            this.targetPosition = {
                x: this.position.x,
                y: this.position.y,
                z: this.position.z
            };
        }
        
        // Calculate the normal vector at this position (for orientation)
        this.normal = this.calculateNormal();
        
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
        
        // Add to scene
        this.scene.add(this.mesh);
        
        // Set the initial position
        this.mesh.position.set(this.position.x, this.position.y, this.position.z);
        
        // Create comet tail effect - make it more dramatic for current user
        this.cometTail = this.createCometTail();
        
        // Initialize particle emission for trailing effect
        this.particleEmissionRate = this.isCurrentUser ? 30 : 15; // Particles per second
        this.lastParticleTime = 0;
        
    }
    
    /**
     * Calculate the normal vector at the current position on the planet
     * @returns {THREE.Vector3} Normal vector
     */
    calculateNormal() {
        // Check if position is defined and has valid coordinates
        if (!this.position || 
            typeof this.position.x !== 'number' || 
            typeof this.position.y !== 'number' || 
            typeof this.position.z !== 'number' ||
            isNaN(this.position.x) || 
            isNaN(this.position.y) || 
            isNaN(this.position.z)) {
            
            console.warn('Invalid position in calculateNormal, using default normal');
            return new THREE.Vector3(0, 1, 0); // Default to up vector
        }
        
        // For a sphere, the normal is simply the normalized position vector from the center
        try {
            const normal = new THREE.Vector3(
                this.position.x,
                this.position.y,
                this.position.z
            ).normalize();
            
            return normal;
        } catch (error) {
            console.error('Error calculating normal:', error);
            return new THREE.Vector3(0, 1, 0); // Default to up vector
        }
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
        // Create multiple waves for a more dramatic effect
        const waveCount = this.isCurrentUser ? 3 : 2;
        const wavePosition = new THREE.Vector3().copy(this.position);
        
        for (let i = 0; i < waveCount; i++) {
            // Create a ring geometry for the wave - larger than before
            const ringGeometry = new THREE.RingGeometry(
                this.size * 0.1, // Increased inner radius
                this.size * 0.15, // Increased outer radius
                16 // More segments for smoother appearance
            );
            
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
            
            // Store the creation time with a delay for multiple waves
            const startTime = Date.now() + i * 150; // Stagger the waves
            
            // Animate the ring expanding outward
            const animateRing = () => {
                const elapsed = Date.now() - startTime;
                const duration = 1500; // Longer duration for more expansion
                const maxScale = 20; // Much larger maximum scale
                
                if (elapsed < duration) {
                    // Calculate scale factor based on elapsed time
                    // Use easeOutQuad for smoother animation
                    const progress = elapsed / duration;
                    const easeOutProgress = 1 - (1 - progress) * (1 - progress);
                    const scaleFactor = easeOutProgress * maxScale;
                    
                    // Apply the scale to the ring
                    ring.scale.set(scaleFactor, scaleFactor, 1);
                    
                    // Fade out as it expands
                    const opacity = 0.8 * (1 - easeOutProgress);
                    ring.material.opacity = opacity;
                    
                    // Continue animation
                    requestAnimationFrame(animateRing);
                } else {
                    // Animation complete, remove the ring
                    this.scene.remove(ring);
                    ring.geometry.dispose();
                    ring.material.dispose();
                }
            };
            
            // Start the animation
            animateRing();
        }
        
        // Create a splash effect for additional visual impact
        this.createSplashEffect();
    }
    
    /**
     * Create a splash effect when the geek drops onto the planet
     * This adds particles that shoot outward from the impact point
     */
    createSplashEffect() {
        if (!this.scene) return;
        
        // Number of particles in the splash
        const particleCount = this.isCurrentUser ? 30 : 15;
        
        // Create a group to hold all splash particles
        const splashGroup = new THREE.Group();
        this.scene.add(splashGroup);
        
        // Create particles
        for (let i = 0; i < particleCount; i++) {
            // Create a small sphere for each particle
            const geometry = new THREE.SphereGeometry(this.size * 0.03, 4, 4);
            
            // Use the geek's color with some variation
            const hue = new THREE.Color(this.color).getHSL({}).h;
            const color = new THREE.Color().setHSL(
                hue + (Math.random() * 0.1 - 0.05), // Slight hue variation
                0.8, // High saturation
                0.6 + Math.random() * 0.3 // Random lightness
            );
            
            const material = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.8
            });
            
            const particle = new THREE.Mesh(geometry, material);
            
            // Position at the geek's position
            particle.position.copy(this.position);
            
            // Calculate random direction along the surface
            // First, get a random direction in a hemisphere
            const phi = Math.random() * Math.PI * 2;
            const theta = Math.random() * Math.PI * 0.5; // Half-sphere
            
            // Convert to Cartesian coordinates
            const x = Math.sin(theta) * Math.cos(phi);
            const y = Math.cos(theta);
            const z = Math.sin(theta) * Math.sin(phi);
            
            // Create velocity vector
            const velocity = new THREE.Vector3(x, y, z);
            
            // Project velocity onto the plane tangent to the planet surface
            const normalizedNormal = this.normal.clone().normalize();
            const dot = velocity.dot(normalizedNormal);
            velocity.sub(normalizedNormal.multiplyScalar(dot));
            
            // Normalize and scale by random speed
            velocity.normalize().multiplyScalar(0.05 + Math.random() * 0.1);
            
            // Add some upward component
            velocity.y += 0.02 + Math.random() * 0.03;
            
            // Store velocity with the particle
            particle.userData.velocity = velocity;
            particle.userData.gravity = 0.002; // Gravity strength
            particle.userData.life = 0; // Current life
            particle.userData.maxLife = 30 + Math.floor(Math.random() * 20); // Random lifespan
            
            // Add to group
            splashGroup.add(particle);
        }
        
        // Animation function
        const animateSplash = () => {
            let allParticlesDead = true;
            
            // Update each particle
            splashGroup.children.forEach(particle => {
                // Update life
                particle.userData.life++;
                
                if (particle.userData.life < particle.userData.maxLife) {
                    allParticlesDead = false;
                    
                    // Update position based on velocity
                    particle.position.add(particle.userData.velocity);
                    
                    // Apply gravity (reduce y component of velocity)
                    particle.userData.velocity.y -= particle.userData.gravity;
                    
                    // Scale down as life progresses
                    const lifeRatio = 1 - (particle.userData.life / particle.userData.maxLife);
                    particle.scale.set(lifeRatio, lifeRatio, lifeRatio);
                    
                    // Fade out
                    particle.material.opacity = 0.8 * lifeRatio;
                } else {
                    // Particle is dead, make it invisible
                    particle.visible = false;
                }
            });
            
            // Continue animation if any particles are still alive
            if (!allParticlesDead) {
                requestAnimationFrame(animateSplash);
            } else {
                // Clean up when all particles are dead
                splashGroup.children.forEach(particle => {
                    particle.geometry.dispose();
                    particle.material.dispose();
                });
                this.scene.remove(splashGroup);
            }
        };
        
        // Start animation
        animateSplash();
    }
    
    /**
     * Create a comet-like tail effect for the geek
     */
    createCometTail() {
        // Create a group to hold all the particles
        const tailGroup = new THREE.Group();
        
        // Number of particles in the tail
        const particleCount = this.isCurrentUser ? 40 : 25;
        
        // Create particles for the tail
        for (let i = 0; i < particleCount; i++) {
            // Calculate size (larger at the head, smaller at the tail)
            const sizeFactor = 1 - (i / particleCount) * 0.8;
            const particleSize = this.size * 0.3 * sizeFactor;
            
            // Create geometry - use more detailed geometry for particles near the head
            const segments = i < 5 ? 8 : 6;
            const geometry = new THREE.SphereGeometry(particleSize, segments, segments);
            
            // Calculate color based on heat dissipation concept
            // Hot at the head (bright white/blue), cooling down toward the tail (orange/red to dark)
            const t = i / particleCount;
            
            let color;
            if (t < 0.3) {
                // First third: bright white-blue to yellow
                const innerT = t / 0.3;
                const hotColor = new THREE.Color(0xffffff); // White-hot
                const midColor = new THREE.Color(0xffcc00); // Yellow-hot
                color = new THREE.Color().lerpColors(hotColor, midColor, innerT);
            } else if (t < 0.7) {
                // Middle section: yellow to orange-red
                const innerT = (t - 0.3) / 0.4;
                const midColor = new THREE.Color(0xffcc00); // Yellow-hot
                const coolColor = new THREE.Color(0xff4400); // Orange-red
                color = new THREE.Color().lerpColors(midColor, coolColor, innerT);
            } else {
                // Last third: orange-red to dark red/black
                const innerT = (t - 0.7) / 0.3;
                const coolColor = new THREE.Color(0xff4400); // Orange-red
                const coldColor = new THREE.Color(0x330000); // Dark red/black
                color = new THREE.Color().lerpColors(coolColor, coldColor, innerT);
            }
            
            // Create material with appropriate blending for a glowing effect
            const material = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.9 * (1 - t * 0.7), // More transparent toward the tail
                blending: THREE.AdditiveBlending
            });
            
            // Create mesh
            const particle = new THREE.Mesh(geometry, material);
            
            // Store the index with the particle for later positioning
            particle.userData.index = i;
            
            // Add to group
            tailGroup.add(particle);
        }
        
        // Initialize array to store previous positions for tail effect
        this.previousPositions = [];
        
        // Add a glow effect at the head of the tail
        const glowSize = this.size * 0.8;
        const glowGeometry = new THREE.SphereGeometry(glowSize, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color(0xffffff), // Bright white for intense heat
            transparent: true,
            opacity: 0.7,
            blending: THREE.AdditiveBlending
        });
        
        const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
        glowMesh.userData.isGlow = true;
        tailGroup.add(glowMesh);
        
        // Add a second, larger glow for more dramatic effect
        const outerGlowSize = this.size * 1.2;
        const outerGlowGeometry = new THREE.SphereGeometry(outerGlowSize, 16, 16);
        const outerGlowMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color(0x88ccff), // Slight blue tint
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending
        });
        
        const outerGlowMesh = new THREE.Mesh(outerGlowGeometry, outerGlowMaterial);
        outerGlowMesh.userData.isOuterGlow = true;
        tailGroup.add(outerGlowMesh);
        
        // Add the tail group to the scene
        this.scene.add(tailGroup);
        
        return tailGroup;
    }
    
    /**
     * Update the comet tail position based on the geek's movement
     */
    updateCometTail() {
        if (!this.cometTail) {
            console.warn('Comet tail not found, cannot update');
            return;
        }
        
        // Initialize previousPositions if not already done
        if (!this.previousPositions) {
            this.previousPositions = [];
        }
        
        // Add current position to the history
        this.previousPositions.unshift({
            x: this.position.x,
            y: this.position.y,
            z: this.position.z
        });
        
        // Limit the history length
        const maxHistory = this.isCurrentUser ? 40 : 25;
        if (this.previousPositions.length > maxHistory) {
            this.previousPositions = this.previousPositions.slice(0, maxHistory);
        }
        
        // Update each particle in the tail
        this.cometTail.children.forEach(particle => {
            // Handle the glow effects separately
            if (particle.userData.isGlow) {
                particle.position.set(this.position.x, this.position.y, this.position.z);
                
                // Pulse the glow size slightly for visual interest
                const pulseFactor = 0.9 + Math.sin(Date.now() * 0.005) * 0.1;
                particle.scale.set(pulseFactor, pulseFactor, pulseFactor);
                return;
            }
            
            if (particle.userData.isOuterGlow) {
                particle.position.set(this.position.x, this.position.y, this.position.z);
                
                // Pulse the outer glow with a different frequency for more dynamic effect
                const outerPulseFactor = 0.85 + Math.sin(Date.now() * 0.003) * 0.15;
                particle.scale.set(outerPulseFactor, outerPulseFactor, outerPulseFactor);
                
                // Vary the opacity slightly for a flickering effect
                particle.material.opacity = 0.3 + Math.sin(Date.now() * 0.007) * 0.1;
                return;
            }
            
            const index = particle.userData.index;
            
            // Calculate position based on index
            // Higher indices = further back in the tail
            if (index < this.previousPositions.length) {
                const pos = this.previousPositions[index];
                
                // Calculate how far back in the tail this particle is (0 to 1)
                const tailProgress = index / Math.max(1, this.previousPositions.length - 1);
                
                // Add a more dramatic offset to create a flowing, undulating trail
                // The offset increases as we go further back in the tail
                const time = Date.now() * 0.001; // Use time for animation
                const waveSpeed = 3.0;
                const waveAmplitude = this.size * 0.8 * tailProgress;
                
                const offset = new THREE.Vector3(
                    Math.sin(index * 0.3 + time * waveSpeed) * waveAmplitude,
                    Math.cos(index * 0.2 + time * waveSpeed) * waveAmplitude,
                    Math.sin(index * 0.4 + time * waveSpeed) * waveAmplitude
                );
                
                particle.position.set(
                    pos.x + offset.x,
                    pos.y + offset.y,
                    pos.z + offset.z
                );
                
                // Make sure the particle is visible
                particle.visible = true;
                
                // Scale down particles further back in the tail with a more dramatic curve
                // Keep the first few particles larger for a more prominent head
                const headFactor = Math.max(0, 1 - tailProgress * 2); // Stays at 1 for first half
                const tailFactor = Math.max(0.3, 1 - tailProgress); // Minimum scale of 0.3
                const scaleFactor = headFactor * 0.5 + tailFactor * 0.5;
                
                particle.scale.set(scaleFactor, scaleFactor, scaleFactor);
                
                // Make particles further back in the tail more transparent
                // But keep a minimum opacity for visibility
                if (particle.material) {
                    const minOpacity = 0.2;
                    const maxOpacity = 0.9;
                    particle.material.opacity = maxOpacity * (1 - tailProgress * 0.8) + minOpacity;
                    
                    // Simulate heat dissipation by changing color
                    // Hot at the head (brighter), cooling down toward the tail (darker and more red/orange)
                    if (particle.material.color) {
                        // Get the base color
                        const baseColor = new THREE.Color(this.color).multiplyScalar(1.5); // Bright at head
                        
                        // Create a heat gradient from bright white-blue to orange-red to dark red
                        let heatColor;
                        
                        if (tailProgress < 0.3) {
                            // First third: bright white-blue to yellow
                            const t = tailProgress / 0.3;
                            const hotColor = new THREE.Color(0xffffff); // White-hot
                            const midColor = new THREE.Color(0xffcc00); // Yellow-hot
                            heatColor = new THREE.Color().lerpColors(hotColor, midColor, t);
                        } else if (tailProgress < 0.7) {
                            // Middle section: yellow to orange-red
                            const t = (tailProgress - 0.3) / 0.4;
                            const midColor = new THREE.Color(0xffcc00); // Yellow-hot
                            const coolColor = new THREE.Color(0xff4400); // Orange-red
                            heatColor = new THREE.Color().lerpColors(midColor, coolColor, t);
                        } else {
                            // Last third: orange-red to dark red/black
                            const t = (tailProgress - 0.7) / 0.3;
                            const coolColor = new THREE.Color(0xff4400); // Orange-red
                            const coldColor = new THREE.Color(0x330000); // Dark red/black
                            heatColor = new THREE.Color().lerpColors(coolColor, coldColor, t);
                        }
                        
                        // Apply the heat color
                        particle.material.color = heatColor;
                    }
                }
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
        
        const material = new THREE.MeshBasicMaterial({
            color: particleColor,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        
        const particle = new THREE.Mesh(particleGeometry, material);
        
        // Position at the chosen point in the tail
        particle.position.set(pos.x, pos.y, pos.z);
        
        // Add some random velocity
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1
        );
        
        // Store velocity and other properties with the particle
        particle.userData.velocity = velocity;
        particle.userData.life = 0;
        particle.userData.maxLife = 30 + Math.floor(Math.random() * 20); // Random lifespan
        particle.userData.fadeRate = 0.01 + Math.random() * 0.02; // Random fade rate
        particle.userData.shrinkRate = 0.01 + Math.random() * 0.02; // Random shrink rate
        
        // Add to scene
        this.scene.add(particle);
        
        // Create animation function
        const animateParticle = () => {
            // Update life
            particle.userData.life++;
            
            if (particle.userData.life < particle.userData.maxLife) {
                // Update position
                particle.position.add(particle.userData.velocity);
                
                // Slow down velocity (simulate air resistance)
                particle.userData.velocity.multiplyScalar(0.95);
                
                // Calculate life ratio (0 to 1)
                const lifeRatio = particle.userData.life / particle.userData.maxLife;
                
                // Fade out
                particle.material.opacity = 0.8 * (1 - lifeRatio);
                
                // Shrink
                const scale = 1 - lifeRatio * particle.userData.shrinkRate * 20;
                particle.scale.set(scale, scale, scale);
                
                // Add heat dissipation effect - change color to cooler tones
                const heatColor = new THREE.Color().lerpColors(
                    particleColor, // Hot color
                    new THREE.Color(0x333333), // Cool/dark color
                    Math.pow(lifeRatio, 0.5) // Non-linear transition for more realistic cooling
                );
                particle.material.color = heatColor;
                
                // Continue animation
                requestAnimationFrame(animateParticle);
            } else {
                // Remove particle when animation is complete
                this.scene.remove(particle);
                particleGeometry.dispose();
                material.dispose();
            }
        };
        
        // Start animation
        animateParticle();
    }
    
    /**
     * Update the geek's color
     * @param {THREE.Color} newColor The new color to set
     */
    updateColor(newColor) {
        try {
            if (!newColor) {
                console.warn("Attempted to update color with invalid value:", newColor);
                return;
            }
            
            console.log("Updating geek color to:", newColor);
            this.color = newColor;
            
            // Update the material color if the mesh exists
            if (this.mesh && this.mesh.children) {
                // Find the body mesh (main part of the geek)
                const bodyMesh = this.mesh.children.find(child => 
                    child.material && 
                    (child.material.name === 'geekBody' || child.material.name === 'body')
                );
                
                if (bodyMesh && bodyMesh.material) {
                    bodyMesh.material.color = newColor;
                    console.log("Updated mesh material color");
                } else {
                    // If we can't find a specific body mesh, try updating all child meshes
                    let updated = false;
                    this.mesh.children.forEach(child => {
                        if (child.material && child.material.color) {
                            child.material.color = newColor;
                            updated = true;
                        }
                    });
                    
                    if (updated) {
                        console.log("Updated all child mesh colors");
                    } else {
                        console.warn("Could not find any materials to update color");
                    }
                }
            } else {
                console.warn("Mesh or children not available for color update");
            }
        } catch (error) {
            console.error("Error updating geek color:", error);
        }
    }
} 