/**
 * Stripe Payment Utilities for careers.mt
 */

/**
 * Computes the price in cents for unlocking a candidate application.
 * 
 * Pricing tiers (example values):
 * - Free jobs: 0
 * - standard (PPQA): €12.00 (1200 cents)
 * - executive: €250.00 (25000 cents)
 */
export function computeUnlockPrice(jobLevel: string = 'standard'): number {
  const level = (jobLevel || 'standard').toLowerCase();
  
  switch (level) {
    case 'free':
      return 0;
    case 'ppqa':
    case 'standard':
      return 1200;
    case 'executive':
      return 25000;
    default:
      return 1200; // Default to standard pricing
  }
}

/**
 * Formats a cent amount into a human-readable Euro string.
 */
export function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('en-MT', {
    style: 'currency',
    currency: 'EUR',
  });
}
