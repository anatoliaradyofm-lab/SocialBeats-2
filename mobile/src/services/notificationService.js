import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  constructor() {
    this.expoPushToken = null;
    this.notificationListener = null;
    this.responseListener = null;
  }

  async initialize(onNotification, onResponse) {
    try {
      const token = await this.registerForPushNotifications();

      this.notificationListener = Notifications.addNotificationReceivedListener(
        (notification) => {
          if (onNotification) onNotification(notification);
        }
      );

      this.responseListener = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          if (onResponse) onResponse(response);
        }
      );

      return token;
    } catch (error) {
      console.warn('Notification init error:', error);
      return null;
    }
  }

  async registerForPushNotifications() {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return null;
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'SocialBeats',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#8B5CF6',
        });
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: undefined,
      });
      this.expoPushToken = tokenData.data;

      await AsyncStorage.setItem('pushToken', this.expoPushToken);

      try {
        const authToken = await AsyncStorage.getItem('token');
        if (authToken) {
          await api.post('/users/me/push-token', { token: this.expoPushToken }, authToken);
        }
      } catch {}

      return this.expoPushToken;
    } catch (error) {
      console.warn('Push registration error:', error);
      return null;
    }
  }

  async scheduleLocalNotification(title, body, data = {}, trigger = null) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
        },
        trigger: trigger || null,
      });
    } catch (error) {
      console.warn('Schedule notification error:', error);
    }
  }

  async getBadgeCount() {
    return await Notifications.getBadgeCountAsync();
  }

  async setBadgeCount(count) {
    await Notifications.setBadgeCountAsync(count);
  }

  cleanup() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
      this.notificationListener = null;
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
      this.responseListener = null;
    }
  }
}

export default new NotificationService();
