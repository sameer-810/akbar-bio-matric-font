import axios, { CanceledError, type InternalAxiosRequestConfig } from "axios";
import { environment } from "@config/env";
import { useAuthStore, authBase, canRefresh, cookieTransport } from "../store/useAuthStore";

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  /** who was signed in when this request was first sent */
  _accountId?: string | null;
}

export const apiClient = axios.create({
  baseURL: environment.apiUrl,
  ...cookieTransport,
  headers: { "Content-Type": "application/json", ...cookieTransport.headers },
  timeout: 30_000,
});

const signedInAs = () => {
  const s = useAuthStore.getState();
  return s.staff?.id ?? s.parent?.id ?? null;
};

/**
 * Requests are pinned to whoever made them: on the shared front-desk computer
 * a retry must not go out under the next person's token and file the first
 * person's change under their name.
 */
apiClient.interceptors.request.use((config) => {
  const pinned = config as RetryableConfig;
  if (pinned._accountId === undefined) pinned._accountId = signedInAs();
  else if (pinned._accountId !== signedInAs()) {
    throw new CanceledError("The signed-in person changed before this request was sent", undefined, config);
  }
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as RetryableConfig | undefined;
    if (!original) return Promise.reject(error);
    const { audience } = useAuthStore.getState();
    // never refresh the refresh call, never loop
    if (original.url?.includes(`${authBase(audience)}/refresh`) || original._retry || !canRefresh(useAuthStore.getState())) {
      return Promise.reject(error);
    }
    if (original._accountId && original._accountId !== signedInAs()) return Promise.reject(error);

    if (error.response?.status === 401) {
      original._retry = true;
      const fresh = await useAuthStore.getState().refreshSession();
      if (fresh) {
        original.headers.Authorization = `Bearer ${fresh}`;
        return apiClient(original);
      }
    }
    return Promise.reject(error);
  },
);

/** The server's machine-readable error code, when it sent one. */
export function apiErrorCode(err: unknown): string | undefined {
  return (err as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code;
}

/** Turns a Zod issue path into a readable field label. */
function fieldLabel(path: (string | number)[]) {
  const parts = path.filter((p) => p !== "body" && p !== "query" && p !== "params");
  const name = parts.filter((p) => typeof p === "string").pop();
  if (!name) return "";
  return String(name)
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

/** One readable sentence out of any failure shape; validation issues name the fields at fault. */
export function apiErrorMessage(err: unknown, fallback = "Something went wrong") {
  const e = err as {
    code?: string;
    message?: string;
    response?: {
      data?: {
        error?: { message?: string; details?: { issues?: { path: (string | number)[]; message: string }[] } };
      };
    };
  };

  if (!e?.response) {
    if (e?.code === "ECONNABORTED") return "That took too long. Check the connection and try again.";
    if (err instanceof Error && /Network/i.test(err.message)) return "No connection to the academy server.";
  }

  const error = e?.response?.data?.error;
  const message = error?.message || (!error && err instanceof Error ? err.message : "") || fallback;
  const issues = error?.details?.issues;
  if (issues?.length) {
    const detail = [
      ...new Set(issues.map((i) => (fieldLabel(i.path || []) ? `${fieldLabel(i.path)}: ${i.message}` : i.message))),
    ]
      .slice(0, 4)
      .join(" · ");
    if (detail) return `${message} — ${detail}`;
  }
  return message;
}
