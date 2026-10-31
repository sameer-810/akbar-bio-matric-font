import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuthStore } from "@shared/store/useAuthStore";
import { palette } from "@shared/designSystem";
import LoginScreen from "@modules/auth/screens/LoginScreen";
import ChangePasswordScreen from "@modules/auth/screens/ChangePasswordScreen";
import AppNavigator from "./AppNavigator";
import ParentNavigator from "./ParentNavigator";

export type RootParamList = {
  Login: undefined;
  SetPassword: undefined;
  App: undefined;
  Parent: undefined;
};

const Stack = createNativeStackNavigator<RootParamList>();

function ForcedPasswordChange() {
  return <ChangePasswordScreen forced />;
}

/**
 * Exactly one branch: signed out, a forced password change, the staff app, or
 * the parent app. The `key` remounts on change, so on the shared front-desk
 * computer nothing of the previous person's screens survives a sign-out.
 */
export default function RootNavigator() {
  const { left, right } = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const isAuthChecked = useAuthStore((s) => s.isAuthChecked);
  const audience = useAuthStore((s) => s.audience);
  // primitive selector on purpose (zustand v5 compares with Object.is)
  const mustChange = useAuthStore((s) =>
    Boolean(s.staff?.mustChangePassword || s.parent?.mustChangePassword),
  );

  useEffect(() => {
    if (isHydrated) void useAuthStore.getState().initializeAuth();
  }, [isHydrated]);

  if (!isHydrated || !isAuthChecked) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: palette.surface.secondary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={palette.primary[600]} />
      </View>
    );
  }

  const branch = !isAuthenticated
    ? "auth"
    : mustChange
      ? "forced"
      : audience === "parent"
        ? "parent"
        : "staff";

  // on a phone held sideways the system bar sits over the app, and over the menu button
  return (
    <View
      style={{
        flex: 1,
        paddingLeft: left,
        paddingRight: right,
        backgroundColor: palette.surface.primary,
      }}
    >
      <Stack.Navigator key={branch} screenOptions={{ headerShown: false }}>
        {branch === "auth" ? (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ title: "Sign in" }}
          />
        ) : branch === "forced" ? (
          <Stack.Screen
            name="SetPassword"
            component={ForcedPasswordChange}
            options={{ title: "Set your password" }}
          />
        ) : branch === "parent" ? (
          <Stack.Screen name="Parent" component={ParentNavigator} />
        ) : (
          <Stack.Screen name="App" component={AppNavigator} />
        )}
      </Stack.Navigator>
    </View>
  );
}
