
class EdgeBox {
    constructor() {
        this.edgeList = [];
        this.fieldList = [];
    }
}

class EdgeSegment {
    constructor(collComp, activeFlagPtr, collisionGroup) {
        this.collisionComponent = collComp;
        this.activeFlagPtr = activeFlagPtr;
        this.collisionGroup = collisionGroup;
        this.processedFlag = 0;
    }
    
    findCollisionDistance(ray) { return 1e9; }
    getNormal(point) { return new Vector2(0, 1); }
    getDirection(point) { return new Vector2(1, 0); }
}

class LineEdge extends EdgeSegment {
    constructor(collComp, activeFlagPtr, group, start, end) {
        super(collComp, activeFlagPtr, group);
        this.origin = new Vector2(start.x, start.y);
        this.end = new Vector2(end.x, end.y);
        const dir = this.end.sub(this.origin);
        this.length = dir.magnitude();
        this.direction = dir.mul(1 / this.length);
        
        // Match maths.cpp line_init
        if (Math.abs(this.direction.x) < 1e-9) {
            this.direction.x = 0;
            this.minCoord = Math.min(start.y, end.y);
            this.maxCoord = Math.max(start.y, end.y);
        } else {
            this.minCoord = Math.min(start.x, end.x);
            this.maxCoord = Math.max(start.x, end.x);
        }
    }

    findCollisionDistance(ray) {
        return Maths.ray_intersect_line(ray, this);
    }

    getNormal(point) {
        return new Vector2(-this.direction.y, this.direction.x);
    }

    getDirection(point) {
        return this.direction;
    }
}

class CircleEdge extends EdgeSegment {
    constructor(collComp, activeFlagPtr, group, center, radius) {
        super(collComp, activeFlagPtr, group);
        this.center = new Vector2(center.x, center.y);
        this.radius = radius;
        this.radiusSq = radius * radius;
    }

    findCollisionDistance(ray) {
        return Maths.ray_intersect_circle(ray, this);
    }

    getNormal(point) {
        const n = point.sub(this.center);
        n.normalize();
        return n;
    }

    getDirection(point) {
        const n = this.getNormal(point);
        return new Vector2(n.y, -n.x);
    }
}

class FlipperCapsuleEdge extends EdgeSegment {
    constructor(collComp, activeFlagPtr, group, origin, tip, radius) {
        super(collComp, activeFlagPtr, group);
        this.origin = new Vector2(origin.x, origin.y);
        this.tip = new Vector2(tip.x, tip.y);
        this.radius = radius;
        this.radiusSq = radius * radius;
        this.lastNormal = new Vector2(0, -1);
    }

    setGeometry(origin, tip, radius = this.radius) {
        this.origin.x = origin.x;
        this.origin.y = origin.y;
        this.tip.x = tip.x;
        this.tip.y = tip.y;
        if (radius !== this.radius) {
            this.radius = radius;
            this.radiusSq = radius * radius;
        }
    }

    findCollisionDistance(ray) {
        let bestDistance = 1e9;
        let bestNormal = null;
        const rayOrigin = ray.origin;
        const rayDir = ray.direction;

        const checkCircle = (center) => {
            const distance = Maths.ray_intersect_circle(ray, { center, radiusSq: this.radiusSq });
            if (distance < bestDistance && distance <= ray.maxDistance) {
                const point = rayOrigin.add(rayDir.mul(distance));
                const normal = point.sub(center);
                if (normal.normalize() > 1e-9) {
                    bestDistance = distance;
                    bestNormal = normal;
                }
            }
        };

        checkCircle(this.origin);
        checkCircle(this.tip);

        const segment = this.tip.sub(this.origin);
        const segLength = segment.magnitude();
        if (segLength > 1e-9) {
            const tangent = segment.mul(1 / segLength);
            const normalA = new Vector2(-tangent.y, tangent.x);
            const normalB = new Vector2(tangent.y, -tangent.x);
            const rel = rayOrigin.sub(this.origin);
            const dist0 = rel.dot(normalA);
            const distDir = rayDir.dot(normalA);
            if (Math.abs(distDir) > 1e-9) {
                const checkSide = (offset, sideNormal) => {
                    const distance = (offset - dist0) / distDir;
                    if (distance < 0 || distance > ray.maxDistance || distance >= bestDistance) return;
                    const point = rayOrigin.add(rayDir.mul(distance));
                    const along = point.sub(this.origin).dot(tangent);
                    if (along >= 0 && along <= segLength) {
                        bestDistance = distance;
                        bestNormal = sideNormal;
                    }
                };
                checkSide(this.radius, normalA);
                checkSide(-this.radius, normalB);
            }
        }

        if (bestNormal) {
            this.lastNormal = bestNormal;
        }
        return bestDistance;
    }

    getNormal(point) {
        return this.lastNormal;
    }

    getDirection(point) {
        return new Vector2(this.lastNormal.y, -this.lastNormal.x);
    }
}

class EdgeManager {
    constructor(xMin, yMin, width, height) {
        this.minX = xMin;
        this.minY = yMin;
        this.width = width;
        this.height = height;
        this.maxX = xMin + width;
        this.maxY = yMin + height;
        this.maxBoxX = 10;
        this.maxBoxY = 15;
        this.advanceX = width / this.maxBoxX;
        this.advanceY = height / this.maxBoxY;
        this.boxes = Array.from({length: this.maxBoxX * this.maxBoxY}, () => new EdgeBox());
        this.edgeArray = [];
    }

    boxX(x) {
        return Math.max(0, Math.min(Math.floor((x - this.minX) / this.advanceX), this.maxBoxX - 1));
    }

    boxY(y) {
        return Math.max(0, Math.min(Math.floor((y - this.minY) / this.advanceY), this.maxBoxY - 1));
    }

    addEdgeToBox(x, y, edge) {
        if (x >= 0 && x < this.maxBoxX && y >= 0 && y < this.maxBoxY) {
            this.boxes[y * this.maxBoxX + x].edgeList.push(edge);
        }
    }

    testGridBox(x, y, distObj, ray, ball) {
        if (x >= 0 && x < this.maxBoxX && y >= 0 && y < this.maxBoxY) {
            const box = this.boxes[y * this.maxBoxX + x];
            for (let i = box.edgeList.length - 1; i >= 0; i--) {
                const edge = box.edgeList[i];
                if (!edge.processedFlag && edge.activeFlagPtr.value && (edge.collisionGroup & ray.collisionMask) !== 0) {
                    if (!ball.alreadyHit.includes(edge)) {
                        edge.processedFlag = 1;
                        this.edgeArray.push(edge);
                        const dist = edge.findCollisionDistance(ray);
                        if (dist < distObj.distance) {
                            distObj.distance = dist;
                            distObj.edge = edge;
                        }
                    }
                }
            }
        }
    }

    findCollision(origin, direction, speed, dt, radius, collisionMask, ball) {
        const ray = {
            origin: origin,
            direction: direction,
            maxDistance: speed * dt,
            collisionMask: collisionMask || 0xFFFFFFFF
        };
        if (ray.maxDistance < 0.001) return null;

        const distObj = { distance: 1e9, edge: null };
        this.edgeArray = [];

        const x0 = ray.origin.x;
        const y0 = ray.origin.y;
        const x1 = x0 + ray.direction.x * ray.maxDistance;
        const y1 = y0 + ray.direction.y * ray.maxDistance;

        const xBox0 = this.boxX(x0);
        const yBox0 = this.boxY(y0);
        const xBox1 = this.boxX(x1);
        const yBox1 = this.boxY(y1);

        const dirX = x0 >= x1 ? -1 : 1;
        const dirY = y0 >= y1 ? -1 : 1;

        if (yBox0 === yBox1) {
            for (let ix = xBox0; dirX === 1 ? ix <= xBox1 : ix >= xBox1; ix += dirX) {
                this.testGridBox(ix, yBox0, distObj, ray, ball);
            }
        } else if (xBox0 === xBox1) {
            for (let iy = yBox0; dirY === 1 ? iy <= yBox1 : iy >= yBox1; iy += dirY) {
                this.testGridBox(xBox0, iy, distObj, ray, ball);
            }
        } else {
            this.testGridBox(xBox0, yBox0, distObj, ray, ball);
            const dyDx = (y0 - y1) / (x0 - x1);
            const precomp = -x0 * dyDx + y0;
            const xBias = dirX === 1 ? 1 : 0;
            const yBias = dirY === 1 ? 1 : 0;

            let ix = xBox0, iy = yBox0;
            while (ix !== xBox1 || iy !== yBox1) {
                const yDiscrete = (iy + yBias) * this.advanceY + this.minY;
                const yLinear = ((ix + xBias) * this.advanceX + this.minX) * dyDx + precomp;
                
                if (dirY === 1 ? yLinear >= yDiscrete : yLinear <= yDiscrete) {
                    iy += dirY;
                    if (yLinear === yDiscrete) ix += dirX;
                } else {
                    ix += dirX;
                }
                this.testGridBox(ix, iy, distObj, ray, ball);
            }
        }

        for (const edge of this.edgeArray) {
            edge.processedFlag = 0;
        }

        if (distObj.edge && distObj.distance <= ray.maxDistance + 0.1) {
            return {
                edge: distObj.edge,
                distance: distObj.distance,
                point: ray.origin.add(ray.direction.mul(distObj.distance))
            };
        }
        return null;
    }
}
