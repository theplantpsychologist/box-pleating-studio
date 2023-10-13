import { AAUnion } from "core/math/sweepLine/polyBool/aaUnion/aaUnion";
import { deduplicate } from "core/math/geometry/path";
import { RoughUnion } from "core/math/sweepLine/polyBool/aaUnion/roughUnion";

import type { UnionResult } from "core/math/sweepLine/polyBool/aaUnion/roughUnion";
import type { RoughContour } from "core/design/context";
import type { Path, PathEx, Polygon } from "shared/types/geometry";

export const aaUnion = new AAUnion();
const roughUnion = new RoughUnion();

type CheckCallback = (result: readonly PathEx[], leaves: readonly number[]) => PathEx[] | undefined;

/**
 * Expand the given AA polygon by given units, and generate contours matching outer and inner paths.
 */
export function expand(inputs: readonly RoughContour[], units: number, check?: CheckCallback): RoughContour[] {
	const components = roughUnion.$union(...inputs.map(c => {
		const result: Polygon = [];
		for(const outer of c.$outer) {
			const expanded = expandPath(outer, units);
			// Exclude holes that are over-shrunk.
			// This does not remove degenerated holes,
			// but those will be removed as we take the union.
			if(!outer.isHole || expanded.isHole) result.push(expanded);
		}
		return result;
	}));

	const contours: RoughContour[] = [];
	for(const component of components) {
		contours.push(componentToContour(inputs, component, check));
	}
	return contours;
}

function componentToContour(
	inputs: readonly RoughContour[],
	component: UnionResult,
	check?: CheckCallback
): RoughContour {
	let raw = false;
	let outers = component.paths.map(simplify);
	const children = component.from.map(i => inputs[i]);
	const leaves = children.flatMap(c => c.$leaves);
	if(check) {
		const checkResult = check(outers, leaves);
		if(checkResult) {
			outers = checkResult;
			raw = true;
		}
	}

	// For raw mode, we simply keep the inner contours as they are.
	const inners = raw ? children.flatMap(c => c.$outer) :
		// In theory, simply taking the union here could result in failure in pattern contour insertion,
		// but in practice such failure can only occur when the layout is invalid (or so it seems),
		// So we don't really need to worry about that.
		aaUnion.$get(...children.flatMap(c => c.$raw ? c.$outer.map(p => [p]) : [c.$outer]));

	return { $outer: outers, $inner: inners, $leaves: leaves, $raw: raw };
}

/**
 * Expand a given {@link Path} by given units.
 * At the same time, determine if the path is a hole.
 *
 * The method of determining is simple:
 * if the point with the smallest x value shifts towards the right,
 * then then path is a hole.
 */
export function expandPath(path: PathEx, units: number): PathEx {
	const l = path.length;
	const result: PathEx = [];
	let minX = Number.POSITIVE_INFINITY, minXDelta: number = 0;
	for(let i = 0, j = l - 1; i < l; j = i++) {
		// Decide the direction of shifting.
		// Here we assume that the polygon is non-degenerated.
		const p = path[i];
		const p1 = path[j], p2 = path[i + 1] || path[0];
		const dx = Math.sign(p2.y - p1.y) * units;
		const dy = Math.sign(p1.x - p2.x) * units;
		if(p.x < minX) {
			minX = p.x;
			minXDelta = dx;
		}
		result.push({ x: p.x + dx, y: p.y + dy });
	}
	if(minXDelta > 0) result.isHole = true;
	return result;
}

/**
 * In our use cases, it is often implicitly assumed that each vertex of a path
 * is actually a turning corner. This function removes the non-turning
 * vertices in the path, to prevent potential bugs in tracing logics.
 */
function simplify(path: PathEx): PathEx {
	if(!path) return [];
	// First we need to remove duplicate vertices,
	// or the next step won't work correctly.
	const deduplicated = deduplicate(path);

	// Then we can check the turning condition.
	const l = deduplicated.length;
	deduplicated.push(deduplicated[0]);
	const result: PathEx = [];
	for(let i = 0, j = l - 1; i < l; j = i++) {
		const prev = deduplicated[j];
		const next = deduplicated[i + 1];
		const dx = next.x - prev.x, dy = next.y - prev.y;
		if(dx != 0 && dy != 0) result.push(deduplicated[i]);
	}
	result.isHole = path.isHole;
	return result;
}
