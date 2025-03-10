import { Vector3 } from 'three';

class OctreeNode extends Vector3 {
  constructor(x = 0, y = 0, z = 0, data = null) {
    super(x, y, z);
    this.data = data;
  }
}

export class Octree {
  constructor(maxDepth = 8, maxPoints = 8) {
    this.maxDepth = maxDepth;
    this.maxPoints = maxPoints;
    this.root = {
      bounds: {
        min: new Vector3(-1000, -1000, -1000),
        max: new Vector3(1000, 1000, 1000),
      },
      points: [],
      children: null,
    };
  }

  insert(x, y, z, data = null) {
    const point = new OctreeNode(x, y, z, data);
    this._insert(this.root, point, 0);
  }

  _insert(node, point, depth) {
    if (depth === this.maxDepth || (node.points && node.points.length < this.maxPoints)) {
      if (!node.points) node.points = [];
      node.points.push(point);
      return;
    }

    if (!node.children) {
      this._split(node);
    }

    const octant = this._getOctant(point, node.bounds);
    this._insert(node.children[octant], point, depth + 1);
  }

  _split(node) {
    const center = new Vector3()
      .addVectors(node.bounds.min, node.bounds.max)
      .multiplyScalar(0.5);

    node.children = new Array(8).fill(null).map((_, i) => {
      const min = new Vector3();
      const max = new Vector3();

      min.x = i & 1 ? center.x : node.bounds.min.x;
      min.y = i & 2 ? center.y : node.bounds.min.y;
      min.z = i & 4 ? center.z : node.bounds.min.z;

      max.x = i & 1 ? node.bounds.max.x : center.x;
      max.y = i & 2 ? node.bounds.max.y : center.y;
      max.z = i & 4 ? node.bounds.max.z : center.z;

      return {
        bounds: { min, max },
        points: [],
        children: null,
      };
    });

    // Redistribute existing points
    if (node.points) {
      node.points.forEach(point => {
        const octant = this._getOctant(point, node.bounds);
        node.children[octant].points.push(point);
      });
      node.points = null;
    }
  }

  _getOctant(point, bounds) {
    const center = new Vector3()
      .addVectors(bounds.min, bounds.max)
      .multiplyScalar(0.5);

    let octant = 0;
    if (point.x >= center.x) octant |= 1;
    if (point.y >= center.y) octant |= 2;
    if (point.z >= center.z) octant |= 4;
    return octant;
  }

  queryBoxXYZ(x, y, z, radius) {
    const point = new Vector3(x, y, z);
    const results = [];
    this._queryBox(this.root, point, radius, results);
    return results;
  }

  _queryBox(node, point, radius, results) {
    if (!this._intersectsSphere(node.bounds, point, radius)) {
      return;
    }

    if (node.points) {
      node.points.forEach(p => {
        if (point.distanceTo(p) <= radius) {
          results.push(p);
        }
      });
      return;
    }

    if (node.children) {
      node.children.forEach(child => {
        this._queryBox(child, point, radius, results);
      });
    }
  }

  _intersectsSphere(bounds, center, radius) {
    let dmin = 0;
    const r2 = radius * radius;

    ['x', 'y', 'z'].forEach(axis => {
      if (center[axis] < bounds.min[axis]) {
        const d = center[axis] - bounds.min[axis];
        dmin += d * d;
      } else if (center[axis] > bounds.max[axis]) {
        const d = center[axis] - bounds.max[axis];
        dmin += d * d;
      }
    });

    return dmin <= r2;
  }

  clear() {
    this.root = {
      bounds: {
        min: new Vector3(-1000, -1000, -1000),
        max: new Vector3(1000, 1000, 1000),
      },
      points: [],
      children: null,
    };
  }
} 