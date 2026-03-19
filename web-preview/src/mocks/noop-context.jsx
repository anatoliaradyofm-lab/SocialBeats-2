import React, { createContext, useContext } from 'react';
const Ctx = createContext({});
export const useNoopContext = () => useContext(Ctx);
export function NoopProvider({ children }) { return <Ctx.Provider value={{}}>{children}</Ctx.Provider>; }
export const ScreenTimeProvider = ({ children }) => <>{children}</>;
export const useScreenTime = () => ({});
export const InterstitialAdProvider = ({ children }) => <>{children}</>;
export const useInterstitialAd = () => ({ show: () => {}, isLoaded: false });
export const useInterstitialAdContext = () => ({ showAd: () => {}, isLoaded: false, isReady: false });
export const AppColorsProvider = ({ children }) => <>{children}</>;
export const useAppColors = () => ({});
export default Ctx;
