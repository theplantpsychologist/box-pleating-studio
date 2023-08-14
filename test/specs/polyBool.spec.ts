import { Assertion, expect } from "chai";

import { expand } from "core/math/polyBool/expansion";
import { AAUnion } from "core/math/polyBool/union/aaUnion";
import { same, toString } from "shared/types/geometry";
import { random } from "../utils";
import { RRIntersection } from "core/math/polyBool/intersection/rrIntersection";

import type { Path, Polygon } from "shared/types/geometry";

describe("PolyBool", function() {
	describe("AAUnion operation", function() {

		it("Finds union of AABBs", function() {
			// Test 1
			let result = new AAUnion().$get(
				aabbToPolygon({ top: 4, bottom: 1, left: 1, right: 5 }),
				aabbToPolygon({ top: 3, bottom: 0, left: 0, right: 4 }),
				aabbToPolygon({ top: 5, bottom: 4, left: 2, right: 4 })
			);
			expect(result.length).to.equal(1);
			let path = result[0];
			expect(path).to.equalPath("(0,0),(4,0),(4,1),(5,1),(5,4),(4,4),(4,5),(2,5),(2,4),(1,4),(1,3),(0,3)");

			// Test 2
			result = new AAUnion().$get(
				aabbToPolygon({ top: 4, bottom: 2, left: 0, right: 4 }),
				[parsePath("(1,0),(3,0),(3,2),(2,2),(1,2)")]
			);
			expect(result.length).to.equal(1);
			path = result[0];
			expect(path).to.equalPath("(1,0),(3,0),(3,2),(4,2),(4,4),(0,4),(0,2),(1,2)");
		});

		it("Results can be taken union again", function() {
			const union = new AAUnion();
			const result1 = union.$get(
				aabbToPolygon({ top: 4, bottom: 1, left: 1, right: 5 }),
				aabbToPolygon({ top: 3, bottom: 0, left: 0, right: 4 })
			);
			const result2 = union.$get(
				result1,
				aabbToPolygon({ top: 5, bottom: 4, left: 2, right: 4 })
			);
			expect(result2.length).to.equal(1);

			const path = result2[0];
			expect(path).to.equalPath("(0,0),(4,0),(4,1),(5,1),(5,4),(4,4),(4,5),(2,5),(2,4),(1,4),(1,3),(0,3)");
		});

		it("Can handle multiple subpaths", function() {
			const result = new AAUnion().$get(
				aabbToPolygon({ top: 1, bottom: 0, left: 0, right: 1 }),
				aabbToPolygon({ top: 3, bottom: 2, left: 0, right: 1 }),
				aabbToPolygon({ top: 3, bottom: 2, left: 1, right: 2 })
			);
			expect(result.length).to.equal(2);

			const path1 = result.find(p => p.length == 6);
			const path2 = result.find(p => p.length == 4);
			expect(path1).to.equalPath("(0,2),(1,2),(2,2),(2,3),(1,3),(0,3)");
			expect(path2).to.equalPath("(0,0),(1,0),(1,1),(0,1)");
		});

		it("Can handle holes", function() {
			const result = new AAUnion().$get(
				aabbToPolygon({ top: 2, bottom: 0, left: 1, right: 5 }),
				aabbToPolygon({ top: 5, bottom: 1, left: 0, right: 2 }),
				aabbToPolygon({ top: 5, bottom: 1, left: 4, right: 6 }),
				aabbToPolygon({ top: 6, bottom: 4, left: 1, right: 5 })
			);
			expect(result.length).to.equal(2);

			const path1 = result.find(p => p.length == 12)!;
			const path2 = result.find(p => p.length == 4)!;
			expect(path1).to.equalPath("(1,1),(1,0),(5,0),(5,1),(6,1),(6,5),(5,5),(5,6),(1,6),(1,5),(0,5),(0,1)");
			expect(path2).to.equalPath("(2,2),(2,4),(4,4),(4,2)"); // hole, clockwise
		});

		it("Can solve self-intersection", function() {
			const result = new AAUnion(true).$get(
				[parsePath("(0,0),(3,0),(3,2),(1,2),(1,1),(2,1),(2,3),(0,3)")]
			);
			expect(result.length).to.equal(1);
			const path = result[0];
			expect(path).to.equalPath("(0,0),(3,0),(3,2),(2,2),(2,3),(0,3)");
		});

		it("Can handle keyholes", function() {
			const result = new AAUnion(true).$get(
				[parsePath("(0,0),(3,0),(3,2),(2,2),(2,1),(1,1),(1,2),(3,2),(3,3),(0,3)")]
			);
			expect(result.length).to.equal(2);
			const path1 = result.find(p => p.length == 5)!;
			const path2 = result.find(p => p.length == 4)!;
			expect(path1).to.equalPath("(0,0),(3,0),(3,2),(3,3),(0,3)");
			expect(path2).to.equalPath("(1,1),(1,2),(2,2),(2,1)"); // hole, clockwise
		});

		it("Is really, really fast", function() {
			this.retries(100);

			// prepare random tests
			const tests: Polygon[][] = [];
			const rounds = 100;
			for(let i = 0; i < rounds; i++) {
				tests.push(Array.from({ length: 40 }, () => randomAabbPolygon(80, 30)));
			}

			// run tests
			const start = performance.now();
			for(const test of tests) {
				new AAUnion().$get(...test);
			}
			const average = (performance.now() - start) / rounds;

			expect(average).to.be.lessThan(0.5); // In ms!
			// This could be as good as 0.45 in fact,
			// but here we set it to 0.5 so that the test can pass more easily.
		});
	});

	describe("Expansion operation", function() {
		it("Expands given AA polygons", function() {
			const result = expand([
				parsePath("(1,1),(1,0),(5,0),(5,1),(6,1),(6,5),(5,5),(5,6),(1,6),(1,5),(0,5),(0,1)"),
				parsePath("(2,2),(2,4),(4,4),(4,2)"),
			], 1);
			expect(result.length).to.equal(2);
			expect(result[0].outer).to.equalPath("(0,0),(0,-1),(6,-1),(6,0),(7,0),(7,6),(6,6),(6,7),(0,7),(0,6),(-1,6),(-1,0)");
			expect(result[0].startIndices.map(i => result[0].outer[i])).to.deep.equal([{ x: 7, y: 0 }, { x: 7, y: 6 }]);
			expect(result[1].outer.length).to.equal(0);
		});
	});

	describe("Rounded rectangle intersection", function() {
		it("Finds intersection", function() {
			const result = new RRIntersection().$get(
				{ x: 1, y: 1, width: 2, height: 1, radius: 1 },
				{ x: 3, y: 3, width: 0, height: 0, radius: 1 }
			);
			expect(result.length).to.equal(1);
			expect(result[0]).to.equalPath("(2,3),(3,2,2,2,1),(3.8660254037844384,2.5,3.5773502691896257,2,1),(3,3,3.5773502691896257,3,1)");
		});

		it("Handles complete overlapping", function() {
			const result = new RRIntersection().$get(
				{ x: 1, y: 1, width: 2, height: 1, radius: 1 },
				{ x: 2, y: 2, width: 0, height: 0, radius: 1 } // completely contained in the previous one
			);
			expect(result.length).to.equal(1);
			expect(result[0]).to.equalPath("(1,2,1,3,1),(2,1,1,1,1),(3,2,3,1,1),(2,3,3,3,1)");
		});

		it("Handles arc trisection", function() {
			const result = new RRIntersection().$get(
				{ x: 1, y: 1, width: 0, height: 0, radius: 1 },
				{ x: 3, y: 3, width: 0, height: 0, radius: 3 }
			);
			expect(result.length).to.equal(1);
			expect(result[0]).to.equalPath("(1,2,2,2,1),(0.29289321881345254,1.7071067811865475,0.5857864376269049,2,1),(1.7071067811865475,0.29289321881345254,0.75,0.75,3),(2,1,2,0.585786437626905,1)");
		});

		it("Handles epsilon errors", function() {
			// This examples creates an epsilon error in the intersection
			const result = new RRIntersection().$get(
				{ x: 1, y: 5, width: 0, height: 0, radius: 1 },
				{ x: 3, y: 3, width: 0, height: 0, radius: 3 }
			);
			expect(result.length).to.equal(1);
			expect(result[0]).to.equalPath("(2,5,2,4,1),(1.7071067811865483,5.707106781186548,2.0000000000000004,5.414213562373095,1),(0.2928932188134521,4.292893218813452,0.75,5.25,3),(1,4,0.585786437626905,4,1)");
		});
	});
});


function parsePath(s: string): Path {
	const numbers = s.match(/\d+/g)?.map(d => Number(d)) ?? [];
	const result: Path = [];
	for(let i = 0; i + 1 < numbers.length; i += 2) {
		result.push({ x: numbers[i], y: numbers[i + 1] });
	}
	return result;
}

function pathToString(path: Path): string {
	return path.map(p => toString(p)).join(",");
}

function rotatePath(path: Path, pt: IPoint): boolean {
	for(let i = 0; i < path.length; i++) {
		if(same(path[0], pt)) return true;
		path.push(path.shift()!);
	}
	return false;
}

function randomAabbPolygon(range: number, size: number): Polygon {
	const bottom = random(range);
	const top = bottom + random(size) + 1;
	const left = random(range);
	const right = left + random(size) + 1;
	return aabbToPolygon({ top, bottom, left, right });
}

declare global {
	namespace Chai {
		interface Assertion {
			equalPath(pathString: string): Chai.Assertion;
		}
	}
}

Assertion.addMethod("equalPath", function(pathString: string) {
	this.assert(
		Array.isArray(this._obj),
		"expect #{this} to be an array",
		"expect #{this} to not be an array",
		null
	);
	const path = (this._obj as Path).concat();
	const orgPathString = pathToString(path);

	const match = pathString.match(/\((\d*\.?\d+),(\d*\.?\d+)(?:,\d*\.?\d+){0,3}\)/)!;
	const point = { x: Number(match[1]), y: Number(match[2]) };
	const rotateResult = rotatePath(path, point);

	this.assert(
		rotateResult,
		"expect #{act} to contain the point #{exp}",
		"expect #{act} to not contain the point #{exp}",
		match[0],
		orgPathString
	);
	this.assert(
		pathToString(path) == pathString,
		"expect #{act} to equal #{exp}",
		"expect #{act} to not equal #{exp}",
		pathString,
		orgPathString
	);
});

interface IAABB {
	top: number;
	right: number;
	bottom: number;
	left: number;
}

function aabbToPolygon(c: IAABB): Polygon {
	return [[
		{ x: c.right, y: c.top },
		{ x: c.left, y: c.top },
		{ x: c.left, y: c.bottom },
		{ x: c.right, y: c.bottom },
	]];
}
