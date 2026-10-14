/**
 * Price Alert Utility
 * Manages price drop/rise alerts for tenant premium users
 */

export interface PriceAlert {
  id?: string;
  property_id: number | string;
  user_id: number | string;
  original_price: number;
  alert_price: number;
  property_title?: string;
  address?: string;
  alert_type: "drop" | "rise";
  created_at?: string;
  is_active: boolean;
}

export interface PriceAlertPayload {
  property_id: number | string;
  user_id: number | string;
  original_price: number;
  alert_price: number;
  alert_type: "drop" | "rise";
}

/**
 * Calculate if a price drop occurred and should trigger alert
 */
export function shouldTriggerPriceAlert(
  originalPrice: number,
  newPrice: number,
  alertThreshold: number = 0.05 // 5% default threshold
): boolean {
  const percentChange = Math.abs((newPrice - originalPrice) / originalPrice);
  return percentChange >= alertThreshold;
}

/**
 * Calculate percentage change
 */
export function calculatePriceChange(
  originalPrice: number,
  newPrice: number
): {
  percentChange: number;
  isDropped: boolean;
  formattedChange: string;
} {
  const diff = newPrice - originalPrice;
  const percentChange = (diff / originalPrice) * 100;
  const isDropped = diff < 0;

  return {
    percentChange: Math.abs(percentChange),
    isDropped,
    formattedChange: `${isDropped ? "-" : "+"}${Math.abs(percentChange).toFixed(1)}%`,
  };
}

/**
 * Format alert message for display
 */
export function formatPriceAlertMessage(
  propertyTitle: string,
  originalPrice: number,
  newPrice: number,
  alertType: "drop" | "rise"
): string {
  const { formattedChange, isDropped } = calculatePriceChange(originalPrice, newPrice);

  if (alertType === "drop" && isDropped) {
    return `Price dropped! ${propertyTitle} is now ${formattedChange} lower - from ${formatCurrency(
      originalPrice
    )} to ${formatCurrency(newPrice)}`;
  }

  if (alertType === "rise" && !isDropped) {
    return `Price increased! ${propertyTitle} is now ${formattedChange} higher - from ${formatCurrency(
      originalPrice
    )} to ${formatCurrency(newPrice)}`;
  }

  return `Price changed for ${propertyTitle}`;
}

/**
 * Format currency value
 */
export function formatCurrency(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "N/A";

  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}
