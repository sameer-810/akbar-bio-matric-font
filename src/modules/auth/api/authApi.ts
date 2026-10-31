import { apiClient } from "@api/apiClient";
import { authBase, type Audience, type StaffAccount, type ParentAccount } from "@shared/store/useAuthStore";
import { getDeviceId, getDeviceName } from "@api/deviceId";
import type { SessionRow } from "../types";

type Account = StaffAccount | ParentAccount;
interface TokenResponse {
  account: Account;
  accessToken: string;
  /** absent on the web, where it arrives as a cookie */
  refreshToken?: string;
}

export const authApi = Object.freeze({
  async login(audience: Audience, username: string, password: string): Promise<TokenResponse> {
    const { data } = await apiClient.post(`${authBase(audience)}/login`, {
      username,
      password,
      deviceId: await getDeviceId(),
      deviceName: getDeviceName(),
    });
    return data.data;
  },

  async changePassword(audience: Audience, currentPassword: string, newPassword: string): Promise<TokenResponse> {
    const { data } = await apiClient.post(`${authBase(audience)}/change-password`, { currentPassword, newPassword });
    return data.data;
  },

  async me(audience: Audience): Promise<Account> {
    const { data } = await apiClient.get(`${authBase(audience)}/me`);
    return data.data;
  },

  async sessions(audience: Audience): Promise<SessionRow[]> {
    const { data } = await apiClient.get(`${authBase(audience)}/sessions`);
    return data.data;
  },

  async revokeSession(audience: Audience, sessionId: string): Promise<void> {
    await apiClient.delete(`${authBase(audience)}/sessions/${sessionId}`);
  },
});
