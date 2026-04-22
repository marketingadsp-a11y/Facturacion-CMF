import React, { useState, useEffect } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  useLocation,
  Link
} from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from './firebase';
import { doc, getDoc, onSnapshot, getDocFromServer, setDoc, serverTimestamp } from 'firebase/firestore';
import { usePermissions, PermissionsProvider } from './hooks/usePermissions';
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  Settings as SettingsIcon, 
  LogOut,
  GraduationCap,
  ShieldAlert,
  Menu,
  X,
  FileText,
  ChevronLeft,
  ChevronRight,
  Wallet,
  Receipt,
  ClipboardList,
  Activity,
  UserRound,
  Users2,
  Banknote,
  BellRing,
  FileBadge,
  Presentation,
  TrendingDown,
  SlidersHorizontal,
  ScrollText,
  Heart
} from 'lucide-react';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';

// Pages
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Parents from './pages/Parents';
import Payments from './pages/Payments';
import Expenses from './pages/Expenses';
import ParentDashboard from './pages/ParentDashboard';
import Settings from './pages/Settings';
import Login from './pages/Login';
import AcademicControl from './pages/AcademicControl';
import EnrollmentForm from './pages/EnrollmentForm';
import TeacherPortal from './pages/TeacherPortal';
import Reception from './pages/Reception';
import ChecadorAdmin from './pages/ChecadorAdmin';
import ChecadorKiosk from './pages/ChecadorKiosk';
import PrintBoleta from './pages/PrintBoleta';
import PublicVisitRegistration from './pages/PublicVisitRegistration';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const [user] = useAuthState(auth);
  const { userProfile, hasPermission, loading } = usePermissions();
  const [logoUrl, setLogoUrl] = useState('');
  const [schoolName, setSchoolName] = useState('Colegio México Franciscano');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  
  useEffect(() => {
    // Fetch settings for logo and name
    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setLogoUrl(data.logoUrl || '');
        if (data.schoolName) {
          setSchoolName(data.schoolName);
          document.title = data.schoolName;
        }
      }
    });

    // Auto-create SuperAdmin for the owner email if it doesn't exist
    // Only run if we are sure the profile doesn't exist (loading is false)
    if (user?.email?.toLowerCase() === 'cramonmb@gmail.com' && !loading && !userProfile) {
      const createSuperAdmin = async () => {
        try {
          // Double check with a direct fetch to avoid race conditions with onSnapshot
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (!userDoc.exists()) {
            await setDoc(doc(db, 'users', user.uid), {
              id: user.uid,
              email: user.email,
              name: 'Super Admin',
              role: 'Superadministrador',
              permissions: {
                dashboard: { view: true },
                students: { view: true, create: true, edit: true, delete: true, viewHistory: true },
                payments: { view: true, create: true, cancel: true, invoice: true, downloadInvoice: true },
                expenses: { view: true, create: true, edit: true, delete: true },
                settings: { view: true, editGeneral: true, editCycles: true, editRules: true, manageUsers: true },
                announcements: { view: true, manage: true },
                controlEscolar: { view: true, manage: true },
                grading: { view: true, manage: true }
              },
              createdAt: serverTimestamp()
            });
          }
        } catch (err) {
          console.error("Error creating superadmin:", err);
        }
      };
      createSuperAdmin();
    }

    return () => unsubSettings();
  }, [user?.uid, loading, !!userProfile]);
  
  const isParent = userProfile?.role === 'Padre';

  const navItems = isParent ? [
    { name: 'Mis Hijos', path: '/', icon: GraduationCap, section: 'dashboard', action: 'view' },
    { name: 'Facturas', path: '/?tab=facturas', icon: ScrollText, section: 'dashboard', action: 'view' },
    { name: 'Datos Fiscales', path: '/?tab=billing', icon: ShieldAlert, section: 'dashboard', action: 'view' },
  ] : [
    { name: 'Panel', path: '/', icon: Activity, section: 'dashboard', action: 'view' },
    { name: 'Alumnos', path: '/alumnos', icon: UserRound, section: 'students', action: 'view' },
    { name: 'Padres', path: '/padres', icon: Heart, section: 'parents', action: 'view' },
    { name: 'Pagos', path: '/pagos', icon: Banknote, section: 'payments', action: 'view' },
    { name: 'Recepción', path: '/recepcion', icon: BellRing, section: 'reception', action: 'view' },
    { name: 'Checador', path: '/checador-admin', icon: UserRound, section: 'dashboard', action: 'view' },
    { name: 'Control Escolar', path: '/control-escolar', icon: FileBadge, section: 'controlEscolar', action: 'view' },
    { name: 'Docente', path: '/docentes', icon: Presentation, section: 'grading', action: 'view' },
    { name: 'Gastos', path: '/gastos', icon: TrendingDown, section: 'expenses', action: 'view' },
    { name: 'Ajustes', path: '/ajustes', icon: SlidersHorizontal, section: 'settings', action: 'view' },
  ];

  const handleLogout = () => auth.signOut();

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );

  if (!userProfile && user?.email?.toLowerCase() !== 'cramonmb@gmail.com') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-4">
          <ShieldAlert size={32} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Acceso Restringido</h1>
        <p className="text-slate-500 max-w-md mb-6">
          Tu cuenta ({user?.email}) no tiene permisos para acceder al sistema. 
          Por favor, contacta al Superadministrador para que te asigne un rol.
        </p>
        <button
          onClick={handleLogout}
          className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all"
        >
          Cerrar Sesión
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Parent Bottom Navigation Bar */}
      {isParent && (
        <header className="bg-white/90 backdrop-blur-md border-t border-slate-200 fixed bottom-0 left-0 right-0 z-40 px-4 py-2 min-h-[64px] shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center overflow-hidden border border-slate-100 shadow-sm">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                ) : (
                  <div className="bg-blue-600 w-full h-full flex items-center justify-center text-white">
                    <GraduationCap size={24} />
                  </div>
                )}
              </div>
              <span className="font-black text-slate-900 text-xl tracking-tight hidden sm:block">
                {schoolName}
              </span>
            </div>

            <nav className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-lg">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                   to={item.path}
                  className={cn(
                    "flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-md text-xs font-black transition-all duration-300",
                    (location.pathname === item.path && !location.search) || (item.path.includes('tab=') && location.search.includes(item.path.split('=')[1]))
                      ? "bg-white text-blue-600 shadow-sm scale-105"
                      : "text-slate-500 hover:text-slate-800 hover:bg-white/80"
                  )}
                >
                  <item.icon size={20} strokeWidth={2.5} />
                  <span className="text-[10px] sm:text-xs">{item.name}</span>
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black text-xs">
                  {userProfile?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-black text-slate-900 leading-none truncate max-w-[100px]">
                    {userProfile?.name?.split(' ')[0] || user?.email?.split('@')[0]}
                  </span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Padre</span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                title="Cerrar Sesión"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </header>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar - Hidden for parents */}
        {!isParent && (
          <aside className={cn(
            "bg-white border-r border-slate-200 flex flex-col transition-all duration-300 hidden md:flex relative",
            isSidebarCollapsed ? "w-[72px]" : "w-56"
          )}>
            <div className={cn(
              "h-16 flex items-center border-b border-slate-100 px-4",
              isSidebarCollapsed ? "justify-center" : "justify-between"
            )}>
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center text-white shrink-0 shadow-sm border border-slate-800">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                  ) : (
                    <GraduationCap size={16} strokeWidth={2.5} />
                  )}
                </div>
                {!isSidebarCollapsed && (
                  <h1 className="font-black text-slate-900 text-[11px] uppercase tracking-tighter truncate">
                    {schoolName}
                  </h1>
                )}
              </div>
            </div>

            {/* Toggle Button */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="absolute -right-3 top-20 bg-white border border-slate-200 rounded-full p-1 shadow-sm text-slate-400 hover:text-slate-900 hover:border-slate-300 transition-all z-10"
            >
              {isSidebarCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
            </button>

            <nav className={cn("flex-1 px-3 py-4 space-y-1", isSidebarCollapsed ? "flex flex-col items-center" : "")}>
              {navItems.filter(item => hasPermission(item.section as any, item.action)).map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center rounded-md transition-all duration-200 relative group",
                    isSidebarCollapsed ? "justify-center w-10 h-10 p-0" : "gap-3 px-3 py-2 w-full",
                    location.pathname === item.path
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <item.icon size={isSidebarCollapsed ? 20 : 18} strokeWidth={2.5} className="shrink-0" />
                  {!isSidebarCollapsed && (
                    <span className="text-xs font-bold tracking-tight">
                      {item.name}
                    </span>
                  )}
                  
                  {isSidebarCollapsed && (
                    <div className="absolute left-full ml-3 px-2 py-1.5 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl">
                      {item.name}
                    </div>
                  )}
                </Link>
              ))}
            </nav>

            <div className={cn("p-4 border-t border-slate-100", isSidebarCollapsed ? "flex flex-col items-center" : "")}>
              <div className={cn("flex items-center mb-1", isSidebarCollapsed ? "justify-center" : "gap-3 px-3 py-2")}>
                <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-black text-[10px] shrink-0">
                  {userProfile?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
                </div>
                {!isSidebarCollapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-slate-900 leading-none truncate mb-1">
                      {userProfile?.name?.split(' ')[0] || user?.email?.split('@')[0]}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 leading-none uppercase tracking-widest truncate">
                      {userProfile?.role}
                    </p>
                  </div>
                )}
              </div>
              <button
                onClick={handleLogout}
                className={cn(
                  "flex items-center rounded-lg text-xs font-bold text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all duration-200 group relative",
                  isSidebarCollapsed ? "justify-center w-10 h-10 p-0" : "gap-3 px-3 py-2 w-full ml-0.5"
                )}
              >
                <LogOut size={isSidebarCollapsed ? 18 : 14} className="shrink-0" />
                {!isSidebarCollapsed && <span>Salir</span>}
                
                {isSidebarCollapsed && (
                  <div className="absolute left-full ml-3 px-2 py-1.5 bg-red-600 text-white text-[9px] font-bold rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                    Cerrar Sesión
                  </div>
                )}
              </button>
            </div>
          </aside>
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile Top Bar - Hidden for parents as they have the BottomNav */}
          {!isParent && (
            <div className="md:hidden bg-white border-b border-slate-100 p-4 flex items-center justify-between sticky top-0 z-30">
              <div className="flex items-center gap-3 min-w-0">
                <button 
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors shrink-0"
                >
                  <Menu size={24} />
                </button>
                <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center overflow-hidden border border-slate-100 shadow-sm shrink-0">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="bg-blue-600 w-full h-full flex items-center justify-center text-white">
                      <GraduationCap size={18} />
                    </div>
                  )}
                </div>
                <span className="font-bold text-slate-800 text-sm leading-tight">
                  {schoolName}
                </span>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs shrink-0 ml-2">
                {userProfile?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
              </div>
            </div>
          )}

          {/* Main Content */}
          <main className={cn(
            "flex-1 overflow-y-auto p-4 md:p-6",
            isParent ? "max-w-7xl mx-auto w-full pb-20" : ""
          )}>
            {children}
          </main>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-white z-50 md:hidden flex flex-col shadow-2xl"
            >
              <div className="p-6 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center overflow-hidden border border-slate-100 shadow-sm">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="bg-blue-600 w-full h-full flex items-center justify-center text-white">
                        <GraduationCap size={20} />
                      </div>
                    )}
                  </div>
                  <span className="font-bold text-slate-800 text-sm leading-tight">{schoolName}</span>
                </div>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={20} className="text-slate-500" />
                </button>
              </div>

              <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                <div className="flex items-center gap-3 px-2 py-1">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                    {userProfile?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{userProfile?.name || user?.email}</p>
                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{userProfile?.role || 'Sin Rol'}</p>
                  </div>
                </div>
              </div>

              <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {navItems.filter(item => hasPermission(item.section as any, item.action)).map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200",
                      location.pathname === item.path
                        ? "bg-blue-50 text-blue-600 shadow-sm"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <item.icon size={20} />
                    {item.name}
                  </Link>
                ))}
              </nav>

              <div className="p-4 border-t border-slate-100">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 transition-all duration-200"
                >
                  <LogOut size={20} />
                  Cerrar Sesión
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [user, loading] = useAuthState(auth);

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
  
  if (!user) return <Navigate to="/login" />;

  return <Layout>{children}</Layout>;
};

const AppContent = () => {
  const { userProfile } = usePermissions();
  const isParent = userProfile?.role === 'Padre';
  const [enrollmentSlug, setEnrollmentSlug] = useState('enroll');

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists() && snap.data().enrollmentSlug) {
        setEnrollmentSlug(snap.data().enrollmentSlug);
      } else if (!snap.exists() || !snap.data().enrollmentSlug) {
        // Default to /inscripcion as requested if not set in settings
        setEnrollmentSlug('inscripcion');
      }
    });
    return unsub;
  }, []);
  
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/visita" element={<PublicVisitRegistration />} />
      <Route path="/checador" element={<ChecadorKiosk />} />
      <Route path={`/${enrollmentSlug}`} element={<EnrollmentForm />} />
      {/* Compatibility routes */}
      {enrollmentSlug !== 'inscripcion' && <Route path="/inscripcion" element={<EnrollmentForm />} />}
      {enrollmentSlug !== 'enroll' && <Route path="/enroll" element={<EnrollmentForm />} />}
      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            {userProfile?.role === 'Padre' ? <ParentDashboard /> : 
             userProfile?.role === 'Docente' ? <TeacherPortal /> : <Dashboard />}
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/checador-admin" 
        element={
          <ProtectedRoute>
            {isParent ? <Navigate to="/" /> : <ChecadorAdmin />}
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/portal-padres" 
        element={
          <ProtectedRoute>
            <ParentDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/alumnos" 
        element={
          <ProtectedRoute>
            {isParent ? <Navigate to="/" /> : <Students />}
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/padres" 
        element={
          <ProtectedRoute>
            {isParent ? <Navigate to="/" /> : <Parents />}
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/pagos" 
        element={
          <ProtectedRoute>
            {isParent ? <Navigate to="/" /> : <Payments />}
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/gastos" 
        element={
          <ProtectedRoute>
            {isParent ? <Navigate to="/" /> : <Expenses />}
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/recepcion" 
        element={
          <ProtectedRoute>
            {isParent ? <Navigate to="/" /> : <Reception />}
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/control-escolar" 
        element={
          <ProtectedRoute>
            {isParent ? <Navigate to="/" /> : <AcademicControl />}
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/ajustes" 
        element={
          <ProtectedRoute>
            {isParent ? <Navigate to="/" /> : <Settings />}
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/docentes" 
        element={
          <ProtectedRoute>
            {isParent ? <Navigate to="/" /> : <TeacherPortal />}
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/imprimir-boleta/:studentId" 
        element={
          <ProtectedRoute>
            {isParent ? <Navigate to="/" /> : <PrintBoleta />}
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
};

export default function App() {
  return (
    <PermissionsProvider>
      <Router>
        <AppContent />
        <ToastContainer position="top-right" autoClose={3000} />
      </Router>
    </PermissionsProvider>
  );
}
