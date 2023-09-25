import { Task } from "./task";
import { climb } from "./climb";
import { State } from "core/service/state";
import { patternContourTask } from "./patternContour";
import { getOrSetEmptyArray } from "shared/utils/map";
import { RoughContourContext } from "./roughContourContext";

import type { NodeSet } from "../layout/nodeSet";
import type { ITreeNode, NodeGraphics, RoughContour } from "../context";

export interface RepoCorners {
	nodeSet: NodeSet;
	corners: string[];
}

//=================================================================
/**
 * {@link roughContourTask} updates {@link NodeGraphics.$roughContours}.
 */
//=================================================================
export const roughContourTask = new Task(roughContour, patternContourTask);

const nodeSetMap = new Map<number, NodeSet[]>();

function roughContour(): void {
	nodeSetMap.clear();
	for(const stretch of State.$stretches.values()) {
		if(!stretch.$repo.$pattern) continue;
		const set = stretch.$repo.$nodeSet;
		for(const id of set.$nodes) {
			getOrSetEmptyArray(nodeSetMap, id).push(set);
		}
	}

	// All nodes involved in the repo to be updated needs to be recalculated,
	// as it could go from raw mode to normal mode and vice versa.
	// TODO: improve efficiency of this part.
	const repoNodes = new Set<ITreeNode>();
	const tree = State.$tree;
	for(const repo of [...State.$repoToProcess]) {
		const nodes = repo.$nodeSet.$nodes.map(id => tree.$nodes[id]!);
		for(const node of nodes) repoNodes.add(node);
	}

	climb(updater,
		State.$flapAABBChanged,
		State.$parentChanged,
		State.$childrenChanged,
		State.$lengthChanged,
		repoNodes
	);
}

function updater(node: ITreeNode): boolean {
	if(!node.$parent) return false;
	if(node.$isLeaf) {
		// Base case
		const path = node.$AABB.$toPath();
		const contour: RoughContour = {
			$outer: path,
			$leaves: [node.id],
		};
		node.$graphics.$roughContours = [contour];
	} else {
		const nodeSets = nodeSetMap.get(node.id);
		const context = new RoughContourContext(node, nodeSets);
		context.$process();
	}
	State.$contourWillChange.add(node);
	return true;
}
