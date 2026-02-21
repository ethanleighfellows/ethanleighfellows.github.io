class TPinballComponent {
    constructor(table, groupIndex) {
        this.table = table;
        this.groupIndex = groupIndex;
        this.groupName = "";
        this.activeFlagPtr = { value: true };
        this.visualStates = [];
        this.currentState = 0;
        
        if (groupIndex >= 0 && table.game.loader.datFile) {
            const dat = table.game.loader.datFile;
            const group = dat.groups[groupIndex];
            this.groupName = group.groupName;
            for (let i = 0; i < 10; i++) {
                const idx = groupIndex + i;
                if (idx >= dat.groups.length) break;
                const bmp = dat.getBitmap(idx, 0);
                if (bmp) {
                    this.visualStates.push({
                        bitmap: bmp,
                        zMap: dat.groups[idx].zMaps[0]
                    });
                } else if (i > 0) break;
            }
        }
        table.components.push(this);
    }

    update(dt) {}
    render(renderer) {
        if (this.activeFlagPtr.value && this.visualStates[this.currentState]) {
            const state = this.visualStates[this.currentState];
            renderer.drawBitmap(state.bitmap, undefined, undefined, state.zMap);
        }
    }
    onCollision(ball, point, edge) {
        Maths.basic_collision(ball, point, edge.getNormal(point), 0.6, 0.95, 1e9, 0);
    }
}

class TCollisionComponent extends TPinballComponent {
    constructor(table, groupIndex, createWall) {
        super(table, groupIndex);
        this.elasticity = 0.6;
        this.smoothness = 0.95;
        this.threshold = 1e9;
        this.boost = 0;
        this.edgeList = [];
        this.collisionGroup = 1;
        this.wallPadding = 0;
        this.visualInfo = null;
        if (groupIndex >= 0) {
            const queryVisualInfo = table?.game?.loader?.queryVisualInfo;
            if (typeof queryVisualInfo === "function") {
                this.visualInfo = queryVisualInfo.call(table.game.loader, groupIndex);
            }
            if (this.visualInfo) {
                this.collisionGroup = this.visualInfo.collisionGroup || this.collisionGroup;
                if (Number.isFinite(this.visualInfo.elasticity)) this.elasticity = this.visualInfo.elasticity;
                if (Number.isFinite(this.visualInfo.smoothness)) this.smoothness = this.visualInfo.smoothness;
                if (Number.isFinite(this.visualInfo.threshold)) this.threshold = this.visualInfo.threshold;
                if (Number.isFinite(this.visualInfo.boost)) this.boost = this.visualInfo.boost;
            }
        }
        if (groupIndex >= 0 && createWall) this.installWall(groupIndex);
    }

    installWall(groupIdx, options = {}) {
        const dat = this.table.game.loader.datFile;
        const floatArr = options.floatArr || dat.query_float_attribute(groupIdx, 600);
        if (!floatArr) return;
        const activeFlagPtr = options.activeFlagPtr || this.activeFlagPtr;
        const collisionGroup = options.collisionGroup || this.collisionGroup;
        const collisionOffset = options.collisionOffset ?? this.wallPadding ?? 0;
        const offsetSegment = (start, end, offset) => {
            if (!offset) return { start, end };
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const len = Math.hypot(dx, dy);
            if (len < 1e-9) return { start, end };
            const offX = (-dy / len) * offset;
            const offY = (dx / len) * offset;
            return {
                start: { x: start.x + offX, y: start.y + offY },
                end: { x: end.x + offX, y: end.y + offY }
            };
        };

        const wallType = Math.floor(floatArr[0] - 1.0);
        if (wallType === 0) {
            const center = { x: floatArr[1], y: floatArr[2] }, radius = floatArr[3] + collisionOffset;
            const edge = new CircleEdge(this, activeFlagPtr, collisionGroup, center, radius);
            this.edgeList.push(edge);
            this.placeInGrid(edge, center.x-radius, center.y-radius, center.x+radius, center.y+radius);
        } else if (wallType === 1) {
            const seg = offsetSegment(
                { x: floatArr[1], y: floatArr[2] },
                { x: floatArr[3], y: floatArr[4] },
                collisionOffset
            );
            const edge = new LineEdge(this, activeFlagPtr, collisionGroup, seg.start, seg.end);
            this.edgeList.push(edge);
            this.placeInGrid(edge, seg.start.x, seg.start.y, seg.end.x, seg.end.y);
        } else {
            const edgeCount = wallType;
            if (edgeCount < 2 || floatArr.length < 1 + edgeCount * 2) return;

            let prevCenter = {
                x: floatArr[2 * edgeCount - 1],
                y: floatArr[2 * edgeCount]
            };
            for (let i = 0; i < edgeCount; i++) {
                const idx = 1 + i * 2;
                const x1 = floatArr[idx], y1 = floatArr[idx + 1];
                const x2 = i >= edgeCount - 1 ? floatArr[1] : floatArr[idx + 2];
                const y2 = i >= edgeCount - 1 ? floatArr[2] : floatArr[idx + 3];

                if (collisionOffset !== 0) {
                    const vec1 = { x: x1 - prevCenter.x, y: y1 - prevCenter.y };
                    const vec2 = { x: x2 - x1, y: y2 - y1 };
                    const cross = Maths.cross(vec1, vec2);
                    if ((cross > 0 && collisionOffset > 0) || (cross < 0 && collisionOffset < 0)) {
                        const vertexRadius = Math.abs(collisionOffset) * 1.001;
                        const circle = new CircleEdge(
                            this,
                            activeFlagPtr,
                            collisionGroup,
                            { x: x1, y: y1 },
                            vertexRadius
                        );
                        this.edgeList.push(circle);
                        this.placeInGrid(
                            circle,
                            x1 - vertexRadius,
                            y1 - vertexRadius,
                            x1 + vertexRadius,
                            y1 + vertexRadius
                        );
                    }
                }

                const seg = offsetSegment({ x: x1, y: y1 }, { x: x2, y: y2 }, collisionOffset);
                const line = new LineEdge(this, activeFlagPtr, collisionGroup, seg.start, seg.end);
                this.edgeList.push(line);
                this.placeInGrid(line, seg.start.x, seg.start.y, seg.end.x, seg.end.y);
                prevCenter = { x: x1, y: y1 };
            }
        }
    }

    placeInGrid(edge, x1, y1, x2, y2) {
        const startX = this.table.edgeManager.boxX(Math.min(x1, x2)-5), endX = this.table.edgeManager.boxX(Math.max(x1, x2)+5);
        const startY = this.table.edgeManager.boxY(Math.min(y1, y2)-5), endY = this.table.edgeManager.boxY(Math.max(y1, y2)+5);
        for (let y = startY; y <= endY; y++) for (let x = startX; x <= endX; x++) this.table.edgeManager.addEdgeToBox(x, y, edge);
    }

    onCollision(ball, point, edge) {
        Maths.basic_collision(ball, point, edge.getNormal(point), this.elasticity, this.smoothness, this.threshold, this.boost);
    }
}

class TTableLayer extends TCollisionComponent {
    constructor(table) {
        super(table, -1, false);
        const dat = table.game.loader.datFile;
        const groupIndex = dat.record_labeled("table");
        if (groupIndex === -1) return;

        const tableBmp = dat.getBitmap(groupIndex, 0);
        if (tableBmp) { table.xOffset = tableBmp.x; table.yOffset = tableBmp.y; }

        const cameraGroup = dat.record_labeled("camera_info");
        if (cameraGroup !== -1) {
            const cameraBuffer = dat.field(cameraGroup, FieldTypes.FloatArray);
            if (cameraBuffer && cameraBuffer.byteLength >= 15 * 4) {
                const view = new DataView(cameraBuffer);
                const cameraFloats = new Float32Array(15);
                for (let i = 0; i < 15; i++) cameraFloats[i] = view.getFloat32(i * 4, true);
                Proj.setCamera(cameraFloats);
            }
        }

        const projCenter = dat.query_float_attribute(groupIndex, 700);
        if (projCenter) Proj.init(projCenter[0] + table.xOffset, projCenter[1] + table.yOffset);

        const boundaryArr = dat.query_float_attribute(groupIndex, 600);
        if (boundaryArr && boundaryArr.length >= 3) {
            const count = Math.floor(boundaryArr[0] - 1.0);
            if (count > 2 && boundaryArr.length >= 1 + count * 2) {
                let xMin = 1e9, yMin = 1e9, xMax = -1e9, yMax = -1e9;
                for (let i = 0; i < count; i++) {
                    const x = boundaryArr[1 + i * 2], y = boundaryArr[2 + i * 2];
                    xMin = Math.min(xMin, x); xMax = Math.max(xMax, x);
                    yMin = Math.min(yMin, y); yMax = Math.max(yMax, y);
                }
                table.edgeManager = new EdgeManager(xMin, yMin, xMax - xMin, yMax - yMin);
                const edgeThickness = Math.max(0.02, table.ball.radius * 0.22);
                for (let i = 0; i < count; i++) {
                    const x1 = boundaryArr[1 + i * 2], y1 = boundaryArr[2 + i * 2];
                    const nextIdx = (i + 1) % count;
                    const x2 = boundaryArr[1 + nextIdx * 2], y2 = boundaryArr[2 + nextIdx * 2];
                    const line = new FlipperCapsuleEdge(this, this.activeFlagPtr, 1, {x:x1, y:y1}, {x:x2, y:y2}, edgeThickness);
                    this.edgeList.push(line);
                    this.placeInGrid(line, Math.min(x1, x2) - edgeThickness, Math.min(y1, y2) - edgeThickness, Math.max(x1, x2) + edgeThickness, Math.max(y1, y2) + edgeThickness);
                }
                console.log(`Physics Table Layer Initialized: ${count} boundary points.`);
            }
        }
    }
}

class TBumper extends TCollisionComponent {
    constructor(table, groupIndex) {
        super(table, groupIndex, true);
        this.threshold = 0; this.boost = 400; this.elasticity = 0.9;
    }
    onCollision(ball, point, edge) {
        super.onCollision(ball, point, edge);
        this.table.addScore(100);
        if (this.visualStates.length > 1) { this.currentState = 1; setTimeout(() => this.currentState = 0, 100); }
    }
}

class TFlipper extends TCollisionComponent {
    constructor(table, groupIndex, type) {
        super(table, groupIndex, false);
        this.type = type;
        this.inputPressed = false;
        this.angularVelocity = 0;
        this.collisionMult = 1;
        this.extendTime = 0.04;
        this.retractTime = 0.08;
        this.origin = null;
        this.restTip = null;
        this.activeTip = null;
        this.tipLength = 0;
        this.tipRadius = 0.3;
        this.baseRadius = 0.3;
        this.restAngle = 0;
        this.activeAngle = 0;
        this.currentAngle = 0;
        this.targetAngle = 0;
        this.flipperEdge = null;

        const dat = table.game.loader.datFile;
        const originAttr = dat.query_float_attribute(groupIndex, 800);
        const t1Attr = dat.query_float_attribute(groupIndex, 801);
        const t2Attr = dat.query_float_attribute(groupIndex, 802);
        const collMultAttr = dat.query_float_attribute(groupIndex, 803);
        const extendAttr = dat.query_float_attribute(groupIndex, 804);
        const retractAttr = dat.query_float_attribute(groupIndex, 805);

        if (!originAttr || !t1Attr || !t2Attr) return;

        this.collisionMult = Math.max(0.1, collMultAttr?.[0] ?? 1);
        this.extendTime = Math.max(0.01, extendAttr?.[0] ?? 0.04);
        this.retractTime = Math.max(0.01, retractAttr?.[0] ?? 0.08);

        this.origin = new Vector2(originAttr[0], originAttr[1]);
        this.restTip = new Vector2(t1Attr[0], t1Attr[1]);
        this.activeTip = new Vector2(t2Attr[0], t2Attr[1]);
        this.tipLength = this.restTip.sub(this.origin).magnitude();
        this.tipRadius = Math.max(0.08, (t1Attr[2] || 0.12) + this.table.ball.radius);
        this.baseRadius = Math.max(0.08, (originAttr[2] || 0.12) + this.table.ball.radius);

        this.restAngle = Math.atan2(this.restTip.y - this.origin.y, this.restTip.x - this.origin.x);
        this.activeAngle = Math.atan2(this.activeTip.y - this.origin.y, this.activeTip.x - this.origin.x);

        let delta = this.activeAngle - this.restAngle;
        while (delta > Math.PI) delta -= 2 * Math.PI;
        while (delta < -Math.PI) delta += 2 * Math.PI;
        this.activeAngle = this.restAngle + delta;

        this.currentAngle = this.restAngle;
        this.targetAngle = this.restAngle;

        const initialTip = this.computeTip(this.currentAngle);
        this.flipperEdge = new FlipperCapsuleEdge(this, this.activeFlagPtr, this.collisionGroup, this.origin, initialTip, this.tipRadius);
        this.edgeList.push(this.flipperEdge);
        this.edgeList.push(new CircleEdge(this, this.activeFlagPtr, this.collisionGroup, this.origin, this.baseRadius));

        const minX = Math.min(this.origin.x, this.restTip.x, this.activeTip.x) - this.tipRadius;
        const maxX = Math.max(this.origin.x, this.restTip.x, this.activeTip.x) + this.tipRadius;
        const minY = Math.min(this.origin.y, this.restTip.y, this.activeTip.y) - this.tipRadius;
        const maxY = Math.max(this.origin.y, this.restTip.y, this.activeTip.y) + this.tipRadius;
        this.placeInGrid(this.flipperEdge, minX, minY, maxX, maxY);
        this.placeInGrid(this.edgeList[this.edgeList.length - 1], this.origin.x - this.baseRadius, this.origin.y - this.baseRadius, this.origin.x + this.baseRadius, this.origin.y + this.baseRadius);
        this.syncVisualState();
    }

    computeTip(angle) {
        return new Vector2(
            this.origin.x + Math.cos(angle) * this.tipLength,
            this.origin.y + Math.sin(angle) * this.tipLength
        );
    }

    syncVisualState() {
        if (this.visualStates.length <= 1) return;
        const span = this.activeAngle - this.restAngle;
        const normalized = Math.abs(span) < 1e-9 ? 0 : (this.currentAngle - this.restAngle) / span;
        const frame = Math.round(Math.max(0, Math.min(1, normalized)) * (this.visualStates.length - 1));
        this.currentState = frame;
    }

    update(dt) {
        if (!this.flipperEdge || dt <= 0) return;
        const previousAngle = this.currentAngle;
        const delta = this.targetAngle - this.currentAngle;
        if (Math.abs(delta) > 1e-6) {
            const duration = this.inputPressed ? this.extendTime : this.retractTime;
            const maxStep = Math.abs(this.activeAngle - this.restAngle) * (dt / duration);
            const step = Math.sign(delta) * Math.min(Math.abs(delta), maxStep);
            this.currentAngle += step;
        }
        this.angularVelocity = (this.currentAngle - previousAngle) / dt;
        const tip = this.computeTip(this.currentAngle);
        this.flipperEdge.setGeometry(this.origin, tip, this.tipRadius);
        this.syncVisualState();
    }

    onInput(pressed) {
        this.inputPressed = pressed;
        this.targetAngle = pressed ? this.activeAngle : this.restAngle;
    }

    onCollision(ball, point, edge) {
        const movingFast = Math.abs(this.angularVelocity) > 0.01;
        const boost = (this.inputPressed || movingFast) ? (950 * this.collisionMult + Math.min(900, Math.abs(this.angularVelocity) * 18)) : 0;
        const threshold = boost > 0 ? -1 : 1e9;
        Maths.basic_collision(ball, point, edge.getNormal(point), 0.75, 0.96, threshold, boost);
    }
}

class TBall {
    constructor(table) {
        this.table = table;
        this.position = new Vector2(0, 0);
        this.direction = new Vector2(0, 1);
        this.speed = 0;
        this.radius = 0.15;
        this.active = false;
        this.alreadyHit = [];
        this.stuckTime = 0;
        this.unstickSign = 1;
        this.captureLocked = false;
        this.capturePosition = new Vector2(0, 0);
    }

    update(dt) {
        if (!this.active) return;
        if (this.table.ballHeldAtPlunger) {
            this.position.x = this.table.plungerPosition.x;
            this.position.y = this.table.plungerPosition.y;
            this.direction.x = 0;
            this.direction.y = -1;
            this.speed = 0;
            return;
        }
        if (this.captureLocked) {
            this.position.x = this.capturePosition.x;
            this.position.y = this.capturePosition.y;
            this.direction.x = 0;
            this.direction.y = -1;
            this.speed = 0;
            return;
        }
        const startX = this.position.x;
        const startY = this.position.y;
        let vx = this.direction.x * this.speed, vy = this.direction.y * this.speed;
        vy += 25 * dt; 
        this.speed = Math.sqrt(vx*vx + vy*vy);
        if (this.speed > 0.001) { this.direction.x = vx / this.speed; this.direction.y = vy / this.speed; }

        const substeps = 8;
        const subDt = dt / substeps;
        this.alreadyHit.length = 0;
        for(let i=0; i<substeps; i++) {
            const collision = this.table.edgeManager.findCollision(this.position, this.direction, this.speed, subDt, this.radius, 1, this);
            if (collision) {
                this.alreadyHit.push(collision.edge);
                if (this.alreadyHit.length > 6) this.alreadyHit.shift();
                collision.edge.collisionComponent.onCollision(this, collision.point, collision.edge);
                // Extra separation prevents seam-locking on adjacent capsule/vertex edges.
                const normal = collision.edge.getNormal(collision.point);
                const pushOut = Math.max(this.radius * 0.18, 0.02);
                this.position.x += normal.x * pushOut;
                this.position.y += normal.y * pushOut;
                const forward = Math.max(this.speed * subDt * 0.05, 0.0015);
                this.position.x += this.direction.x * forward;
                this.position.y += this.direction.y * forward;
            } else {
                this.position.x += this.direction.x * this.speed * subDt;
                this.position.y += this.direction.y * this.speed * subDt;
            }
        }

        const moved = Math.hypot(this.position.x - startX, this.position.y - startY);
        if (this.speed > 20 && moved < 0.0025) this.stuckTime += dt;
        else this.stuckTime = Math.max(0, this.stuckTime - dt * 0.5);

        if (this.stuckTime > 0.08) {
            // Escape micro-traps by nudging slightly upward and alternating lateral bias.
            this.position.x += this.unstickSign * 0.12;
            this.position.y -= 0.18;
            this.direction.x += this.unstickSign * 0.25;
            this.direction.y -= 0.2;
            Maths.normalize_2d(this.direction);
            this.speed = Math.max(this.speed, 35);
            this.unstickSign *= -1;
            this.stuckTime = 0;
        }

        if (this.table.isInDrainWindow(this.position.x, this.position.y, this.direction.y, this.speed)) {
            this.active = false;
            return;
        }

        if (this.table.tryCaptureShooterLane(this)) {
            return;
        }

        const bounds = this.table.edgeManager;
        const sideMargin = 1.2;
        const bottomMargin = 0.45;
        const topMargin = 0.8;
        if (!Number.isFinite(this.position.x) || !Number.isFinite(this.position.y)) {
            this.active = false;
            return;
        }

        // Bottom escape protection: only drain window may consume the ball.
        if (this.position.y > bounds.maxY + bottomMargin) {
            this.position.y = bounds.maxY + bottomMargin;
            this.direction.y = -Math.abs(this.direction.y || 1);
            this.speed = Math.max(this.speed * 0.7, 35);
        }

        if (this.position.x < bounds.minX - sideMargin) {
            this.position.x = bounds.minX - sideMargin;
            this.direction.x = Math.abs(this.direction.x || 0.6);
            this.speed = Math.max(this.speed * 0.7, 30);
        } else if (this.position.x > bounds.maxX + sideMargin) {
            this.position.x = bounds.maxX + sideMargin;
            this.direction.x = -Math.abs(this.direction.x || 0.6);
            this.speed = Math.max(this.speed * 0.7, 30);
        }

        if (this.position.y < bounds.minY - topMargin) {
            this.position.y = bounds.minY - topMargin;
            this.direction.y = Math.abs(this.direction.y || 0.6);
            this.speed = Math.max(this.speed * 0.7, 30);
        }
    }

    render(renderer) {
        if (!this.active) return;
        const pos2d = Proj.xformTo2d({x: this.position.x, y: this.position.y, z: this.radius});
        if (pos2d.x < 0 || pos2d.x > 640 || pos2d.y < 0 || pos2d.y > 480) return;

        const ctx = renderer.ctx;
        ctx.beginPath();
        ctx.arc(pos2d.x, pos2d.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
    }
}

class TPlunger extends TCollisionComponent { constructor(table, groupIndex) { super(table, groupIndex, true); } }
class TDrain extends TCollisionComponent { constructor(table, groupIndex) { super(table, groupIndex, true); } }
class TWall extends TCollisionComponent { constructor(table, groupIndex) { super(table, groupIndex, true); } }
class TGenericCollision extends TCollisionComponent { constructor(table, groupIndex) { super(table, groupIndex, true); } }
class TLightComponent extends TPinballComponent {
    constructor(table, groupIndex) {
        super(table, groupIndex);
        this.on = true;
        this.currentState = this.visualStates.length > 1 ? 1 : 0;
    }

    setOn(on) {
        this.on = !!on;
        if (this.visualStates.length > 1) this.currentState = this.on ? 1 : 0;
        else this.currentState = this.on ? 0 : -1;
    }
}

class TLightGroupComponent extends TPinballComponent {
    constructor(table, groupIndex) {
        super(table, groupIndex);
    }
}

class TComponentGroupComponent extends TPinballComponent {
    constructor(table, groupIndex) {
        super(table, groupIndex);
    }
}

class TLightBargraphComponent extends TLightGroupComponent {
    constructor(table, groupIndex) {
        super(table, groupIndex);
    }
}

class TSoundComponent extends TPinballComponent {
    constructor(table, groupIndex) {
        super(table, groupIndex);
    }
}

class TTimerComponent extends TPinballComponent {
    constructor(table, groupIndex) {
        super(table, groupIndex);
        this.timerKey = "message_timer";
    }
}

class TTextBoxComponent extends TPinballComponent {
    constructor(table, groupIndex) {
        super(table, groupIndex);
        this.text = "";
    }
}

class TOnewayCollision extends TCollisionComponent {
    constructor(table, groupIndex) {
        super(table, groupIndex, false);
        this.passEdge = null;
        this.elasticity = 0.7;
        this.smoothness = 0.96;
        this.installFromDat();
    }

    installFromDat() {
        const arr = this.table.game.loader.datFile.query_float_attribute(this.groupIndex, 600);
        if (!arr || arr.length < 5) return;
        const wallType = Math.floor(arr[0] - 1.0);
        if (wallType !== 1) return;

        const linePt2 = { x: arr[1], y: arr[2] };
        const linePt1 = { x: arr[3], y: arr[4] };
        const offset = Math.max(0.01, this.table.ball.radius);

        const offsetSegment = (start, end, amount) => {
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const len = Math.hypot(dx, dy);
            if (len < 1e-9) return { start, end };
            const offX = (-dy / len) * amount;
            const offY = (dx / len) * amount;
            return {
                start: { x: start.x + offX, y: start.y + offY },
                end: { x: end.x + offX, y: end.y + offY }
            };
        };

        const hardSeg = offsetSegment(linePt2, linePt1, offset);
        const hardEdge = new LineEdge(this, this.activeFlagPtr, this.collisionGroup, hardSeg.start, hardSeg.end);
        this.edgeList.push(hardEdge);
        this.placeInGrid(hardEdge, hardSeg.start.x, hardSeg.start.y, hardSeg.end.x, hardSeg.end.y);

        const passSeg = offsetSegment(linePt1, linePt2, -offset * 0.8);
        const passEdge = new LineEdge(this, this.activeFlagPtr, this.collisionGroup, passSeg.start, passSeg.end);
        this.edgeList.push(passEdge);
        this.passEdge = passEdge;
        this.placeInGrid(passEdge, passSeg.start.x, passSeg.start.y, passSeg.end.x, passSeg.end.y);
    }

    onCollision(ball, point, edge) {
        if (edge === this.passEdge) {
            ball.position.x = point.x;
            ball.position.y = point.y;
            if (!ball.alreadyHit.includes(edge)) ball.alreadyHit.push(edge);
            return;
        }
        super.onCollision(ball, point, edge);
    }
}

class TCsvOneWayCollision extends TCollisionComponent {
    constructor(table, groupIndex, profile) {
        super(table, groupIndex, false);
        this.profile = profile;
        this.elasticity = 0.7;
        this.smoothness = 0.96;
        this.passEdge = null;
        this.installFromProfile();
    }

    installFromProfile() {
        const arr = this.profile?.tag600;
        if (!arr || arr.length < 5) return;
        const wallType = Math.floor(arr[0] - 1.0);
        if (wallType !== 1) return;
        const offsetSegment = (start, end, offset) => {
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const len = Math.hypot(dx, dy);
            if (len < 1e-9) return { start, end };
            const offX = (-dy / len) * offset;
            const offY = (dx / len) * offset;
            return {
                start: { x: start.x + offX, y: start.y + offY },
                end: { x: end.x + offX, y: end.y + offY }
            };
        };

        const linePt2 = { x: arr[1], y: arr[2] };
        const linePt1 = { x: arr[3], y: arr[4] };
        const offset = Math.max(0.01, this.table.ball.radius);

        const hardSeg = offsetSegment(linePt2, linePt1, offset);
        const hardEdge = new LineEdge(this, this.activeFlagPtr, this.collisionGroup, hardSeg.start, hardSeg.end);
        this.edgeList.push(hardEdge);
        this.placeInGrid(hardEdge, hardSeg.start.x, hardSeg.start.y, hardSeg.end.x, hardSeg.end.y);

        const passSeg = offsetSegment(linePt1, linePt2, -offset * 0.8);
        const passEdge = new LineEdge(this, this.activeFlagPtr, this.collisionGroup, passSeg.start, passSeg.end);
        this.edgeList.push(passEdge);
        this.passEdge = passEdge;
        this.placeInGrid(passEdge, passSeg.start.x, passSeg.start.y, passSeg.end.x, passSeg.end.y);
    }

    onCollision(ball, point, edge) {
        if (edge === this.passEdge) {
            const step = Math.max(ball.radius * 0.3, 0.02);
            ball.position.x = point.x + ball.direction.x * step;
            ball.position.y = point.y + ball.direction.y * step;
            if (!ball.alreadyHit.includes(edge)) ball.alreadyHit.push(edge);
            return;
        }
        super.onCollision(ball, point, edge);
    }
}

class TRolloverCollision extends TCollisionComponent {
    constructor(table, groupIndex, options = {}) {
        super(table, groupIndex, false);
        this.rolloverFlagPtr = { value: false };
        this.toggleSecondary = options.toggleSecondary ?? true;
        this.useSecondary = options.useSecondary ?? true;
        this.disableActiveOnRepeat = options.disableActiveOnRepeat ?? true;
        this.repeatDisableTime = options.repeatDisableTime ?? 0.1;
        this.installRolloverWalls();
        if (this.visualStates.length > 0) this.currentState = 0;
    }

    installRolloverWalls() {
        const dat = this.table.game.loader.datFile;
        const wall600 = dat.query_float_attribute(this.groupIndex, 600);
        if (wall600) {
            this.installWall(this.groupIndex, {
                floatArr: wall600,
                activeFlagPtr: this.activeFlagPtr,
                collisionOffset: 0
            });
        }
        if (this.useSecondary) {
            const wall603 = dat.query_float_attribute(this.groupIndex, 603);
            if (wall603) {
                this.installWall(this.groupIndex, {
                    floatArr: wall603,
                    activeFlagPtr: this.rolloverFlagPtr,
                    collisionOffset: 0
                });
            }
        }
    }

    onCollision(ball, point, edge) {
        ball.position.x = point.x;
        ball.position.y = point.y;
        if (!ball.alreadyHit.includes(edge)) ball.alreadyHit.push(edge);
        if (this.rolloverFlagPtr.value && this.disableActiveOnRepeat) {
            this.activeFlagPtr.value = false;
            this.table.setTimer(this, "rollover_rearm", this.repeatDisableTime, () => {
                this.activeFlagPtr.value = true;
            });
        }

        if (this.toggleSecondary) this.rolloverFlagPtr.value = !this.rolloverFlagPtr.value;
        if (this.visualStates.length > 0) {
            this.currentState = this.rolloverFlagPtr.value ? -1 : 0;
        }
    }
}

class TLightRolloverCollision extends TRolloverCollision {
    constructor(table, groupIndex) {
        super(table, groupIndex, {
            useSecondary: true,
            toggleSecondary: true,
            disableActiveOnRepeat: true,
            repeatDisableTime: 0.1
        });
        const dat = table.game.loader.datFile;
        this.lightDelay = dat.query_float_attribute(groupIndex, 407)?.[0] ?? 0.4;
        this.delayArmed = false;
        this.currentState = -1;
    }

    onCollision(ball, point, edge) {
        const wasArmed = this.rolloverFlagPtr.value;
        super.onCollision(ball, point, edge);
        if (!wasArmed) {
            this.currentState = 0;
            return;
        }
        if (this.delayArmed) return;
        this.delayArmed = true;
        this.table.setTimer(this, "light_rollover_delay", this.lightDelay, () => {
            this.currentState = -1;
            this.delayArmed = false;
        });
    }
}

class TTripwireCollision extends TCollisionComponent {
    constructor(table, groupIndex) {
        super(table, groupIndex, true);
    }

    onCollision(ball, point, edge) {
        ball.position.x = point.x;
        ball.position.y = point.y;
        if (!ball.alreadyHit.includes(edge)) ball.alreadyHit.push(edge);
    }
}

class TDemoCollision extends TCollisionComponent {
    constructor(table, groupIndex) {
        super(table, groupIndex, true);
    }
}

class TRampCollision extends TCollisionComponent {
    constructor(table, groupIndex, profile = null) {
        super(table, groupIndex, false);
        this.profile = profile;
        this.elasticity = 0.72;
        this.smoothness = 0.96;
        this.installFromRampTags();
    }

    parseRampPlanes(arr1300) {
        if (!arr1300 || arr1300.length < 14) return [];
        const count = Math.floor(arr1300[0]);
        if (!Number.isFinite(count) || count <= 0) return [];
        const planes = [];
        let base = 1;
        for (let i = 0; i < count; i++) {
            if (base + 12 >= arr1300.length) break;
            const plane = {
                v1: { x: arr1300[base + 3], y: arr1300[base + 4] },
                v2: { x: arr1300[base + 5], y: arr1300[base + 6] },
                v3: { x: arr1300[base + 7], y: arr1300[base + 8] },
            };
            planes.push(plane);
            base += 13;
        }
        return planes;
    }

    findClosestEdge(planes, pt0, pt1) {
        if (!planes.length) return null;
        let best = null;
        let bestDist = 1e9;
        for (const plane of planes) {
            const pts = [plane.v1, plane.v2, plane.v3, plane.v1];
            for (let i = 0; i < 3; i++) {
                const p1 = pts[i];
                const p2 = pts[i + 1];
                const dist = Math.hypot(pt0.x - p1.x, pt0.y - p1.y) + Math.hypot(pt1.x - p2.x, pt1.y - p2.y);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = { start: { x: p2.x, y: p2.y }, end: { x: p1.x, y: p1.y } };
                }
            }
        }
        return best;
    }

    addRampLine(start, end) {
        if (!start || !end) return;
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.hypot(dx, dy) < 1e-6) return;
        const edge = new LineEdge(this, this.activeFlagPtr, this.collisionGroup, start, end);
        this.edgeList.push(edge);
        this.placeInGrid(edge, start.x, start.y, end.x, end.y);
    }

    installFromRampTags() {
        const dat = this.table.game.loader.datFile;
        const arr1300 = dat.query_float_attribute(this.groupIndex, 1300) || this.profile?.tag1300;
        const arr1301 = dat.query_float_attribute(this.groupIndex, 1301) || this.profile?.tag1301;
        const arr1302 = dat.query_float_attribute(this.groupIndex, 1302) || this.profile?.tag1302;
        const arr1303 = dat.query_float_attribute(this.groupIndex, 1303) || this.profile?.tag1303;
        const planes = this.parseRampPlanes(arr1300);

        if (arr1303 && arr1303.length >= 6) {
            this.addRampLine(
                { x: arr1303[2], y: arr1303[3] },
                { x: arr1303[4], y: arr1303[5] }
            );
        }

        if (arr1301 && arr1301.length >= 7) {
            const edge = this.findClosestEdge(
                planes,
                { x: arr1301[3], y: arr1301[4] },
                { x: arr1301[5], y: arr1301[6] }
            );
            if (edge) this.addRampLine(edge.start, edge.end);
        }

        if (arr1302 && arr1302.length >= 7) {
            const edge = this.findClosestEdge(
                planes,
                { x: arr1302[3], y: arr1302[4] },
                { x: arr1302[5], y: arr1302[6] }
            );
            if (edge) this.addRampLine(edge.start, edge.end);
        }

        for (const plane of planes) {
            this.addRampLine(plane.v1, plane.v2);
            this.addRampLine(plane.v2, plane.v3);
            this.addRampLine(plane.v3, plane.v1);
        }
    }
}

class TGateCollision extends TCollisionComponent {
    constructor(table, groupIndex) {
        super(table, groupIndex, true);
        this.activeFlagPtr.value = true;
    }
}

class TBlockerCollision extends TCollisionComponent {
    constructor(table, groupIndex) {
        super(table, groupIndex, true);
        this.activeFlagPtr.value = false;
    }
}

class TPopupTargetCollision extends TCollisionComponent {
    constructor(table, groupIndex) {
        super(table, groupIndex, true);
        const dat = table.game.loader.datFile;
        this.timerTime = dat.query_float_attribute(groupIndex, 407)?.[0] ?? 0.75;
    }

    onCollision(ball, point, edge) {
        if (!this.activeFlagPtr.value) return;
        const rebound = Maths.basic_collision(
            ball,
            point,
            edge.getNormal(point),
            this.elasticity,
            this.smoothness,
            this.threshold,
            this.boost
        );
        if (rebound > Math.max(0, this.threshold)) {
            this.activeFlagPtr.value = false;
            this.table.setTimer(this, "popup_rearm", this.timerTime, () => {
                this.activeFlagPtr.value = true;
            });
            this.table.addScore(250);
        }
    }
}

class TKickbackCollision extends TCollisionComponent {
    constructor(table, groupIndex) {
        super(table, groupIndex, true);
        this.timerTime = 0.7;
        this.timerTime2 = 0.1;
        this.kickActive = false;
        this.threshold = 1e9;
    }

    onCollision(ball, point, edge) {
        if (!this.activeFlagPtr.value) return;
        if (!this.kickActive) {
            this.kickActive = true;
            this.table.setTimer(this, "kickback_arm", this.timerTime, () => {
                if (!this.kickActive) return;
                this.threshold = 0;
                this.table.setTimer(this, "kickback_reset", this.timerTime2, () => {
                    this.threshold = 1e9;
                    this.kickActive = false;
                });
            });
        }
        const rebound = Maths.basic_collision(
            ball,
            point,
            edge.getNormal(point),
            this.elasticity,
            this.smoothness,
            this.threshold,
            this.boost
        );
        if (this.threshold <= 0 && rebound > 0.2) {
            this.kickActive = false;
            this.threshold = 1e9;
            this.table.clearTimer(this, "kickback_reset");
            this.table.addScore(150);
        }
    }
}

class TKickoutCollision extends TCollisionComponent {
    constructor(table, groupIndex, startsEnabled) {
        super(table, groupIndex, true);
        this.startsEnabled = startsEnabled;
        this.activeFlagPtr.value = !!startsEnabled;
        this.ballCaptured = false;
        this.timerTime1 = 1.5;
        this.timerTime2 = 0.05;
        this.center = new Vector2(0, 0);
        this.initCenterFromWall();
    }

    initCenterFromWall() {
        const arr = this.table.game.loader.datFile.query_float_attribute(this.groupIndex, 600);
        if (!arr || arr.length < 3) return;
        const wallType = Math.floor(arr[0] - 1.0);
        if (wallType === 0 && arr.length >= 4) {
            this.center.x = arr[1];
            this.center.y = arr[2];
            return;
        }
        const count = Math.max(2, wallType);
        let sx = 0;
        let sy = 0;
        let n = 0;
        for (let i = 0; i < count; i++) {
            const idx = 1 + i * 2;
            if (idx + 1 >= arr.length) break;
            sx += arr[idx];
            sy += arr[idx + 1];
            n++;
        }
        if (n > 0) {
            this.center.x = sx / n;
            this.center.y = sy / n;
        }
    }

    onCollision(ball, point, edge) {
        if (!this.activeFlagPtr.value || this.ballCaptured) return;
        this.ballCaptured = true;
        this.table.captureBall(ball, { x: this.center.x, y: this.center.y }, this.timerTime1, (capturedBall) => {
            this.ballCaptured = false;
            this.table.throwBallFromVisual(capturedBall, this.visualInfo, { x: 0, y: -1 });
            if (!this.startsEnabled) {
                this.activeFlagPtr.value = false;
                this.table.setTimer(this, "kickout_rearm", this.timerTime2, () => {
                    this.activeFlagPtr.value = true;
                });
            }
        });
    }
}

class TSinkCollision extends TCollisionComponent {
    constructor(table, groupIndex) {
        super(table, groupIndex, true);
        const dat = table.game.loader.datFile;
        this.ballPosition = new Vector2(0, 0);
        const pos = dat.query_float_attribute(groupIndex, 601);
        if (pos?.length >= 2) {
            this.ballPosition.x = pos[0];
            this.ballPosition.y = pos[1];
        }
        this.timerTime = dat.query_float_attribute(groupIndex, 407)?.[0] ?? 0.75;
        this.ballCaptured = false;
    }

    onCollision(ball, point, edge) {
        if (!this.activeFlagPtr.value || this.ballCaptured) return;
        this.ballCaptured = true;
        this.table.captureBall(ball, this.ballPosition, this.timerTime, (capturedBall) => {
            this.ballCaptured = false;
            this.table.throwBallFromVisual(capturedBall, this.visualInfo, { x: 0, y: -1 });
        });
    }
}

class THoleCollision extends TCollisionComponent {
    constructor(table, groupIndex) {
        super(table, groupIndex, true);
        const dat = table.game.loader.datFile;
        this.captureTime = 0.5;
        this.captureTime = dat.query_float_attribute(groupIndex, 407)?.[0] ?? this.captureTime;
        const arr600 = dat.query_float_attribute(groupIndex, 600);
        this.center = new Vector2(0, 0);
        if (arr600?.length >= 3) {
            this.center.x = arr600[1];
            this.center.y = arr600[2];
        }
        this.ballCaptured = false;
        this.reentryCooldown = 0;
    }

    update(dt) {
        if (this.reentryCooldown > 0) {
            this.reentryCooldown = Math.max(0, this.reentryCooldown - dt);
        }
    }

    onCollision(ball, point, edge) {
        if (this.ballCaptured || this.reentryCooldown > 0) return;
        this.ballCaptured = true;
        this.table.captureBall(ball, this.center, this.captureTime, (capturedBall) => {
            this.ballCaptured = false;
            this.reentryCooldown = 0.2;
            capturedBall.position.y -= Math.max(0.2, capturedBall.radius * 2);
            capturedBall.direction = new Vector2(0, -1);
            capturedBall.speed = 20;
        });
    }
}

class TFlagSpinnerCollision extends TCollisionComponent {
    constructor(table, groupIndex) {
        super(table, groupIndex, false);
        this.spinTimerKey = "spinner_step";
        this.spinDirection = 1;
        this.prevCollider = null;
        this.spinSpeed = 0;
        this.speedDecrement = table.game.loader.datFile.query_float_attribute(groupIndex, 1202)?.[0] ?? 0.65;
        this.maxSpeed = table.game.loader.datFile.query_float_attribute(groupIndex, 1200)?.[0] ?? 50000;
        this.minSpeed = table.game.loader.datFile.query_float_attribute(groupIndex, 1201)?.[0] ?? 5;
        this.installSpinnerEdges();
    }

    installSpinnerEdges() {
        const arr = this.table.game.loader.datFile.query_float_attribute(this.groupIndex, 600);
        if (!arr || arr.length < 5) return;
        const wallType = Math.floor(arr[0] - 1.0);
        if (wallType !== 1) return;
        const end = { x: arr[1], y: arr[2] };
        const start = { x: arr[3], y: arr[4] };
        const lineA = new LineEdge(this, this.activeFlagPtr, this.collisionGroup, start, end);
        const lineB = new LineEdge(this, this.activeFlagPtr, this.collisionGroup, end, start);
        this.edgeList.push(lineA, lineB);
        this.prevCollider = lineB;
        this.placeInGrid(lineA, start.x, start.y, end.x, end.y);
        this.placeInGrid(lineB, start.x, start.y, end.x, end.y);
    }

    nextFrame() {
        const count = this.visualStates.length;
        if (count > 0) {
            this.currentState += this.spinDirection;
            if (this.currentState >= count) this.currentState = 0;
            else if (this.currentState < 0) this.currentState = count - 1;
        }
        this.spinSpeed *= this.speedDecrement;
        if (this.spinSpeed >= this.minSpeed) {
            this.table.setTimer(this, this.spinTimerKey, 1 / this.spinSpeed, () => this.nextFrame());
        }
    }

    onCollision(ball, point, edge) {
        ball.position.x = point.x;
        ball.position.y = point.y;
        if (!ball.alreadyHit.includes(edge)) ball.alreadyHit.push(edge);
        this.spinDirection = edge === this.prevCollider ? -1 : 1;
        this.prevCollider = edge;
        this.spinSpeed = Math.max(this.minSpeed, Math.min(this.maxSpeed, (ball.speed || 0) * 20));
        this.nextFrame();
    }
}

class TSoloTargetCollision extends TCollisionComponent {
    constructor(table, groupIndex) {
        super(table, groupIndex, true);
        this.activeFlagPtr.value = true;
        this.timerTime = 0.1;
    }

    onCollision(ball, point, edge) {
        if (!this.activeFlagPtr.value) return;
        const rebound = Maths.basic_collision(
            ball,
            point,
            edge.getNormal(point),
            this.elasticity,
            this.smoothness,
            this.threshold,
            this.boost
        );
        if (rebound > Math.max(0, this.threshold)) {
            this.activeFlagPtr.value = false;
            this.table.setTimer(this, "solo_reenable", this.timerTime, () => {
                this.activeFlagPtr.value = true;
            });
        }
    }
}

class TContainmentBounds extends TCollisionComponent {
    constructor(table) {
        super(table, -1, false);
        this.elasticity = 0.78;
        this.smoothness = 0.97;
        this.threshold = 1e9;
        this.boost = 0;
        this.installBounds();
    }

    installBounds() {
        const em = this.table.edgeManager;
        if (!em) return;

        const minX = em.minX + 0.2;
        const maxX = em.maxX - 0.2;
        const minY = em.minY + 0.2;
        const maxY = em.maxY + 0.2;
        const railRadius = Math.max(0.12, this.table.ball.radius);

        const addCapsule = (x1, y1, x2, y2, radius = railRadius) => {
            const edge = new FlipperCapsuleEdge(this, this.activeFlagPtr, this.collisionGroup, {x:x1, y:y1}, {x:x2, y:y2}, radius);
            this.edgeList.push(edge);
            this.placeInGrid(edge, Math.min(x1, x2) - radius, Math.min(y1, y2) - radius, Math.max(x1, x2) + radius, Math.max(y1, y2) + radius);
        };

        const addPost = (x, y, radius = railRadius * 1.2) => {
            const circle = new CircleEdge(this, this.activeFlagPtr, this.collisionGroup, {x, y}, radius);
            this.edgeList.push(circle);
            this.placeInGrid(circle, x - radius, y - radius, x + radius, y + radius);
        };

        const drainGapHalf = Math.max(1.2, this.table.drainHalfWidth * 0.72);
        const gapLeftX = this.table.drainCenterX - drainGapHalf;
        const gapRightX = this.table.drainCenterX + drainGapHalf;

        // Outer rails
        addCapsule(minX, minY, maxX, minY);
        addCapsule(minX, minY, minX, maxY);
        addCapsule(maxX, minY, maxX, maxY);
        addCapsule(minX, maxY, gapLeftX, maxY);
        addCapsule(gapRightX, maxY, maxX, maxY);

        // Pillars guiding the ball into the intended drain lane.
        addPost(gapLeftX, maxY);
        addPost(gapRightX, maxY);
        addPost(minX + 1.1, maxY - 1.35, railRadius);
        addPost(maxX - 1.1, maxY - 1.35, railRadius);
    }
}

class TPinballTable {
    constructor(game) {
        this.game = game;
        this.components = [];
        this.lights = [];
        this.xOffset = 0; this.yOffset = 0;
        this.edgeManager = new EdgeManager(-10, -20, 20, 40);
        this.ball = new TBall(this);
        this.plungerPosition = new Vector2(0, 0);
        this.score = 0;
        this.ballsPerGame = 3;
        this.ballsRemaining = this.ballsPerGame;
        this.gameStarted = false;
        this.gameOver = false;
        this.respawnTimer = 0;
        this.drainCenterX = 0;
        this.drainHalfWidth = 2.5;
        this.drainTriggerY = 14.8;
        this.ballHeldAtPlunger = false;
        this.timers = [];
        this.nextTimerId = 1;
        this.objectComponentCounts = new Map();
    }

    registerObjectComponent(type, component) {
        if (!component) return null;
        component.sourceObjectType = type;
        const prev = this.objectComponentCounts.get(type) || 0;
        this.objectComponentCounts.set(type, prev + 1);
        return component;
    }

    initialize(datFile) {
        const ballGroup = datFile.record_labeled("ball");
        const ballRadius = ballGroup !== -1 ? datFile.query_float_attribute(ballGroup, 500) : null;
        if (ballRadius?.length) this.ball.radius = Math.max(0.05, ballRadius[0]);

        new TTableLayer(this);
        const objIdx = datFile.record_labeled("table_objects");
        const objData = datFile.query_iattribute(objIdx, 1025);
        if (!objData) return;
        for (let i = 0; i < objData.length; i += 2) {
            if (i + 1 >= objData.length) break;
            const type = objData[i], groupIdx = objData[i+1];
            if (!Number.isFinite(type) || !Number.isFinite(groupIdx)) continue;
            if (groupIdx < 0 || groupIdx >= datFile.groups.length) continue;
            const collisionProfile = this.game.loader.getCollisionProfile?.(groupIdx) || null;
            let component = null;
            try {
                switch (type) {
                    case 1000:
                    case 1010:
                        component = new TWall(this, groupIdx);
                        break;
                    case 1001:
                        component = new TPlunger(this, groupIdx);
                        this.plunger = component;
                        break;
                    case 1002:
                        component = new TLightComponent(this, groupIdx);
                        this.lights.push(component);
                        break;
                    case 1003:
                        component = new TFlipper(this, groupIdx, 'L');
                        this.flipperL = component;
                        break;
                    case 1004:
                        component = new TFlipper(this, groupIdx, 'R');
                        this.flipperR = component;
                        break;
                    case 1005:
                        component = new TBumper(this, groupIdx);
                        break;
                    case 1006:
                        component = new TPopupTargetCollision(this, groupIdx);
                        break;
                    case 1015:
                        component = new TRolloverCollision(this, groupIdx, { useSecondary: true, toggleSecondary: true });
                        break;
                    case 1007:
                        component = new TDrain(this, groupIdx);
                        this.drain = component;
                        this.configureDrainWindow(datFile, groupIdx);
                        break;
                    case 1011:
                        component = new TBlockerCollision(this, groupIdx);
                        break;
                    case 1012:
                        component = new TKickoutCollision(this, groupIdx, true);
                        break;
                    case 1013:
                        component = new TGateCollision(this, groupIdx);
                        break;
                    case 1014:
                        component = new TKickbackCollision(this, groupIdx);
                        break;
                    case 1016:
                        component = new TOnewayCollision(this, groupIdx);
                        break;
                    case 1017:
                        component = new TSinkCollision(this, groupIdx);
                        break;
                    case 1018:
                        component = new TFlagSpinnerCollision(this, groupIdx);
                        break;
                    case 1019:
                        component = new TSoloTargetCollision(this, groupIdx);
                        break;
                    case 1021:
                        component = new TRampCollision(this, groupIdx, collisionProfile);
                        break;
                    case 1020:
                        component = new TLightRolloverCollision(this, groupIdx);
                        break;
                    case 1022:
                        component = new THoleCollision(this, groupIdx);
                        break;
                    case 1023:
                        component = new TDemoCollision(this, groupIdx);
                        break;
                    case 1024:
                        component = new TTripwireCollision(this, groupIdx);
                        break;
                    case 1026:
                        component = new TLightGroupComponent(this, groupIdx);
                        break;
                    case 1028:
                        component = new TComponentGroupComponent(this, groupIdx);
                        break;
                    case 1029:
                        component = new TKickoutCollision(this, groupIdx, false);
                        break;
                    case 1030:
                        component = new TLightBargraphComponent(this, groupIdx);
                        break;
                    case 1031:
                        component = new TSoundComponent(this, groupIdx);
                        break;
                    case 1032:
                        component = new TTimerComponent(this, groupIdx);
                        break;
                    case 1033:
                        component = new TTextBoxComponent(this, groupIdx);
                        break;
                    default: {
                        if (collisionProfile?.objectTypeName === "TRamp") {
                            component = new TRampCollision(this, groupIdx, collisionProfile);
                            break;
                        }
                        if (collisionProfile?.objectTypeName === "TOneway") {
                            component = new TCsvOneWayCollision(this, groupIdx, collisionProfile);
                            break;
                        }
                        const hasCollision = !!datFile.query_float_attribute(groupIdx, 600);
                        component = hasCollision ? new TGenericCollision(this, groupIdx) : new TPinballComponent(this, groupIdx);
                        break;
                    }
                }
            } catch (err) {
                console.warn(`Component init failed (type=${type}, group=${groupIdx})`, err);
                continue;
            }
            this.registerObjectComponent(type, component);
        }
        this.containmentBounds = new TContainmentBounds(this);
        console.log(`Table ready with ${this.components.length} components.`);
    }

    configureDrainWindow(datFile, drainGroupIdx) {
        const drainWall = datFile.query_float_attribute(drainGroupIdx, 600);
        if (!drainWall || drainWall.length < 5) return;

        const wallType = Math.floor(drainWall[0] - 1.0);
        if (wallType === 1) {
            const x1 = drainWall[1], y1 = drainWall[2];
            const x2 = drainWall[3], y2 = drainWall[4];
            const span = Math.abs(x2 - x1);
            this.drainCenterX = (x1 + x2) * 0.5;
            // Keep drain spot centered and intentionally tight.
            this.drainHalfWidth = Math.max(1.0, Math.min(2.2, span * 0.085));
            this.drainTriggerY = Math.max(y1, y2) + 0.15;
        }
    }

    isInDrainWindow(x, y, directionY = 1, speed = 0) {
        const enteringFromTop = directionY > 0.3;
        const inDrainX = Math.abs(x - this.drainCenterX) <= this.drainHalfWidth;
        const inDrainY = y >= (this.drainTriggerY + 0.25);
        return enteringFromTop && inDrainX && inDrainY && speed >= 8;
    }

    setTimer(owner, key, duration, callback) {
        this.clearTimer(owner, key);
        this.timers.push({
            id: this.nextTimerId++,
            owner,
            key,
            remaining: Math.max(0, duration || 0),
            callback
        });
    }

    clearTimer(owner, key) {
        this.timers = this.timers.filter((timer) => !(timer.owner === owner && timer.key === key));
    }

    updateTimers(dt) {
        if (!this.timers.length) return;
        const due = [];
        for (const timer of this.timers) {
            timer.remaining -= dt;
            if (timer.remaining <= 0) due.push(timer);
        }
        if (!due.length) return;
        const dueIds = new Set(due.map((t) => t.id));
        this.timers = this.timers.filter((timer) => !dueIds.has(timer.id));
        for (const timer of due) {
            try {
                timer.callback?.();
            } catch (err) {
                console.warn("Timer callback error", err);
            }
        }
    }

    captureBall(ball, capturePos, holdTime, onRelease) {
        if (!ball?.active) return;
        ball.captureLocked = true;
        ball.capturePosition.x = capturePos.x;
        ball.capturePosition.y = capturePos.y;
        ball.position.x = capturePos.x;
        ball.position.y = capturePos.y;
        ball.direction.x = 0;
        ball.direction.y = -1;
        ball.speed = 0;
        this.setTimer(ball, "capture_release", holdTime, () => {
            if (!ball.active) return;
            ball.captureLocked = false;
            onRelease?.(ball);
        });
    }

    throwBallFromVisual(ball, visualInfo, fallbackDirection = { x: 0, y: -1 }) {
        const throwDir = visualInfo?.kicker?.throwBallDirection;
        let dx = Number.isFinite(throwDir?.x) ? throwDir.x : fallbackDirection.x;
        let dy = Number.isFinite(throwDir?.y) ? throwDir.y : fallbackDirection.y;
        let dir = new Vector2(dx, dy);
        if (dir.normalize() < 1e-6) {
            dir.x = fallbackDirection.x;
            dir.y = fallbackDirection.y;
            if (dir.normalize() < 1e-6) {
                dir.x = 0;
                dir.y = -1;
            }
        }

        const boost = Number.isFinite(visualInfo?.kicker?.boost) ? visualInfo.kicker.boost : 45;
        const mult = Number.isFinite(visualInfo?.kicker?.throwBallMult) ? visualInfo.kicker.throwBallMult : 5;
        const speed = boost + Math.abs(boost) * (Math.abs(mult) * 0.01) * 0.25;

        ball.direction = dir;
        ball.speed = Math.max(20, speed);
    }

    tryCaptureShooterLane(ball) {
        if (!ball?.active || this.ballHeldAtPlunger || !this.plunger) return false;
        const nearPlungerX = Math.abs(ball.position.x - this.plungerPosition.x) <= 0.55;
        const inCatchY = ball.position.y >= (this.plungerPosition.y + 2.35);
        const movingDown = ball.direction.y > 0.12;
        if (nearPlungerX && inCatchY && movingDown) {
            this.ballHeldAtPlunger = true;
            ball.position.x = this.plungerPosition.x;
            ball.position.y = this.plungerPosition.y;
            ball.direction.x = 0;
            ball.direction.y = -1;
            ball.speed = 0;
            return true;
        }
        return false;
    }

    newGame() {
        if (!this.plunger) return;
        this.score = 0;
        this.ballsRemaining = this.ballsPerGame;
        this.gameStarted = true;
        this.gameOver = false;
        this.respawnTimer = 0;
        this.spawnBallAtPlunger();
        this.game.message = "Press SPACE to Launch";
    }

    launchBall() {
        if (!this.ball.active) return;
        if (this.ballHeldAtPlunger) {
            this.ballHeldAtPlunger = false;
            this.ball.direction = new Vector2(0.06, -1);
            this.ball.direction.normalize();
            this.ball.speed = Math.max(this.ball.speed, 75);
            return;
        }
        if (Math.abs(this.ball.position.x - this.plungerPosition.x) < 1.5 && this.ball.position.y <= this.plungerPosition.y + 3) {
            this.ball.direction = new Vector2(0.06, -1);
            this.ball.direction.normalize();
            this.ball.speed = Math.max(this.ball.speed, 75);
        }
    }

    spawnBallAtPlunger() {
        if (!this.plunger) return false;
        const pos = this.game.loader.datFile.query_float_attribute(this.plunger.groupIndex, 601);
        if (pos) this.plungerPosition = new Vector2(pos[0], pos[1]);
        this.clearTimer(this.ball, "capture_release");
        this.ball.captureLocked = false;
        this.ball.position = new Vector2(this.plungerPosition.x, this.plungerPosition.y);
        this.ball.direction = new Vector2(0, -1);
        this.ball.speed = 0;
        this.ball.active = true;
        this.ballHeldAtPlunger = true;
        return true;
    }

    onBallLost() {
        if (!this.gameStarted || this.gameOver) return;
        this.ballsRemaining = Math.max(0, this.ballsRemaining - 1);
        if (this.ballsRemaining > 0) {
            this.respawnTimer = 0.75;
            this.game.message = `Ball Lost\nBalls Left: ${this.ballsRemaining}\nPress SPACE to Launch`;
        } else {
            this.gameOver = true;
            this.game.message = `Game Over\nScore: ${this.score}\nPress SPACE to Restart`;
        }
    }

    addScore(points) {
        if (!this.gameStarted || this.gameOver) return;
        this.score += points;
    }

    update(dt) {
        this.updateTimers(dt);
        if (this.respawnTimer > 0) {
            this.respawnTimer -= dt;
            if (this.respawnTimer <= 0 && !this.ball.active && !this.gameOver) {
                this.spawnBallAtPlunger();
            }
        }

        const wasActive = this.ball.active;
        this.ball.update(dt);
        if (wasActive && !this.ball.active) {
            this.onBallLost();
        }
        for (const comp of this.components) comp.update(dt);
    }

    render(renderer) {
        for (const comp of this.components) comp.render(renderer);
        this.ball.render(renderer);
    }
}
