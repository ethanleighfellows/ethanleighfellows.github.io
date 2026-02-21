class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }
    add(v) { return new Vector2(this.x + v.x, this.y + v.y); }
    sub(v) { return new Vector2(this.x - v.x, this.y - v.y); }
    mul(scalar) { return new Vector2(this.x * scalar, this.y * scalar); }
    dot(v) { return this.x * v.x + this.y * v.y; }
    magnitude() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    normalize() {
        const mag = this.magnitude();
        if (mag !== 0) { this.x /= mag; this.y /= mag; }
        return mag;
    }
}

class Vector3 extends Vector2 {
    constructor(x = 0, y = 0, z = 0) {
        super(x, y);
        this.z = z;
    }
}

class Proj {
    static matrix = {
        row0: { x: 1.0, y: 0.0, z: 0.0, w: 0.0 },
        row1: { x: 0.0, y: -0.913545, z: 0.406737, w: 3.791398 },
        row2: { x: 0.0, y: -0.406737, z: -0.913545, w: 24.675402 }
    };
    static d = -400.0007;
    static centerX = 320; // Default screen center
    static centerY = 240;

    static init(centerX, centerY, dOverride = null) {
        this.centerX = centerX;
        this.centerY = centerY;
        if (typeof dOverride === 'number' && Number.isFinite(dOverride)) {
            this.d = dOverride;
        }
    }

    static setCamera(cameraFloats) {
        if (!cameraFloats || cameraFloats.length < 15) return;
        this.matrix = {
            row0: { x: cameraFloats[0], y: cameraFloats[1], z: cameraFloats[2], w: cameraFloats[3] },
            row1: { x: cameraFloats[4], y: cameraFloats[5], z: cameraFloats[6], w: cameraFloats[7] },
            row2: { x: cameraFloats[8], y: cameraFloats[9], z: cameraFloats[10], w: cameraFloats[11] }
        };
        this.d = cameraFloats[12];
    }

    static xformTo2d(v3) {
        const x = v3.x, y = v3.y, z = v3.z;
        const m = this.matrix;
        
        // C++ matrix_vector_multiply logic
        const px = z * m.row0.z + y * m.row0.y + x * m.row0.x + m.row0.w;
        const py = z * m.row1.z + y * m.row1.y + x * m.row1.x + m.row1.w;
        const pz = z * m.row2.z + y * m.row2.y + x * m.row2.x + m.row2.w;

        const projCoef = this.d / pz;
        
        // Ground Truth Screen Transformation: Standard addition, no double inversion
        return {
            x: px * projCoef + this.centerX,
            y: py * projCoef + this.centerY
        };
    }
}

class Maths {
    static normalize_2d(vec) { return vec.normalize(); }
    static dot(v1, v2) { return v1.x * v2.x + v1.y * v2.y; }
    static cross(v1, v2) { return v1.x * v2.y - v1.y * v2.x; }
    static distanceSq(v1, v2) {
        const dx = v1.x - v2.x, dy = v1.y - v2.y;
        return dx * dx + dy * dy;
    }

    static basic_collision(ball, nextPosition, direction, elasticity, smoothness, threshold, boost) {
        const stepOut = Math.max(0.0005, (ball?.radius ?? 0.15) * 0.05);
        ball.position.x = nextPosition.x + direction.x * stepOut;
        ball.position.y = nextPosition.y + direction.y * stepOut;

        let reboundProj = -Maths.dot(direction, ball.direction);
        if (reboundProj < 0) {
            reboundProj = -reboundProj;
        } else {
            let dx1 = reboundProj * direction.x;
            let dy1 = reboundProj * direction.y;
            ball.direction.x = (dx1 + ball.direction.x) * smoothness + dx1 * elasticity;
            ball.direction.y = (dy1 + ball.direction.y) * smoothness + dy1 * elasticity;
            Maths.normalize_2d(ball.direction);
        }

        let reboundSpeed = reboundProj * ball.speed;
        ball.speed -= (1.0 - elasticity) * reboundSpeed;

        if (reboundSpeed >= threshold) {
            ball.direction.x = ball.speed * ball.direction.x + direction.x * boost;
            ball.direction.y = ball.speed * ball.direction.y + direction.y * boost;
            ball.speed = Maths.normalize_2d(ball.direction);
        }
        return reboundSpeed;
    }

    static ray_intersect_circle(ray, circle) {
        const L = circle.center.sub(ray.origin);
        const tca = Maths.dot(L, ray.direction);
        const LMagSq = Maths.dot(L, L);
        const thc_sq = circle.radiusSq - LMagSq + tca * tca;
        if (LMagSq < circle.radiusSq) return tca + Math.sqrt(thc_sq);
        if (tca < 0 || thc_sq < 0) return 1e9;
        const t0 = tca - Math.sqrt(thc_sq);
        if (t0 < 0 || t0 > ray.maxDistance) return 1e9;
        return t0;
    }

    static ray_intersect_line(ray, line) {
        const v1 = ray.origin.sub(line.origin);
        const v2 = line.direction;
        const v3 = new Vector2(-ray.direction.y, ray.direction.x);
        const v2DotV3 = Maths.dot(v2, v3);
        if (v2DotV3 < 0) {
            const distance = Maths.cross(v2, v1) / v2DotV3;
            if (distance >= 0 && distance <= ray.maxDistance) {
                const intersectX = distance * ray.direction.x + ray.origin.x;
                const intersectY = distance * ray.direction.y + ray.origin.y;
                const dot = (line.direction.x !== 0) ? intersectX : intersectY;
                if (dot >= line.minCoord && dot <= line.maxCoord) return distance;
            }
        }
        return 1e9;
    }
}
