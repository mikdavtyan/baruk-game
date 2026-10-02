export type LeaderboardEntry = { id: string; name: string; points: number };
export type RankedEntry = { rank: number; entry: LeaderboardEntry };

export const PLAYER_ID = 'player';

// TODO: real backend. This is mock data — everyone except the player is
// invented, clearly marked so it's obvious where the real integration goes.
// The player's own row always uses their real, current points.
const MOCK_ENTRIES: LeaderboardEntry[] = [
  { id: 'mock-1', name: 'Անի', points: 4210 },
  { id: 'mock-2', name: 'Դավիթ', points: 3870 },
  { id: 'mock-3', name: 'Մարիամ', points: 3340 },
  { id: 'mock-4', name: 'Գոռ', points: 1120 },
  { id: 'mock-5', name: 'Լիլիթ', points: 640 },
  { id: 'mock-6', name: 'Արամ', points: 210 },
];

export async function getLeaderboard(playerPoints: number): Promise<RankedEntry[]> {
  const all: LeaderboardEntry[] = [...MOCK_ENTRIES, { id: PLAYER_ID, name: 'ԴՈՒՔ', points: playerPoints }];
  return [...all].sort((a, b) => b.points - a.points).map((entry, i) => ({ rank: i + 1, entry }));
}
