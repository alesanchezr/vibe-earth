import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const basePath = '/assets/vegetation/';

const lowPolyNatureCollectionModels = {
    Rock: {
        versions: 7,
        materials: ['Gray']
    },
    PineTree: {
        versions: 5,
        materials: ['Brown', 'Green']
    }
};

const lowPolyNatureCollection = {
    models: lowPolyNatureCollectionModels,
    name: 'lowpoly_nature'
};

const collections = {
    lowpoly_nature: lowPolyNatureCollection
};

/**
 * Get all available model names from a collection
 * @param {string} collection - Collection name
 * @returns {string[]} Array of model names
 */
export function getModels(collection = 'lowpoly_nature') {
    return Object.keys(collections[collection].models);
}

/**
 * Get model paths and materials for a specific model
 * @param {string} name - Model name
 * @param {string} collection - Collection name
 * @returns {{filePaths: string[], materials: string[]}|null} Model info or null if not found
 */
export function getModelPathsAndMaterials(name, collection = 'lowpoly_nature') {
    const model = collections[collection].models[name];
    if (!model) {
        console.error(`Model ${name} not found.`);
        return null;
    }

    // Construct file paths based on the number of versions
    const filePaths = [];
    if (model.versions) {
        for (let i = 1; i <= model.versions; i++) {
            // Remove the collection name from the path since files are directly in vegetation folder
            filePaths.push(`${basePath}${name}_${i}.gltf`);
        }
    } else {
        filePaths.push(`${basePath}${name}.gltf`);
    }

    return {
        filePaths,
        materials: model.materials
    };
}

/**
 * Load models from GLTF files
 * @param {string} name - Model name
 * @param {string} collection - Collection name
 * @returns {Promise<THREE.Object3D[]>} Array of loaded models
 */
export async function loadModels(name, collection = 'lowpoly_nature') {
    const loader = new GLTFLoader();
    const modelInfo = getModelPathsAndMaterials(name, collection);

    if (!modelInfo) {
        return [];
    }

    const promises = modelInfo.filePaths.map(filePath => {
        return new Promise((resolve, reject) => {
            loader.load(
                filePath,
                (gltf) => {
                    gltf.scene.userData = {
                        name,
                        path: filePath
                    };
                    gltf.scene.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            child.receiveShadow = true;
                            child.castShadow = false;
                        }
                    });
                    resolve(gltf.scene);
                },
                undefined,
                (error) => {
                    console.error(`Failed to load model ${filePath}:`, error);
                    reject(error);
                }
            );
        });
    });

    return Promise.all(promises);
} 