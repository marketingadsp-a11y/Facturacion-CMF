import { Timestamp } from 'firebase/firestore';

export interface Student {
  id: string;
  name: string;
  lastName: string;
  curp?: string;
  email?: string;
  phone?: string;
  parentEmail?: string; // Link to parent user
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
  conektaOrderId?: string;
  updatedAt?: Timestamp;
  items?: { description: string; price: number }[];
}

export interface SchoolCycle {
  id: string;
  name: string;
  billableMonths: number[]; // 0-11 (Jan-Dec)
  tuitionAmount: number;
  createdAt: Timestamp;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: Timestamp;
  status: 'Pagado' | 'Pendiente';
  createdBy: string;
  createdAt: Timestamp;
}

export type UserRole = 'Superadministrador' | 'Administrador' | 'Visor' | 'Cajero' | 'Padre';

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
  expenses: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
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

export interface Course {
  id?: string;
  clave: string;
  year: string;
  period: string;
  name: string;
  credits: string;
  rvoe: string;
  educationalLevel: string;
  grades: string[];
  subjects: { id: string; clave: string; name: string }[];
  feeClave: string;
  feeYear: string;
  feePeriod: string;
  feeNumber: string;
  feeDescription: string;
  satClave: string;
  satUnit: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ChargeItem {
  id: string;
  concept: string;
  numberOfCharges: number;
  type: '1' | '2' | '3'; // 1=Mensual, 2=Quincenal, 3=Semanal
  startDate: string;
  amount: number;
}

export interface ChargeCatalog {
  id?: string;
  clave: string;
  year: string;
  period: string;
  chargeNumber: string;
  description: string;
  charges: ChargeItem[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AppSettings {
  schoolName: string;
  legalName: string;
  logoUrl?: string;
  facturapiApiKey?: string;
  facturapiSandbox: boolean;
  conektaPublicKey?: string;
  conektaPrivateKey?: string;
  paymentMethods: string[];
  currentCycleId?: string;
  dueDay: number; // Max day to pay without interest
  lateFeeAmount: number;
  lateFeeType: 'fixed' | 'percentage';
  rolePermissions?: Record<UserRole, AppPermissions>;
}
