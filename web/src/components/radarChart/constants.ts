export const RADAR_AXES = [
  { key: 'score', label: 'Скоринг' },
  { key: 'demand', label: 'Спрос' },
  { key: 'velocity', label: 'Динамика' },
  { key: 'monetization', label: 'Монетизация' },
  { key: 'niche', label: 'Свобода ниши' },
];

export function getStatusColor(status: string): string {
  switch (status) {
    case 'GREEN_LIGHT':
      return '#10b981';
    case 'YELLOW_LIGHT':
      return '#f59e0b';
    case 'RED_LIGHT':
      return '#ef4444';
    default:
      return '#89dceb';
  }
}
