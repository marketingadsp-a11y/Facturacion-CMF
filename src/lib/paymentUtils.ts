import { Student, Payment, SchoolCycle, AppSettings } from '../types';
import { startOfMonth, endOfMonth, isWithinInterval, getMonth, getYear } from 'date-fns';

export interface Debt {
  month: number;
  year: number;
  amount: number;
  concept: string;
  isOverdue: boolean;
}

export interface StudentDebtStatus {
  studentId: string;
  hasDebt: boolean;
  hasOverdueDebt: boolean;
  debts: Debt[];
  totalDebt: number;
  nextTuition: Debt | null;
}

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export function calculateStudentDebts(
  student: Student,
  payments: Payment[],
  currentCycle: SchoolCycle | null,
  settings: AppSettings | null,
  allCycles: SchoolCycle[] = []
): StudentDebtStatus {
  if (!currentCycle) {
    return { studentId: student.id, hasDebt: false, hasOverdueDebt: false, debts: [], totalDebt: 0, nextTuition: null };
  }

  const now = new Date();
  const currentMonth = getMonth(now);
  const currentYear = getYear(now);
  
  const studentPayments = payments.filter(p => p.studentId === student.id && (p.status?.toLowerCase() === 'pagado' || p.status?.toLowerCase() === 'pendiente'));
  
  const debts: Debt[] = [];
  let nextTuition: Debt | null = null;

  // Find previous cycles
  const getCycleStartYear = (cycle: SchoolCycle) => {
    const years = cycle.name.split('-').map(y => parseInt(y.trim()));
    return years[0] || 0;
  };
  
  const currentCycleStartYear = getCycleStartYear(currentCycle);
  const previousCycles = allCycles.filter(c => {
    if (c.id === currentCycle.id) return false;
    return getCycleStartYear(c) < currentCycleStartYear;
  });

  // Helper to compute debts for a given cycle
  const computeDebtsForCycle = (cycle: SchoolCycle, isPreviousCycle: boolean) => {
    const cycleDebts: Debt[] = [];
    // Si la colegiatura está en 0 o menos, no se generan cobros ni deudas de colegiatura
    if (!cycle || !cycle.billableMonths || (cycle.tuitionAmount ?? 0) <= 0) {
      return cycleDebts;
    }
    const years = cycle.name.split('-').map(y => parseInt(y.trim()));
    const startYear = years[0] || currentYear;
    const endYear = years[1] || currentYear + 1;

    const chronologicalMonths = cycle.billableMonths.map(monthIndex => {
      const year = monthIndex >= 7 ? startYear : endYear;
      return { monthIndex, year };
    }).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.monthIndex - b.monthIndex;
    });

    chronologicalMonths.forEach(({ monthIndex, year }) => {
      // Only consider months on or after enrollment date
      if (student.enrollmentYear !== undefined && student.enrollmentMonth !== undefined) {
        if (year < student.enrollmentYear || (year === student.enrollmentYear && monthIndex < student.enrollmentMonth)) {
          return;
        }
      }

      const isPastOrCurrent = isPreviousCycle || (year < currentYear) || (year === currentYear && monthIndex <= currentMonth);
      const conceptPrefix = isPreviousCycle 
        ? `COLEGIATURA ${MONTH_NAMES[monthIndex].toUpperCase()} ${year} (Ciclo ${cycle.name})`
        : `COLEGIATURA ${MONTH_NAMES[monthIndex].toUpperCase()} ${year}`;

      const hasPayment = studentPayments.some(p => {
        const pDate = p.date.toDate();
        const dateMatches = pDate.getMonth() === monthIndex && pDate.getFullYear() === year;
        const conceptMatches = p.concept.toUpperCase().includes(MONTH_NAMES[monthIndex].toUpperCase()) && p.concept.includes(year.toString());
        return dateMatches || conceptMatches;
      });

      if (!hasPayment) {
        if (isPastOrCurrent) {
          const isOverdue = isPreviousCycle || (() => {
            const isCurrentMonth = year === currentYear && monthIndex === currentMonth;
            const dueDay = settings?.dueDay || 10;
            return !isCurrentMonth || now.getDate() > dueDay;
          })();

          cycleDebts.push({
            month: monthIndex,
            year: year,
            amount: cycle.tuitionAmount,
            concept: conceptPrefix,
            isOverdue: isOverdue
          });
        } else if (!isPreviousCycle && !nextTuition) {
          nextTuition = {
            month: monthIndex,
            year: year,
            amount: cycle.tuitionAmount,
            concept: conceptPrefix,
            isOverdue: false
          };
        }
      }
    });

    return cycleDebts;
  };

  // 1. Calculate debts for previous cycles
  previousCycles.forEach(prevCycle => {
    const prevCycleDebts = computeDebtsForCycle(prevCycle, true);
    debts.push(...prevCycleDebts);
  });

  // 2. Calculate debts for current cycle
  const currentCycleDebts = computeDebtsForCycle(currentCycle, false);
  debts.push(...currentCycleDebts);

  const hasDebt = debts.length > 0;

  return {
    studentId: student.id,
    hasDebt: hasDebt,
    hasOverdueDebt: debts.some(d => d.isOverdue),
    debts,
    totalDebt: debts.reduce((sum, d) => sum + d.amount, 0),
    nextTuition: hasDebt ? null : nextTuition
  };
}
