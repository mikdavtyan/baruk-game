// Daily tasks: 3 of the 6 picked at random for each local day; a game event
// moves the matching tasks' progress (never past their target); a finished
// task is claimed once for its reward; a new day brings 3 fresh tasks.
import { TASK_DEFS } from '../constants/tasks';
import { claimTask, DailyTasks, hasClaimable, isClaimable, recordTaskEvent, tasksForDay } from './tasks';

const DAY = '2026-10-09';
const record = (ids: string[], progress: number[] = [0, 0, 0], claimed: boolean[] = [false, false, false]): DailyTasks => ({
  day: DAY,
  tasks: ids.map((id, i) => ({ id: id as any, progress: progress[i], claimed: claimed[i] })),
});

describe('tasksForDay', () => {
  it('picks 3 different tasks for a new day, all at zero', () => {
    const today = tasksForDay(null, DAY, () => 0.5);
    expect(today.day).toBe(DAY);
    expect(today.tasks).toHaveLength(3);
    expect(new Set(today.tasks.map((t) => t.id)).size).toBe(3);
    expect(today.tasks.every((t) => t.progress === 0 && !t.claimed && t.id in TASK_DEFS)).toBe(true);
  });

  it("keeps today's record as it is", () => {
    const saved = record(['win1', 'hint', 'guess4'], [1, 0, 1], [true, false, false]);
    expect(tasksForDay(saved, DAY)).toBe(saved);
  });

  it("replaces an earlier day's record with fresh tasks", () => {
    const yesterday = { ...record(['win1', 'hint', 'guess4'], [1, 1, 1]), day: '2026-10-08' };
    const today = tasksForDay(yesterday, DAY, () => 0.1);
    expect(today.day).toBe(DAY);
    expect(today.tasks.every((t) => t.progress === 0 && !t.claimed)).toBe(true);
  });

  it('a malformed record is treated as none', () => {
    expect(tasksForDay({ day: DAY, tasks: 'nope' } as any, DAY, () => 0.3).tasks).toHaveLength(3);
  });
});

describe('recordTaskEvent', () => {
  it('a win counts for both win tasks, and for the guess tasks within their guesses', () => {
    const r = record(['win1', 'win3', 'guess3']);
    const after = recordTaskEvent(r, { type: 'win', guesses: 4 });
    expect(after.tasks.map((t) => t.progress)).toEqual([1, 1, 0]); // 4 guesses isn't ≤ 3
    expect(recordTaskEvent(r, { type: 'win', guesses: 3 }).tasks.map((t) => t.progress)).toEqual([1, 1, 1]);
  });

  it('never goes past the target', () => {
    let r = record(['win1', 'win3', 'guess4']);
    for (let i = 0; i < 5; i++) r = recordTaskEvent(r, { type: 'win', guesses: 2 });
    expect(r.tasks.map((t) => t.progress)).toEqual([1, 3, 1]);
  });

  it('Hint and Darts uses count only for their own tasks', () => {
    const r = record(['hint', 'darts', 'win1']);
    expect(recordTaskEvent(r, { type: 'hint' }).tasks.map((t) => t.progress)).toEqual([1, 0, 0]);
    expect(recordTaskEvent(r, { type: 'darts' }).tasks.map((t) => t.progress)).toEqual([0, 1, 0]);
  });

  it('returns the same record when nothing changed', () => {
    const r = record(['hint', 'darts', 'guess3']);
    expect(recordTaskEvent(r, { type: 'win', guesses: 6 })).toBe(r);
  });
});

describe('claiming', () => {
  it('a finished, unclaimed task is claimable; claiming gives its reward once', () => {
    const r = record(['win1', 'hint', 'darts'], [1, 0, 1], [false, false, true]);
    expect(r.tasks.map(isClaimable)).toEqual([true, false, false]);
    expect(hasClaimable(r)).toBe(true);
    const claimed = claimTask(r, 'win1')!;
    expect(claimed.reward).toBe(TASK_DEFS.win1.reward);
    expect(claimed.record.tasks[0].claimed).toBe(true);
    expect(hasClaimable(claimed.record)).toBe(false);
    expect(claimTask(claimed.record, 'win1')).toBeNull(); // not twice
    expect(claimTask(r, 'hint')).toBeNull(); // not before it's done
  });
});

it('rewards grow with difficulty, 20–60', () => {
  expect(Object.values(TASK_DEFS).map((d) => d.reward).every((r) => r >= 20 && r <= 60)).toBe(true);
  expect(TASK_DEFS.win3.reward).toBeGreaterThan(TASK_DEFS.win1.reward);
  expect(TASK_DEFS.guess3.reward).toBeGreaterThan(TASK_DEFS.guess4.reward);
});
