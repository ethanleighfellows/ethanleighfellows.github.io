class Bitmap8 {
    constructor(width, height, flags, x, y, indexed, buffer, resolution) {
        this.width = width;
        this.height = height;
        this.flags = flags;
        this.x = x;
        this.y = y;
        this.indexed = indexed;
        this.buffer = buffer; 
        this.resolution = resolution;
        this.texture = null; 
        this.isSpliced = (flags & 4) !== 0; 
        this.indexedStride = width % 4 === 0 ? width : width - (width % 4) + 4;
    }

    createImage(palette) {
        if (!palette || this.width <= 0 || this.height <= 0) return null;
        const imageData = new ImageData(this.width, this.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) data[i + 3] = 0;

        if (this.isSpliced) this.decodeSpliced(data, palette);
        else this.decodeRaw(data, palette);

        return imageData;
    }

    decodeRaw(data, palette) {
        for (let y = 0; y < this.height; y++) {
            const srcY = this.height - 1 - y;
            const srcRowOffset = srcY * this.indexedStride;
            const dstRowOffset = y * this.width * 4;
            for (let x = 0; x < this.width; x++) {
                const index = this.buffer[srcRowOffset + x];
                if (index === 0) continue; 
                const color = palette[index];
                const dst = dstRowOffset + (x * 4);
                if (color) {
                    data[dst] = color.r; data[dst + 1] = color.g; data[dst + 2] = color.b; data[dst + 3] = 255;
                }
            }
        }
    }

    decodeSpliced(data, palette) {
        const view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
        let offset = 0, dstInd = 0;
        const tableWidth = 600; 
        while (offset + 4 <= this.buffer.length) {
            let stride = view.getInt16(offset, true); offset += 2;
            if (stride < 0) break;
            if (stride > this.width) stride += (this.width - tableWidth);
            dstInd += stride;
            const count = view.getUint16(offset, true); offset += 2;
            for (let i = 0; i < count; i++) {
                if (offset + 3 > this.buffer.length) break;
                const depth = view.getUint16(offset, true); offset += 2;
                const pixelIndex = this.buffer[offset]; offset += 1;
                if (dstInd >= 0 && dstInd < this.width * this.height) {
                    const color = palette[pixelIndex];
                    if (color) {
                        const dst = dstInd * 4;
                        data[dst] = color.r; data[dst + 1] = color.g; data[dst + 2] = color.b; data[dst + 3] = 255;
                    }
                }
                dstInd++;
            }
        }
    }
}

class ZMap {
    constructor(width, height, stride, buffer) {
        this.width = width;
        this.height = height;
        this.stride = stride;
        this.buffer = buffer; // Uint16Array
    }
}

class Renderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.palette = [];
        this.zBuffer = new Uint16Array(this.width * this.height).fill(0xFFFF);
    }

    setPalette(paletteBuffer) {
        if (!paletteBuffer) return;
        const view = new DataView(paletteBuffer);
        this.palette = new Array(256);
        const sys = [{r:0,g:0,b:0},{r:128,g:0,b:0},{r:0,g:128,b:0},{r:128,g:128,b:0},{r:0,g:0,b:128},{r:128,g:0,b:128},{r:0,g:128,b:128},{r:192,g:192,b:192},{r:192,g:220,b:192},{r:166,g:202,b:240}];
        for (let i = 0; i < 10; i++) this.palette[i] = sys[i];
        for (let i = 10; i < 246; i++) {
            this.palette[i] = { b: view.getUint8(i * 4), g: view.getUint8(i * 4 + 1), r: view.getUint8(i * 4 + 2) };
        }
        this.palette[255] = {r:255, g:255, b:255};
    }

    // Ground Truth: 3DPB uses Z-Maps for occlusion
    drawBitmap(bitmap, x, y, zMap) {
        if (!bitmap || bitmap.width <= 0 || bitmap.height <= 0) return;
        if (!bitmap.texture) {
            const imgData = bitmap.createImage(this.palette);
            if (imgData) {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = bitmap.width; tempCanvas.height = bitmap.height;
                tempCanvas.getContext('2d').putImageData(imgData, 0, 0);
                bitmap.texture = tempCanvas;
            }
        }
        if (bitmap.texture) {
            const finalX = x !== undefined ? x : bitmap.x;
            const finalY = y !== undefined ? y : bitmap.y;
            this.ctx.drawImage(bitmap.texture, finalX, finalY);
            
            // If zMap provided, update the global zBuffer for this region
            if (zMap && zMap.buffer) {
                for (let row = 0; row < zMap.height; row++) {
                    for (let col = 0; col < zMap.width; col++) {
                        const dstX = finalX + col;
                        const dstY = finalY + row;
                        if (dstX >= 0 && dstX < this.width && dstY >= 0 && dstY < this.height) {
                            const z = zMap.buffer[row * zMap.stride + col];
                            if (z < 0xFFFF) this.zBuffer[dstY * this.width + dstX] = z;
                        }
                    }
                }
            }
        }
    }

    // Returns true if a point at depth Z is visible
    testZ(x, y, z) {
        const ix = Math.floor(x), iy = Math.floor(y);
        if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) return false;
        return z <= this.zBuffer[iy * this.width + ix];
    }

    clear() {
        if (!this.ctx) return;
        this.ctx.fillStyle = '#000'; 
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.zBuffer.fill(0xFFFF);
    }
}
