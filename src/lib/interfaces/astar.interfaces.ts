import { Heuristic } from "../types/astar.types";

export interface IAStarFinderConstructor {
	grid: number[][];
	diagonalAllowed?: boolean;
	heuristic?: Heuristic;
	weight?: number;
}

export interface INodeConstructor {
	id: number;
	position: IPoint;
	walkable?: boolean;
}

export interface IPoint {
	x: number;
	y: number;
}
