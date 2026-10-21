import { Timestamp } from 'firebase/firestore';

export interface Student {
  id: string;
  name: string; // Used for Given Names
  lastName: string; // Used for Paternal Last Name
  motherLastName?: string; // Maternal Last Name
  birthDate?: string; // YYYY-MM-DD
  gender?: 'H' | 'M'; // Hombre / Mujer
  birthState?: string; // 2-letter state code
  curp?: string;
  enrollmentMonth?: number; // 0-11
  enrollmentYear?: number;
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
  photoUrl?: string;
  matricula?: string;
  cycleId?: string;
  cycles?: string[];
  gradeHistory?: Record<string, { level: string; grade: string; group?: string }>;
  createdAt: Timestamp;
}

export interface Payment {
  id: string;
  studentId: string;
  cycleId?: string;
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
  timeClock: {
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
  birthPlaceStateCode?: string; // 2-letter state code for CURP
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
  phone?: string;
  role: UserRole;
  permissions: AppPermissions;
  assignedLevel?: string;
  assignedGrade?: string;
  assignedGroup?: string;
  employeeNumber?: string;
  photoUrl?: string;
  maxHoursPerWeek?: number;
  maxHoursPerDay?: number;
  // Granular restrictions for Control Escolar or other roles
  restrictedLevels?: string[];
  restrictedGrades?: string[];
  restrictedGroups?: string[];
  // Password and subject assignment management
  currentPassword?: string;
  teacherSubjectAccess?: 'all' | 'specific';
  assignedSubjects?: string[];
  teacherSubjectGrades?: Record<string, string[]>;
  teacherSubjectGroups?: Record<string, string[]>;
  teacherGradeGroups?: Record<string, string[]>;
  teacherGroupAccess?: 'single' | 'multiple';
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
  parentPortalFeatures?: Record<string, string[]>;
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
  notFoundBackgroundUrl?: string;
  notFoundText?: string;
  loginTitle?: string;
  loginSubtitle?: string;
  visitorQrCodeContent?: string;
  visitorQrCodeLabel?: string;
  visitorQrCodeDescription?: string;
  visitorSuccessTimeout?: number; // Seconds to show success screen
  welcomeEmailSubject?: string;
  welcomeEmailBody?: string;
  resendApiKey?: string;
  mailFrom?: string;
  levelCCT?: Record<string, string>;
  credentialTerms?: string;
  imgbbApiKey?: string;
  matriculaPrefixes?: Record<string, string>;
  levelPeriods?: Record<string, { label: string; time: string; isBreak?: boolean }[]>;
  studentAttendanceTrackExit?: boolean;
  levelEvaluationConfig?: Record<string, LevelEvaluationConfig>;
  // School contact info (for PDF/Excel lists)
  schoolAddress?: string;
  schoolPhone?: string;
  schoolWebsite?: string;
  // Attendance list configuration
  attendanceListColumns?: number; // number of blank attendance columns (default 31)
  attendanceListShowMatricula?: boolean;
  attendanceListShowNo?: boolean;
  teacherActivitiesLevels?: string[]; // Niveles educativos con registro de actividades habilitado
  subjectAttendanceLevels?: string[]; // Niveles educativos con asistencia por materia (individual) habilitada
  teacherPortalFeatures?: {
    attendance?: boolean;
    grading?: boolean;
    activities?: boolean;
    horario?: boolean;
    credencial?: boolean;
  };
}

export type GradingScale = 'letters' | 'numeric_10' | 'numeric_100';

export interface LevelEvaluationConfig {
  periodCount: number; // e.g. 3 or 5
  periodType: 'Trimestres' | 'Bimestres' | 'Semestres' | 'Cuatrimestres' | 'Personalizado';
  periodNames?: string[]; // e.g. ["1er Trimestre", "2do Trimestre", "3er Trimestre"]
  gradingScale?: GradingScale; // 'letters' (Preescolar A-D), 'numeric_10' (0-10), 'numeric_100' (0-100)
  enableActivities?: boolean; // Permite a los docentes registrar columnas de actividades y evaluarlas
  enableSubjectAttendance?: boolean; // Permite pase de lista individual por materia
}

export interface TeacherActivity {
  id: string;
  name: string;
  date: string; // ISO format YYYY-MM-DD
  level: string;
  grade: string;
  group: string;
  period: number; // Periodo o bimestre correspondiente (1, 2, 3...)
  cycleId: string;
  subjectId?: string; // ID de la materia a la que pertenece la actividad
  subjectName?: string; // Nombre de la materia
  teacherId?: string;
  teacherName?: string;
  scores?: Record<string, number | string>; // studentId -> calificacion
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Subject {
  id: string;
  name: string;
  level: string; // Preescolar, Primaria, etc.
  category?: 'Académica' | 'Autonomía Curricular' | 'Desarrollo Personal' | 'Aspectos Formativos';
  linkedSubjectId?: string; // Optional: ID of an Academic subject this Autonomía Curricular subject contributes to
  linkedSubjectName?: string; // Optional: Name of the Academic subject (e.g. "De lo Humano y lo Comunitario")
  isAttendanceCount?: boolean; // When true, student absences (Faltas) automatically sum into this subject
  createdAt: Timestamp;
}

export type Bimestre = 1 | 2 | 3 | 4 | 5 | 6;

export interface StudentGrade {
  id?: string;
  studentId: string;
  cycleId: string;
  bimestre: Bimestre;
  subjects: Record<string, number | string>;
  conduct: number | string;
  uniform: number | string;
  attendance: number | string;
  tasksNotDone: number | string;
  tardies: number | string;
  cleanliness: number | string;
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
  subjectId?: string; // ID de la materia (para asistencia individual por materia)
  subjectName?: string; // Nombre de la materia
  justificationReason?: string; // Optional motivo/justificación when status is 'Justificado'
  period?: number; // Optional evaluation period (e.g. 1, 2, 3...)
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
  birthDate?: string; // YYYY-MM-DD
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

export interface ScheduleSlot {
  id?: string;
  cycleId: string;
  level: string; // Preescolar, Primaria, Secundaria, etc.
  grade: string; // 1ro, 2do, etc.
  group: string; // A, B, etc.
  day: number; // 1 = Lunes, 2 = Martes, 3 = Miércoles, 4 = Jueves, 5 = Viernes
  periodIndex: number; // 0-indexed (e.g. 0 to 6 for 7 periods)
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  classroom?: string;
  updatedAt?: Timestamp;
}

export interface TeacherSubstitution {
  id?: string;
  date: string; // YYYY-MM-DD
  day: number;
  periodIndex: number;
  absentTeacherId: string;
  absentTeacherName: string;
  substituteTeacherId: string;
  substituteTeacherName: string;
  reason?: string;
  status: 'Pendiente' | 'Confirmada' | 'Realizada';
  createdAt: Timestamp;
}

