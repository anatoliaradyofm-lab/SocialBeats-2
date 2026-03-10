import { I18nManager } from 'react-native';

export const isRTL = () => I18nManager.isRTL;

export const rtlStyle = (ltrStyle) => {
  if (!I18nManager.isRTL) return ltrStyle;

  const rtl = { ...ltrStyle };

  if (rtl.flexDirection === 'row') rtl.flexDirection = 'row-reverse';
  if (rtl.textAlign === 'left') rtl.textAlign = 'right';
  if (rtl.textAlign === 'right') rtl.textAlign = 'left';

  if (rtl.marginLeft !== undefined && rtl.marginRight === undefined) {
    rtl.marginRight = rtl.marginLeft;
    delete rtl.marginLeft;
  }
  if (rtl.paddingLeft !== undefined && rtl.paddingRight === undefined) {
    rtl.paddingRight = rtl.paddingLeft;
    delete rtl.paddingLeft;
  }

  return rtl;
};

export const rtlTransform = () => I18nManager.isRTL ? [{ scaleX: -1 }] : [];
