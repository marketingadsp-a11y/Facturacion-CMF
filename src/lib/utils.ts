import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount);
}

/**
 * Normaliza un texto removiendo acentos/diacríticos y pasándolo a minúsculas.
 * Ideal para búsquedas que ignoran mayúsculas, minúsculas y acentos.
 * Ejemplo: "JOSÉ RAMÓN" -> "jose ramon", "Ángel" -> "angel"
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Evalúa si un texto candidato contiene el término de búsqueda ignorando mayúsculas y acentos.
 */
export function matchesSearchText(
  text: string | null | undefined,
  query: string | null | undefined
): boolean {
  if (!query || !query.trim()) return true;
  return normalizeText(text).includes(normalizeText(query));
}

/**
 * Evalúa si una lista de campos (ej. nombre, apellidos, CURP, matrícula) coincide
 * con una búsqueda de usuario sin importar acentos, mayúsculas o el orden de las palabras.
 */
export function studentMatchesSearch(
  fields: (string | null | undefined)[],
  query: string | null | undefined
): boolean {
  if (!query || !query.trim()) return true;
  const normalizedQuery = normalizeText(query);
  const words = normalizedQuery.split(/\s+/).filter(Boolean);
  const normalizedTarget = fields.map(f => normalizeText(f)).join(' ');

  return words.every(word => normalizedTarget.includes(word));
}

