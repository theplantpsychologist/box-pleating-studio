import { expect } from "chai";

import "../utils/line";
import { DesignController } from "core/controller/designController";
import { Migration } from "client/patches";
import { toPath } from "core/math/geometry/rationalPath";
import { State, fullReset } from "core/service/state";
import { createTree, id4, node, parseTree } from "../utils/tree";
import { TreeController } from "core/controller/treeController";
import * as sample from "../samples/v04.session.sample.json";

import type { Tree } from "core/design/context/tree";

describe("Pattern", function() {

	describe("Searching", function() {

		it("Loads saved patterns", function() {
			fullReset();
			const data = Migration.$process(sample);
			DesignController.init(data.design);
		});

		describe("Two flap patterns", function() {

			it("Finds universal GPS patterns", function() {
				parseTree("(0,1,6),(0,2,6)", "(1,0,0,0,0),(2,11,5,0,0)");
				const stretch = State.$stretches.get("1,2")!;
				stretch.$complete();
				expect(stretch).to.be.not.undefined;
				expect(stretch.$repo.$configurations.length).to.equal(1);
				const config = stretch.$repo.$configurations[0];
				expect(config.$length).to.equal(2);
				const pattern = config.$pattern!;
				expect(pattern.$devices.length).to.equal(1);
				const device = pattern.$devices[0];
				expect(device.$gadgets.length).to.equal(1);
				const anchors = device.$anchors[0].map(p => p.$toIPoint());
				expect(anchors).to.equalPath("(0,0),(2,3),(43/4,19/4),(9,2)");
			});

		});

		describe("Three flap patterns", function() {

			it("Does not depend on the ordering of flap ids nor the transformation factors", function() {
				for(const [a, b, c] of THREE_PERMUTATION) {
					generateFromFlaps([
						{ id: a, x: 9, y: 5, radius: 2 },
						{ id: b, x: 0, y: 0, radius: 8 },
						{ id: c, x: 6, y: 8, radius: 2 },
					]);
					const stretch = State.$stretches.get("1,2,3")!;
					expect(stretch).to.be.not.undefined;
					expect(stretch.$repo.$configurations.length).to.equal(1);
					expect(stretch.$repo.$configurations[0].$length).to.equal(1);

					const B = node(b)!;
					expect(B.$graphics.$patternContours.length).to.be.equal(1);

					const path = toPath(B.$graphics.$patternContours[0]);
					expect(path).to.equalPath("(8,3),(7,13/3),(7,6),(16/3,6),(4,7),(4,8)");
				}
				for(const [a, b, c] of THREE_PERMUTATION) {
					generateFromFlaps([
						{ id: a, x: -9, y: 5, radius: 2 },
						{ id: b, x: 0, y: 0, radius: 8 },
						{ id: c, x: -6, y: 8, radius: 2 },
					]);
					const stretch = State.$stretches.get("1,2,3")!;
					expect(stretch).to.be.not.undefined;
					expect(stretch.$repo.$configurations.length).to.equal(1);
					expect(stretch.$repo.$configurations[0].$length).to.equal(1);

					const B = node(b)!;
					expect(B.$graphics.$patternContours.length).to.be.equal(1);

					const path = toPath(B.$graphics.$patternContours[0]);
					expect(path).to.equalPath("(-4,8),(-4,7),(-16/3,6),(-7,6),(-7,13/3),(-8,3)");
				}
			});

			it("Half integral relay", function() {
				generateFromFlaps([
					{ id: 1, x: 0, y: 0, radius: 11 },
					{ id: 2, x: 8, y: 14, radius: 4 },
					{ id: 3, x: 15, y: 8, radius: 6 },
				]);
				const stretch = State.$stretches.get("1,2,3")!;
				expect(stretch).to.be.not.undefined;
				expect(stretch.$repo.$configurations.length).to.equal(1);
				const config = stretch.$repo.$configurations[0];
				expect(config.$length).to.equal(2, "Two half integral patterns");
			});

			it("Base join", function() {
				for(const [a, b, c] of THREE_PERMUTATION) {
					generateFromFlaps([
						{ id: a, x: 0, y: 0, radius: 11 },
						{ id: b, x: 7, y: 14, radius: 4 },
						{ id: c, x: 15, y: 8, radius: 6 },
					]);
					const stretch = State.$stretches.get("1,2,3")!;
					expect(stretch).to.be.not.undefined;
					expect(stretch.$repo.$configurations.length).to.equal(1);
					const config = stretch.$repo.$configurations[0];
					expect(config.$length).to.equal(1);
					const pattern = config.$pattern!;
					expect(pattern.$devices.length).to.equal(1);
					const device = pattern.$devices[0];
					expect(device.$addOns.length).to.equal(0, "Base joins have no addOn");
				}
			});

			it("Standard join", function() {
				generateFromFlaps([
					{ id: 1, x: 0, y: 0, radius: 11 },
					{ id: 2, x: 5, y: 12, radius: 2 },
					{ id: 3, x: 15, y: 8, radius: 6 },
				]);
				const stretch = State.$stretches.get("1,2,3")!;
				expect(stretch).to.be.not.undefined;
				expect(stretch.$repo.$configurations.length).to.equal(1);
				const config = stretch.$repo.$configurations[0];
				expect(config.$length).to.equal(2, "Should find two standard joins.");
				const pattern = config.$pattern!;
				expect(pattern.$devices.length).to.equal(1, "Standard join creates 1 Device");
				const device = pattern.$devices[0];
				expect(device.$addOns.length).to.equal(1, "Standard join will have 1 addOn");
			});

			it("Split join", function() {
				generateFromFlaps([
					{ id: 1, x: 0, y: 0, radius: 15 },
					{ id: 2, x: 7, y: 20, radius: 6 },
					{ id: 3, x: 16, y: 12, radius: 5 },
				]);
				const stretch = State.$stretches.get("1,2,3")!;
				expect(stretch).to.be.not.undefined;
				expect(stretch.$repo.$configurations.length).to.equal(1);
				const config = stretch.$repo.$configurations[0];
				expect(config.$length).to.equal(1);
				const pattern = config.$pattern!;
				expect(pattern.$devices.length).to.equal(2);
			});

		});

	});

	describe("Rendering", function() {

		it("Updates ridges when edges merge or split", function() {
			parseTree("(0,1,2),(0,2,2),(0,4,1),(4,3,7)", "(1,9,5,0,0),(2,6,8,0,0),(3,0,0,0,0)");
			complete();
			const result1 = State.$updateResult;
			const ridges1 = result1.graphics["s1,2,3.0"].ridges;
			expect(ridges1).to.containLine([{ x: 4.5, y: 3.5 }, { x: 6, y: 5 }]);

			State.$resetResult();
			TreeController.join(id4);
			const result2 = State.$updateResult;
			const data2 = result2.graphics["s1,2,3.0"];
			expect(data2).to.be.not.undefined;
			const ridges2 = data2.ridges;
			expect(ridges2).to.not.containLine([{ x: 4.5, y: 3.5 }, { x: 6, y: 5 }]);
			expect(ridges2).to.containLine([{ x: 4.5, y: 3.5 }, { x: 7, y: 6 }]);
		});

	});

});

const THREE_PERMUTATION = [
	[1, 2, 3],
	[1, 3, 2],
	[2, 1, 3],
	[2, 3, 1],
	[3, 1, 2],
	[3, 2, 1],
];

function complete(): void {
	for(const stretch of State.$stretches.values()) stretch.$repo.$complete();
}

interface IFlap {
	id: number;
	x: number;
	y: number;
	radius: number;
}

function generateFromFlaps(flaps: IFlap[]): Tree {
	const tree = createTree(
		flaps.map(f => ({ n1: 0, n2: f.id, length: f.radius })),
		flaps.map(f => ({ id: f.id, width: 0, height: 0, x: f.x, y: f.y }))
	);
	complete();
	return tree;
}
