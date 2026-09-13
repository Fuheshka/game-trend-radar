import { GameArchetype } from '../types/index.js';

export function classifyArchetype(title: string, genre: string = '', tags: string[] = []): GameArchetype {
  const text = `${title} ${genre} ${tags.join(' ')}`.toLowerCase();

  // 1. Incremental Simulation / +1 / Tycoon
  if (
    text.includes('+1') ||
    text.includes('simulator') ||
    text.includes('симулятор') ||
    text.includes('evolution') ||
    text.includes('эволюция') ||
    text.includes('steal') ||
    text.includes('mining') ||
    text.includes('добыча') ||
    text.includes('кликер') ||
    text.includes('clicker') ||
    text.includes('tycoon') ||
    text.includes('тайкун')
  ) {
    return 'SIMULATION_INCREMENTAL';
  }

  // 2. Physics Sandbox / Ragdoll / Destruction
  if (
    text.includes('ragdoll') ||
    text.includes('рэгдолл') ||
    text.includes('melon') ||
    text.includes('sandbox') ||
    text.includes('песочница') ||
    text.includes('dismount') ||
    text.includes('ломай') ||
    text.includes('разруш') ||
    text.includes('destruction') ||
    text.includes('damage') ||
    text.includes('hit') ||
    text.includes('физик')
  ) {
    return 'PHYSICS_SANDBOX';
  }

  // 3. Merge & Idle
  if (
    text.includes('merge') ||
    text.includes('мерж') ||
    text.includes('мёрдж') ||
    text.includes('соединяй') ||
    text.includes('sort') ||
    text.includes('сортировк') ||
    text.includes('полочк') ||
    text.includes('match') ||
    text.includes('три в ряд')
  ) {
    return 'MERGE_IDLE';
  }

  // 4. Survival & Horror
  if (
    text.includes('horror') ||
    text.includes('хоррор') ||
    text.includes('fnaf') ||
    text.includes('фредди') ||
    text.includes('survival') ||
    text.includes('выживание') ||
    text.includes('nights in the') ||
    text.includes('escape') ||
    text.includes('побег') ||
    text.includes('doors') ||
    text.includes('ghost') ||
    text.includes('страш')
  ) {
    return 'SURVIVAL_HORROR';
  }

  // 5. Word & Logic Puzzle
  if (
    text.includes('word') ||
    text.includes('слов') ||
    text.includes('филворд') ||
    text.includes('кроссворд') ||
    text.includes('пазл') ||
    text.includes('puzzle') ||
    text.includes('головоломк') ||
    text.includes('brain') ||
    text.includes('викторин') ||
    text.includes('quiz')
  ) {
    return 'WORD_PUZZLE';
  }

  // 6. Shooter & Action
  if (
    text.includes('shooter') ||
    text.includes('шутер') ||
    text.includes('standoff') ||
    text.includes('strike') ||
    text.includes('стрелялк') ||
    text.includes('battleground') ||
    text.includes('warfare') ||
    text.includes('войн') ||
    text.includes('gun') ||
    text.includes('оружие')
  ) {
    return 'ACTION_SHOOTER';
  }

  // 7. Obby & Parkour
  if (
    text.includes('obby') ||
    text.includes('обби') ||
    text.includes('parkour') ||
    text.includes('паркур') ||
    text.includes('tower of') ||
    text.includes('прыг')
  ) {
    return 'OBBY_PARKOUR';
  }

  return 'OTHER_CASUAL';
}

export function getArchetypeDisplayNameRu(archetype: GameArchetype): string {
  switch (archetype) {
    case 'SIMULATION_INCREMENTAL':
      return '+1 Симулятор и Эволюция';
    case 'PHYSICS_SANDBOX':
      return 'Рэгдолл-сендбокс и Физика';
    case 'MERGE_IDLE':
      return 'Мёрдж, Сортировка и Idle';
    case 'SURVIVAL_HORROR':
      return 'Хоррор и Выживание (Escape)';
    case 'WORD_PUZZLE':
      return 'Словесные и Логические Пазлы';
    case 'ACTION_SHOOTER':
      return 'Экшен и Шутеры';
    case 'OBBY_PARKOUR':
      return 'Обби и Паркур';
    case 'OTHER_CASUAL':
      return 'Прочие казуальные аркады';
  }
}
