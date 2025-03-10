/**
 * Planet class for handling planet rendering and properties
 */
import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';
import { Biome } from './biome';
import { PlanetMaterialWithCaustics } from './materials/OceanCausticsMaterial';
import { createAtmosphereMaterial } from './materials/AtmosphereMaterial';
import { loadModels } from './models';
import { Color } from 'three';
import { ColorGradient } from './helper/colorgradient';
import { setDebug } from './helper/debug';

/**
 * Planet options type definition
 * @typedef {Object} PlanetOptions
 * @property {number} [scatter=1.2] - Amount of vertex scatter for natural variation
 * @property {number} [ground=0] - Base ground level
 * @property {number} [detail=50] - Level of geometric detail (triangle count)
 * @property {Object} [atmosphere] - Atmosphere settings
 * @property {'normal'|'caustics'} [material='normal'] - Material type to use
 * @property {Object} [biome] - Biome configuration
 * @property {'sphere'|'plane'} [shape='sphere'] - Planet shape
 * @property {boolean} [debug=false] - Whether to show debug console logs
 */

export class Planet {
    worker;
    callbacks = {};
    requestId = 0;
    biome;
    biomeOptions;
    options;
    vegetationPositions;
    shape = 'sphere';
    tempQuaternion = new THREE.Quaternion();
    mesh = null;
    atmosphereGradient;
    pendingRotation = null;
    ready = false;
    debug = false;

    /**
     * Create a new planet
     * @param {PlanetOptions} options Planet options
     */
    constructor(options = {}) {
        this.shape = options.shape ?? 'sphere';
        this.options = options;
        this.biome = new Biome(options.biome);
        this.biomeOptions = this.biome.options;
        this.mesh = null;
        this.ready = false;
        this.pendingRotation = null;
        this.debug = options.debug ?? false;
        
        // Set global debug flag based on planet's debug setting
        setDebug(this.debug);

        // Initialize web worker
        this.worker = new Worker(new URL('./worker.js', import.meta.url), {
            type: 'module'
        });
        this.worker.onmessage = this.handleMessage.bind(this);

        // Create atmosphere color gradient with more vibrant colors
        this.atmosphereGradient = new ColorGradient({
            stops: [
                [0, new Color(0x1a1a2e)],     // Night - Deep blue
                [0.25, new Color(0x4a4a8a)],  // Dawn - Purple
                [0.5, new Color(0x87CEEB)],   // Day - Sky blue
                [0.75, new Color(0x4a4a8a)],  // Dusk - Purple
                [1, new Color(0x1a1a2e)]      // Night - Deep blue
            ]
        });
    }

    /**
     * Handle messages from the worker
     */
    handleMessage(event) {
        const { type, data, requestId, error } = event.data;
        
        if (type === 'error') {
            console.error('Worker error:', error);
            return;
        }

        if (type === 'geometry') {
            try {
                // Create main geometry
                const geometry = this.createBufferGeometry(
                    new Float32Array(data.positions),
                    new Float32Array(data.colors),
                    new Float32Array(data.normals)
                );

                // Create ocean geometry
                const oceanGeometry = this.createBufferGeometry(
                    new Float32Array(data.oceanPositions),
                    new Float32Array(data.oceanColors),
                    new Float32Array(data.oceanNormals)
                );

                // Set ocean morph targets
                oceanGeometry.morphAttributes.position = [
                    new THREE.Float32BufferAttribute(new Float32Array(data.oceanMorphPositions), 3)
                ];
                oceanGeometry.morphAttributes.normal = [
                    new THREE.Float32BufferAttribute(new Float32Array(data.oceanMorphNormals), 3)
                ];

                // Create materials
                const material = this.createMaterial();
                const oceanMaterial = this.createOceanMaterial();

                // Create main planet mesh
                this.mesh = new THREE.Mesh(geometry, material);
                this.mesh.castShadow = true;
                this.mesh.receiveShadow = true;

                // Add ocean mesh
                const oceanMesh = new THREE.Mesh(oceanGeometry, oceanMaterial);
                oceanMesh.castShadow = true;
                oceanMesh.receiveShadow = true;
                this.mesh.add(oceanMesh);

                // Add atmosphere if enabled
                if (this.options.atmosphere?.enabled) {
                    const atmosphereMesh = this.createAtmosphereMesh(geometry);
                    this.mesh.add(atmosphereMesh);
                }

                // Set planet scale and position
                const planetRadius = 3000;
                this.mesh.scale.set(planetRadius, planetRadius, planetRadius);
                this.mesh.position.set(0, 0, 0);

                // Apply any pending rotation
                if (this.pendingRotation) {
                    this.rotate(this.pendingRotation);
                    this.pendingRotation = null;
                }

                this.ready = true;
                console.log('Planet mesh created successfully');
                this.onMeshCreated?.(this.mesh);
            } catch (error) {
                console.error("Error creating planet mesh:", error);
            }
        }
    }

    /**
     * Create a buffer geometry from arrays
     */
    createBufferGeometry(positions, colors, normals) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        return geometry;
    }

    createMaterial() {
        const options = { vertexColors: true };
        return this.options.material === 'caustics'
            ? new PlanetMaterialWithCaustics({ ...options, shape: this.shape })
            : new THREE.MeshStandardMaterial(options);
    }

    createOceanMaterial() {
        return new THREE.MeshStandardMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.8
        });
    }

    createAtmosphereMesh(geometry) {
        const atmosphereMaterial = createAtmosphereMaterial({
            color: this.options.atmosphere.color || new THREE.Vector3(0.5, 0.7, 1.0),
            height: this.options.atmosphere.height || 0.15,  // Increased height
            density: 1.5,  // Added density parameter
            glowStrength: 1.2,  // Added glow strength
            glowPower: 2.0,     // Added glow power
            glowFactor: 1.5     // Added glow factor
        });
        
        const atmosphereMesh = new THREE.Mesh(geometry.clone(), atmosphereMaterial);
        atmosphereMesh.scale.multiplyScalar(1.15);  // Slightly larger scale
        atmosphereMesh.renderOrder = 1;  // Ensure atmosphere renders after the planet
        return atmosphereMesh;
    }

    /**
     * Create the planet mesh
     */
    async create() {
        try {
            // Load vegetation models if specified
            const models = this.biomeOptions.vegetation?.items.map(item => item.name) || [];
            const loaded = await Promise.all(models.map(model => loadModels(model)));

            console.log('Creating planet geometry...');

            // Create planet mesh
            this.worker.postMessage({
                type: 'createGeometry',
                data: this.options
            });

            return new Promise(resolve => {
                this.onMeshCreated = resolve;
            });
        } catch (error) {
            console.error('Failed to create planet:', error);
            this.ready = false;
            throw error;
        }
    }

    /**
     * Update a model's position on the planet surface
     */
    updatePosition(model, position) {
        if (this.shape === 'plane') {
            model.position.copy(position);
            model.quaternion.setFromRotationMatrix(
                new THREE.Matrix4().lookAt(
                    position,
                    position.clone().add(new THREE.Vector3(0, 1, 0)),
                    new THREE.Vector3(0, 0, 1)
                )
            );
        } else {
            model.position.copy(position);
            model.quaternion.setFromRotationMatrix(
                new THREE.Matrix4().lookAt(
                    position,
                    new THREE.Vector3(0, 0, 0),
                    position.clone().normalize()
                )
            );
        }
    }

    /**
     * Update planet colors based on time of day
     * @param {number} timeOfDay - Time of day (0 to 1)
     */
    updateColor(timeOfDay) {
        if (!this.ready || !this.mesh) return;

        // Update atmosphere color if it exists
        const atmosphereMesh = this.mesh.children.find(child => 
            child.material && child.material.uniforms && child.material.uniforms.atmosphereColor
        );
        
        if (atmosphereMesh) {
            const currentColor = this.atmosphereGradient.get(timeOfDay);
            atmosphereMesh.material.uniforms.atmosphereColor.value = currentColor;
        }

        // Update vegetation colors
        this.mesh.traverse(child => {
            if (child instanceof THREE.Mesh && child !== this.mesh && child !== atmosphereMesh) {
                const material = child.material;
                if (material.name === 'Snow') {
                    material.color.setHex(0xffffff);
                } else if (this.biomeOptions.tintColor) {
                    const biomeColor = this.biome.getBiomeColor(child.position);
                    material.color = biomeColor;
                }
            }
        });
    }

    /**
     * Rotate the planet
     */
    rotate(options = {}) {
        if (!this.mesh) {
            this.pendingRotation = options;
            return null;
        }

        const duration = options.duration || 2000;
        const easing = options.easing || TWEEN.Easing.Cubic.InOut;
        let targetRotation = { x: 0, y: 0, z: 0 };

        if (options.targetPosition && options.targetPosition instanceof THREE.Vector3) {
            const angle = Math.atan2(options.targetPosition.x, options.targetPosition.z);
            targetRotation.y = -angle;
        } else if (options.targetRotation) {
            targetRotation = options.targetRotation;
        }

        return new TWEEN.Tween(this.mesh.rotation)
            .to(targetRotation, duration)
            .easing(easing)
            .start();
    }

    /**
     * Get a random position on the planet surface
     * @returns {THREE.Vector3} Random position
     */
    getRandomPosition() {
        if (this.shape === 'plane') {
            return new THREE.Vector3(
                (Math.random() - 0.5) * 3,
                0,
                (Math.random() - 0.5) * 3
            );
        } else {
            const phi = Math.acos(-1 + (2 * Math.random()));
            const theta = Math.random() * Math.PI * 2;
            return new THREE.Vector3(
                Math.sin(phi) * Math.cos(theta),
                Math.sin(phi) * Math.sin(theta),
                Math.cos(phi)
            );
        }
    }

    /**
     * Clean up resources
     */
    dispose() {
        if (this.worker) {
            this.worker.terminate();
        }

        if (this.mesh) {
            this.mesh.traverse((child) => {
                if (child.geometry) {
                    child.geometry.dispose();
                }
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => material.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
            this.mesh = null;
        }
        this.ready = false;
    }
} 