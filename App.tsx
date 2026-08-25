import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInAnonymously, signOut, User } from 'firebase/auth';
import { initializeFirestore, collection, onSnapshot, doc, setDoc, query, orderBy, deleteDoc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';
import { 
  ResponsiveContainer, AreaChart, Area, Tooltip, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend, ComposedChart, Bar
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
  AlertCircle,
  Thermometer,
  Sun,
  Snowflake,
  Wind,
  CloudSun,
  TrendingUp,
  TrendingDown,
  BarChart3
} from 'lucide-react';

// --- Firebase Initialization ---
const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();

// --- Firestore Connection Test ---

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

// Header Logo (Professional Gradient & Icon Mark)
const HeaderLogo = () => (
  <div className="flex items-center gap-3 group cursor-pointer">
    <div className="relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-rose-500 via-red-600 to-rose-700 text-white shadow-lg shadow-rose-950/40 border border-rose-400/30 group-hover:scale-105 transition-all duration-300 flex-shrink-0">
      <Flame className="w-5 h-5 sm:w-6 sm:h-6 text-white fill-white/20" />
      <span className="absolute -bottom-1 -right-1 text-xs select-none">🫦</span>
    </div>
    <div className="flex flex-col">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl sm:text-3xl font-black font-display uppercase tracking-tight py-1 leading-snug flex items-center overflow-visible">
          <span className="bg-gradient-to-r from-white via-slate-100 to-slate-200 bg-clip-text text-transparent">CONE</span>
          <span className="bg-gradient-to-r from-rose-500 to-red-500 bg-clip-text text-transparent pr-1">XÃO</span>
        </h1>
        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-sm backdrop-blur-sm hidden sm:inline-block">
          PERFORMANCE
        </span>
      </div>
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
        Gestão & Métricas
      </span>
    </div>
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
  const baseDate = new Date('2026-08-10T12:00:00'); // Standard reference date when period and meds started
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

  // Auth Listener (Automatic Firebase Cloud Session)
  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      setError(e.message);
    };
    window.addEventListener('error', handleError);

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        try {
          // Automatically sign in anonymously to guarantee every session connects to Firebase Cloud
          await signInAnonymously(auth);
        } catch (anonErr: any) {
          console.warn("Auto anonymous auth failed, using local session:", anonErr);
          setAuthLoading(false);
        }
      } else {
        setCurrentUser(user);
        setAuthLoading(false);
      }
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
        '2026-05-31', '2026-06-05', '2026-06-07', '2026-06-18', '2026-06-21', '2026-06-26',
        '2026-07-04', '2026-07-05', '2026-07-18', '2026-07-19', '2026-07-24', '2026-07-26', '2026-07-30',
        '2026-08-04', '2026-08-07', '2026-08-08', '2026-08-09', '2026-08-10', '2026-08-23', '2026-08-24'
      ];
      let modified = false;
      
      forcedHistory.forEach(d => {
        const existingIdx = loadedRecords.findIndex(r => r.date === d);
        
        if (existingIdx === -1) {
          const isApril23 = d === '2026-04-23';
          const isMay18 = d === '2026-05-18';
          const isMay22 = d === '2026-05-22';
          const isJune18 = d === '2026-06-18';
          const isAugust10 = d === '2026-08-10';

          loadedRecords.push({
            id: 'forced-' + d,
            date: d,
            hadSex: !isMay18 && !isMay22 && !isJune18 && !isAugust10, // Assuming sex only on other forced dates
            libido: 5,
            masturbated: false,
            usedTadala: false,
            didClimax: !isAugust10,
            periodStarts: isMay18 || isJune18 || isAugust10,
            medsStarts: isMay18 || isJune18 || isAugust10, // common practice to start Selene on Day 1
            periodEnds: isApril23 || isMay22,
            timestamp: new Date(d + 'T12:00:00').getTime(),
            periodEnded: isApril23 || isMay22
          });
          modified = true;
        } else if (d === '2026-06-07' || d === '2026-06-21' || d === '2026-06-26' || d === '2026-07-04' || d === '2026-07-05' || d === '2026-07-18' || d === '2026-07-19' || d === '2026-07-24' || d === '2026-07-26' || d === '2026-07-30' || d === '2026-08-04' || d === '2026-08-07' || d === '2026-08-08' || d === '2026-08-09' || d === '2026-08-23' || d === '2026-08-24') {
          // Force hadSex to true specifically
          loadedRecords[existingIdx].hadSex = true;
          loadedRecords[existingIdx].libido = 5;
          loadedRecords[existingIdx].didClimax = true;
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
          { id: 'h21', date: '2026-06-26', hadSex: true, libido: 5, masturbated: false, usedTadala: false, didClimax: true, timestamp: Date.parse('2026-06-26T12:00:00'), periodEnded: false },
          { id: 'h22', date: '2026-07-04', hadSex: true, libido: 5, masturbated: false, usedTadala: false, didClimax: true, timestamp: Date.parse('2026-07-04T12:00:00'), periodEnded: false },
          { id: 'h23', date: '2026-07-05', hadSex: true, libido: 5, masturbated: false, usedTadala: false, didClimax: true, timestamp: Date.parse('2026-07-05T12:00:00'), periodEnded: false },
          { id: 'h24', date: '2026-07-18', hadSex: true, libido: 5, masturbated: false, usedTadala: false, didClimax: true, timestamp: Date.parse('2026-07-18T12:00:00'), periodEnded: false },
          { id: 'h25', date: '2026-07-19', hadSex: true, libido: 5, masturbated: false, usedTadala: false, didClimax: true, timestamp: Date.parse('2026-07-19T12:00:00'), periodEnded: false },
          { id: 'h26', date: '2026-07-24', hadSex: true, libido: 5, masturbated: false, usedTadala: false, didClimax: true, timestamp: Date.parse('2026-07-24T12:00:00'), periodEnded: false },
          { id: 'h27', date: '2026-07-26', hadSex: true, libido: 5, masturbated: false, usedTadala: false, didClimax: true, timestamp: Date.parse('2026-07-26T12:00:00'), periodEnded: false },
          { id: 'h28', date: '2026-07-30', hadSex: true, libido: 5, masturbated: false, usedTadala: false, didClimax: true, timestamp: Date.parse('2026-07-30T12:00:00'), periodEnded: false },
          { id: 'h29', date: '2026-08-04', hadSex: true, libido: 5, masturbated: false, usedTadala: false, didClimax: true, timestamp: Date.parse('2026-08-04T12:00:00'), periodEnded: false },
          { id: 'h30', date: '2026-08-07', hadSex: true, libido: 5, masturbated: false, usedTadala: false, didClimax: true, timestamp: Date.parse('2026-08-07T12:00:00'), periodEnded: false },
          { id: 'h31', date: '2026-08-08', hadSex: true, libido: 5, masturbated: false, usedTadala: false, didClimax: true, timestamp: Date.parse('2026-08-08T12:00:00'), periodEnded: false },
          { id: 'h32', date: '2026-08-09', hadSex: true, libido: 5, masturbated: false, usedTadala: false, didClimax: true, timestamp: Date.parse('2026-08-09T12:00:00'), periodEnded: false },
          { id: 'h33', date: '2026-08-10', hadSex: false, libido: 3, masturbated: false, usedTadala: false, didClimax: false, periodStarts: true, medsStarts: true, timestamp: Date.parse('2026-08-10T12:00:00'), periodEnded: false },
          { id: 'h34', date: '2026-08-23', hadSex: true, libido: 5, masturbated: false, usedTadala: false, didClimax: true, timestamp: Date.parse('2026-08-23T12:00:00'), periodEnded: false },
          { id: 'h35', date: '2026-08-24', hadSex: true, libido: 5, masturbated: false, usedTadala: false, didClimax: true, timestamp: Date.parse('2026-08-24T12:00:00'), periodEnded: false },
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
      '2026-05-31', '2026-06-05', '2026-06-07', '2026-06-18', '2026-06-21', '2026-06-26',
      '2026-07-04', '2026-07-05', '2026-07-18', '2026-07-19', '2026-07-24', '2026-07-26', '2026-07-30',
      '2026-08-04', '2026-08-07', '2026-08-08', '2026-08-09', '2026-08-10', '2026-08-23', '2026-08-24'
    ];
    
    forcedHistory.forEach(async (d) => {
      // Clean up duplicates if needed
      if (d === '2026-06-07' || d === '2026-06-21' || d === '2026-06-26' || d === '2026-07-04' || d === '2026-07-05' || d === '2026-07-18' || d === '2026-07-19' || d === '2026-07-24' || d === '2026-07-26' || d === '2026-07-30' || d === '2026-08-04' || d === '2026-08-07' || d === '2026-08-08' || d === '2026-08-09' || d === '2026-08-10' || d === '2026-08-23' || d === '2026-08-24') {
         const existing = records.filter(r => r.date === d);
         for (const ex of existing) {
           if (ex.id !== 'forced-' + d) {
             await deleteDoc(doc(db, 'users', currentUser.uid, 'records', ex.id));
           }
         }
      }
      const exists = records.some(r => r.date === d && r.id === 'forced-' + d);
      if (!exists || d === '2026-06-07' || d === '2026-06-21' || d === '2026-06-26' || d === '2026-06-18' || d === '2026-07-04' || d === '2026-07-05' || d === '2026-07-18' || d === '2026-07-19' || d === '2026-07-24' || d === '2026-07-26' || d === '2026-07-30' || d === '2026-08-04' || d === '2026-08-07' || d === '2026-08-08' || d === '2026-08-09' || d === '2026-08-10' || d === '2026-08-23' || d === '2026-08-24') {
        const id = 'forced-' + d;
        const isApril23 = d === '2026-04-23';
        const isMay18 = d === '2026-05-18';
        const isMay22 = d === '2026-05-22';
        const isJune18 = d === '2026-06-18';
        const isAugust10 = d === '2026-08-10';

        await setDoc(doc(db, 'users', currentUser.uid, 'records', id), {
          id,
          date: d,
          hadSex: !isMay18 && !isMay22 && !isJune18 && !isAugust10,
          libido: 5, // Peak performance
          masturbated: false,
          usedTadala: false,
          didClimax: !isAugust10,
          periodStarts: isMay18 || isJune18 || isAugust10,
          medsStarts: isMay18 || isJune18 || isAugust10,
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

  // Background Auto-Fix for historical dates (One-time repair when records load)
  useEffect(() => {
    if (currentUser && records.length > 0) {
      const fixDates = ['2026-06-07', '2026-06-18', '2026-06-21', '2026-06-26', '2026-07-04', '2026-07-05', '2026-07-18', '2026-07-19', '2026-07-24', '2026-07-26', '2026-07-30', '2026-08-04', '2026-08-07', '2026-08-08', '2026-08-09', '2026-08-10', '2026-08-23', '2026-08-24'];
      fixDates.forEach(fixDate => {
        const specificRecords = records.filter(r => r.date === fixDate);
        const isJune18 = fixDate === '2026-06-18';
        const isAugust10 = fixDate === '2026-08-10';
        
        // If missing completely, add it
        if (specificRecords.length === 0) {
          setDoc(doc(db, 'users', currentUser.uid, 'records', 'forced-' + fixDate), {
            id: 'forced-' + fixDate,
            date: fixDate,
            hadSex: !isJune18 && !isAugust10,
            libido: 5,
            masturbated: false,
            usedTadala: false,
            didClimax: !isJune18 && !isAugust10,
            periodStarts: isJune18 || isAugust10,
            medsStarts: isJune18 || isAugust10,
            periodEnds: false,
            timestamp: new Date(fixDate + 'T12:00:00').getTime(),
            periodEnded: false
          }, { merge: true });
        } else {
          // If it exists but has wrong flags, forceful correction!
          specificRecords.forEach(r => {
            if (isJune18 || isAugust10) {
              if (!r.periodStarts || !r.medsStarts) {
                setDoc(doc(db, 'users', currentUser.uid, 'records', r.id), {
                  periodStarts: true,
                  medsStarts: true
                }, { merge: true });
              }
            } else {
              if (!r.hadSex) {
                setDoc(doc(db, 'users', currentUser.uid, 'records', r.id), {
                  hadSex: true,
                  didClimax: true,
                  libido: Math.max(r.libido || 5, 5)
                }, { merge: true });
              }
            }
          });
        }
      });
    }
  }, [currentUser, records.length]);

  const handleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const currentLocalRecords = [...records];
      const result = await signInWithPopup(auth, provider);
      const newGoogleUser = result.user;
      
      // Transfer/Sync any records to the new Google user account
      if (newGoogleUser && currentLocalRecords.length > 0) {
        for (const rec of currentLocalRecords) {
          await setDoc(doc(db, 'users', newGoogleUser.uid, 'records', rec.id), rec, { merge: true });
        }
      }
    } catch (e: any) {
      console.error("Login com Google falhou:", e);
      alert("Não foi possível realizar o login com Google: " + (e.message || "Tente novamente"));
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

    const startDate = lastPeriodStart ? new Date(lastPeriodStart.date + 'T12:00:00') : new Date('2026-08-10T12:00:00'); // Fallback to provided date
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
    <div className="min-h-screen bg-slate-50/50 font-sans text-slate-900 selection:bg-rose-100 selection:text-rose-900 flex flex-col relative overflow-x-hidden pb-12">
      {/* Top Accent Gradient Background Fading down into slate-50 */}
      <div id="top-header-gradient" className="w-full bg-gradient-to-b from-slate-950 via-slate-900 via-rose-950/20 to-transparent pb-8 pt-4 px-3 sm:px-6 transition-all duration-500 relative">
        <div id="ambient-glow-header" className="absolute top-0 right-1/4 w-[500px] h-32 bg-rose-600/15 rounded-full blur-[90px] pointer-events-none -z-10" />

        {/* HEADER */}
        <header id="app-header" className="max-w-7xl mx-auto z-30 bg-slate-900/85 backdrop-blur-xl px-5 sm:px-7 py-3.5 flex flex-wrap sm:flex-nowrap justify-between items-center border border-slate-800/80 shadow-[0_20px_50px_rgba(0,0,0,0.35)] rounded-[28px] transition-all duration-300 print:hidden text-white gap-3">
          <div className="flex items-center gap-3">
             <HeaderLogo />
             {saveStatus === 'saved' && (
               <span id="save-badge" className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-emerald-500/40 animate-in fade-in zoom-in duration-300 shadow-sm backdrop-blur-sm">
                 <Check size={10} strokeWidth={3} /> SALVO
               </span>
             )}
          </div>
          <div className="flex items-center gap-2.5 sm:gap-3">
            <button 
              id="print-btn"
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 hover:text-white hover:border-slate-600 hover:shadow-lg transition-all font-black text-[10px] uppercase tracking-wider shadow-sm active:scale-95 print:hidden"
            >
               <Activity size={14} className="text-rose-400 animate-pulse" />
               PDF / Imprimir
            </button>
            <div id="sync-status" className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 print:hidden shadow-sm backdrop-blur-sm">
               <span className="relative flex h-2 w-2">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
               </span>
               <Cloud size={14} className="text-emerald-400" />
               <span className="text-[10px] font-black uppercase tracking-wider hidden sm:inline-block">Nuvem Firebase Ao Vivo</span>
            </div>

            {currentUser && !currentUser.isAnonymous ? (
              <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700/80 px-3 py-1.5 rounded-2xl">
                {currentUser.photoURL ? (
                  <img src={currentUser.photoURL} alt="User" className="w-6 h-6 rounded-full border border-rose-500/40" />
                ) : (
                  <UserIcon size={14} className="text-rose-400" />
                )}
                <span className="text-[10px] font-bold text-slate-200 max-w-[100px] truncate hidden md:inline-block">{currentUser.displayName || currentUser.email}</span>
                <button onClick={handleSignOut} title="Sair da Conta" className="p-1 hover:text-rose-400 transition-colors text-slate-400">
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleSignIn}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-[10px] uppercase tracking-wider shadow-lg shadow-rose-900/40 border border-rose-400/30 transition-all active:scale-95"
              >
                <LogIn size={14} />
                <span className="hidden xs:inline-block">Entrar Google (Multi-Aparelhos)</span>
                <span className="xs:hidden">Google</span>
              </button>
            )}
          </div>
        </header>
      </div>

      <main className="max-w-7xl mx-auto p-4 lg:p-10 pt-8 flex-1 w-full">
        {authLoading ? (
          <div className="max-w-md mx-auto flex flex-col items-center justify-center py-24 animate-pulse">
            <div className="w-16 h-16 bg-brand-100 rounded-[28px] flex items-center justify-center mb-4">
              <Zap size={32} className="text-brand-600 animate-bounce" />
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Carregando dados...</p>
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

  // Calculate dynamic relationship details for "Contato Recente" card
  const lastRelation = sexHistory[0];
  const lastRelationDateText = lastRelation 
    ? new Date(lastRelation.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', weekday: 'long' })
    : '19 de Julho (domingo)';

  // --- Seasons Analysis (Hemisfério Sul) ---
  const getSeasonInfo = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return { id: 'outono', name: 'Outono' };
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    const md = m * 100 + d;

    if (md >= 1221 || md <= 320) {
      return { id: 'verao', name: 'Verão' };
    } else if (md >= 321 && md <= 620) {
      return { id: 'outono', name: 'Outono' };
    } else if (md >= 621 && md <= 920) {
      return { id: 'inverno', name: 'Inverno' };
    } else {
      return { id: 'primavera', name: 'Primavera' };
    }
  };

  const seasonsData = [
    { id: 'outono', name: 'Outono', period: '21 Mar - 20 Jun', tempType: 'Clima Ameno / Suave', bg: 'from-orange-50/90 via-amber-50/50 to-orange-100/20', border: 'border-orange-200/80', textAccent: 'text-orange-600', iconBg: 'bg-orange-100 text-orange-600 border border-orange-200', count: 0, libidoSum: 0 },
    { id: 'inverno', name: 'Inverno', period: '21 Jun - 20 Set', tempType: 'Clima Frio / Edredom', bg: 'from-blue-50/90 via-sky-50/50 to-indigo-100/20', border: 'border-blue-200/80', textAccent: 'text-blue-600', iconBg: 'bg-blue-100 text-blue-600 border border-blue-200', count: 0, libidoSum: 0 },
    { id: 'primavera', name: 'Primavera', period: '21 Set - 20 Dez', tempType: 'Clima Ameno / Florido', bg: 'from-emerald-50/90 via-teal-50/50 to-emerald-100/20', border: 'border-emerald-200/80', textAccent: 'text-emerald-600', iconBg: 'bg-emerald-100 text-emerald-600 border border-emerald-200', count: 0, libidoSum: 0 },
    { id: 'verao', name: 'Verão', period: '21 Dez - 20 Mar', tempType: 'Clima Quente / Abafado', bg: 'from-rose-50/90 via-red-50/50 to-rose-100/20', border: 'border-rose-200/80', textAccent: 'text-rose-600', iconBg: 'bg-rose-100 text-rose-600 border border-rose-200', count: 0, libidoSum: 0 },
  ];

  records.forEach((r: any) => {
    if (r.hadSex) {
      const s = getSeasonInfo(r.date);
      const target = seasonsData.find(item => item.id === s.id);
      if (target) {
        target.count += 1;
        target.libidoSum += (r.libido || 3);
      }
    }
  });

  const totalSexRecords = seasonsData.reduce((acc, curr) => acc + curr.count, 0);

  const sortedSeasons = [...seasonsData].sort((a, b) => b.count - a.count);
  const mostActiveSeason = sortedSeasons[0];
  const leastActiveSeason = sortedSeasons[sortedSeasons.length - 1];

  const mildColdCount = (seasonsData.find(s => s.id === 'outono')?.count || 0) + (seasonsData.find(s => s.id === 'inverno')?.count || 0) + (seasonsData.find(s => s.id === 'primavera')?.count || 0);
  const hotCount = seasonsData.find(s => s.id === 'verao')?.count || 0;
  const mildColdPct = totalSexRecords > 0 ? Math.round((mildColdCount / totalSexRecords) * 100) : 0;
  const hotPct = totalSexRecords > 0 ? Math.round((hotCount / totalSexRecords) * 100) : 0;

  // --- 30 Days Evolution Chart Data (Financial Style) ---
  let runningTotal = 0;
  const last30DaysData = Array.from({ length: 30 }, (_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - idx));
    const yearStr = d.getFullYear();
    const monthStr = String(d.getMonth() + 1).padStart(2, '0');
    const dayStr = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yearStr}-${monthStr}-${dayStr}`;
    const dayLabel = `${dayStr}/${monthStr}`;

    const rec = records.find((r: any) => r.date === dateStr);
    const hadSex = rec && rec.hadSex ? true : false;
    if (hadSex) runningTotal += 1;

    return {
      date: dateStr,
      dayLabel,
      dayIndex: idx + 1,
      libido: rec ? rec.libido : null,
      transa: hadSex ? 1 : 0,
      hadSex,
      didClimax: rec ? rec.didClimax : undefined,
      usedTadala: rec ? rec.usedTadala : false,
      hasRecord: !!rec,
      acumulado: runningTotal,
    };
  });

  const sexCountLast30Days = last30DaysData.filter(d => d.hadSex).length;
  const climaxCount30Days = last30DaysData.filter(d => d.hadSex && d.didClimax === true).length;
  const climaxRate30 = sexCountLast30Days > 0 ? Math.round((climaxCount30Days / sexCountLast30Days) * 100) : 100;
  const activityRate30 = ((sexCountLast30Days / 30) * 100).toFixed(0);

  // Financial Trend Calculation (First 15 Days vs Last 15 Days)
  const first15Count = last30DaysData.slice(0, 15).filter(d => d.hadSex).length;
  const last15Count = last30DaysData.slice(15, 30).filter(d => d.hadSex).length;
  const trendDiff = last15Count - first15Count;
  const trendPct = first15Count > 0 
    ? Math.round(((last15Count - first15Count) / first15Count) * 100)
    : last15Count > 0 ? 100 : 0;

  // Overall Climax stats
  const totalClimaxRecords = records.filter((r: any) => r.hadSex && r.didClimax === true).length;
  const overallClimaxRate = totalSexRecords > 0 ? Math.round((totalClimaxRecords / totalSexRecords) * 100) : 100;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700 items-start print:block">
      
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
              <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Taxa de Finalização</span>
              <span className="text-3xl font-black text-emerald-600">{overallClimaxRate}%</span>
           </div>
        </div>
      </div>

      {/* Sidebar: Performance & Cycle - Hidden in print or adjusted */}
      <div className="lg:col-span-4 space-y-6 lg:space-y-8 print:hidden">
        {/* PREMIUM STATS CARD */}
        <section id="perf-annual-card" className="relative overflow-hidden bg-slate-950 rounded-[32px] p-8 text-white shadow-xl shadow-slate-950/10 border border-slate-900/60 transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl">
           <div className="absolute -top-24 -right-24 w-64 h-64 bg-rose-500 rounded-full blur-3xl opacity-15 animate-pulse"></div>
           <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-brand-900 rounded-full blur-3xl opacity-20"></div>
           
           <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-white/10 backdrop-blur-md rounded-xl">
                       <Zap size={16} className="text-rose-400" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Performance Anual</span>
                  </div>
                  <div className="bg-white/5 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10 flex items-center shrink-0">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-300 italic whitespace-nowrap">
                      Dia {daysPassed} de {totalDaysInYear}
                    </span>
                  </div>
              </div>

              <div className="flex items-baseline gap-2 mb-2 overflow-visible">
                 <h2 className="text-8xl font-black font-display tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400 italic leading-none pr-4 py-1.5 inline-block">{uniqueDaysWithSex}</h2>
                 <span className="text-lg font-bold text-slate-400 italic">dias transando</span>
              </div>

              <div className="mb-8">
                 <p className="text-xs font-semibold text-slate-400 mb-3.5">
                   Relação de aproveitamento: <span className="text-white font-black">{sexPercentage}%</span> dos dias em {year}.
                 </p>
                 <div className="w-full bg-slate-900 rounded-full h-3 p-0.5 border border-slate-800">
                    <div className="bg-gradient-to-r from-rose-500 to-rose-400 h-full rounded-full shadow-[0_0_12px_rgba(244,63,94,0.4)] transition-all duration-1000" style={{ width: `${Math.min(Number(sexPercentage), 100)}%` }}></div>
                 </div>
                 
                 {/* DYNAMIC CONTACT CARD */}
                 <div id="contact-info-card" className="mt-6 p-4 bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-800/80 flex items-center gap-4 transition-all hover:bg-slate-900/60 group">
                    <div className="w-11 h-11 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shadow-inner relative shrink-0">
                       <span className="text-xl group-hover:scale-110 transition-transform duration-300 cursor-default">👄</span>
                       <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950 animate-pulse"></span>
                    </div>
                    <div className="flex-1 min-w-0">
                       <span className="text-[9px] font-black uppercase text-rose-400/80 tracking-widest block mb-0.5">Contato Recente</span>
                       <h4 className="text-sm font-black text-white truncate font-display italic">Marcelly</h4>
                       <p className="text-[10px] font-medium text-slate-400 truncate mt-0.5">
                         Última: {lastRelationDateText}
                       </p>
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-800/80">
                 <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Taxa de Clímax</span>
                    <div className="flex items-center gap-2">
                       <CheckCircle2 size={14} className="text-emerald-400" />
                       <span className="text-lg font-black font-display tracking-tight italic text-emerald-300">{overallClimaxRate}%</span>
                    </div>
                 </div>
                 <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Prev. Menstruação</span>
                    <div className="flex items-center gap-2">
                       <CalendarHeart size={14} className="text-rose-400" />
                       <span className="text-lg font-black font-display tracking-tight italic text-slate-100">
                         {partnerInfo?.nextPeriodDate ? partnerInfo.nextPeriodDate.toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'}) : '--'}
                       </span>
                    </div>
                 </div>
              </div>
           </div>
        </section>

        {/* Ciclo de Marcelly Dashboard */}
        {partnerInfo && (
          <section id="marcelly-cycle-card" className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-[0_12px_40px_rgba(0,0,0,0.015)] relative overflow-hidden transition-all duration-300 hover:shadow-md hover:scale-[1.01]">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-200/10 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-2 font-display">
                  <CalendarHeart size={14} className="text-brand-500 animate-pulse" />
                  Ciclo de Marcelly
                </h3>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl font-black text-slate-900 font-display italic">Dia {partnerInfo.cycleDay}</span>
                  <span className="text-xs font-bold text-slate-400 italic">do ciclo</span>
                </div>
              </div>
              <div className={`px-3.5 py-2 rounded-2xl flex items-center gap-2 font-black text-[10px] uppercase tracking-wider ${partnerInfo.phaseColor} bg-slate-50 border border-slate-100/60 shadow-sm animate-pulse`}>
                {partnerInfo.phaseIcon}
                {partnerInfo.phase}
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50/50 p-4 rounded-3xl border border-slate-100">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Medicação Selene (Blister)</span>
                {partnerInfo.isBreak ? (
                  <div className="flex items-center gap-2 text-rose-600 font-black text-sm">
                    <Ban size={16} />
                    <span>Pausa ({partnerInfo.pillDay}/7 dias)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-brand-600 font-black text-sm">
                    <Pill size={16} />
                    <span>Comprimido {partnerInfo.pillDay}/21</span>
                  </div>
                )}
                
                {/* Visual Blister Pill Matrix */}
                <div className="flex flex-wrap gap-1 mt-3.5 justify-center bg-white p-2.5 rounded-2xl border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
                   {Array.from({ length: 21 }).map((_, index) => {
                      const pillIndex = index + 1;
                      const isTaken = !partnerInfo.isBreak && (partnerInfo.pillDay || 0) >= pillIndex;
                      const isCurrent = !partnerInfo.isBreak && (partnerInfo.pillDay || 0) === pillIndex;
                      return (
                        <div 
                          key={index} 
                          className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all ${
                            isTaken 
                              ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/20' 
                              : isCurrent 
                              ? 'bg-white border-2 border-rose-500 ring-2 ring-rose-200 animate-pulse' 
                              : 'bg-slate-200 border border-slate-300/30'
                          }`}
                          title={`Dia ${pillIndex}`}
                        />
                      );
                   })}
                </div>
                
                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
                  <div 
                    className="bg-brand-500 h-full transition-all duration-1000 shadow-[0_0_8px_rgba(239,68,68,0.4)]" 
                    style={{ width: `${partnerInfo.isBreak ? ((partnerInfo.pillDay || 0) / 7) * 100 : ((partnerInfo.pillDay || 0) / 21) * 100}%` }}
                  ></div>
                </div>
              </div>

              <div className="bg-slate-50/50 p-4 rounded-3xl border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Previsão Fluxo</span>
                  <span className="text-xs font-black text-slate-800">{partnerInfo.nextPeriodDate ? partnerInfo.nextPeriodDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '--'}</span>
                </div>
                <div className="p-2.5 bg-rose-50 rounded-2xl border border-rose-100">
                  <Droplets size={16} className="text-brand-500 animate-bounce" />
                </div>
              </div>
            </div>

            {/* Step Indicators */}
            <div className="mt-6 pt-5 border-t border-slate-100 flex justify-between gap-1.5">
              {[
                { label: 'Menstrual' },
                { label: 'Folicular' },
                { label: 'Ovulatória' },
                { label: 'Lútea' }
              ].map((p, i) => {
                const isActive = partnerInfo.phase === p.label;
                return (
                  <div key={p.label} className="flex-1 flex flex-col items-center gap-2">
                    <div className={`h-1.5 w-full rounded-full transition-all duration-500 ${isActive ? 'bg-brand-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]' : 'bg-slate-100'}`}></div>
                    <span className={`text-[10px] font-black uppercase tracking-tighter text-center leading-none ${isActive ? 'text-brand-600' : 'text-slate-300'}`}>{p.label}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* MAIN CONTENT: Calendar, Chart & History */}
      <div className="lg:col-span-8 space-y-6 lg:space-y-8">
        {/* CALENDAR SECTION */}
        <section id="calendar-card" className="bg-white rounded-[32px] p-6 md:p-8 border border-slate-100 shadow-[0_12px_40px_rgba(0,0,0,0.015)] relative">
           <div className="flex items-center justify-between mb-8">
              <button onClick={prevMonth} className="w-11 h-11 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:text-brand-600 hover:bg-brand-50 border border-slate-100/50 hover:shadow-md transition-all active:scale-90">
                <ChevronLeft size={20} strokeWidth={3} />
              </button>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-[0.25em] font-display italic">
                {currentMonthName} de {year}
              </h3>
              <button onClick={nextMonth} className="w-11 h-11 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:text-brand-600 hover:bg-brand-50 border border-slate-100/50 hover:shadow-md transition-all active:scale-90">
                <ChevronRight size={20} strokeWidth={3} />
              </button>
           </div>
           
           <div className="grid grid-cols-7 mb-4 text-center">
             {['D','S','T','Q','Q','S','S'].map((d, index) => (
                <div key={`weekday-${index}`} className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-display">{d}</div>
             ))}
           </div>
           
           <div className="grid grid-cols-7 gap-y-3.5 gap-x-2">
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
                    cycleStyles = 'border-2 border-blue-400 bg-blue-50/50 text-blue-900 shadow-[0_2px_10px_rgba(59,130,246,0.05)]';
                  } else if (cycle.isPillEnd) {
                    cycleStyles = 'border-2 border-amber-400 border-dashed bg-amber-50/40 text-amber-950';
                  } else if (cycle.isPeriodStart) {
                    cycleStyles = 'border-2 border-orange-400 bg-orange-50/40 text-orange-950 font-semibold';
                  } else if (cycle.isPeakFlow) {
                    cycleStyles = 'border-2 border-red-500 bg-red-50/50 text-red-950 font-bold';
                  } else if (cycle.isPeriodEnd) {
                    cycleStyles = 'border-2 border-green-400 bg-green-50/40 text-green-950 font-semibold';
                  } else if (cycle.isFertileWindow) {
                    cycleStyles = 'border-2 border-teal-400 bg-teal-50/40 text-teal-950 font-bold';
                  }
                }

                // Collect list of microdots for this specific calendar cell
                const indicators = [];
                if (cycle.isPillStart) {
                  indicators.push(<span key="i-pstart" className="w-1.5 h-1.5 rounded-full bg-blue-500 block shrink-0 animate-pulse" title="Volta a Tomar o Remédio" />);
                }
                if (cycle.isPillEnd) {
                  indicators.push(<span key="i-pend" className="w-1.5 h-1.5 rounded-full bg-amber-400 block shrink-0" title="Último Comprimido da Cartela" />);
                }
                if (cycle.isPeriodStart) {
                  indicators.push(<span key="i-mstart" className="w-1.5 h-1.5 rounded-full bg-orange-500 block shrink-0" title="Início da Menstruação (Previsão)" />);
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
                    ? 'bg-gradient-to-br from-brand-600 to-rose-700 text-white shadow-xl shadow-brand-600/25 ring-2 ring-brand-400 border border-brand-500 font-bold'
                    : rec?.masturbated
                    ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md font-bold'
                    : 'bg-white border-2 border-slate-150 text-slate-400';
                } else if (isToday) {
                  baseStyle = 'bg-slate-900 text-white shadow-xl ring-4 ring-slate-100 ring-offset-2 border border-slate-950 font-extrabold';
                } else {
                  baseStyle = cycleStyles || 'bg-slate-50 text-slate-500 hover:bg-rose-50/50 hover:text-brand-600 hover:border-brand-100 border border-transparent';
                }

                return (
                  <div 
                    key={day} 
                    onClick={() => handleOpenCheckin(dStr)} 
                    className={`aspect-square flex flex-col items-center justify-between p-1.5 rounded-[20px] relative transition-all duration-300 cursor-pointer hover:scale-105 hover:shadow-md active:scale-95 group ${baseStyle}`}
                  >
                     {/* Row for indicators / top markers */}
                     <div className="w-full flex justify-end h-3 pr-0.5 mt-0.5">
                       {rec?.hadSex && (
                         <div className="bg-white p-0.5 rounded-full text-brand-600 shadow-sm border border-brand-100 group-hover:scale-110 transition-transform">
                           <Flame size={10} fill="currentColor" />
                         </div>
                       )}
                       {!rec?.hadSex && rec?.masturbated && (
                         <div className="bg-white p-0.5 rounded-full text-orange-500 shadow-sm border border-orange-100 group-hover:scale-110 transition-transform">
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
                     <span className={`text-xs font-black font-display leading-none -mt-1 ${rec?.hadSex || isToday ? 'text-white' : 'text-slate-800'}`}>
                       {day}
                     </span>

                     {/* The Row of Cycle Microdots at the bottom of the cell */}
                     <div className="w-full flex justify-center gap-0.5 min-h-[6px] mb-0.5">
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
              <div className="flex items-center gap-2 mb-5">
                <CalendarHeart size={16} className="text-brand-500" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 font-display">Legendas e Previsões do Ciclo</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                
                <div className="p-3 rounded-2xl bg-blue-50/40 border border-blue-100 flex items-start gap-2.5">
                  <div className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-blue-500 mt-1 shadow-[0_0_5px_rgba(59,130,246,0.5)] animate-pulse"></div>
                  <div>
                    <h5 className="text-[10px] font-black text-blue-950 uppercase tracking-wide">Volta a Tomar o Remédio</h5>
                    <p className="text-[9px] font-semibold text-slate-400 leading-normal mt-0.5">Dia 1 do ciclo Selene. Início do novo blister.</p>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-teal-50/40 border border-teal-100 flex items-start gap-2.5">
                  <div className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-teal-400 mt-1 shadow-[0_0_5px_rgba(45,212,191,0.5)] animate-pulse"></div>
                  <div>
                    <h5 className="text-[10px] font-black text-teal-950 uppercase tracking-wide">Período Fértil / Libido ⬆</h5>
                    <p className="text-[9px] font-semibold text-slate-400 leading-normal mt-0.5">Dias 11 a 16. Janela fértil e pico previsível de libido.</p>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-amber-50/40 border border-amber-100 flex items-start gap-2.5">
                  <div className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-amber-400 mt-1 shadow-[0_0_5px_rgba(251,191,36,0.5)]"></div>
                  <div>
                    <h5 className="text-[10px] font-black text-amber-950 uppercase tracking-wide">Deixa de Tomar / Fim</h5>
                    <p className="text-[9px] font-semibold text-slate-400 leading-normal mt-0.5">Dia 21 de pílula. Início da pausa de 7 dias.</p>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-orange-50/40 border border-orange-100 flex items-start gap-2.5">
                  <div className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-orange-500 mt-1 shadow-[0_0_5px_rgba(249,115,22,0.5)]"></div>
                  <div>
                    <h5 className="text-[10px] font-black text-orange-950 uppercase tracking-wide">Início da Menstruação</h5>
                    <p className="text-[9px] font-semibold text-slate-400 leading-normal mt-0.5">Dias 23-24 (Pausa dia 2-3). Início previsível de sangramento.</p>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-red-50/40 border border-red-100 flex items-start gap-2.5">
                  <div className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-red-600 mt-1 shadow-[0_0_5px_rgba(220,38,38,0.5)] animate-pulse"></div>
                  <div>
                    <h5 className="text-[10px] font-black text-red-950 uppercase tracking-wide">Maior Fluxo (Pico)</h5>
                    <p className="text-[9px] font-semibold text-slate-400 leading-normal mt-0.5">Dias 25-26. Intensidade menstrual máxima prevista.</p>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-green-50/40 border border-green-100 flex items-start gap-2.5">
                  <div className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-green-500 mt-1 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></div>
                  <div>
                    <h5 className="text-[10px] font-black text-green-950 uppercase tracking-wide">Fim da Menstruação</h5>
                    <p className="text-[9px] font-semibold text-slate-400 leading-normal mt-0.5">Dia 28 da pausa. Fim do período menstrual.</p>
                  </div>
                </div>

              </div>
           </div>
        </section>

        {/* CHART SECTION: EVOLUÇÃO DOS ÚLTIMOS 30 DIAS (ESTILO MERCADO FINANCEIRO) */}
        <section id="activity-30days-card" className="bg-slate-950 rounded-[32px] p-6 sm:p-8 border border-slate-800 shadow-2xl overflow-hidden text-white font-sans relative space-y-6">
           {/* Ambient Terminal Reflection */}
           <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
           <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

           {/* Financial Terminal Header */}
           <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800/80 relative z-10">
              <div className="space-y-2">
                 <div className="flex items-center gap-2.5">
                    <div className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                       <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                       </span>
                       MERCADO ATIVO • INDEX-30D
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-widest">
                       TICKER: $CONEXAO
                    </span>
                 </div>

                 <div className="flex items-baseline gap-4 pt-1">
                    <h3 className="text-3xl sm:text-4xl font-black font-display italic tracking-tight text-white">
                       {sexCountLast30Days} <span className="text-sm font-sans uppercase not-italic tracking-wider text-slate-400 font-bold">eventos / 30d</span>
                    </h3>
                    <div className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border ${
                       trendDiff > 0 
                         ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                         : trendDiff < 0 
                         ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' 
                         : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}>
                       {trendDiff > 0 ? <TrendingUp size={14} /> : trendDiff < 0 ? <TrendingDown size={14} /> : <Activity size={14} />}
                       <span>{trendDiff > 0 ? `+${trendPct}% TENDÊNCIA BULLISH` : trendDiff < 0 ? `${trendPct}% CONSOLIDAÇÃO` : '0% ESTÁVEL'}</span>
                    </div>
                 </div>
              </div>

              {/* Terminal HUD Metrics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                 <div className="p-3 bg-slate-900/80 rounded-2xl border border-slate-800 backdrop-blur-sm">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                       TAXA DE CLÍMAX
                    </span>
                    <div className="flex items-center gap-1.5 text-emerald-400 font-black font-mono text-base">
                       <CheckCircle2 size={14} />
                       <span>{climaxRate30}%</span>
                    </div>
                 </div>

                 <div className="p-3 bg-slate-900/80 rounded-2xl border border-slate-800 backdrop-blur-sm">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                       FREQUÊNCIA
                    </span>
                    <div className="flex items-center gap-1.5 text-amber-400 font-black font-mono text-base">
                       <Sparkles size={14} />
                       <span>{activityRate30}% <span className="text-[9px] text-slate-500 font-normal">dias</span></span>
                    </div>
                 </div>

                 <div className="p-3 bg-slate-900/80 rounded-2xl border border-slate-800 backdrop-blur-sm col-span-2 sm:col-span-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                       VOLUME TOTAL
                    </span>
                    <div className="flex items-center gap-1.5 text-rose-400 font-black font-mono text-base">
                       <Flame size={14} />
                       <span>{sexCountLast30Days} <span className="text-[9px] text-slate-500 font-normal">transas</span></span>
                    </div>
                 </div>
              </div>
           </div>

           {/* Chart Area */}
           <div className="h-72 w-full pt-2 -ml-3 sm:ml-0 relative z-10">
             <ResponsiveContainer width="100%" height="100%">
               <ComposedChart data={last30DaysData} margin={{ top: 15, right: 15, left: -20, bottom: 5 }}>
                 <defs>
                   <linearGradient id="financialGreen" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                     <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                   </linearGradient>
                   <linearGradient id="volumeBar" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.9} />
                     <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.3} />
                   </linearGradient>
                 </defs>
                 
                 <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                 
                 <XAxis 
                   dataKey="dayLabel" 
                   axisLine={{ stroke: '#334155' }} 
                   tickLine={false} 
                   tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} 
                   dy={10} 
                   interval={2} 
                 />
                 
                 <YAxis 
                   yAxisId="acumulado" 
                   orientation="right" 
                   domain={[0, 'dataMax + 1']} 
                   tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }} 
                   axisLine={false} 
                   tickLine={false} 
                 />
                 <YAxis yAxisId="volume" orientation="left" domain={[0, 1.2]} hide={true} />
                 
                 <Tooltip 
                   cursor={{ stroke: '#3b82f6', strokeWidth: 1.5, strokeDasharray: '4 4' }} 
                   content={({ active, payload }) => {
                     if (active && payload && payload.length) {
                       const data = payload[0].payload;
                       return (
                         <div className="bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-slate-700 font-sans text-xs space-y-2 min-w-[200px] animate-in zoom-in-95 duration-150">
                           <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono">
                               {new Date(data.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} • DIA {data.dayIndex}
                             </span>
                             <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                               data.hadSex ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'
                             }`}>
                               {data.hadSex ? 'SINAL ALTA' : 'REPOUSO'}
                             </span>
                           </div>

                           <div className="space-y-1.5 font-mono">
                             <div className="flex justify-between items-center">
                               <span className="text-slate-400 font-sans text-[11px]">Relação Sexual:</span>
                               <span className={`font-black ${data.hadSex ? 'text-rose-400' : 'text-slate-500'}`}>
                                 {data.hadSex ? '🔥 SIM (1)' : 'NÃO (0)'}
                               </span>
                             </div>

                             {data.hadSex && (
                               <div className="flex justify-between items-center">
                                 <span className="text-slate-400 font-sans text-[11px]">Finalização:</span>
                                 <span className={`font-black ${data.didClimax === true ? 'text-emerald-400' : 'text-amber-400'}`}>
                                   {data.didClimax === true ? '✅ COM CLÍMAX' : '⚠️ SEM CLÍMAX'}
                                 </span>
                               </div>
                             )}

                             <div className="flex justify-between items-center pt-1 border-t border-slate-800/80">
                               <span className="text-slate-400 font-sans text-[11px]">Acumulado (30d):</span>
                               <span className="font-black text-emerald-400 font-display italic">
                                 #{data.acumulado}
                               </span>
                             </div>

                             {data.usedTadala && (
                               <div className="pt-1.5 border-t border-slate-800 flex items-center gap-1.5 text-amber-300 font-bold text-[10px] uppercase tracking-wider font-sans">
                                 <Pill size={12} /> SUPLEMENTO TADALA ATIVO
                               </div>
                             )}
                           </div>
                         </div>
                       );
                     }
                     return null;
                   }} 
                 />

                 <Legend 
                   verticalAlign="top" 
                   align="right" 
                   height={36} 
                   wrapperStyle={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', paddingBottom: '10px' }} 
                 />

                 <Bar 
                   yAxisId="volume" 
                   dataKey="transa" 
                   fill="url(#volumeBar)" 
                   radius={[4, 4, 0, 0]} 
                   name="Volume Diário (Evento)" 
                   barSize={10} 
                 />

                 <Area 
                   yAxisId="acumulado" 
                   type="monotone" 
                   dataKey="acumulado" 
                   stroke="#10b981" 
                   strokeWidth={3.5} 
                   fill="url(#financialGreen)" 
                   name="Índice de Acumulado" 
                   activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }} 
                 />
               </ComposedChart>
             </ResponsiveContainer>
           </div>

           {/* Financial Footer ticker bar */}
           <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-[10px] font-mono text-slate-500 uppercase tracking-widest relative z-10">
              <div className="flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                 <span>LINHA VERDE: CURVA CUMULATIVA DE DESEMPENHO</span>
              </div>
              <div className="flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                 <span>BARRAS VERMELHAS: VOLUME DIÁRIO REGISTRADO</span>
              </div>
           </div>
        </section>

        {/* SEASONAL ANALYSIS SECTION */}
        <section id="seasons-analysis-card" className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-[0_12px_40px_rgba(0,0,0,0.015)] space-y-8 transition-all duration-300 hover:shadow-md">
           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                 <div className="p-2.5 bg-sky-50 rounded-2xl border border-sky-100/60 text-sky-600">
                    <Thermometer size={18} />
                 </div>
                 <div>
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-900 font-display italic">
                       Análise por Estações do Ano
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                       Influência do Clima & Temperatura na Frequência
                    </p>
                 </div>
              </div>
              
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-50 border border-slate-150 self-start sm:self-auto">
                 <Sparkles size={12} className="text-amber-500" />
                 <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                    Hemisfério Sul • Brasil
                 </span>
              </div>
           </div>

           {/* Grid of 4 Season Cards */}
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {seasonsData.map((s) => {
                 const pct = totalSexRecords > 0 ? Math.round((s.count / totalSexRecords) * 100) : 0;
                 const isTop = s.id === mostActiveSeason?.id && s.count > 0;
                 const isBottom = s.id === leastActiveSeason?.id && totalSexRecords > 0 && s.id !== mostActiveSeason?.id;

                 let IconComponent = CloudSun;
                 if (s.id === 'outono') IconComponent = Wind;
                 if (s.id === 'inverno') IconComponent = Snowflake;
                 if (s.id === 'primavera') IconComponent = Sun;
                 if (s.id === 'verao') IconComponent = Flame;

                 return (
                    <div key={s.id} className={`relative p-5 rounded-3xl bg-gradient-to-br ${s.bg} border ${s.border} space-y-4 flex flex-col justify-between transition-all duration-300 hover:scale-[1.02]`}>
                       <div>
                          <div className="flex items-center justify-between mb-3">
                             <div className={`p-2.5 rounded-2xl ${s.iconBg} shadow-sm`}>
                                <IconComponent size={18} />
                             </div>
                             {isTop && (
                                <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-500 text-white px-2.5 py-1 rounded-full shadow-sm animate-pulse">
                                   Mais Ativa 🔥
                                </span>
                             )}
                             {!isTop && isBottom && (
                                <span className="text-[9px] font-black uppercase tracking-wider bg-slate-200 text-slate-600 px-2.5 py-1 rounded-full">
                                   Menor Volume
                                </span>
                             )}
                          </div>

                          <h4 className="text-base font-black text-slate-900 font-display italic">
                             {s.name}
                          </h4>
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">
                             {s.period}
                          </p>
                          <p className="text-[10px] font-bold text-slate-500 mt-1">
                             {s.tempType}
                          </p>
                       </div>

                       <div className="pt-3 border-t border-slate-200/50 space-y-2">
                          <div className="flex items-baseline justify-between">
                             <span className={`text-2xl font-black font-display italic ${s.textAccent}`}>
                                {s.count} <span className="text-xs font-bold text-slate-400 not-italic">transa{s.count !== 1 ? 's' : ''}</span>
                             </span>
                             <span className="text-xs font-black text-slate-700 bg-white/80 backdrop-blur-sm px-2 py-0.5 rounded-lg border border-slate-100">
                                {pct}%
                             </span>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full bg-white/60 h-2 rounded-full overflow-hidden p-0.5 border border-slate-100">
                             <div 
                                className={`h-full rounded-full transition-all duration-1000 ${
                                   s.id === 'inverno' ? 'bg-blue-500' :
                                   s.id === 'outono' ? 'bg-orange-500' :
                                   s.id === 'primavera' ? 'bg-emerald-500' : 'bg-rose-500'
                                }`}
                                style={{ width: `${pct}%` }}
                             />
                          </div>
                       </div>
                    </div>
                 );
              })}
           </div>

           {/* Thermal Impact & Insights Card */}
           <div className="bg-slate-900 rounded-3xl p-6 text-white space-y-4 shadow-xl border border-slate-800 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-rose-500/10 via-blue-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30">
                    <Sparkles size={16} />
                 </div>
                 <h4 className="text-xs font-black uppercase tracking-[0.2em] text-rose-300 font-display italic">
                    Diagnóstico do Impacto Térmico & Clima
                 </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                 <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/60 flex flex-col justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                       Clima Ameno / Suave / Frio
                    </span>
                    <div className="mt-2 flex items-baseline gap-2">
                       <span className="text-2xl font-black text-blue-400 font-display italic">
                          {mildColdCount}
                       </span>
                       <span className="text-xs font-bold text-slate-300">
                          transas ({mildColdPct}%)
                       </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                       Outono + Inverno + Primavera
                    </p>
                 </div>

                 <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/60 flex flex-col justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                       Clima Quente / Abafado
                    </span>
                    <div className="mt-2 flex items-baseline gap-2">
                       <span className="text-2xl font-black text-rose-400 font-display italic">
                          {hotCount}
                       </span>
                       <span className="text-xs font-bold text-slate-300">
                          transa{hotCount !== 1 ? 's' : ''} ({hotPct}%)
                       </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                       Verão (21/Dez a 20/Mar)
                    </p>
                 </div>

                 <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/60 flex flex-col justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                       Estação Campeã de Volume
                    </span>
                    <div className="mt-2 flex items-center gap-2">
                       <span className="text-xl font-black text-white font-display italic">
                          {mostActiveSeason?.name || 'N/A'}
                       </span>
                       <span className="text-xs font-bold text-emerald-400 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                          {mostActiveSeason?.count || 0} relações
                       </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                       {mostActiveSeason?.id === 'verao' ? 'Verão manteve ritmo alto no período.' : 'Temperaturas amenas favoreceram a aproximação e o aconchego.'}
                    </p>
                 </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed pt-2 border-t border-slate-800 italic">
                 💡 <strong className="text-white not-italic">Insight do Clima:</strong> {
                    mildColdPct > hotPct
                       ? `Confirmado com base nos registros: Climas mais frios e amenos (Outono e Inverno) concentram a grande maioria das relações (${mildColdPct}% do total). O calor abafado do Verão tende a diminuir a disposição, enquanto temperaturas mais suaves estimulam o contato físico, o edredom e o aconchego.`
                       : `Distribuição equilibrada nas estações do ano, mostrando constância de apetite sexual independente do calor ou frio.`
                 }
              </p>
           </div>
        </section>

        {/* PERFORMANCE HISTORY SECTION */}
        <section id="perf-history-section" className="space-y-5 print:mt-10">
          <div className="flex justify-between items-end px-2">
            <div className="space-y-1">
               <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] font-display italic">Histórico de Performance</h3>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Apenas dias com relação sexual</p>
            </div>
            <div className="flex items-baseline gap-1">
               <span className="text-2xl font-black text-brand-600 font-display italic">{sexHistory.length}</span>
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">no total</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4 print:grid-cols-1">
             {sexHistory.map((rec: any) => (
                <div key={rec.id} className="bg-white border border-slate-100 rounded-3xl p-5 flex items-center gap-5 transition-all duration-300 hover:border-brand-200 hover:shadow-md hover:shadow-rose-500/5 hover:-translate-y-0.5 group shadow-[0_4px_25px_rgba(0,0,0,0.01)] print:shadow-none print:border-slate-150">
                   <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-md shadow-slate-100 transition-transform group-hover:scale-105 bg-gradient-to-br from-rose-500 to-rose-600 print:shadow-sm">
                      <Flame size={22} fill="currentColor" />
                   </div>
                   <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1 gap-4">
                         <h4 className="text-lg font-black text-slate-900 font-display italic truncate">{new Date(rec.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</h4>
                         <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest shrink-0 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-lg">REGISTRO</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                         {rec.hadSex && rec.didClimax === false && <span className="px-3 py-1 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black flex items-center gap-1 border border-rose-100 italic"><AlertCircle size={10} /> SEM CLÍMAX</span>}
                         {rec.hadSex && rec.didClimax === true && <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black flex items-center gap-1 border border-emerald-100"><Check size={10} strokeWidth={3} /> FINALIZOU</span>}
                         {rec.hadSex && <span className="px-3 py-1 bg-rose-50/50 text-brand-600 rounded-xl text-[10px] font-black flex items-center gap-1 border border-rose-100/40"><Heart size={10} fill="currentColor" /> TRANSA</span>}
                         {rec.usedTadala && <span className="px-3 py-1 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-black flex items-center gap-1 border border-slate-250"><Pill size={10} /> TADALA</span>}
                      </div>
                   </div>
                </div>
             ))}
             {sexHistory.length === 0 && <div className="bg-white border border-slate-100 rounded-3xl py-12 text-center text-slate-400 font-bold text-sm opacity-50 italic">Nenhum registro de transa ainda.</div>}
          </div>
        </section>
      </div>

      <footer className="lg:col-span-12 py-16 text-center space-y-6">
        <div className="flex flex-col items-center">
          <div className="w-12 h-[1.5px] bg-brand-200/50 mb-6"></div>
          <h4 className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-400 mb-2 font-display">CONEXÃO <span className="text-brand-300 mx-2">•</span> GESTÃO DE PERFORMANCE</h4>
          <p className="text-[10px] font-bold text-slate-400">Desenvolvido por André Brito</p>
        </div>
        <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-100/50">
           <Smartphone size={14} className="text-brand-500" strokeWidth={2.5} /><span className="text-xs font-black tracking-widest text-slate-500">21 994 527 694</span>
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