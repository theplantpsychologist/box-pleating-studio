import { AABBSide } from "./aabbSide";

import type { PerQuadrant } from "shared/types/direction";
import type { IRoundedRect } from "core/math/polyBool/intersection/roundedRect";
import type { Path } from "shared/types/geometry";
import type { Comparator } from "shared/types/types";

/** The order is inspired by CSS */
export enum Side {
	_top,
	_right,
	_bottom,
	_left,
}

const SIDES = [Side._top, Side._right, Side._bottom, Side._left];

const minComparator: Comparator<AABBSide> = (a, b) => a.$key - b.$key;
const maxComparator: Comparator<AABBSide> = (a, b) => b.$key - a.$key;


//=================================================================
/**
 * {@link AABB} (Axis-Aligned Bounding Box) is an orthogonal rectangular range.
 * It is composed of four {@link AABBSide}s, and most of its methods
 * encapsulate corresponding methods for these four components.
 *
 * Strictly speaking, there are two cases: when it is the bottom-level {@link AABB},
 * its boundaries are the variables themselves (the four tips of the flap);
 * or when it is not the bottom-level {@link AABB},
 * its boundaries are the union of all lower-level {@link AABB} (plus their margins).
 *
 * As {@link AABBSide} uses a heap for dynamic updates,
 * it can quickly ensure that it updates to the correct boundary regardless
 * of how the lower-level {@link AABB} changes.
 */
//=================================================================

export class AABB {

	private readonly _sides: Record<Side, AABBSide> & AABBSide[];

	/** Four tips of the flap. */
	public $points!: PerQuadrant<IPoint>;

	constructor() {
		this._sides = [
			new AABBSide(maxComparator), // top
			new AABBSide(maxComparator), // right
			new AABBSide(minComparator), // bottom
			new AABBSide(minComparator), // left
		];
	}

	public $intersects(that: AABB, gap: number): boolean {
		return this._sides[Side._left].$base - gap < that._sides[Side._right].$base &&
			this._sides[Side._right].$base + gap > that._sides[Side._left].$base &&
			this._sides[Side._top].$base + gap > that._sides[Side._bottom].$base &&
			this._sides[Side._bottom].$base - gap < that._sides[Side._top].$base;
	}

	public $update(top: number, right: number, bottom: number, left: number): void {
		this._sides[Side._top].$value = top;
		this._sides[Side._right].$value = right;
		this._sides[Side._bottom].$value = bottom;
		this._sides[Side._left].$value = left;
		this.$points = toCorners([top, right, bottom, left]);
	}

	public $setMargin(m: number): void {
		this._sides[Side._top].$margin = m;
		this._sides[Side._right].$margin = m;
		this._sides[Side._bottom].$margin = -m;
		this._sides[Side._left].$margin = -m;
	}

	/** For testing purpose */
	public $toArray(): number[] {
		return this._sides.map(s => s.$key);
	}

	/** Returns the values (without margin) of the four sides. */
	public $toValues(): number[] {
		return this._sides.map(s => s.$value);
	}

	public $toRoundedRect(extraUnits: number): IRoundedRect {
		const radius = this._sides[Side._top].$margin + extraUnits;
		const [t, r, b, l] = this._sides.map(s => s.$value);
		return {
			x: l,
			y: b,
			width: r - l,
			height: t - b,
			radius,
		};
	}

	/** Return the hinge path. */
	public $toPath(): Path {
		return toCorners(this._sides.map(s => s.$value + s.$margin));
	}

	public $addChild(child: AABB): boolean {
		let updated = false;
		for(const side of SIDES) {
			if(this._sides[side].$addChild(child._sides[side])) {
				updated = true;
			}
		}
		return updated;
	}

	public $removeChild(child: AABB): boolean {
		let updated = false;
		for(const side of SIDES) {
			if(this._sides[side].$removeChild(child._sides[side])) {
				updated = true;
			}
		}
		return updated;
	}

	public $updateChild(child: AABB): boolean {
		let updated = false;
		for(const side of SIDES) {
			if(this._sides[side].$updateChild(child._sides[side])) {
				updated = true;
			}
		}
		return updated;
	}
}

/** Four corners in the order of quadrants. */
export function toCorners([t, r, b, l]: number[]): [IPoint, IPoint, IPoint, IPoint] {
	return [
		{ x: r, y: t },
		{ x: l, y: t },
		{ x: l, y: b },
		{ x: r, y: b },
	];
}
