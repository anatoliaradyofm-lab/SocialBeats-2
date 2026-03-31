/**
 * PhoneLoginScreen — WhatsApp OTP ile telefon girişi / kaydı
 * Adım 1: Telefon numarası gir → OTP gönder
 * Adım 2: 6 haneli kodu gir → doğrula
 * Adım 3 (yeni kullanıcı): Kullanıcı adı seç
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
  ActivityIndicator, Animated, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/api';

const COUNTRY_CODES = [
  { code: '+90',   flag: '🇹🇷', name: 'Türkiye',                          maxDigits: 10 },
  { code: '+93',   flag: '🇦🇫', name: 'Afghanistan',                      maxDigits: 9  },
  { code: '+355',  flag: '🇦🇱', name: 'Albania',                          maxDigits: 9  },
  { code: '+213',  flag: '🇩🇿', name: 'Algeria',                          maxDigits: 9  },
  { code: '+376',  flag: '🇦🇩', name: 'Andorra',                          maxDigits: 9  },
  { code: '+244',  flag: '🇦🇴', name: 'Angola',                           maxDigits: 9  },
  { code: '+1268', flag: '🇦🇬', name: 'Antigua and Barbuda',              maxDigits: 7  },
  { code: '+54',   flag: '🇦🇷', name: 'Argentina',                        maxDigits: 10 },
  { code: '+374',  flag: '🇦🇲', name: 'Armenia',                          maxDigits: 8  },
  { code: '+61',   flag: '🇦🇺', name: 'Australia',                        maxDigits: 9  },
  { code: '+43',   flag: '🇦🇹', name: 'Austria',                          maxDigits: 10 },
  { code: '+994',  flag: '🇦🇿', name: 'Azerbaijan',                       maxDigits: 9  },
  { code: '+1242', flag: '🇧🇸', name: 'Bahamas',                          maxDigits: 7  },
  { code: '+973',  flag: '🇧🇭', name: 'Bahrain',                          maxDigits: 8  },
  { code: '+880',  flag: '🇧🇩', name: 'Bangladesh',                       maxDigits: 10 },
  { code: '+1246', flag: '🇧🇧', name: 'Barbados',                         maxDigits: 7  },
  { code: '+375',  flag: '🇧🇾', name: 'Belarus',                          maxDigits: 9  },
  { code: '+32',   flag: '🇧🇪', name: 'Belgium',                          maxDigits: 9  },
  { code: '+501',  flag: '🇧🇿', name: 'Belize',                           maxDigits: 7  },
  { code: '+229',  flag: '🇧🇯', name: 'Benin',                            maxDigits: 8  },
  { code: '+975',  flag: '🇧🇹', name: 'Bhutan',                           maxDigits: 8  },
  { code: '+591',  flag: '🇧🇴', name: 'Bolivia',                          maxDigits: 8  },
  { code: '+387',  flag: '🇧🇦', name: 'Bosnia and Herzegovina',           maxDigits: 8  },
  { code: '+267',  flag: '🇧🇼', name: 'Botswana',                         maxDigits: 7  },
  { code: '+55',   flag: '🇧🇷', name: 'Brazil',                           maxDigits: 11 },
  { code: '+673',  flag: '🇧🇳', name: 'Brunei',                           maxDigits: 7  },
  { code: '+359',  flag: '🇧🇬', name: 'Bulgaria',                         maxDigits: 9  },
  { code: '+226',  flag: '🇧🇫', name: 'Burkina Faso',                     maxDigits: 8  },
  { code: '+257',  flag: '🇧🇮', name: 'Burundi',                          maxDigits: 8  },
  { code: '+855',  flag: '🇰🇭', name: 'Cambodia',                         maxDigits: 9  },
  { code: '+237',  flag: '🇨🇲', name: 'Cameroon',                         maxDigits: 9  },
  { code: '+1',    flag: '🇨🇦', name: 'Canada',                           maxDigits: 10 },
  { code: '+238',  flag: '🇨🇻', name: 'Cape Verde',                       maxDigits: 7  },
  { code: '+236',  flag: '🇨🇫', name: 'Central African Republic',         maxDigits: 8  },
  { code: '+235',  flag: '🇹🇩', name: 'Chad',                             maxDigits: 8  },
  { code: '+56',   flag: '🇨🇱', name: 'Chile',                            maxDigits: 9  },
  { code: '+86',   flag: '🇨🇳', name: 'China',                            maxDigits: 11 },
  { code: '+57',   flag: '🇨🇴', name: 'Colombia',                         maxDigits: 10 },
  { code: '+269',  flag: '🇰🇲', name: 'Comoros',                          maxDigits: 7  },
  { code: '+242',  flag: '🇨🇬', name: 'Congo',                            maxDigits: 9  },
  { code: '+243',  flag: '🇨🇩', name: 'Congo (DRC)',                      maxDigits: 9  },
  { code: '+682',  flag: '🇨🇰', name: 'Cook Islands',                     maxDigits: 5  },
  { code: '+506',  flag: '🇨🇷', name: 'Costa Rica',                       maxDigits: 8  },
  { code: '+225',  flag: '🇨🇮', name: "Côte d'Ivoire",                    maxDigits: 10 },
  { code: '+385',  flag: '🇭🇷', name: 'Croatia',                          maxDigits: 9  },
  { code: '+53',   flag: '🇨🇺', name: 'Cuba',                             maxDigits: 8  },
  { code: '+357',  flag: '🇨🇾', name: 'Cyprus',                           maxDigits: 8  },
  { code: '+420',  flag: '🇨🇿', name: 'Czech Republic',                   maxDigits: 9  },
  { code: '+45',   flag: '🇩🇰', name: 'Denmark',                          maxDigits: 8  },
  { code: '+253',  flag: '🇩🇯', name: 'Djibouti',                         maxDigits: 8  },
  { code: '+1767', flag: '🇩🇲', name: 'Dominica',                         maxDigits: 7  },
  { code: '+1809', flag: '🇩🇴', name: 'Dominican Republic',               maxDigits: 7  },
  { code: '+593',  flag: '🇪🇨', name: 'Ecuador',                          maxDigits: 9  },
  { code: '+20',   flag: '🇪🇬', name: 'Egypt',                            maxDigits: 10 },
  { code: '+503',  flag: '🇸🇻', name: 'El Salvador',                      maxDigits: 8  },
  { code: '+240',  flag: '🇬🇶', name: 'Equatorial Guinea',                maxDigits: 9  },
  { code: '+291',  flag: '🇪🇷', name: 'Eritrea',                          maxDigits: 7  },
  { code: '+372',  flag: '🇪🇪', name: 'Estonia',                          maxDigits: 8  },
  { code: '+268',  flag: '🇸🇿', name: 'Eswatini',                         maxDigits: 7  },
  { code: '+251',  flag: '🇪🇹', name: 'Ethiopia',                         maxDigits: 9  },
  { code: '+679',  flag: '🇫🇯', name: 'Fiji',                             maxDigits: 7  },
  { code: '+358',  flag: '🇫🇮', name: 'Finland',                          maxDigits: 9  },
  { code: '+33',   flag: '🇫🇷', name: 'France',                           maxDigits: 9  },
  { code: '+241',  flag: '🇬🇦', name: 'Gabon',                            maxDigits: 8  },
  { code: '+220',  flag: '🇬🇲', name: 'Gambia',                           maxDigits: 7  },
  { code: '+995',  flag: '🇬🇪', name: 'Georgia',                          maxDigits: 9  },
  { code: '+49',   flag: '🇩🇪', name: 'Germany',                          maxDigits: 11 },
  { code: '+233',  flag: '🇬🇭', name: 'Ghana',                            maxDigits: 9  },
  { code: '+30',   flag: '🇬🇷', name: 'Greece',                           maxDigits: 10 },
  { code: '+1473', flag: '🇬🇩', name: 'Grenada',                          maxDigits: 7  },
  { code: '+502',  flag: '🇬🇹', name: 'Guatemala',                        maxDigits: 8  },
  { code: '+224',  flag: '🇬🇳', name: 'Guinea',                           maxDigits: 9  },
  { code: '+245',  flag: '🇬🇼', name: 'Guinea-Bissau',                    maxDigits: 7  },
  { code: '+592',  flag: '🇬🇾', name: 'Guyana',                           maxDigits: 7  },
  { code: '+509',  flag: '🇭🇹', name: 'Haiti',                            maxDigits: 8  },
  { code: '+379',  flag: '🇻🇦', name: 'Holy See (Vatican)',                maxDigits: 10 },
  { code: '+504',  flag: '🇭🇳', name: 'Honduras',                         maxDigits: 8  },
  { code: '+36',   flag: '🇭🇺', name: 'Hungary',                          maxDigits: 9  },
  { code: '+354',  flag: '🇮🇸', name: 'Iceland',                          maxDigits: 7  },
  { code: '+91',   flag: '🇮🇳', name: 'India',                            maxDigits: 10 },
  { code: '+62',   flag: '🇮🇩', name: 'Indonesia',                        maxDigits: 12 },
  { code: '+98',   flag: '🇮🇷', name: 'Iran',                             maxDigits: 10 },
  { code: '+964',  flag: '🇮🇶', name: 'Iraq',                             maxDigits: 10 },
  { code: '+353',  flag: '🇮🇪', name: 'Ireland',                          maxDigits: 9  },
  { code: '+972',  flag: '🇮🇱', name: 'Israel',                           maxDigits: 9  },
  { code: '+39',   flag: '🇮🇹', name: 'Italy',                            maxDigits: 10 },
  { code: '+1876', flag: '🇯🇲', name: 'Jamaica',                          maxDigits: 7  },
  { code: '+81',   flag: '🇯🇵', name: 'Japan',                            maxDigits: 10 },
  { code: '+962',  flag: '🇯🇴', name: 'Jordan',                           maxDigits: 9  },
  { code: '+7',    flag: '🇰🇿', name: 'Kazakhstan',                       maxDigits: 10 },
  { code: '+254',  flag: '🇰🇪', name: 'Kenya',                            maxDigits: 10 },
  { code: '+686',  flag: '🇰🇮', name: 'Kiribati',                         maxDigits: 8  },
  { code: '+383',  flag: '🇽🇰', name: 'Kosovo',                           maxDigits: 8  },
  { code: '+965',  flag: '🇰🇼', name: 'Kuwait',                           maxDigits: 8  },
  { code: '+996',  flag: '🇰🇬', name: 'Kyrgyzstan',                       maxDigits: 9  },
  { code: '+856',  flag: '🇱🇦', name: 'Laos',                             maxDigits: 9  },
  { code: '+371',  flag: '🇱🇻', name: 'Latvia',                           maxDigits: 8  },
  { code: '+961',  flag: '🇱🇧', name: 'Lebanon',                          maxDigits: 8  },
  { code: '+266',  flag: '🇱🇸', name: 'Lesotho',                          maxDigits: 8  },
  { code: '+231',  flag: '🇱🇷', name: 'Liberia',                          maxDigits: 8  },
  { code: '+218',  flag: '🇱🇾', name: 'Libya',                            maxDigits: 10 },
  { code: '+423',  flag: '🇱🇮', name: 'Liechtenstein',                    maxDigits: 9  },
  { code: '+370',  flag: '🇱🇹', name: 'Lithuania',                        maxDigits: 8  },
  { code: '+352',  flag: '🇱🇺', name: 'Luxembourg',                       maxDigits: 9  },
  { code: '+261',  flag: '🇲🇬', name: 'Madagascar',                       maxDigits: 9  },
  { code: '+265',  flag: '🇲🇼', name: 'Malawi',                           maxDigits: 9  },
  { code: '+60',   flag: '🇲🇾', name: 'Malaysia',                         maxDigits: 10 },
  { code: '+960',  flag: '🇲🇻', name: 'Maldives',                         maxDigits: 7  },
  { code: '+223',  flag: '🇲🇱', name: 'Mali',                             maxDigits: 8  },
  { code: '+356',  flag: '🇲🇹', name: 'Malta',                            maxDigits: 8  },
  { code: '+692',  flag: '🇲🇭', name: 'Marshall Islands',                 maxDigits: 7  },
  { code: '+222',  flag: '🇲🇷', name: 'Mauritania',                       maxDigits: 8  },
  { code: '+230',  flag: '🇲🇺', name: 'Mauritius',                        maxDigits: 8  },
  { code: '+52',   flag: '🇲🇽', name: 'Mexico',                           maxDigits: 10 },
  { code: '+691',  flag: '🇫🇲', name: 'Micronesia',                       maxDigits: 7  },
  { code: '+373',  flag: '🇲🇩', name: 'Moldova',                          maxDigits: 8  },
  { code: '+377',  flag: '🇲🇨', name: 'Monaco',                           maxDigits: 9  },
  { code: '+976',  flag: '🇲🇳', name: 'Mongolia',                         maxDigits: 8  },
  { code: '+382',  flag: '🇲🇪', name: 'Montenegro',                       maxDigits: 8  },
  { code: '+212',  flag: '🇲🇦', name: 'Morocco',                          maxDigits: 9  },
  { code: '+258',  flag: '🇲🇿', name: 'Mozambique',                       maxDigits: 9  },
  { code: '+95',   flag: '🇲🇲', name: 'Myanmar',                          maxDigits: 9  },
  { code: '+264',  flag: '🇳🇦', name: 'Namibia',                          maxDigits: 9  },
  { code: '+674',  flag: '🇳🇷', name: 'Nauru',                            maxDigits: 7  },
  { code: '+977',  flag: '🇳🇵', name: 'Nepal',                            maxDigits: 10 },
  { code: '+31',   flag: '🇳🇱', name: 'Netherlands',                      maxDigits: 9  },
  { code: '+64',   flag: '🇳🇿', name: 'New Zealand',                      maxDigits: 9  },
  { code: '+505',  flag: '🇳🇮', name: 'Nicaragua',                        maxDigits: 8  },
  { code: '+227',  flag: '🇳🇪', name: 'Niger',                            maxDigits: 8  },
  { code: '+234',  flag: '🇳🇬', name: 'Nigeria',                          maxDigits: 10 },
  { code: '+850',  flag: '🇰🇵', name: 'North Korea',                      maxDigits: 10 },
  { code: '+389',  flag: '🇲🇰', name: 'North Macedonia',                  maxDigits: 8  },
  { code: '+47',   flag: '🇳🇴', name: 'Norway',                           maxDigits: 8  },
  { code: '+968',  flag: '🇴🇲', name: 'Oman',                             maxDigits: 8  },
  { code: '+92',   flag: '🇵🇰', name: 'Pakistan',                         maxDigits: 10 },
  { code: '+680',  flag: '🇵🇼', name: 'Palau',                            maxDigits: 7  },
  { code: '+970',  flag: '🇵🇸', name: 'Palestine',                        maxDigits: 9  },
  { code: '+507',  flag: '🇵🇦', name: 'Panama',                           maxDigits: 8  },
  { code: '+675',  flag: '🇵🇬', name: 'Papua New Guinea',                 maxDigits: 8  },
  { code: '+595',  flag: '🇵🇾', name: 'Paraguay',                         maxDigits: 9  },
  { code: '+51',   flag: '🇵🇪', name: 'Peru',                             maxDigits: 9  },
  { code: '+63',   flag: '🇵🇭', name: 'Philippines',                      maxDigits: 10 },
  { code: '+48',   flag: '🇵🇱', name: 'Poland',                           maxDigits: 9  },
  { code: '+351',  flag: '🇵🇹', name: 'Portugal',                         maxDigits: 9  },
  { code: '+974',  flag: '🇶🇦', name: 'Qatar',                            maxDigits: 8  },
  { code: '+40',   flag: '🇷🇴', name: 'Romania',                          maxDigits: 9  },
  { code: '+7',    flag: '🇷🇺', name: 'Russia',                           maxDigits: 10 },
  { code: '+250',  flag: '🇷🇼', name: 'Rwanda',                           maxDigits: 9  },
  { code: '+1869', flag: '🇰🇳', name: 'Saint Kitts and Nevis',            maxDigits: 7  },
  { code: '+1758', flag: '🇱🇨', name: 'Saint Lucia',                      maxDigits: 7  },
  { code: '+1784', flag: '🇻🇨', name: 'Saint Vincent and the Grenadines', maxDigits: 7  },
  { code: '+685',  flag: '🇼🇸', name: 'Samoa',                            maxDigits: 7  },
  { code: '+378',  flag: '🇸🇲', name: 'San Marino',                       maxDigits: 10 },
  { code: '+239',  flag: '🇸🇹', name: 'São Tomé and Príncipe',            maxDigits: 7  },
  { code: '+966',  flag: '🇸🇦', name: 'Saudi Arabia',                     maxDigits: 9  },
  { code: '+221',  flag: '🇸🇳', name: 'Senegal',                          maxDigits: 9  },
  { code: '+381',  flag: '🇷🇸', name: 'Serbia',                           maxDigits: 9  },
  { code: '+248',  flag: '🇸🇨', name: 'Seychelles',                       maxDigits: 7  },
  { code: '+232',  flag: '🇸🇱', name: 'Sierra Leone',                     maxDigits: 8  },
  { code: '+65',   flag: '🇸🇬', name: 'Singapore',                        maxDigits: 8  },
  { code: '+421',  flag: '🇸🇰', name: 'Slovakia',                         maxDigits: 9  },
  { code: '+386',  flag: '🇸🇮', name: 'Slovenia',                         maxDigits: 8  },
  { code: '+677',  flag: '🇸🇧', name: 'Solomon Islands',                  maxDigits: 7  },
  { code: '+252',  flag: '🇸🇴', name: 'Somalia',                          maxDigits: 8  },
  { code: '+27',   flag: '🇿🇦', name: 'South Africa',                     maxDigits: 9  },
  { code: '+82',   flag: '🇰🇷', name: 'South Korea',                      maxDigits: 10 },
  { code: '+211',  flag: '🇸🇸', name: 'South Sudan',                      maxDigits: 9  },
  { code: '+34',   flag: '🇪🇸', name: 'Spain',                            maxDigits: 9  },
  { code: '+94',   flag: '🇱🇰', name: 'Sri Lanka',                        maxDigits: 9  },
  { code: '+249',  flag: '🇸🇩', name: 'Sudan',                            maxDigits: 9  },
  { code: '+597',  flag: '🇸🇷', name: 'Suriname',                         maxDigits: 7  },
  { code: '+46',   flag: '🇸🇪', name: 'Sweden',                           maxDigits: 9  },
  { code: '+41',   flag: '🇨🇭', name: 'Switzerland',                      maxDigits: 9  },
  { code: '+963',  flag: '🇸🇾', name: 'Syria',                            maxDigits: 9  },
  { code: '+886',  flag: '🇹🇼', name: 'Taiwan',                           maxDigits: 9  },
  { code: '+992',  flag: '🇹🇯', name: 'Tajikistan',                       maxDigits: 9  },
  { code: '+255',  flag: '🇹🇿', name: 'Tanzania',                         maxDigits: 9  },
  { code: '+66',   flag: '🇹🇭', name: 'Thailand',                         maxDigits: 9  },
  { code: '+670',  flag: '🇹🇱', name: 'Timor-Leste',                      maxDigits: 8  },
  { code: '+228',  flag: '🇹🇬', name: 'Togo',                             maxDigits: 8  },
  { code: '+676',  flag: '🇹🇴', name: 'Tonga',                            maxDigits: 7  },
  { code: '+1868', flag: '🇹🇹', name: 'Trinidad and Tobago',              maxDigits: 7  },
  { code: '+216',  flag: '🇹🇳', name: 'Tunisia',                          maxDigits: 8  },
  { code: '+993',  flag: '🇹🇲', name: 'Turkmenistan',                     maxDigits: 8  },
  { code: '+688',  flag: '🇹🇻', name: 'Tuvalu',                           maxDigits: 7  },
  { code: '+256',  flag: '🇺🇬', name: 'Uganda',                           maxDigits: 9  },
  { code: '+380',  flag: '🇺🇦', name: 'Ukraine',                          maxDigits: 9  },
  { code: '+971',  flag: '🇦🇪', name: 'United Arab Emirates',             maxDigits: 9  },
  { code: '+44',   flag: '🇬🇧', name: 'United Kingdom',                   maxDigits: 10 },
  { code: '+1',    flag: '🇺🇸', name: 'United States',                    maxDigits: 10 },
  { code: '+598',  flag: '🇺🇾', name: 'Uruguay',                          maxDigits: 8  },
  { code: '+998',  flag: '🇺🇿', name: 'Uzbekistan',                       maxDigits: 9  },
  { code: '+678',  flag: '🇻🇺', name: 'Vanuatu',                          maxDigits: 7  },
  { code: '+58',   flag: '🇻🇪', name: 'Venezuela',                        maxDigits: 10 },
  { code: '+84',   flag: '🇻🇳', name: 'Vietnam',                          maxDigits: 9  },
  { code: '+967',  flag: '🇾🇪', name: 'Yemen',                            maxDigits: 9  },
  { code: '+260',  flag: '🇿🇲', name: 'Zambia',                           maxDigits: 9  },
  { code: '+263',  flag: '🇿🇼', name: 'Zimbabwe',                         maxDigits: 9  },
];

export default function PhoneLoginScreen({ navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { loginWithToken, loginAsGuest } = useAuth();

  const handleGuest = async () => {
    await loginAsGuest();
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  };

  const [step, setStep]           = useState(1); // 1=phone, 2=otp, 3=username
  const [countryCode, setCC]      = useState('+90');
  const [showCC, setShowCC]       = useState(false);
  const [phone, setPhone]         = useState('');
  const [otp, setOtp]             = useState('');
  const [username, setUsername]   = useState('');
  const [displayName, setDisplay] = useState('');
  const [loading, setLoading]     = useState(false);
  const [countdown, setCountdown] = useState(0);

  const otpRef  = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [step]);

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  const fullPhone = countryCode + phone.replace(/\s/g, '');

  const sendOtp = async () => {
    if (phone.replace(/\D/g, '').length < 7) {
      Alert.alert('Hata', 'Geçerli bir telefon numarası girin');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/phone/send-otp', { phone: fullPhone });
      setStep(2);
      setCountdown(60);
      setTimeout(() => otpRef.current?.focus(), 300);
    } catch (err) {
      const msg = err?.data?.detail || err?.message || 'Kod gönderilemedi';
      Alert.alert('Hata', msg);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (usernameOverride) => {
    const finalUsername = usernameOverride || username;
    if (otp.length < 6) {
      Alert.alert('Hata', '6 haneli kodu girin');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/phone/verify', {
        phone: fullPhone,
        code: otp.trim(),
        username: finalUsername || undefined,
        display_name: displayName || undefined,
      });
      if (res?.access_token || res?.token) {
        await loginWithToken?.(res.access_token || res.token, res.user);
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      }
    } catch (err) {
      const detail = err?.data?.detail || err?.message || '';
      // Backend: yeni kullanıcı için kullanıcı adı gerekli
      if (err?.status === 422 || detail.includes('kullanıcı adı') || detail.includes('username')) {
        setStep(3);
      } else {
        Alert.alert('Hata', detail || 'Doğrulama başarısız');
      }
    } finally {
      setLoading(false);
    }
  };

  const submitUsername = () => {
    if (username.trim().length < 3) {
      Alert.alert('Hata', 'Kullanıcı adı en az 3 karakter olmalı');
      return;
    }
    verifyOtp(username.trim());
  };

  const s = createStyles(colors, insets);

  return (
    <View style={s.root}>
      <LinearGradient
        colors={colors.authBgGrad || ['#1A0A2E', '#100620', '#08060F']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[s.orb, s.orb1, { backgroundColor: (colors.primary || '#C084FC') + '40' }]} />
      <View style={[s.orb, s.orb2, { backgroundColor: '#3B82F640' }]} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Header */}
          <TouchableOpacity style={s.backBtn} onPress={() => step > 1 ? setStep(s => s - 1) : navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <Animated.View style={[s.inner, { opacity: fadeAnim }]}>

            {/* Logo */}
            <View style={s.logoWrap}>
              <LinearGradient colors={colors.gradPrimary || ['#8B5CF6', '#C084FC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.logoIcon}>
                <Ionicons name="logo-whatsapp" size={32} color="#FFF" />
              </LinearGradient>
              <Text style={[s.logoText, { color: colors.text }]}>WhatsApp ile Giriş</Text>
              <Text style={[s.logoSub, { color: colors.textMuted }]}>
                {step === 1 ? 'Telefon numaranı gir' : step === 2 ? `${fullPhone} numarasına kod gönderildi` : 'Kullanıcı adını seç'}
              </Text>
            </View>

            {/* Card */}
            <View style={[s.card, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>

              {/* Step 1: Phone */}
              {step === 1 && (
                <>
                  <Text style={[s.cardTitle, { color: colors.text }]}>Telefon Numarası</Text>

                  {/* Country code picker */}
                  <TouchableOpacity
                    style={[s.ccRow, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                    onPress={() => setShowCC(v => !v)}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.ccText, { color: colors.text }]}>
                      {COUNTRY_CODES.find(c => c.code === countryCode)?.flag} {countryCode}
                    </Text>
                    <Ionicons name={showCC ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                  </TouchableOpacity>

                  {showCC && (
                    <View style={[s.ccDropdown, { backgroundColor: colors.card, borderColor: colors.glassBorder }]}>
                      <FlatList
                        data={COUNTRY_CODES}
                        keyExtractor={c => c.code + c.name}
                        style={{ maxHeight: 220 }}
                        nestedScrollEnabled
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item: c }) => (
                          <TouchableOpacity
                            style={[s.ccOption, { flexDirection: 'row', alignItems: 'center' }]}
                            onPress={() => { setCC(c.code); setPhone(''); setShowCC(false); }}
                          >
                            <Text style={{ width: 30, fontSize: 18 }}>{c.flag}</Text>
                            <Text style={[s.ccOptionText, { flex: 1, color: colors.text }]}>{c.name}</Text>
                            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{c.code}</Text>
                          </TouchableOpacity>
                        )}
                      />
                    </View>
                  )}

                  <View style={[s.inputRow, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                    <Ionicons name="call-outline" size={18} color={colors.textMuted} />
                    <TextInput
                      style={[s.input, { color: colors.text }]}
                      value={phone}
                      onChangeText={v => setPhone(v.replace(/\D/g, '').slice(0, COUNTRY_CODES.find(c => c.code === countryCode)?.maxDigits ?? 10))}
                      placeholder={Array(COUNTRY_CODES.find(c => c.code === countryCode)?.maxDigits ?? 10).fill('X').join('')}
                      placeholderTextColor={colors.textGhost}
                      keyboardType="phone-pad"
                      maxLength={COUNTRY_CODES.find(c => c.code === countryCode)?.maxDigits ?? 10}
                      returnKeyType="done"
                      onSubmitEditing={sendOtp}
                    />
                  </View>

                  <TouchableOpacity
                    style={[s.btnWrap, loading && { opacity: 0.7 }]}
                    onPress={sendOtp}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    <LinearGradient colors={colors.gradPrimary || ['#8B5CF6', '#C084FC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.btn}>
                      {loading ? <ActivityIndicator color="#FFF" /> : <Text style={s.btnText}>Kod Gönder</Text>}
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => navigation.navigate('Register')} style={s.forgotBtn}>
                    <Text style={[s.forgotText, { color: colors.textMuted }]}>
                      Hesabın yok mu? <Text style={{ color: colors.primary }}>Kayıt Ol</Text>
                    </Text>
                  </TouchableOpacity>

                  <View style={s.dividerRow}>
                    <View style={[s.dividerLine, { backgroundColor: colors.border }]} />
                    <Text style={[s.dividerText, { color: colors.textGhost }]}>veya</Text>
                    <View style={[s.dividerLine, { backgroundColor: colors.border }]} />
                  </View>
                  <TouchableOpacity style={[s.guestBtn, { borderColor: colors.glassBorder }]} onPress={handleGuest} activeOpacity={0.75}>
                    <Ionicons name="person-outline" size={17} color={colors.textMuted} />
                    <Text style={[s.guestText, { color: colors.textMuted }]}>Misafir olarak devam et</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Step 2: OTP */}
              {step === 2 && (
                <>
                  <Text style={[s.cardTitle, { color: colors.text }]}>Doğrulama Kodu</Text>
                  <Text style={[s.cardSub, { color: colors.textMuted }]}>
                    WhatsApp'a gönderilen 6 haneli kodu girin
                  </Text>

                  {/* 6-kutu OTP input */}
                  <TouchableOpacity onPress={() => otpRef.current?.focus()} activeOpacity={1} style={s.otpWrap}>
                    <View style={s.otpRow} pointerEvents="none">
                      {[0,1,2,3,4,5].map(i => (
                        <View key={i} style={[s.otpBox, {
                          backgroundColor: colors.inputBg,
                          borderColor: otp.length === i ? colors.primary : otp[i] ? colors.primary + '88' : colors.inputBorder,
                        }]}>
                          <Text style={[s.otpDigit, { color: colors.text }]}>{otp[i] || ''}</Text>
                        </View>
                      ))}
                    </View>
                    <TextInput
                      ref={otpRef}
                      value={otp}
                      onChangeText={v => setOtp(v.replace(/\D/g, '').slice(0, 6))}
                      keyboardType="number-pad"
                      maxLength={6}
                      style={s.otpHidden}
                      caretHidden
                      onSubmitEditing={() => verifyOtp()}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.btnWrap, (loading || otp.length < 6) && { opacity: 0.6 }]}
                    onPress={() => verifyOtp()}
                    disabled={loading || otp.length < 6}
                    activeOpacity={0.85}
                  >
                    <LinearGradient colors={colors.gradPrimary || ['#8B5CF6', '#C084FC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.btn}>
                      {loading ? <ActivityIndicator color="#FFF" /> : <Text style={s.btnText}>Doğrula</Text>}
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={s.resendBtn}
                    onPress={countdown === 0 ? sendOtp : undefined}
                    disabled={countdown > 0}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.resendText, { color: countdown > 0 ? colors.textGhost : colors.primary }]}>
                      {countdown > 0 ? `Tekrar gönder (${countdown}s)` : 'Tekrar gönder'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Step 3: Username (new user) */}
              {step === 3 && (
                <>
                  <Text style={[s.cardTitle, { color: colors.text }]}>Kullanıcı Adı</Text>
                  <Text style={[s.cardSub, { color: colors.textMuted }]}>
                    İlk girişin! Kendine bir kullanıcı adı seç.
                  </Text>

                  <View style={[s.inputRow, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                    <Ionicons name="at-outline" size={18} color={colors.textMuted} />
                    <TextInput
                      style={[s.input, { color: colors.text }]}
                      value={username}
                      onChangeText={v => setUsername(v.replace(/[^a-z0-9_.]/g, '').toLowerCase())}
                      placeholder="kullanıcı_adı"
                      placeholderTextColor={colors.textGhost}
                      autoCapitalize="none"
                      returnKeyType="next"
                    />
                  </View>

                  <View style={[s.inputRow, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, marginTop: 8 }]}>
                    <Ionicons name="person-outline" size={18} color={colors.textMuted} />
                    <TextInput
                      style={[s.input, { color: colors.text }]}
                      value={displayName}
                      onChangeText={setDisplay}
                      placeholder="Görünen Ad (isteğe bağlı)"
                      placeholderTextColor={colors.textGhost}
                    />
                  </View>

                  <TouchableOpacity
                    style={[s.btnWrap, (loading || username.length < 3) && { opacity: 0.6 }]}
                    onPress={submitUsername}
                    disabled={loading || username.length < 3}
                    activeOpacity={0.85}
                  >
                    <LinearGradient colors={colors.gradPrimary || ['#8B5CF6', '#C084FC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.btn}>
                      {loading ? <ActivityIndicator color="#FFF" /> : <Text style={s.btnText}>Hesap Oluştur</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}

            </View>


          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function createStyles(colors, insets) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    orb: { position: 'absolute', borderRadius: 999, opacity: 0.4 },
    orb1: { width: 260, height: 260, top: -60, right: -60 },
    orb2: { width: 180, height: 180, bottom: 120, left: -70 },
    scroll: {
      flexGrow: 1,
      paddingHorizontal: 20,
      paddingTop: insets.top + 16,
      paddingBottom: insets.bottom + 32,
    },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    inner: { gap: 24 },
    logoWrap: { alignItems: 'center', gap: 10 },
    logoIcon: { width: 70, height: 70, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    logoText: { fontSize: 26, fontWeight: '900', letterSpacing: -0.8 },
    logoSub: { fontSize: 13, letterSpacing: 0.2, textAlign: 'center' },
    card: { borderRadius: 28, borderWidth: 1, padding: 24, gap: 8 },
    cardTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
    cardSub: { fontSize: 13, lineHeight: 19, marginBottom: 8 },
    ccRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12,
      marginBottom: 8,
    },
    ccText: { fontSize: 15, fontWeight: '600' },
    ccDropdown: {
      borderRadius: 14, borderWidth: 1, marginBottom: 8,
    },
    ccOption: { paddingVertical: 12, paddingHorizontal: 16 },
    ccOptionText: { fontSize: 14 },
    inputRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      borderRadius: 14, borderWidth: 1,
      paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    },
    input: { flex: 1, fontSize: 15 },
    otpWrap: { position: 'relative', marginVertical: 8 },
    otpRow: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
    otpBox: { width: 48, height: 58, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    otpDigit: { fontSize: 24, fontWeight: '800' },
    otpHidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
    btnWrap: { marginTop: 8 },
    btn: { height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    btnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
    resendBtn: { alignItems: 'center', paddingVertical: 10 },
    resendText: { fontSize: 13, fontWeight: '600' },
    footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    footerText: { fontSize: 14 },
    footerLink: { fontSize: 14, fontWeight: '700' },
    forgotBtn: { alignItems: 'center', marginTop: 14 },
    forgotText: { fontSize: 13 },
    dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, marginBottom: 4 },
    dividerLine: { flex: 1, height: 1 },
    dividerText: { fontSize: 12, fontWeight: '500' },
    guestBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 14, borderWidth: 1, marginTop: 8 },
    guestText: { fontSize: 14, fontWeight: '500' },
  });
}
