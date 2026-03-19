// @react-navigation/native mock for web preview
import { useRef } from 'react';

export const useNavigation = () => ({
  navigate:    () => {},
  goBack:      () => {},
  push:        () => {},
  replace:     () => {},
  reset:       () => {},
  setOptions:  () => {},
  addListener: () => () => {},
  dispatch:    () => {},
  isFocused:   () => true,
  canGoBack:   () => false,
  getParent:   () => null,
});

export const useRoute = () => ({ key: 'mock', name: 'mock', params: {} });
export const useFocusEffect = (cb) => { cb(); };
export const useIsFocused = () => true;
export const useNavigationState = (sel) => sel({ routes: [], index: 0 });
export const NavigationContainer = ({ children }) => children;
export const createNavigatorFactory = () => () => ({ Navigator: ({ children }) => children, Screen: ({ children }) => children });
export const useScrollToTop = () => {};
export const useTheme = () => ({ colors: {}, dark: true });
