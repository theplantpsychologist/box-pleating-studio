import { Piece } from "./piece";
import { Point } from "core/math/geometry/point";
import { makePerQuadrant } from "shared/types/direction";
import { Vector } from "core/math/geometry/vector";
import { cache } from "core/utils/cache";

import type { PerQuadrant, QuadrantDirection } from "shared/types/direction";
import type { JAnchor, JGadget, JOverlap } from "shared/json";
import type { Device } from "./device";

/**
 * The first field is the anchor point itself,
 * ths second field is the index of the {@link Piece} from which it came (if available).
 */
export type AnchorMap = [Point, number | null];

//=================================================================
/**
 * {@link Gadget} is a component in a {@link Device} corresponding to a single {@link JOverlap}.
 * It always have four {@link JAnchor}s.
 */
//=================================================================
export class Gadget implements JGadget {

	public pieces: readonly Piece[];
	public offset?: IPoint;
	public anchors?: JAnchor[];

	constructor(data: JGadget) {
		this.pieces = data.pieces.map(p => new Piece(p));
		this.offset = data.offset;
		this.pieces.forEach(p => p.$offset(this.offset));
		this.anchors = data.anchors;
	}

	@cache public get sx(): number {
		return Math.ceil(this.$anchorMap[2][0].x - this.$anchorMap[0][0].x);
	}

	@cache public get sy(): number {
		return Math.ceil(this.$anchorMap[2][0].y - this.$anchorMap[0][0].y);
	}

	@cache public get $anchorMap(): PerQuadrant<AnchorMap> {
		return makePerQuadrant<AnchorMap>(q => {
			if(this.anchors?.[q]?.location) {
				const p = new Point(this.anchors[q].location!);
				if(this.offset) p.addBy(new Vector(this.offset));
				return [p, null];
			} else {
				if(this.pieces.length == 1) return [this.pieces[0].$anchors[q]!, 0];
				for(const [i, p] of this.pieces.entries()) {
					if(p.$anchors[q]) return [p.$anchors[q]!, i];
				}

				// Shouldn't enter here in theory
				debugger;
				throw new Error();
			}
		});
	}

	@cache public get $slack(): PerQuadrant<number> {
		return makePerQuadrant(q => this._getSlack(q));
	}

	/**
	 * In case of relay, get the remaining x-component.
	 * @param q1 {@link QuadrantDirection} of the corner being connected to, which is either 1 or 3.
	 * @param q2 {@link QuadrantDirection} of the corner by the other {@link Gadget}, which is either 0 or 2.
	 */
	public rx(q1: QuadrantDirection, q2: QuadrantDirection): number {
		return Math.abs(this.$anchorMap[q1][0].x - this.$anchorMap[q2][0].x);
	}

	public $reverseGPS(): Gadget {
		const g = new Gadget(this);
		const [p1, p2] = g.pieces;
		const sx = Math.ceil(Math.max(p1.sx, p2.sx));
		const sy = Math.ceil(Math.max(p1.sy, p2.sy));
		p1.$reverse(sx, sy);
		p2.$reverse(sx, sy);
		return g;
	}

	public $addSlack(q: QuadrantDirection, slack: number): Gadget {
		this.anchors = this.anchors || [];
		this.anchors[q] = this.anchors[q] || {};
		this.anchors[q].slack = (this.anchors[q].slack ?? 0) + slack;
		return this;
	}


	/////////////////////////////////////////////////////////////////////////////////////////////////////
	// Private methods
	/////////////////////////////////////////////////////////////////////////////////////////////////////

	private _getSlack(q: QuadrantDirection): number {
		return this.anchors?.[q]?.slack ?? 0;
	}

	/////////////////////////////////////////////////////////////////////////////////////////////////////
	// Static methods
	/////////////////////////////////////////////////////////////////////////////////////////////////////

	/** Simplify JSON data representation. */
	public static $simplify(g: JGadget): JGadget {
		if(g.offset && g.offset.x == 0 && g.offset.y == 0) delete g.offset;
		if(g.anchors) {
			for(const [i, a] of g.anchors.entries()) {
				if(!a) continue;
				if(a.slack === 0) delete a.slack;
				if(Object.keys(a).length == 0) delete g.anchors[i];
			}
			if(!g.anchors.some(a => Boolean(a))) delete g.anchors;
		}
		return g;
	}
}
