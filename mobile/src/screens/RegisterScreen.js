/**
 * RegisterScreen — WhatsApp OTP ile yeni hesap oluşturma
 * Adım 1: Kullanıcı adı, görünen ad, ülke, cinsiyet, WhatsApp no
 * Adım 2: 6-haneli OTP doğrulama
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView,
  Platform, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/api';
import { COUNTRIES as WORLD_COUNTRIES } from '../lib/countries';
import { Alert } from '../components/ui/AppAlert';
import { getLocale } from '../lib/localeStore';

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

// Ülke listesi lib/countries.js'den geliyor (DiscoverPeople ile aynı)

const GENDERS = [
  { value: 'male',   label: 'Erkek', icon: 'male' },
  { value: 'female', label: 'Kadın', icon: 'female' },
];

export default function RegisterScreen({ navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { loginWithToken } = useAuth();

  const [step, setStep]           = useState(1);
  const [username, setUsername]   = useState('');
  const [displayName, setDisplay] = useState('');
  const [country, setCountry]     = useState('');
  const [gender, setGender]       = useState('');
  const [countryCode, setCC]      = useState('+90');
  const [phone, setPhone]         = useState('');
  const [otp, setOtp]             = useState('');
  const [loading, setLoading]     = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showCC, setShowCC]       = useState(false);
  const [showCountry, setShowCountry] = useState(false);

  const otpRef   = useRef(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef(null);

  // Cihaz locale'inden ülke ve telefon kodu otomatik doldur
  useEffect(() => {
    const { countryCode: cc } = getLocale();
    if (!cc || cc === 'US') return; // US default, manuel seçim bırak
    const matched = WORLD_COUNTRIES.find(c => c.code === cc);
    if (matched) {
      setCountry(matched.name);
      const phoneEntry = COUNTRY_CODES.find(c => c.name === matched.name);
      if (phoneEntry) setCC(phoneEntry.code);
    }
  }, []);

  useEffect(() => () => clearInterval(timerRef.current), []);

  function animateStep(next) {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setStep(next), 120);
  }

  function startCountdown() {
    clearInterval(timerRef.current);
    setCountdown(60);
    timerRef.current = setInterval(() => {
      setCountdown(c => { if (c <= 1) { clearInterval(timerRef.current); return 0; } return c - 1; });
    }, 1000);
  }

  const fullPhone = countryCode + phone.replace(/\D/g, '');

  async function handleSendOtp() {
    if (username.trim().length < 3) {
      Alert.alert('Hata', 'Kullanıcı adı en az 3 karakter olmalı');
      return;
    }
    if (!/^[a-z0-9_.]+$/.test(username)) {
      Alert.alert('Hata', 'Kullanıcı adı sadece harf, rakam, _ ve . içerebilir');
      return;
    }
    if (!displayName.trim()) {
      Alert.alert('Hata', 'Görünen adını girin');
      return;
    }
    if (!country) {
      Alert.alert('Hata', 'Ülke seçin');
      return;
    }
    if (!gender) {
      Alert.alert('Hata', 'Cinsiyet seçin');
      return;
    }
    if (phone.replace(/\D/g, '').length < 7) {
      Alert.alert('Hata', 'Geçerli bir WhatsApp numarası girin');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/phone/send-otp', { phone: fullPhone });
      startCountdown();
      animateStep(2);
      setTimeout(() => otpRef.current?.focus(), 400);
    } catch (err) {
      const msg = err?.data?.detail || err?.message || 'Kod gönderilemedi';
      Alert.alert('Hata', typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (otp.length !== 6) {
      Alert.alert('Hata', '6 haneli kodu girin');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/phone/verify', {
        phone: fullPhone,
        code: otp,
        username: username.trim(),
        display_name: displayName.trim(),
        country,
        gender,
      });
      if (res?.access_token || res?.token) {
        // Persist country selection so LanguageRegionScreen & ProfileEditScreen stay in sync
        if (country) { try { localStorage.setItem('sb_country', country); } catch {} }
        await loginWithToken(res.access_token || res.token, res.user);
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      }
    } catch (err) {
      const msg = err?.data?.detail || err?.message || 'Doğrulama başarısız';
      Alert.alert('Hata', typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (countdown > 0) return;
    setLoading(true);
    try {
      await api.post('/auth/phone/send-otp', { phone: fullPhone });
      startCountdown();
      setOtp('');
    } catch (err) {
      const msg = err?.data?.detail || err?.message || 'Gönderilemedi';
      Alert.alert('Hata', typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  }

  const s = createStyles(colors);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={colors.authBgGrad || ['#1A0A2E', '#100620', '#08060F', '#08060F']}
        locations={[0, 0.15, 0.35, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[s.orb, s.orb1, { backgroundColor: (colors.primary || '#C084FC') + '30' }]} />
      <View style={[s.orb, s.orb2, { backgroundColor: '#FB923C30' }]} />

      {/* Header */}
      <View style={s.header}>
        {step > 1 ? (
          <TouchableOpacity onPress={() => animateStep(1)} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
        ) : navigation.canGoBack() ? (
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
        <Text style={[s.headerTitle, { color: colors.text }]}>Hesap Oluştur</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress */}
      <View style={s.progress}>
        {[1, 2].map(i => (
          <View key={i} style={[s.dot, { backgroundColor: step >= i ? colors.primary : 'rgba(255,255,255,0.15)', width: step === i ? 28 : 8 }]} />
        ))}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: fadeAnim }}>

            {/* ─── STEP 1: Form ─── */}
            {step === 1 && (
              <View style={s.card}>
                {/* Logo */}
                <View style={s.logoRow}>
                  <LinearGradient colors={colors.gradPrimary || ['#7C3AED', '#C084FC']} style={s.logoIcon}>
                    <Ionicons name="logo-whatsapp" size={28} color="#fff" />
                  </LinearGradient>
                  <Text style={[s.logoText, { color: colors.text }]}>Kayıt Ol</Text>
                  <Text style={[s.logoSub, { color: colors.textMuted }]}>WhatsApp ile yeni hesap oluştur</Text>
                </View>

                {/* Username */}
                <Text style={[s.label, { color: colors.textMuted }]}>Kullanıcı Adı</Text>
                <View style={[s.inputRow, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                  <Ionicons name="at-outline" size={18} color={colors.textMuted} />
                  <TextInput
                    style={[s.input, { color: colors.text }]}
                    value={username}
                    onChangeText={v => setUsername(v.replace(/[^a-z0-9_.]/g, '').toLowerCase())}
                    placeholder="kullanici_adi"
                    placeholderTextColor={colors.textGhost}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                {/* Display Name */}
                <Text style={[s.label, { color: colors.textMuted }]}>Görünen Ad</Text>
                <View style={[s.inputRow, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                  <Ionicons name="person-outline" size={18} color={colors.textMuted} />
                  <TextInput
                    style={[s.input, { color: colors.text }]}
                    value={displayName}
                    onChangeText={setDisplay}
                    placeholder="Adın Soyadın"
                    placeholderTextColor={colors.textGhost}
                  />
                </View>

                {/* Country */}
                <Text style={[s.label, { color: colors.textMuted }]}>Ülke</Text>
                <TouchableOpacity
                  style={[s.inputRow, s.selectRow, { backgroundColor: colors.inputBg, borderColor: showCountry ? colors.primary : colors.inputBorder }]}
                  onPress={() => { setShowCountry(p => !p); setShowCC(false); }}
                >
                  <Ionicons name="globe-outline" size={18} color={colors.textMuted} />
                  <Text style={[s.selectText, { color: country ? colors.text : colors.textGhost }]}>
                    {country ? `${WORLD_COUNTRIES.find(c => c.name === country)?.flag ?? ''} ${country}` : 'Ülke seçin'}
                  </Text>
                  <Ionicons name={showCountry ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                </TouchableOpacity>
                {showCountry && (
                  <View style={[s.dropdown, { backgroundColor: colors.card, borderColor: colors.glassBorder }]}>
                    <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ maxHeight: 220 }}>
                      {WORLD_COUNTRIES.map(c => (
                        <TouchableOpacity key={c.code} style={[s.dropItem, { flexDirection: 'row', alignItems: 'center' }]} onPress={() => { setCountry(c.name); setShowCountry(false); }}>
                          <Text style={{ width: 32, fontSize: 20 }}>{c.flag}</Text>
                          <Text style={[s.dropText, { flex: 1, color: country === c.name ? colors.primary : colors.text }]}>{c.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Gender */}
                <Text style={[s.label, { color: colors.textMuted }]}>Cinsiyet</Text>
                <View style={s.genderRow}>
                  {GENDERS.map(g => (
                    <TouchableOpacity
                      key={g.value}
                      style={[s.genderBtn, {
                        backgroundColor: gender === g.value ? colors.primary + '22' : colors.inputBg,
                        borderColor: gender === g.value ? colors.primary : colors.inputBorder,
                      }]}
                      onPress={() => setGender(g.value)}
                    >
                      <Ionicons name={g.icon} size={16} color={gender === g.value ? colors.primary : colors.textMuted} />
                      <Text style={[s.genderText, { color: gender === g.value ? colors.primary : colors.textMuted }]}>{g.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Phone */}
                <Text style={[s.label, { color: colors.textMuted }]}>WhatsApp Numarası</Text>
                <View style={s.phoneRow}>
                  <TouchableOpacity
                    style={[s.ccBtn, { backgroundColor: colors.inputBg, borderColor: showCC ? colors.primary : colors.inputBorder }]}
                    onPress={() => { setShowCC(p => !p); setShowCountry(false); }}
                  >
                    <Text style={[s.ccText, { color: colors.text }]}>
                      {COUNTRY_CODES.find(c => c.code === countryCode)?.flag} {countryCode}
                    </Text>
                    <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
                  </TouchableOpacity>
                  <View style={[s.inputRow, { flex: 1, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                    <TextInput
                      style={[s.input, { color: colors.text }]}
                      value={phone}
                      onChangeText={v => {
                        const digits = v.replace(/\D/g, '');
                        const max = COUNTRY_CODES.find(c => c.code === countryCode)?.maxDigits ?? 10;
                        setPhone(digits.slice(0, max));
                      }}
                      placeholder="5XX XXX XX XX"
                      placeholderTextColor={colors.textGhost}
                      keyboardType="phone-pad"
                      maxLength={COUNTRY_CODES.find(c => c.code === countryCode)?.maxDigits ?? 10}
                    />
                  </View>
                </View>
                {showCC && (
                  <View style={[s.dropdown, { backgroundColor: colors.card, borderColor: colors.glassBorder }]}>
                    <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ maxHeight: 220 }}>
                      {COUNTRY_CODES.map(c => (
                        <TouchableOpacity key={c.code + c.name} style={[s.dropItem, { flexDirection: 'row', alignItems: 'center' }]} onPress={() => { setCC(c.code); setPhone(''); setShowCC(false); }}>
                          <Text style={{ width: 32, fontSize: 20 }}>{c.flag}</Text>
                          <Text style={[s.dropText, { flex: 1, color: colors.text }]}>{c.name}</Text>
                          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{c.code}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Submit */}
                <TouchableOpacity
                  style={[s.btn, loading && { opacity: 0.6 }]}
                  onPress={handleSendOtp}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={colors.gradPrimary || ['#7C3AED', '#C084FC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btnGrad}>
                    {loading
                      ? <ActivityIndicator color="#fff" />
                      : <><Ionicons name="logo-whatsapp" size={18} color="#fff" /><Text style={s.btnText}>Doğrulama Kodu Gönder</Text></>
                    }
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => navigation.navigate('PhoneLogin', { hideBack: true })} style={s.loginLink}>
                  <Text style={[s.loginLinkText, { color: colors.textMuted }]}>
                    Hesabın var mı? <Text style={{ color: colors.primary }}>Giriş Yap</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ─── STEP 2: OTP ─── */}
            {step === 2 && (
              <View style={s.card}>
                <View style={s.logoRow}>
                  <Ionicons name="chatbubble-ellipses" size={48} color="#25D366" />
                  <Text style={[s.logoText, { color: colors.text }]}>Doğrulama Kodu</Text>
                  <Text style={[s.logoSub, { color: colors.textMuted }]}>
                    WhatsApp'a gönderilen 6 haneli kodu girin{'\n'}
                    <Text style={{ color: colors.primary }}>{fullPhone}</Text>
                  </Text>
                </View>

                {/* 6-kutu OTP */}
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
                    autoFocus
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.btn, (loading || otp.length < 6) && { opacity: 0.5 }]}
                  onPress={handleVerify}
                  disabled={loading || otp.length < 6}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={colors.gradPrimary || ['#7C3AED', '#C084FC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btnGrad}>
                    {loading
                      ? <ActivityIndicator color="#fff" />
                      : <><Ionicons name="checkmark-circle" size={18} color="#fff" /><Text style={s.btnText}>Kayıt Ol ve Giriş Yap</Text></>
                    }
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleResend} disabled={countdown > 0} style={s.resendBtn}>
                  <Text style={[s.resendText, { color: countdown > 0 ? colors.textGhost : colors.primary }]}>
                    {countdown > 0 ? `Tekrar gönder (${countdown}s)` : 'Kodu tekrar gönder'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    root:        { flex: 1, backgroundColor: colors.background },
    orb:         { position: 'absolute', borderRadius: 999, opacity: 0.35 },
    orb1:        { width: 280, height: 280, top: -80, right: -60 },
    orb2:        { width: 200, height: 200, bottom: 100, left: -80 },
    header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
    backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
    progress:    { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingBottom: 12 },
    dot:         { height: 8, borderRadius: 4 },
    scroll:      { paddingHorizontal: 20, paddingTop: 4 },
    card:        { gap: 4 },
    logoRow:     { alignItems: 'center', gap: 8, marginBottom: 20 },
    logoIcon:    { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    logoText:    { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
    logoSub:     { fontSize: 13, textAlign: 'center', lineHeight: 19 },
    label:       { fontSize: 12, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 12, marginBottom: 6 },
    inputRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 11 },
    input:       { flex: 1, fontSize: 15 },
    selectRow:   { justifyContent: 'space-between' },
    selectText:  { flex: 1, fontSize: 15, marginLeft: 10 },
    dropdown:    { borderRadius: 14, borderWidth: 1, marginTop: 4 },
    dropItem:    { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)' },
    dropText:    { fontSize: 14 },
    genderRow:   { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
    genderBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, borderWidth: 1.5, paddingVertical: 10, paddingHorizontal: 10, justifyContent: 'center' },
    genderText:  { fontSize: 12, fontWeight: '600' },
    phoneRow:    { flexDirection: 'row', gap: 8 },
    ccBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 14 },
    ccText:      { fontSize: 14, fontWeight: '600' },
    btn:         { borderRadius: 16, overflow: 'hidden', marginTop: 20 },
    btnGrad:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 17 },
    btnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
    loginLink:   { alignItems: 'center', marginTop: 16, paddingVertical: 4 },
    loginLinkText: { fontSize: 14 },
    otpWrap:     { position: 'relative', marginVertical: 20 },
    otpRow:      { flexDirection: 'row', gap: 10, justifyContent: 'center' },
    otpBox:      { width: 48, height: 58, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    otpDigit:    { fontSize: 24, fontWeight: '800' },
    otpHidden:   { position: 'absolute', opacity: 0, width: 1, height: 1 },
    resendBtn:   { alignItems: 'center', paddingVertical: 12 },
    resendText:  { fontSize: 13, fontWeight: '600' },
  });
}
