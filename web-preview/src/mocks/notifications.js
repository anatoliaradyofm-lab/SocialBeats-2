// expo-notifications — mock
export const requestPermissionsAsync      = () => Promise.resolve({ status: 'undetermined' });
export const getPermissionsAsync          = () => Promise.resolve({ status: 'undetermined' });
export const scheduleNotificationAsync    = () => Promise.resolve('');
export const cancelScheduledNotificationAsync = () => Promise.resolve();
export const setNotificationHandler       = () => {};
export const addNotificationReceivedListener       = () => ({ remove: () => {} });
export const addNotificationResponseReceivedListener = () => ({ remove: () => {} });
export const getExpoPushTokenAsync        = () => Promise.resolve({ data: '' });
export const AndroidImportance            = { MAX: 5, HIGH: 4, DEFAULT: 3, LOW: 2, MIN: 1 };
