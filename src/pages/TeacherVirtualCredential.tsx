import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  Download, 
  Share2, 
  Copy, 
  Check, 
  School, 
  User, 
  Briefcase, 
  Hash, 
  Printer,
  Calendar,
  FileBadge,
  ArrowLeft,
  Building2
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { pdf } from '@react-pdf/renderer';
import TeacherCredentialPDF from '../components/TeacherCredentialPDF';
import { AppUser, AppSettings } from '../types';

interface CredentialData {
  id: string;
  name: string;
  employeeNumber?: string;
  assignedLevel?: string;
  assignedGrade?: string;
  assignedGroup?: string;
  photoUrl?: string;
  email?: string;
  role?: string;
  schoolName: string;
  logoUrl?: string;
  valid: boolean;
}

export default function TeacherVirtualCredential() {
  const { teacherId } = useParams<{ teacherId: string }>();
  const [data, setData] = useState<CredentialData | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    async function loadCredential() {
      if (!teacherId) {
        setError('No se especificó un identificador de docente.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      // Attempt 1: Fetch via backend proxy endpoint (safe public API)
      try {
        const res = await fetch(`/api/teacher-credential/${teacherId}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
          setLoading(false);
          return;
        }
      } catch (e) {
        console.warn('API endpoint fetch failed, attempting direct Firestore fetch fallback:', e);
      }

      // Attempt 2: Direct Firestore query fallback
      try {
        const userDoc = await getDoc(doc(db, 'users', teacherId));
        if (userDoc.exists()) {
          const uData = userDoc.data();
          let schoolName = 'Colegio México Franciscano';
          let logoUrl = '';

          try {
            const settingsDoc = await getDoc(doc(db, 'settings', 'general'));
            if (settingsDoc.exists()) {
              const sData = settingsDoc.data() as AppSettings;
              setSettings(sData);
              if (sData.schoolName) schoolName = sData.schoolName;
              if (sData.logoUrl) logoUrl = sData.logoUrl;
            }
          } catch (err) {
            console.warn('Could not read settings from Firestore:', err);
          }

          setData({
            id: userDoc.id,
            name: uData.name || '',
            employeeNumber: uData.employeeNumber || '',
            assignedLevel: uData.assignedLevel || '',
            assignedGrade: uData.assignedGrade || '',
            assignedGroup: uData.assignedGroup || '',
            photoUrl: uData.photoUrl || '',
            email: uData.email || '',
            role: uData.role || 'Docente',
            schoolName,
            logoUrl,
            valid: true
          });
        } else {
          setError('No se encontró la credencial del docente solicitado.');
        }
      } catch (err: any) {
        console.error('Error loading credential:', err);
        setError('No fue posible validar la credencial en este momento.');
      } finally {
        setLoading(false);
      }
    }

    loadCredential();
  }, [teacherId]);

  const currentUrl = window.location.href;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share && data) {
      try {
        await navigator.share({
          title: `Credencial Docente - ${data.name}`,
          text: `Credencial Oficial de ${data.name} en ${data.schoolName}`,
          url: currentUrl,
        });
      } catch (err) {
        // User cancelled or share failed
      }
    } else {
      handleCopyLink();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!data) return;
    setIsGeneratingPdf(true);
    try {
      const teacherUser: AppUser = {
        id: data.id,
        email: data.email || '',
        name: data.name,
        role: (data.role as any) || 'Docente',
        permissions: {} as any,
        employeeNumber: data.employeeNumber,
        photoUrl: data.photoUrl,
        assignedLevel: data.assignedLevel,
        assignedGrade: data.assignedGrade,
        assignedGroup: data.assignedGroup,
        createdAt: null as any
      };

      const blob = await pdf(
        <TeacherCredentialPDF 
          teacher={teacherUser} 
          settings={settings || { schoolName: data.schoolName, logoUrl: data.logoUrl } as any} 
          virtualCredentialUrl={currentUrl} 
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Credencial_Docente_${data.name.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Hubo un error al generar la credencial en PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-3 border-slate-300 border-t-slate-800 rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-600 tracking-wide">
          Verificando registro oficial en el sistema...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md w-full shadow-lg">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-200">
            <ShieldCheck size={28} />
          </div>
          <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-2">Credencial No Localizada</h2>
          <p className="text-slate-600 text-xs leading-relaxed mb-6">
            {error || 'El identificador de credencial consultado no corresponde a un docente activo o ha expirado.'}
          </p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm"
          >
            <ArrowLeft size={14} /> Ir al Portal Institucional
          </Link>
        </div>
      </div>
    );
  }

  const verificationFolio = `CMF-DOC-${data.id.substring(0, 8).toUpperCase()}`;

  return (
    <div className="min-h-screen bg-slate-100/80 text-slate-800 flex flex-col items-center py-6 sm:py-10 px-4 sm:px-6 font-sans print:bg-white print:p-0">
      
      {/* Top Professional Navigation Bar */}
      <header className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl px-5 py-3.5 mb-6 shadow-xs flex items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          {data.logoUrl ? (
            <img src={data.logoUrl} alt={data.schoolName} className="h-9 w-auto object-contain max-w-[120px]" />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
              <Building2 size={18} />
            </div>
          )}
          <div>
            <h1 className="text-xs font-black uppercase tracking-wider text-slate-900 leading-tight">
              {data.schoolName}
            </h1>
            <p className="text-[10px] text-slate-500 font-semibold tracking-normal">
              Sistema de Control Escolar • Verificación Digital Oficial
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-black uppercase tracking-wider shrink-0">
          <CheckCircle2 size={13} className="text-emerald-600" />
          <span>Vigente</span>
        </div>
      </header>

      {/* Main Official Credential Card */}
      <main className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden print:border-0 print:shadow-none">
        
        {/* Institutional Top Header Stripe */}
        <div className="bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileBadge size={16} className="text-slate-300" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-200">
              Credencial Oficial de Identificación Docente
            </span>
          </div>
          <span className="text-[9px] font-mono font-bold text-slate-400">
            FOLIO: {verificationFolio}
          </span>
        </div>

        {/* Institution Brand Area */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            {data.logoUrl ? (
              <img src={data.logoUrl} alt="Logotipo" className="h-14 w-auto object-contain max-w-[140px]" />
            ) : (
              <div className="w-12 h-12 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center text-slate-700 font-black text-base">
                <School size={24} />
              </div>
            )}
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-950 uppercase tracking-tight leading-tight">
                {data.schoolName}
              </h2>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                Plantel Educativo Incorporado
              </p>
            </div>
          </div>

          <div className="flex sm:flex-col items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Acreditación:</span>
            <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200 uppercase tracking-wide inline-flex items-center gap-1 mt-0.5">
              <CheckCircle2 size={11} /> Personal Activo
            </span>
          </div>
        </div>

        {/* Teacher Core Information Area */}
        <div className="p-6 sm:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-start">
            
            {/* Teacher Photograph Column */}
            <div className="sm:col-span-4 flex flex-col items-center">
              <div className="w-36 h-44 rounded-xl overflow-hidden bg-slate-50 border-2 border-slate-200 shadow-sm p-1 flex items-center justify-center">
                {data.photoUrl ? (
                  <img 
                    src={data.photoUrl} 
                    alt={data.name} 
                    className="w-full h-full object-cover rounded-lg" 
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                    <User size={40} className="text-slate-300 mb-1" />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Sin Fotografía</span>
                  </div>
                )}
              </div>

              {/* Employee ID Tag under photo */}
              <div className="mt-3 w-36 bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2 text-center">
                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">No. Empleado</span>
                <span className="text-xs font-black font-mono text-slate-900 tracking-wider">
                  {data.employeeNumber || 'S/N'}
                </span>
              </div>
            </div>

            {/* Official Details Column */}
            <div className="sm:col-span-8 space-y-4">
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">
                  Nombre del Docente
                </span>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight leading-snug">
                  {data.name}
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">
                    Puesto / Función
                  </span>
                  <span className="text-xs font-bold text-slate-900 block">
                    Catedrático Titular
                  </span>
                </div>

                <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">
                    Nivel Educativo
                  </span>
                  <span className="text-xs font-bold text-slate-900 block uppercase">
                    {data.assignedLevel 
                      ? (data.assignedLevel.toUpperCase().trim() === 'BACHILLERATO' ? 'Preparatoria' : data.assignedLevel)
                      : 'Nivel General'}
                  </span>
                </div>

                {data.assignedGrade && (
                  <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">
                      Grado Asignado
                    </span>
                    <span className="text-xs font-bold text-slate-900 block">
                      {data.assignedGrade}°
                    </span>
                  </div>
                )}

                {data.assignedGroup && (
                  <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">
                      Grupo Asignado
                    </span>
                    <span className="text-xs font-bold text-slate-900 block">
                      Grupo {data.assignedGroup}
                    </span>
                  </div>
                )}
              </div>

              {/* Institutional Validation Note */}
              <div className="pt-2">
                <div className="flex items-center gap-2 text-slate-600 text-[11px] font-medium bg-blue-50/60 border border-blue-100 p-2.5 rounded-xl">
                  <ShieldCheck size={16} className="text-blue-700 shrink-0" />
                  <span>
                    El portador acredita relación laboral vigente y funciones docentes activas para el ciclo escolar correspondiente.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Digital Verification & QR Section */}
          <div className="mt-8 pt-6 border-t border-slate-200 bg-slate-50 rounded-2xl p-4 sm:p-5 border flex flex-col sm:flex-row items-center gap-5">
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs shrink-0">
              <QRCodeSVG 
                value={currentUrl} 
                size={110} 
                level="H" 
                includeMargin={false}
              />
            </div>

            <div className="flex-1 text-center sm:text-left space-y-1.5">
              <div className="flex items-center justify-center sm:justify-start gap-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Validación de Autenticidad en Línea
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Este código QR y enlace certifican en tiempo real la validez del documento ante la base de datos institucional de <strong className="text-slate-800">{data.schoolName}</strong>.
              </p>
              <p className="text-[10px] font-mono text-slate-400 pt-1">
                ID de Registro: {data.id}
              </p>
            </div>
          </div>

          {/* Institutional Signatures */}
          <div className="mt-8 pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-center">
            <div>
              <div className="h-10 border-b border-slate-400 mx-auto max-w-[200px]" />
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-700 block mt-1.5">
                Firma del Titular
              </span>
              <span className="text-[8px] text-slate-400 block">{data.name}</span>
            </div>

            <div>
              <div className="h-10 border-b border-slate-400 mx-auto max-w-[200px]" />
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-700 block mt-1.5">
                Dirección General
              </span>
              <span className="text-[8px] text-slate-400 block">{data.schoolName}</span>
            </div>
          </div>
        </div>

        {/* Footer Bar */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-slate-500">
          <span>Documento expedido por el Departamento de Control Escolar</span>
          <span className="font-mono text-[9px] text-slate-400">Verificado el {new Date().toLocaleDateString('es-MX')}</span>
        </div>
      </main>

      {/* Professional Actions Toolbar (Not Printed) */}
      <div className="w-full max-w-2xl mt-6 flex flex-wrap items-center justify-center gap-3 print:hidden">
        <button
          onClick={handleDownloadPdf}
          disabled={isGeneratingPdf}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm disabled:opacity-50"
        >
          {isGeneratingPdf ? (
            <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <Download size={14} />
          )}
          <span>{isGeneratingPdf ? 'Generando PDF...' : 'Descargar Credencial (PDF)'}</span>
        </button>

        <button
          onClick={handleCopyLink}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 active:scale-98 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-xs"
        >
          {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
          <span>{copied ? '¡Enlace Copiado!' : 'Copiar Enlace'}</span>
        </button>

        <button
          onClick={handleShare}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 active:scale-98 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-xs"
        >
          <Share2 size={14} />
          <span>Compartir</span>
        </button>

        <button
          onClick={handlePrint}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 active:scale-98 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-xs"
        >
          <Printer size={14} />
          <span>Imprimir</span>
        </button>
      </div>

      {/* Return link */}
      <div className="mt-8 print:hidden">
        <Link
          to="/"
          className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors inline-flex items-center gap-1.5"
        >
          <ArrowLeft size={13} /> Volver al Sistema Escolar
        </Link>
      </div>
    </div>
  );
}
