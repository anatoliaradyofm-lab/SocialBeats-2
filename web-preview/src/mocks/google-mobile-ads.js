// Mock for react-native-google-mobile-ads — web preview only, ads don't run on web

export const TestIds = {
  INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
  REWARDED:     'ca-app-pub-3940256099942544/5354046379',
  NATIVE:       'ca-app-pub-3940256099942544/2247696110',
};

export const AdEventType = {
  LOADED:  'loaded',
  CLOSED:  'closed',
  ERROR:   'error',
  OPENED:  'opened',
  CLICKED: 'clicked',
};

export const RewardedAdEventType = {
  LOADED:        'loaded',
  EARNED_REWARD: 'earned_reward',
  CLOSED:        'closed',
  ERROR:         'error',
};

const noopAd = {
  load:               () => {},
  show:               () => Promise.resolve(),
  addAdEventListener: () => () => {},
};

export const InterstitialAd = {
  createForAdRequest: () => noopAd,
};

export const RewardedAd = {
  createForAdRequest: () => noopAd,
};

export const NativeAd       = null;
export const MediaView       = null;
export const HeadlineView    = null;
export const TaglineView     = null;
export const CallToActionView= null;
export const AdvertiserView  = null;

export default {};
