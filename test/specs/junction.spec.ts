import { expect } from "chai";

import { heightTask } from "core/design/tasks/height";
import { Processor } from "core/service/processor";
import { State, fullReset } from "core/service/state";
import { getFirst } from "shared/utils/set";
import { createTree, id0, id3, id4 } from "../utils/tree";

import type { ValidJunction } from "core/design/layout/junction/validJunction";

describe("Junction", function() {

	beforeEach(function() {
		fullReset();
	});

	it("Computes valid junctions", function() {
		createTree(
			[
				{ n1: 0, n2: 1, length: 1 },
				{ n1: 0, n2: 2, length: 1 },
				{ n1: 1, n2: 3, length: 3 },
				{ n1: 2, n2: 4, length: 2 },
			],
			[
				{ id: 3, x: 0, y: 0, width: 0, height: 0 },
				{ id: 4, x: 5, y: 5, width: 0, height: 0 },
			]
		);

		expect(State.$junctions.size).to.equal(1);
		expect(State.$junctions.has(id3, id4)).to.be.true;

		const junction = State.$junctions.get(id3, id4) as ValidJunction;
		expect(junction.$valid).to.be.true;
		expect(junction.$s.x).to.equal(5);
		expect(junction.$s.y).to.equal(5);

		const stretch = getFirst(State.$stretches)!;
		expect(stretch).to.be.not.undefined;
		expect(stretch.$repo.$nodeSet.$nodes).to.eql([1, 2, 3, 4]);
	});

	it("Creates new junction upon merging", function() {
		const tree = createTree(
			[
				{ n1: 0, n2: 1, length: 1 },
				{ n1: 0, n2: 2, length: 1 },
				{ n1: 1, n2: 3, length: 3 },
				{ n1: 2, n2: 4, length: 2 },
			],
			[
				{ id: 3, x: 0, y: 0, width: 0, height: 0 },
				{ id: 4, x: 5, y: 5, width: 0, height: 0 },
			]
		);

		const junction1 = State.$junctions.get(id3, id4) as ValidJunction;
		tree.$join(id0);
		Processor.$run(heightTask);

		expect(State.$junctions.size).to.equal(1);
		expect(State.$junctions.has(id3, id4)).to.be.true;

		const junction2 = State.$junctions.get(id3, id4) as ValidJunction;
		expect(junction1).to.not.equal(junction2, "Creates a new instance");

		const stretch = getFirst(State.$stretches)!;
		expect(stretch).to.be.not.undefined;
		expect(stretch.$repo.$nodeSet.$nodes).to.eql([2, 3, 4]);
	});
});
