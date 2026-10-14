import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Types ───────────────────────────────────────────────────────────────────

export type UserRole = "tenant" | "landlord" | "realtor" | null;

interface AuthUser {
  user_id?: string | number;
  id?: string | number;
  username?: string;
  email?: string;
  phone?: string;
  role?: string;
}

interface AuthState {
  isLoggedIn: boolean;
  isLoading: boolean; // true while reading AsyncStorage on mount
  userId: string | null;
  role: UserRole;
  username: string | null;
  email: string | null;
}

interface AuthContextValue extends AuthState {
  /**
   * Call this after a successful login / signup to persist the session and
   * update all consumers immediately.
   */
  login: (user: AuthUser) => Promise<void>;
  /** Clears the session from AsyncStorage and resets state. */
  logout: () => Promise<void>;
  /**
   * Returns true if we have already shown the subscription prompt for this
   * user, false otherwise.  Marks it as prompted atomically.
   */
  checkAndMarkSubscriptionPrompted: (userId: string) => Promise<boolean>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoggedIn: false,
    isLoading: true,
    userId: null,
    role: null,
    username: null,
    email: null,
  });

  // Load persisted session on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [[, loggedIn], [, userRaw], [, userId], [, role], [, username], [, email]] =
          await AsyncStorage.multiGet([
            "isLoggedIn",
            "user",
            "user_id",
            "role",
            "username",
            "email",
          ]);

        // Resolve the real user_id from either the dedicated key or the user blob
        let resolvedId = userId;
        if (!resolvedId && userRaw) {
          try {
            const parsed = JSON.parse(userRaw);
            const u = parsed?.user ?? parsed;
            resolvedId = u?.user_id != null
              ? String(u.user_id)
              : u?.id != null
              ? String(u.id)
              : null;
          } catch { /* ignore */ }
        }

        if (mounted) {
          setState({
            isLoggedIn: loggedIn === "true",
            isLoading: false,
            userId: resolvedId ?? null,
            role: (role as UserRole) ?? null,
            username: username ?? null,
            email: email ?? null,
          });
        }
      } catch {
        if (mounted) setState((s) => ({ ...s, isLoading: false }));
      }
    })();
    return () => { mounted = false; };
  }, []);

  const login = useCallback(async (user: AuthUser) => {
    const id = String(user.user_id ?? user.id ?? "");
    const role = (user.role ?? "") as UserRole;

    await AsyncStorage.multiSet([
      ["isLoggedIn", "true"],
      ["user", JSON.stringify(user)],
      ["user_id", id],
      ["username", user.username ?? ""],
      ["email", user.email ?? ""],
      ["phone", user.phone ?? ""],
      ["role", role ?? ""],
    ]);

    setState({
      isLoggedIn: true,
      isLoading: false,
      userId: id || null,
      role,
      username: user.username ?? null,
      email: user.email ?? null,
    });
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove([
      "isLoggedIn",
      "user",
      "user_id",
      "username",
      "email",
      "phone",
      "role",
    ]);
    setState({
      isLoggedIn: false,
      isLoading: false,
      userId: null,
      role: null,
      username: null,
      email: null,
    });
  }, []);

  /**
   * Atomically checks whether the subscription prompt has been shown for this
   * user.  If not, marks it as prompted and returns false (= show the modal).
   * If already prompted, returns true (= skip the modal).
   */
  const checkAndMarkSubscriptionPrompted = useCallback(
    async (userId: string): Promise<boolean> => {
      const key = `subscription_prompted_${userId}`;
      const existing = await AsyncStorage.getItem(key);
      if (existing === "true") return true; // already prompted
      await AsyncStorage.setItem(key, "true");
      return false; // first time — caller should show modal
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        checkAndMarkSubscriptionPrompted,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
