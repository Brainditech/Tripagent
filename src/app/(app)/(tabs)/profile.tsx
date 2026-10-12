import { useAuth, useUser } from "@clerk/expo";
import * as Sentry from "@sentry/react-native";
import { useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { StatusBar } from "expo-status-bar";
import { useCallback } from "react";
import { Alert, Linking, ScrollView, Share, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  BellIcon,
  CalendarIcon,
  DocumentIcon,
  GearIcon,
  GiftIcon,
  GlobeIcon,
  HelpIcon,
  LogoutIcon,
  MoonIcon,
  PlaneIcon,
  ShieldIcon,
  StarIcon,
  TicketIcon,
  TranslateIcon,
  TrashIcon,
  TuneIcon,
} from "@/components/icons";
import { ActionButton, IdentityCard, PROFILE_COLORS, SettingsGroup, SettingsRow, StatsCard } from "@/components/profile-ui";
import { useRefreshOnFocus } from "@/hooks/use-refresh-on-focus";
import { useApi } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { meQueryOptions } from "@/lib/me";
import { deviceLocale, localeLabel, profileIdentity, tripStats } from "@/lib/profile";
import { tripsQueryOptions } from "@/lib/trips";

// UI texts, grouped here so they can move to i18n in Phase 6.
const TEXTS = {
  title: "Profil",
  traveller: "Voyageur",
  trips: "Voyages",
  destinations: "Destinations",
  days: "Jours",
  account: "Compte",
  travelPreferences: "Préférences de voyage",
  notifications: "Notifications",
  quota: "Quota mensuel",
  quotaValue: (remaining: number, total: number) => `${remaining} restant${remaining > 1 ? "s" : ""} sur ${total}`,
  preferences: "Préférences",
  settings: "Réglages",
  appearance: "Apparence",
  language: "Langue",
  support: "Support",
  help: "Aide et support",
  privacy: "Politique de confidentialité",
  terms: "Conditions d’utilisation",
  rate: "Noter Tripagent",
  invite: "Inviter des amis",
  inviteMessage: "Je prépare mes voyages avec Tripagent, un planificateur de voyages par IA. Essaie-le !",
  signOut: "Se déconnecter",
  deleteAccount: "Supprimer le compte",
  deleteAccountSoon: "La suppression du compte arrive dans une prochaine version.",
  appName: "Tripagent",
  version: (version: string) => `Tripagent v${version}`,
} as const;

const ICON = PROFILE_COLORS.icon;
const ACCENT = PROFILE_COLORS.accent;

/**
 * The account (from Clerk, no request), its figures (from the trips list shared with the home and
 * the Voyages tab), the monthly quota (`/api/me`), then the settings rows of the mockup: those
 * without a feature yet have no action (Phase 9), the others open the system settings, share an
 * invitation, sign out. Figures and quota are read again when the tab comes back into view.
 */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { user } = useUser();
  const api = useApi();

  const tripsQuery = useQuery(tripsQueryOptions(api));
  const meQuery = useQuery(meQueryOptions(api));
  const refetchTrips = tripsQuery.refetch;
  const refetchMe = meQuery.refetch;
  useRefreshOnFocus(useCallback(() => Promise.all([refetchTrips(), refetchMe()]), [refetchTrips, refetchMe]));

  const identity = profileIdentity(
    user
      ? {
          fullName: user.fullName,
          email: user.primaryEmailAddress?.emailAddress ?? null,
          imageUrl: user.imageUrl,
          hasImage: user.hasImage,
        }
      : null,
  );
  const stats = tripStats(tripsQuery.data?.trips ?? []);
  // A dash until the list is known: a zero would read as "no trip".
  const figure = (n: number) => (tripsQuery.data ? String(n) : "–");
  const quotas = meQuery.data?.quotas;
  const version = Constants.expoConfig?.version;

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      Sentry.logger.warn("Sign-out failed", { message: errorMessage(error) });
    }
  };
  const openSystemSettings = () => {
    Linking.openSettings().catch((error: unknown) => {
      Sentry.logger.warn("System settings could not be opened", { message: errorMessage(error) });
    });
  };
  const invite = async () => {
    try {
      await Share.share({ message: TEXTS.inviteMessage });
    } catch (error) {
      Sentry.logger.warn("Invitation could not be shared", { message: errorMessage(error) });
    }
  };
  const deleteAccount = () => Alert.alert(TEXTS.deleteAccount, TEXTS.deleteAccountSoon);

  return (
    <View className="flex-1 bg-[#F7F8FB]">
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 28, paddingBottom: 28, paddingHorizontal: 17 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="font-sans-bold text-[24px] leading-[30px] text-[#111827]">{TEXTS.title}</Text>

        <View className="mt-[18px]">
          <IdentityCard
            name={identity.name ?? TEXTS.traveller}
            email={identity.email}
            initial={identity.initial}
            imageUri={identity.imageUri}
          />
        </View>

        <View className="mt-[14px]">
          <StatsCard
            stats={[
              { icon: <PlaneIcon width={15} color={ACCENT} />, value: figure(stats.trips), label: TEXTS.trips },
              { icon: <GlobeIcon width={15} color={ACCENT} />, value: figure(stats.destinations), label: TEXTS.destinations },
              { icon: <CalendarIcon width={13} color={ACCENT} />, value: figure(stats.days), label: TEXTS.days },
            ]}
          />
        </View>

        <SettingsGroup title={TEXTS.account}>
          <SettingsRow icon={<TuneIcon width={18} color={ICON} />} label={TEXTS.travelPreferences} />
          <SettingsRow icon={<BellIcon width={18} color={ICON} dot={false} />} label={TEXTS.notifications} />
          <SettingsRow
            icon={<TicketIcon width={18} color={ICON} />}
            label={TEXTS.quota}
            value={quotas ? TEXTS.quotaValue(quotas.tripsRemaining, quotas.tripsPerMonth) : "…"}
          />
        </SettingsGroup>

        <SettingsGroup title={TEXTS.preferences}>
          <SettingsRow icon={<GearIcon width={18} color={ICON} />} label={TEXTS.settings} onPress={openSystemSettings} />
          <SettingsRow icon={<MoonIcon width={18} color={ICON} />} label={TEXTS.appearance} />
          <SettingsRow icon={<TranslateIcon width={18} color={ICON} />} label={TEXTS.language} value={localeLabel(deviceLocale())} />
        </SettingsGroup>

        <SettingsGroup title={TEXTS.support}>
          <SettingsRow icon={<HelpIcon width={18} color={ICON} />} label={TEXTS.help} />
          <SettingsRow icon={<ShieldIcon width={18} color={ICON} />} label={TEXTS.privacy} />
          <SettingsRow icon={<DocumentIcon width={18} color={ICON} />} label={TEXTS.terms} />
          <SettingsRow icon={<StarIcon width={18} color={ICON} />} label={TEXTS.rate} />
          <SettingsRow icon={<GiftIcon width={18} color={ICON} />} label={TEXTS.invite} onPress={() => void invite()} />
        </SettingsGroup>

        <ActionButton
          className="mt-[22px]"
          icon={<LogoutIcon width={18} color={PROFILE_COLORS.ink} />}
          label={TEXTS.signOut}
          onPress={() => void handleSignOut()}
        />
        <ActionButton
          className="mt-[12px]"
          tone="danger"
          icon={<TrashIcon width={17} color={PROFILE_COLORS.danger} />}
          label={TEXTS.deleteAccount}
          onPress={deleteAccount}
        />

        <Text className="mt-[18px] text-center font-sans text-[12.5px] leading-[16px] text-[#9AA1AE]">
          {version ? TEXTS.version(version) : TEXTS.appName}
        </Text>
      </ScrollView>
    </View>
  );
}
