module.exports = {
    default: () => Promise.resolve(),
    TestIds: {
        BANNER: 'mock',
        INTERSTITIAL: 'mock',
        REWARDED: 'mock',
        REWARDED_INTERSTITIAL: 'mock'
    },
    BannerAd: () => null,
    RewardedAd: {
        createForAdRequest: () => ({ load: () => { }, show: () => { }, addAdEventListener: () => ({}) })
    },
    InterstitialAd: {
        createForAdRequest: () => ({ load: () => { }, show: () => { }, addAdEventListener: () => ({}) })
    },
    RewardedInterstitialAd: {
        createForAdRequest: () => ({ load: () => { }, show: () => { }, addAdEventListener: () => ({}) })
    },
    AdEventType: { LOADED: 'loaded', CLOSED: 'closed', ERROR: 'error', OPENED: 'opened' },
    RewardedAdEventType: { LOADED: 'loaded', EARNED_REWARD: 'earned_reward' }
};
