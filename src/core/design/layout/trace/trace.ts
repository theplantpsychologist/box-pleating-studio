import { SlashDirection } from "shared/types/direction";
import { TraceContext, getNextIntersection } from "./traceContext";
import { pathToString } from "core/math/geometry/path";
import { Line } from "core/math/geometry/line";
import { Vector } from "core/math/geometry/vector";

import type { Point } from "core/math/geometry/point";
import type { Ridge } from "../pattern/device";
import type { SideDiagonal } from "../configuration";
import type { Path } from "shared/types/geometry";
import type { Repository } from "../repository";
import type { PatternContour } from "../../context";

//=================================================================
/**
 * {@link Trace} is the utility class for generating {@link PatternContour}.
 */
//=================================================================
export class Trace {

	public static $fromRepo(repo: Repository): Trace {
		return new Trace(
			repo.$pattern!.$devices.flatMap(d => d.$traceRidges),
			repo.$direction,
			repo.$configuration!.$sideDiagonals
		);
	}

	public readonly $ridges: readonly Ridge[];
	public readonly $direction: SlashDirection;
	public readonly $sideDiagonals: readonly SideDiagonal[];

	constructor(ridges: readonly Ridge[], dir: SlashDirection, sideDiagonals: readonly SideDiagonal[]) {
		this.$ridges = ridges;
		this.$direction = dir;
		this.$sideDiagonals = sideDiagonals.filter(d => !d.$isDegenerated);
	}

	public $generate(hinges: Path, start: Point, end: Point): PatternContour | null {
		const ctx = new TraceContext(this, hinges);
		if(!ctx.$valid) return null;

		const directionalVector = new Vector(1, this.$direction == SlashDirection.FW ? 1 : -1);
		const ridges = this._createFilteredRidges(start, end, directionalVector);

		// Initialize
		const path: Point[] = [];
		const startDiagonal = this.$sideDiagonals.find(d => d.$lineContains(start));
		let cursor = ctx.$getInitialNode(ridges, startDiagonal);
		if(!cursor) return null;
		path.push(cursor.point);

		const endDiagonal = this.$sideDiagonals.find(d => d.$contains(end, true));
		if(endDiagonal) ridges.add(endDiagonal);

		// Main loop
		while(true) {
			const intersection = getNextIntersection(ridges, cursor);
			if(!intersection) break;

			ridges.delete(intersection.line);
			cursor = {
				last: intersection.line.$vector,
				point: intersection.point,
				vector: intersection.line.$reflect(cursor.vector),
			};
			const lastPoint = path[path.length - 1];
			if(!lastPoint.eq(cursor.point)) {
				const line = new Line(lastPoint, cursor.point);
				const test = line.$intersection(end, directionalVector);
				if(test && !test.eq(cursor.point)) break; // early stop
				path.push(cursor.point);
			}
		}

		return ctx.$trim(path);
	}

	private _createFilteredRidges(start: Point, end: Point, directionalVector: Vector): Set<Ridge> {
		let startLine = new Line(start, directionalVector);
		let endLine = new Line(end, directionalVector);

		// Oriented start/end lines
		if(startLine.$pointIsOnRight(end)) startLine = startLine.$reverse();
		if(endLine.$pointIsOnRight(start)) endLine = endLine.$reverse();

		const filteredRidges = this.$ridges.filter(r =>
			(!startLine.$pointIsOnRight(r.p1, true) || !startLine.$pointIsOnRight(r.p2, true)) &&
			(!endLine.$pointIsOnRight(r.p1, true) || !endLine.$pointIsOnRight(r.p2, true))
		);
		return new Set(filteredRidges);
	}

	/////////////////////////////////////////////////////////////////////////////////////////////////////
	// Debug methods
	/////////////////////////////////////////////////////////////////////////////////////////////////////

	///#if DEBUG==true

	public $createTestCase(hinges: Path): string {
		const simp = (s: object): string => JSON.stringify(s).replace(/"(\w+)":/g, "$1:");
		const ridges = `Line.$parseTest(${simp(this.$ridges)})`;
		const dir = "SlashDirection." + (this.$direction == SlashDirection.FW ? "FW" : "BW");
		const sideDiagonals = `Line.$parseTest<SideDiagonal>(${simp(this.$sideDiagonals)})`;
		return `const trace = new Trace(${ridges}, ${dir}, ${sideDiagonals});\nconst result = trace.$generate(parsePath("${pathToString(hinges)}"));`;
	}

	///#endif
}
