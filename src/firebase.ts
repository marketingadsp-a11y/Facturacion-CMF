import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId || '(default)');
export const auth = getAuth(app);

// Test connection on boot as requested
export async function testFirebaseConnection() {
  try {
    // We don't necessarily need the document to exist, just to see if we can reach the server
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase connection established successfully.");
  } catch (error: any) {
    if (error?.message?.includes('the client is offline')) {
      console.error("Firebase is offline. Please check your configuration and internet connection.");
    } else {
      // Other errors are expected if the document doesn't exist or permissions are restrictive,
      // but they still signify that we reached the server.
      console.log("Firebase server reached (result: " + error.code + ")");
    }
  }
}

testFirebaseConnection();
