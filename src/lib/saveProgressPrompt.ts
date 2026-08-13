import AsyncStorage from '@react-native-async-storage/async-storage';

// Remembers that a player said "Not now" to the guest-account upgrade, so the
// banner asks once and then stays quiet. Stored on the device rather than the
// account on purpose: the whole point of the prompt is that the account may
// not survive, and a nagging banner is the fastest way to make someone
// resent an otherwise reasonable ask.
const DISMISSED_KEY = 'clutrl.save-progress-dismissed';

export async function loadSaveProgressDismissed(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(DISMISSED_KEY)) === 'true';
  } catch {
    // A storage failure should never block play — just ask again next launch.
    return false;
  }
}

export async function markSaveProgressDismissed(): Promise<void> {
  try {
    await AsyncStorage.setItem(DISMISSED_KEY, 'true');
  } catch {
    // Non-fatal for the same reason.
  }
}
