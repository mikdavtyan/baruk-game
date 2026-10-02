# The share bonus is iOS-only

React Native's share API reports `sharedAction` on Android even when the player dismisses the share sheet, so the +200 share bonus could be claimed there without sharing. Confirming a real share on Android would need a native module, which Expo Go can't load. We decided the bonus is awarded only on iOS, where a dismissed share is reported as such; on Android, sharing still works but awards nothing and shows no bonus badge.
