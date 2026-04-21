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

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export function calculateStudentDebts(
  student: Student,
  payments: Payment[],
  currentCycle: SchoolCycle | null,
  settings: AppSettings | null
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
  
  const years = currentCycle.name.split('-').map(y => parseInt(y.trim()));
  const startYear = years[0] || currentYear;
  const endYear = years[1] || currentYear + 1;

  // We want to sort the billable months chronologically
  const chronologicalMonths = currentCycle.billableMonths.map(monthIndex => {
    const year = monthIndex >= 7 ? startYear : endYear;
    return { monthIndex, year };
  }).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.monthIndex - b.monthIndex;
  });

  chronologicalMonths.forEach(({ monthIndex, year }) => {
    const isPastOrCurrent = (year < currentYear) || (year === currentYear && monthIndex <= currentMonth);
    const conceptToFind = `COLEGIATURA ${MONTH_NAMES[monthIndex].toUpperCase()} ${year}`;
    
    const hasPayment = studentPayments.some(p => {
      // In online checkouts, we mark it missing if it's not paid AND not a pending online checkout, but to keep it simple, we consider "Pendiente" as well so they don't double pay
      const pDate = p.date.toDate();
      const dateMatches = pDate.getMonth() === monthIndex && pDate.getFullYear() === year;
      const conceptMatches = p.concept.toUpperCase().includes(MONTH_NAMES[monthIndex].toUpperCase()) && p.concept.includes(year.toString());
      return dateMatches || conceptMatches;
    });

    if (!hasPayment) {
      if (isPastOrCurrent) {
        // It's a debt
        const isCurrentMonth = year === currentYear && monthIndex === currentMonth;
        const dueDay = settings?.dueDay || 10;
        const isOverdue = !isCurrentMonth || now.getDate() > dueDay;

        debts.push({
          month: monthIndex,
          year: year,
          amount: currentCycle.tuitionAmount,
          concept: conceptToFind,
          isOverdue: isOverdue
        });
      } else if (!nextTuition) {
        // It's the first unpaid *future* month
        nextTuition = {
          month: monthIndex,
          year: year,
          amount: currentCycle.tuitionAmount,
          concept: conceptToFind,
          isOverdue: false
        };
      }
    }
  });

  // Only return nextTuition if the parent doesn't have current debts. If they have debts, they should pay those first.
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
