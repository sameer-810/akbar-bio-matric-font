import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { decode } from "base-64";
import axios from "axios";
import { environment } from "@config/env";
import type { Role } from "../permissions";
import { queryClient } from "../api/queryClient";

// some RN engines lack `atob`, used below to read the token expiry
const runtimeGlobal = globalThis as unknown as { atob?: typeof decode };
if (!runtimeGlobal.atob) runtimeGlobal.atob = decode;

/** Staff and parents sign in through different doors and get different tokens. */
export type Audience = "staff" | "parent";

export interface StaffAccount {
  id: string;
  username: string;
  name: string;
  phone: string;
  email: string;
  role: Role;
  roleLabel: string;
  permissions: string[];
  teacherId: string | null;
  /** the number on the fingerprint machines, for staff who punch */
  biometricId?: string | null;
  mustChangePassword: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
}

export interface ParentAccount {
  id: string;
  username: string;
  name: string;
  phone: string;
  studentIds: string[];
  mustChangePassword: boolean;
  notify: { entry: boolean; exit: boolean; absent: boolean };
}

interface AuthState {
  audience: Audience | null;
  staff: StaffAccount | null;
  parent: ParentAccount | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  isAuthChecked: boolean;

  signedIn: (audience: Audience, account: StaffAccount | ParentAccount, token: string, refreshToken?: string) => void;
  updateAccount: (account: StaffAccount | ParentAccount) => void;
  logout: () => Promise<void>;
  initializeAuth: () => Promise<void>;
  refreshSession: () => Promise<string | null>;
  hasPermission: (permission: string) => boolean;
}

/** The base path of the door this session came through. */
export const authBase = (audience: Audience | null) => (audience === "parent" ? "/parent/auth" : "/auth");

/**
 * The web keeps its refresh token in an httpOnly cookie no script can read, and
 * its access token only in memory; phones keep both in the OS keystore.
 */
const onWeb = Platform.OS === "web";
export const cookieTransport: { withCredentials?: boolean; headers?: Record<string, string> } = onWeb
  ? { withCredentials: true, headers: { "X-Auth-Transport": "cookie" } }
  : {};

/** Whether this session can get a new access token; on the web only the server can see the cookie. */
export const canRefresh = (s: Pick<AuthState, "audience" | "refreshToken">) => Boolean(onWeb ? s.audience : s.refreshToken);

export function isTokenExpired(token: string | null) {
  if (!token) return true;
  try {
    const raw = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const base64 = raw + "=".repeat((4 - (raw.length % 4)) % 4);
    const { exp } = JSON.parse(atob(base64));
    return exp * 1000 < Date.now() + 30_000;
  } catch {
    return true;
  }
}

/** The OS keystore on phones; on the web, localStorage, which is why no token is saved there. */
const secureStorage: StateStorage = {
  getItem: async (name) => {
    if (Platform.OS === "web") {
      try {
        return localStorage.getItem(name);
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(name);
  },
  setItem: async (name, value) => {
    if (Platform.OS === "web") {
      try {
        localStorage.setItem(name, value);
      } catch {
        /* private window: the session just will not persist */
      }
      return;
    }
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name) => {
    if (Platform.OS === "web") {
      try {
        localStorage.removeItem(name);
      } catch {
        /* nothing to do */
      }
      return;
    }
    await SecureStore.deleteItemAsync(name);
  },
};

const STORAGE_KEY = "akbars-auth";

/** A burst of 401s must trigger one refresh, not twenty. */
let refreshPromise: Promise<string | null> | null = null;

/**
 * The cookie is shared by every tab and rotates on use, so tabs take turns: one
 * sent with a cookie another tab just replaced would be refused as a replay.
 */
function oneTabAtATime<T>(run: () => Promise<T>) {
  const { locks } = globalThis.navigator as unknown as {
    locks?: { request: (name: string, fn: () => Promise<T>) => Promise<T> };
  };
  return locks ? locks.request("akbars-refresh", run) : run();
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      audience: null,
      staff: null,
      parent: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isHydrated: false,
      isAuthChecked: false,

      signedIn: (audience, account, token, refreshToken) =>
        set({
          audience,
          staff: audience === "staff" ? (account as StaffAccount) : null,
          parent: audience === "parent" ? (account as ParentAccount) : null,
          token,
          refreshToken: refreshToken ?? null,
          isAuthenticated: true,
        }),

      // the account is re-read from the server on refresh, so a changed role,
      // a revoked permission or the forced-password flag is never stale here —
      // the previous parent app lost the flag on restart and let parents skip it
      updateAccount: (account) =>
        set((s) => (s.audience === "parent" ? { parent: account as ParentAccount } : { staff: account as StaffAccount })),

      logout: async () => {
        const { refreshToken, audience } = get();
        const session = canRefresh({ audience, refreshToken });
        set({ audience: null, staff: null, parent: null, token: null, refreshToken: null, isAuthenticated: false });
        queryClient.clear();
        await secureStorage.removeItem(STORAGE_KEY);
        if (session) {
          try {
            const body = refreshToken ? { refreshToken } : {};
            await axios.post(`${environment.apiUrl}${authBase(audience)}/logout`, body, { timeout: 10_000, ...cookieTransport });
          } catch {
            // the session expires on its own; signing out locally is what matters
          }
        }
      },

      hasPermission: (permission) => Boolean(get().staff?.permissions?.includes(permission)),

      refreshSession: async () => {
        if (refreshPromise) return refreshPromise;
        refreshPromise = (async () => {
          try {
            const { refreshToken, audience } = get();
            if (!canRefresh({ audience, refreshToken })) {
              await get().logout();
              return null;
            }
            // a browser session from before the cookie still sends its token, once, to move over
            const body = refreshToken ? { refreshToken } : {};
            const rs = await oneTabAtATime(() => axios.post(`${environment.apiUrl}${authBase(audience)}/refresh`, body, cookieTransport));
            const { accessToken, refreshToken: next, account } = rs.data.data;
            set({ token: accessToken, refreshToken: next ?? null, isAuthenticated: true });
            get().updateAccount(account);
            return accessToken as string;
          } catch (err) {
            // only a refusal signs out; a dropped network must not
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status === 401 || status === 403) await get().logout();
            return null;
          } finally {
            refreshPromise = null;
          }
        })();
        return refreshPromise;
      },

      initializeAuth: async () => {
        // always refresh once at start: it re-reads the account, so the
        // forced-password flag and permissions come from the server, not storage
        if (canRefresh(get())) {
          await get().refreshSession();
          set({ isAuthenticated: canRefresh(get()), isAuthChecked: true });
          return;
        }
        set({ isAuthenticated: !isTokenExpired(get().token), isAuthChecked: true });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => secureStorage),
      partialize: (s) => ({
        audience: s.audience,
        staff: s.staff,
        parent: s.parent,
        ...(onWeb ? {} : { token: s.token, refreshToken: s.refreshToken }),
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.isHydrated = true;
      },
    },
  ),
);
