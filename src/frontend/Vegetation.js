import * as THREE from 'three';
import { Octree } from './utils/Octree.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Model collection definitions
 */
const lowPolyNatureModels = {
  BirchTree: { versions: 5, materials: ["White", "Black", "DarkGreen", "Green"] },
  BirchTree_Dead: { versions: 5, materials: ["White", "Black"] },
  Bush: { versions: 2, materials: ["Green"] },
  BushBerries: { versions: 2, materials: ["Green", "Red"] },
  Cactus: { versions: 5, materials: ["Green", "LightOrange"] },
  CactusFlowers: { versions: 5, materials: ["Green", "Pink"] },
  CommonTree: { versions: 5, materials: ["Brown", "Green", "DarkGreen"] },
  CommonTree_Dead: { versions: 5, materials: ["Brown"] },
  Rock: { versions: 7, materials: ["Gray"] },
  Rock_Moss: { versions: 7, materials: ["Gray", "Green"] },
};

/**
 * Collection definitions
 */
const collections = {
  lowpoly_nature: {
    models: lowPolyNatureModels,
    name: "lowpoly_nature"
  }
};

/**
 * VegetationManager class for managing vegetation on a planet
 * Based on the TypeScript implementation in worlds/biome.ts
 */
export class VegetationManager {
  /**
   * Create a new VegetationManager
   * @param {Object} options - Configuration options
   * @param {THREE.Object3D} options.planet - The planet mesh
   * @param {number} options.planetRadius - The radius of the planet
   * @param {number} options.density - Vegetation density (0-1)
   * @param {string} options.collection - Model collection to use
   * @param {boolean} options.useFallback - Whether to use fallback models if real models aren't available
   * @param {THREE.Renderer} options.renderer - The renderer for interactions
   * @param {THREE.Camera} options.camera - The camera for interactions
   */
  constructor(options = {}) {
    this.planet = options.planet || null;
    this.planetRadius = options.planetRadius || 3000;
    this.density = options.density || 0.01; // 1% coverage by default
    this.collection = options.collection || "lowpoly_nature";
    this.useFallback = options.useFallback !== undefined ? options.useFallback : false; // Default to using real models
    this.models = [];
    this.modelCache = {};
    this.modelLoader = new GLTFLoader();
    this.isLoadingModels = false;
    this.loadedModelTypes = new Set();
    
    // Store renderer and camera for interactions
    this.renderer = options.renderer || null;
    this.camera = options.camera || null;
    
    // Group to hold all vegetation
    this.group = new THREE.Group();
    this.group.name = "vegetation";
    
    // Try to find renderer and camera if not provided
    if (!this.renderer || !this.camera) {
      this._findRendererAndCamera();
    }
    
    // Create a global debug sphere to test visibility
    if (this.planet && this.planet.parent) {
      const scene = this.planet.parent;
      const globalDebugSphere = new THREE.Mesh(
        new THREE.SphereGeometry(this.planetRadius * 0.3, 16, 16),
        new THREE.MeshBasicMaterial({ 
          color: 0x00ff00, // Bright green
          wireframe: true
        })
      );
      globalDebugSphere.position.set(0, this.planetRadius * 1.5, 0); // Position it above the planet
      globalDebugSphere.name = "GlobalDebugSphere";
      scene.add(globalDebugSphere);
      console.log("Added global debug sphere to scene");
    }
    
    // Create octree for spatial queries
    this.vegetationOctree = new Octree({
      size: this.planetRadius * 1.5, // Make it larger than the planet to account for terrain height
      capacity: 8
    });
    
    console.log("VegetationManager initialized with options:", {
      planetRadius: this.planetRadius,
      density: this.density,
      collection: this.collection,
      useFallback: this.useFallback
    });
    
    // Always try to load models, regardless of useFallback setting
    this.loadVegetationModels();
  }
  
  /**
   * Try to find the renderer and camera in the scene
   * @private
   */
  _findRendererAndCamera() {
    console.log("Attempting to find renderer and camera...");
    
    // Try to find in global scope
    if (window.renderer) this.renderer = window.renderer;
    if (window.camera) this.camera = window.camera;
    
    // Try to find in scene
    if (this.planet && this.planet.parent) {
      const scene = this.planet.parent;
      
      // Look for camera in scene
      scene.traverse((object) => {
        if (object.isCamera) {
          console.log("Found camera in scene:", object.name || "unnamed camera");
          this.camera = object;
        }
      });
      
      // Look for renderer in scene userData
      if (scene.userData && scene.userData.renderer) {
        console.log("Found renderer in scene userData");
        this.renderer = scene.userData.renderer;
      }
    }
    
    // Try to find canvas and renderer
    const canvas = document.querySelector('canvas');
    if (canvas && canvas.__renderer) {
      console.log("Found renderer in canvas.__renderer");
      this.renderer = canvas.__renderer;
    }
    
    console.log("Renderer found:", !!this.renderer, "Camera found:", !!this.camera);
  }
  
  /**
   * Get model paths and materials for a specific model type
   * @param {string} name - Model name
   * @param {string} collection - Collection name
   * @returns {Object|null} Object with filePaths and materials, or null if model not found
   */
  getModelPathsAndMaterials(name, collection = "lowpoly_nature") {
    if (!collections[collection] || !collections[collection].models[name]) {
      console.error(`Model ${name} not found in collection ${collection}`);
      return null;
    }
    
    const model = collections[collection].models[name];
    const basePath = `/assets/${collections[collection].name}/`;
    
    // Construct file paths based on the number of versions
    const filePaths = [];
    
    // Handle different naming patterns based on model type
    if (name === 'CommonTree') {
      // For CommonTree, include base and Dead variants
      if (model.versions) {
        for (let i = 1; i <= model.versions; i++) {
          filePaths.push(`${basePath}${name}_${i}.gltf`);
          filePaths.push(`${basePath}${name}_Dead_${i}.gltf`);
        }
      } else {
        filePaths.push(`${basePath}${name}.gltf`);
        filePaths.push(`${basePath}${name}_Dead.gltf`);
      }
    } else if (name === 'Bush') {
      // For Bush, include base and BushBerries variants
      if (model.versions) {
        for (let i = 1; i <= model.versions; i++) {
          filePaths.push(`${basePath}${name}_${i}.gltf`);
        }
      } else {
        filePaths.push(`${basePath}${name}.gltf`);
      }
    } else if (name === 'Rock') {
      // For Rock, include base and Moss variants
      if (model.versions) {
        for (let i = 1; i <= model.versions; i++) {
          filePaths.push(`${basePath}${name}_${i}.gltf`);
          filePaths.push(`${basePath}${name}_Moss_${i}.gltf`);
        }
      } else {
        filePaths.push(`${basePath}${name}.gltf`);
        filePaths.push(`${basePath}${name}_Moss.gltf`);
      }
    } else {
      // Default pattern for other model types
      if (model.versions) {
        for (let i = 1; i <= model.versions; i++) {
          filePaths.push(`${basePath}${name}_${i}.gltf`);
        }
      } else {
        filePaths.push(`${basePath}${name}.gltf`);
      }
    }
    
    return {
      filePaths,
      materials: model.materials
    };
  }
  
  /**
   * Get available model types for a collection
   * @param {string} collection - Collection name
   * @returns {string[]} Array of model type names
   */
  getModelTypes(collection = "lowpoly_nature") {
    if (!collections[collection]) {
      console.error(`Collection ${collection} not found`);
      return [];
    }
    
    return Object.keys(collections[collection].models);
  }
  
  /**
   * Load vegetation models from the collection
   * @returns {Promise<void>}
   */
  async loadVegetationModels() {
    if (this.isLoadingModels) return;
    
    this.isLoadingModels = true;
    console.log("Loading vegetation models from collection:", this.collection);
    
    try {
      // Load models directly by type
      await this.loadModelsDirectly();
      
      console.log("Finished loading vegetation models. Loaded types:", Array.from(this.loadedModelTypes));
    } catch (error) {
      console.error("Error loading vegetation models:", error);
    } finally {
      this.isLoadingModels = false;
    }
  }
  
  /**
   * Load models directly by scanning for available files
   * @returns {Promise<void>}
   */
  async loadModelsDirectly() {
    const basePath = `/assets/${this.collection}/`;
    
    // Define specific files we know exist, excluding snow variants
    const specificFiles = [
      { path: `${basePath}CommonTree_1.gltf`, type: 'CommonTree' },
      { path: `${basePath}CommonTree_2.gltf`, type: 'CommonTree' },
      { path: `${basePath}CommonTree_3.gltf`, type: 'CommonTree' },
      { path: `${basePath}Bush_1.gltf`, type: 'Bush' },
      { path: `${basePath}Bush_2.gltf`, type: 'Bush' },
      { path: `${basePath}Rock_1.gltf`, type: 'Rock' },
      { path: `${basePath}Rock_2.gltf`, type: 'Rock' },
      { path: `${basePath}Rock_3.gltf`, type: 'Rock' }
    ];
    
    console.log(`Attempting to load ${specificFiles.length} specific model files`);
    
    // Group files by type
    const filesByType = {};
    specificFiles.forEach(file => {
      if (!filesByType[file.type]) {
        filesByType[file.type] = [];
      }
      filesByType[file.type].push(file.path);
    });
    
    // Load each type
    for (const [type, paths] of Object.entries(filesByType)) {
      try {
        console.log(`Loading ${paths.length} models for ${type}:`, paths);
        
        // Load all models for this type
        const modelPromises = paths.map(path => this.loadModel(path, type));
        const loadedModels = await Promise.all(modelPromises.map(p => p.catch(err => {
          console.warn(`Failed to load model ${type}:`, err);
          return null;
        })));
        
        // Filter out failed loads
        const validModels = loadedModels.filter(model => model !== null);
        
        if (validModels.length > 0) {
          this.modelCache[type] = validModels;
          this.loadedModelTypes.add(type);
          console.log(`Successfully loaded ${validModels.length}/${paths.length} models for ${type}`);
        } else {
          console.warn(`No valid models loaded for ${type}, will use fallback`);
        }
      } catch (error) {
        console.warn(`Error loading ${type} models:`, error);
      }
    }
  }
  
  /**
   * Load a single model
   * @param {string} path - Path to the model file
   * @param {string} type - Type of model
   * @returns {Promise<THREE.Object3D>} The loaded model
   */
  loadModel(path, type) {
    return new Promise((resolve, reject) => {
      console.log(`Loading model: ${path}`);
      
      this.modelLoader.load(
        path,
        (gltf) => {
          console.log(`Successfully loaded model: ${path}`);
          const model = gltf.scene;
          
          // Set model metadata
          model.userData = {
            type,
            path
          };
          
          // Configure model for shadows and improve materials
          model.traverse(child => {
            if (child instanceof THREE.Mesh) {
              // Enable shadows
              child.castShadow = true;
              child.receiveShadow = true;
              
              // Ensure materials are properly configured
              if (child.material) {
                // Make sure material is MeshStandardMaterial for better rendering
                if (!(child.material instanceof THREE.MeshStandardMaterial)) {
                  const oldMaterial = child.material;
                  const newMaterial = new THREE.MeshStandardMaterial({
                    color: oldMaterial.color || 0xffffff,
                    map: oldMaterial.map || null,
                    roughness: 0.8,
                    metalness: 0.2
                  });
                  child.material = newMaterial;
                }
                
                // Enhance material properties
                child.material.side = THREE.DoubleSide; // Render both sides
                child.material.transparent = false; // Disable transparency
                child.material.needsUpdate = true; // Force material update
                
                // Add some emissive for better visibility
                if (child.material.name && child.material.name.includes('Green')) {
                  child.material.emissive = new THREE.Color(0x004400);
                  child.material.emissiveIntensity = 0.2;
                } else if (child.material.name && child.material.name.includes('Brown')) {
                  child.material.emissive = new THREE.Color(0x221100);
                  child.material.emissiveIntensity = 0.1;
                }
              }
              
              // Make sure geometry is properly configured
              if (child.geometry) {
                child.geometry.computeVertexNormals(); // Ensure normals are computed
              }
            }
          });
          
          // Fix model orientation - ensure Y is up
          model.up = new THREE.Vector3(0, 1, 0);
          
          // Ensure the model's origin is at the bottom
          this.normalizeModelOrigin(model);
          
          // Log model details for debugging
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          console.log(`Model ${path} loaded with size:`, size);
          
          resolve(model);
        },
        // Progress callback
        (xhr) => {
          if (xhr.total > 0) {
            const percent = xhr.loaded / xhr.total * 100;
            console.log(`Loading ${path}: ${Math.round(percent)}% (${xhr.loaded}/${xhr.total} bytes)`);
          }
        },
        (error) => {
          console.warn(`Error loading model ${path}:`, error);
          reject(error);
        }
      );
    });
  }
  
  /**
   * Ensure the model's origin is at the bottom for proper placement
   * @param {THREE.Object3D} model - The model to normalize
   */
  normalizeModelOrigin(model) {
    // Calculate the bounding box
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    console.log(`Model bounds: min=${box.min.toArray()}, max=${box.max.toArray()}, size=${size.toArray()}`);
    
    // If the bottom of the model is below y=0, shift it up
    if (box.min.y < 0) {
      const offset = -box.min.y;
      console.log(`Shifting model up by ${offset} units`);
      
      // Apply the offset to all children
      model.children.forEach(child => {
        child.position.y += offset;
      });
    }
    
    // Recalculate the bounding box after adjustment
    const newBox = new THREE.Box3().setFromObject(model);
    // console.log(`Model bounds after adjustment: min=${newBox.min.toArray()}, max=${newBox.max.toArray()}`);
    
    // Ensure the model is centered horizontally (x and z)
    const newCenter = newBox.getCenter(new THREE.Vector3());
    if (Math.abs(newCenter.x) > 0.001 || Math.abs(newCenter.z) > 0.001) {
      console.log(`Centering model horizontally: offset=${[-newCenter.x, 0, -newCenter.z]}`);
      
      // Apply the centering offset to all children
      model.children.forEach(child => {
        child.position.x -= newCenter.x;
        child.position.z -= newCenter.z;
      });
    }
  }
  
  /**
   * Get a model for the specified type, either from cache or fallback
   * @param {string} type - Type of model to get
   * @returns {THREE.Object3D} The model
   */
  getModel(type) {
    // Check if we have this model type in cache
    if (this.modelCache[type] && this.modelCache[type].length > 0) {
      // Get a random model from the cache
      const models = this.modelCache[type];
      const randomIndex = Math.floor(Math.random() * models.length);
      const model = models[randomIndex].clone();
      console.log(`Using cached model for ${type} (${randomIndex + 1}/${models.length})`);
      return model;
    }
    
    // For CommonTree, also check variants if the base type isn't available
    if (type === 'CommonTree' && !this.useFallback) {
      // Try to find any variant of CommonTree
      const variants = ['CommonTree_Dead'];
      
      for (const variant of variants) {
        if (this.modelCache[variant] && this.modelCache[variant].length > 0) {
          const models = this.modelCache[variant];
          const randomIndex = Math.floor(Math.random() * models.length);
          const model = models[randomIndex].clone();
          console.log(`Using cached variant model ${variant} for ${type}`);
          return model;
        }
      }
    }
    
    // Similar for Bush and Rock
    if (type === 'Bush' && !this.useFallback) {
      const variants = ['BushBerries'];
      for (const variant of variants) {
        if (this.modelCache[variant] && this.modelCache[variant].length > 0) {
          const models = this.modelCache[variant];
          const randomIndex = Math.floor(Math.random() * models.length);
          const model = models[randomIndex].clone();
          console.log(`Using cached variant model ${variant} for ${type}`);
          return model;
        }
      }
    }
    
    if (type === 'Rock' && !this.useFallback) {
      const variants = ['Rock_Moss'];
      for (const variant of variants) {
        if (this.modelCache[variant] && this.modelCache[variant].length > 0) {
          const models = this.modelCache[variant];
          const randomIndex = Math.floor(Math.random() * models.length);
          const model = models[randomIndex].clone();
          console.log(`Using cached variant model ${variant} for ${type}`);
          return model;
        }
      }
    }
    
    // If no cached model or useFallback is true, create a fallback
    console.log(`No cached model found for ${type}, using fallback`);
    return this.createFallbackModel(type);
  }
  
  /**
   * Create a fallback model when real models aren't available
   * @param {string} type - Type of fallback model to create ('tree', 'bush', or 'cactus')
   * @returns {THREE.Group} A simple geometric representation of vegetation
   */
  createFallbackModel(type = 'tree') {
    const group = new THREE.Group();
    group.name = `fallback-${type}`;
    
    let trunkHeight, trunkRadius, topHeight, topRadius, color;
    
    // Define smaller dimensions for the models
    // These will be scaled based on planet size later
    switch (type) {
      case 'CommonTree':
      case 'tree':
        trunkHeight = 0.4;
        trunkRadius = 0.04;
        topHeight = 0.55;
        topRadius = 0.2;
        color = 0x4CAF50;   // Brighter green
        break;
      case 'Bush':
      case 'bush':
        trunkHeight = 0.08;
        trunkRadius = 0.025;
        topHeight = 0.25;
        topRadius = 0.16;
        color = 0x8BC34A;   // Lighter green
        break;
      case 'Rock':
      case 'rock':
        // For rocks, create a simple boulder shape
        const rockGeometry = new THREE.DodecahedronGeometry(0.2, 1);
        const rockMaterial = new THREE.MeshStandardMaterial({ 
          color: 0x808080,  // Gray
          roughness: 0.9,
          metalness: 0.1
        });
        const rock = new THREE.Mesh(rockGeometry, rockMaterial);
        
        // Position rock so its bottom is at y=0 (the surface)
        // Adjust the position to ensure the bottom of the rock is at y=0
        const rockBox = new THREE.Box3().setFromObject(rock);
        const rockHeight = rockBox.max.y - rockBox.min.y;
        rock.position.y = rockHeight / 2;
        
        // Add some random rotation for variety
        rock.rotation.x = Math.random() * Math.PI;
        rock.rotation.y = Math.random() * Math.PI;
        rock.rotation.z = Math.random() * Math.PI;
        
        group.add(rock);
        return group;
      case 'Cactus':
      case 'cactus':
        trunkHeight = 0.32;
        trunkRadius = 0.065;
        topHeight = 0.0;
        topRadius = 0.0;
        color = 0xCDDC39;   // Lime green
        break;
      default:
        // Default to a small tree
        trunkHeight = 0.25;
        trunkRadius = 0.04;
        topHeight = 0.32;
        topRadius = 0.16;
        color = 0x4CAF50;   // Brighter green
    }
    
    // Create trunk
    if (trunkHeight > 0 && trunkRadius > 0) {
      // Ensure the trunk is aligned with the y-axis
      const trunkGeometry = new THREE.CylinderGeometry(trunkRadius, trunkRadius, trunkHeight, 8);
      const trunkMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x8B4513,  // Brown
        emissive: 0x3E2723,
        emissiveIntensity: 0.2,
        roughness: 0.8,
        metalness: 0.1
      });
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
      
      // Position trunk so its bottom is at y=0 (the surface)
      trunk.position.y = trunkHeight / 2;
      
      group.add(trunk);
    }
    
    // Create top (foliage)
    if (topHeight > 0 && topRadius > 0) {
      let topGeometry;
      
      if (type === 'tree' || type === 'CommonTree') {
        // Ensure the cone is aligned with the y-axis (point up)
        topGeometry = new THREE.ConeGeometry(topRadius, topHeight, 8);
      } else {
        topGeometry = new THREE.SphereGeometry(topRadius, 8, 8);
      }
      
      const topMaterial = new THREE.MeshStandardMaterial({ 
        color,
        emissive: new THREE.Color(color).multiplyScalar(0.2),
        emissiveIntensity: 0.2,
        roughness: 0.8,
        metalness: 0.1
      });
      const top = new THREE.Mesh(topGeometry, topMaterial);
      
      // Position top above the trunk, with bottom at trunk top
      top.position.y = trunkHeight + (topHeight / 2);
      
      group.add(top);
    }
    
    // For cactus, add arms
    if (type === 'cactus' || type === 'Cactus') {
      const armGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.16, 8);
      const armMaterial = new THREE.MeshStandardMaterial({ 
        color,
        emissive: new THREE.Color(color).multiplyScalar(0.2),
        emissiveIntensity: 0.2,
        roughness: 0.8,
        metalness: 0.1
      });
      
      // Left arm
      const leftArm = new THREE.Mesh(armGeometry, armMaterial);
      leftArm.rotation.z = Math.PI / 4; // 45 degrees
      leftArm.position.set(-0.08, 0.16, 0);
      group.add(leftArm);
      
      // Right arm
      const rightArm = new THREE.Mesh(armGeometry, armMaterial);
      rightArm.rotation.z = -Math.PI / 4; // -45 degrees
      rightArm.position.set(0.08, 0.16, 0);
      group.add(rightArm);
    }
    
    // Make sure the model's "up" direction is aligned with the y-axis
    group.up = new THREE.Vector3(0, 1, 0);
    
    // Ensure the group's origin is at the bottom of the model
    // This is crucial for proper positioning on the planet surface
    const box = new THREE.Box3().setFromObject(group);
    if (box.min.y < 0) {
      // If any part of the model extends below y=0, shift everything up
      const offset = -box.min.y;
      group.children.forEach(child => {
        child.position.y += offset;
      });
    }
    
    return group;
  }
  
  /**
   * Add vegetation at a specific position
   * @param {Object} options - Vegetation options
   * @param {string} options.type - Type of vegetation ('tree', 'bush', or 'cactus')
   * @param {THREE.Vector3} options.position - Position on the planet surface (world space)
   * @param {THREE.Vector3} options.normal - Surface normal at the position
   * @returns {THREE.Object3D} The added vegetation object
   */
  addVegetationAt(options) {
    const { type = 'CommonTree', position, normal } = options;

    if (!position || !normal) {
        console.warn("Invalid position or normal for vegetation placement:", position, normal);
        return null;
    }

    const surfacePosition = position.clone();

    // Scale normalized position to world space
    const _direction = surfacePosition.clone().normalize();
    surfacePosition.multiplyScalar(this.planetRadius);
    const surfaceNormal = _direction.clone();

    // Verify position (optional, for debugging)
    if (this.planet && this.planet.geometry) {
        const raycaster = new THREE.Raycaster();
        raycaster.set(surfacePosition.clone().add(surfaceNormal.multiplyScalar(0.1)), surfaceNormal.clone().negate());
        const intersects = raycaster.intersectObject(this.planet, true);
        if (intersects.length > 0) {
            console.log(`Verified position adjusted from ${surfacePosition.toArray()} to ${intersects[0].point.toArray()}`);
            surfacePosition.copy(intersects[0].point);
        }
    }

    const isSuitable = this.isSuitableForVegetation(surfacePosition);
    if (!isSuitable) {
        console.warn("Position not suitable for vegetation:", surfacePosition.toArray());
        return null;
    }

    const model = this.getModel(type);
    model.position.copy(surfacePosition);

    const upVector = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(upVector, surfaceNormal.clone().normalize());
    model.quaternion.copy(quaternion);

    if (type !== 'Bush' && type !== 'bush') {
        const randomAngle = Math.random() * Math.PI * 2;
        model.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(surfaceNormal.normalize(), randomAngle));
    }

    const baseScale = 0.001 * 3;
    const scaleFactor = this.planetRadius * baseScale * (0.8 + Math.random() * 0.4);
    model.scale.set(scaleFactor, scaleFactor, scaleFactor);

    const debugSphere = new THREE.Mesh(
        new THREE.SphereGeometry(this.planetRadius * 0.02, 16, 16),
        new THREE.MeshBasicMaterial({ 
            color: 0xff00ff,
            wireframe: true,
            transparent: true,
            opacity: 0.8
        })
    );
    debugSphere.position.copy(surfacePosition);
    debugSphere.name = "DebugSphere";

    this.group.add(debugSphere);
    this.group.add(model);
    this.models.push(model);
    this.vegetationOctree.insert(surfacePosition, { type });

    console.log(`Added ${type} at position: ${surfacePosition.toArray()}, normal: ${surfaceNormal.toArray()}, scale: ${scaleFactor}`);
    return model;
  }
  
  /**
   * Find the closest vegetation to a position
   * @param {THREE.Vector3} position - Position to find closest vegetation to
   * @param {number} maxDistance - Maximum distance to search
   * @returns {Object|null} Closest vegetation or null if none found
   */
  findClosestVegetation(position, maxDistance = Infinity) {
    return this.vegetationOctree.findClosest(position, maxDistance);
  }
  
  /**
   * Get all vegetation within a distance of a position
   * @param {THREE.Vector3} position - Position to query around
   * @param {number} distance - Distance to query
   * @returns {Array<THREE.Vector3>} Vegetation within the distance
   */
  getVegetationWithinDistance(position, distance) {
    return this.vegetationOctree.query(position, distance);
  }
  
  /**
   * Check if a position is suitable for vegetation
   * @param {THREE.Vector3} position - Position to check
   * @param {number} minDistance - Minimum distance to other vegetation
   * @returns {boolean} True if the position is suitable for vegetation
   */
  isSuitableForVegetation(position, minDistance = this.planetRadius * 0.001) {
    if (!position) return false;
    
    // Use the Octree to efficiently find nearby vegetation
    const nearbyVegetation = this.vegetationOctree.query(position, minDistance);
    
    // If there's any vegetation within the minimum distance, this position is not suitable
    // if (nearbyVegetation.length > 0) {
    //   console.warn(`Already nearby vegetation: ${nearbyVegetation.length} items, closest at distance ${position.distanceTo(nearbyVegetation[0]).toFixed(2)}`);
    //   return false;
    // }
    
    // Check if the position is too close to the edge of the planet
    // This is a simple check to ensure vegetation is not placed on extreme terrain
    const distanceFromCenter = position.length();
    const minPlanetRadius = this.planetRadius * 0.9;  // 90% of planet radius
    const maxPlanetRadius = this.planetRadius * 1.1;  // 110% of planet radius
    
    // if (distanceFromCenter < minPlanetRadius || distanceFromCenter > maxPlanetRadius) {
    //   return false;
    // }
    
    // Position is suitable for vegetation
    return true;
  }
  
  /**
   * Get a random position on the planet surface
   * @returns {Object} Position and normal
   */
  getRandomSurfacePosition() {
    // Generate a random point on a unit sphere
    const theta = Math.random() * Math.PI * 2; // Longitude (0 to 2π)
    const phi = Math.acos(2 * Math.random() - 1); // Latitude (0 to π)
    
    // Convert to Cartesian coordinates
    const x = Math.sin(phi) * Math.cos(theta);
    const y = Math.sin(phi) * Math.sin(theta);
    const z = Math.cos(phi);
    
    // Create direction vector
    const direction = new THREE.Vector3(x, y, z).normalize();
    
    // Calculate surface position directly (for simple spherical planets)
    const surfacePosition = direction.clone().multiplyScalar(this.planetRadius);
    const normal = direction.clone();
    
    // If we have a planet mesh, try raycasting for more accurate placement
    if (this.planet) {
      // Try raycasting from outside the planet inward
      const startPoint = direction.clone().multiplyScalar(this.planetRadius * 1.5);
      const inwardDirection = direction.clone().negate();
      
      const raycaster = new THREE.Raycaster(
        startPoint,
        inwardDirection,
        0,
        this.planetRadius * 3
      );
      
      // Perform the raycast
      const intersects = raycaster.intersectObject(this.planet, true); // Include children
      
      if (intersects.length > 0) {
        // Use the intersection point and face normal
        // Make sure the normal is pointing outward from the planet center
        const intersectionNormal = intersects[0].face.normal.clone();
        const worldNormal = intersectionNormal.clone()
          .applyQuaternion(intersects[0].object.getWorldQuaternion(new THREE.Quaternion()));
        
        // Check if the normal is pointing inward (toward planet center)
        const toCenter = new THREE.Vector3().subVectors(
          new THREE.Vector3(0, 0, 0), 
          intersects[0].point
        ).normalize();
        
        // If normal is pointing inward, flip it
        if (worldNormal.dot(toCenter) > 0) {
          worldNormal.negate();
        }
        
        return {
          position: intersects[0].point,
          normal: worldNormal
        };
      }
    }
    
    // Return the simple spherical position if raycasting failed or no planet mesh
    return { position: surfacePosition, normal };
  }
  
  /**
   * Populate the planet with vegetation
   * @param {number} count - Number of vegetation items to add
   */
  populate(count = 100) {
    console.log(`Populating planet with ${count} vegetation items...`);
    
    if (!this.planet) {
      console.error("Cannot populate: planet mesh is not set");
      return;
    }
    
    // Add the vegetation group to the planet
    if (this.group.parent !== this.planet) {
      this.planet.add(this.group);
      console.log("Added vegetation group to planet");
    }
    
    // Ensure the vegetation group is visible
    this.group.visible = true;
    console.log("Vegetation group visibility set to true");
    console.log("Vegetation group parent:", this.group.parent ? this.group.parent.name : "none");
    
    // Clear existing vegetation
    this.clear();
    
    // Types of vegetation with their probabilities
    const types = [
      { type: 'CommonTree', probability: 0.4 },
      { type: 'Bush', probability: 0.3 },
      { type: 'Rock', probability: 0.3 }
    ];
    
    // If we have loaded models, add more variety
    if (this.loadedModelTypes.size > 0) {
      // Use the actual loaded model types
      const availableTypes = Array.from(this.loadedModelTypes);
      console.log("Using loaded model types:", availableTypes);
      
      // Reset types array
      types.length = 0;
      
      // Distribute probability evenly among available types
      const baseProbability = 1 / availableTypes.length;
      
      availableTypes.forEach(type => {
        types.push({ type, probability: baseProbability });
      });
    } else {
      console.warn("No loaded model types available, using fallback types");
    }
    
    // Calculate minimum distance between vegetation items based on planet size
    const minDistance = this.planetRadius * 0.02;
    console.log(`Using minimum distance between vegetation: ${minDistance}`);
    
    // Add vegetation
    let successCount = 0;
    let attempts = 0;
    const maxAttempts = count * 10; // Limit attempts to avoid infinite loop
    
    // Create a grid of potential positions for more even distribution
    const positions = [];
    
    // Generate positions using fibonacci sphere for even distribution
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    for (let i = 0; i < count * 2; i++) {
      const y = 1 - (i / (count * 2 - 1)) * 2; // y goes from 1 to -1
      const radius = Math.sqrt(1 - y * y); // radius at y
      
      const theta = 2 * Math.PI * i / goldenRatio; // golden angle increment
      
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;
      
      const direction = new THREE.Vector3(x, y, z).normalize();
      positions.push(direction);
    }
    
    // Shuffle positions for more randomness
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    
    console.log(`Generated ${positions.length} potential positions for vegetation`);
    
    // Try to add vegetation at each position
    for (let i = 0; i < positions.length && successCount < count && attempts < maxAttempts; i++, attempts++) {
      // Get a random position on the planet surface
      const direction = positions[i];
      
      // Calculate surface position directly - EXACTLY at the planet radius
      const surfacePosition = direction.clone().multiplyScalar(this.planetRadius);
      const normal = direction.clone();
      
      // Try raycasting for more accurate placement on complex terrain
      let foundSurface = false;
      if (this.planet && this.planet.geometry) {
        const startPoint = direction.clone().multiplyScalar(this.planetRadius * 1.5);
        const inwardDirection = direction.clone().negate();
        
        const raycaster = new THREE.Raycaster(
          startPoint,
          inwardDirection,
          0,
          this.planetRadius * 3
        );
        
        // Use precise raycasting
        const intersects = raycaster.intersectObject(this.planet, true);
        
        if (intersects.length > 0) {
          // Use the intersection point and face normal
          foundSurface = true;
          surfacePosition.copy(intersects[0].point);
          
          // Make sure the normal is pointing outward
          const intersectionNormal = intersects[0].face.normal.clone();
          const worldNormal = intersectionNormal.clone()
            .applyQuaternion(intersects[0].object.getWorldQuaternion(new THREE.Quaternion()));
          
          // Check if the normal is pointing inward
          const toCenter = new THREE.Vector3().subVectors(
            new THREE.Vector3(0, 0, 0), 
            intersects[0].point
          ).normalize();
          
          // If normal is pointing inward, flip it
          if (worldNormal.dot(toCenter) > 0) {
            worldNormal.negate();
          }
          
          normal.copy(worldNormal);
        }
      }
      
      if (!foundSurface) {
        // If raycasting failed, use the exact planet radius
        // This ensures the vegetation is exactly on the surface
        const exactPosition = direction.clone().multiplyScalar(this.planetRadius);
        surfacePosition.copy(exactPosition);
      }
      
      // Select a random vegetation type based on probabilities
      let randomValue = Math.random();
      let cumulativeProbability = 0;
      let selectedType = types[0].type;
      
      for (const typeObj of types) {
        cumulativeProbability += typeObj.probability;
        if (randomValue <= cumulativeProbability) {
          selectedType = typeObj.type;
          break;
        }
      }
      
      // Add vegetation at this position
      const vegetation = this.addVegetationAt({
        type: selectedType,
        position: surfacePosition,
        normal: normal
      });
      
      if (vegetation) {
        successCount++;
        if (successCount % 10 === 0) {
          console.log(`Added ${successCount}/${count} vegetation items...`);
        }
      }
    }
    
    console.log(`Added ${successCount} vegetation items to the planet after ${attempts} attempts`);
    console.log(`Vegetation group has ${this.group.children.length} children`);
    
    return successCount;
  }
  
  /**
   * Clear all vegetation from the planet
   */
  clear() {
    // Remove all models from the group
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
    
    // Clear the models array
    this.models = [];
    
    // Clear the octree
    this.vegetationOctree.clear();
    
    console.log("Vegetation cleared");
  }
  
  /**
   * Dispose of all resources
   */
  dispose() {
    // Clear vegetation
    this.clear();
    
    // Remove group from parent
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
    
    // Clear model cache
    for (const type in this.modelCache) {
      if (this.modelCache[type]) {
        this.modelCache[type].forEach(model => {
          // Dispose of geometries and materials
          model.traverse(child => {
            if (child instanceof THREE.Mesh) {
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
            }
          });
        });
      }
    }
    
    // Clear cache and loaded types
    this.modelCache = {};
    this.loadedModelTypes.clear();
    this.models = [];
    
    console.log("Vegetation manager disposed");
  }
  
  /**
   * Add a debug sphere at a specific position
   * @param {THREE.Vector3} position - Position to add the sphere at
   * @param {number} size - Size of the sphere as a fraction of planet radius
   * @param {number} color - Color of the sphere
   * @param {boolean} isNormalized - Whether the position is a normalized vector
   */
  addDebugSphere(position = new THREE.Vector3(0, this.planetRadius * 1.5, 0), size = 0.02, color = 0xff0000, isNormalized = false) {
    console.log("Adding debug sphere at original position:", position.toArray());

    let finalPosition = position.clone();
    let normal;

    if (isNormalized) {
        // Scale normalized position to world space
        const direction = finalPosition.clone().normalize();
        finalPosition.multiplyScalar(this.planetRadius);
        normal = direction.clone();

        if (this.planet && this.planet.geometry) {
            const raycaster = new THREE.Raycaster();
            raycaster.set(finalPosition.clone().add(normal.multiplyScalar(0.1)), normal.clone().negate());
            const intersects = raycaster.intersectObject(this.planet, true);
            if (intersects.length > 0) {
                finalPosition.copy(intersects[0].point);
                normal = intersects[0].face.normal.clone()
                    .applyQuaternion(this.planet.getWorldQuaternion(new THREE.Quaternion()));
                console.log(`Adjusted normalized position to terrain: ${finalPosition.toArray()}`);
            }
        }
    } else {
        // Assume position is already in world space
        normal = finalPosition.clone().normalize();
        if (this.planet && this.planet.geometry) {
            const raycaster = new THREE.Raycaster();
            raycaster.set(finalPosition.clone().add(normal.multiplyScalar(0.1)), normal.clone().negate());
            const intersects = raycaster.intersectObject(this.planet, true);
            if (intersects.length > 0) {
                finalPosition.copy(intersects[0].point);
                normal = intersects[0].face.normal.clone()
                    .applyQuaternion(this.planet.getWorldQuaternion(new THREE.Quaternion()));
                console.log(`Adjusted world-space position to terrain: ${finalPosition.toArray()}`);
            }
        }
    }

    // Create a more visible debug sphere
    const debugSphere = new THREE.Mesh(
        new THREE.SphereGeometry(this.planetRadius * size, 16, 16),
        new THREE.MeshBasicMaterial({ 
            color: color,
            wireframe: false,
            transparent: true,
            opacity: 0.7,
            depthTest: true,
            depthWrite: true
        })
    );
    
    // Add a wireframe outline for better visibility
    const wireframe = new THREE.Mesh(
        new THREE.SphereGeometry(this.planetRadius * size * 1.05, 16, 16),
        new THREE.MeshBasicMaterial({ 
            color: 0xffffff,
            wireframe: true,
            transparent: true,
            opacity: 0.8
        })
    );
    debugSphere.add(wireframe);
    
    debugSphere.position.copy(finalPosition);
    debugSphere.name = "ManualDebugSphere";
    
    // Add custom properties for hover info
    debugSphere.userData.isDebugSphere = true;
    debugSphere.userData.positionInfo = finalPosition.clone();
    debugSphere.userData.sphereColor = color;
    debugSphere.userData.sphereSize = size;

    // Create a clone for the group
    const groupSphere = debugSphere.clone(true); // true to clone all descendants (wireframe)
    groupSphere.userData.isDebugSphere = true;
    groupSphere.userData.positionInfo = finalPosition.clone();
    groupSphere.userData.sphereColor = color;
    groupSphere.userData.sphereSize = size;
    this.group.add(groupSphere);
    
    if (this.planet) {
        const planetSphere = debugSphere.clone(true);
        planetSphere.name = "PlanetDebugSphere";
        planetSphere.userData.isDebugSphere = true;
        planetSphere.userData.positionInfo = finalPosition.clone();
        planetSphere.userData.sphereColor = color;
        planetSphere.userData.sphereSize = size;
        this.planet.add(planetSphere);
        console.log("Added debug sphere to planet mesh");
    }
    if (this.planet && this.planet.parent) {
        const sceneSphere = debugSphere.clone(true);
        sceneSphere.name = "SceneDebugSphere";
        sceneSphere.userData.isDebugSphere = true;
        sceneSphere.userData.positionInfo = finalPosition.clone();
        sceneSphere.userData.sphereColor = color;
        sceneSphere.userData.sphereSize = size;
        this.planet.parent.add(sceneSphere);
        console.log("Added debug sphere to scene");
    }

    console.log(`Debug sphere placed at final position: ${finalPosition.toArray()}, normal: ${normal.toArray()}`);
    
    // Ensure we have mouse interaction set up
    this._setupDebugSphereInteraction();
    
    return debugSphere;
  }
  
  /**
   * Set up mouse interaction for debug spheres
   * @private
   */
  _setupDebugSphereInteraction() {
    // Only set up once
    if (this._debugInteractionSetup) return;
    this._debugInteractionSetup = true;
    
    console.log("Setting up debug sphere interaction...");
    
    // Create raycaster and mouse vector
    if (!this._raycaster) this._raycaster = new THREE.Raycaster();
    if (!this._mouse) this._mouse = new THREE.Vector2();
    
    // Create tooltip element if it doesn't exist
    if (!this._tooltip) {
      this._tooltip = document.createElement('div');
      this._tooltip.style.position = 'absolute';
      this._tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      this._tooltip.style.color = 'white';
      this._tooltip.style.padding = '10px';
      this._tooltip.style.borderRadius = '4px';
      this._tooltip.style.fontSize = '14px';
      this._tooltip.style.fontFamily = 'monospace';
      this._tooltip.style.pointerEvents = 'none';
      this._tooltip.style.display = 'none';
      this._tooltip.style.zIndex = '1000';
      this._tooltip.style.boxShadow = '0 2px 5px rgba(0,0,0,0.5)';
      this._tooltip.style.border = '1px solid rgba(255,255,255,0.2)';
      this._tooltip.style.minWidth = '200px';
      document.body.appendChild(this._tooltip);
      console.log("Created tooltip element");
    }
    
    // Get the renderer and camera
    const renderer = this._getRenderer();
    const camera = this._getCamera();
    
    console.log("Renderer found:", !!renderer, "Camera found:", !!camera);
    
    if (!renderer || !camera) {
      console.warn('Cannot set up debug sphere interaction: renderer or camera not found');
      
      // Try to set up a fallback using the main canvas and global THREE objects
      const canvas = document.querySelector('canvas');
      if (canvas) {
        console.log("Found canvas element, attempting fallback setup");
        
        // Use a MutationObserver to wait for the renderer and camera to be available
        this._setupFallbackInteraction(canvas);
        return;
      }
      
      return;
    }
    
    // Flag to track if we're currently hovering over a debug sphere
    let isHoveringDebugSphere = false;
    
    // Add mousemove event listener
    renderer.domElement.addEventListener('mousemove', (event) => {
      // Calculate mouse position in normalized device coordinates
      const rect = renderer.domElement.getBoundingClientRect();
      this._mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this._mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      // Update the raycaster
      this._raycaster.setFromCamera(this._mouse, camera);
      
      // Get all objects to check for intersection
      const objects = [];
      if (this.group) this._collectDebugSpheres(this.group, objects);
      if (this.planet) this._collectDebugSpheres(this.planet, objects);
      if (this.planet && this.planet.parent) this._collectDebugSpheres(this.planet.parent, objects);
      
      // Reset hover flag
      isHoveringDebugSphere = false;
      
      // Check for intersections
      const intersects = this._raycaster.intersectObjects(objects, false);
      
      if (intersects.length > 0) {
        const intersection = intersects[0];
        const object = intersection.object;
        
        if (object.userData && object.userData.isDebugSphere) {
          // Set hover flag
          isHoveringDebugSphere = true;
          
          // Show tooltip
          const pos = object.userData.positionInfo;
          
          // Format the position with more details
          const normalizedPos = pos.clone().normalize();
          const distance = pos.length();
          
          let tooltipContent = `
            <div style="margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.3); padding-bottom: 5px;">
              Debug Sphere Position
            </div>
            <div style="display: grid; grid-template-columns: auto 1fr; gap: 5px;">
              <div style="color: #ff6b6b;">X:</div><div>${pos.x.toFixed(3)}</div>
              <div style="color: #51cf66;">Y:</div><div>${pos.y.toFixed(3)}</div>
              <div style="color: #339af0;">Z:</div><div>${pos.z.toFixed(3)}</div>
              <div style="color: #fcc419;">Distance:</div><div>${distance.toFixed(3)}</div>
            </div>
          `;
          
          this._tooltip.innerHTML = tooltipContent;
          this._tooltip.style.display = 'block';
          this._tooltip.style.left = `${event.clientX + 15}px`;
          this._tooltip.style.top = `${event.clientY + 15}px`;
          
          // Ensure tooltip stays within viewport
          const tooltipRect = this._tooltip.getBoundingClientRect();
          if (tooltipRect.right > window.innerWidth) {
            this._tooltip.style.left = `${event.clientX - tooltipRect.width - 15}px`;
          }
          if (tooltipRect.bottom > window.innerHeight) {
            this._tooltip.style.top = `${event.clientY - tooltipRect.height - 15}px`;
          }
        }
      }
      
      // Hide tooltip if not hovering over a debug sphere
      if (!isHoveringDebugSphere) {
        this._tooltip.style.display = 'none';
      }
    });
    
    // Add mouseout event listener for the renderer
    renderer.domElement.addEventListener('mouseout', () => {
      this._tooltip.style.display = 'none';
    });
    
    console.log("Debug sphere interaction setup complete");
  }
  
  /**
   * Set up a fallback interaction system when renderer/camera aren't immediately available
   * @private
   */
  _setupFallbackInteraction(canvas) {
    console.log("Setting up fallback interaction system");
    
    // Try to find global THREE objects
    const checkForThreeObjects = () => {
      // Check if we can find the camera and renderer in the global scope
      let foundCamera = null;
      let foundRenderer = null;
      
      // Look for camera in common places
      if (window.camera) foundCamera = window.camera;
      if (window.mainCamera) foundCamera = window.mainCamera;
      if (window.scene && window.scene.camera) foundCamera = window.scene.camera;
      
      // Look for renderer in common places
      if (window.renderer) foundRenderer = window.renderer;
      if (window.mainRenderer) foundRenderer = window.mainRenderer;
      if (canvas.__renderer) foundRenderer = canvas.__renderer;
      
      if (foundCamera && foundRenderer) {
        console.log("Found camera and renderer in global scope");
        this.camera = foundCamera;
        this.renderer = foundRenderer;
        
        // Now that we have the camera and renderer, set up the interaction
        this._debugInteractionSetup = false; // Reset so we can set up again
        this._setupDebugSphereInteraction();
        return true;
      }
      
      return false;
    };
    
    // Try immediately
    if (checkForThreeObjects()) return;
    
    // Create a flag to track if we're showing the tooltip
    let isShowingTooltip = false;
    
    // If not found, set up a fallback using just the canvas
    canvas.addEventListener('mousemove', (event) => {
      // Try again to find the camera and renderer
      if (!this.camera || !this.renderer) {
        if (checkForThreeObjects()) return;
      }
      
      // If we still don't have them, we'll only show the tooltip when the user presses a key
      // This prevents the tooltip from showing all the time
      if (this._showFallbackTooltip) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        this._tooltip.innerHTML = `
          <div style="margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.3); padding-bottom: 5px;">
            Debug Information
          </div>
          <div>
            Hover detection active, but proper 3D picking unavailable.<br>
            Mouse position: (${mouseX.toFixed(3)}, ${mouseY.toFixed(3)})<br><br>
            <span style="color: #fcc419;">Press 'D' key to toggle this tooltip</span>
          </div>
        `;
        this._tooltip.style.display = 'block';
        this._tooltip.style.left = `${event.clientX + 15}px`;
        this._tooltip.style.top = `${event.clientY + 15}px`;
        
        // Ensure tooltip stays within viewport
        const tooltipRect = this._tooltip.getBoundingClientRect();
        if (tooltipRect.right > window.innerWidth) {
          this._tooltip.style.left = `${event.clientX - tooltipRect.width - 15}px`;
        }
        if (tooltipRect.bottom > window.innerHeight) {
          this._tooltip.style.top = `${event.clientY - tooltipRect.height - 15}px`;
        }
      } else {
        this._tooltip.style.display = 'none';
      }
    });
    
    canvas.addEventListener('mouseout', () => {
      this._tooltip.style.display = 'none';
    });
    
    // Add keyboard listener to toggle the fallback tooltip
    document.addEventListener('keydown', (event) => {
      if (event.key.toLowerCase() === 'd') {
        this._showFallbackTooltip = !this._showFallbackTooltip;
        console.log(`Fallback tooltip ${this._showFallbackTooltip ? 'enabled' : 'disabled'}`);
        
        if (!this._showFallbackTooltip) {
          this._tooltip.style.display = 'none';
        }
      }
    });
    
    // Set up a MutationObserver to watch for changes to the scene
    // This might help us detect when the renderer and camera become available
    const observer = new MutationObserver(() => {
      if (checkForThreeObjects()) {
        observer.disconnect();
      }
    });
    
    observer.observe(document.body, { 
      childList: true, 
      subtree: true,
      attributes: true
    });
    
    // Also try periodically
    const intervalId = setInterval(() => {
      if (checkForThreeObjects()) {
        clearInterval(intervalId);
      }
    }, 1000);
    
    // Store the interval ID so we can clear it if needed
    this._fallbackIntervalId = intervalId;
  }
  
  /**
   * Helper to collect all debug spheres from a given object and its children
   * @private
   */
  _collectDebugSpheres(object, result) {
    if (object.userData && object.userData.isDebugSphere) {
      result.push(object);
    }
    
    if (object.children && object.children.length > 0) {
      for (const child of object.children) {
        this._collectDebugSpheres(child, result);
      }
    }
  }
  
  /**
   * Helper to get the renderer
   * @private
   */
  _getRenderer() {
    // Use the stored renderer if available
    if (this.renderer) {
      return this.renderer;
    }
    
    // Try to find the renderer in the scene
    if (this.planet && this.planet.parent && this.planet.parent.parent) {
      const scene = this.planet.parent;
      if (scene.userData && scene.userData.renderer) {
        return scene.userData.renderer;
      }
    }
    
    // Fallback to the global renderer if available
    if (window.renderer) {
      return window.renderer;
    }
    
    // Try to find the first canvas element which might be the renderer's domElement
    const canvas = document.querySelector('canvas');
    if (canvas && canvas.__renderer) {
      return canvas.__renderer;
    }
    
    return null;
  }
  
  /**
   * Helper to get the camera
   * @private
   */
  _getCamera() {
    // Use the stored camera if available
    if (this.camera) {
      return this.camera;
    }
    
    // Try to find the camera in the scene
    if (this.planet && this.planet.parent && this.planet.parent.parent) {
      const scene = this.planet.parent;
      if (scene.userData && scene.userData.camera) {
        return scene.userData.camera;
      }
    }
    
    // Fallback to the global camera if available
    if (window.camera) {
      return window.camera;
    }
    
    return null;
  }
  
  /**
   * Add multiple debug spheres at different heights to find the correct one
   * @param {THREE.Vector3} direction - Normalized direction from planet center
   */
  addHeightTestSpheres(direction = new THREE.Vector3(1, 0, 0)) {
    // Normalize the direction
    direction.normalize();
    
    // Create spheres at different heights
    const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
    const scales = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
    
    console.log("Adding test spheres at different heights:");
    
    for (let i = 0; i < scales.length; i++) {
      // Calculate position at this scale
      const position = direction.clone().multiplyScalar(this.planetRadius * scales[i]);
      
      // Create a small sphere
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(this.planetRadius * 0.01, 8, 8),
        new THREE.MeshBasicMaterial({ color: colors[i], wireframe: true })
      );
      sphere.position.copy(position);
      
      // Add to scene
      if (this.planet && this.planet.parent) {
        this.planet.parent.add(sphere);
        console.log(`Added test sphere ${i+1}: scale=${scales[i]}, color=0x${colors[i].toString(16)}, position=${position.toArray()}`);
      }
    }
    
    return "Added test spheres at different heights";
  }
  
  /**
   * Manually set the renderer and camera for debug sphere interaction
   * @param {THREE.WebGLRenderer} renderer - The WebGL renderer
   * @param {THREE.Camera} camera - The camera
   */
  setRendererAndCamera(renderer, camera) {
    console.log("Manually setting renderer and camera");
    this.renderer = renderer;
    this.camera = camera;
    
    // Reset debug interaction setup so it will be initialized again
    this._debugInteractionSetup = false;
    
    // Clear any fallback interval
    if (this._fallbackIntervalId) {
      clearInterval(this._fallbackIntervalId);
      this._fallbackIntervalId = null;
    }
    
    // Set up debug sphere interaction again
    this._setupDebugSphereInteraction();
    
    return this;
  }
  
  /**
   * Debug method to test tooltip visibility
   * @param {boolean} show - Whether to show or hide the tooltip
   * @param {string} message - Optional message to display in the tooltip
   */
  debugTooltip(show = true, message = 'Debug tooltip test') {
    if (!this._tooltip) {
      console.warn('Tooltip not initialized yet');
      return;
    }
    
    if (show) {
      this._tooltip.innerHTML = `
        <div style="margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.3); padding-bottom: 5px;">
          Debug Information
        </div>
        <div>
          ${message}
        </div>
      `;
      this._tooltip.style.display = 'block';
      this._tooltip.style.left = '50%';
      this._tooltip.style.top = '50%';
      this._tooltip.style.transform = 'translate(-50%, -50%)';
    } else {
      this._tooltip.style.display = 'none';
    }
    
    return this;
  }
} 