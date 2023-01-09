import { EndEvent, StartEvent } from "../event";

import type { IEventFactory } from "../interfaces";
import type { Comparator } from "shared/types/types";
import type { SweepEvent } from "../event";
import type { AALineSegment } from "../segment/aaLineSegment";
import type { ISegment } from "../segment/segment";

const SHIFT_Y = 17;
const SHIFT_START = 16;
const SHIFT_HOR = 15;
const SHIFT_DELTA = 14;

//=================================================================
/**
 * {@link EventFactory} 類別負責生成事件。
 */
//=================================================================

export class EventFactory implements IEventFactory {

	/** 事件的下一個可用 id */
	private _nextId: number = 0;

	public $createStart(startPoint: IPoint, segment: ISegment, delta: -1 | 1): StartEvent {
		const key = getKey(startPoint, true, segment, delta, this._nextId++);
		return new StartEvent(startPoint, segment, delta, key);
	}

	public $createEnd(endPoint: IPoint, segment: ISegment): EndEvent {
		const key = getKey(endPoint, false, segment, 1, this._nextId++);
		return new EndEvent(endPoint, key);
	}
}

//=================================================================
// 雖然有點難以解釋，但是實驗顯示底下的幾個函數獨立開來寫會有比較好的效能。
//=================================================================

export const eventComparator: Comparator<SweepEvent> = (a, b) => {
	const dx = a.point.x - b.point.x;
	if(dx !== 0) return dx;
	return a.key - b.key;
};

export const statusComparator: Comparator<StartEvent> = (a, b) => a.key - b.key;

/**
 * 為了加速比較，把若干的比較邏輯加以編碼成 32 位元整數，
 * 使得一次比較數字即可。這樣做大概可以增進 5% 的效能。
 *
 * 其位元組成由高到低為：
 * 15 bit	point.y
 * 1 bit	isStart
 * 1 bit	isHorizontal
 * 1 bit	wrapDelta
 * 14 bit	id
 */
function getKey(point: IPoint, isStart: boolean, segment: ISegment, delta: -1 | 1, id: number): number {
	let hor = (segment as AALineSegment).$isHorizontal ? 1 : 0;
	if(isStart) hor ^= 1;
	return (
		// 先依 y 座標排序
		point.y << SHIFT_Y |

		// 同樣位置的事件中，終點事件優先
		(isStart ? 1 : 0) << SHIFT_START |

		// 同位置類型的事件中，起點事件的水平邊優先於垂直邊、終點的情況則相反
		hor << SHIFT_HOR |

		// 同位置方向（亦即重疊）的起點事件中，進入邊優先於離開邊
		// 如此一來 wrapCount 就不會一度變成零而導致誤判為外圍邊
		(delta === 1 ? 0 : 1) << SHIFT_DELTA |

		// 同類型的重疊事件就不用特別排序了；
		// 特別注意到整體而言的排序不會受到邊細分的影響
		id
	);
}
