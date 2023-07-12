import { Task } from "./task";
import { graphicsTask } from "./graphics";
import { State } from "core/service/state";
import { comparator } from "../context/treeNode";
import { MutableHeap } from "shared/data/heap/mutableHeap";
import { getOrSetEmptyArray } from "shared/utils/map";
import { dist } from "../context/tree";
import { Fraction } from "core/math/fraction";

import type { Path } from "shared/types/geometry";
import type { Quadrant } from "../layout/pattern/quadrant";
import type { Repository } from "../layout/repository";
import type { ITreeNode, NodeGraphics } from "../context";

//=================================================================
/**
 * {@link patternContourTask} updates {@link NodeGraphics.$patternContours}.
 */
//=================================================================
export const patternContourTask = new Task(patternContour, graphicsTask);

function patternContour(): void {
	for(const repo of State.$repoUpdated) {
		clearPatternContourForRepo(repo); // Reset
		processRepo(repo);
	}
}

function processRepo(repo: Repository): void {
	const pattern = repo.$pattern;
	if(!pattern) return;

	const quadrantMap = new Map<ITreeNode, Quadrant[]>();
	for(const quadrant of repo.$quadrants.values()) {
		getOrSetEmptyArray(quadrantMap, quadrant.$flap).push(quadrant);
	}

	const coverageMap = getNodeCoverageMap(repo);

	for(const [node, leaves] of coverageMap.entries()) {
		// POC
		if(leaves.length != 1) continue;
		const quadrants = quadrantMap.get(leaves[0])!;
		for(const quadrant of quadrants) {
			const d = new Fraction(dist(node, quadrant.$flap, node) + node.$length);
			const start = quadrant.$getStart(d);
			const end = quadrant.$getEnd(d);
			const path: Path = [start, end].map(p => p.$toIPoint());
			path.repo = repo.$signature;
			node.$graphics.$patternContours.push(path);
		}
	}
}

export function clearPatternContourForRepo(repo: Repository): void {
	for(const id of repo.$nodeIds) {
		const g = State.$tree.$nodes[id]!.$graphics;
		g.$patternContours = g.$patternContours.filter(p => p.repo != repo.$signature);
	}
}

/**
 * Mapping all nodes (except for the branch root) involved in a
 * {@link Repository} to an array of leaf nodes under it.
 */
function getNodeCoverageMap(repo: Repository): Map<ITreeNode, ITreeNode[]> {
	const heap = new MutableHeap<ITreeNode>(comparator);
	const result = new Map<ITreeNode, ITreeNode[]>();
	const numLeaves = repo.$leaves.length;
	for(const id of repo.$leaves) {
		const leaf = State.$tree.$nodes[id]!;
		heap.$insert(leaf);
		result.set(leaf, [leaf]);
	}

	while(!heap.$isEmpty) {
		const node = heap.$pop()!;
		const coverage = result.get(node)!;

		// Stop processing if we've reached the branch root
		if(coverage.length == numLeaves) {
			result.delete(node);
			continue;
		}

		const parent = node.$parent!;
		const parentCoverage = getOrSetEmptyArray(result, parent, () => heap.$insert(parent));
		parentCoverage.push(...coverage);
	}

	return result;
}
