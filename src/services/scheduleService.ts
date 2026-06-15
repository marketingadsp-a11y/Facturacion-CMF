import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  writeBatch,
  serverTimestamp,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { ScheduleSlot, TeacherSubstitution } from '../types';

// Collection references
const SCHEDULES_COL = 'schedules';
const SUBSTITUTIONS_COL = 'substitutions';

/**
 * Gets all schedule slots for a given school cycle.
 */
export async function getSchedulesByCycle(cycleId: string): Promise<ScheduleSlot[]> {
  try {
    const q = query(collection(db, SCHEDULES_COL), where('cycleId', '==', cycleId));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as ScheduleSlot));
  } catch (error) {
    console.error('Error fetching schedules by cycle:', error);
    throw error;
  }
}

/**
 * Subscribes to real-time changes in schedules for a given cycle.
 */
export function subscribeToSchedules(cycleId: string, callback: (slots: ScheduleSlot[]) => void) {
  const q = query(collection(db, SCHEDULES_COL), where('cycleId', '==', cycleId));
  return onSnapshot(q, (snap) => {
    const slots = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as ScheduleSlot));
    callback(slots);
  }, (error) => {
    console.error('Error in schedules subscription:', error);
  });
}

/**
 * Saves a list of schedule slots in a single batch.
 * This is useful for saving a newly auto-generated or edited schedule.
 */
export async function saveSchedulesBatch(cycleId: string, slots: ScheduleSlot[]): Promise<void> {
  try {
    // 1. Fetch current slots for the cycle to clean up first
    const currentSlots = await getSchedulesByCycle(cycleId);
    
    // We will do this in batches of 500 (Firestore write limit)
    const batchSize = 400;
    
    // Deleting old slots first
    for (let i = 0; i < currentSlots.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = currentSlots.slice(i, i + batchSize);
      chunk.forEach(slot => {
        if (slot.id) {
          batch.delete(doc(db, SCHEDULES_COL, slot.id));
        }
      });
      await batch.commit();
    }

    // Adding new slots
    for (let i = 0; i < slots.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = slots.slice(i, i + batchSize);
      chunk.forEach(slot => {
        const newDocRef = doc(collection(db, SCHEDULES_COL));
        // Remove id if present before saving
        const { id, ...data } = slot;
        batch.set(newDocRef, {
          ...data,
          cycleId,
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
    }
  } catch (error) {
    console.error('Error in saveSchedulesBatch:', error);
    throw error;
  }
}

/**
 * Saves or updates a single schedule slot.
 */
export async function saveScheduleSlot(slot: ScheduleSlot): Promise<string> {
  try {
    const { id, ...data } = slot;
    if (id) {
      const docRef = doc(db, SCHEDULES_COL, id);
      await setDoc(docRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
      return id;
    } else {
      const docRef = await addDoc(collection(db, SCHEDULES_COL), {
        ...data,
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    }
  } catch (error) {
    console.error('Error saving schedule slot:', error);
    throw error;
  }
}

/**
 * Deletes a single schedule slot by ID.
 */
export async function deleteScheduleSlot(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, SCHEDULES_COL, id));
  } catch (error) {
    console.error('Error deleting schedule slot:', error);
    throw error;
  }
}

/**
 * Fetches substitutions for a specific date.
 */
export async function getSubstitutions(date: string): Promise<TeacherSubstitution[]> {
  try {
    const q = query(
      collection(db, SUBSTITUTIONS_COL), 
      where('date', '==', date),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as TeacherSubstitution));
  } catch (error) {
    console.error('Error fetching substitutions:', error);
    throw error;
  }
}

/**
 * Subscribes to real-time changes in substitutions for a given date.
 */
export function subscribeToSubstitutions(date: string, callback: (subs: TeacherSubstitution[]) => void) {
  const q = query(
    collection(db, SUBSTITUTIONS_COL), 
    where('date', '==', date),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    const subs = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as TeacherSubstitution));
    callback(subs);
  }, (error) => {
    console.error('Error in substitutions subscription:', error);
  });
}

/**
 * Saves a new teacher substitution.
 */
export async function addSubstitution(sub: Omit<TeacherSubstitution, 'createdAt'>): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, SUBSTITUTIONS_COL), {
      ...sub,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding substitution:', error);
    throw error;
  }
}

/**
 * Deletes a substitution.
 */
export async function deleteSubstitution(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, SUBSTITUTIONS_COL, id));
  } catch (error) {
    console.error('Error deleting substitution:', error);
    throw error;
  }
}

/**
 * Deletes all schedule slots for a given cycle.
 */
export async function clearSchedulesForCycle(cycleId: string): Promise<void> {
  try {
    const currentSlots = await getSchedulesByCycle(cycleId);
    const batchSize = 400;
    for (let i = 0; i < currentSlots.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = currentSlots.slice(i, i + batchSize);
      chunk.forEach(slot => {
        if (slot.id) {
          batch.delete(doc(db, SCHEDULES_COL, slot.id));
        }
      });
      await batch.commit();
    }
  } catch (error) {
    console.error('Error clearing schedules for cycle:', error);
    throw error;
  }
}
