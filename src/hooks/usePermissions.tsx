import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, collection, query, where, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { AppUser, AppPermissions } from '../types';

interface PermissionsContextType {
  userProfile: AppUser | null;
  loading: boolean;
  hasPermission: (section: keyof AppPermissions, action: string) => boolean;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const [userProfile, setUserProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    let safetyTimer: any = null;

    // Safety timeout: never allow the app to hang in loading state indefinitely
    safetyTimer = setTimeout(() => {
      setLoading(current => {
        if (current) {
          console.warn("PermissionsProvider: Timeout de seguridad alcanzado esperando perfil de usuario.");
          return false;
        }
        return current;
      });
    }, 5000);

    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      // Clean up previous profile listener if it exists
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (user) {
        unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), async (snap) => {
          if (snap.exists()) {
            setUserProfile({ id: snap.id, ...snap.data() } as AppUser);
            if (safetyTimer) clearTimeout(safetyTimer);
            setLoading(false);
          } else {
            // Fallback: search if user was created with a different document ID matching their email
            try {
              if (user.email) {
                const q = query(collection(db, 'users'), where('email', '==', user.email.toLowerCase().trim()));
                const emailSnap = await getDocs(q);
                if (!emailSnap.empty) {
                  const matchedDoc = emailSnap.docs[0];
                  setUserProfile({ id: matchedDoc.id, ...matchedDoc.data() } as AppUser);
                  if (safetyTimer) clearTimeout(safetyTimer);
                  setLoading(false);
                  return;
                }
              }
            } catch (err) {
              console.error("Error searching user by email fallback:", err);
            }
            setUserProfile(null);
            if (safetyTimer) clearTimeout(safetyTimer);
            setLoading(false);
          }
        }, (error) => {
          console.error("Error fetching user profile:", error);
          if (safetyTimer) clearTimeout(safetyTimer);
          setLoading(false);
        });
      } else {
        setUserProfile(null);
        if (safetyTimer) clearTimeout(safetyTimer);
        setLoading(false);
      }
    });

    return () => {
      if (safetyTimer) clearTimeout(safetyTimer);
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  // Presence & Heartbeat Tracking
  useEffect(() => {
    if (!userProfile?.id) return;
    const userId = userProfile.id;
    const sessionKey = `presence_session_${userId}`;

    const updatePresence = async (isNewSession = false) => {
      try {
        const updateData: Record<string, any> = {
          isOnline: true,
          lastActiveAt: serverTimestamp()
        };
        if (isNewSession) {
          updateData.lastLoginAt = serverTimestamp();
        }
        await updateDoc(doc(db, 'users', userId), updateData);
      } catch (err) {
        // Silent fail on presence to not disrupt user experience
      }
    };

    // 1. Initial presence update on mount / session start
    const isNew = !sessionStorage.getItem(sessionKey);
    updatePresence(isNew);
    sessionStorage.setItem(sessionKey, 'active');

    // 2. Periodic heartbeat every 45s if window/tab is visible
    const heartbeatInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        updatePresence(false);
      }
    }, 45000);

    // 3. Throttle user activity heartbeat (at most once every 45s)
    let lastActivityUpdate = Date.now();
    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastActivityUpdate > 45000) {
        lastActivityUpdate = now;
        updatePresence(false);
      }
    };

    window.addEventListener('click', handleUserActivity, { passive: true });
    window.addEventListener('keydown', handleUserActivity, { passive: true });

    // 4. Tab visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updatePresence(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 5. Best-effort mark offline on beforeunload
    const handleUnload = () => {
      try {
        updateDoc(doc(db, 'users', userId), {
          isOnline: false,
          lastActiveAt: serverTimestamp()
        });
      } catch (e) {}
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [userProfile?.id]);

  const hasPermission = (section: keyof AppPermissions, action: string): boolean => {
    if (auth.currentUser?.email?.toLowerCase() === 'cramonmb@gmail.com') return true;
    if (!userProfile) return false;
    if (userProfile.role === 'Superadministrador') return true;
    if (userProfile.role === 'Control Escolar' && (section === 'grading' || section === 'controlEscolar' || section === 'prefectura')) return true;
    if (userProfile.role === 'Prefecto' && (section === 'timeClock' || section === 'grading' || section === 'dashboard' || section === 'prefectura' || (section === 'students' && action === 'view'))) return true;
    
    if (section === 'prefectura') {
      if (userProfile.role === 'Administrador') return true;
      if (userProfile.canAccessPrefectura) return true;
    }
    
    const sectionPerms = userProfile.permissions?.[section] as any;
    if (!sectionPerms) return false;

    if (section === 'settings' && action === 'view') {
      return !!(sectionPerms.view || sectionPerms.manageUsers || sectionPerms.editCycles || sectionPerms.editGeneral);
    }

    return !!sectionPerms[action];
  };

  return (
    <PermissionsContext.Provider value={{ userProfile, loading, hasPermission }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}
