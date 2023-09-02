import { shallowReactive } from "vue";

import { shallowRef } from "client/shared/decorators";
import { FieldCommand } from "./commands/fieldCommand";
import { Step, OperationResult, restore } from "./step";
import { MoveCommand } from "./commands/moveCommand";
import { EditCommand } from "./commands/editCommand";

import type { JEdit } from "shared/json/tree";
import type { Draggable } from "client/base/draggable";
import type { Project } from "../project";
import type { ITagObject } from "client/shared/interface";
import type { Command } from "./commands/command";
import type { JHistory, Memento } from "shared/json/history";
import type { Control } from "client/base/control";

const MAX_STEP = 30;

//=================================================================
/**
 * {@link HistoryManager} manages history record of editing operations.
 */
//=================================================================

export default class HistoryManager implements ISerializable<JHistory> {

	/** Current history location. */
	@shallowRef private _index: number = 0;

	/** History location during last file saving. */
	@shallowRef private _savedIndex: number = 0;

	private readonly _project: Project;
	private readonly _steps: Step[] = shallowReactive([]);

	private _queue: Command[] = [];
	private _construct: Memento[] = [];
	private _destruct: Memento[] = [];

	/** Tags of last-known selected {@link Control}s. */
	private _selection?: string[] = [];

	/** Whether we're navigating the history. */
	private _moving: boolean = false;

	private _initializing: boolean = true;

	constructor(project: Project, json?: JHistory) {
		this._project = project;
		if(json) {
			try {
				this._steps.push(...json.steps.map(s => restore(project, s)));
				this._index = json.index;
				this._savedIndex = json.savedIndex;
			} catch {
				// If anything goes wrong, reset everything.
				this._steps.length = 0;
				this._index = 0;
				this._savedIndex = 0;
			}
		}
	}

	public toJSON(): JHistory {
		return {
			index: this._index,
			savedIndex: this._savedIndex,
			steps: this._steps.map(s => s.toJSON()),
		};
	}

	/**
	 * Signify that the current assignment is internal, which implies:
	 * 1. History should not be recorded.
	 * 2. Validations of values can be skipped.
	 * 3. No effect should be executed.
	 */
	public get $isLocked(): boolean {
		return this._moving || this._initializing;
	}

	/**
	 * The user is performing a history navigation.
	 * This is a special case of {@link $isLocked}.
	 */
	public get $moving(): boolean {
		return this._moving;
	}

	public get isModified(): boolean {
		// Always display as modified during dragging to reduce UI flashes.
		return this._project.$isDragging || this._savedIndex != this._index;
	}

	public $notifySave(): void {
		this._savedIndex = this._index;
	}

	/**
	 * Handles accumulating operations and gather them into a {@link Step} object.
	 */
	public $flush(): void {
		const selection = this._project.design.sheet.$getSelectedTags();
		if(this._queue.length) {
			const s = this._lastStep;
			if(!s || !s.$tryAdd(this._queue, this._construct, this._destruct)) {
				const step = new Step(this._project, {
					commands: this._queue,
					construct: this._construct,
					destruct: this._destruct,
					mode: this._project.design.mode ?? "layout",
					before: this._selection || selection,
					after: selection,
				});
				if(!step.$isVoid) this._addStep(step);
			} else if(s.$isVoid) {
				this._steps.pop();
				this._index--;
			}
			this._queue = [];
			this._construct = [];
			this._destruct = [];
		}
		this._selection = undefined;
		this._initializing = false;
		this._moving = false;
	}

	public $cacheSelection(): void {
		this._selection = this._project.design.sheet.$getSelectedTags();
	}

	/** Move an object. */
	public $move(target: Draggable, loc: IPoint): void {
		if(this.$isLocked) return;
		const command = MoveCommand.$create(target, loc);
		this._enqueue(command);
	}

	/**
	 * Change a field.
	 * @param flush Whether to flush immediately. The default value is true.\
	 * Set the value to `false` if the same field of multiple objects are changed simultaneously.
	 */
	public $fieldChange(target: ITagObject, prop: string, oldValue: unknown, newValue: unknown,
		flush: boolean = true): void {
		if(this.$isLocked) return;
		this._enqueue(FieldCommand.$create(target, prop, oldValue, newValue));
		if(flush) this.$flush();
	}

	public $edit(edits: JEdit[], oldRoot: number, newRoot: number): void {
		if(this.$isLocked) return;
		this._enqueue(EditCommand.$create(this._project, edits, oldRoot, newRoot));
	}

	public $construct(memento: Memento): void {
		if(this.$isLocked) return;
		this._construct.push(memento);
	}

	public $destruct(memento: Memento): void {
		if(this.$isLocked) return;
		this._destruct.push(memento);
	}

	public get $canUndo(): boolean {
		return this._index > 0;
	}

	public get $canRedo(): boolean {
		return this._index < this._steps.length;
	}

	public async $undo(): Promise<void> {
		if(this.$canUndo) {
			this._moving = true;
			const result = await this._steps[--this._index].$undo();
			if(result != OperationResult.Success) {
				// If something goes wrong, the step in question and everything
				// before that should be discarded.
				this._steps.splice(0, this._index + (result == OperationResult.Failed ? 1 : 0));
				this._index = 0;
			}
			this.$flush();
		}
	}

	public async $redo(): Promise<void> {
		if(this.$canRedo) {
			this._moving = true;
			const result = await this._steps[this._index++].$redo();
			if(result != OperationResult.Success) {
				// If something goes wrong, the step in question and everything
				// after that should be discarded.
				if(result == OperationResult.Failed) this._index--;
				this._steps.splice(this._index);
			}
			this.$flush();
		}
	}

	/////////////////////////////////////////////////////////////////////////////////////////////////////
	// Private methods
	/////////////////////////////////////////////////////////////////////////////////////////////////////

	private get _lastStep(): Step | undefined {
		if(this._index == 0 || this._index < this._steps.length) return undefined;
		return this._steps[this._index - 1];
	}

	private _addStep(step: Step): void {
		// Remove all Steps afterwards
		if(this._steps.length > this._index) this._steps.length = this._index;

		// Add a new Step and move the index
		this._steps[this._index++] = step;

		// We keep at most 30 Steps, so get rid of the extras.
		if(this._steps.length > MAX_STEP) {
			this._steps.shift();
			this._index--;
			this._savedIndex--;
		}
	}

	private _enqueue(command: Command): void {
		for(const q of this._queue) {
			if(command.$canAddTo(q)) return command.$addTo(q);
		}
		this._queue.push(command);
	}
}
