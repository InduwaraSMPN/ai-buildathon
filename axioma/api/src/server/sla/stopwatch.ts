export type StopwatchState = Readonly<{
	accumulatedMs: number;
	pendingMs: number;
	running: boolean;
	startedAt: Date;
}>;

export function createStopwatch(
	startedAt: Date,
	running = true,
): StopwatchState {
	assertDate(startedAt);
	return { accumulatedMs: 0, pendingMs: 0, running, startedAt };
}

/**
 * Checkpoint a stopwatch and optionally change whether it is running.
 * `elapsedMs` is supplied by the calendar layer so out-of-hours time can be excluded.
 */
export function transitionStopwatch(
	state: StopwatchState,
	running: boolean,
	at: Date,
	elapsedMs: number,
): StopwatchState {
	assertState(state);
	assertDate(at);
	if (at < state.startedAt)
		throw new RangeError("Stopwatch cannot move backwards");
	if (!Number.isSafeInteger(elapsedMs) || elapsedMs < 0)
		throw new RangeError("elapsedMs must be a non-negative safe integer");

	return {
		accumulatedMs: state.accumulatedMs + (state.running ? elapsedMs : 0),
		pendingMs: state.pendingMs + (state.running ? 0 : elapsedMs),
		running,
		startedAt: at,
	};
}

export const pauseStopwatch = (
	state: StopwatchState,
	at: Date,
	elapsedMs: number,
): StopwatchState => transitionStopwatch(state, false, at, elapsedMs);

export const startStopwatch = (
	state: StopwatchState,
	at: Date,
	elapsedMs: number,
): StopwatchState => transitionStopwatch(state, true, at, elapsedMs);

function assertDate(value: Date): void {
	if (Number.isNaN(value.getTime()))
		throw new RangeError("Invalid stopwatch date");
}

function assertState(state: StopwatchState): void {
	assertDate(state.startedAt);
	for (const [name, value] of [
		["accumulatedMs", state.accumulatedMs],
		["pendingMs", state.pendingMs],
	] as const)
		if (!Number.isSafeInteger(value) || value < 0)
			throw new RangeError(`${name} must be a non-negative safe integer`);
}
