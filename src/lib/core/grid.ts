import { Node } from "./node";
import { IPoint } from "../interfaces/astar.interfaces";

export class Grid {
	// General properties
	readonly width: number;
	readonly height: number;
	readonly numberOfFields: number;

	// The node grid
	private gridNodes: Node[][];

	constructor(matrix: number[][]) {
		// Set the general properties
		this.width = matrix[0].length;
		this.height = matrix.length;
		this.numberOfFields = this.width * this.height;

		// Create and generate the matrix
		this.gridNodes = this.buildGridWithNodes(matrix, this.width, this.height);
	}

	/**
	 * Build grid, fill it with nodes and return it.
	 * @param matrix [ 0 or 1: 0 = walkable; 1 = not walkable ]
	 * @param width [grid width]
	 * @param height [grid height]
	 */
	private buildGridWithNodes(matrix: number[][], width: number, height: number): Node[][] {
		const newGrid: Node[][] = [];
		let id = 0;

		// Generate an empty matrix
		for (let y = 0; y < height; y++) {
			newGrid[y] = [];
			for (let x = 0; x < width; x++) {
				newGrid[y][x] = new Node({
					id: id,
					position: { x: x, y: y },
				});

				id++;
			}
		}

		/**
		 * In case we have a matrix loaded.
		 * Load up the informations of the matrix.
		 */
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				newGrid[y][x].setIsWalkable(matrix[y][x] ? false : true);
			}
		}

		return newGrid;
	}

	/**
	 * Return a specific node.
	 * @param position [position on the grid]
	 */
	public getNodeAt(position: IPoint): Node {
		return this.gridNodes[position.y][position.x];
	}

	/**
	 * Check if specific node walkable.
	 * @param position [position on the grid]
	 */
	public isWalkableAt(position: IPoint): boolean {
		return this.gridNodes[position.y][position.x].getIsWalkable();
	}

	/**
	 * Check if specific node is on the grid.
	 * @param position [position on the grid]
	 */
	private isOnTheGrid(position: IPoint): boolean {
		return position.x >= 0 && position.x < this.width && position.y >= 0 && position.y < this.height;
	}

	/**
	 * Get surrounding nodes.
	 * @param currentPosition [IPoint on the grid]
	 * @param diagnonalMovementAllowed [is diagnonal movement allowed?]
	 */
	public getSurroundingNodes(currentPosition: IPoint, diagnonalMovementAllowed: boolean): Node[] {
		const surroundingNodes: Node[] = [];

		const minX = currentPosition.x - 1;
		const maxX = currentPosition.x + 1;
		const minY = currentPosition.y - 1;
		const maxY = currentPosition.y + 1;

		for (let y = minY; y <= maxY; y++) {
			for (let x = minX; x <= maxX; x++) {
				// Evaluate if NOT current position
				if (x !== currentPosition.x || y !== currentPosition.y) {
					// Evaluate if current position is on the grid AND walkable
					if (this.isOnTheGrid({ x: x, y: y }) && this.isWalkableAt({ x: x, y: y })) {
						// Add node
						// if diagonal movement is allowed OR
						// if the node lies on the cross through the center node
						if (diagnonalMovementAllowed || x == currentPosition.x || y == currentPosition.y) {
							surroundingNodes.push(this.getNodeAt({ x: x, y: y }));
						}
					}
				}
			}
		}

		return surroundingNodes;
	}

	public setGrid(newGrid: Node[][]): void {
		this.gridNodes = newGrid;
	}

	/**
	 * Reset the grid
	 */
	public resetGrid(): void {
		// eslint-disable-next-line @typescript-eslint/prefer-for-of
		for (let y = 0; y < this.gridNodes.length; y++) {
			// eslint-disable-next-line @typescript-eslint/prefer-for-of
			for (let x = 0; x < this.gridNodes[y].length; x++) {
				this.gridNodes[y][x].setIsOnClosedList(false);
				this.gridNodes[y][x].setIsOnOpenList(false);
				this.gridNodes[y][x].setParent(undefined);
				this.gridNodes[y][x].setFGHValuesToZero();
			}
		}
	}

	/**
	 * Get all the nodes of the grid.
	 */
	public getGridNodes(): Node[][] {
		return this.gridNodes;
	}

	/**
	 * Get a clone of the grid
	 */
	public clone(): Node[][] {
		const clonedGrid: Node[][] = [];
		let nodeId = 0;

		for (let y = 0; y < this.height; y++) {
			clonedGrid[y] = [];
			for (let x = 0; x < this.width; x++) {
				clonedGrid[y][x] = new Node({
					id: nodeId,
					position: { x: x, y: y },
					walkable: this.gridNodes[y][x].getIsWalkable(),
				});

				nodeId++;
			}
		}

		return clonedGrid;
	}
}
