import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type Profile = {
  id: string;
  display_name: string;
};

type AuthState = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  isAnonymous: boolean;
  signInAsGuest: (displayName: string) => Promise<void>;
  signInWithEmail: (email: string) => Promise<void>;
  upgradeToEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (active) setSession(nextSession);
      },
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!supabase || !userId) {
      setProfile(null);
      return;
    }
    let active = true;
    supabase
      .from('profiles')
      .select('id, display_name')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setProfile(data as Profile | null);
      });
    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  async function signInAsGuest(displayName: string) {
    if (!supabase) {
      throw new Error(
        'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
      );
    }
    const trimmed = displayName.trim();
    if (!trimmed) throw new Error('Enter a display name to continue.');

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    const userId = data.user?.id;
    if (!userId) throw new Error('Sign-in did not return a user.');

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ id: userId, display_name: trimmed });
    if (profileError) throw profileError;

    setProfile({ id: userId, display_name: trimmed });
  }

  async function signInWithEmail(email: string) {
    if (!supabase) {
      throw new Error(
        'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
      );
    }
    const trimmed = email.trim();
    if (!trimmed) throw new Error('Enter an email address to continue.');

    const { error } = await supabase.auth.signInWithOtp({ email: trimmed });
    if (error) throw error;
  }

  // Attaches an email identity to the CURRENT anonymous user rather than
  // creating a new account, so the user id — and with it every
  // hunt_membership, item_completion, and quest placement already earned —
  // survives the upgrade. That distinction is the whole point: a 22-chapter
  // Quest represents weeks of play, and signing in fresh would strand it.
  //
  // Supabase emails a confirmation link; is_anonymous stays true until the
  // player clicks it, so callers should treat this as "check your inbox",
  // not "done".
  async function upgradeToEmail(email: string) {
    if (!supabase) {
      throw new Error(
        'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
      );
    }
    const trimmed = email.trim();
    if (!trimmed) throw new Error('Enter an email address to continue.');
    if (!session) throw new Error('Sign in before saving your progress.');

    const { error } = await supabase.auth.updateUser({ email: trimmed });
    if (error) throw error;
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setProfile(null);
  }

  const value = useMemo<AuthState>(
    () => ({
      configured: isSupabaseConfigured,
      loading,
      session,
      profile,
      isAnonymous: Boolean(session?.user?.is_anonymous),
      signInAsGuest,
      signInWithEmail,
      upgradeToEmail,
      signOut,
    }),
    [loading, session, profile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
