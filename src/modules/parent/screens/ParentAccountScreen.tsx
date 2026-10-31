import React, { useState } from "react";
import { View, Platform, StyleSheet } from "react-native";

import { Screen, Card, VStack, Text, Button, Banner, SectionHeader, ToggleRow, useBreakpoint } from "@shared/ui";
import { apiErrorMessage } from "@api/apiClient";
import { useAuthStore } from "@shared/store/useAuthStore";
import { SessionsCard } from "@modules/auth/components/SessionsCard";
import { useParentActions, useParentSettings } from "../hooks/useParent";
import { registerForPush, usePushState, type PushState } from "../pushRegistration";

const PUSH_TEXT: Record<PushState, { tone: "success" | "warning" | "info" | "danger"; text: string }> = {
  on: { tone: "success", text: "Alerts will come to this phone." },
  denied: { tone: "warning", text: "Notifications are turned off for this app in the phone's settings. Turn them on there to get alerts." },
  unsupported: { tone: "info", text: "This browser does not get alerts. Install the app on your phone, or see them under Alerts." },
  not_configured: { tone: "info", text: "Phone alerts are not set up in this build yet. Alerts still appear under Alerts." },
  error: { tone: "danger", text: "Could not turn on alerts. Check the internet and try again." },
};

/** What the family is told about, where they are signed in, and signing out. */
export default function ParentAccountScreen() {
  const { isWide } = useBreakpoint();
  const parent = useAuthStore((s) => s.parent);
  const logout = useAuthStore((s) => s.logout);
  const settings = useParentSettings();
  const act = useParentActions();
  const registered = usePushState();
  const push: PushState | null = Platform.OS === "web" ? "unsupported" : registered;
  const [error, setError] = useState<string | null>(null);
  const notify = parent?.notify ?? { entry: true, exit: true, absent: true };

  const toggle = (k: keyof typeof notify) => async (v: boolean) => {
    setError(null);
    try {
      await act.setPreferences.mutateAsync({ [k]: v });
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <Screen title="Account" subtitle={parent ? `Login ${parent.username.toUpperCase()}` : undefined} testID="parent-account">
      <View style={[styles.wrap, isWide && styles.wrapWide]}>
        <VStack gap={16}>
          {error ? <Banner tone="danger" message={error} onDismiss={() => setError(null)} /> : null}
          <Card>
            <VStack gap={10}>
              <SectionHeader title="Tell me when my child…" subtitle="Turned off, the alert is not sent to any of your phones." />
              <ToggleRow label="reaches class" value={notify.entry} onChange={toggle("entry")} testID="notify-entry" />
              <ToggleRow label="leaves class" value={notify.exit} onChange={toggle("exit")} testID="notify-exit" />
              <ToggleRow label="is absent" value={notify.absent} onChange={toggle("absent")} testID="notify-absent" />
            </VStack>
          </Card>

          <Card>
            <VStack gap={10}>
              <SectionHeader title="Alerts on this phone" />
              {push ? <Banner tone={PUSH_TEXT[push].tone} message={PUSH_TEXT[push].text} /> : null}
              {push !== "on" && push !== "unsupported" ? (
                <Button label={push ? "Try again" : "Turn on alerts"} variant="secondary" onPress={() => void registerForPush()} />
              ) : null}
            </VStack>
          </Card>

          <SessionsCard />

          {settings.data ? (
            <Card>
              <VStack gap={4}>
                <Text variant="label">{settings.data.academy}</Text>
                {settings.data.branch ? <Text tone="secondary" variant="body-sm">{settings.data.branch}</Text> : null}
                {settings.data.phone ? <Text tone="secondary" variant="body-sm">Phone {settings.data.phone}</Text> : null}
              </VStack>
            </Card>
          ) : null}

          <Button label="Sign out" variant="secondary" onPress={() => void logout()} fullWidth testID="parent-signout" />
        </VStack>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", alignSelf: "center" },
  wrapWide: { maxWidth: 640 },
});
