import React, { useEffect, useState } from "react";
import {
  Animated,
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  type PressableStateCallbackType,
} from "react-native";
import { webAria } from "@shared/ui/a11y";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  LogOut,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react-native";
import { useAuthStore } from "@shared/store/useAuthStore";
import { palette, radius, layout } from "@shared/designSystem";
import { Text, VStack, HStack, Avatar, BrandMark } from "@shared/ui";
import { type NavItem, type NavSection, SECTION_ICON, SECTION_ORDER, useVisibleNavItems } from "./navItems";
import { useUnreadInbox } from "@modules/notifications/hooks/useInbox";

interface Props {
  activeRoute: string;
  onNavigate: (name: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({
  activeRoute,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: Props) {
  const insets = useSafeAreaInsets();
  const name = useAuthStore((s) => s.staff?.name ?? "");
  const roleLabel = useAuthStore((s) => s.staff?.roleLabel ?? "");
  const logout = useAuthStore((s) => s.logout);
  const items = useVisibleNavItems();
  const activeSection = items.find((it) => it.name === activeRoute)?.section;
  const [open, setOpen] = useState<NavSection[]>(activeSection ? [activeSection] : []);

  // arriving on a page from anywhere shows the group it belongs to
  const [shownSection, setShownSection] = useState(activeSection);
  if (activeSection !== shownSection) {
    setShownSection(activeSection);
    if (activeSection && !open.includes(activeSection)) setOpen([...open, activeSection]);
  }

  const toggle = (section: NavSection) =>
    setOpen((o) => (o.includes(section) ? o.filter((s) => s !== section) : [...o, section]));

  return (
    <View
      role="navigation"
      accessibilityLabel="Main navigation"
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + 18,
          width: collapsed ? layout.sidebarCollapsedWidth : layout.sidebarWidth,
        },
      ]}
    >
      <HStack
        gap={10}
        align="center"
        style={{
          paddingHorizontal: collapsed ? 0 : 18,
          justifyContent: collapsed ? "center" : "flex-start",
          marginBottom: 18,
        }}
      >
        <BrandMark size={36} />
        {!collapsed ? (
          <>
            <VStack gap={1} flex={1}>
              <Text variant="h3" tone="primary" numberOfLines={1}>
                Akbar&apos;s Academy
              </Text>
              <Text variant="caption" tone="tertiary" numberOfLines={1}>
                Cheeta Camp
              </Text>
            </VStack>
            {onToggleCollapse ? (
              <Pressable
                onPress={onToggleCollapse}
                hitSlop={8}
                style={styles.toggleBtn}
                accessibilityRole="button"
                accessibilityLabel="Collapse sidebar"
              >
                <ChevronsLeft
                  size={18}
                  color={palette.text.tertiary}
                  strokeWidth={2}
                />
              </Pressable>
            ) : null}
          </>
        ) : null}
      </HStack>

      {collapsed && onToggleCollapse ? (
        <Pressable
          onPress={onToggleCollapse}
          hitSlop={8}
          style={styles.expandBtn}
          accessibilityRole="button"
          accessibilityLabel="Expand sidebar"
        >
          <ChevronsRight
            size={18}
            color={palette.text.tertiary}
            strokeWidth={2}
          />
        </Pressable>
      ) : null}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: collapsed ? 10 : 12 }}
        showsVerticalScrollIndicator={false}
      >
        {SECTION_ORDER.map((section) => {
          const group = items.filter((it) => it.section === section);
          if (group.length === 0) return null;
          const expanded = open.includes(section);
          return (
            <View key={section}>
              {collapsed ? (
                <View style={styles.sectionDivider} />
              ) : (
                <SectionRow
                  section={section}
                  active={section === activeSection}
                  expanded={expanded}
                  hasInbox={group.some((it) => it.name === "Inbox")}
                  onPress={() => toggle(section)}
                />
              )}
              {collapsed || expanded
                ? group.map((item) => (
                    <NavRow
                      key={item.name}
                      item={item}
                      active={activeRoute === item.name}
                      collapsed={collapsed}
                      onPress={() => onNavigate(item.name)}
                    />
                  ))
                : null}
            </View>
          );
        })}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + 12,
            paddingHorizontal: collapsed ? 0 : 14,
            alignItems: collapsed ? "center" : "stretch",
          },
        ]}
      >
        {collapsed ? (
          <VStack gap={10} align="center">
            <Avatar name={name || "U"} size={34} />
            <Pressable
              onPress={() => logout()}
              hitSlop={8}
              style={styles.logoutBtn}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
            >
              <LogOut
                size={17}
                color={palette.text.tertiary}
                strokeWidth={1.9}
              />
            </Pressable>
          </VStack>
        ) : (
          <HStack gap={10} align="center">
            <Avatar name={name || "U"} size={36} />
            <VStack gap={1} flex={1}>
              <Text variant="label" tone="primary" numberOfLines={1}>
                {name}
              </Text>
              <Text variant="caption" tone="tertiary" numberOfLines={1}>
                {roleLabel}
              </Text>
            </VStack>
            <Pressable
              onPress={() => logout()}
              hitSlop={8}
              style={styles.logoutBtn}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
            >
              <LogOut
                size={17}
                color={palette.text.tertiary}
                strokeWidth={1.9}
              />
            </Pressable>
          </HStack>
        )}
      </View>
    </View>
  );
}

/** RN's typings leave out the hovered state react-native-web passes. */
const isHot = (state: PressableStateCallbackType) =>
  state.pressed || (state as { hovered?: boolean }).hovered;

function SectionRow({
  section,
  active,
  expanded,
  hasInbox,
  onPress,
}: {
  section: NavSection;
  active: boolean;
  expanded: boolean;
  hasInbox: boolean;
  onPress: () => void;
}) {
  const Icon = SECTION_ICON[section];
  const color = active ? palette.primary[700] : palette.text.secondary;
  const [turn] = useState(() => new Animated.Value(expanded ? 1 : 0));
  useEffect(() => {
    Animated.timing(turn, {
      toValue: expanded ? 1 : 0,
      duration: 160,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [expanded, turn]);
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={section}
      accessibilityState={{ expanded }}
      {...webAria({ expanded })}
      testID={`nav-section-${section}`}
      style={(state) => [
        styles.navRow,
        styles.sectionRow,
        active && styles.navRowActive,
        isHot(state) && !active ? { backgroundColor: palette.ink[50] } : null,
      ]}
    >
      <Icon size={18} color={active ? palette.primary[700] : palette.text.tertiary} strokeWidth={active ? 2.3 : 1.9} />
      <Text variant="label-lg" numberOfLines={1} style={{ color, flex: 1 }}>
        {section}
      </Text>
      {hasInbox && !expanded ? <UnreadBadge /> : null}
      <Animated.View style={{ transform: [{ rotate }] }}>
        <ChevronDown size={16} color={active ? palette.primary[700] : palette.text.tertiary} strokeWidth={2} />
      </Animated.View>
    </Pressable>
  );
}

function NavRow({
  item,
  active,
  collapsed,
  onPress,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onPress: () => void;
}) {
  const Icon = item.icon;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={item.label}
      // native reads "selected"; web uses aria-current instead (aria-selected is invalid on a link).
      accessibilityState={
        Platform.OS === "web" ? undefined : { selected: active }
      }
      {...webAria({ current: active ? "page" : undefined })}
      style={(state) => [
        styles.navRow,
        collapsed ? styles.navRowCollapsed : styles.childRow,
        active && (collapsed ? styles.navRowActive : styles.childRowActive),
        isHot(state) && !active ? { backgroundColor: palette.ink[50] } : null,
      ]}
    >
      {active && !collapsed ? <View style={styles.activeBar} /> : null}
      <Icon
        size={18}
        color={active ? palette.primary[700] : palette.text.tertiary}
        strokeWidth={active ? 2.3 : 1.9}
      />
      {!collapsed ? (
        <Text
          variant="label"
          numberOfLines={1}
          style={{
            color: active ? palette.primary[700] : palette.text.secondary,
          }}
        >
          {item.label}
        </Text>
      ) : null}
      {item.name === "Inbox" ? <UnreadBadge /> : null}
    </Pressable>
  );
}

/** Unread notes on the sidebar's Notifications row. */
function UnreadBadge() {
  const n = useUnreadInbox().data?.unread ?? 0;
  if (!n) return null;
  return (
    <View style={styles.unread} accessibilityLabel={`${n} unread`}>
      <Text variant="caption" style={{ color: "#fff", fontSize: 11, lineHeight: 14 }}>
        {n > 99 ? "99+" : String(n)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  unread: {
    marginLeft: "auto",
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: "#A82418",
    alignItems: "center",
    justifyContent: "center",
  },
  wrap: {
    flexShrink: 0,
    height: "100%",
    backgroundColor: palette.surface.primary,
    borderRightWidth: 1,
    borderRightColor: palette.border.default,
  },
  toggleBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  expandBtn: {
    alignSelf: "center",
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: palette.ink[50],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: layout.navRowHeight,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    marginBottom: 1,
  },
  navRowCollapsed: { justifyContent: "center", paddingHorizontal: 0, gap: 0 },
  navRowActive: { backgroundColor: palette.primary[50] },
  sectionRow: { marginTop: 4 },
  childRow: { marginLeft: 18 },
  childRowActive: { backgroundColor: palette.ink[50] },
  activeBar: {
    position: "absolute",
    left: 0,
    top: 7,
    bottom: 7,
    width: 3,
    borderRadius: 2,
    backgroundColor: palette.primary[700],
  },
  sectionDivider: {
    height: 1,
    backgroundColor: palette.border.subtle,
    marginVertical: 6,
    marginHorizontal: 4,
  },
  footer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: palette.border.default,
  },
  logoutBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
