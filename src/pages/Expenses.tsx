import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, query, orderBy, doc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Expense } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { Plus, Search, DollarSign, Trash2, Edit2, X, AlertCircle, CheckCircle2, Loader2, Filter, Calendar } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';
import { motion, AnimatePresence } from 'motion/react';

const CATEGORIES = [
  'Nómina', 'Servicios (Luz, Agua, Internet)', 'Mantenimiento', 'Papelería', 'Limpieza', 'Renta', 'Impuestos', 'Otros'
];

export default function Expenses() {
  const { hasPermission } = usePermissions();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('Todas');

  // Form State
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'Otros',
    date: format(new Date(), 'yyyy-MM-dd'),
    status: 'Pagado' as 'Pagado' | 'Pendiente'
  });

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'expenses'), orderBy('date', 'desc')), (snap) => {
      setExpenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'expenses');
    });

    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission('expenses', editingExpense ? 'edit' : 'create')) return;

    try {
      const expenseData = {
        description: formData.description,
        amount: parseFloat(formData.amount),
        category: formData.category,
        date: new Date(formData.date),
        status: formData.status,
        updatedAt: serverTimestamp()
      };

      if (editingExpense) {
        await updateDoc(doc(db, 'expenses', editingExpense.id), expenseData);
      } else {
        await addDoc(collection(db, 'expenses'), {
          ...expenseData,
          createdBy: auth.currentUser?.uid,
          createdAt: serverTimestamp()
        });
      }

      setIsModalOpen(false);
      setEditingExpense(null);
      setFormData({
        description: '',
        amount: '',
        category: 'Otros',
        date: format(new Date(), 'yyyy-MM-dd'),
        status: 'Pagado'
      });
    } catch (error) {
      handleFirestoreError(error, editingExpense ? OperationType.UPDATE : OperationType.CREATE, 'expenses');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar este gasto?')) return;
    try {
      await deleteDoc(doc(db, 'expenses', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'expenses');
    }
  };

  const filteredExpenses = expenses.filter(e => 
    (e.description.toLowerCase().includes(searchTerm.toLowerCase()) || e.category.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filterCategory === 'Todas' || e.category === filterCategory)
  );

  const totalExpenses = filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 font-sans tracking-tight max-w-[1600px] mx-auto">
      {/* Header Minimalista y Profesional - Technical Style */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">Contabilidad Institucional</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3 italic">
            Gestión de Gastos
            <span className="not-italic text-[9px] font-black px-2 py-0.5 bg-rose-50 text-rose-600 rounded uppercase tracking-tighter leading-none inline-flex items-center h-4">
              EGRESOS
            </span>
          </h1>
        </div>
        
        {hasPermission('expenses', 'create') && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setEditingExpense(null);
              setFormData({
                description: '',
                amount: '',
                category: 'Otros',
                date: format(new Date(), 'yyyy-MM-dd'),
                status: 'Pagado'
              });
              setIsModalOpen(true);
            }}
            className="bg-slate-950 hover:bg-black text-white px-6 py-2.5 rounded-lg flex items-center gap-2 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-slate-200 transition-all active:scale-95"
          >
            <Plus size={16} />
            Registrar Gasto
          </motion.button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm hover:border-slate-300 transition-all group overflow-hidden relative"
        >
          <div className="flex items-center justify-between mb-4 relative z-10">
             <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Total Egresos</span>
             <div className="w-7 h-7 rounded bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                <DollarSign size={16} />
             </div>
          </div>
          <div className="flex items-baseline gap-1 relative z-10">
            <p className="text-xl font-black text-slate-950 tracking-tighter font-mono">{formatCurrency(totalExpenses)}</p>
          </div>
          <p className="text-[8px] font-black text-slate-400 mt-2 uppercase tracking-widest relative z-10 italic">Corte de Periodo Actual</p>
          <div className="absolute bottom-0 left-0 w-2 h-1 bg-rose-500 transition-all group-hover:w-full" />
        </motion.div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-xl overflow-hidden shadow-slate-50">
        <div className="p-3 border-b border-slate-100 flex flex-col md:flex-row gap-3 bg-slate-50/50">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
            <input
              type="text"
              placeholder="BUSCAR GASTO O CATEGORÍA..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded text-[10px] font-bold uppercase tracking-tight focus:border-slate-900 outline-none transition-all shadow-sm focus:bg-white"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="pl-8 pr-8 py-1.5 bg-white border border-slate-200 rounded text-[10px] font-black uppercase tracking-widest outline-none appearance-none cursor-pointer focus:border-slate-900 shadow-sm"
              >
                <option value="Todas">CATEGORIAS: TODAS</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800">
                <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Fecha de Operación</th>
                <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Descripción de Gasto</th>
                <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Clasificación</th>
                <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Monto NETO</th>
                <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Status</th>
                <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] text-right italic">Panel Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 italic">
              <AnimatePresence mode="popLayout">
                {filteredExpenses.map((expense) => (
                  <motion.tr 
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    key={expense.id} 
                    className="hover:bg-slate-950 hover:text-white transition-all cursor-default not-italic"
                  >
                    <td className="px-4 py-2.5 text-[10px] font-mono group-hover:text-slate-400">
                      {expense.date?.toDate ? format(expense.date.toDate(), 'dd-MM-yy') : '-'}
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="text-[11px] font-bold uppercase tracking-tight leading-none mb-1">{expense.description}</p>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{expense.id.slice(0, 8)}</p>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-sm font-black uppercase tracking-tighter">
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <p className="text-[11px] font-black text-rose-500 font-mono tracking-tighter">-{formatCurrency(expense.amount)}</p>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={cn(
                        "text-[8px] px-1.5 py-0.5 rounded-sm font-black uppercase tracking-widest",
                        expense.status === 'Pagado' ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700"
                      )}>
                        {expense.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {hasPermission('expenses', 'edit') && (
                          <button 
                            onClick={() => {
                              setEditingExpense(expense);
                              setFormData({
                                description: expense.description,
                                amount: expense.amount.toString(),
                                category: expense.category,
                                date: expense.date?.toDate ? format(expense.date.toDate(), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
                                status: expense.status
                              });
                              setIsModalOpen(true);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-400 transition-all font-black uppercase text-[8px]"
                          >
                            <Edit2 size={12} />
                          </button>
                        )}
                        {hasPermission('expenses', 'delete') && (
                          <button 
                            onClick={() => handleDelete(expense.id)}
                            className="p-1 text-slate-400 hover:text-rose-400 transition-all"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {filteredExpenses.length === 0 && (
            <div className="p-12 text-center">
              <div className="w-10 h-10 bg-slate-50 rounded flex items-center justify-center mx-auto mb-2 text-slate-200">
                <AlertCircle size={24} />
              </div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">Cero Coincidencias en Gasto</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 font-display">
                  <DollarSign className="text-blue-600" />
                  {editingExpense ? 'Editar Gasto' : 'Registrar Nuevo Gasto'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 uppercase tracking-wider">Descripción *</label>
                  <input
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Ej. Pago de luz Marzo 2024"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 uppercase tracking-wider">Monto *</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={formData.amount}
                        onChange={(e) => setFormData({...formData, amount: e.target.value})}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 uppercase tracking-wider">Categoría *</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 uppercase tracking-wider">Fecha *</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input
                        type="date"
                        required
                        value={formData.date}
                        onChange={(e) => setFormData({...formData, date: e.target.value})}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 uppercase tracking-wider">Estado *</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value as 'Pagado' | 'Pendiente'})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="Pagado">Pagado</option>
                      <option value="Pendiente">Pendiente</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3">
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
                    {editingExpense ? 'Guardar Cambios' : 'Registrar Gasto'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
