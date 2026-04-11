// @react-navigation/native mock for web preview
import { useRef, useEffect } from 'react';

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
// useFocusEffect: mount'ta çalışır + 500ms throttle ile her render'da yeniden çalışır
// (mock nav'da focus event yok; stack değişince App yeniden render → bileşen yeniden render → tetikler)
export const useFocusEffect = (cb) => {
  const cbRef = useRef(cb);
  const lastRun = useRef(0);
  cbRef.current = cb;
  useEffect(() => {
    const now = Date.now();
    if (now - lastRun.current > 600) {
      lastRun.current = now;
      cbRef.current();
    }
  });  // deps yok → her render'da → stack değişince DashboardScreen yeniden render olur
};
export const useIsFocused = () => true;
export const useNavigationState = (sel) => sel({ routes: [], index: 0 });
export const NavigationContainer = ({ children }) => children;
export const createNavigatorFactory = () => () => ({ Navigator: ({ children }) => children, Screen: ({ children }) => children });
export const useScrollToTop = () => {};
export const useTheme = () => ({ colors: {}, dark: true });

// CommonActions — used by CreateGroupScreen for stack reset after group creation
export const CommonActions = {
  reset:    (state) => ({ type: 'RESET',    payload: state }),
  navigate: (name, params) => ({ type: 'NAVIGATE', payload: { name, params } }),
  goBack:   () => ({ type: 'GO_BACK' }),
};
