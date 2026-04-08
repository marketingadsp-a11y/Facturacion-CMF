import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { ChargeCatalog, ChargeItem } from '../../types';
import { Plus, Edit2, Trash2, Save, X, CreditCard, Download } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

export default function ChargesCatalog() {
  const [catalogs, setCatalogs] = useState<ChargeCatalog[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCatalog, setEditingCatalog] = useState<ChargeCatalog | null>(null);
  
  const [formData, setFormData] = useState<Partial<ChargeCatalog>>({
    clave: '', year: '', period: '', chargeNumber: '', description: '',
    charges: []
  });

  const [newCharge, setNewCharge] = useState<Partial<ChargeItem>>({
    concept: '', numberOfCharges: 1, type: '1', startDate: '', amount: 0
  });

  useEffect(() => {
    const q = query(collection(db, 'chargeCatalogs'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setCatalogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as ChargeCatalog)));
    });
    return () => unsub();
  }, []);

  const handleSave = async () => {
    if (!formData.clave || !formData.description) return;
    try {
      if (editingCatalog?.id) {
        await updateDoc(doc(db, 'chargeCatalogs', editingCatalog.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'chargeCatalogs'), {
          ...formData,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      setEditingCatalog(null);
      setFormData({
        clave: '', year: '', period: '', chargeNumber: '', description: '', charges: []
      });
    } catch (error) {
      console.error("Error saving catalog:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este catálogo de cobros?')) {
      await deleteDoc(doc(db, 'chargeCatalogs', id));
    }
  };

  const addCharge = () => {
    if (newCharge.concept && newCharge.amount && newCharge.startDate) {
      setFormData(prev => ({
        ...prev,
        charges: [...(prev.charges || []), { id: Date.now().toString(), ...newCharge } as ChargeItem]
      }));
      setNewCharge({ concept: '', numberOfCharges: 1, type: '1', startDate: '', amount: 0 });
    }
  };

  const removeCharge = (id: string) => {
    setFormData(prev => ({ ...prev, charges: prev.charges?.filter(c => c.id !== id) }));
  };

  const totalAmount = formData.charges?.reduce((sum, charge) => sum + (charge.amount * charge.numberOfCharges), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Catálogo de Cobros</h2>
          <p className="text-sm text-slate-500">Administra las estructuras y planes de cobro.</p>
        </div>
        <button
          onClick={() => {
            setEditingCatalog(null);
            setFormData({
              clave: '', year: '', period: '', chargeNumber: '', description: '', charges: []
            });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all text-sm font-bold"
        >
          <Plus size={16} />
          Nuevo Catálogo
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <th className="px-6 py-4 font-bold">Clave</th>
              <th className="px-6 py-4 font-bold">Descripción</th>
              <th className="px-6 py-4 font-bold">Año / Per</th>
              <th className="px-6 py-4 font-bold">Cargos</th>
              <th className="px-6 py-4 font-bold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {catalogs.map(catalog => (
              <tr key={catalog.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 text-sm font-medium text-slate-900">{catalog.clave}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{catalog.description}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{catalog.year} / {catalog.period}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{catalog.charges?.length || 0} cargos</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        setEditingCatalog(catalog);
                        setFormData(catalog);
                        setIsModalOpen(true);
                      }}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(catalog.id!)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {catalogs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500 text-sm">
                  No hay catálogos de cobro registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white w-full max-w-5xl rounded-2xl shadow-xl my-8">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10 rounded-t-2xl">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="text-blue-600" size={20} />
                {editingCatalog ? 'Editar Catálogo de Cobros' : 'Nuevo Catálogo de Cobros'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-8">
              {/* Datos de Identificación */}
              <section>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Datos de Identificación del Cobro (Curso)</h4>
                  <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors">
                    <Download size={14} /> Importar
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Clave Cobro &lt;F1&gt;</label>
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
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Cobro #</label>
                    <input type="text" value={formData.chargeNumber} onChange={e => setFormData({...formData, chargeNumber: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Descripción &lt;F2&gt;</label>
                    <input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                </div>
              </section>

              {/* Gestión de Cargos */}
              <section>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Detalle de los Cargos</h4>
                </div>
                
                {/* Add Charge Form */}
                <div className="flex flex-wrap md:flex-nowrap gap-2 mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Concepto Cargo</label>
                    <input type="text" value={newCharge.concept} onChange={e => setNewCharge({...newCharge, concept: e.target.value})} placeholder="Ej. COLEGIATURA" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div className="w-24">
                    <label className="block text-xs font-medium text-slate-700 mb-1">No. Cobros</label>
                    <input type="number" min="1" value={newCharge.numberOfCharges} onChange={e => setNewCharge({...newCharge, numberOfCharges: parseInt(e.target.value) || 1})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div className="w-32">
                    <label className="block text-xs font-medium text-slate-700 mb-1">* Tipo</label>
                    <select value={newCharge.type} onChange={e => setNewCharge({...newCharge, type: e.target.value as any})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                      <option value="1">1 (Mensual)</option>
                      <option value="2">2 (Quincenal)</option>
                      <option value="3">3 (Semanal)</option>
                    </select>
                  </div>
                  <div className="w-40">
                    <label className="block text-xs font-medium text-slate-700 mb-1">A partir de: Fecha</label>
                    <input type="date" value={newCharge.startDate} onChange={e => setNewCharge({...newCharge, startDate: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div className="w-32">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Monto</label>
                    <input type="number" min="0" step="0.01" value={newCharge.amount} onChange={e => setNewCharge({...newCharge, amount: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div className="flex items-end">
                    <button onClick={addCharge} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold hover:bg-slate-900 transition-colors h-[38px]">
                      Agregar
                    </button>
                  </div>
                </div>

                {/* Charges Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider">
                        <th className="px-4 py-3 font-bold">Concepto Cargo</th>
                        <th className="px-4 py-3 font-bold text-center">No. Cobros</th>
                        <th className="px-4 py-3 font-bold text-center">* Tipo</th>
                        <th className="px-4 py-3 font-bold">A partir de</th>
                        <th className="px-4 py-3 font-bold text-right">Monto</th>
                        <th className="px-4 py-3 font-bold text-right">Subtotal</th>
                        <th className="px-4 py-3 font-bold text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {formData.charges?.map(charge => (
                        <tr key={charge.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm font-medium text-slate-900">{charge.concept}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 text-center">{charge.numberOfCharges}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 text-center">{charge.type}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{charge.startDate}</td>
                          <td className="px-4 py-3 text-sm text-slate-900 text-right">{formatCurrency(charge.amount)}</td>
                          <td className="px-4 py-3 text-sm font-bold text-slate-900 text-right">{formatCurrency(charge.amount * charge.numberOfCharges)}</td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => removeCharge(charge.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(!formData.charges || formData.charges.length === 0) && (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-slate-500 text-sm">
                            No hay cargos agregados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Totales y Leyendas */}
              <section className="flex flex-col md:flex-row justify-between items-start gap-6 bg-slate-50 p-6 rounded-xl border border-slate-200">
                <div>
                  <h5 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">Leyenda de Tipo (*)</h5>
                  <ul className="text-sm text-slate-600 space-y-1">
                    <li><span className="font-mono font-bold mr-2">1</span> = Mensual</li>
                    <li><span className="font-mono font-bold mr-2">2</span> = Quincenal</li>
                    <li><span className="font-mono font-bold mr-2">3</span> = Semanal</li>
                  </ul>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Total de Cobranza</p>
                  <p className="text-3xl font-black text-blue-600">{formatCurrency(totalAmount)}</p>
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
