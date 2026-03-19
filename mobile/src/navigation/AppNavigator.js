import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { navigationRef } from './navigationRef';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import AuthCallbackScreen from '../screens/AuthCallbackScreen';
import SettingsScreen from '../screens/SettingsScreen';
import NotFoundScreen from '../screens/NotFoundScreen';
import MainTabNavigator from './MainTabNavigator';
import NotificationsScreen from '../screens/NotificationsScreen';
import PlaylistDetailScreen from '../screens/PlaylistDetailScreen';
import AddSongsToPlaylistScreen from '../screens/AddSongsToPlaylistScreen';
import ProfileScreen     from '../screens/ProfileScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import SearchScreen from '../screens/SearchScreen';
import StoriesScreen from '../screens/StoriesScreen';
import StoryViewerScreen from '../screens/StoryViewerScreen';
import StoryCreateScreen from '../screens/StoryCreateScreen';
import StoryArchiveScreen from '../screens/StoryArchiveScreen';
import ProfileStatsScreen from '../screens/ProfileStatsScreen';
import ScreenTimeScreen from '../screens/ScreenTimeScreen';
import MusicTasteTestScreen from '../screens/MusicTasteTestScreen';
import LikedScreen from '../screens/LikedScreen';
import SavedScreen from '../screens/SavedScreen';
import ConversationsScreen from '../screens/ConversationsScreen';
import ChatScreen from '../screens/ChatScreen';
import CreateGroupScreen from '../screens/CreateGroupScreen';
import GroupSettingsScreen from '../screens/GroupSettingsScreen';
import ArchivedConversationsScreen from '../screens/ArchivedConversationsScreen';
import StarredMessagesScreen from '../screens/StarredMessagesScreen';
import CallHistoryScreen from '../screens/CallHistoryScreen';
import SharePostPickerScreen from '../screens/SharePostPickerScreen';
import ShareMusicPickerScreen from '../screens/ShareMusicPickerScreen';
import SharePlaylistPickerScreen from '../screens/SharePlaylistPickerScreen';
import ShareProfilePickerScreen from '../screens/ShareProfilePickerScreen';
import ForwardTargetPickerScreen from '../screens/ForwardTargetPickerScreen';
import CallScreen from '../screens/CallScreen';
import IncomingCallScreen from '../screens/IncomingCallScreen';
import TwoFASettingsScreen from '../screens/TwoFASettingsScreen';
import ProfileEditScreen from '../screens/ProfileEditScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import DataExportScreen from '../screens/DataExportScreen';
import FreezeAccountScreen from '../screens/FreezeAccountScreen';
import FollowersListScreen from '../screens/FollowersListScreen';
import FollowingListScreen from '../screens/FollowingListScreen';
import BlockedUsersScreen from '../screens/BlockedUsersScreen';
import RestrictedUsersScreen from '../screens/RestrictedUsersScreen';
import MutedUsersScreen from '../screens/MutedUsersScreen';
import CloseFriendsScreen from '../screens/CloseFriendsScreen';
import UserSuggestionsScreen from '../screens/UserSuggestionsScreen';
import FindContactsScreen from '../screens/FindContactsScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import AdSettingsScreen from '../screens/AdSettingsScreen';
import LyricsScreen from '../screens/LyricsScreen';
import ListeningHistoryScreen from '../screens/ListeningHistoryScreen';
import ProfileQRScreen from '../screens/ProfileQRScreen';
import LiveStreamScreen from '../screens/LiveStreamScreen';
import EventsScreen from '../screens/EventsScreen';
import AchievementsScreen from '../screens/AchievementsScreen';
import CollaborativePlaylistScreen from '../screens/CollaborativePlaylistScreen';
import ListeningRoomScreen from '../screens/ListeningRoomScreen';
import ARMusicScreen from '../screens/ARMusicScreen';
import EqualizerScreen from '../screens/EqualizerScreen';
import SongRadioScreen from '../screens/SongRadioScreen';
import DiscoverPeopleScreen from '../screens/DiscoverPeopleScreen';
import ChangeEmailScreen from '../screens/ChangeEmailScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import DeleteAccountScreen from '../screens/DeleteAccountScreen';
import SessionsScreen from '../screens/SessionsScreen';
import FollowSuggestionsScreen from '../screens/FollowSuggestionsScreen';
import MusicDiscoverScreen from '../screens/MusicDiscoverScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import ContactsFindScreen from '../screens/ContactsFindScreen';
import ContactsFriendsScreen from '../screens/ContactsFriendsScreen';
import FindFriendsFromContactsScreen from '../screens/FindFriendsFromContactsScreen';
import CommunitiesScreen from '../screens/CommunitiesScreen';
import KaraokeScreen from '../screens/KaraokeScreen';
import ReferralScreen from '../screens/ReferralScreen';
import BackupScreen from '../screens/BackupScreen';
import FeedbackScreen from '../screens/FeedbackScreen';
import LicensesScreen from '../screens/LicensesScreen';
import AudiomackScreen from '../screens/AudiomackScreen';
import AccountSettingsScreen from '../screens/AccountSettingsScreen';
import NotifSettingsScreen from '../screens/NotifSettingsScreen';
import AudioSettingsScreen from '../screens/AudioSettingsScreen';
import LanguageRegionScreen from '../screens/LanguageRegionScreen';
import DataBackupScreen from '../screens/DataBackupScreen';
import AccessibilitySettingsScreen from '../screens/AccessibilitySettingsScreen';
import LegalSettingsScreen from '../screens/LegalSettingsScreen';

const Stack = createNativeStackNavigator();

const slideScreenOptions = {
  headerShown: false,
  animation: 'slide_from_right',
  animationDuration: 250,
  gestureEnabled: true,
  gestureDirection: 'horizontal',
};

const modalScreenOptions = {
  headerShown: false,
  animation: 'slide_from_bottom',
  animationDuration: 300,
  gestureEnabled: true,
  gestureDirection: 'vertical',
  presentation: 'modal',
};

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={slideScreenOptions}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="AuthCallback" component={AuthCallbackScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
}

function AppStack() {
  const { user, isAuthenticated, isGuest } = useAuth();
  const authenticated = !!(user || isAuthenticated);
  const showMain = authenticated || isGuest;

  return (
    <Stack.Navigator screenOptions={slideScreenOptions}>
      {!showMain ? (
        <>
          <Stack.Screen name="Auth" component={AuthStack} />
          <Stack.Screen name="NotFound" component={NotFoundScreen} />
        </>
      ) : showMain ? (
        <>
          <Stack.Screen name="Main" component={MainTabNavigator} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{ headerShown: false, presentation: 'transparentModal', animation: 'slide_from_bottom', animationDuration: 300 }}
          />
          <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
          <Stack.Screen name="AdSettings" component={AdSettingsScreen} />
          <Stack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} />
          <Stack.Screen name="AddSongsToPlaylist" component={AddSongsToPlaylistScreen} />
          <Stack.Screen name="Profile"     component={ProfileScreen}     />
          <Stack.Screen name="UserProfile" component={UserProfileScreen} />
          <Stack.Screen name="Search" component={SearchScreen} />
          <Stack.Screen name="Stories" component={StoriesScreen} />
          <Stack.Screen name="StoryViewer" component={StoryViewerScreen} options={modalScreenOptions} />
          <Stack.Screen name="StoryCreate" component={StoryCreateScreen} options={modalScreenOptions} />
          <Stack.Screen name="StoryArchive" component={StoryArchiveScreen} />
          <Stack.Screen name="Liked" component={LikedScreen} />
          <Stack.Screen name="Saved" component={SavedScreen} />
          <Stack.Screen name="Conversations" component={ConversationsScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
          <Stack.Screen name="GroupSettings" component={GroupSettingsScreen} />
          <Stack.Screen name="ArchivedConversations" component={ArchivedConversationsScreen} />
          <Stack.Screen name="StarredMessages" component={StarredMessagesScreen} />
          <Stack.Screen name="CallHistory" component={CallHistoryScreen} />
          <Stack.Screen name="SharePostPicker" component={SharePostPickerScreen} />
          <Stack.Screen name="ShareMusicPicker" component={ShareMusicPickerScreen} />
          <Stack.Screen name="SharePlaylistPicker" component={SharePlaylistPickerScreen} />
          <Stack.Screen name="ShareProfilePicker" component={ShareProfilePickerScreen} />
          <Stack.Screen name="ForwardTargetPicker" component={ForwardTargetPickerScreen} />
          <Stack.Screen name="Call" component={CallScreen} options={modalScreenOptions} />
          <Stack.Screen name="IncomingCall" component={IncomingCallScreen} options={modalScreenOptions} />
          <Stack.Screen name="TwoFASettings" component={TwoFASettingsScreen} />
          <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
          <Stack.Screen name="ProfileStats" component={ProfileStatsScreen} />
          <Stack.Screen name="ScreenTime" component={ScreenTimeScreen} />
          <Stack.Screen name="MusicTasteTest" component={MusicTasteTestScreen} />
          <Stack.Screen name="DataExport" component={DataExportScreen} />
          <Stack.Screen name="FreezeAccount" component={FreezeAccountScreen} />
          <Stack.Screen name="FollowersList" component={FollowersListScreen} />
          <Stack.Screen name="FollowingList" component={FollowingListScreen} />
          <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
          <Stack.Screen name="MutedUsers" component={MutedUsersScreen} />
          <Stack.Screen name="RestrictedUsers" component={RestrictedUsersScreen} />
          <Stack.Screen name="CloseFriends" component={CloseFriendsScreen} />
          <Stack.Screen name="UserSuggestions" component={UserSuggestionsScreen} />
          <Stack.Screen name="FindContacts" component={FindContactsScreen} />
          <Stack.Screen name="Lyrics" component={LyricsScreen} options={modalScreenOptions} />
          <Stack.Screen name="ListeningHistory" component={ListeningHistoryScreen} />
          <Stack.Screen name="ProfileQR" component={ProfileQRScreen} options={modalScreenOptions} />
          <Stack.Screen name="LiveStream" component={LiveStreamScreen} options={modalScreenOptions} />
          <Stack.Screen name="Events" component={EventsScreen} />
          <Stack.Screen name="Achievements" component={AchievementsScreen} />
          <Stack.Screen name="CollaborativePlaylists" component={CollaborativePlaylistScreen} />
          <Stack.Screen name="ListeningRoom" component={ListeningRoomScreen} options={modalScreenOptions} />
          <Stack.Screen name="ARMusic" component={ARMusicScreen} options={modalScreenOptions} />
          <Stack.Screen name="Equalizer" component={EqualizerScreen} options={modalScreenOptions} />
          <Stack.Screen name="SongRadio" component={SongRadioScreen} />
          <Stack.Screen name="DiscoverPeople" component={DiscoverPeopleScreen} />
          <Stack.Screen name="ChangeEmail" component={ChangeEmailScreen} />
          <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
          <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
          <Stack.Screen name="Sessions" component={SessionsScreen} />
          <Stack.Screen name="FollowSuggestions" component={FollowSuggestionsScreen} />
          <Stack.Screen name="MusicDiscover" component={MusicDiscoverScreen} />
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="ContactsFind" component={ContactsFindScreen} />
          <Stack.Screen name="ContactsFriends" component={ContactsFriendsScreen} />
          <Stack.Screen name="FindFriendsFromContacts" component={FindFriendsFromContactsScreen} />
          <Stack.Screen name="Communities" component={CommunitiesScreen} />
          <Stack.Screen name="Karaoke" component={KaraokeScreen} />
          <Stack.Screen name="Referral" component={ReferralScreen} />
          <Stack.Screen name="Backup" component={BackupScreen} />
          <Stack.Screen name="Feedback" component={FeedbackScreen} />
          <Stack.Screen name="Licenses" component={LicensesScreen} />
          <Stack.Screen name="Audiomack" component={AudiomackScreen} />
          <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
          <Stack.Screen name="NotifSettings" component={NotifSettingsScreen} />
          <Stack.Screen name="AudioSettings" component={AudioSettingsScreen} />
          <Stack.Screen name="LanguageRegion" component={LanguageRegionScreen} />
          <Stack.Screen name="DataBackup" component={DataBackupScreen} />
          <Stack.Screen name="AccessibilitySettings" component={AccessibilitySettingsScreen} />
          <Stack.Screen name="LegalSettings" component={LegalSettingsScreen} />
          <Stack.Screen name="NotFound" component={NotFoundScreen} />
        </>
      ) : null}
    </Stack.Navigator>
  );
}

export default function AppNavigator({ onRouteChanged }) {
  return (
    <ErrorBoundary>
      <NavigationContainer
        ref={navigationRef}
        onStateChange={() => {
          const currentRouteName = navigationRef.current?.getCurrentRoute()?.name;
          if (onRouteChanged) onRouteChanged(currentRouteName);
        }}
      >
        <AppStack />
      </NavigationContainer>
    </ErrorBoundary>
  );
}
