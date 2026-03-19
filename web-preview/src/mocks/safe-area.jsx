// react-native-safe-area-context — web stubs
import React from 'react';
import { View } from 'react-native';

const INSETS = { top: 44, bottom: 74, left: 0, right: 0 };
const SafeAreaContext = React.createContext(INSETS);

export const SafeAreaProvider = ({ children }) => (
  <SafeAreaContext.Provider value={INSETS}>{children}</SafeAreaContext.Provider>
);
export const SafeAreaView = ({ children, style, edges }) => (
  <View style={[{ paddingTop: INSETS.top, paddingBottom: INSETS.bottom }, style]}>{children}</View>
);
export const useSafeAreaInsets = () => INSETS;
export const useSafeAreaFrame  = () => ({ x: 0, y: 0, width: 390, height: 844 });
export const SafeAreaInsetsContext = SafeAreaContext;
export const initialWindowMetrics  = { frame: { x:0,y:0,width:390,height:844 }, insets: INSETS };
