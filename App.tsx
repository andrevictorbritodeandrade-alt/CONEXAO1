import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, User } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, query, orderBy, deleteDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';
import { 
  ResponsiveContainer, AreaChart, Area, Tooltip, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend
} from 'recharts';
import { 
  Calendar as CalendarIcon, 
  Heart, 
  ChevronLeft, 
  ChevronRight, 
  Activity, 
  User as UserIcon, 
  Flame, 
  Pill, 
  Droplets,
  CheckCircle2,
  Plus,
  X as XIcon,
  Edit3,
  Smile,
  Frown,
  Meh,
  Sparkles,
  Zap,
  CalendarHeart,
  Ban,
  PlayCircle,
  StopCircle,
  Cloud,
  Check,
  ArrowRight,
  Smartphone,
  LogOut,
  LogIn,
  AlertCircle
} from 'lucide-react';

// --- Firebase Initialization ---
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();

// --- Firestore Connection Test ---
import { getDocFromServer } from 'firebase/firestore';

async function testConnection() {
  try {
    // Attempt to read a non-existent document just to check connectivity/permissions
    await getDocFromServer(doc(db, '_connection_test_', 'ping'));
  } catch (error: any) {
    if (error.message?.includes('the client is offline')) {
      console.error("Firestore connection test failed: client is offline. Check Firebase configuration.");
    } else {
      // Permission denied or other errors are fine, they still reach the server
      console.log("Firestore connection test result:", error.code || error.message);
    }
  }
}
testConnection();

// --- Error Handling ---
interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: { providerId: string; displayName: string; email: string; }[];
  }
}

const handleFirestoreError = (error: any, operationType: FirestoreErrorInfo['operationType'], path: string | null = null) => {
  console.error(`Firestore Error (${operationType}):`, error);
  if (error.code === 'permission-denied') {
    const user = auth.currentUser;
    const errorInfo: FirestoreErrorInfo = {
      error: error.message,
      operationType,
      path,
      authInfo: user ? {
        userId: user.uid,
        email: user.email || '',
        emailVerified: user.emailVerified,
        isAnonymous: user.isAnonymous,
        providerInfo: user.providerData.map(p => ({
          providerId: p.providerId,
          displayName: p.displayName || '',
          email: p.email || ''
        }))
      } : {
        userId: 'anonymous',
        email: '',
        emailVerified: false,
        isAnonymous: true,
        providerInfo: []
      }
    };
    throw new Error(JSON.stringify(errorInfo));
  }
  throw error;
};

// --- Types ---
interface Record {
  id: string;
  date: string;
  hadSex: boolean;
  libido: number;
  masturbated: boolean;
  usedTadala: boolean;
  didClimax?: boolean;
  
  // Legacy support (will be treated as periodEnds)
  periodEnded: boolean; 

  // New Cycle Tracking
  periodStarts?: boolean; // Menstruação desceu
  periodEnds?: boolean;   // Menstruação acabou
  medsStarts?: boolean;   // Começou cartela
  medsEnds?: boolean;     // Parou cartela (Pausa)
  
  notes?: string;
  timestamp: number;
}

interface CycleInfo {
  day: number;
  phase: 'Menstrual' | 'Folicular' | 'Ovulatória' | 'Lútea';
  phaseColor: string;
  phaseIcon: React.ReactNode;
  pillDay?: number;
  isBreak?: boolean;
  nextPeriod?: string;
}

interface LibidoLevel {
  label: string;
  value: number;
  color: string;
  icon: React.ReactNode;
}

// --- Constants ---
const LIBIDO_META: { [key: number]: { label: string; value: number; color: string; icon: string } } = {
  1: { label: "Zero", value: 1, color: "#9ca3af", icon: "Frown" },
  2: { label: "Baixa", value: 2, color: "#fca5a5", icon: "Meh" },
  3: { label: "Média", value: 3, color: "#ef4444", icon: "Smile" },
  4: { label: "Alta", value: 4, color: "#b91c1c", icon: "Flame" },
  5: { label: "Pico", value: 5, color: "#7f1d1d", icon: "Flame" }
};

// --- Components ---

// Header Logo (Text only, matched to screenshot)
const HeaderLogo = () => (
  <div className="flex items-center">
    <h1 className="text-4xl sm:text-5xl md:text-6xl font-black italic tracking-tighter leading-none font-display uppercase flex items-center drop-shadow-sm">
      <span className="text-red-600">CONE</span>
      <span className="text-white drop-shadow-[0_2px_2px_rgba(220,38,38,1)]" style={{ WebkitTextStroke: '2px #dc2626' }}>XÃO</span>
      <span className="ml-2 hover:scale-110 transition-transform cursor-default text-4xl sm:text-5xl md:text-6xl drop-shadow-md origin-bottom-left animate-pulse">🫦</span>
    </h1>
  </div>
);

// Libido Icon Helper to avoid top-level JSX instantiation
const LibidoIcon = ({ level, size = 32 }: { level: number, size?: number }) => {
  const meta = LIBIDO_META[level];
  if (!meta) return null;
  
  if (meta.icon === 'Frown') return <Frown size={size} />;
  if (meta.icon === 'Meh') return <Meh size={size} />;
  if (meta.icon === 'Smile') return <Smile size={size} />;
  if (meta.icon === 'Flame') return <Flame size={size} fill={level === 5 ? "currentColor" : "none"} />;
  
  return <span className="font-bold">{level}</span>;
};

const getMarcellyCycleStateForDate = (dateStr: string) => {
  const dObj = new Date(dateStr + 'T12:00:00');
  const baseDate = new Date('2026-05-18T12:00:00'); // Standard reference date when period and meds started
  const diffTime = dObj.getTime() - baseDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  // Modulo 28 to get cycle day between 1 and 28
  const cycleDay = ((diffDays % 28) + 28) % 28 + 1;
  
  return {
    cycleDay,
    isPillStart: cycleDay === 1,          // Volta a tomar o remédio (Dia 1)
    isPillEnd: cycleDay === 21,          // Deixa de tomar o remédio (Dia 21)
    isPeriodStart: cycleDay === 23 || cycleDay === 24, // Começo da Menstruação (Previsão)
    isPeakFlow: cycleDay === 25 || cycleDay === 26,    // Maior fluxo (Previsão)
    isPeriodEnd: cycleDay === 28,        // Fim da Menstruação (Previsão)
    isFertileStart: cycleDay === 11,     // Início do período fértil (Previsão)
    isFertileWindow: cycleDay >= 11 && cycleDay <= 16, // Período Fértil (Janela)
    isPillTaking: cycleDay >= 1 && cycleDay <= 21,    // Tomando o remédio
    isPillBreak: cycleDay >= 22 && cycleDay <= 28,    // Pausa do remédio
  };
};

const App: React.FC = () => {
  // Helpers
  const todayStr = new Date().toISOString().split('T')[0];

  // State
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [records, setRecords] = useState<Record[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isCheckinOpen, setIsCheckinOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');

  // Controls which date we are currently editing
  const [editingDate, setEditingDate] = useState<string>(todayStr);

  // Check-in Form State
  const [checkinLibido, setCheckinLibido] = useState<number>(3);
  
  // User Activities
  const [checkinActivities, setCheckinActivities] = useState({
    hadSex: false,
    masturbated: false,
    usedTadala: false,
    didClimax: true // Default to true when adding new sex record
  });

  // Partner Activities (Marcelly)
  const [checkinPartner, setCheckinPartner] = useState({
    periodStarts: false,
    periodEnds: false, // Replaces periodEnded logic
    medsStarts: false,
    medsEnds: false
  });

  // Auth Listener
  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      setError(e.message);
    };
    window.addEventListener('error', handleError);

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    }, (err) => {
      setError("Auth error: " + err.message);
      setAuthLoading(false);
    });

    return () => {
      window.removeEventListener('error', handleError);
      unsubAuth();
    };
  }, []);

  // Sync with Firestore
  useEffect(() => {
    if (!currentUser) {
      // If not logged in, load from localStorage if available
      const saved = localStorage.getItem('conexao_v7_data');
      let loadedRecords: Record[] = [];
      
      if (saved) {
        try {
          loadedRecords = JSON.parse(saved);
        } catch (e) {
          console.error("Erro ao carregar do localStorage", e);
        }
      }

      // Force include the requested records to ensure they appear for the user
      const forcedHistory = [
        '2026-01-02', '2026-01-08', '2026-01-15', '2026-01-28',
        '2026-02-02', '2026-02-12', '2026-02-20',
        '2026-03-10', '2026-03-24', '2026-03-25',
        '2026-04-23', '2026-04-26', '2026-04-27',
        '2026-05-17', '2026-05-18', '2026-05-22', '2026-05-23', '2026-05-24',
        '2026-05-31', '2026-06-05', '2026-06-07', '2026-06-21'
      ];
      let modified = false;
      
      forcedHistory.forEach(d => {
        const existingIdx = loadedRecords.findIndex(r => r.date === d);
        
        if (existingIdx === -1) {
          const isApril23 = d === '2026-04-23';
          const isMay18 = d === '2026-05-18';
          const isMay22 = d === '2026-05-22';

          loadedRecords.push({
            id: 'forced-' + d,
            date: d,
            hadSex: !isMay18 && !isMay22, // Assuming sex only on other forced dates
            libido: 5,
            masturbated: false,
            usedTadala: false,
            didClimax: true,
            periodStarts: isMay18,
            medsStarts: isMay18, // common practice to start Selene on Day 1
            periodEnds: isApril23 || isMay22,
            timestamp: new Date(d + 'T12:00:00').getTime(),
            periodEnded: isApril23 || isMay22
          });
          modified = true;
        } else if (d === '2026-06-07' || d === '2026-06-21') {
          // Force hadSex to true specifically
          loadedRecords[existingIdx].hadSex = true;
          loadedRecords[existingIdx].libido = 5;
          modified = true;
        }
      });

      if (loadedRecords.length > 0) {
        setRecords(loadedRecords);
      } else {
        // Default initial data logic if needed
        const currentYear = new Date().getFullYear();
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayStr = yesterdayDate.toISOString().split('T')[0];
        
        const initialData: Record[] = [
          // User requested records
          { id: 'h1', date: '2026-01-02', hadSex: true, libido: 5, masturbated: false, usedTadala: false, didClimax: true, timestamp: Date.parse('2026-01-02T12:00:00'), periodEnded: false },
          { id: 'h2', date: '2026-01-08', hadSex: true, libido: 5, masturbated: false, usedTadala: false, didClimax: true, timestamp: Date.parse('2026-01-08T12:00:00'), periodEnded: false },
          { id: 'h3', date: '2026-01-15', hadSex: true, libido: 5, masturbated: false, usedTadala: false, didClimax: true, timestamp: Date.parse('2026-01-15T12:00:00'), periodEnded: false },
          { id: 'h4', date: '2026-01-28', hadSex: true, libido: 5, masturbated: false, usedTadala: false, didClimax: true, timestamp: Date.parse('2026-01-28T12:00:00'), periodEnded: false },
          { id: 'h5', date: '2026-02-02', hadSex: true, libido: 5, masturbated: false, usedTadala: false, didClimax: true, timestamp: Date.parse('2026-02-02T12:00:00'), periodEnded: false },
          { id: 'h6', date: '2026-02-12', hadSex: true, libido: 5, masturbated: false, usedTadala: false, didClimax: true, timestamp: Date.parse('2026-02-12T12:00:00'), periodEnded: false },
          { id: 'h7', date: '2026-02-20', hadSex: true, libido: 5, masturbated: false, usedTadala: false, didClimax: true, timestamp: Date.parse('2026-02-20T12:00:00'), periodEnded: false },
          { id: 'h8', date: '2026-03-10', hadSex: true, libido: 5, masturbated: false, usedTadala: false, didClimax: true, timestamp: Date.parse('2026-03-10T12:00:00'), periodEnded: false },
          { id: 'h9', date: '2026-03-24', hadSex: true, libido: 5, masturbated: false, usedTadala: false, didClimax: true, timestamp: Date.parse('2026-03-24T12:00:00'), periodEnded: false },
          { id: 'h10', date: '2026-03-25', hadSex: true, libido: 5, masturbated: false, usedTadala: false, didClimax: true, timestamp: Date.parse('2026-03-25T12:00:00'), periodEnded: false },
          { id: 'h11', date: '2026-04-23', hadSex: true, libido: 5, masturbated: false, usedTadala: false, didClimax: true, timestamp: Date.parse('2026-04-23T12:00:00'), periodEnds: true, periodEnded: true },
          { id: 'h12', date: '2026-04-26', hadSex: true, libido: 5, masturbated: false, usedTadala: false, didClimax: true, timestamp: Date.parse('2026-04-26T12:00:00'), periodEnded: false },
          { id: 'h13', date: '2026-04-27', hadSex: true, libido: 5, masturbated: false, usedTadala: false, didClimax: true, timestamp: Date.parse('2026-04-27T12:00:00'), periodEnded: false },
          { id: 'h14', date: '2026-05-17', hadSex: true, libido: 5, masturbated: false, usedTadala: false, didClimax: true, timestamp: Date.parse('2026-05-17T12:00:00'), periodEnded: false },
          { id: 'h15', date: '2026-05-23', hadSex: true, libido: 5, masturbated: false, usedTadala: false, didClimax: true, timestamp: Date.parse('2026-05-23T12:00:00'), periodEnded: false },
          { id: 'h16', date: '2026-05-24', hadSex: true, libido: 5, masturbated: false, usedTadala: false, didClimax: true, timestamp: Date.parse('2026-05-24T12:00:00'), periodEnded: false },
          { id: 'h17', date: '2026-05-31', hadSex: true, libido: 5, masturbated: false, usedTadala: false, didClimax: true, timestamp: Date.parse('2026-05-31T12:00:00'), periodEnded: false },
          { id: 'h18', date: '2026-06-05', hadSex: true, libido: 5, masturbated: false, usedTadala: false, didClimax: true, timestamp: Date.parse('2026-06-05T12:00:00'), periodEnded: false },
          { id: 'h19', date: '2026-06-07', hadSex: true, libido: 5, masturbated: false, usedTadala: false, didClimax: true, timestamp: Date.parse('2026-06-07T12:00:00'), periodEnded: false },
          { id: 'h20', date: '2026-06-21', hadSex: true, libido: 5, masturbated: false, usedTadala: false, didClimax: true, timestamp: Date.parse('2026-06-21T12:00:00'), periodEnded: false },
          { 
            id: 'yesterday-' + Date.now(),
            date: yesterdayStr,
            hadSex: false,
            libido: 3,
            masturbated: false,
            usedTadala: false,
            periodEnded: false,
            timestamp: yesterdayDate.getTime()
          }
        ];
        setRecords(initialData);
      }
      return;
    }

    // Real-time Firestore Sync
    const recordsRef = collection(db, 'users', currentUser.uid, 'records');
    
    // Ensure ALL historical dates from screenshots exist in Firestore
    const forcedHistory = [
      '2026-01-02', '2026-01-08', '2026-01-15', '2026-01-28',
      '2026-02-02', '2026-02-12', '2026-02-20',
      '2026-03-10', '2026-03-24', '2026-03-25',
      '2026-04-23', '2026-04-26', '2026-04-27',
      '2026-05-17', '2026-05-18', '2026-05-22', '2026-05-23', '2026-05-24',
      '2026-05-31', '2026-06-05', '2026-06-07', '2026-06-21'
    ];
    
    forcedHistory.forEach(async (d) => {
      // Clean up duplicates if needed
      if (d === '2026-06-07' || d === '2026-06-21') {
         const existing = records.filter(r => r.date === d);
         for (const ex of existing) {
           if (ex.id !== 'forced-' + d) {
             await deleteDoc(doc(db, 'users', currentUser.uid, 'records', ex.id));
           }
         }
      }
      const exists = records.some(r => r.date === d && r.id === 'forced-' + d);
      if (!exists || d === '2026-06-07' || d === '2026-06-21') {
        const id = 'forced-' + d;
        const isApril23 = d === '2026-04-23';
        const isMay18 = d === '2026-05-18';
        const isMay22 = d === '2026-05-22';

        await setDoc(doc(db, 'users', currentUser.uid, 'records', id), {
          id,
          date: d,
          hadSex: !isMay18 && !isMay22,
          libido: 5, // Peak performance
          masturbated: false,
          usedTadala: false,
          didClimax: true,
          periodStarts: isMay18,
          medsStarts: isMay18,
          periodEnds: isApril23 || isMay22,
          timestamp: new Date(d + 'T12:00:00').getTime(),
          periodEnded: isApril23 || isMay22
        }, { merge: true });
      }
    });

    const q = query(recordsRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbRecords = snapshot.docs.map(doc => doc.data() as Record);
      setRecords(dbRecords);
    }, (error) => {
      handleFirestoreError(error, 'list', `/users/${currentUser.uid}/records`);
    });

    // Check for localStorage migration
    const saved = localStorage.getItem('conexao_v7_data');
    if (saved) {
      try {
        const loadedRecords = JSON.parse(saved) as Record[];
        if (loadedRecords.length > 0) {
          // Migration logic: upload each record to Firestore
          loadedRecords.forEach(async (rec) => {
            await setDoc(doc(db, 'users', currentUser.uid, 'records', rec.id), rec);
          });
          // Clear migration once started (Firestore listener will handle state)
          localStorage.removeItem('conexao_v7_data');
        }
      } catch (e) {
        console.error("Migration error", e);
      }
    }

    return () => unsubscribe();
  }, [currentUser]);

  // Save Data Persistence (Only for Logged Out users)
  useEffect(() => {
    if (!currentUser && records.length > 0) {
      setSaveStatus('saving');
      localStorage.setItem('conexao_v7_data', JSON.stringify(records));
      const timer = setTimeout(() => setSaveStatus('saved'), 600);
      return () => clearTimeout(timer);
    }
  }, [records, currentUser]);

  // Background Auto-Fix for 06-07 and 06-21 (One-time repair when records load)
  useEffect(() => {
    if (currentUser && records.length > 0) {
      const fixDates = ['2026-06-07', '2026-06-21'];
      fixDates.forEach(fixDate => {
        const specificRecords = records.filter(r => r.date === fixDate);
        
        // If missing completely, add it
        if (specificRecords.length === 0) {
          setDoc(doc(db, 'users', currentUser.uid, 'records', 'forced-' + fixDate), {
            id: 'forced-' + fixDate,
            date: fixDate,
            hadSex: true,
            libido: 5,
            masturbated: false,
            usedTadala: false,
            didClimax: true,
            periodStarts: false,
            medsStarts: false,
            periodEnds: false,
            timestamp: new Date(fixDate + 'T12:00:00').getTime(),
            periodEnded: false
          }, { merge: true });
        } else {
          // If it exists but hadSex is false, forceful correction!
          specificRecords.forEach(r => {
            if (!r.hadSex) {
              setDoc(doc(db, 'users', currentUser.uid, 'records', r.id), {
                hadSex: true,
                didClimax: true,
                libido: Math.max(r.libido || 5, 5)
              }, { merge: true });
            }
          });
        }
      });
    }
  }, [currentUser, records.length]);

  const handleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error("Login failed", e);
    }
  };

  const handleSignOut = async () => {
    if (window.confirm("Deseja sair da conta?")) {
      await signOut(auth);
    }
  };

  const todayRecord = records.find(r => r.date === todayStr);

  const handleOpenCheckin = (dateToEdit?: string) => {
    const targetDate = dateToEdit || todayStr;
    setEditingDate(targetDate);

    const existingRecord = records.find(r => r.date === targetDate);

    if (existingRecord) {
      setCheckinLibido(existingRecord.libido);
      setCheckinActivities({
        hadSex: existingRecord.hadSex,
        masturbated: existingRecord.masturbated,
        usedTadala: existingRecord.usedTadala,
        didClimax: existingRecord.didClimax !== undefined ? existingRecord.didClimax : true
      });
      setCheckinPartner({
        periodStarts: existingRecord.periodStarts || false,
        periodEnds: existingRecord.periodEnds || existingRecord.periodEnded || false,
        medsStarts: existingRecord.medsStarts || false,
        medsEnds: existingRecord.medsEnds || false
      });
    } else {
      setCheckinLibido(3);
      setCheckinActivities({ hadSex: false, masturbated: false, usedTadala: false, didClimax: true });
      setCheckinPartner({ periodStarts: false, periodEnds: false, medsStarts: false, medsEnds: false });
    }
    setIsCheckinOpen(true);
  };

  const handleSaveCheckin = async () => {
    setSaveStatus('saving');
    // Find existing record for the editing date to keep ID if possible
    const existingIndex = records.findIndex(r => r.date === editingDate);
    const existingRecord = existingIndex > -1 ? records[existingIndex] : null;

    const recordId = existingRecord ? existingRecord.id : Date.now().toString();

    const newRecord: Record = {
      id: recordId,
      date: editingDate,
      libido: checkinLibido,
      hadSex: checkinActivities.hadSex,
      masturbated: checkinActivities.masturbated,
      usedTadala: checkinActivities.usedTadala,
      didClimax: checkinActivities.hadSex ? checkinActivities.didClimax : undefined,
      periodStarts: checkinPartner.periodStarts,
      periodEnds: checkinPartner.periodEnds,
      periodEnded: checkinPartner.periodEnds, 
      medsStarts: checkinPartner.medsStarts,
      medsEnds: checkinPartner.medsEnds,
      timestamp: new Date(editingDate + 'T12:00:00').getTime()
    };

    if (currentUser) {
      try {
        await setDoc(doc(db, 'users', currentUser.uid, 'records', recordId), newRecord);
      } catch (error) {
        handleFirestoreError(error, 'write', `/users/${currentUser.uid}/records/${recordId}`);
      }
    } else {
      let updatedRecords = [...records];
      if (existingIndex > -1) {
        updatedRecords[existingIndex] = newRecord;
      } else {
        updatedRecords.push(newRecord);
      }
      setRecords(updatedRecords);
    }

    setSaveStatus('saved');
    setIsCheckinOpen(false);
  };

  const toggleActivity = (key: keyof typeof checkinActivities) => {
    setCheckinActivities(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const togglePartner = (key: keyof typeof checkinPartner) => {
    setCheckinPartner(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // --- Logic: Partner Libido & Cycle Tracking (Selene) ---


  const getPartnerCycleInfo = () => {
    if (records.length === 0) return null;

    const sortedRecords = [...records].sort((a, b) => b.timestamp - a.timestamp);
    
    // Core markers
    const lastPeriodStart = sortedRecords.find(r => r.periodStarts);
    const lastPeriodEnd = sortedRecords.find(r => r.periodEnds || r.periodEnded);
    const lastMedsStart = sortedRecords.find(r => r.medsStarts);

    const startDate = lastPeriodStart ? new Date(lastPeriodStart.date + 'T12:00:00') : new Date('2026-05-18T12:00:00'); // Fallback to provided date
    const today = new Date(todayStr + 'T12:00:00');
    const diffTime = today.getTime() - startDate.getTime();
    const cycleDayRaw = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const cycleDay = ((cycleDayRaw - 1) % 28 + 28) % 28 + 1;

    // Phase determination for Cis-Female Cycle (adjusted for pill users)
    let phase: 'Menstrual' | 'Folicular' | 'Ovulatória' | 'Lútea' = 'Folicular';
    let phaseColor = 'text-green-500';
    let phaseIcon = <Sparkles size={16} />;
    let statusText = "Fase Folicular";

    const isCurrentlyBleeding = !lastPeriodEnd || new Date(lastPeriodEnd.date + 'T12:00:00') < startDate || 
                                (today >= startDate && today <= new Date(lastPeriodEnd.date + 'T12:00:00'));

    if (isCurrentlyBleeding || cycleDay <= 5) {
      phase = 'Menstrual';
      phaseColor = 'text-brand-500';
      phaseIcon = <Droplets size={16} />;
      statusText = "Menstruada";
    } else if (cycleDay >= 12 && cycleDay <= 16) {
      phase = 'Ovulatória';
      phaseColor = 'text-orange-500';
      phaseIcon = <Zap size={16} />;
      statusText = "Pico Fértil";
    } else if (cycleDay > 16) {
      phase = 'Lútea';
      phaseColor = 'text-purple-500';
      phaseIcon = <Cloud size={16} />;
      statusText = "Fase Lútea";
    }

    // Selene Logic: 21 days taking, 7 days break
    let pillDay: number | undefined;
    let isBreak = false;
    
    // If no medsStarts, assume it started with the last period start (common)
    const effectiveMedsStart = lastMedsStart ? new Date(lastMedsStart.date + 'T12:00:00') : startDate;
    const medsDiff = Math.floor((today.getTime() - effectiveMedsStart.getTime()) / (1000 * 60 * 60 * 24));
    const totalCycleDays = 28;
    const dayInMedCycle = (medsDiff % totalCycleDays) + 1;
    
    if (dayInMedCycle <= 21) {
      pillDay = dayInMedCycle;
      isBreak = false;
    } else {
      pillDay = dayInMedCycle - 21;
      isBreak = true;
    }

    // Predict Next Period (28 days from start)
    const nextPeriodDate = new Date(startDate);
    nextPeriodDate.setDate(startDate.getDate() + 28);

    return { 
      cycleDay, 
      phase, 
      phaseColor, 
      phaseIcon, 
      statusText, 
      pillDay, 
      isBreak, 
      nextPeriodDate 
    };
  };

  const partnerInfo = getPartnerCycleInfo();
  
  const handlePrint = () => {
     window.print();
  };

  // Main Render
  if (error) {
    return <ErrorFallback error={error} />;
  }

  return (
    <div className="min-h-screen bg-brand-50 font-sans text-slate-900 selection:bg-brand-200 flex flex-col">
      {/* HEADER */}
      <header className="sticky top-0 z-30 bg-brand-50/80 backdrop-blur-xl px-6 py-5 flex justify-between items-center border-b border-brand-100/50">
        <div className="flex items-center gap-3">
           <HeaderLogo />
           {saveStatus === 'saved' && (
             <span className="bg-green-50 text-green-600 text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-green-100 animate-in fade-in zoom-in duration-300">
               <Check size={10} strokeWidth={3} /> SALVO
             </span>
           )}
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all font-black text-[10px] uppercase tracking-widest shadow-sm print:hidden"
          >
             <Activity size={14} className="text-brand-600" />
             PDF / Imprimir
          </button>
          {currentUser ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brand-50 border border-brand-100 print:hidden">
               <Cloud size={14} className="text-brand-600" />
               <span className="text-[10px] font-black text-brand-600 uppercase tracking-widest">Sincronizado</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
               <Smartphone size={14} className="text-slate-400" />
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Local</span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 lg:p-10 pt-6 flex-1 w-full">
        {authLoading ? (
          <div className="max-w-md mx-auto flex flex-col items-center justify-center py-20 animate-pulse">
            <div className="w-16 h-16 bg-brand-100 rounded-[28px] flex items-center justify-center mb-4">
              <Zap size={32} className="text-brand-600" />
            </div>
            <p className="text-xs font-black text-slate-300 uppercase tracking-[0.3em]">Carregando...</p>
          </div>
        ) : (
          <Dashboard 
            records={records}
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            todayStr={todayStr}
            handleOpenCheckin={handleOpenCheckin}
            partnerInfo={partnerInfo}
          />
        )}
      </main>

      {/* Floating Checkin Modal */}
      {isCheckinOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity" onClick={() => setIsCheckinOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="pointer-events-auto w-full">
              <CheckinModal 
                editingDate={editingDate}
                todayStr={todayStr}
                checkinLibido={checkinLibido}
                setCheckinLibido={setCheckinLibido}
                checkinActivities={checkinActivities}
                toggleActivity={toggleActivity}
                checkinPartner={checkinPartner}
                togglePartner={togglePartner}
                handleSaveCheckin={handleSaveCheckin}
                onClose={() => setIsCheckinOpen(false)}
              />
            </div>
          </div>
        </>
      )}

      {/* Toast for Save Status (Saving only, Saved is in header now) */}
      {saveStatus === 'saving' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3 z-50 animate-in slide-in-from-bottom-5">
           <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
           <span className="font-bold text-sm">Salvando...</span>
        </div>
      )}

    </div>
  );
};

// --- Sub-components (Moved out of App to avoid hook issues and clean up) ---

const ErrorFallback = ({ error }: { error: string }) => (
  <div className="min-h-screen bg-rose-50 flex flex-col items-center justify-center p-6 text-center">
    <div className="w-20 h-20 bg-rose-100 rounded-[32px] flex items-center justify-center mb-6">
      <AlertCircle size={40} className="text-rose-600" />
    </div>
    <h1 className="text-2xl font-black text-slate-900 font-display italic mb-2">Ops! Algo deu errado</h1>
    <p className="text-sm font-medium text-slate-600 max-w-xs mb-8">
      Ocorreu um erro ao carregar o aplicativo. Tente recarregar a página.
    </p>
    <div className="bg-white border border-rose-100 p-4 rounded-2xl mb-8 w-full max-w-sm text-left overflow-auto max-h-40">
      <code className="text-[10px] text-rose-500 break-all">{error}</code>
    </div>
    <button 
      onClick={() => window.location.reload()}
      className="btn-primary px-8 py-4 rounded-3xl"
    >
      Recarregar App
    </button>
  </div>
);

const Dashboard = ({ 
  records, currentDate, setCurrentDate, todayStr, 
  handleOpenCheckin, partnerInfo 
}: any) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const now = new Date();
  const currentYear = now.getFullYear();
  const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
  const totalDaysInYear = isLeapYear(year) ? 366 : 365;
  
  let daysPassed = 0;
  if (year < currentYear) {
    daysPassed = totalDaysInYear;
  } else if (year === currentYear) {
    const startOfYear = new Date(year, 0, 1);
    const diff = now.getTime() - startOfYear.getTime();
    daysPassed = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
  }

  const uniqueDaysWithSex = new Set(
    records.filter((r: any) => r.hadSex && new Date(r.date + 'T12:00:00').getFullYear() === year).map((r: any) => r.date)
  ).size;
  const sexPercentage = daysPassed > 0 ? ((uniqueDaysWithSex / daysPassed) * 100).toFixed(1) : '0.0';
  const avgLibido = records.length > 0 ? records.reduce((acc: any, r: any) => acc + r.libido, 0) / records.length : 0;
  
  // History filtered to show ONLY days with sex, sorted by date descending, showing all for the current year
  const sexHistory = [...records]
    .filter((r: any) => r.hadSex)
    .sort((a,b) => b.timestamp - a.timestamp);

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const currentMonthName = capitalize(currentDate.toLocaleString('pt-BR', { month: 'long' }));
  const prevMonthDate = new Date(year, month - 1, 1);
  const prevMonthName = capitalize(prevMonthDate.toLocaleString('pt-BR', { month: 'long' }));

  const monthlyComparisonData = Array.from({ length: 31 }, (_, idx) => {
    const dayNum = idx + 1;
    
    // Find record for current month on this day
    const curRecord = records.find((r: any) => {
      const parts = r.date.split('-');
      if (parts.length !== 3) return false;
      const rYear = parseInt(parts[0], 10);
      const rMonth = parseInt(parts[1], 10) - 1; // 0-indexed
      const rDay = parseInt(parts[2], 10);
      return rYear === year && rMonth === month && rDay === dayNum;
    });

    // Find record for previous month on this day
    const prevRecord = records.find((r: any) => {
      const parts = r.date.split('-');
      if (parts.length !== 3) return false;
      const rYear = parseInt(parts[0], 10);
      const rMonth = parseInt(parts[1], 10) - 1; // 0-indexed
      const rDay = parseInt(parts[2], 10);
      return rYear === prevMonthDate.getFullYear() && rMonth === prevMonthDate.getMonth() && rDay === dayNum;
    });

    return {
      day: dayNum,
      libidoAtual: curRecord ? curRecord.libido : null,
      libidoAnterior: prevRecord ? prevRecord.libido : null
    };
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 animate-in fade-in slide-in-from-bottom-4 duration-700 items-start print:block">
      
      {/* Print Only Header */}
      <div className="hidden print:block mb-8 border-b-2 border-slate-900 pb-6 text-center">
        <h1 className="text-4xl font-black font-display italic tracking-tight mb-2">RELATÓRIO DE PERFORMANCE CONEXÃO</h1>
        <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Documento Gerado em {new Date().toLocaleDateString('pt-BR')} • {year}</p>
        <div className="mt-8 grid grid-cols-3 gap-8">
           <div className="p-4 bg-slate-50 rounded-2xl">
              <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Total de Transas</span>
              <span className="text-3xl font-black text-brand-600">{uniqueDaysWithSex}</span>
           </div>
           <div className="p-4 bg-slate-50 rounded-2xl">
              <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Aproveitamento</span>
              <span className="text-3xl font-black text-slate-900">{sexPercentage}%</span>
           </div>
           <div className="p-4 bg-slate-50 rounded-2xl">
              <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Libido Média</span>
              <span className="text-3xl font-black text-slate-900">{avgLibido.toFixed(1)}</span>
           </div>
        </div>
      </div>

      {/* Sidebar: Performance & Cycle - Hidden in print or adjusted */}
      <div className="lg:col-span-4 space-y-8 print:hidden">
        <section className="relative overflow-hidden bg-brand-600 rounded-[40px] p-8 text-white shadow-2xl shadow-brand-900/20">
           <div className="absolute -top-24 -right-24 w-64 h-64 bg-brand-400 rounded-full blur-3xl opacity-20 animate-pulse"></div>
           <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-brand-900 rounded-full blur-3xl opacity-30"></div>
           <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-2">
                   <div className="p-2 bg-white/10 backdrop-blur-md rounded-xl">
                      <Zap size={18} className="text-brand-100" />
                   </div>
                   <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-100">Performance Anual</span>
                 </div>
                 <div className="bg-black/20 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/5 flex items-center shrink-0">
                   <span className="text-[10px] font-black uppercase tracking-widest text-brand-100 italic whitespace-nowrap">
                     Dia {daysPassed} de {totalDaysInYear}
                   </span>
                 </div>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                 <h2 className="text-7xl font-black font-display tracking-tighter italic">{uniqueDaysWithSex}</h2>
                 <span className="text-xl font-bold text-brand-100 italic">dias transando</span>
              </div>
              <div className="mb-8">
                 <p className="text-sm font-medium text-brand-100/80 mb-3">
                   Relação de aproveitamento: {sexPercentage}% dos dias em {year}.
                 </p>
                 <div className="w-full bg-brand-900/40 rounded-full h-3 p-0.5 border border-white/10">
                    <div className="bg-gradient-to-r from-brand-300 to-white h-full rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)] transition-all duration-1000" style={{ width: `${Math.min(Number(sexPercentage), 100)}%` }}></div>
                 </div>
                 
                 <div className="mt-4 px-4 py-3 bg-brand-700/40 rounded-2xl border border-brand-500/20">
                    <span className="text-[9px] font-black uppercase text-brand-200 block mb-0.5">Contato Recente</span>
                    <p className="text-xs font-black text-white italic">
                      Última relação em 5 de Junho (sexta-feira) — primeiro dia do mês de Junho.
                    </p>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-6 border-t border-white/10">
                 <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-brand-200/60">Libido Média</span>
                    <div className="flex items-center gap-2">
                       <Flame size={14} className="text-brand-300" />
                       <span className="text-lg font-black font-display tracking-tight italic">{avgLibido.toFixed(1)}</span>
                    </div>
                 </div>
                 <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-brand-200/60">Prev. Menstruação</span>
                    <div className="flex items-center gap-2">
                       <CalendarHeart size={14} className="text-brand-300" />
                       <span className="text-lg font-black font-display tracking-tight italic">
                         {partnerInfo?.nextPeriodDate ? partnerInfo.nextPeriodDate.toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'}) : '--'}
                       </span>
                    </div>
                 </div>
              </div>
           </div>
        </section>

        {/* Ciclo de Marcelly Dashboard */}
        {partnerInfo && (
          <section className="neo-card p-6 bg-gradient-to-br from-white to-brand-50/20 overflow-hidden relative border border-brand-100/30 shadow-2xl shadow-brand-900/10 ring-1 ring-brand-50/50">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-200/15 rounded-full blur-3xl"></div>
            
            <div className="flex justify-between items-start mb-6">
              <div className="relative z-10">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                  <CalendarHeart size={14} className="text-brand-500" />
                  Ciclo de Marcelly
                </h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-slate-900 leading-none">Dia {partnerInfo.cycleDay}</span>
                  <span className="text-xs font-bold text-slate-400">do ciclo</span>
                </div>
              </div>
              <div className={`px-4 py-2 rounded-2xl flex items-center gap-2 font-black text-[10px] uppercase tracking-wider ${partnerInfo.phaseColor} bg-white shadow-sm border border-slate-50 relative z-10 animate-pulse`}>
                {partnerInfo.phaseIcon}
                {partnerInfo.phase}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 relative z-10">
              <div className="bg-white/60 backdrop-blur p-4 rounded-3xl border border-white">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Medicação Selene</span>
                {partnerInfo.isBreak ? (
                  <div className="flex items-center gap-2 text-brand-600 font-black text-sm">
                    <Ban size={16} />
                    <span>Pausa ({partnerInfo.pillDay}/7)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-brand-600 font-black text-sm">
                    <Pill size={16} />
                    <span>Comp. {partnerInfo.pillDay}/21</span>
                  </div>
                )}
                <div className="w-full bg-slate-100 h-1 rounded-full mt-3 overflow-hidden">
                  <div 
                    className="bg-brand-500 h-full transition-all duration-1000 shadow-[0_0_8px_rgba(239,68,68,0.4)]" 
                    style={{ width: `${partnerInfo.isBreak ? ((partnerInfo.pillDay || 0) / 7) * 100 : ((partnerInfo.pillDay || 0) / 21) * 100}%` }}
                  ></div>
                </div>
              </div>

              <div className="bg-white/60 backdrop-blur p-4 rounded-3xl border border-white">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Previsão Fluxo</span>
                <div className="flex items-center gap-2 text-slate-800 font-black text-sm">
                  <div className="p-1.5 bg-brand-50 rounded-lg">
                    <Droplets size={14} className="text-brand-500" />
                  </div>
                  <span>{partnerInfo.nextPeriodDate ? partnerInfo.nextPeriodDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '--'}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100/50 flex justify-between gap-1.5 relative z-10">
              {[
                { label: 'Menstrual' },
                { label: 'Folicular' },
                { label: 'Ovulatória' },
                { label: 'Lútea' }
              ].map((p, i) => {
                const isActive = partnerInfo.phase === p.label;
                return (
                  <div key={p.label} className="flex-1 flex flex-col items-center gap-1.5">
                    <div className={`h-1.5 w-full rounded-full transition-all duration-500 ${isActive ? 'bg-brand-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]' : 'bg-slate-100'}`}></div>
                    <span className={`text-[10px] font-black uppercase tracking-tighter text-center leading-none mt-1 ${isActive ? 'text-brand-600' : 'text-slate-300'}`}>{p.label}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* MAIN CONTENT: Calendar, Chart & History */}
      <div className="lg:col-span-8 space-y-8">
        <section className="neo-card p-6">
           <div className="flex items-center justify-between mb-8">
              <button onClick={prevMonth} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-all active:scale-90">
                <ChevronLeft size={20} strokeWidth={3} />
              </button>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] font-display">
                {currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
              </h3>
              <button onClick={nextMonth} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-all active:scale-90">
                <ChevronRight size={20} strokeWidth={3} />
              </button>
           </div>
           <div className="grid grid-cols-7 mb-6 text-center">
             {['D','S','T','Q','Q','S','S'].map((d, index) => (
               <div key={`weekday-${index}`} className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{d}</div>
             ))}
           </div>
           <div className="grid grid-cols-7 gap-y-4 gap-x-2">
              {Array.from({length: firstDay}).map((_, i) => <div key={`empty-${i}`} />)}
              {Array.from({length: daysInMonth}).map((_, i) => {
                const day = i + 1;
                const dStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const rec = records.find((r: any) => r.date === dStr);
                const isToday = dStr === todayStr;
                const hasRecord = !!rec;
                const cycle = getMarcellyCycleStateForDate(dStr);

                // Build gorgeous color overlays and backgrounds for cycle statuses
                let cycleStyles = '';
                if (!hasRecord && !isToday) {
                  if (cycle.isPillStart) {
                    cycleStyles = 'border-2 border-blue-500 bg-blue-50/80 text-blue-900 ring-2 ring-blue-200 shadow-sm';
                  } else if (cycle.isPillEnd) {
                    cycleStyles = 'border-2 border-amber-400 border-dashed bg-amber-50/80 text-amber-900 shadow-sm';
                  } else if (cycle.isPeriodStart) {
                    cycleStyles = 'border-2 border-orange-400 bg-orange-50/80 text-orange-950 font-semibold shadow-sm';
                  } else if (cycle.isPeakFlow) {
                    cycleStyles = 'border-2 border-red-600 bg-red-50/90 text-red-950 font-bold shadow-md';
                  } else if (cycle.isPeriodEnd) {
                    cycleStyles = 'border-2 border-green-500 bg-green-50/80 text-green-950 font-semibold shadow-sm';
                  } else if (cycle.isFertileWindow) {
                    cycleStyles = 'border-2 border-teal-400 bg-teal-50/80 text-teal-950 font-bold shadow-sm';
                  }
                }

                // Collect list of microdots for this specific calendar cell
                const indicators = [];
                if (cycle.isPillStart) {
                  indicators.push(<span key="i-pstart" className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-sm block shrink-0 animate-pulse" title="Volta a Tomar o Remédio" />);
                }
                if (cycle.isPillEnd) {
                  indicators.push(<span key="i-pend" className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-sm block shrink-0" title="Último Comprimido da Cartela" />);
                }
                if (cycle.isPeriodStart) {
                  indicators.push(<span key="i-mstart" className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-sm block shrink-0" title="Início da Menstruação (Previsão)" />);
                }
                if (cycle.isPeakFlow) {
                  indicators.push(<span key="i-mpeak" className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse block shrink-0" title="Maior Fluxo Menstrual (Previsão)" />);
                }
                if (cycle.isPeriodEnd) {
                  indicators.push(<span key="i-mend" className="w-1.5 h-1.5 rounded-full bg-green-500 block shrink-0" title="Fim da Menstruação (Previsão)" />);
                }
                if (cycle.isFertileWindow) {
                  indicators.push(<span key="i-fert" className="w-1.5 h-1.5 rounded-full bg-teal-400 block shrink-0 animate-pulse" title="Período Fértil / Alta Libido (Previsão)" />);
                }

                // Base style determination
                let baseStyle = '';
                if (hasRecord) {
                  baseStyle = rec?.hadSex
                    ? 'bg-brand-600 text-white shadow-xl shadow-brand-600/35 ring-2 ring-brand-400 font-bold'
                    : rec?.masturbated
                    ? 'bg-orange-500 text-white shadow-md font-bold'
                    : 'bg-white border-2 border-slate-200 text-slate-400';
                } else if (isToday) {
                  baseStyle = 'bg-slate-900 text-white shadow-2xl ring-4 ring-slate-100 ring-offset-1 font-extrabold';
                } else {
                  baseStyle = cycleStyles || 'bg-slate-50 text-slate-500 hover:bg-brand-50 hover:text-brand-600';
                }

                return (
                  <div 
                    key={day} 
                    onClick={() => handleOpenCheckin(dStr)} 
                    className={`aspect-square flex flex-col items-center justify-between p-1 rounded-2xl relative transition-all cursor-pointer hover:scale-110 active:scale-95 group ${baseStyle}`}
                  >
                     {/* Row for indicators / top markers */}
                     <div className="w-full flex justify-end h-3 pr-0.5 mt-0.5">
                       {rec?.hadSex && (
                         <div className="bg-white p-0.5 rounded-full text-brand-600 shadow-[0_2px_5px_rgba(0,0,0,0.1)] border border-brand-100">
                           <Flame size={10} fill="currentColor" />
                         </div>
                       )}
                       {!rec?.hadSex && rec?.masturbated && (
                         <div className="bg-white p-0.5 rounded-full text-orange-500 shadow-sm border border-orange-100">
                           <UserIcon size={10} />
                         </div>
                       )}
                       {!rec?.hadSex && !rec?.masturbated && hasRecord && (
                         <div className="bg-white p-1 rounded-full text-slate-400 shadow-sm border border-slate-100 flex items-center justify-center">
                           <Ban size={8} />
                         </div>
                       )}
                     </div>

                     {/* The calendar day number itself */}
                     <span className={`text-xs font-black font-display leading-none -mt-1 ${rec?.hadSex || isToday ? 'text-white' : ''}`}>
                       {day}
                     </span>

                     {/* The Row of Cycle Microdots at the bottom of the cell */}
                     <div className="w-full flex justify-center gap-0.5 min-h-[6px] mb-1">
                       {indicators}
                     </div>

                     {/* Bottom historical manual cycle markers */}
                     {rec?.periodStarts && (
                       <div className="absolute top-1/2 left-1.5 -translate-y-1/2 w-1.5 h-1.5 bg-brand-500 rounded-full border border-white shadow-sm" title="Desceu!"></div>
                     )}
                     {(rec?.periodEnds || rec?.periodEnded) && (
                       <div className="absolute top-1/2 right-1.5 -translate-y-1/2 w-1.5 h-1.5 bg-yellow-400 rounded-full border border-white shadow-sm" title="Limpo!"></div>
                     )}
                  </div>
                );
              })}
            </div>

            {/* Legenda do Ciclo de Marcelly */}
            <div className="mt-8 pt-6 border-t border-slate-100">
              <div className="flex items-center gap-2 mb-4">
                <CalendarHeart size={16} className="text-brand-500" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 font-display">Legendas e Previsões do Ciclo (Marcelly)</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                
                <div className="p-3 rounded-2xl bg-blue-50/60 border border-blue-200 flex items-start gap-2.5 font-sans">
                  <div className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-blue-500 mt-1 shadow-[0_0_5px_rgba(59,130,246,0.5)] animate-pulse"></div>
                  <div>
                    <h5 className="text-[10px] font-black text-blue-950 uppercase tracking-wide">Volta a Tomar o Remédio</h5>
                    <p className="text-[9px] font-semibold text-slate-500 leading-normal mt-0.5">Dia 1 do ciclo Selene. Início do novo blister de comprimidos.</p>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-teal-50/60 border border-teal-200 flex items-start gap-2.5 font-sans">
                  <div className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-teal-400 mt-1 shadow-[0_0_5px_rgba(45,212,191,0.5)] animate-pulse font-sans"></div>
                  <div>
                    <h5 className="text-[10px] font-black text-teal-950 uppercase tracking-wide">Período Fértil / Libido ⬆</h5>
                    <p className="text-[9px] font-semibold text-slate-500 leading-normal mt-0.5">Dias 11 a 16. Janela fértil e pico previsível de libido.</p>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-amber-50/60 border border-amber-200 flex items-start gap-2.5 font-sans">
                  <div className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-amber-400 mt-1 shadow-[0_0_5px_rgba(251,191,36,0.5)]"></div>
                  <div>
                    <h5 className="text-[10px] font-black text-amber-950 uppercase tracking-wide">Deixa de Tomar / Fim</h5>
                    <p className="text-[9px] font-semibold text-slate-500 leading-normal mt-0.5">Dia 21 de comprimidos. Pausa de 7 dias se inicia no dia seguinte.</p>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-orange-50/60 border border-orange-200 flex items-start gap-2.5 font-sans">
                  <div className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-orange-500 mt-1 shadow-[0_0_5px_rgba(249,115,22,0.5)]"></div>
                  <div>
                    <h5 className="text-[10px] font-black text-orange-950 uppercase tracking-wide">Início da Menstruação</h5>
                    <p className="text-[9px] font-semibold text-slate-500 leading-normal mt-0.5">Dias 23-24 (Pausa dia 2-3). Previsão aproximada de sangramento.</p>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-red-50/60 border border-red-200 flex items-start gap-2.5 font-sans">
                  <div className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-red-600 mt-1 shadow-[0_0_5px_rgba(220,38,38,0.5)] animate-pulse"></div>
                  <div>
                    <h5 className="text-[10px] font-black text-red-950 uppercase tracking-wide">Maior Fluxo (Pico)</h5>
                    <p className="text-[9px] font-semibold text-slate-500 leading-normal mt-0.5">Dias 25-26. Dias previstos de maior intensidade menstrual e cólicas.</p>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-green-50/60 border border-green-200 flex items-start gap-2.5 font-sans font-display">
                  <div className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-green-500 mt-1 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></div>
                  <div>
                    <h5 className="text-[10px] font-black text-green-950 uppercase tracking-wide">Fim da Menstruação</h5>
                    <p className="text-[9px] font-semibold text-slate-500 leading-normal mt-0.5">Dia 28 da pausa. Fim do período, repouso do útero finalizado.</p>
                  </div>
                </div>

              </div>
            </div>
         </section>

        <section className="neo-card p-6 overflow-hidden">
           <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-brand-50 rounded-xl"><Activity size={18} className="text-brand-600" /></div>
                 <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-900 font-display">Oscilação</h3>
              </div>
           </div>
           <div className="h-56 w-full -ml-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[...records].sort((a,b) => a.timestamp - b.timestamp).slice(-15)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorLibido" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e53e3e" stopOpacity={0.3}/><stop offset="95%" stopColor="#e53e3e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tickFormatter={(val) => new Date(val).getDate().toString()} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} dy={10} />
                <YAxis domain={[0, 6]} hide={true} />
                <Tooltip cursor={{stroke: '#fca5a5', strokeWidth: 2, strokeDasharray: '5 5'}} content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as Record;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-2xl border border-slate-800 animate-in zoom-in-95 duration-200">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{new Date(data.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</p>
                          <p className="text-sm font-black italic font-display">Libido: {LIBIDO_META[data.libido].label}</p>
                        </div>
                      );
                    }
                    return null;
                  }} />
                <Area type="monotone" dataKey="libido" stroke="#e53e3e" strokeWidth={5} fillOpacity={1} fill="url(#colorLibido)" animationDuration={2000} />
              </AreaChart>
            </ResponsiveContainer>
           </div>
        </section>

        <section className="neo-card p-6 overflow-hidden">
           <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-brand-50 rounded-xl"><Activity size={18} className="text-brand-600" /></div>
                 <div>
                   <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-900 font-display">Comparativo Mensal de Libido</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{currentMonthName} vs. {prevMonthName}</p>
                 </div>
              </div>
           </div>
           
           <div className="h-64 w-full -ml-6">
             <ResponsiveContainer width="100%" height="100%">
               <LineChart data={monthlyComparisonData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                 <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} dy={10} label={{ value: 'Dia do Mês', position: 'insideBottom', offset: -5, fill: '#94a3b8', fontSize: 10, fontWeight: 900 }} />
                 <YAxis domain={[1, 5]} hide={true} />
                 <Tooltip cursor={{ stroke: '#fca5a5', strokeWidth: 1, strokeDasharray: '5 5' }} content={({ active, payload }) => {
                     if (active && payload && payload.length) {
                       const day = payload[0].payload.day;
                       return (
                         <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-800 animate-in zoom-in-95 duration-200 text-xs space-y-1.5">
                           <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dia {day} do Mês</p>
                           {payload.map((entry, index) => {
                             if (entry.value === null || entry.value === undefined) return null;
                             const val = entry.value as number;
                             const label = LIBIDO_META[val]?.label || val;
                             return (
                               <div key={index} className="flex items-center gap-2">
                                 <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                 <span className="font-bold">{entry.name}:</span>
                                 <span className="font-black italic font-display">{label} ({val})</span>
                               </div>
                             );
                           })}
                         </div>
                       );
                     }
                     return null;
                   }} />
                 <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', tracking: '0.1em', paddingLeft: '24px' }} />
                 <Line type="monotone" dataKey="libidoAtual" stroke="#e53e3e" strokeWidth={4} activeDot={{ r: 6 }} name={`${currentMonthName} (${year})`} connectNulls dot={{ r: 3, strokeWidth: 2, fill: '#fff' }} />
                 <Line type="monotone" dataKey="libidoAnterior" stroke="#94a3b8" strokeWidth={2.5} strokeDasharray="4 4" activeDot={{ r: 4 }} name={`${prevMonthName} (Anterior)`} connectNulls dot={{ r: 2, strokeWidth: 1, fill: '#fff' }} />
               </LineChart>
             </ResponsiveContainer>
           </div>
        </section>

        <section className="space-y-6 print:mt-10">
          <div className="flex justify-between items-end px-2">
            <div className="space-y-1">
               <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] font-display">Histórico de Performance</h3>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Apenas dias com relação</p>
            </div>
            <div className="flex items-baseline gap-1">
               <span className="text-2xl font-black text-brand-600 font-display italic">{sexHistory.length}</span>
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">no total</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4 print:grid-cols-1">
             {sexHistory.map((rec: any) => (
                <div key={rec.id} className="neo-card p-5 flex items-center gap-5 group hover:border-brand-200 transition-all print:shadow-none print:border-slate-100">
                   <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg transition-transform group-hover:scale-110 print:shadow-sm" style={{ backgroundColor: LIBIDO_META[rec.libido].color }}>
                      <Flame size={24} fill="currentColor" />
                   </div>
                   <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                         <h4 className="text-lg font-black text-slate-900 font-display italic">{new Date(rec.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</h4>
                         <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest print:text-slate-400">{LIBIDO_META[rec.libido].label}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                         {rec.hadSex && rec.didClimax === false && <span className="px-3 py-1 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black flex items-center gap-1.5 border border-rose-100 italic"><AlertCircle size={10} /> SEM CLÍMAX</span>}
                         {rec.hadSex && rec.didClimax === true && <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black flex items-center gap-1.5 border border-emerald-100"><Check size={10} strokeWidth={3} /> FINALIZOU</span>}
                         {rec.hadSex && <span className="px-3 py-1 bg-brand-50 text-brand-600 rounded-xl text-[10px] font-black flex items-center gap-1.5 border border-brand-100"><Heart size={10} fill="currentColor" /> TRANSA</span>}
                         {rec.usedTadala && <span className="px-3 py-1 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-black flex items-center gap-1.5 border border-slate-200"><Pill size={10} /> TADALA</span>}
                      </div>
                   </div>
                </div>
             ))}
             {sexHistory.length === 0 && <div className="neo-card py-12 text-center text-slate-400 font-bold text-sm opacity-50 italic">Nenhum registro de transa ainda.</div>}
          </div>
        </section>
      </div>

      <footer className="lg:col-span-12 py-12 text-center space-y-6">
        <div className="flex flex-col items-center">
          <div className="w-12 h-px bg-brand-200 mb-6"></div>
          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 mb-2">CONEXÃO <span className="text-brand-200 mx-2">•</span> GESTÃO DE PERFORMANCE</h4>
          <p className="text-[10px] font-bold text-slate-400">Desenvolvido por André Brito</p>
        </div>
        <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-white border border-slate-100 shadow-sm">
           <Smartphone size={14} className="text-brand-300" strokeWidth={2.5} /><span className="text-xs font-black tracking-widest text-slate-400">21 994 527 694</span>
        </div>
      </footer>
    </div>
  );
};

const CheckinModal = ({ 
  editingDate, todayStr, checkinLibido, setCheckinLibido, 
  checkinActivities, toggleActivity, checkinPartner, togglePartner, 
  handleSaveCheckin, onClose 
}: any) => {
  const dateObj = new Date(editingDate + 'T12:00:00');
  const isToday = editingDate === todayStr;
  const dateTitle = isToday ? "Check-in de Hoje" : `Check-in: ${dateObj.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}`;

  return (
    <div className="bg-white w-full max-w-md mx-auto rounded-[40px] p-8 shadow-2xl animate-in slide-in-from-bottom-10 duration-500 max-h-[90vh] overflow-y-auto border border-white/20 pointer-events-auto">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 font-display italic tracking-tight">{dateTitle}</h2>
          {!isToday && <p className="text-[10px] text-brand-500 font-black uppercase tracking-[0.2em] mt-1">Registro Retroativo</p>}
        </div>
        <button onClick={onClose} className="w-10 h-10 bg-slate-50 rounded-2xl text-slate-400 hover:bg-brand-50 hover:text-brand-600 transition-all active:scale-90 flex items-center justify-center">
          <XIcon size={20} strokeWidth={3} />
        </button>
      </div>
      <div className="space-y-8">
        <div className="space-y-4">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest text-center">Nível de desejo (Você)</p>
          <div className="flex justify-between gap-2 bg-slate-50 p-2 rounded-[28px] border border-slate-100">
            {[1, 2, 3, 4, 5].map((level) => (
              <button key={level} onClick={() => setCheckinLibido(level)} className={`flex-1 aspect-square rounded-2xl flex items-center justify-center transition-all duration-300 ${checkinLibido === level ? 'scale-110 shadow-xl shadow-brand-600/20 text-white' : 'text-slate-300 hover:bg-white hover:text-slate-200'}`} style={{ backgroundColor: checkinLibido === level ? LIBIDO_META[level].color : 'transparent' }}>
                <LibidoIcon level={level} size={28} />
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest text-center">Suas Atividades</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button key="no-sex" onClick={() => {}} className={`p-5 rounded-[32px] border-2 flex flex-col items-center gap-2 transition-all ${(!checkinActivities.hadSex && !checkinActivities.masturbated && !checkinActivities.usedTadala) ? 'bg-slate-800 border-slate-800 text-white shadow-xl scale-105' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}>
              <Ban size={28} strokeWidth={3} /><span className="font-black text-[10px] uppercase tracking-widest">Não Rolou</span>
            </button>
            <button key="transa" onClick={() => toggleActivity('hadSex')} className={`p-4 rounded-3xl border-2 flex flex-col items-center gap-2 transition-all ${checkinActivities.hadSex ? 'bg-brand-600 border-brand-600 text-white shadow-lg shadow-brand-600/20' : 'bg-white border-slate-100 text-slate-400 hover:border-brand-100'}`}>
              <Heart size={24} fill={checkinActivities.hadSex ? "currentColor" : "none"} strokeWidth={3} /><span className="font-black text-[10px] uppercase tracking-widest">Transa</span>
            </button>
            <button key="solo" onClick={() => toggleActivity('masturbated')} className={`p-4 rounded-3xl border-2 flex flex-col items-center gap-2 transition-all ${checkinActivities.masturbated ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-white border-slate-100 text-slate-400 hover:border-orange-100'}`}>
              <UserIcon size={24} strokeWidth={3} /><span className="font-black text-[10px] uppercase tracking-widest">Solo</span>
            </button>
            <button key="tadala" onClick={() => toggleActivity('usedTadala')} className={`p-4 rounded-3xl border-2 flex flex-col items-center gap-2 transition-all ${checkinActivities.usedTadala ? 'bg-slate-800 border-slate-800 text-white shadow-lg shadow-slate-800/20' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'}`}>
              <Pill size={24} strokeWidth={3} /><span className="font-black text-[10px] uppercase tracking-widest">Tadala</span>
            </button>
          </div>
          {checkinActivities.hadSex && (
            <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100 animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={24} className="text-emerald-600" />
                <div>
                  <span className="block font-black text-xs text-emerald-900 uppercase tracking-widest">Gozou?</span>
                  <span className="text-[10px] text-emerald-600 font-bold">{checkinActivities.didClimax ? "Sim, finalizado" : "Não, sem clímax"}</span>
                </div>
              </div>
              <button onClick={() => toggleActivity('didClimax')} className={`w-14 h-8 rounded-full relative transition-all duration-300 ${checkinActivities.didClimax ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-300 ${checkinActivities.didClimax ? 'left-7' : 'left-1 shadow-sm'}`}></div>
              </button>
            </div>
          )}
        </div>
        <div className="bg-brand-50/50 p-6 rounded-[32px] border border-brand-100 space-y-4">
           <p className="text-xs font-black text-brand-600 uppercase tracking-widest text-center flex items-center justify-center gap-2">
             <CalendarHeart size={16} /> Ciclo da Marcelly
           </p>
           <div className="grid grid-cols-2 gap-3">
              <button onClick={() => togglePartner('periodStarts')} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition-all ${checkinPartner.periodStarts ? 'bg-brand-600 border-brand-600 text-white shadow-md' : 'bg-white border-white text-slate-400 hover:border-brand-200'}`}>
                <Droplets size={20} strokeWidth={3} /><span className="font-black text-[10px] uppercase tracking-widest">Desceu</span>
              </button>
              <button onClick={() => togglePartner('periodEnds')} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition-all ${checkinPartner.periodEnds ? 'bg-yellow-500 border-yellow-500 text-white shadow-md' : 'bg-white border-white text-slate-400 hover:border-yellow-200'}`}>
                <Sparkles size={20} strokeWidth={3} /><span className="font-black text-[10px] uppercase tracking-widest">Acabou</span>
              </button>
              <button onClick={() => togglePartner('medsStarts')} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition-all ${checkinPartner.medsStarts ? 'bg-blue-500 border-blue-500 text-white shadow-md' : 'bg-white border-white text-slate-400 hover:border-blue-200'}`}>
                <PlayCircle size={20} strokeWidth={3} /><span className="font-black text-[10px] uppercase tracking-widest">Retomou</span>
              </button>
              <button onClick={() => togglePartner('medsEnds')} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition-all ${checkinPartner.medsEnds ? 'bg-orange-400 border-orange-400 text-white shadow-md' : 'bg-white border-white text-slate-400 hover:border-orange-200'}`}>
                <StopCircle size={20} strokeWidth={3} /><span className="font-black text-[10px] uppercase tracking-widest">Pausa</span>
              </button>
           </div>
        </div>
        <button onClick={handleSaveCheckin} className="btn-primary w-full text-lg font-black uppercase tracking-widest py-5 rounded-[28px]">
          {isToday ? "Salvar Hoje" : "Salvar Histórico"}
        </button>
      </div>
    </div>
  );
};

export default App;