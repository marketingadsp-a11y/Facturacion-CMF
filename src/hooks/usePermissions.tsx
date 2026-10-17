import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
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

  const hasPermission = (section: keyof AppPermissions, action: string): boolean => {
    if (auth.currentUser?.email?.toLowerCase() === 'cramonmb@gmail.com') return true;
    if (!userProfile) return false;
    if (userProfile.role === 'Superadministrador') return true;
    
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
