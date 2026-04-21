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
    return { studentId: student.id, hasDebt: false, hasOverdueDebt: false, debts: [], totalDebt: 0 };
  }

  const now = new Date();
  const currentMonth = getMonth(now);
  const currentYear = getYear(now);
  
  const studentPayments = payments.filter(p => p.studentId === student.id && p.status?.toLowerCase() === 'pagado');
  const debts: Debt[] = [];

  // We need to determine which years the cycle covers.
  // Usually a cycle starts in one year and ends in the next.
  // Example: 2025-2026 starts Aug 2025 (month 7) and ends Jun 2026 (month 5).
  
  // For simplicity, let's look at the billable months.
  // If a month is in billableMonths, we check if it's in the past or current month.
  
  // We need to know the start year of the cycle. 
  // We can infer it from the cycle name or just use the current year logic.
  // Let's assume the cycle name is like "2025-2026".
  const years = currentCycle.name.split('-').map(y => parseInt(y.trim()));
  const startYear = years[0] || currentYear;
  const endYear = years[1] || currentYear + 1;

  currentCycle.billableMonths.forEach(monthIndex => {
    // Determine the year for this month index
    // If monthIndex >= 7 (Aug), it's likely the startYear
    // If monthIndex < 7 (Jan-Jul), it's likely the endYear
    const year = monthIndex >= 7 ? startYear : endYear;
    
    // Check if this month/year is in the past or is the current month
    const isPastOrCurrent = (year < currentYear) || (year === currentYear && monthIndex <= currentMonth);
    
    if (isPastOrCurrent) {
      // Check if there's a payment for this month
      // We check the payment date or concept. 
      // Checking concept is safer if payments are made in advance or late.
      const conceptToFind = `COLEGIATURA ${MONTH_NAMES[monthIndex].toUpperCase()} ${year}`;
      const hasPayment = studentPayments.some(p => {
        const pDate = p.date.toDate();
        const dateMatches = pDate.getMonth() === monthIndex && pDate.getFullYear() === year;
        const conceptMatches = p.concept.toUpperCase().includes(MONTH_NAMES[monthIndex].toUpperCase()) && 
                               p.concept.includes(year.toString());
        return dateMatches || conceptMatches;
      });

      if (!hasPayment) {
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
      }
    }
  });

  return {
    studentId: student.id,
    hasDebt: debts.length > 0,
    hasOverdueDebt: debts.some(d => d.isOverdue),
    debts,
    totalDebt: debts.reduce((sum, d) => sum + d.amount, 0)
  };
}
