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
  registrationCode?: string; // 5-digit code for parent registration
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

export type UserRole = 'Superadministrador' | 'Administrador' | 'Visor' | 'Cajero' | 'Padre' | 'Control Escolar' | 'Docente' | 'Recepción';

export interface AppPermissions {
  dashboard: {
    view: boolean;
  };
  reception: {
    view: boolean;
    manage: boolean;
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
  announcements: {
    view: boolean;
    manage: boolean;
  };
  parents: {
    view: boolean;
    manage: boolean;
  };
  controlEscolar: {
    view: boolean;
    manage: boolean;
  };
  grading: {
    view: boolean;
    manage: boolean;
  };
}

export interface Enrollment {
  id: string;
  folio: string;
  status: 'Pendiente' | 'Aprobado' | 'Rechazado';
  
  // Alumno
  studentLastName: string;
  studentMotherLastName: string;
  studentName: string;
  address: string;
  addressNo: string;
  neighborhood: string;
  zipCode: string;
  phone: string;
  grade: string;
  level: string;
  birthPlaceCity: string;
  birthPlaceState: string;
  birthDate: string;
  age: number;
  gender: 'Hombre' | 'Mujer';
  previousSchool: string;
  curp: string;
  medicalConditions: string;
  medications: string;

  // Cliente (Padre)
  fatherName: string;
  fatherAge: number;
  fatherCivilStatus: string;
  fatherPhone: string;
  fatherEmail: string;
  fatherOccupation: string;

  // Cliente (Madre)
  motherName: string;
  motherAge: number;
  motherCivilStatus: string;
  motherPhone: string;
  motherEmail: string;
  motherOccupation: string;

  // Emergencia
  emergencyContactName: string;
  emergencyContactAddress: string;
  emergencyContactPhone: string;

  // Otros
  schoolChangeReason: string;
  whyChooseSchool: string;
  specialSupportRequired: boolean;
  specialSupportDescription: string;

  // Compromisos
  commitments: {
    participate: boolean;
    discipline: boolean;
    conferences: boolean;
    payments: boolean;
    timelyPayments: boolean;
    workTogether: boolean;
  };

  createdAt: Timestamp;
}

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: AppPermissions;
  assignedLevel?: string;
  assignedGrade?: string;
  assignedGroup?: string;
  // Granular restrictions for Control Escolar or other roles
  restrictedLevels?: string[];
  restrictedGrades?: string[];
  restrictedGroups?: string[];
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'important';
  active: boolean;
  createdAt: Timestamp;
  createdBy: string;
  acknowledgedBy?: string[];
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
  enrollmentSlug?: string;
  academicLevels?: string[]; // e.g., ["Preescolar", "Primaria"]
  academicGrades?: string[];  // e.g., ["1ro", "2do"]
  academicGroups?: string[];  // e.g., ["A", "B"]
  receptionReasons?: string[];  // e.g., ["Inscripción", "Información", "Pago"]
  receptionAreas?: string[];    // e.g., ["Dirección", "Administración", "Control Escolar"]
  receptionSuccessTitle?: string;
  receptionSuccessMessage?: string;
  developerAttribution?: string;
  registrationInstructions?: string;
  pdfFooter?: string;
  kioskBackgroundUrl?: string;
}

export type Bimestre = 1 | 2 | 3 | 4 | 5;

export interface StudentGrade {
  id?: string;
  studentId: string;
  cycleId: string;
  bimestre: Bimestre;
  subjects: Record<string, number>;
  conduct: number;
  uniform: number;
  attendance: number;
  tasksNotDone: number;
  tardies: number;
  cleanliness: number;
  updatedAt: Timestamp;
  createdBy: string;
}

export type AttendanceStatus = 'Asistió' | 'Falta' | 'Retardo' | 'Justificado';

export interface Attendance {
  id?: string;
  studentId: string;
  cycleId: string;
  date: string; // ISO format YYYY-MM-DD
  status: AttendanceStatus;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface BimestreLock {
  id: string; // bimestre_level_grade_group_cycleId
  bimestre: Bimestre;
  level: string;
  grade: string;
  group: string;
  cycleId: string;
  locked: boolean;
  lockedAt?: Timestamp;
  lockedBy?: string;
}

export interface ReceptionVisit {
  id: string;
  name: string;
  area?: string; // Dynamic from settings
  reason: string; // Dynamic from settings
  checkInTime: Timestamp;
  status: 'Pendiente' | 'Atendido';
  attendedAt?: Timestamp;
}

export interface Employee {
  id: string;
  name: string;
  position: string;
  faceDescriptor: number[];
  createdAt: Timestamp;
}

export interface TimeLog {
  id?: string;
  employeeId: string;
  employeeName: string;
  employeePosition: string;
  type: 'Entrada' | 'Salida';
  timestamp: Timestamp;
}
