const TILE_FLAGGED = 0b10000000
const TILE_MARKED = 0b01000000
const TILE_OPEN = 0b00100000
const TILE_MINE = 0b00010000

const neighborOffsets = [
	-1, -1,
	0, -1,
	1, -1,
	-1, 0,
	1, 0,
	-1, 1,
	0, 1,
	1, 1
]

const STATE_PLAYING = 0
const STATE_WON = 1
const STATE_LOST = 2

class Minesweeper {
	#width
	#height

	#smileId

	/**
	 * @param {number} width
	 * @param {number} height
	 * @param {number} mineCount
	 */
	constructor(width, height, mineCount) {
		this.#width = width
		this.#height = height

		this.state = STATE_PLAYING

		this.#smileId = 0
		this.pressingSmile = false

		this.clickedMineX = 0
		this.clickedMineY = 0

		this.openedTiles = 0

		this.flagCount = 0
		this.mineCount = mineCount

		this.previousTimer = 0
		this.timer = 0

		this.sprites = new Image()
		this.spritesLoaded = false

		this.sprites.onload = (event) => {
			this.spritesLoaded = true
		}
		this.sprites.src = "dark.png"

		this.madeFirstMove = false

		this.mouseTileX = 0
		this.mouseTileY = 0

		this.mouseOverBoard = false

		this.mouseDown = false

		this.marksEnabled = true
		this.soundsEnabled = true

		this.shouldDrawBorders = true
		this.shouldDrawHud = true
		this.shouldDrawBoard = true

		this.soundEffects = {
			lose: new Audio("lose.wav"),
			tick: new Audio("tick.wav"),
			win: new Audio("win.wav")
		}

		for (const sound of Object.values(this.soundEffects)) {
			sound.load()
		}

		this.tiles = new Uint8Array(width * height)
	}

	get width() {
		return this.#width
	}
	get height() {
		return this.#height
	}

	set width(value) {
		this.#width = value
	
		this.shouldDrawBorders = true
		this.shouldDrawHud = true
		this.shouldDrawBoard = true
	}
	set height(value) {
		this.#height = value

		this.shouldDrawBorders = true
		this.shouldDrawHud = true
		this.shouldDrawBoard = true
	}

	get smileId() {
		return this.#smileId
	}

	set smileId(value) {
		this.#smileId = value

		this.shouldDrawHud = true
	}

	/**
	 * @param {CanvasRenderingContext2D} canvasContext
	 * @param {number} sx
	 * @param {number} sy
	 * @param {number} sw
	 * @param {number} sh
	 * @param {number} left
	 * @param {number} top
	 * @param {number} right
	 * @param {number} bottom
	 * @param {number} dx
	 * @param {number} dy
	 * @param {number} dw
	 * @param {number} dh
	 */
	drawNineSlice(canvasContext, sx, sy, sw, sh, left, top, right, bottom, dx, dy, dw, dh) {
		canvasContext.drawImage(this.sprites, sx, sy, left, top, dx, dy, left, top)
		canvasContext.drawImage(this.sprites, sx + sw - right, sy, right, top, dx + dw - right, dy, right, top)
		canvasContext.drawImage(this.sprites, sx, sy + sh - bottom, left, bottom, dx, dy + dh - bottom, left, bottom)
		canvasContext.drawImage(this.sprites, sx + sw - right, sy + sh - bottom, right, bottom, dx + dw - right, dy + dh - bottom, right, bottom)

		canvasContext.drawImage(this.sprites, sx, sy + top, left, sh - top - bottom, dx, dy + top, left, dh - top - bottom)
		canvasContext.drawImage(this.sprites, sx + sw - right, sy + top, right, sh - top - bottom, dx + dw - right, dy + top, left, dh - top - bottom)
		canvasContext.drawImage(this.sprites, sx + left, sy, sw - left - right, top, dx + left, dy, dw - left - right, top)
		canvasContext.drawImage(this.sprites, sx + left, sy + sh - bottom, sw - left - right, bottom, dx + left, dy + dh - bottom, dw - left - right, bottom)
		
		canvasContext.drawImage(this.sprites, sx + left, sy + top, sw - left - right, sh - top - bottom, dx + left, dy + top, dw - left - right, dh - top - bottom)
	}

	/**
	 * @param {CanvasRenderingContext2D} canvasContext
	 * @param {string} text
	 * @param {number} x
	 * @param {number} y
	 */
	drawSegmentDisplay(canvasContext, text, x, y) {
		const characters = "0123456789- "

		for (const character of text) {
			const index = characters.includes(character) ? characters.indexOf(character) : characters.indexOf(" ")

			canvasContext.drawImage(this.sprites, index * 13, 0, 13, 23, x, y, 13, 23)

			x += 13
		}
	}

	/**
	 * @param {CanvasRenderingContext2D} canvasContext
	 * @param {number} number
	 * @param {number} x
	 * @param {number} y
	 */
	drawNumber(canvasContext, number, x, y) {
		number = Math.trunc(number)

		this.drawSegmentDisplay(canvasContext, number < 0 ? "-" + Math.min(-number, 99).toString(10).padStart(2, "0") : Math.min(number, 999).toString(10).padStart(3, "0"), x, y)
	}

	/**
	 * @param {CanvasRenderingContext2D} canvasContext
	 */
	draw(canvasContext) {
		if (!this.spritesLoaded) { return }

		const canvas = canvasContext.canvas

		const targetWidth = 24 + this.#width * 16
		const targetHeight = 67 + this.#height * 16

		if (canvas.width !== targetWidth) {
			canvas.width = targetWidth
		}
		if (canvas.height !== targetHeight) {
			canvas.height = targetHeight
		}

		canvasContext.imageSmoothingEnabled = false
		canvasContext.imageSmoothingQuality = "high"

		if (this.shouldDrawBorders) {
			this.drawNineSlice(canvasContext, 0, 32, 9, 9, 3, 3, 3, 3, 0, 0, canvas.width, canvas.height)

			this.drawNineSlice(canvasContext, 0, 23, 9, 9, 3, 3, 3, 3, 9, 52, this.#width * 16 + 6, this.#height * 16 + 6)
		}

		if (this.shouldDrawBoard) {
			for (let x = 0; x < this.#width; x ++) {
				for (let y = 0; y < this.#height; y ++) {
					const realX = 12 + x * 16
					const realY = 55 + y * 16

					const tile = this.tiles[x + y * this.#width]

					const hovering = this.state === STATE_PLAYING && !this.pressingSmile && this.mouseOverBoard && this.mouseDown && this.mouseTileX === x && this.mouseTileY === y

					if (this.state === STATE_LOST && this.clickedMineX === x && this.clickedMineY === y) {
						canvasContext.drawImage(this.sprites, 96, 49, 16, 16, realX, realY, 16, 16)
					}
					else {
						if (tile & TILE_FLAGGED) {
							if (this.state === STATE_LOST && !(tile & TILE_MINE)) {
								canvasContext.drawImage(this.sprites, 80, 49, 16, 16, realX, realY, 16, 16)
							}
							else {
								canvasContext.drawImage(this.sprites, 16, 49, 16, 16, realX, realY, 16, 16)
							}
						}
						else if (this.state === STATE_LOST && (tile & TILE_MINE)) {
							canvasContext.drawImage(this.sprites, 64, 49, 16, 16, realX, realY, 16, 16)
						}
						else if (this.state === STATE_WON && (tile & TILE_MINE)) {
							canvasContext.drawImage(this.sprites, 16, 49, 16, 16, realX, realY, 16, 16)
						}
						else if (tile & TILE_OPEN) {
							canvasContext.drawImage(this.sprites, (tile & 0x0F) * 16, 65, 16, 16, realX, realY, 16, 16)
						}
						else if (tile & TILE_MARKED) {
							canvasContext.drawImage(this.sprites, hovering ? 48 : 32, 49, 16, 16, realX, realY, 16, 16)
						}
						else {
							canvasContext.drawImage(this.sprites, 0, hovering ? 65 : 49, 16, 16, realX, realY, 16, 16)
						}
					}
				}
			}
		
			this.shouldDrawBoard = false
		}
	
		if (this.shouldDrawBorders) {
			this.drawNineSlice(canvasContext, 9, 23, 6, 6, 2, 2, 2, 2, 9, 9, this.#width * 16 + 6, 37)
			
			this.drawNineSlice(canvasContext, 15, 23, 3, 3, 1, 1, 1, 1, 16, 15, 3 * 13 + 2, 25)
			this.drawNineSlice(canvasContext, 15, 23, 3, 3, 1, 1, 1, 1, canvas.width - 58, 15, 3 * 13 + 2, 25)

			this.shouldDrawBorders = false
		}

		if (this.shouldDrawHud) {
			this.drawNumber(canvasContext, this.mineCount - this.flagCount, 17, 16)

			this.drawSegmentDisplay(canvasContext, Math.trunc(Math.min(this.timer / 1000, 999)).toString(10).padStart(3, "0"), canvas.width - 57, 16)

			if (this.state !== STATE_PLAYING && (this.#smileId === 0 || this.#smileId == 2)) {
				canvasContext.drawImage(this.sprites, this.state === STATE_WON ? 97 : 123, 23, 26, 26, Math.round(canvas.width / 2 - 13), 15, 26, 26)
			}
			else {
				canvasContext.drawImage(this.sprites, 19 + 26 * this.#smileId, 23, 26, 26, Math.round(canvas.width / 2 - 13), 15, 26, 26)
			}

			this.shouldDrawHud = false
		}
	}

	/**
	 * @param {number} deltaTime
	 */
	update(deltaTime) {
		if (this.state === STATE_PLAYING && this.openedTiles >= this.#width * this.#height - this.mineCount) {
			this.state = STATE_WON
	
			this.shouldDrawHud = true
			this.shouldDrawBoard = true

			if (this.soundsEnabled) {
				this.soundEffects.win.play()
			}
		}

		if (this.madeFirstMove && this.state === STATE_PLAYING) {
			this.timer += deltaTime
		}

		const displayTimer = Math.trunc(Math.min(this.timer / 1000, 999))

		if (displayTimer !== this.previousTimer) {
			this.soundEffects.tick.play()
			this.previousTimer = displayTimer
			
			this.shouldDrawHud = true
		}
	}

	/**
	 * @param {number} firstClickX
	 * @param {number} firstClickY
	 */
	generateBoard(firstClickX, firstClickY) {
		for (let i = 0; i < this.mineCount; i ++) {
			let x = Math.floor(Math.random() * this.#width)
			let y = Math.floor(Math.random() * this.#height)
			
			while ((this.tiles[x + y * this.#width] & TILE_MINE) || (x === firstClickX && y === firstClickY)) {
				x = Math.floor(Math.random() * this.#width)
				y = Math.floor(Math.random() * this.#height)
			}

			this.tiles[x + y * this.#width] |= TILE_MINE
		}

		for (let x = 0; x < this.#width; x ++) {
			for (let y = 0; y < this.#height; y ++) {
				let neighboringMines = 0

				for (let i = 0; i < neighborOffsets.length; i += 2) {
					const neighborX = x + neighborOffsets[i]
					const neighborY = y + neighborOffsets[i + 1]

					if (neighborX >= 0 && neighborY >= 0 && neighborX < this.#width && neighborY < this.#height) {
						if (this.tiles[neighborX + neighborY * this.#width] & TILE_MINE) {
							neighboringMines ++
						}
					}
				}

				this.tiles[x + y * this.#width] |= neighboringMines
			}
		}
	}

	openTile(tileX, tileY) {
		if (this.state !== STATE_PLAYING) { return }

		if (!this.madeFirstMove) {
			this.madeFirstMove = true

			this.generateBoard(tileX, tileY)
		}

		const index = tileX + tileY * this.#width
		const tile = this.tiles[index]

		if (tile & TILE_OPEN) { return }
		if (tile & TILE_FLAGGED) { return }

		if (tile & TILE_MINE) {
			this.state = STATE_LOST

			this.shouldDrawHud = true
			this.shouldDrawBoard = true

			this.clickedMineX = tileX
			this.clickedMineY = tileY

			if (this.soundsEnabled) {
				this.soundEffects.lose.play()
			}
		}
		else {
			this.shouldDrawBoard = true
		
			const queue = [tileX, tileY]
			
			while (queue.length > 0) {
				const y = queue.pop()
				const x = queue.pop()

				const index = x + y * this.#width
				const tile = this.tiles[index]

				if (!(tile & TILE_OPEN)) {
					this.tiles[index] = (tile | TILE_OPEN) & ~TILE_MARKED
					this.openedTiles ++
				}

				if ((tile & 0x0F) === 0) {
					for (let i = 0; i < neighborOffsets.length; i += 2) {
						const neighborX = x + neighborOffsets[i]
						const neighborY = y + neighborOffsets[i + 1]

						if (neighborX >= 0 && neighborY >= 0 && neighborX < this.#width && neighborY < this.#height) {
							const tile = this.tiles[neighborX + neighborY * this.#width]

							if (!(tile & (TILE_FLAGGED | TILE_OPEN))) {
								queue.push(neighborX, neighborY)
							}
						}
					}
				}
			}
		}
	}

	chordTile(tileX, tileY) {
		if (this.state !== STATE_PLAYING) { return }

		const index = tileX + tileY * this.#width
		const tile = this.tiles[index]

		if (!(tile & TILE_OPEN)) { return }

		let flaggedNeighbors = 0
		
		for (let i = 0; i < neighborOffsets.length; i += 2) {
			const neighborX = tileX + neighborOffsets[i]
			const neighborY = tileY + neighborOffsets[i + 1]

			if (neighborX >= 0 && neighborY >= 0 && neighborX < this.#width && neighborY < this.#height) {
				const tile = this.tiles[neighborX + neighborY * this.#width]

				if (tile & TILE_FLAGGED) {
					flaggedNeighbors ++
				}
			}
		}

		if (flaggedNeighbors === (tile & 0x0F)) {
			for (let i = 0; i < neighborOffsets.length; i += 2) {
				const neighborX = tileX + neighborOffsets[i]
				const neighborY = tileY + neighborOffsets[i + 1]

				if (neighborX >= 0 && neighborY >= 0 && neighborX < this.#width && neighborY < this.#height) {
					this.openTile(neighborX, neighborY)
				}
			}
		}
	}

	flagTile(tileX, tileY) {
		if (this.state !== STATE_PLAYING) { return }
		
		const index = tileX + tileY * this.#width
		const tile = this.tiles[index]

		if (tile & TILE_OPEN) { return }

		if (tile & TILE_MARKED) {
			this.tiles[index] = tile & ~TILE_MARKED
	
			this.shouldDrawBoard = true
			return
		}
		else if (tile & TILE_FLAGGED) {
			if (this.marksEnabled) {
				this.tiles[index] = (tile | TILE_MARKED) & ~TILE_FLAGGED
				this.flagCount --
			}
			else {
				this.tiles[index] = tile & ~TILE_FLAGGED
				this.flagCount --
			}
		}
		else {
			this.tiles[index] = tile | TILE_FLAGGED
			this.flagCount ++
		}
	
		this.shouldDrawBoard = true
		this.shouldDrawHud = true
	}
}

window.onload = () => {
	const game = new Minesweeper(9, 9, 10)

	const canvas = document.getElementById("game")
	const canvasContext = canvas.getContext("2d")

	let clickedFromInside = false

	canvas.addEventListener("mousedown", (event) => {
		clickedFromInside = true

		if (event.button === 0) {
			game.mouseDown = true

			const smileX = Math.round(canvas.width / 2 - 13)

			if (event.offsetX > smileX && event.offsetY > 15 && event.offsetX < smileX + 26 && event.offsetY < 41) {
				game.smileId = 1
				game.pressingSmile = true
			}
			else {
				game.smileId = 2
			}
		}
		else if (event.button === 1) {
			const boardX = event.offsetX - 12
			const boardY = event.offsetY - 55
			
			if (boardX > 0 && boardY > 0 && boardX < game.width * 16 && boardY < game.height * 16) {
				game.chordTile(Math.floor(boardX / 16), Math.floor(boardY / 16))
			}
		}
		else if (event.button === 2 && !game.pressingSmile) {
			const boardX = event.offsetX - 12
			const boardY = event.offsetY - 55
			
			if (boardX > 0 && boardY > 0 && boardX < game.width * 16 && boardY < game.height * 16) {
				game.flagTile(Math.floor(boardX / 16), Math.floor(boardY / 16))
			}
		}
	})
	canvas.addEventListener("mouseup", (event) => {
		if (!clickedFromInside) { return }
		clickedFromInside = false

		if (event.button === 0) {
			if (game.smileId === 1 || game.smileId === 2) {
				game.smileId = 0
			}

			const smileX = Math.round(canvas.width / 2 - 13)

			if (game.pressingSmile && event.offsetX > smileX && event.offsetY > 15 && event.offsetX < smileX + 26 && event.offsetY < 41) {
				game.state = STATE_PLAYING

				game.openedTiles = 0

				game.flagCount = 0

				game.previousTimer = 0
				game.timer = 0

				game.madeFirstMove = false

				game.shouldDrawBoard = true
				game.shouldDrawHud = true

				game.tiles.fill(0)
			}
			else {
				const boardX = event.offsetX - 12
				const boardY = event.offsetY - 55
				
				if (boardX > 0 && boardY > 0 && boardX < game.width * 16 && boardY < game.height * 16) {
					const tileX = Math.floor(boardX / 16)
					const tileY = Math.floor(boardY / 16)
					
					if (game.tiles[tileX + tileY * game.width] & TILE_OPEN) {
						game.chordTile(tileX, tileY)
					}
					else {
						game.openTile(tileX, tileY)
					}
				}
			}
		}
	})

	document.addEventListener("mouseup", (event) => {
		if (event.button === 0) {
			if (game.smileId === 1 || game.smileId === 2) {
				game.smileId = 0
			}

			game.mouseDown = false
			game.pressingSmile = false
		}
	})

	canvas.addEventListener("mousemove", (event) => {
		const smileX = Math.round(canvas.width / 2 - 13)

		if (game.smileId === 1 && (event.offsetX <= smileX || event.offsetY <= 15 || event.offsetX >= smileX + 26 || event.offsetY >= 41)) {
			game.smileId = 0
		}
		else if (game.pressingSmile && game.smileId === 0 && event.offsetX > smileX && event.offsetY > 15 && event.offsetX < smileX + 26 && event.offsetY < 41) {
			game.smileId = 1
		}
		else {
			const boardX = event.offsetX - 12
			const boardY = event.offsetY - 55
			
			if (boardX > 0 && boardY > 0 && boardX < game.width * 16 && boardY < game.height * 16) {
				game.mouseTileX = Math.floor(boardX / 16)
				game.mouseTileY = Math.floor(boardY / 16)

				game.mouseOverBoard = true
				game.shouldDrawBoard = true
			}
			else {
				if (game.mouseOverBoard) {
					game.shouldDrawBoard = true
				}

				game.mouseOverBoard = false
			}
		}
	})

	canvas.addEventListener("click", (event) => {
		event.preventDefault()
	})
	canvas.addEventListener("contextmenu", (event) => {
		event.preventDefault()
	})

	let lastTime = performance.now()

	function gameLoop(now) {
		const deltaTime = now - lastTime
		lastTime = now

		game.update(deltaTime)
		game.draw(canvasContext)

		requestAnimationFrame(gameLoop)
	}

	requestAnimationFrame(gameLoop)
}