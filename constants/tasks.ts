// Daily tasks (the ԱՌԱՋԱԴՐԱՆՔՆԵՐ tab, lib/tasks.ts): every local day the
// player gets TASKS_PER_DAY of these, picked at random; a finished one is
// claimed with ՍՏԱՆԱԼ for its coins. Rewards grow with difficulty (20–60,
// about 100–150 a day). ՛ in the titles is U+055B, the emphasis mark.
export type TaskId = 'win1' | 'win3' | 'guess4' | 'guess3' | 'hint' | 'darts';

export const TASK_DEFS: Record<TaskId, { title: string; target: number; reward: number }> = {
  win1: { title: 'ՀԱՂԹԻ՛Ր 1 ԽԱՂ', target: 1, reward: 20 },
  win3: { title: 'ՀԱՂԹԻ՛Ր 3 ԽԱՂ', target: 3, reward: 50 },
  guess4: { title: 'ԳՈՒՇԱԿԻ՛Ր ԲԱՌԸ 4 ԿԱՄ ԱՎԵԼԻ ՔԻՉ ՓՈՐՁՈՎ', target: 1, reward: 40 },
  guess3: { title: 'ԳՈՒՇԱԿԻ՛Ր ԲԱՌԸ 3 ԿԱՄ ԱՎԵԼԻ ՔԻՉ ՓՈՐՁՈՎ', target: 1, reward: 60 },
  hint: { title: 'ՕԳՏԱԳՈՐԾԻ՛Ր ՀՈՒՇՈՒՄ', target: 1, reward: 20 },
  darts: { title: 'ՕԳՏԱԳՈՐԾԻ՛Ր ՆԵՏ', target: 1, reward: 20 },
};

export const TASKS_PER_DAY = 3;
export const TASKS_REFRESH_NOTE = 'ՆՈՐ ԱՌԱՋԱԴՐԱՆՔՆԵՐ՝ ԿԵՍԳԻՇԵՐԻՆ';
