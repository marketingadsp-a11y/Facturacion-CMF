import { Timestamp } from 'firebase/firestore';

export interface Student {
  id: string;
  name: string;
  lastName: string;
  curp?: string;
  email?: string;
  phone?: string;
  level: string; // Preescolar, Primaria, Secundaria, etc.
  grade: string;
  group?: string;
  rfc?: string;
  billingName?: string;
  billingAddress?: string;
  zipCode?: string;
  taxSystem?: string;
  createdAt: Timestamp;
}

export interface Payment {
  id: string;
  studentId: string;
  amount: number;
  concept: string;
  paymentMethod: string;
  date: Timestamp;
  status: 'Pagado' | 'Pendiente' | 'Cancelado';
  invoiceId?: string;
  invoiceUrl?: string;
  items?: { description: string; price: number }[];
}

export interface SchoolCycle {
  id: string;
  name: string;
  billableMonths: number[]; // 0-11 (Jan-Dec)
  tuitionAmount: number;
  createdAt: Timestamp;
}

export type UserRole = 'Superadministrador' | 'Administrador' | 'Visor' | 'Cajero';

export interface AppPermissions {
  dashboard: {
    view: boolean;
  };
  students: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    viewHistory: boolean;
  };
  payments: {
    view: boolean;
    create: boolean;
    cancel: boolean;
    invoice: boolean;
    downloadInvoice: boolean;
  };
  settings: {
    view: boolean;
    editGeneral: boolean;
    editCycles: boolean;
    editRules: boolean;
    manageUsers: boolean;
  };
}

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: AppPermissions;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface AppSettings {
  schoolName: string;
  legalName: string;
  logoUrl?: string;
  facturapiApiKey?: string;
  facturapiSandbox: boolean;
  paymentMethods: string[];
  currentCycleId?: string;
  dueDay: number; // Max day to pay without interest
  lateFeeAmount: number;
  lateFeeType: 'fixed' | 'percentage';
  rolePermissions?: Record<UserRole, AppPermissions>;
}
