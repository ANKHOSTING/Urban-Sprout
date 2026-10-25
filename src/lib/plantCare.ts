/** Small built-in care guide for common urban plants (offline, no AI needed). */
export type CareInfo = { sunlight: string; water_every_days: number; tips: string };
export const CARE_GUIDE: Record<string, CareInfo> = {
  basil: { sunlight: 'Full sun (6+ hrs)', water_every_days: 2, tips: 'Pinch flower buds to keep leaves coming.' },
  tomato: { sunlight: 'Full sun (8 hrs)', water_every_days: 2, tips: 'Water deeply at the base; stake early.' },
  mint: { sunlight: 'Partial sun', water_every_days: 3, tips: 'Grow in its own pot, it spreads fast.' },
  pothos: { sunlight: 'Low to bright indirect', water_every_days: 7, tips: 'Let the top inch of soil dry out.' },
  'snake plant': { sunlight: 'Low to bright indirect', water_every_days: 14, tips: 'Overwatering is the #1 killer.' },
  succulent: { sunlight: 'Bright light', water_every_days: 10, tips: 'Soak and dry; use gritty soil.' },
  lettuce: { sunlight: 'Partial sun', water_every_days: 2, tips: 'Harvest outer leaves; prefers cool weather.' },
  peppers: { sunlight: 'Full sun', water_every_days: 3, tips: 'Feed every 2 weeks once flowering.' },
  monstera: { sunlight: 'Bright indirect', water_every_days: 7, tips: 'Wipe leaves; give it a moss pole.' },
  strawberry: { sunlight: 'Full sun', water_every_days: 2, tips: 'Keep soil moist, remove runners for bigger fruit.' },
};
export function lookupCare(species: string | null | undefined): CareInfo | null {
  if (!species) return null;
  const s = species.toLowerCase();
  const k = Object.keys(CARE_GUIDE).find((n) => s.includes(n));
  return k ? CARE_GUIDE[k] : null;
}
export function nextWaterDate(lastWatered: string | null, everyDays: number): Date | null {
  if (!lastWatered) return null;
  return new Date(new Date(lastWatered).getTime() + everyDays * 86400000);
}
