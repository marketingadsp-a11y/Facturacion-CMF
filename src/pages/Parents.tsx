import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { AppUser, Student } from '../types';
import { 
  Users, 
  Search, 
  Edit2, 
  Trash2, 
  Mail, 
  Phone, 
  Plus, 
  X, 
  UserPlus, 
  GraduationCap,
  ChevronRight,
  Shield,
  Link as LinkIcon,
  Unlink,
  AlertCircle,
  X as XIcon,
  Heart,
  UserRound
} from 'lucide-react';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';
import { motion, AnimatePresence } from 'motion/react';
import { usePermissions } from '../hooks/usePermissions';

export default function Parents() {
  const { hasPermission } = usePermissions();
  const [parents, setParents] = useState<AppUser[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [selectedParent, setSelectedParent] = useState<AppUser | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    phone: ''
  });

  useEffect(() => {
    const parentsQuery = query(collection(db, 'users'), where('role', '==', 'Padre'));
    const unsubParents = onSnapshot(parentsQuery, (snap) => {
      setParents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
    });

    return () => {
      unsubParents();
      unsubStudents();
    };
  }, []);

  const handleEditParent = (parent: AppUser) => {
    setSelectedParent(parent);
    setEditFormData({
      name: parent.name,
      email: parent.email,
      phone: (parent as any).phone || ''
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateParent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParent) return;

    try {
      await updateDoc(doc(db, 'users', selectedParent.id), {
        name: editFormData.name,
        phone: editFormData.phone
      });
      setIsEditModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${selectedParent.id}`);
    }
  };

  const handleDeleteParent = async (parent: AppUser) => {
    if (window.confirm(`¿Estás seguro de eliminar al padre ${parent.name}? Esto no eliminará a los alumnos vinculados.`)) {
      try {
        await deleteDoc(doc(db, 'users', parent.id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${parent.id}`);
      }
    }
  };

  const handleUnlinkStudent = async (studentId: string) => {
    if (window.confirm('¿Estás seguro de desvincular a este alumno?')) {
      try {
        await updateDoc(doc(db, 'students', studentId), {
          parentEmail: ''
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `students/${studentId}`);
      }
    }
  };

  const filteredParents = parents.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12 font-sans tracking-tight max-w-[1600px] mx-auto">
      {/* Compact Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Cuentas de Familia</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3 italic">
            Gestión de Padres
            <span className="not-italic text-[9px] font-black px-2 py-0.5 bg-slate-100 text-slate-600 rounded uppercase tracking-tighter leading-none inline-flex items-center h-4">
              {parents.length} Usuarios
            </span>
          </h1>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
            <input
              type="text"
              placeholder="BUSCAR PADRE..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:border-slate-900 outline-none transition-all text-[10px] font-bold uppercase tracking-wide"
            />
          </div>
        </div>
      </div>

      {/* Metrics Row - Compact */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-3 rounded-md border border-slate-200 shadow-sm">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Familia</p>
          <p className="text-xl font-bold text-slate-900 tabular-nums">{parents.length}</p>
        </div>
        <div className="bg-white p-3 rounded-md border border-slate-200 shadow-sm">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Alumnos Cubiertos</p>
          <div className="flex items-end gap-2">
            <p className="text-xl font-bold text-slate-900 tabular-nums">
              {students.filter(s => s.parentEmail).length}
            </p>
            <span className="text-[9px] text-slate-400 font-bold uppercase pb-1 leading-none">
              / {students.length} Total
            </span>
          </div>
        </div>
        <div className="bg-white p-3 rounded-md border border-slate-200 shadow-sm">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Sin Vincular</p>
          <p className={cn(
            "text-xl font-bold tabular-nums",
            parents.filter(p => !students.some(s => s.parentEmail === p.email)).length > 0 ? "text-rose-600" : "text-slate-900"
          )}>
            {parents.filter(p => !students.some(s => s.parentEmail === p.email)).length}
          </p>
        </div>
        <div className="bg-white p-3 rounded-md border border-slate-200 shadow-sm flex items-center justify-center border-dashed border-slate-300">
           <UserRound className="text-slate-200" size={24} />
        </div>
      </div>

      {/* Parents Table */}
      <div className="compact-card shadow-lg shadow-slate-100 overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)]">
          <table className="w-full text-left border-collapse table-auto min-w-max">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-[0.1em] border-b border-slate-200">
                <th className="px-4 py-3 border-r border-slate-100 italic whitespace-nowrap">Padre / Tutor</th>
                <th className="px-4 py-3 border-r border-slate-100 italic whitespace-nowrap">Correo de Acceso</th>
                <th className="px-4 py-3 border-r border-slate-100 text-center italic whitespace-nowrap">Teléfono</th>
                <th className="px-4 py-3 border-r border-slate-100 italic whitespace-nowrap">Hijos Vinculados</th>
                <th className="px-4 py-3 text-right italic whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredParents.length > 0 ? (
                filteredParents.map((parent) => {
                  const linkedStudents = students.filter(s => s.parentEmail === parent.email);
                  return (
                    <tr 
                      key={parent.id} 
                      className="group hover:bg-slate-950 hover:text-white transition-all cursor-default text-[10px]"
                    >
                      <td className="px-4 py-3 border-r border-slate-100 group-hover:border-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded bg-slate-100 group-hover:bg-slate-800 flex items-center justify-center font-black text-slate-600 group-hover:text-slate-300 transition-colors border border-slate-200 group-hover:border-slate-700">
                            {parent.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold uppercase tracking-tight">{parent.name}</span>
                            <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest mt-0.5">Titular Familia</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 border-r border-slate-100 font-mono text-slate-500 group-hover:text-slate-400 group-hover:border-slate-800">
                        {parent.email}
                      </td>
                      <td className="px-4 py-3 border-r border-slate-100 text-center font-mono group-hover:border-slate-800">
                        {(parent as any).phone || '—'}
                      </td>
                      <td className="px-4 py-3 border-r border-slate-100 group-hover:border-slate-800">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {linkedStudents.map(student => (
                            <div key={student.id} className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 group-hover:bg-slate-900 group-hover:border-slate-700 rounded px-1.5 py-0.5 transition-all">
                              <span className="text-[9px] font-bold text-slate-700 group-hover:text-slate-200 uppercase tracking-tighter truncate max-w-[100px]">
                                {student.name} {student.lastName?.split(' ')[0]}
                              </span>
                              {hasPermission('parents', 'manage') && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUnlinkStudent(student.id);
                                  }}
                                  className="text-slate-400 hover:text-rose-500 transition-colors"
                                >
                                  <X size={10} strokeWidth={3} />
                                </button>
                              )}
                            </div>
                          ))}
                          
                          {hasPermission('parents', 'manage') && (
                            <button 
                              onClick={() => {
                                setSelectedParent(parent);
                                setIsLinkModalOpen(true);
                              }}
                              className="w-5 h-5 rounded border border-slate-200 group-hover:border-slate-700 text-slate-400 hover:text-blue-500 flex items-center justify-center transition-all hover:bg-slate-100 group-hover:hover:bg-slate-800"
                            >
                              <Plus size={10} />
                            </button>
                          )}
                          
                          {linkedStudents.length === 0 && (
                            <div className="flex items-center gap-1 text-[9px] text-rose-500 font-black uppercase tracking-tighter italic">
                              <AlertCircle size={10} /> Sin alumnos vinculados
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {hasPermission('parents', 'manage') && (
                            <>
                              <button 
                                onClick={() => handleEditParent(parent)}
                                className="p-1.5 text-slate-400 hover:text-blue-400 transition-all"
                                title="Editar"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button 
                                onClick={() => handleDeleteParent(parent)}
                                className="p-1.5 text-slate-400 hover:text-rose-500 transition-all"
                                title="Eliminar"
                              >
                                <Trash2 size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest italic">
                    Sin registros encontrados con la búsqueda actual
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal - Compact */}
      <AnimatePresence>
        {isEditModalOpen && selectedParent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white w-full max-w-sm rounded overflow-hidden border border-slate-200"
            >
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h2 className="text-xs font-black text-slate-900 tracking-widest uppercase italic">Editar Perfil Tutor</h2>
                <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-900">
                  <XIcon size={14} />
                </button>
              </div>
              
              <form onSubmit={handleUpdateParent} className="p-4 space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Nombre Completo</label>
                  <input
                    required
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:border-slate-900 outline-none transition-all font-bold text-[11px] uppercase"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Cuenta (Inmutable)</label>
                  <input
                    disabled
                    value={editFormData.email}
                    className="w-full px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-md text-slate-400 font-mono text-[11px] cursor-not-allowed"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Teléfono Directo</label>
                  <input
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:border-slate-900 outline-none transition-all font-mono font-bold text-[11px]"
                    placeholder="10 DÍGITOS"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-1.5 text-[9px] font-black text-slate-500 hover:text-slate-900 uppercase tracking-widest"
                  >
                    Cerrar
                  </button>
                  <button
                    type="submit"
                    className="bg-slate-950 text-white px-6 py-1.5 rounded text-[9px] font-black uppercase tracking-widest shadow-sm hover:bg-slate-900"
                  >
                    Guardar Cambios
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Link Student Modal */}
      <AnimatePresence>
        {isLinkModalOpen && selectedParent && (
          <LinkStudentModal 
            parent={selectedParent} 
            onClose={() => setIsLinkModalOpen(false)} 
            students={students}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function LinkStudentModal({ parent, onClose, students }: { parent: AppUser, onClose: () => void, students: Student[] }) {
  const [search, setSearch] = useState('');
  
  const availableStudents = students.filter(s => 
    s.parentEmail !== parent.email && 
    (`${s.name} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()) || s.curp?.toLowerCase().includes(search.toLowerCase()))
  );

  const handleLink = async (studentId: string) => {
    try {
      await updateDoc(doc(db, 'students', studentId), {
        parentEmail: parent.email
      });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `students/${studentId}`);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded overflow-hidden border border-slate-200 shadow-2xl">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-xs font-black text-black tracking-widest uppercase italic flex items-center gap-2 font-black">
              <LinkIcon size={12} strokeWidth={3} className="text-blue-600 not-italic" />
              Vincular Alumno
            </h2>
            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Parentesco con: {parent.name}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded transition-colors">
            <XIcon size={14} />
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
            <input
              type="text"
              placeholder="BUSCAR NOMBRE O CURP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:border-slate-900 outline-none text-[10px] font-bold uppercase tracking-widest"
            />
          </div>

          <div className="max-h-[250px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {availableStudents.length > 0 ? (
              availableStudents.map(student => (
                <button
                  key={student.id}
                  onClick={() => handleLink(student.id)}
                  className="w-full flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-950 rounded border border-slate-100 transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-white group-hover:bg-slate-800 flex items-center justify-center font-black text-[9px] text-slate-400 border border-slate-200 transition-colors">
                      {student.name.charAt(0)}
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-bold text-slate-900 group-hover:text-white uppercase tracking-tight">{student.name} {student.lastName}</p>
                      <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest group-hover:text-slate-500">{student.level} - {student.grade}{student.group}</p>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-white transition-colors" />
                </button>
              ))
            ) : (
              <div className="py-8 text-center bg-slate-50/50 italic border border-dashed border-slate-200 rounded">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">No se encontraron alumnos<br/>disponibles para vincular</p>
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-[9px] font-black text-slate-500 hover:text-slate-900 uppercase tracking-widest"
          >
            Cerrar Ventana
          </button>
        </div>
      </div>
    </div>
  );
}
