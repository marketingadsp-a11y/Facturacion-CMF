import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { Course } from '../../types';
import { Plus, Edit2, Trash2, Save, X, BookOpen } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function CoursesCatalog() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  
  const [formData, setFormData] = useState<Partial<Course>>({
    clave: '', year: '', period: '', name: '', credits: '',
    rvoe: '', educationalLevel: 'Primaria',
    grades: [], subjects: [],
    feeClave: '', feeYear: '', feePeriod: '', feeNumber: '', feeDescription: '',
    satClave: '', satUnit: ''
  });

  const [newGrade, setNewGrade] = useState('');
  const [newSubject, setNewSubject] = useState({ clave: '', name: '' });

  useEffect(() => {
    const q = query(collection(db, 'courses'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setCourses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Course)));
    });
    return () => unsub();
  }, []);

  const handleSave = async () => {
    if (!formData.clave || !formData.name) return;
    try {
      if (editingCourse?.id) {
        await updateDoc(doc(db, 'courses', editingCourse.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'courses'), {
          ...formData,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      setEditingCourse(null);
      setFormData({
        clave: '', year: '', period: '', name: '', credits: '',
        rvoe: '', educationalLevel: 'Primaria',
        grades: [], subjects: [],
        feeClave: '', feeYear: '', feePeriod: '', feeNumber: '', feeDescription: '',
        satClave: '', satUnit: ''
      });
    } catch (error) {
      console.error("Error saving course:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este curso?')) {
      await deleteDoc(doc(db, 'courses', id));
    }
  };

  const addGrade = () => {
    if (newGrade && !formData.grades?.includes(newGrade)) {
      setFormData(prev => ({ ...prev, grades: [...(prev.grades || []), newGrade] }));
      setNewGrade('');
    }
  };

  const removeGrade = (grade: string) => {
    setFormData(prev => ({ ...prev, grades: prev.grades?.filter(g => g !== grade) }));
  };

  const addSubject = () => {
    if (newSubject.clave && newSubject.name) {
      setFormData(prev => ({ 
        ...prev, 
        subjects: [...(prev.subjects || []), { id: Date.now().toString(), ...newSubject }] 
      }));
      setNewSubject({ clave: '', name: '' });
    }
  };

  const removeSubject = (id: string) => {
    setFormData(prev => ({ ...prev, subjects: prev.subjects?.filter(s => s.id !== id) }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Catálogo de Cursos</h2>
          <p className="text-sm text-slate-500">Administra los cursos y sus configuraciones.</p>
        </div>
        <button
          onClick={() => {
            setEditingCourse(null);
            setFormData({
              clave: '', year: '', period: '', name: '', credits: '',
              rvoe: '', educationalLevel: 'Primaria',
              grades: [], subjects: [],
              feeClave: '', feeYear: '', feePeriod: '', feeNumber: '', feeDescription: '',
              satClave: '', satUnit: ''
            });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all text-sm font-bold"
        >
          <Plus size={16} />
          Nuevo Curso
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <th className="px-6 py-4 font-bold">Clave</th>
              <th className="px-6 py-4 font-bold">Nombre</th>
              <th className="px-6 py-4 font-bold">Nivel</th>
              <th className="px-6 py-4 font-bold">RVOE</th>
              <th className="px-6 py-4 font-bold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {courses.map(course => (
              <tr key={course.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 text-sm font-medium text-slate-900">{course.clave}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{course.name}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{course.educationalLevel}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{course.rvoe}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        setEditingCourse(course);
                        setFormData(course);
                        setIsModalOpen(true);
                      }}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(course.id!)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {courses.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500 text-sm">
                  No hay cursos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl my-8">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10 rounded-t-2xl">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="text-blue-600" size={20} />
                {editingCourse ? 'Editar Curso' : 'Nuevo Curso'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-8">
              {/* Información General */}
              <section>
                <h4 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">Información General del Curso</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Clave Curso &lt;F1&gt;</label>
                    <input type="text" value={formData.clave} onChange={e => setFormData({...formData, clave: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Año</label>
                    <input type="text" value={formData.year} onChange={e => setFormData({...formData, year: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Periodo</label>
                    <input type="text" value={formData.period} onChange={e => setFormData({...formData, period: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Nombre Curso &lt;F2&gt;</label>
                    <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Créditos</label>
                    <input type="text" value={formData.credits} onChange={e => setFormData({...formData, credits: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                </div>
              </section>

              {/* Complemento IEDU */}
              <section>
                <h4 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">Complemento Instituciones Educativas .XML</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">RVOE</label>
                    <input type="text" value={formData.rvoe} onChange={e => setFormData({...formData, rvoe: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Nivel Educativo</label>
                    <select value={formData.educationalLevel} onChange={e => setFormData({...formData, educationalLevel: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                      <option value="Preescolar">Preescolar</option>
                      <option value="Primaria">Primaria</option>
                      <option value="Secundaria">Secundaria</option>
                      <option value="Bachillerato">Bachillerato</option>
                      <option value="Licenciatura">Licenciatura</option>
                      <option value="Maestria">Maestría</option>
                      <option value="Doctorado">Doctorado</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Listas */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">Grados</h4>
                  <div className="flex gap-2 mb-3">
                    <input type="text" value={newGrade} onChange={e => setNewGrade(e.target.value)} placeholder="Ej. PRIMERO" className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                    <button onClick={addGrade} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors">Agregar</button>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {formData.grades?.map(grade => (
                      <div key={grade} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-sm text-slate-700">{grade}</span>
                        <button onClick={() => removeGrade(grade)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">Materias</h4>
                  <div className="flex gap-2 mb-3">
                    <input type="text" value={newSubject.clave} onChange={e => setNewSubject({...newSubject, clave: e.target.value})} placeholder="Clave" className="w-20 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                    <input type="text" value={newSubject.name} onChange={e => setNewSubject({...newSubject, name: e.target.value})} placeholder="Nombre" className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                    <button onClick={addSubject} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors">Agregar</button>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {formData.subjects?.map(subject => (
                      <div key={subject.id} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-sm text-slate-700"><span className="font-mono text-xs text-slate-500 mr-2">{subject.clave}</span>{subject.name}</span>
                        <button onClick={() => removeSubject(subject.id)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Tarifa de Cobro */}
              <section>
                <h4 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">Tarifa de Cobro</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Clave</label>
                    <input type="text" value={formData.feeClave} onChange={e => setFormData({...formData, feeClave: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Año</label>
                    <input type="text" value={formData.feeYear} onChange={e => setFormData({...formData, feeYear: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Per</label>
                    <input type="text" value={formData.feePeriod} onChange={e => setFormData({...formData, feePeriod: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">No.</label>
                    <input type="text" value={formData.feeNumber} onChange={e => setFormData({...formData, feeNumber: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Descripción</label>
                    <input type="text" value={formData.feeDescription} onChange={e => setFormData({...formData, feeDescription: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                </div>
              </section>

              {/* Datos Fiscales */}
              <section>
                <h4 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">Datos Fiscales</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Clave SAT</label>
                    <input type="text" value={formData.satClave} onChange={e => setFormData({...formData, satClave: e.target.value})} placeholder="Ej. 86121503" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Unidad SAT</label>
                    <input type="text" value={formData.satUnit} onChange={e => setFormData({...formData, satUnit: e.target.value})} placeholder="Ej. E48" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                </div>
              </section>

            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3 sticky bottom-0">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-xl transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2">
                <Save size={16} />
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
