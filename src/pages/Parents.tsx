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
  Unlink
} from 'lucide-react';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';

export default function Parents() {
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestión de Padres</h1>
          <p className="text-slate-500">Administra las cuentas de los padres de familia y sus vinculaciones.</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por nombre o correo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
          />
        </div>
      </div>

      {/* Parents List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredParents.map((parent) => {
          const linkedStudents = students.filter(s => s.parentEmail === parent.email);
          return (
            <div key={parent.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all">
              <div className="p-6 flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xl">
                    {parent.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{parent.name}</h3>
                    <div className="flex flex-col gap-1 mt-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Mail size={12} /> {parent.email}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Phone size={12} /> {(parent as any).phone || 'Sin teléfono'}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleEditParent(parent)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleDeleteParent(parent)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="px-6 pb-6">
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <GraduationCap size={14} /> Hijos Vinculados ({linkedStudents.length})
                    </h4>
                    <button 
                      onClick={() => {
                        setSelectedParent(parent);
                        setIsLinkModalOpen(true);
                      }}
                      className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Plus size={12} /> Vincular Hijo
                    </button>
                  </div>
                  
                  {linkedStudents.length > 0 ? (
                    <div className="space-y-2">
                      {linkedStudents.map(student => (
                        <div key={student.id} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                              {student.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-900">{student.name} {student.lastName}</p>
                              <p className="text-[10px] text-slate-500">{student.level} - {student.grade} {student.group}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleUnlinkStudent(student.id)}
                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="Desvincular"
                          >
                            <Unlink size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-2 italic">No hay hijos vinculados a esta cuenta.</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && selectedParent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="text-blue-600" />
                Editar Padre
              </h2>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleUpdateParent} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre Completo</label>
                <input
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Correo (No editable)</label>
                <input
                  disabled
                  value={editFormData.email}
                  className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono / Celular</label>
                <input
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="10 dígitos"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-6 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-100 transition-all active:scale-95"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Link Student Modal */}
      {isLinkModalOpen && selectedParent && (
        <LinkStudentModal 
          parent={selectedParent} 
          onClose={() => setIsLinkModalOpen(false)} 
          students={students}
        />
      )}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <LinkIcon className="text-blue-600" />
              Vincular Alumno
            </h2>
            <p className="text-xs text-slate-500">Vincular a {parent.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar alumno por nombre o CURP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>

          <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
            {availableStudents.length > 0 ? (
              availableStudents.map(student => (
                <button
                  key={student.id}
                  onClick={() => handleLink(student.id)}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-blue-50 rounded-xl border border-slate-100 hover:border-blue-200 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white text-slate-400 group-hover:text-blue-600 flex items-center justify-center font-bold text-xs border border-slate-200">
                      {student.name.charAt(0)}
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-bold text-slate-900">{student.name} {student.lastName}</p>
                      <p className="text-[10px] text-slate-500">{student.level} - {student.grade} {student.group}</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-500" />
                </button>
              ))
            ) : (
              <p className="text-xs text-slate-400 text-center py-8">No se encontraron alumnos disponibles.</p>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
