import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/auth/AuthProvider';
import { ads, demoHunt, initialMessages } from './src/data/demo';
import {
  buildCompletionPlan,
  buildPreClueAds,
  isValidTarget,
  type AdStep,
} from './src/domain/huntFlow';
import {
  fetchCurrentItems,
  joinHunt,
  submitScan,
  type JoinHuntResult,
  type RemoteHuntItem,
  type ScanReward,
} from './src/lib/hunts';
import { AuthScreen } from './src/screens/AuthScreen';
import { colors } from './src/theme';
import type {
  ChatMessage,
  Clue,
  ClueKind,
  HuntFormat,
  HuntTier,
  Screen,
} from './src/types';
import { HomeScreen } from './src/screens/HomeScreen';
import {
  AdScreen,
  ArScreen,
  CelebrationScreen,
  ClueScreen,
  CountdownScreen,
  FinaleScreen,
  JoinScannerScreen,
  RewardScreen,
  ScannerScreen,
} from './src/screens/HuntScreens';
import {
  ChatScreen,
  MasterScreen,
  TrackingScreen,
} from './src/screens/LiveScreens';
import { SettingsScreen } from './src/screens/SettingsScreen';

function clueEyebrow(kind: ClueKind): string {
  switch (kind) {
    case 'photo':
      return 'Photo clue';
    case 'video':
      return 'Video clue';
    case 'ar':
      return 'AR discovery';
    default:
      return 'Text clue';
  }
}

// Converts a row from the my_current_items view (see supabase/schema.sql)
// into the same Clue shape the offline demo screens already render. In
// CLU/TRL Quest, each item is the hunt's next story chapter rather than a
// generic clue, so the eyebrow reads "Chapter N" instead of the kind label.
function remoteItemToClue(item: RemoteHuntItem, format?: HuntFormat): Clue {
  return {
    id: item.id,
    order: item.position,
    title: item.title,
    eyebrow: format === 'quest' ? `Chapter ${item.position}` : clueEyebrow(item.kind),
    clue: item.clue_text,
    hint: item.hint_text ?? 'Ask your Hunt Master for a nudge.',
    kind: item.kind,
    // The server verifies scans in remote mode (see submit_scan); the client
    // never learns the expected value, so this is an unused placeholder.
    qrValue: '',
    coordinates:
      item.latitude != null && item.longitude != null
        ? { latitude: item.latitude, longitude: item.longitude }
        : undefined,
  };
}

export default function App() {
  return (
    <AuthProvider>
      <SafeAreaProvider>
        <AppShell />
      </SafeAreaProvider>
    </AuthProvider>
  );
}

function AppShell() {
  const { configured, loading, session } = useAuth();
  const [authSkipped, setAuthSkipped] = useState(false);
  const [screen, setScreen] = useState<Screen>('home');
  const [tier, setTier] = useState<HuntTier>('immersive');
  const [joined, setJoined] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [adQueue, setAdQueue] = useState<AdStep[]>([]);
  const [adDestination, setAdDestination] = useState<Screen>('clue');
  const [countdownNext, setCountdownNext] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);

  const [remoteMembership, setRemoteMembership] = useState<JoinHuntResult | null>(null);
  const [remoteItems, setRemoteItems] = useState<RemoteHuntItem[]>([]);
  const [remoteReward, setRemoteReward] = useState<ScanReward | null>(null);

  // A signed-in session with Supabase configured means real hunt data;
  // anything else (unconfigured, or the user chose the offline skip) keeps
  // running on the local demoHunt state exactly as before.
  const remoteMode = configured && Boolean(session);

  const localClue = demoHunt.clues[currentIndex] ?? demoHunt.clues[0]!;
  const remoteCurrentItem = remoteItems.find((item) => !item.completed) ?? null;
  const remoteClue = remoteCurrentItem
    ? remoteItemToClue(remoteCurrentItem, remoteMembership?.format)
    : null;
  const clue: Clue | null = remoteMode ? remoteClue : localClue;

  const total = remoteMode ? (remoteMembership?.total_items ?? 0) : demoHunt.clues.length;
  const completedCount = remoteMode
    ? remoteItems.filter((item) => item.completed).length
    : completedIds.length;

  function showAds(queue: AdStep[], destination: Screen) {
    // Used only for the pre-clue ad on join — nothing has been found yet, so
    // no celebration or countdown belongs here.
    setCountdownNext(false);
    if (queue.length === 0) {
      setScreen(destination);
      return;
    }
    setAdQueue(queue);
    setAdDestination(destination);
    setScreen('ad');
  }

  // A confirmed scan always celebrates first, then runs the normal ad queue,
  // then either a 3-2-1 countdown (more clues waiting) or the 15-second
  // finale (hunt just finished) before landing on the next screen.
  function celebrateThenAds(queue: AdStep[], destination: Screen) {
    setCountdownNext(true);
    setAdQueue(queue);
    setAdDestination(destination);
    setScreen('celebration');
  }

  function proceedAfterAds(destination: Screen) {
    if (destination === 'clue' && countdownNext) {
      setScreen('countdown');
      return;
    }
    if (destination === 'reward') {
      setScreen('finale');
      return;
    }
    setScreen(destination);
  }

  function afterCelebration() {
    if (adQueue.length === 0) {
      proceedAfterAds(adDestination);
      return;
    }
    setScreen('ad');
  }

  function afterCountdown() {
    setScreen('clue');
  }

  function afterFinale() {
    setScreen('reward');
  }

  async function startHunt(code: string) {
    if (remoteMode) {
      const result = await joinHunt(code);
      setRemoteMembership(result);
      const items = await fetchCurrentItems();
      setRemoteItems(items);
      setJoined(true);
      if (result.completed_at) {
        // Already finished this hunt in an earlier session — there is no
        // current clue to show, so go straight to the reward screen instead
        // of a pre-clue ad. The redemption code itself isn't re-fetched here
        // (it's only ever returned once, by submit_scan on the final scan).
        setRemoteReward(null);
        setScreen('reward');
        return;
      }
      showAds(buildPreClueAds(ads), 'clue');
      return;
    }

    if (code.trim().toUpperCase() !== demoHunt.joinCode) {
      throw new Error(`Use ${demoHunt.joinCode} to enter the working demo hunt.`);
    }
    setJoined(true);
    setCurrentIndex(0);
    setCompletedIds([]);
    showAds(buildPreClueAds(ads), 'clue');
  }

  function continueHunt() {
    setScreen('clue');
  }

  function completeLocalClue() {
    const plan = buildCompletionPlan({
      clue: localClue,
      clueCount: demoHunt.clues.length,
      currentIndex,
      completedIds,
      ads,
    });
    setCompletedIds(plan.completedIds);
    setCurrentIndex(plan.nextIndex);
    celebrateThenAds(plan.ads, plan.destination);
  }

  async function handleScan(rawValue: string) {
    if (remoteMode) {
      if (!remoteMembership) {
        throw new Error('Join a hunt first.');
      }
      const result = await submitScan(remoteMembership.membership_id, rawValue);
      const items = await fetchCurrentItems();
      setRemoteItems(items);
      setRemoteMembership((prev) =>
        prev ? { ...prev, total_items: result.total_items } : prev,
      );

      const postFindPlacement = ads.find((item) => item.moment === 'after-find');
      const postAds: AdStep[] = postFindPlacement
        ? [{ placement: postFindPlacement, label: 'Find confirmed · Sponsor message' }]
        : [];

      if (result.hunt_complete) {
        setRemoteReward(result.reward ?? null);
        celebrateThenAds(postAds, 'reward');
      } else {
        celebrateThenAds(postAds, 'clue');
      }
      return;
    }

    if (!isValidTarget(rawValue, localClue)) {
      throw new Error('That belongs to a different discovery. Keep looking.');
    }
    completeLocalClue();
  }

  function advanceAd() {
    if (adQueue.length > 1) {
      setAdQueue((queue) => queue.slice(1));
      return;
    }
    setAdQueue([]);
    proceedAfterAds(adDestination);
  }

  function resetDemo() {
    setJoined(false);
    setCurrentIndex(0);
    setCompletedIds([]);
    setAdQueue([]);
    setCountdownNext(false);
    setRemoteMembership(null);
    setRemoteItems([]);
    setRemoteReward(null);
    setScreen('home');
  }

  function sendMessage(body: string, from: 'hunter' | 'master' = 'hunter') {
    const next: ChatMessage = {
      id: `local-${Date.now()}`,
      body,
      from,
      time: 'Now',
    };
    setMessages((items) => [...items, next]);
  }

  const inverse =
    screen === 'scanner' ||
    screen === 'joinScan' ||
    screen === 'ar' ||
    screen === 'celebration' ||
    screen === 'countdown' ||
    screen === 'finale';
  const needsAuth = configured && !loading && !session && !authSkipped;

  if (configured && loading) {
    return (
      <View style={styles.loadingApp}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  if (needsAuth) {
    return (
      <View style={styles.app}>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <AuthScreen onSkip={() => setAuthSkipped(true)} />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.app, inverse && styles.appInverse]}>
      <StatusBar style={inverse ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {screen === 'home' ? (
          <HomeScreen
            featuredHunt={demoHunt}
            activeHuntName={remoteMode ? remoteMembership?.hunt_name ?? '' : demoHunt.name}
            activeHuntSubtitle={
              remoteMode ? undefined : `${demoHunt.venue} · ${demoHunt.city}`
            }
            tier={tier}
            format={remoteMode ? remoteMembership?.format : undefined}
            joined={joined}
            progress={completedCount}
            total={total}
            joinCodeDefault={remoteMode ? '' : demoHunt.joinCode}
            onJoin={startHunt}
            onScanToJoin={() => setScreen('joinScan')}
            onContinue={continueHunt}
            onNavigate={setScreen}
          />
        ) : null}

        {screen === 'joinScan' ? (
          <JoinScannerScreen
            onBack={() => setScreen('home')}
            onScan={startHunt}
          />
        ) : null}

        {screen === 'celebration' ? (
          <CelebrationScreen onDone={afterCelebration} />
        ) : null}

        {screen === 'ad' && adQueue[0] ? (
          <AdScreen
            step={adQueue[0]}
            remaining={adQueue.length}
            onContinue={advanceAd}
          />
        ) : null}

        {screen === 'countdown' ? (
          <CountdownScreen onDone={afterCountdown} />
        ) : null}

        {screen === 'finale' ? <FinaleScreen onDone={afterFinale} /> : null}

        {screen === 'clue' && clue ? (
          <ClueScreen
            clue={clue}
            tier={tier}
            total={total}
            completed={completedCount}
            onBack={() => setScreen('home')}
            onScan={() => setScreen('scanner')}
            onAr={() => setScreen('ar')}
            onChat={() => setScreen('chat')}
          />
        ) : null}

        {screen === 'scanner' && clue ? (
          <ScannerScreen
            clue={clue}
            total={total}
            demoScanValue={remoteMode ? undefined : clue.qrValue}
            onBack={() => setScreen('clue')}
            onScan={handleScan}
          />
        ) : null}

        {screen === 'ar' && clue ? (
          <ArScreen
            clue={clue}
            tier={tier}
            onBack={() => setScreen('clue')}
            onReadyToScan={() => setScreen('scanner')}
          />
        ) : null}

        {screen === 'reward' ? (
          <RewardScreen
            huntName={remoteMode ? remoteMembership?.hunt_name ?? 'Your hunt' : demoHunt.name}
            rewardTitle={
              remoteMode ? remoteReward?.title ?? 'Hunt complete!' : demoHunt.rewardTitle
            }
            rewardCopy={
              remoteMode
                ? remoteReward?.terms ?? 'Show this screen to redeem your reward.'
                : demoHunt.rewardCopy
            }
            rewardCode={remoteMode ? remoteReward?.redemption_code ?? '' : demoHunt.rewardCode}
            totalItems={total}
            onHome={() => setScreen('home')}
            onRestart={resetDemo}
          />
        ) : null}

        {screen === 'tracking' ? (
          <TrackingScreen
            tier={tier}
            onBack={() => setScreen('home')}
            onChat={() => setScreen('chat')}
          />
        ) : null}

        {screen === 'chat' ? (
          <ChatScreen
            tier={tier}
            messages={messages}
            onBack={() => setScreen('clue')}
            onSend={sendMessage}
          />
        ) : null}

        {screen === 'master' ? (
          <MasterScreen
            hunt={demoHunt}
            tier={tier}
            onNavigate={setScreen}
          />
        ) : null}

        {screen === 'settings' ? (
          <SettingsScreen
            tier={tier}
            onTierChange={setTier}
            onNavigate={setScreen}
            onReset={resetDemo}
          />
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingApp: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
  },
  app: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  appInverse: {
    backgroundColor: colors.ink,
  },
  safeArea: {
    flex: 1,
  },
});
