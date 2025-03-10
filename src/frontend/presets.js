// Biome presets for different planet types
const beachBiome = {
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
    [-0.5, 0x994400],
    [-0.0, 0xccaa00],
    [0.4, 0xcc7700],
    [1.0, 0x002222],
  ],

  seaColors: [
    [-1, 0x000066],
    [-0.55, 0x0000aa],
    [-0.1, 0x00f2e5],
  ],
  seaNoise: {
    min: -0.008,
    max: 0.008,
    scale: 6,
  },

  vegetation: {
    items: [
      {
        name: 'Rock',
        density: 50,
        minimumHeight: 0.1,
        colors: {
          Gray: { array: [0x775544] },
        },
      },
      {
        name: 'PalmTree',
        density: 50,
        minimumHeight: 0.1,
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
};

const forestBiome = {
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
    power: 0.8,
  },

  tintColor: 0x113322,

  colors: [
    [-0.5, 0x332200],
    [-0.0, 0x115512],
    [0.4, 0x224411],
    [1.0, 0x006622],
  ],

  seaColors: [
    [-1, 0x000066],
    [-0.52, 0x0000aa],
    [-0.1, 0x0042a5],
  ],
  seaNoise: {
    min: -0.005,
    max: 0.005,
    scale: 5,
  },

  vegetation: {
    items: [
      {
        name: 'Rock',
        density: 5,
        minimumHeight: 0.1,
        colors: {
          Gray: { array: [0x888888, 0x616161, 0x414141] },
        },
      },
      {
        name: 'CommonTree',
        density: 5,
        minimumHeight: 0.0,
      },
      {
        name: 'Bush',
        density: 5,
        minimumHeight: 0.0,
      },
      {
        name: 'PineTree',
        density: 5,
      },
      {
        name: 'TreeStump',
        density: 1,
      },
      {
        name: 'TreeStump_Moss',
        density: 1,
      },
      {
        name: 'Willow',
        density: 5,
      },
      {
        name: 'WoodLog',
        density: 1,
      },
    ],
  },
};

const snowForestBiome = {
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
    power: 0.8,
  },

  tintColor: 0x119922,

  colors: [
    [-0.5, 0xff99ff],
    [-0.0, 0xffffff],
    [0.4, 0xeeffff],
    [1.0, 0xffffff],
  ],

  seaColors: [
    [-1, 0x8899cc],
    [-0.52, 0xaaccff],
    [-0.1, 0xaaccff],
  ],
  seaNoise: {
    min: -0.0,
    max: 0.001,
    scale: 5,
  },

  vegetation: {
    items: [
      {
        name: 'Rock_Snow',
        density: 5,
        minimumHeight: 0.1,
        colors: {
          Gray: { array: [0x888888, 0x616161, 0x414141] },
        },
      },
      {
        name: 'CommonTree_Snow',
        density: 5,
        minimumHeight: 0.0,
      },
      {
        name: 'Bush_Snow',
        density: 5,
        minimumHeight: 0.0,
      },
      {
        name: 'PineTree_Snow',
        density: 5,
      },
      {
        name: 'TreeStump_Snow',
        density: 1,
      },
      {
        name: 'Willow_Snow',
        density: 5,
      },
      {
        name: 'WoodLog_Snow',
        density: 1,
      },
    ],
  },
};

const desertBiome = {
  noise: {
    min: -0.03,
    max: 0.03,
    octaves: 4,
    lacunarity: 2.0,
    gain: {
      min: 0.1,
      max: 0.6,
      scale: 1.5,
    },
    warp: 0.4,
    scale: 0.8,
    power: 1.2,
  },

  tintColor: 0xcc8844,

  colors: [
    [-0.5, 0xcc8833],
    [-0.0, 0xddaa44],
    [0.4, 0xeecc66],
    [1.0, 0xffddaa],
  ],

  seaColors: [
    [-1, 0x000044],
    [-0.52, 0x000088],
    [-0.1, 0x0066aa],
  ],
  seaNoise: {
    min: -0.002,
    max: 0.002,
    scale: 4,
  },

  vegetation: {
    items: [
      {
        name: 'Rock',
        density: 3,
        minimumHeight: 0.1,
        colors: {
          Gray: { array: [0xcc8844, 0xaa7733, 0x886622] },
        },
      },
      {
        name: 'Cactus',
        density: 2,
        minimumHeight: 0.0,
        colors: {
          Green: { array: [0x116611, 0x227722] },
        },
      },
      {
        name: 'CactusFlowers',
        density: 1,
        minimumHeight: 0.0,
        colors: {
          Green: { array: [0x116611, 0x227722] },
          Pink: { array: [0xff88aa, 0xff99bb] },
        },
      },
    ],
  },
};

export const biomePresets = {
  beach: beachBiome,
  forest: forestBiome,
  snowForest: snowForestBiome,
  desert: desertBiome,
};

// Planet configuration presets
const beachPlanet = {
  biome: {
    preset: 'beach',
  },
  detail: 50,
  scatter: 1.2,
  atmosphere: {
    enabled: true,
    color: { r: 0.1, g: 0.3, b: 0.6 },
    height: 0.1,
  },
  shape: 'sphere',
};

const forestPlanet = {
  biome: {
    preset: 'forest',
  },
  detail: 50,
  scatter: 1.1,
  atmosphere: {
    enabled: true,
    color: { r: 0.2, g: 0.4, b: 0.1 },
    height: 0.08,
  },
  shape: 'sphere',
};

const snowForestPlanet = {
  biome: {
    preset: 'snowForest',
  },
  detail: 50,
  scatter: 1.3,
  atmosphere: {
    enabled: true,
    color: { r: 0.4, g: 0.6, b: 0.8 },
    height: 0.12,
  },
  shape: 'sphere',
};

const desertPlanet = {
  biome: {
    preset: 'desert',
  },
  detail: 50,
  scatter: 0.8,
  atmosphere: {
    enabled: true,
    color: { r: 0.6, g: 0.4, b: 0.2 },
    height: 0.15,
  },
  shape: 'sphere',
};

export const planetPresets = {
  beach: beachPlanet,
  forest: forestPlanet,
  snowForest: snowForestPlanet,
  desert: desertPlanet,
}; 