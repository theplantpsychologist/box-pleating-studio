import type { AABB } from "./aabb/aabb";
import type { IHeap, IReadonlyHeap } from "shared/data/heap/heap";
import type { TreeNode } from "./treeNode";
import type { JEdge, JFlap } from "shared/json";

export interface ITree extends ISerializable<JEdge[]> {
	readonly $nodes: readonly (ITreeNode | undefined)[];

	readonly $root: ITreeNode;

	/** 增加一個新的葉點並傳回 */
	$addLeaf(id: number, at: number, length: number): ITreeNode;

	/** 刪除一個指定的葉點 */
	$removeLeaf(id: number): void;

	/** 刪除指定的節點並且把它兩側的邊合為一 */
	$join(id: number): void;

	/**  */
	$split(id: number, at: number): void;

	/** 把指定的節點往上跟它的父點合併 */
	$merge(id: number): void;

	/** 傳回兩個節點在樹上的距離 */
	$dist(n1: ITreeNode, n2: ITreeNode): number;
}

export interface ITreeNode extends ISerializable<JEdge> {
	readonly id: number;
	readonly $parent: ITreeNode | undefined;
	readonly $length: number;
	readonly $children: IReadonlyHeap<ITreeNode>;
	readonly $dist: number;
	readonly $isLeaf: boolean;
	readonly $AABB: AABB;

	/** 根據傳入的 {@link JFlap} 設定位置 */
	$setFlap(flap: JFlap): void;
}
