class Game2048 {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext("2d");

        // Dimensions
        this.width = 400;
        this.height = 400;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.gridSize = 4;
        this.cellSize = this.width / this.gridSize;
        this.margin = 10;
        
        this.grid = [];
        this.score = 0;
        this.gameOver = false;
        this.running = false;
        this.won = false;

        this.colors = {
            bg: '#bbada0',
            cell: 'rgba(238, 228, 218, 0.35)',
            2: '#eee4da',
            4: '#ede0c8',
            8: '#f2b179',
            16: '#f59563',
            32: '#f67c5f',
            64: '#f65e3b',
            128: '#edcf72',
            256: '#edcc61',
            512: '#edc850',
            1024: '#edc53f',
            2048: '#edc22e'
        };

        this.bindEvents();
    }

    bindEvents() {
        this._keydownListener = (e) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
                e.preventDefault();
                if (this.gameOver || this.won) return;
                
                let moved = false;
                if (e.key === 'ArrowUp' || e.key === 'w') moved = this.moveUp();
                if (e.key === 'ArrowDown' || e.key === 's') moved = this.moveDown();
                if (e.key === 'ArrowLeft' || e.key === 'a') moved = this.moveLeft();
                if (e.key === 'ArrowRight' || e.key === 'd') moved = this.moveRight();

                if (moved) {
                    this.addRandomTile();
                    if (this.checkGameOver()) {
                        this.gameOver = true;
                    }
                    this.draw();
                }
            }
        };
        window.addEventListener("keydown", this._keydownListener);
    }

    unbindEvents() {
        window.removeEventListener("keydown", this._keydownListener);
    }

    start() {
        this.running = true;
        this.resetGame();
    }

    stop() {
        this.running = false;
        this.unbindEvents();
    }

    resetGame() {
        this.grid = Array(this.gridSize).fill().map(() => Array(this.gridSize).fill(0));
        this.score = 0;
        this.gameOver = false;
        this.won = false;
        this.addRandomTile();
        this.addRandomTile();
        this.draw();
    }

    addRandomTile() {
        let emptyCells = [];
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                if (this.grid[r][c] === 0) emptyCells.push({r, c});
            }
        }
        if (emptyCells.length > 0) {
            let {r, c} = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            this.grid[r][c] = Math.random() < 0.9 ? 2 : 4;
        }
    }

    // Movement logic (simplified)
    slide(row) {
        let arr = row.filter(val => val);
        let missing = this.gridSize - arr.length;
        let zeros = Array(missing).fill(0);
        return arr.concat(zeros);
    }

    combine(row) {
        for (let i = 0; i < this.gridSize - 1; i++) {
            if (this.grid[i] !== 0 && this.grid[i] === this.grid[i+1]) {
                this.grid[i] *= 2;
                this.score += this.grid[i];
                if (this.grid[i] === 2048) this.won = true;
                this.grid[i+1] = 0;
            }
        }
        return this.grid;
    }

    // Helper to rotate grid to reuse logic
    rotateGrid() {
        let newGrid = Array(this.gridSize).fill().map(() => Array(this.gridSize).fill(0));
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                newGrid[c][this.gridSize - 1 - r] = this.grid[r][c];
            }
        }
        this.grid = newGrid;
    }

    moveLeft() {
        let oldGrid = JSON.stringify(this.grid);
        for (let r = 0; r < this.gridSize; r++) {
            let row = this.grid[r];
            row = this.slide(row);
            // Combine
            for (let i = 0; i < this.gridSize - 1; i++) {
                if (row[i] !== 0 && row[i] === row[i+1]) {
                    row[i] *= 2;
                    this.score += row[i];
                    if (row[i] === 2048) this.won = true;
                    row[i+1] = 0;
                }
            }
            row = this.slide(row);
            this.grid[r] = row;
        }
        return oldGrid !== JSON.stringify(this.grid);
    }

    moveRight() {
        this.rotateGrid();
        this.rotateGrid();
        let moved = this.moveLeft();
        this.rotateGrid();
        this.rotateGrid();
        return moved;
    }

    moveUp() {
        this.rotateGrid();
        this.rotateGrid();
        this.rotateGrid();
        let moved = this.moveLeft();
        this.rotateGrid();
        return moved;
    }

    moveDown() {
        this.rotateGrid();
        let moved = this.moveLeft();
        this.rotateGrid();
        this.rotateGrid();
        this.rotateGrid();
        return moved;
    }

    checkGameOver() {
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                if (this.grid[r][c] === 0) return false;
                if (c < this.gridSize - 1 && this.grid[r][c] === this.grid[r][c+1]) return false;
                if (r < this.gridSize - 1 && this.grid[r][c] === this.grid[r+1][c]) return false;
            }
        }
        return true;
    }

    draw() {
        this.ctx.fillStyle = this.colors.bg;
        this.ctx.fillRect(0, 0, this.width, this.height);

        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                let value = this.grid[r][c];
                let x = c * this.cellSize + this.margin;
                let y = r * this.cellSize + this.margin;
                let size = this.cellSize - this.margin * 2;

                this.ctx.fillStyle = this.colors[value] || this.colors.cell;
                this.ctx.beginPath();
                this.ctx.roundRect(x, y, size, size, 10);
                this.ctx.fill();

                if (value !== 0) {
                    this.ctx.fillStyle = value <= 4 ? '#776e65' : '#f9f6f2';
                    this.ctx.font = `bold ${value < 100 ? 40 : value < 1000 ? 30 : 25}px "Inter", sans-serif`;
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'middle';
                    this.ctx.fillText(value, x + size / 2, y + size / 2);
                }
            }
        }

        // Score
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 20px "Inter", sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`SCORE: ${this.score}`, 10, 30);

        if (this.gameOver || this.won) {
            this.ctx.fillStyle = 'rgba(238, 228, 218, 0.73)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = '#776e65';
            this.ctx.font = 'bold 60px "Inter", sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(this.won ? 'You Win!' : 'Game Over!', this.width / 2, this.height / 2);
        }
    }
}
