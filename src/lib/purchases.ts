import { Platform } from 'react-native';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';

/** RevenueCat entitlement identifier configured in the RevenueCat dashboard. */
export const PRO_ENTITLEMENT = 'pro';
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';
let configured = false;

export function purchasesAvailable() {
  return Platform.OS === 'android' && !!ANDROID_KEY && !ANDROID_KEY.includes('REPLACE');
}

export function initPurchases() {
  if (configured || !purchasesAvailable()) return;
  Purchases.configure({ apiKey: ANDROID_KEY });
  configured = true;
}

export async function identifyPurchaser(userId: string | null) {
  if (!configured) return;
  try {
    if (userId) await Purchases.logIn(userId);
    else if (!(await Purchases.isAnonymous())) await Purchases.logOut();
  } catch { /* ignore */ }
}

export async function isPro(): Promise<boolean> {
  if (!configured) return false;
  try {
    const info = await Purchases.getCustomerInfo();
    return !!info.entitlements.active[PRO_ENTITLEMENT];
  } catch { return false; }
}

export async function getProPackages(): Promise<PurchasesPackage[]> {
  if (!configured) return [];
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

export async function buyPackage(pkg: PurchasesPackage): Promise<boolean> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return !!customerInfo.entitlements.active[PRO_ENTITLEMENT];
}

export async function restorePurchases(): Promise<boolean> {
  if (!configured) return false;
  const info = await Purchases.restorePurchases();
  return !!info.entitlements.active[PRO_ENTITLEMENT];
}
