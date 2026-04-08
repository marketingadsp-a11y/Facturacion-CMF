import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Student, Payment, AppSettings, SchoolCycle } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { Plus, Search, Edit2, Trash2, UserPlus, X, GraduationCap, Mail, Phone, FileText, MapPin, History, Filter, ChevronRight, Calendar, CreditCard, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { calculateStudentDebts } from '../lib/paymentUtils';

export default function Students() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [cycles, setCycles] = useState<SchoolCycle[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterDebt, setFilterDebt] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    lastName: '',
    curp: '',
    email: '',
    phone: '',
    parentEmail: '',
    level: 'Primaria',
    grade: '',
    group: '',
    rfc: '',
    billingName: '',
    billingAddress: '',
    zipCode: '',
    taxSystem: '605',
    registrationCode: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'students'), orderBy('lastName', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      setStudents(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'students');
    });

    const pUnsub = onSnapshot(collection(db, 'payments'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
      setPayments(data);
    });

    const sUnsub = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) setSettings(snap.data() as AppSettings);
    });

    const cUnsub = onSnapshot(collection(db, 'cycles'), (snap) => {
      setCycles(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SchoolCycle)));
    });

    return () => {
      unsub();
      pUnsub();
      sUnsub();
      cUnsub();
    };
  }, []);

  const currentCycle = cycles.find(c => c.id === settings?.currentCycleId) || null;

  const generateRegistrationCode = () => {
    return Math.floor(10000 + Math.random() * 90000).toString();
  };

  const handleOpenModal = (student?: Student) => {
    if (student) {
      setEditingStudent(student);
      setFormData({
        name: student.name || '',
        lastName: student.lastName || '',
        curp: student.curp || '',
        email: student.email || '',
        phone: student.phone || '',
        parentEmail: student.parentEmail || '',
        level: student.level || 'Primaria',
        grade: student.grade || '',
        group: student.group || '',
        rfc: student.rfc || '',
        billingName: student.billingName || '',
        billingAddress: student.billingAddress || '',
        zipCode: student.zipCode || '',
        taxSystem: student.taxSystem || '605',
        registrationCode: student.registrationCode || generateRegistrationCode()
      });
    } else {
      setEditingStudent(null);
      setFormData({
        name: '', lastName: '', curp: '', email: '', phone: '', parentEmail: '', level: 'Primaria', grade: '', group: '', rfc: '', billingName: '', billingAddress: '', zipCode: '', taxSystem: '605', registrationCode: generateRegistrationCode()
      });
    }
    setIsModalOpen(true);
  };

  const handleOpenHistory = (student: Student) => {
    setSelectedStudent(student);
    setIsHistoryModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let dataToSave = {
        ...formData,
        parentEmail: formData.parentEmail.toLowerCase().trim(),
        updatedAt: serverTimestamp()
      };

      // Validate generic RFC tax system
      if ((formData.rfc === 'XAXX010101000' || formData.rfc === 'XEXX010101000') && formData.taxSystem !== '616') {
        dataToSave.taxSystem = '616';
      }

      if (editingStudent) {
        await updateDoc(doc(db, 'students', editingStudent.id), dataToSave);
      } else {
        await addDoc(collection(db, 'students'), {
          ...dataToSave,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, editingStudent ? OperationType.UPDATE : OperationType.CREATE, 'students');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de eliminar a este alumno?')) {
      try {
        await deleteDoc(doc(db, 'students', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `students/${id}`);
      }
    }
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = `${s.name} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.curp?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLevel = !filterLevel || s.level === filterLevel;
    const matchesGrade = !filterGrade || s.grade === filterGrade;
    const matchesGroup = !filterGroup || s.group === filterGroup;
    
    if (filterDebt) {
      const debtStatus = calculateStudentDebts(s, payments, currentCycle, settings);
      if (!debtStatus.hasDebt) return false;
    }

    return matchesSearch && matchesLevel && matchesGrade && matchesGroup;
  });

  const studentPayments = selectedStudent 
    ? payments.filter(p => p.studentId === selectedStudent.id).sort((a, b) => b.date.toMillis() - a.date.toMillis())
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestión de Alumnos</h1>
          <p className="text-slate-500">Administra la información de los estudiantes inscritos.</p>
        </div>
        {hasPermission('students', 'create') && (
          <button
            onClick={() => handleOpenModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 font-semibold shadow-lg shadow-blue-100 transition-all active:scale-95"
          >
            <UserPlus size={18} />
            Nuevo Alumno
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por nombre o CURP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-400" />
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los Niveles</option>
            <option value="Preescolar">Preescolar</option>
            <option value="Primaria">Primaria</option>
            <option value="Secundaria">Secundaria</option>
            <option value="Bachillerato">Bachillerato</option>
          </select>

          <select
            value={filterGrade}
            onChange={(e) => setFilterGrade(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los Grados</option>
            {Array.from(new Set(students.map(s => s.grade))).sort().map(grade => (
              <option key={grade} value={grade}>{grade}</option>
            ))}
          </select>

          <select
            value={filterGroup}
            onChange={(e) => setFilterGroup(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los Grupos</option>
            {Array.from(new Set(students.map(s => s.group))).filter(Boolean).sort().map(group => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>

          <button
            onClick={() => setFilterDebt(!filterDebt)}
            className={cn(
              "px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all",
              filterDebt ? "bg-red-100 text-red-600 border border-red-200" : "bg-slate-50 text-slate-600 border border-slate-200"
            )}
          >
            <AlertCircle size={14} />
            {filterDebt ? 'Solo con Adeudo' : 'Ver Adeudos'}
          </button>

          {(filterLevel || filterGrade || filterGroup || searchTerm || filterDebt) && (
            <button
              onClick={() => {
                setFilterLevel('');
                setFilterGrade('');
                setFilterGroup('');
                setSearchTerm('');
                setFilterDebt(false);
              }}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
              title="Limpiar filtros"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)]">
          <table className="w-full text-left border-collapse table-fixed min-w-[1200px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider border-b border-slate-200">
                <th className="px-3 py-2 border-r border-slate-200 w-48">Apellidos</th>
                <th className="px-3 py-2 border-r border-slate-200 w-40">Nombre(s)</th>
                <th className="px-3 py-2 border-r border-slate-200 w-36">CURP</th>
                <th className="px-3 py-2 border-r border-slate-200 w-28">Nivel</th>
                <th className="px-3 py-2 border-r border-slate-200 w-20">Grado</th>
                <th className="px-3 py-2 border-r border-slate-200 w-16 text-center">Gpo</th>
                <th className="px-3 py-2 border-r border-slate-200 w-24 text-center">Cód. Reg</th>
                <th className="px-3 py-2 border-r border-slate-200 w-48">Correo Padre</th>
                <th className="px-3 py-2 border-r border-slate-200 w-32">Estatus Pago</th>
                <th className="px-3 py-2 w-28 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => {
                  const debtStatus = calculateStudentDebts(student, payments, currentCycle, settings);
                  return (
                    <tr key={student.id} className="hover:bg-blue-50/30 transition-colors group text-[11px]">
                      <td className="px-3 py-1.5 border-r border-slate-100 font-bold text-slate-900 truncate">
                        {student.lastName}
                      </td>
                      <td className="px-3 py-1.5 border-r border-slate-100 text-slate-700 truncate">
                        {student.name}
                      </td>
                      <td className="px-3 py-1.5 border-r border-slate-100 font-mono text-slate-500 uppercase">
                        {student.curp || '-'}
                      </td>
                      <td className="px-3 py-1.5 border-r border-slate-100">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter",
                          student.level === 'Preescolar' ? "bg-purple-100 text-purple-700" :
                          student.level === 'Primaria' ? "bg-blue-100 text-blue-700" :
                          student.level === 'Secundaria' ? "bg-orange-100 text-orange-700" : "bg-indigo-100 text-indigo-700"
                        )}>
                          {student.level}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 border-r border-slate-100 text-center font-bold text-slate-600">
                        {student.grade}
                      </td>
                      <td className="px-3 py-1.5 border-r border-slate-100 text-center font-bold text-slate-600">
                        {student.group || '-'}
                      </td>
                      <td className="px-3 py-1.5 border-r border-slate-100 text-center font-mono font-bold text-emerald-600">
                        {student.registrationCode || '-'}
                      </td>
                      <td className="px-3 py-1.5 border-r border-slate-100 text-slate-500 truncate">
                        {student.parentEmail || '-'}
                      </td>
                      <td className="px-3 py-1.5 border-r border-slate-100">
                        {debtStatus.hasDebt ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-red-600 font-black">
                              ${debtStatus.totalDebt.toLocaleString()}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="text-emerald-600 font-bold">AL DÍA</span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {hasPermission('payments', 'create') && (
                            <button 
                              onClick={() => navigate('/payments', { state: { studentId: student.id } })}
                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                              title="Pago"
                            >
                              <CreditCard size={14} />
                            </button>
                          )}
                          {hasPermission('students', 'viewHistory') && (
                            <button 
                              onClick={() => handleOpenHistory(student)}
                              className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-all"
                              title="Historial"
                            >
                              <History size={14} />
                            </button>
                          )}
                          {hasPermission('students', 'edit') && (
                            <button 
                              onClick={() => handleOpenModal(student)}
                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                              title="Editar"
                            >
                              <Edit2 size={14} />
                            </button>
                          )}
                          {hasPermission('students', 'delete') && (
                            <button 
                              onClick={() => handleDelete(student.id)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                              title="Eliminar"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-slate-400 text-sm">
                    No se encontraron alumnos con los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <GraduationCap className="text-blue-600" />
                {editingStudent ? 'Editar Alumno' : 'Nuevo Alumno'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Información Básica</h3>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre(s) *</label>
                    <input
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Apellidos *</label>
                    <input
                      required
                      value={formData.lastName}
                      onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Nivel *</label>
                      <select
                        required
                        value={formData.level}
                        onChange={(e) => setFormData({...formData, level: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="Preescolar">Preescolar</option>
                        <option value="Primaria">Primaria</option>
                        <option value="Secundaria">Secundaria</option>
                        <option value="Bachillerato">Bachillerato</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">CURP</label>
                      <input
                        value={formData.curp}
                        onChange={(e) => setFormData({...formData, curp: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Grado *</label>
                      <input
                        required
                        value={formData.grade}
                        onChange={(e) => setFormData({...formData, grade: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Ej. 1ro"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Grupo</label>
                      <input
                        value={formData.group}
                        onChange={(e) => setFormData({...formData, group: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Ej. A"
                      />
                    </div>
                  </div>
                </div>

                {/* Contact & Billing */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Contacto y Facturación</h3>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Correo Electrónico Alumno</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 text-blue-600">Correo del Padre (Acceso Portal) *</label>
                    <input
                      type="email"
                      value={formData.parentEmail}
                      onChange={(e) => setFormData({...formData, parentEmail: e.target.value})}
                      className="w-full px-4 py-2 bg-blue-50/50 border border-blue-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="correo@padre.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">RFC</label>
                    <input
                      value={formData.rfc}
                      onChange={(e) => setFormData({...formData, rfc: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Razón Social Facturación</label>
                    <input
                      value={formData.billingName}
                      onChange={(e) => setFormData({...formData, billingName: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Código Postal</label>
                    <input
                      value={formData.zipCode}
                      onChange={(e) => setFormData({...formData, zipCode: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Régimen Fiscal (SAT)</label>
                    <select
                      value={formData.taxSystem}
                      onChange={(e) => setFormData({...formData, taxSystem: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="601">601 - General de Ley Personas Morales</option>
                      <option value="603">603 - Personas Morales con Fines no Lucrativos</option>
                      <option value="605">605 - Sueldos y Salarios</option>
                      <option value="606">606 - Arrendamiento</option>
                      <option value="612">612 - Personas Físicas con Actividades Empresariales</option>
                      <option value="616">616 - Sin obligaciones fiscales</option>
                      <option value="626">626 - Régimen Simplificado de Confianza (RESICO)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 text-emerald-600">Código de Registro (5 dígitos) *</label>
                    <input
                      required
                      maxLength={5}
                      value={formData.registrationCode}
                      onChange={(e) => setFormData({...formData, registrationCode: e.target.value.replace(/\D/g, '').slice(0, 5)})}
                      className="w-full px-4 py-2 bg-emerald-50/50 border border-emerald-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono font-bold text-center tracking-widest"
                      placeholder="12345"
                    />
                    <p className="text-[9px] text-slate-400 mt-1 italic">
                      Este código vincula al padre con el alumno. Úsalo para hermanos.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-100 transition-all active:scale-95"
                >
                  {editingStudent ? 'Guardar Cambios' : 'Registrar Alumno'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {isHistoryModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <History className="text-emerald-600" />
                  Historial de Pagos
                </h2>
                <p className="text-xs text-slate-500 font-medium">{selectedStudent.name} {selectedStudent.lastName}</p>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {studentPayments.length > 0 ? (
                <div className="space-y-4">
                  {studentPayments.map((payment) => (
                    <div key={payment.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-white rounded-xl border border-slate-200 text-blue-600">
                          <CreditCard size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{payment.concept}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                              <Calendar size={10} /> {format(payment.date.toDate(), 'dd MMM yyyy', { locale: es })}
                            </span>
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold">
                              {payment.paymentMethod}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-slate-900">${payment.amount.toLocaleString()}</p>
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Pagado</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                    <CreditCard size={32} />
                  </div>
                  <p className="text-slate-500 font-medium">Este alumno no tiene pagos registrados.</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl shadow-lg shadow-slate-200 transition-all active:scale-95"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
