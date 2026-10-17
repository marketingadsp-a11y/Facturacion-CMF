import { AppSettings, LevelEvaluationConfig } from '../types';

/**
 * Generates default period names like "1er Trimestre", "2do Trimestre" or "1er Bimestre"
 */
export function generateDefaultPeriodNames(type: string, count: number): string[] {
  const ordinalPrefixes = ['1er', '2do', '3er', '4to', '5to', '6to', '7mo', '8vo'];
  const singular = type === 'Trimestres' ? 'Trimestre' :
                   type === 'Bimestres' ? 'Bimestre' :
                   type === 'Semestres' ? 'Semestre' :
                   type === 'Cuatrimestres' ? 'Cuatrimestre' : 'Periodo';

  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const prefix = ordinalPrefixes[i] || `${i + 1}°`;
    names.push(`${prefix} ${singular}`);
  }
  return names;
}

/**
 * Returns the evaluation configuration for a given level, respecting the global settings,
 * or returning sensible default Mexican educational standards (3 Trimestres for Primaria/Secundaria, 5 Bimestres for Prepa).
 */
export function getLevelEvaluationConfig(settings: AppSettings | null, levelName?: string): LevelEvaluationConfig {
  if (!levelName) {
    return {
      periodCount: 3,
      periodType: 'Trimestres',
      periodNames: ['1er Trimestre', '2do Trimestre', '3er Trimestre']
    };
  }

  // 1. If explicitly configured in settings under levelEvaluationConfig
  if (settings?.levelEvaluationConfig?.[levelName]) {
    const conf = settings.levelEvaluationConfig[levelName];
    const count = Number(conf.periodCount) || 3;
    const type = conf.periodType || (count === 5 ? 'Bimestres' : count === 3 ? 'Trimestres' : 'Personalizado');
    const names = (conf.periodNames && conf.periodNames.length === count)
      ? conf.periodNames
      : generateDefaultPeriodNames(type, count);

    return {
      periodCount: count,
      periodType: type,
      periodNames: names
    };
  }

  // 2. Intelligent defaults based on Mexican standard educational levels:
  const lLower = levelName.toLowerCase();
  if (lLower.includes('prepa') || lLower.includes('bachiller')) {
    // Preparatoria / Bachillerato: 5 bimestres
    return {
      periodCount: 5,
      periodType: 'Bimestres',
      periodNames: ['1er Bimestre', '2do Bimestre', '3er Bimestre', '4to Bimestre', '5to Bimestre']
    };
  } else if (lLower.includes('universidad') || lLower.includes('licenciatura')) {
    return {
      periodCount: 2,
      periodType: 'Semestres',
      periodNames: ['1er Semestre', '2do Semestre']
    };
  } else {
    // Preescolar, Primaria, Secundaria: 3 Trimestres (SEP estándar)
    return {
      periodCount: 3,
      periodType: 'Trimestres',
      periodNames: ['1er Trimestre', '2do Trimestre', '3er Trimestre']
    };
  }
}
