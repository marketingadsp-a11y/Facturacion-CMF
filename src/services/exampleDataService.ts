import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  Timestamp, 
  doc, 
  setDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Student, 
  Payment, 
  Expense, 
  Announcement, 
  SchoolCycle, 
  ReceptionVisit,
  StudentGrade
} from '../types';

const levels = ['Preescolar', 'Primaria', 'Secundaria', 'Bachillerato'];
const grades = ['1ro', '2do', '3ro', '4to', '5to', '6to'];
const groups = ['A', 'B'];

const firstNames = ['Juan', 'María', 'Pedro', 'Ana', 'Luis', 'Sofía', 'Carlos', 'Elena', 'Miguel', 'Lucía', 'Diego', 'Isabella', 'Ricardo', 'Valentina', 'Fernando', 'Camila', 'Alejandro', 'Mariana', 'Javier', 'Ximena'];
const lastNames = ['García', 'Hernández', 'Martínez', 'López', 'González', 'Pérez', 'Rodríguez', 'Sánchez', 'Ramírez', 'Cruz', 'Flores', 'Morales', 'Vázquez', 'Jiménez', 'Reyes', 'Díaz', 'Torres', 'Gutiérrez', 'Ruiz', 'Mendoza'];

export const loadExampleData = async () => {
  try {
    const batch = writeBatch(db);

    // 1. Create a School Cycle
    const cycleRef = doc(collection(db, 'cycles'));
    const cycleData: Omit<SchoolCycle, 'id'> = {
      name: 'Ciclo Escolar 2024-2025 (Demo)',
      tuitionAmount: 3500,
      billableMonths: [7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5], // Aug - June
      createdAt: Timestamp.now() as any
    };
    batch.set(cycleRef, cycleData);

    // Update current cycle in settings
    const settingsRef = doc(db, 'settings', 'general');
    batch.set(settingsRef, { currentCycleId: cycleRef.id }, { merge: true });

    // 2. Create Students and related data
    const students: string[] = [];
    for (let i = 0; i < 40; i++) {
      const studentId = doc(collection(db, 'students')).id;
      students.push(studentId);
      
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const motherLastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      
      const level = levels[Math.floor(Math.random() * levels.length)];
      const grade = grades[Math.floor(Math.random() * (level === 'Secundaria' ? 3 : level === 'Bachillerato' ? 3 : 6))];
      const group = groups[Math.floor(Math.random() * groups.length)];

      const student: Omit<Student, 'id'> = {
        name: firstName,
        lastName: `${lastName} ${motherLastName}`,
        curp: `TEST${Math.random().toString(36).substring(2, 12).toUpperCase()}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@ejemplo.com`,
        phone: `341${Math.floor(1000000 + Math.random() * 9000000)}`,
        parentEmail: `padre${i}@ejemplo.com`,
        level,
        grade,
        group,
        registrationCode: Math.floor(10000 + Math.random() * 90000).toString(),
        createdAt: Timestamp.now() as any
      };

      batch.set(doc(db, 'students', studentId), student);

      // 3. Create Payments for some students
      if (Math.random() > 0.3) {
        const paymentRef = doc(collection(db, 'payments'));
        const payment: Omit<Payment, 'id'> = {
          studentId,
          amount: 3500,
          concept: 'Inscripción',
          paymentMethod: i % 2 === 0 ? 'Efectivo' : 'Transferencia',
          date: Timestamp.fromDate(new Date(2024, 7, Math.floor(Math.random() * 28) + 1)) as any,
          status: 'Pagado',
          createdAt: Timestamp.now() as any
        } as any;
        batch.set(paymentRef, payment);

        // Add some monthly tuition payments
        for (let m = 0; m < 3; m++) {
          const tuitionRef = doc(collection(db, 'payments'));
          const monthNames = ['Septiembre', 'Octubre', 'Noviembre'];
          batch.set(tuitionRef, {
            studentId,
            amount: 3500,
            concept: `Colegiatura ${monthNames[m]}`,
            paymentMethod: 'Tarjeta',
            date: Timestamp.fromDate(new Date(2024, 8 + m, Math.floor(Math.random() * 10) + 1)) as any,
            status: Math.random() > 0.2 ? 'Pagado' : 'Pendiente',
            createdAt: Timestamp.now() as any
          });
        }
      }

      // 4. Create Grades for some students
      if (Math.random() > 0.5) {
        const gradeRef = doc(collection(db, 'grades'));
        const studentGrade: Omit<StudentGrade, 'id'> = {
          studentId,
          cycleId: cycleRef.id,
          bimestre: 1,
          subjects: {
            'Español': Math.floor(7 + Math.random() * 4),
            'Matemáticas': Math.floor(6 + Math.random() * 5),
            'Inglés': Math.floor(8 + Math.random() * 3),
            'Ciencias': Math.floor(7 + Math.random() * 4)
          },
          conduct: Math.floor(8 + Math.random() * 3),
          uniform: 10,
          attendance: Math.floor(85 + Math.random() * 15),
          tasksNotDone: Math.floor(Math.random() * 5),
          tardies: Math.floor(Math.random() * 3),
          cleanliness: 10,
          updatedAt: Timestamp.now() as any,
          createdBy: 'system-demo'
        };
        batch.set(gradeRef, studentGrade);
      }
    }

    // 5. Create Expenses
    const expenseCategories = ['Papelería', 'Mantenimiento', 'Servicios', 'Sueldos', 'Limpieza'];
    for (let i = 0; i < 15; i++) {
      const expenseRef = doc(collection(db, 'expenses'));
      const expense: Omit<Expense, 'id'> = {
        description: `Gasto Demo ${i + 1} - ${expenseCategories[Math.floor(Math.random() * expenseCategories.length)]}`,
        amount: Math.floor(500 + Math.random() * 5000),
        category: expenseCategories[Math.floor(Math.random() * expenseCategories.length)],
        date: Timestamp.fromDate(new Date(2024, 10, Math.floor(Math.random() * 28) + 1)) as any,
        status: Math.random() > 0.2 ? 'Pagado' : 'Pendiente',
        createdBy: 'system-demo',
        createdAt: Timestamp.now() as any
      };
      batch.set(expenseRef, expense);
    }

    // 6. Create Announcements
    const announcementTypes: ('info' | 'warning' | 'important')[] = ['info', 'warning', 'important'];
    const announcementTitles = [
      'Bienvenidos al Ciclo 2024-2025',
      'Nueva Plataforma de Pagos',
      'Suspensión de Clases por CTE',
      'Festival de Navidad',
      'Entrega de Boletas 1er Bimestre'
    ];
    for (let i = 0; i < 5; i++) {
      const annRef = doc(collection(db, 'announcements'));
      const ann: Omit<Announcement, 'id'> = {
        title: announcementTitles[i],
        content: `Este es un anuncio de ejemplo para demostrar el funcionamiento del sistema en la sección de ${announcementTitles[i]}.`,
        type: announcementTypes[Math.floor(Math.random() * announcementTypes.length)],
        active: true,
        createdAt: Timestamp.now() as any,
        createdBy: 'system-demo'
      };
      batch.set(annRef, ann);
    }

    // 7. Create Reception Visits
    const visitTypes: ('Alumno' | 'Padre' | 'Visitante')[] = ['Alumno', 'Padre', 'Visitante'];
    const reasons: ('Inscripción' | 'Pago' | 'Información' | 'Otro')[] = ['Inscripción', 'Pago', 'Información', 'Otro'];
    for (let i = 0; i < 15; i++) {
      const visitRef = doc(collection(db, 'reception_visits'));
      const visit: Omit<ReceptionVisit, 'id'> = {
        name: firstNames[Math.floor(Math.random() * firstNames.length)] + ' ' + lastNames[Math.floor(Math.random() * lastNames.length)],
        type: visitTypes[Math.floor(Math.random() * visitTypes.length)],
        reason: reasons[Math.floor(Math.random() * reasons.length)],
        notes: 'Visita de demostración cargada por el sistema.',
        checkInTime: Timestamp.fromDate(new Date(Date.now() - Math.random() * 86400000)) as any, // Within last 24h
        status: i < 10 ? 'Atendido' : 'Pendiente',
        attendedAt: i < 10 ? Timestamp.now() as any : undefined
      };
      batch.set(visitRef, visit);
    }

    // 8. Create Attendance records for some students for today and yesterday
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const statuses: any[] = ['Asistió', 'Asistió', 'Asistió', 'Falta', 'Retardo'];

    students.slice(0, 20).forEach(studentId => {
      [today, yesterday].forEach(date => {
        const attRef = doc(collection(db, 'attendance'));
        batch.set(attRef, {
          studentId,
          cycleId: cycleRef.id,
          date,
          status: statuses[Math.floor(Math.random() * statuses.length)],
          updatedAt: Timestamp.now() as any,
          createdBy: 'system-demo'
        });
      });
    });

    await batch.commit();
    return true;
  } catch (error) {
    console.error("Error loading example data:", error);
    throw error;
  }
};
