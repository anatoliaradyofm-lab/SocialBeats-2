export function shouldTriggerInterstitialHome() { return false; }
export function shouldTriggerInterstitialFeed() { return false; }
export default function useInterstitialAd() { return { trigger: () => Promise.resolve(), loadAd: () => { } }; }
