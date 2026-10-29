import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  writeBatch,
  query,
  limit,
  getDocsFromServer,
  FirestoreError,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Candidate, Employee, SheetConfig, VoteCategory, VoteRecord } from '../types';

// Ensure Firebase is initialized only once
const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({
  prompt: 'select_account',
});

// Flag to indicate if we are in the middle of a sign-in flow
let isSigningIn = false;
// In-memory token cache (strictly not saved in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        if (onAuthSuccess) onAuthSuccess(user, '');
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Google');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: unknown) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async (): Promise<void> => {
  await signOut(auth);
  cachedAccessToken = null;
};

// ==========================================
// FIRESTORE SERVICES & REAL-TIME LISTENERS
// ==========================================

export interface FirestoreErrorInfo {
  error: string;
  operationType: 'read' | 'write' | 'delete' | 'permission';
  path?: string;
  details?: unknown;
}

export const handleFirestoreError = (
  error: unknown,
  operationType: 'read' | 'write' | 'delete' | 'permission',
  path?: string
): FirestoreErrorInfo => {
  const err = error as FirestoreError;
  const isPermission = err?.code === 'permission-denied';
  const info: FirestoreErrorInfo = {
    error: isPermission
      ? 'สิทธิ์การเข้าถึงถูกจำกัด (Permission Denied)'
      : err?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ Firestore',
    operationType: isPermission ? 'permission' : operationType,
    path,
    details: err?.code,
  };
  console.warn(`[Firestore ${operationType} Error]`, info);
  return info;
};

/**
 * Test connectivity directly with server
 */
export const testFirestoreConnection = async (): Promise<boolean> => {
  try {
    const q = query(collection(db, 'candidates'), limit(1));
    await getDocsFromServer(q);
    return true;
  } catch (err) {
    console.warn('Firestore server check:', err);
    return false;
  }
};

/**
 * Real-time listener for votes
 */
export const subscribeVotes = (
  onUpdate: (votes: VoteRecord[]) => void,
  onError?: (err: FirestoreErrorInfo) => void
) => {
  const votesRef = collection(db, 'votes');
  return onSnapshot(
    votesRef,
    (snapshot) => {
      const records: VoteRecord[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        records.push({
          id: docSnap.id,
          category: data.category as VoteCategory,
          employeeId: data.employeeId,
          employeeName: data.employeeName,
          employeeDepartment: data.employeeDepartment,
          candidateId: data.candidateId,
          weight: Number(data.weight || 1),
          isExecutive: !!data.isExecutive,
          isSupervisor: !!data.isSupervisor,
          timestamp: data.timestamp || '',
        });
      });
      onUpdate(records);
    },
    (error) => {
      const info = handleFirestoreError(error, 'read', '/votes');
      if (onError) onError(info);
    }
  );
};

/**
 * Real-time listener for employees
 */
export const subscribeEmployees = (
  onUpdate: (employees: Employee[]) => void,
  onError?: (err: FirestoreErrorInfo) => void
) => {
  const empRef = collection(db, 'employees');
  return onSnapshot(
    empRef,
    (snapshot) => {
      if (snapshot.empty) {
        onUpdate([]);
        return;
      }
      const list: Employee[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          name: data.name || docSnap.id,
          department: data.department || '',
          position: data.position || '',
          isExecutive: !!data.isExecutive,
          isSupervisor: !!data.isSupervisor,
          role: data.role || (data.isExecutive ? 'executive' : data.isSupervisor ? 'supervisor' : 'staff'),
          voteWeight: Number(data.voteWeight || 1),
          hasVotedGeneral: !!data.hasVotedGeneral,
          votedGeneralFor: data.votedGeneralFor,
          votedGeneralAt: data.votedGeneralAt,
          hasVotedPopular: !!data.hasVotedPopular,
          votedPopularFor: data.votedPopularFor,
          votedPopularAt: data.votedPopularAt,
        });
      });
      onUpdate(list);
    },
    (error) => {
      const info = handleFirestoreError(error, 'read', '/employees');
      if (onError) onError(info);
    }
  );
};

/**
 * Real-time listener for candidates / teams
 */
export const subscribeCandidates = (
  onUpdate: (candidates: Candidate[]) => void,
  onError?: (err: FirestoreErrorInfo) => void
) => {
  const candRef = collection(db, 'candidates');
  return onSnapshot(
    candRef,
    (snapshot) => {
      if (snapshot.empty) {
        onUpdate([]);
        return;
      }
      const list: Candidate[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          code: data.code || docSnap.id,
          name: data.name || '',
          subtitle: data.subtitle,
          description: data.description,
          color: data.color || '#6366f1',
          badgeBg: data.badgeBg,
          isNonVotable: !!data.isNonVotable,
        });
      });
      // Sort by code e.g. T01, T02, etc.
      list.sort((a, b) => a.code.localeCompare(b.code));
      onUpdate(list);
    },
    (error) => {
      const info = handleFirestoreError(error, 'read', '/candidates');
      if (onError) onError(info);
    }
  );
};

/**
 * Real-time listener for system config (e.g. connected sheet)
 */
export const subscribeSystemConfig = (
  onUpdate: (config: SheetConfig | null) => void,
  onError?: (err: FirestoreErrorInfo) => void
) => {
  const configDocRef = doc(db, 'system', 'google_sheet');
  return onSnapshot(
    configDocRef,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as SheetConfig;
        onUpdate(data);
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      const info = handleFirestoreError(error, 'read', '/system/google_sheet');
      if (onError) onError(info);
    }
  );
};

/**
 * Cast a vote atomically to Firestore
 */
export const castVoteInFirestore = async (
  records: VoteRecord[],
  employeeId: string,
  category: VoteCategory,
  summary: string,
  timestamp: string
): Promise<void> => {
  const batch = writeBatch(db);

  // 1. Add each vote document
  for (const rec of records) {
    const voteRef = doc(db, 'votes', rec.id);
    batch.set(voteRef, {
      category: rec.category,
      employeeId: rec.employeeId,
      employeeName: rec.employeeName,
      employeeDepartment: rec.employeeDepartment,
      candidateId: rec.candidateId,
      weight: rec.weight,
      isExecutive: !!rec.isExecutive,
      isSupervisor: !!rec.isSupervisor,
      timestamp: rec.timestamp,
    });
  }

  // 2. Update employee's voting status
  const empRef = doc(db, 'employees', employeeId);
  if (category === 'general') {
    batch.update(empRef, {
      hasVotedGeneral: true,
      votedGeneralFor: summary,
      votedGeneralAt: timestamp,
    });
  } else {
    batch.update(empRef, {
      hasVotedPopular: true,
      votedPopularFor: summary,
      votedPopularAt: timestamp,
    });
  }

  await batch.commit();
};

/**
 * Seed initial employees into Firestore if collection is empty
 */
export const seedEmployeesToFirestore = async (employees: Employee[]): Promise<void> => {
  const batch = writeBatch(db);
  for (const emp of employees) {
    const empRef = doc(db, 'employees', emp.id);
    batch.set(
      empRef,
      {
        name: emp.name,
        department: emp.department,
        position: emp.position,
        isExecutive: !!emp.isExecutive,
        isSupervisor: !!emp.isSupervisor,
        role: emp.role || (emp.isExecutive ? 'executive' : emp.isSupervisor ? 'supervisor' : 'staff'),
        voteWeight: emp.voteWeight,
        hasVotedGeneral: !!emp.hasVotedGeneral,
        votedGeneralFor: emp.votedGeneralFor || null,
        votedGeneralAt: emp.votedGeneralAt || null,
        hasVotedPopular: !!emp.hasVotedPopular,
        votedPopularFor: emp.votedPopularFor || null,
        votedPopularAt: emp.votedPopularAt || null,
      },
      { merge: true }
    );
  }
  await batch.commit();
};

/**
 * Seed initial candidate teams into Firestore if collection is empty
 */
export const seedCandidatesToFirestore = async (candidates: Candidate[]): Promise<void> => {
  const batch = writeBatch(db);
  for (const cand of candidates) {
    const candRef = doc(db, 'candidates', cand.id);
    batch.set(
      candRef,
      {
        code: cand.code,
        name: cand.name,
        subtitle: cand.subtitle || '',
        description: cand.description || '',
        color: cand.color,
        badgeBg: cand.badgeBg || '',
        isNonVotable: !!cand.isNonVotable,
      },
      { merge: true }
    );
  }
  await batch.commit();
};

/**
 * Reset votes in Firestore (Admins only)
 */
export const resetVotesInFirestore = async (
  category: 'all' | 'general' | 'popular' = 'all'
): Promise<void> => {
  const votesRef = collection(db, 'votes');
  const votesSnap = await getDocs(votesRef);
  const empRef = collection(db, 'employees');
  const empSnap = await getDocs(empRef);

  const batch = writeBatch(db);

  votesSnap.forEach((voteDoc) => {
    const data = voteDoc.data();
    if (category === 'all' || data.category === category) {
      batch.delete(voteDoc.ref);
    }
  });

  empSnap.forEach((empDoc) => {
    if (category === 'all') {
      batch.update(empDoc.ref, {
        hasVotedGeneral: false,
        votedGeneralFor: null,
        votedGeneralAt: null,
        hasVotedPopular: false,
        votedPopularFor: null,
        votedPopularAt: null,
      });
    } else if (category === 'general') {
      batch.update(empDoc.ref, {
        hasVotedGeneral: false,
        votedGeneralFor: null,
        votedGeneralAt: null,
      });
    } else if (category === 'popular') {
      batch.update(empDoc.ref, {
        hasVotedPopular: false,
        votedPopularFor: null,
        votedPopularAt: null,
      });
    }
  });

  await batch.commit();
};

/**
 * Save Google Sheet configuration to Firestore
 */
export const updateSystemConfigInFirestore = async (config: SheetConfig | null): Promise<void> => {
  const ref = doc(db, 'system', 'google_sheet');
  if (config) {
    await setDoc(ref, config, { merge: true });
  } else {
    await deleteDoc(ref);
  }
};
