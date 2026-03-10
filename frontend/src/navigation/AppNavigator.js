import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { navigationRef } from './navigationRef';
import { useAuth } from '../contexts/AuthContext';
import { linking, setupDeepLinking } from '../utils/deeplink';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import MainTabNavigator from './MainTabNavigator';
import SettingsScreen from '../screens/SettingsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import PlaylistDetailScreen from '../screens/PlaylistDetailScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import PostDetailScreen from '../screens/PostDetailScreen';
import CreatePostScreen from '../screens/CreatePostScreen';
import ConversationsScreen from '../screens/ConversationsScreen';
import ChatScreen from '../screens/ChatScreen';
import StoryViewerScreen from '../screens/StoryViewerScreen';
import StoryCreateScreen from '../screens/StoryCreateScreen';
import ProfileEditScreen from '../screens/ProfileEditScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LyricsScreen from '../screens/LyricsScreen';
import ListeningRoomScreen from '../screens/ListeningRoomScreen';
import EqualizerScreen from '../screens/EqualizerScreen';
import SearchScreen from '../screens/SearchScreen';
import FeedScreen from '../screens/FeedScreen';
import FollowersListScreen from '../screens/FollowersListScreen';
import FollowingListScreen from '../screens/FollowingListScreen';
import BlockedUsersScreen from '../screens/BlockedUsersScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import PrivacyScreen from '../screens/PrivacyScreen';
import FullPlayerScreen from '../screens/FullPlayerScreen';
import QueueScreen from '../screens/QueueScreen';
import SmartPlaylistScreen from '../screens/SmartPlaylistScreen';
import ListeningStatsScreen from '../screens/ListeningStatsScreen';
import HighlightsScreen from '../screens/HighlightsScreen';
import GroupChatScreen from '../screens/GroupChatScreen';
import CloseFriendsScreen from '../screens/CloseFriendsScreen';
import MutedUsersScreen from '../screens/MutedUsersScreen';
import ReportScreen from '../screens/ReportScreen';
import ProfileStatsScreen from '../screens/ProfileStatsScreen';
import LanguageScreen from '../screens/LanguageScreen';
import MusicQualityScreen from '../screens/MusicQualityScreen';
import DownloadSettingsScreen from '../screens/DownloadSettingsScreen';
import SecurityScreen from '../screens/SecurityScreen';
import BackupScreen from '../screens/BackupScreen';
import DataManagementScreen from '../screens/DataManagementScreen';
import AdSettingsScreen from '../screens/AdSettingsScreen';
import HelpScreen from '../screens/HelpScreen';
import AboutScreen from '../screens/AboutScreen';
import YearlyWrapScreen from '../screens/YearlyWrapScreen';
import ShareProfileScreen from '../screens/ShareProfileScreen';
import CallScreen from '../screens/CallScreen';
import SuggestedUsersScreen from '../screens/SuggestedUsersScreen';
import PlaylistAddTrackScreen from '../screens/PlaylistAddTrackScreen';
import ImageEditorScreen from '../screens/ImageEditorScreen';
import MusicTasteTestScreen from '../screens/MusicTasteTestScreen';
import ScreenTimeScreen from '../screens/ScreenTimeScreen';
import TwoFactorVerifyScreen from '../screens/TwoFactorVerifyScreen';
import AdminPanelScreen from '../screens/AdminPanelScreen';
import MapViewScreen from '../screens/MapViewScreen';
import QRScannerScreen from '../screens/QRScannerScreen';
import ARExperienceScreen from '../screens/ARExperienceScreen';
import CameraCaptureScreen from '../screens/CameraCaptureScreen';

const Stack = createNativeStackNavigator();

const slideOptions = { headerShown: false, animation: 'slide_from_right', gestureEnabled: true };
const modalOptions = { headerShown: false, animation: 'slide_from_bottom', gestureEnabled: true, presentation: 'modal' };

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={slideOptions}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="TwoFactorVerify" component={TwoFactorVerifyScreen} />
    </Stack.Navigator>
  );
}

function AppStack() {
  return (
    <Stack.Navigator screenOptions={slideOptions}>
      <Stack.Screen name="Main" component={MainTabNavigator} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
      <Stack.Screen name="ProfileStats" component={ProfileStatsScreen} />
      <Stack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} />
      <Stack.Screen name="SmartPlaylists" component={SmartPlaylistScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
      <Stack.Screen name="Feed" component={FeedScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="FollowersList" component={FollowersListScreen} />
      <Stack.Screen name="FollowingList" component={FollowingListScreen} />
      <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
      <Stack.Screen name="CloseFriends" component={CloseFriendsScreen} />
      <Stack.Screen name="MutedUsers" component={MutedUsersScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
      <Stack.Screen name="Conversations" component={ConversationsScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="GroupChat" component={GroupChatScreen} />
      <Stack.Screen name="ListeningStats" component={ListeningStatsScreen} />
      <Stack.Screen name="Highlights" component={HighlightsScreen} />
      <Stack.Screen name="Report" component={ReportScreen} />
      <Stack.Screen name="Language" component={LanguageScreen} />
      <Stack.Screen name="MusicQuality" component={MusicQualityScreen} />
      <Stack.Screen name="DownloadSettings" component={DownloadSettingsScreen} />
      <Stack.Screen name="Security" component={SecurityScreen} />
      <Stack.Screen name="Backup" component={BackupScreen} />
      <Stack.Screen name="DataManagement" component={DataManagementScreen} />
      <Stack.Screen name="AdSettings" component={AdSettingsScreen} />
      <Stack.Screen name="Help" component={HelpScreen} />
      <Stack.Screen name="About" component={AboutScreen} />
      <Stack.Screen name="YearlyWrap" component={YearlyWrapScreen} />
      <Stack.Screen name="ShareProfile" component={ShareProfileScreen} />
      <Stack.Screen name="SuggestedUsers" component={SuggestedUsersScreen} />
      <Stack.Screen name="MusicTasteTest" component={MusicTasteTestScreen} />
      <Stack.Screen name="ScreenTime" component={ScreenTimeScreen} />
      <Stack.Screen name="AdminPanel" component={AdminPanelScreen} />
      <Stack.Screen name="MapView" component={MapViewScreen} />
      <Stack.Screen name="QRScanner" component={QRScannerScreen} />
      <Stack.Screen name="ARExperience" component={ARExperienceScreen} options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="FullPlayer" component={FullPlayerScreen} options={modalOptions} />
      <Stack.Screen name="Call" component={CallScreen} options={modalOptions} />
      <Stack.Screen name="Queue" component={QueueScreen} options={modalOptions} />
      <Stack.Screen name="CreatePost" component={CreatePostScreen} options={modalOptions} />
      <Stack.Screen name="StoryViewer" component={StoryViewerScreen} options={modalOptions} />
      <Stack.Screen name="StoryCreate" component={StoryCreateScreen} options={modalOptions} />
      <Stack.Screen name="Lyrics" component={LyricsScreen} options={modalOptions} />
      <Stack.Screen name="ListeningRoom" component={ListeningRoomScreen} options={modalOptions} />
      <Stack.Screen name="Equalizer" component={EqualizerScreen} options={modalOptions} />
      <Stack.Screen name="PlaylistAddTrack" component={PlaylistAddTrackScreen} options={modalOptions} />
      <Stack.Screen name="ImageEditor" component={ImageEditorScreen} options={modalOptions} />
      <Stack.Screen name="CameraCapture" component={CameraCaptureScreen} options={modalOptions} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, isGuest, isLoading } = useAuth();

  useEffect(() => {
    if (isAuthenticated || isGuest) {
      const cleanup = setupDeepLinking();
      return cleanup;
    }
  }, [isAuthenticated, isGuest]);

  if (isLoading) return null;
  return (
    <NavigationContainer ref={navigationRef} linking={isAuthenticated || isGuest ? linking : undefined}>
      {isAuthenticated || isGuest ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
}
