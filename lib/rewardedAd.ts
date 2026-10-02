import { AD_FAKE_LOAD_MS } from '../constants/winFlow';

// TODO: replace with a real rewarded-ad SDK (e.g. Google Mobile Ads/AdMob).
// This stub simulates a short load, then always "succeeds" — good enough to
// build and test the reward flow around, not a real ad integration.
export function showRewardedAd(): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(true), AD_FAKE_LOAD_MS);
  });
}
