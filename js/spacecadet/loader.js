const FieldTypes = {
    ShortValue: 0,
    Bitmap8bit: 1,
    Unknown2: 2,
    GroupName: 3,
    Unknown4: 4,
    Palette: 5,
    Unknown6: 6,
    Unknown7: 7,
    Unknown8: 8,
    String: 9,
    ShortArray: 10,
    FloatArray: 11,
    Bitmap16bit: 12,
};

class EntryData {
    constructor(type, buffer, fieldSize) {
        this.type = type;
        this.buffer = buffer; 
        this.fieldSize = fieldSize;
    }
}

class GroupData {
    constructor(groupId) {
        this.groupId = groupId;
        this.groupName = "";
        this.entries = [];
        this.bitmaps = {}; 
        this.zMaps = {};
    }

    addEntry(entry) {
        switch (entry.type) {
            case FieldTypes.GroupName:
                this.groupName = new TextDecoder().decode(entry.buffer).replace(/\0/g, '').trim();
                break;
            case FieldTypes.Bitmap8bit:
                const bmp = this.parseBitmap8(entry.buffer);
                if (bmp) {
                    this.bitmaps[bmp.resolution] = bmp;
                }
                break;
            case FieldTypes.Bitmap16bit:
                const zmap = this.parseZMap(entry.buffer);
                if (zmap) {
                    this.zMaps[zmap.resolution] = zmap;
                }
                break;
        }
        this.entries.push(entry);
    }

    parseBitmap8(buffer) {
        const view = new DataView(buffer);
        if (buffer.byteLength < 14) return null;
        
        let res = view.getUint8(0);
        if (res === 0xff) res = 0;

        const header = {
            resolution: res,
            width: view.getInt16(1, true),
            height: view.getInt16(3, true),
            xPosition: view.getInt16(5, true),
            yPosition: view.getInt16(7, true),
            size: view.getInt32(9, true),
            flags: view.getUint8(13)
        };

        if (header.size <= 0 || header.width <= 0 || header.height <= 0) return null;

        const dataLen = Math.min(header.size, buffer.byteLength - 14);
        const pixelData = new Uint8Array(buffer, 14, dataLen);
        return new Bitmap8(header.width, header.height, header.flags, header.xPosition, header.yPosition, true, pixelData, header.resolution);
    }

    parseZMap(buffer) {
        const view = new DataView(buffer);
        let offset = 0;
        let resolution = 0;
        
        if (buffer.byteLength % 2 !== 0) {
            resolution = view.getUint8(0);
            if (resolution === 0xff) resolution = 0;
            offset = 1;
        }

        if (buffer.byteLength - offset < 14) return null;

        const header = {
            width: view.getInt16(offset, true),
            height: view.getInt16(offset + 2, true),
            stride: view.getInt16(offset + 4, true),
            unknown0: view.getInt32(offset + 6, true),
            unknown1_0: view.getInt16(offset + 10, true),
            unknown1_1: view.getInt16(offset + 12, true)
        };

        const dataSize = buffer.byteLength - offset - 14;
        if (dataSize <= 0) return null;
        
        const zData = new Uint16Array(buffer.slice(offset + 14));
        const zmap = new ZMap(header.width, header.height, header.stride, zData);
        zmap.resolution = resolution;
        return zmap;
    }
}

class DatFile {
    constructor() {
        this.appName = "";
        this.description = "";
        this.groups = [];
    }

    record_labeled(targetName) {
        const target = targetName.toLowerCase();
        for (let i = 0; i < this.groups.length; i++) {
            if (this.groups[i].groupName.toLowerCase() === target) return i;
        }
        return -1;
    }

    field(groupIdx, type) {
        if (!Number.isInteger(groupIdx) || groupIdx < 0 || groupIdx >= this.groups.length) return null;
        const group = this.groups[groupIdx];
        if (!group || !Array.isArray(group.entries)) return null;
        for (const entry of group.entries) {
            if (entry.type === type) return entry.buffer;
        }
        return null;
    }

    // New: Match loader.cpp query_iattribute logic
    query_iattribute(groupIdx, firstValue) {
        if (!Number.isInteger(groupIdx) || groupIdx < 0 || groupIdx >= this.groups.length) return null;
        const group = this.groups[groupIdx];
        if (!group || !Array.isArray(group.entries)) return null;
        
        for (const entry of group.entries) {
            if (entry.type === FieldTypes.ShortArray) {
                const view = new DataView(entry.buffer);
                if (view.byteLength >= 2 && view.getInt16(0, true) === firstValue) {
                    return new Int16Array(entry.buffer.slice(2));
                }
            }
        }
        return null;
    }

    query_float_attribute(groupIdx, firstValue) {
        if (!Number.isInteger(groupIdx) || groupIdx < 0 || groupIdx >= this.groups.length) return null;
        const group = this.groups[groupIdx];
        if (!group || !Array.isArray(group.entries)) return null;
        
        for (const entry of group.entries) {
            if (entry.type === FieldTypes.FloatArray) {
                const view = new DataView(entry.buffer);
                if (view.byteLength >= 4 && Math.floor(view.getFloat32(0, true)) === firstValue) {
                    // Return the rest of the array as Float32
                    const count = (view.byteLength - 4) / 4;
                    const result = new Float32Array(count);
                    for (let i = 0; i < count; i++) {
                        result[i] = view.getFloat32(4 + i * 4, true);
                    }
                    return result;
                }
            }
        }
        return null;
    }

    getBitmap(groupIdx, resolution = 0) {
        if (!Number.isInteger(groupIdx) || groupIdx < 0 || groupIdx >= this.groups.length) return null;
        const g = this.groups[groupIdx];
        if (!g || !g.bitmaps) return null;
        return g.bitmaps[resolution] || g.bitmaps[0] || Object.values(g.bitmaps)[0] || null;
    }
}

class DatLoader {
    constructor() {
        this.fieldSize = [2, -1, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0];
        this.datFile = null;
        this.collisionMapByGroup = new Map();
        this.collisionProfileByGroup = new Map();
        this.collisionCsvLoaded = false;
        this.visualInfoByGroup = new Map();
    }

    async load(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();
            this.datFile = this.parse(arrayBuffer);
            return this.datFile;
        } catch (e) {
            throw e;
        }
    }

    parseCsv(text) {
        const rows = [];
        let row = [];
        let field = "";
        let inQuotes = false;

        const pushField = () => {
            row.push(field);
            field = "";
        };

        const pushRow = () => {
            if (row.length > 0 && !(row.length === 1 && row[0] === "")) rows.push(row);
            row = [];
        };

        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (inQuotes) {
                if (ch === '"') {
                    if (text[i + 1] === '"') {
                        field += '"';
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    field += ch;
                }
            } else if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                pushField();
            } else if (ch === '\n') {
                pushField();
                pushRow();
            } else if (ch !== '\r') {
                field += ch;
            }
        }
        pushField();
        pushRow();

        if (rows.length === 0) return [];
        const header = rows[0];
        const objects = [];
        for (let i = 1; i < rows.length; i++) {
            const values = rows[i];
            const obj = {};
            for (let col = 0; col < header.length; col++) obj[header[col]] = values[col] ?? "";
            objects.push(obj);
        }
        return objects;
    }

    parseJsonArrayField(value) {
        if (!value) return null;
        try {
            return JSON.parse(value);
        } catch {
            return null;
        }
    }

    async loadCollisionCsvs(basePath = "js/spacecadet") {
        if (this.collisionCsvLoaded) return;
        const mapPath = `${basePath}/collision_map.csv`;
        const profilePath = `${basePath}/collision_ramp_gate_oneway.csv`;
        try {
            const [mapRes, profileRes] = await Promise.all([
                fetch(mapPath),
                fetch(profilePath)
            ]);
            if (mapRes.ok) {
                const mapRows = this.parseCsv(await mapRes.text());
                for (const row of mapRows) {
                    const groupId = Number(row.group_id);
                    if (!Number.isFinite(groupId)) continue;
                    this.collisionMapByGroup.set(groupId, {
                        objectType: Number(row.object_type),
                        objectTypeName: row.object_type_name,
                        groupName: row.group_name,
                        raw600: this.parseJsonArrayField(row.raw_600),
                        points: this.parseJsonArrayField(row.points_json)
                    });
                }
            }
            if (profileRes.ok) {
                const profileRows = this.parseCsv(await profileRes.text());
                for (const row of profileRows) {
                    const groupId = Number(row.group_id);
                    if (!Number.isFinite(groupId)) continue;
                    this.collisionProfileByGroup.set(groupId, {
                        objectType: Number(row.object_type),
                        objectTypeName: row.object_type_name,
                        groupName: row.group_name,
                        hasAnyCollisionTag: row.has_any_collision_tag === "true",
                        tag600: this.parseJsonArrayField(row.tag_600),
                        tag603: this.parseJsonArrayField(row.tag_603),
                        tag1300: this.parseJsonArrayField(row.tag_1300),
                        tag1301: this.parseJsonArrayField(row.tag_1301),
                        tag1302: this.parseJsonArrayField(row.tag_1302),
                        tag1303: this.parseJsonArrayField(row.tag_1303),
                    });
                }
            }
            this.collisionCsvLoaded = true;
        } catch (e) {
            console.warn("Collision CSV load failed:", e);
        }
    }

    getCollisionMapEntry(groupId) {
        return this.collisionMapByGroup.get(groupId) || null;
    }

    getCollisionProfile(groupId) {
        return this.collisionProfileByGroup.get(groupId) || null;
    }

    decodeFloatArray(entryBuffer) {
        const view = new DataView(entryBuffer);
        const count = Math.floor(entryBuffer.byteLength / 4);
        const out = new Array(count);
        for (let i = 0; i < count; i++) out[i] = view.getFloat32(i * 4, true);
        return out;
    }

    applyMaterialInfo(groupIndex, visualInfo) {
        const group = this.datFile?.groups?.[groupIndex];
        if (!group) return;
        for (const entry of group.entries) {
            if (entry.type !== FieldTypes.FloatArray) continue;
            const floats = this.decodeFloatArray(entry.buffer);
            for (let i = 0; i + 1 < floats.length; i += 2) {
                const code = Math.floor(floats[i]);
                const value = floats[i + 1];
                if (code === 301) visualInfo.smoothness = value;
                else if (code === 302) visualInfo.elasticity = value;
                else if (code === 304) visualInfo.softHitSoundId = Math.floor(value);
            }
        }
    }

    applyKickerInfo(groupIndex, visualInfo) {
        const group = this.datFile?.groups?.[groupIndex];
        if (!group) return;
        for (const entry of group.entries) {
            if (entry.type !== FieldTypes.FloatArray) continue;
            const floats = this.decodeFloatArray(entry.buffer);
            for (let i = 0; i < floats.length;) {
                const code = Math.floor(floats[i++]);
                if (code === 404) {
                    if (i + 2 >= floats.length) break;
                    visualInfo.kicker.throwBallDirection = {
                        x: floats[i],
                        y: floats[i + 1],
                        z: floats[i + 2]
                    };
                    i += 3;
                    continue;
                }
                if (i >= floats.length) break;
                const value = floats[i++];
                if (code === 401) visualInfo.kicker.threshold = value;
                else if (code === 402) visualInfo.kicker.boost = value;
                else if (code === 403) visualInfo.kicker.throwBallMult = value;
                else if (code === 405) visualInfo.kicker.throwBallAngleMult = value;
                else if (code === 406) visualInfo.hardHitSoundId = Math.floor(value);
            }
        }
    }

    queryVisualInfo(groupIndex) {
        if (!this.datFile || groupIndex < 0 || groupIndex >= this.datFile.groups.length) return null;
        const cached = this.visualInfoByGroup.get(groupIndex);
        if (cached) return cached;

        const info = {
            collisionGroup: 1,
            elasticity: 0.6,
            smoothness: 0.95,
            threshold: 1e9,
            boost: 0,
            softHitSoundId: 0,
            hardHitSoundId: 0,
            kicker: {
                threshold: 1e9,
                boost: 0,
                throwBallMult: 0,
                throwBallDirection: { x: 0, y: -1, z: 0 },
                throwBallAngleMult: 0,
            },
        };

        const group = this.datFile.groups[groupIndex];
        for (const entry of group.entries) {
            if (entry.type !== FieldTypes.ShortArray) continue;
            const arr = new Int16Array(entry.buffer);
            for (let i = 0; i < arr.length;) {
                const code = arr[i];
                if (code === 1500) {
                    i += 7;
                    continue;
                }
                if (i + 1 >= arr.length) break;
                const value = arr[i + 1];
                if (code === 300) this.applyMaterialInfo(value, info);
                else if (code === 400) this.applyKickerInfo(value, info);
                else if (code === 304) info.softHitSoundId = value;
                else if (code === 406) info.hardHitSoundId = value;
                else if (code === 602) info.collisionGroup |= (1 << value);
                i += 2;
            }
        }

        info.threshold = info.kicker.threshold;
        info.boost = info.kicker.boost;
        this.visualInfoByGroup.set(groupIndex, info);
        return info;
    }

    parse(arrayBuffer) {
        this.visualInfoByGroup.clear();
        const view = new DataView(arrayBuffer);
        let offset = 0;

        const readString = (len) => {
            const bytes = new Uint8Array(arrayBuffer, offset, len);
            let str = "";
            for (let i = 0; i < len; i++) {
                if (bytes[i] === 0) break;
                str += String.fromCharCode(bytes[i]);
            }
            offset += len;
            return str;
        };

        const signature = readString(21);
        if (signature !== "PARTOUT(4.0)RESOURCE") return null;

        const datFile = new DatFile();
        datFile.appName = readString(50);
        datFile.description = readString(100);
        const fileSize = view.getInt32(offset, true); offset += 4;
        const numberOfGroups = view.getInt16(offset, true); offset += 2;
        const sizeOfBody = view.getInt32(offset, true); offset += 4;
        const unknown = view.getInt16(offset, true); offset += 2;

        if (unknown > 0) offset += unknown;

        for (let g = 0; g < numberOfGroups; g++) {
            if (offset >= arrayBuffer.byteLength) break;
            const entryCount = view.getUint8(offset); offset += 1;
            const group = new GroupData(g);

            for (let e = 0; e < entryCount; e++) {
                if (offset >= arrayBuffer.byteLength) break;
                const type = view.getUint8(offset); offset += 1;
                let size = 0;
                if (type < this.fieldSize.length && this.fieldSize[type] >= 0) {
                    size = this.fieldSize[type];
                } else {
                    size = view.getInt32(offset, true); offset += 4;
                }

                const buffer = arrayBuffer.slice(offset, offset + size);
                offset += size;
                group.addEntry(new EntryData(type, buffer, size));
            }
            datFile.groups.push(group);
        }
        return datFile;
    }
}
