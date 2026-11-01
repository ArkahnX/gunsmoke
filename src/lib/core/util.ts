import { Node } from "./node";

/**
 * Backtrace from end node through parents and return the path.
 * @param node
 * @param includeStartingNode
 */
export function backtrace(node: Node): number[][] {
	// Init empty path
	const path: number[][] = [];

	// Attach the end node to be the current node
	let currentNode: Node = node;

	// Loop as long the current node has a parent
	let parent = currentNode.getParent();
	while (parent) {
		path.push([currentNode.position.x, currentNode.position.y]);
		currentNode = parent;
		parent = currentNode.getParent();
	}

	// We will also include the starting node
	path.push([currentNode.position.x, currentNode.position.y]);

	return path.reverse();
}
