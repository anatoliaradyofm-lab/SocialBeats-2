import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ONBOARDING_KEY = '@onboarding_completed';

const PAGES = [
  {
    id: '1',
    titleKey: 'onboarding.page1Title',
    subtitleKey: 'onboarding.page1Subtitle',
    icon: 'musical-notes',
    color: '#8B5CF6',
    bgGradient: '#1E1B4B',
  },
  {
    id: '2',
    titleKey: 'onboarding.page2Title',
    subtitleKey: 'onboarding.page2Subtitle',
    icon: 'people',
    color: '#EC4899',
    bgGradient: '#1E1B3B',
  },
  {
    id: '3',
    titleKey: 'onboarding.page3Title',
    subtitleKey: 'onboarding.page3Subtitle',
    icon: 'sparkles',
    color: '#F59E0B',
    bgGradient: '#1B1E2B',
  },
  {
    id: '4',
    titleKey: 'onboarding.page4Title',
    subtitleKey: 'onboarding.page4Subtitle',
    icon: 'rocket',
    color: '#10B981',
    bgGradient: '#1B2B1E',
  },
];

export async function isOnboardingCompleted() {
  try {
    const val = await AsyncStorage.getItem(ONBOARDING_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function setOnboardingCompleted() {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
  } catch {}
}

export default function OnboardingScreen({ onComplete }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(0);
  const flatListRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleNext = () => {
    if (currentPage < PAGES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentPage + 1, animated: true });
      setCurrentPage(currentPage + 1);
    } else {
      completeOnboarding();
    }
  };

  const handleSkip = () => {
    completeOnboarding();
  };

  const completeOnboarding = async () => {
    await setOnboardingCompleted();
    onComplete?.();
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentPage(viewableItems[0].index ?? 0);
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const renderPage = ({ item, index }) => (
    <View style={[styles.page, { width: SCREEN_WIDTH }]}>
      <View style={[styles.iconContainer, { backgroundColor: item.bgGradient }]}>
        <View style={[styles.iconCircle, { backgroundColor: item.color + '20' }]}>
          <View style={[styles.iconInner, { backgroundColor: item.color + '30' }]}>
            <Ionicons name={item.icon} size={64} color={item.color} />
          </View>
        </View>
      </View>
      <Text style={styles.pageTitle}>{t(item.titleKey)}</Text>
      <Text style={styles.pageSubtitle}>{t(item.subtitleKey)}</Text>
    </View>
  );

  const isLastPage = currentPage === PAGES.length - 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <LinearGradient
        colors={['#1A0A2E', '#100620', '#08060F', '#08060F']}
        locations={[0, 0.18, 0.32, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.skipRow}>
        {!isLastPage ? (
          <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
            <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
          </TouchableOpacity>
        ) : (
          <View />
        )}
      </View>

      <FlatList
        ref={flatListRef}
        data={PAGES}
        renderItem={renderPage}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false },
        )}
      />

      <View style={styles.bottomSection}>
        <View style={styles.dotsContainer}>
          {PAGES.map((_, index) => {
            const inputRange = [
              (index - 1) * SCREEN_WIDTH,
              index * SCREEN_WIDTH,
              (index + 1) * SCREEN_WIDTH,
            ];

            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 24, 8],
              extrapolate: 'clamp',
            });

            const dotOpacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View
                key={index}
                style={[
                  styles.dot,
                  {
                    width: dotWidth,
                    opacity: dotOpacity,
                    backgroundColor: '#8B5CF6',
                  },
                ]}
              />
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.nextBtn, isLastPage && styles.getStartedBtn]}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          {isLastPage ? (
            <Text style={styles.getStartedText}>{t('onboarding.start')}</Text>
          ) : (
            <>
              <Text style={styles.nextText}>{t('onboarding.next')}</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  skipRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  skipBtn: { padding: 8 },
  skipText: { color: '#9CA3AF', fontSize: 16, fontWeight: '500' },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 48,
  },
  iconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  pageSubtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 24,
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: '100%',
  },
  getStartedBtn: {
    backgroundColor: '#10B981',
  },
  nextText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  getStartedText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
});
