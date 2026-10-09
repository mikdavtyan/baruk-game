import { TASK_DEFS, TaskId, TASKS_PER_DAY } from '../constants/tasks';

// The daily tasks record (wordle:tasks): the local day it belongs to, and that
// day's tasks with their progress and whether their reward was claimed.
export type TaskState = { id: TaskId; progress: number; claimed: boolean };
export type DailyTasks = { day: string; tasks: TaskState[] };

// What moves a task: a won word (with how many guesses this attempt took), or
// a Hint / Darts use that was paid for.
export type TaskEvent = { type: 'win'; guesses: number } | { type: 'hint' } | { type: 'darts' };

const ALL_TASKS = Object.keys(TASK_DEFS) as TaskId[];

const isRecord = (r: unknown): r is DailyTasks =>
  !!r &&
  typeof (r as DailyTasks).day === 'string' &&
  Array.isArray((r as DailyTasks).tasks) &&
  (r as DailyTasks).tasks.every((t) => t && t.id in TASK_DEFS);

// `day`'s tasks: the saved record if it's that day's, else TASKS_PER_DAY fresh
// ones picked at random (a missing, malformed or earlier day's record).
export function tasksForDay(saved: DailyTasks | null, day: string, random: () => number = Math.random): DailyTasks {
  if (isRecord(saved) && saved.day === day) return saved;
  const pool = [...ALL_TASKS];
  const picked: TaskId[] = [];
  while (picked.length < TASKS_PER_DAY && pool.length > 0) {
    picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  }
  return { day, tasks: picked.map((id) => ({ id, progress: 0, claimed: false })) };
}

// How much an event moves a task (0 if it doesn't count for it).
function stepFor(id: TaskId, event: TaskEvent): number {
  switch (id) {
    case 'win1':
    case 'win3':
      return event.type === 'win' ? 1 : 0;
    case 'guess4':
      return event.type === 'win' && event.guesses <= 4 ? 1 : 0;
    case 'guess3':
      return event.type === 'win' && event.guesses <= 3 ? 1 : 0;
    case 'hint':
      return event.type === 'hint' ? 1 : 0;
    case 'darts':
      return event.type === 'darts' ? 1 : 0;
  }
}

// The record after an event: matching tasks move, never past their target.
// The same object when nothing changed (so nothing needs saving).
export function recordTaskEvent(record: DailyTasks, event: TaskEvent): DailyTasks {
  let changed = false;
  const tasks = record.tasks.map((t) => {
    const progress = Math.min(TASK_DEFS[t.id].target, t.progress + stepFor(t.id, event));
    if (progress === t.progress) return t;
    changed = true;
    return { ...t, progress };
  });
  return changed ? { ...record, tasks } : record;
}

export const isClaimable = (t: TaskState): boolean => !t.claimed && t.progress >= TASK_DEFS[t.id].target;
export const hasClaimable = (record: DailyTasks): boolean => record.tasks.some(isClaimable);

// Claims a finished task: its reward and the record with it marked claimed;
// null if it isn't finished or was already claimed.
export function claimTask(record: DailyTasks, id: TaskId): { record: DailyTasks; reward: number } | null {
  const task = record.tasks.find((t) => t.id === id);
  if (!task || !isClaimable(task)) return null;
  return {
    reward: TASK_DEFS[id].reward,
    record: { ...record, tasks: record.tasks.map((t) => (t.id === id ? { ...t, claimed: true } : t)) },
  };
}
