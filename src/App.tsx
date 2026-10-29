import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User } from 'firebase/auth';
import { Header, isAuthorizedAdmin } from './components/Header';
import { VoterPortal } from './components/VoterPortal';
import { LiveDashboard } from './components/LiveDashboard';
import { AdminManager } from './components/AdminManager';
import { PresentationMode } from './components/PresentationMode';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { Candidate, Employee, SheetConfig, VoteAllocation, VoteCategory, VoteRecord } from './types';
import {
  DEFAULT_EMPLOYEES,
  INITIAL_TEAMS,
  fetchEmployeesFromSheet,
  appendVoteRecordToSheet,
} from './services/googleSheets';
import {
  initAuth,
  googleSignIn,
  logout,
  subscribeVotes,
  subscribeEmployees,
  subscribeCandidates,
  subscribeSystemConfig,
  castVoteInFirestore,
  seedEmployeesToFirestore,
  seedCandidatesToFirestore,
  resetVotesInFirestore,
  updateSystemConfigInFirestore,
  testFirestoreConnection,
} from './services/firebase';
import { sound } from './utils/audio';
import { isSameDepartment } from './utils/department';

export default function App() {
  const [activeTab, setActiveTab] = useState<'vote' | 'dashboard' | 'admin'>('vote');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);
  const [isPresentationOpen, setIsPresentationOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [firebaseConnected, setFirebaseConnected] = useState(true);

  // Core state: Employees
  const [employees, setEmployees] = useState<Employee[]>(DEFAULT_EMPLOYEES);

  // Core state: The 8 Teams (T01 - T08, where T08 HR is non-votable)
  const [candidates, setCandidates] = useState<Candidate[]>(INITIAL_TEAMS);

  // Core state: Votes
  const [votes, setVotes] = useState<VoteRecord[]>([]);

  // Google Sheet configuration
  const [sheetConfig, setSheetConfig] = useState<SheetConfig | null>(null);

  // Ref to track if initial seeding was attempted
  const hasAttemptedSeed = useRef(false);

  // Initialize Firebase Auth
  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setCurrentUser(user);
      },
      () => {
        setCurrentUser(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Periodic Firestore connection health check
  useEffect(() => {
    let isMounted = true;
    const checkConnection = async () => {
      const ok = await testFirestoreConnection();
      if (isMounted) setFirebaseConnected(ok);
    };
    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Subscribe to real-time Firestore collections
  useEffect(() => {
    // 1. Subscribe to Votes
    const unsubVotes = subscribeVotes(
      (firestoreVotes) => {
        setVotes(firestoreVotes);
        setFirebaseConnected(true);
      },
      (err) => {
        console.warn('Votes listener warning:', err.error);
      }
    );

    // 2. Subscribe to Employees
    const unsubEmployees = subscribeEmployees(
      (firestoreEmployees) => {
        if (firestoreEmployees.length > 0) {
          setEmployees(firestoreEmployees);
        } else if (!hasAttemptedSeed.current) {
          hasAttemptedSeed.current = true;
          // Seed default employees to Firestore on first run
          seedEmployeesToFirestore(DEFAULT_EMPLOYEES).catch((e) =>
            console.warn('Auto-seed employees:', e)
          );
        }
        setFirebaseConnected(true);
      },
      (err) => {
        console.warn('Employees listener warning:', err.error);
      }
    );

    // 3. Subscribe to Candidates
    const unsubCandidates = subscribeCandidates(
      (firestoreCandidates) => {
        if (firestoreCandidates.length >= 8) {
          setCandidates(firestoreCandidates);
        } else if (!hasAttemptedSeed.current) {
          // Seed default candidates to Firestore
          seedCandidatesToFirestore(INITIAL_TEAMS).catch((e) =>
            console.warn('Auto-seed candidates:', e)
          );
        }
        setFirebaseConnected(true);
      },
      (err) => {
        console.warn('Candidates listener warning:', err.error);
      }
    );

    // 4. Subscribe to System Config (e.g. connected sheet)
    const unsubConfig = subscribeSystemConfig(
      (config) => {
        if (config) {
          setSheetConfig(config);
        }
      },
      (err) => {
        console.warn('Config listener warning:', err.error);
      }
    );

    return () => {
      unsubVotes();
      unsubEmployees();
      unsubCandidates();
      unsubConfig();
    };
  }, []);

  // Real-time synchronization across browser tabs using BroadcastChannel as fast local lane
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const channel = new BroadcastChannel('voting_realtime_sync_v3');

    channel.onmessage = (event) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'VOTE_CAST_MULTI') {
        const incomingVotes: VoteRecord[] = data.votes || [];
        setVotes((prev) => {
          const ids = new Set(prev.map((v) => v.id));
          const toAdd = incomingVotes.filter((v) => !ids.has(v.id));
          return [...prev, ...toAdd];
        });
        setEmployees((prev) =>
          prev.map((emp) => {
            if (emp.id !== data.employeeId) return emp;
            if (data.category === 'general') {
              return {
                ...emp,
                hasVotedGeneral: true,
                votedGeneralFor: data.summary,
                votedGeneralAt: incomingVotes[0]?.timestamp,
              };
            } else {
              return {
                ...emp,
                hasVotedPopular: true,
                votedPopularFor: data.summary,
                votedPopularAt: incomingVotes[0]?.timestamp,
              };
            }
          })
        );
      } else if (data.type === 'RESET_VOTES') {
        const category = data.category || 'all';
        if (category === 'all') {
          setVotes([]);
          setEmployees((prev) =>
            prev.map((emp) => ({
              ...emp,
              hasVotedGeneral: false,
              votedGeneralFor: undefined,
              votedGeneralAt: undefined,
              hasVotedPopular: false,
              votedPopularFor: undefined,
              votedPopularAt: undefined,
            }))
          );
        } else if (category === 'general') {
          setVotes((prev) => prev.filter((v) => v.category !== 'general'));
          setEmployees((prev) =>
            prev.map((emp) => ({
              ...emp,
              hasVotedGeneral: false,
              votedGeneralFor: undefined,
              votedGeneralAt: undefined,
            }))
          );
        } else if (category === 'popular') {
          setVotes((prev) => prev.filter((v) => v.category !== 'popular'));
          setEmployees((prev) =>
            prev.map((emp) => ({
              ...emp,
              hasVotedPopular: false,
              votedPopularFor: undefined,
              votedPopularAt: undefined,
            }))
          );
        }
      } else if (data.type === 'UPDATE_EMPLOYEES') {
        setEmployees(data.employees);
      }
    };

    return () => {
      channel.close();
    };
  }, []);

  const broadcastEvent = (data: unknown) => {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('voting_realtime_sync_v3');
        channel.postMessage(data);
        channel.close();
      }
    } catch {
      // ignore
    }
  };

  // Google Auth Handlers
  const handleSignIn = async () => {
    setIsLoadingAuth(true);
    try {
      const res = await googleSignIn();
      if (res?.user) {
        setCurrentUser(res.user);
      }
    } catch (err) {
      console.error('Google Sign In failed:', err);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setCurrentUser(null);
  };

  // Sync / Refresh employees from connected Google Sheet
  const handleRefreshFromSheet = useCallback(async () => {
    if (!sheetConfig?.spreadsheetId || !sheetConfig.sheetTitle) {
      setIsSheetModalOpen(true);
      return;
    }

    setIsSyncingSheet(true);
    try {
      const freshEmployees = await fetchEmployeesFromSheet(
        sheetConfig.spreadsheetId,
        sheetConfig.sheetTitle
      );

      const merged = freshEmployees.map((emp) => {
        const generalVotes = votes.filter((v) => v.employeeId === emp.id && v.category === 'general');
        const popularVote = votes.find((v) => v.employeeId === emp.id && v.category === 'popular');

        return {
          ...emp,
          hasVotedGeneral: generalVotes.length > 0,
          votedGeneralFor: generalVotes.map((v) => `${v.candidateId} (+${v.weight})`).join(', '),
          votedGeneralAt: generalVotes[0]?.timestamp,
          hasVotedPopular: !!popularVote,
          votedPopularFor: popularVote?.candidateId,
          votedPopularAt: popularVote?.timestamp,
        };
      });

      setEmployees(merged);
      const updatedConfig = { ...sheetConfig, lastSyncedAt: new Date().toLocaleTimeString('th-TH') };
      setSheetConfig(updatedConfig);
      await updateSystemConfigInFirestore(updatedConfig);
      await seedEmployeesToFirestore(merged);
      broadcastEvent({ type: 'UPDATE_EMPLOYEES', employees: merged });
    } catch (err) {
      console.error('Failed to sync sheet:', err);
      alert(err instanceof Error ? err.message : 'ไม่สามารถซิงค์ข้อมูลกับ Google Sheets ได้');
    } finally {
      setIsSyncingSheet(false);
    }
  }, [sheetConfig, votes]);

  // Cast Vote Action (Commits to Firestore + Broadcast + Google Sheets)
  const handleCastVote = async (
    employee: Employee,
    allocations: VoteAllocation[],
    category: VoteCategory
  ): Promise<boolean> => {
    // Validate against voting for own department
    const ownDeptVote = allocations.find((alloc) => {
      const cand = candidates.find((c) => c.id === alloc.candidateId);
      return isSameDepartment(employee.department, cand);
    });
    if (ownDeptVote) {
      alert(`กติกาไม่อนุญาตให้ลงคะแนนให้ทีมในแผนกเดียวกัน (${employee.department})`);
      return false;
    }

    const timestamp = new Date().toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const newVoteRecords: VoteRecord[] = allocations.map((alloc, idx) => ({
      id: `vote-${category}-${Date.now()}-${employee.id}-${alloc.candidateId}-${idx}`,
      category,
      employeeId: employee.id,
      employeeName: employee.name,
      employeeDepartment: employee.department,
      candidateId: alloc.candidateId,
      weight: alloc.weight,
      isExecutive: !!employee.isExecutive,
      isSupervisor: !!employee.isSupervisor || employee.voteWeight === 2,
      timestamp,
    }));

    const summary = allocations
      .map((a) => {
        const team = candidates.find((c) => c.id === a.candidateId);
        return `${team?.code || a.candidateId} (+${a.weight})`;
      })
      .join(', ');

    // 1. Immediate local optimistic update
    setVotes((prev) => [...prev, ...newVoteRecords]);
    setEmployees((prev) =>
      prev.map((e) => {
        if (e.id !== employee.id) return e;
        if (category === 'general') {
          return {
            ...e,
            hasVotedGeneral: true,
            votedGeneralFor: summary,
            votedGeneralAt: timestamp,
          };
        } else {
          return {
            ...e,
            hasVotedPopular: true,
            votedPopularFor: summary,
            votedPopularAt: timestamp,
          };
        }
      })
    );

    // 2. Commit to Firebase Firestore in real-time
    try {
      await castVoteInFirestore(newVoteRecords, employee.id, category, summary, timestamp);
      setFirebaseConnected(true);
    } catch (err) {
      console.warn('Firestore commit error, proceeding with local & sheets:', err);
    }

    // 3. Broadcast to other local browser tabs
    broadcastEvent({
      type: 'VOTE_CAST_MULTI',
      votes: newVoteRecords,
      employeeId: employee.id,
      category,
      summary,
    });

    // 4. Append to Google Sheets in background if configured
    if (sheetConfig?.spreadsheetId) {
      for (const rec of newVoteRecords) {
        const team = candidates.find((c) => c.id === rec.candidateId);
        appendVoteRecordToSheet(
          sheetConfig.spreadsheetId,
          rec,
          team ? `[${team.code}] ${team.name}` : rec.candidateId
        ).catch((e) => console.warn('Sheet append error:', e));
      }
    }

    return true;
  };

  // Reset Votes (Admins only - syncs to Firestore)
  const handleResetVotes = async (category: 'all' | 'general' | 'popular' = 'all') => {
    // 1. Optimistic local update
    if (category === 'all') {
      setVotes([]);
      setEmployees((prev) =>
        prev.map((e) => ({
          ...e,
          hasVotedGeneral: false,
          votedGeneralFor: undefined,
          votedGeneralAt: undefined,
          hasVotedPopular: false,
          votedPopularFor: undefined,
          votedPopularAt: undefined,
        }))
      );
    } else if (category === 'general') {
      setVotes((prev) => prev.filter((v) => v.category !== 'general'));
      setEmployees((prev) =>
        prev.map((e) => ({
          ...e,
          hasVotedGeneral: false,
          votedGeneralFor: undefined,
          votedGeneralAt: undefined,
        }))
      );
    } else if (category === 'popular') {
      setVotes((prev) => prev.filter((v) => v.category !== 'popular'));
      setEmployees((prev) =>
        prev.map((e) => ({
          ...e,
          hasVotedPopular: false,
          votedPopularFor: undefined,
          votedPopularAt: undefined,
        }))
      );
    }

    // 2. Reset in Firestore
    try {
      await resetVotesInFirestore(category);
    } catch (err) {
      console.warn('Firestore reset error:', err);
    }

    // 3. Broadcast
    broadcastEvent({ type: 'RESET_VOTES', category });
  };

  // Update employees handler (admin)
  const handleUpdateEmployees = async (newEmployees: Employee[]) => {
    setEmployees(newEmployees);
    await seedEmployeesToFirestore(newEmployees).catch((e) => console.warn(e));
    broadcastEvent({ type: 'UPDATE_EMPLOYEES', employees: newEmployees });
  };

  // Update candidates handler (admin)
  const handleUpdateCandidates = async (newCandidates: Candidate[]) => {
    setCandidates(newCandidates);
    await seedCandidatesToFirestore(newCandidates).catch((e) => console.warn(e));
  };

  // Simulate Demo Votes (with executive +1, +2, +3 splits)
  const handleSimulateVotes = async () => {
    const unvotedGeneral = employees.filter((e) => !e.hasVotedGeneral);
    const unvotedPopular = employees.filter((e) => !e.hasVotedPopular);

    if (unvotedGeneral.length === 0 && unvotedPopular.length === 0) {
      alert('พนักงานทุกคนได้ทำการโหวตครบทั้ง 2 หมวดเรียบร้อยแล้ว!');
      return;
    }

    const newRecords: VoteRecord[] = [];
    const updatedEmployees = [...employees];
    const votableCandidates = candidates.filter((c) => !c.isNonVotable);
    if (votableCandidates.length === 0) return;

    // Simulate for 3 unvoted in general
    for (const emp of unvotedGeneral.slice(0, 3)) {
      const eligible = votableCandidates.filter((c) => !isSameDepartment(emp.department, c));
      if (eligible.length === 0) continue;
      const time = new Date().toLocaleTimeString('th-TH');

      if (emp.isExecutive) {
        const shuffled = [...eligible].sort(() => 0.5 - Math.random());
        const teamA = shuffled[0];
        const teamB = shuffled[1] || shuffled[0];

        const voteA: VoteRecord = {
          id: `vote-sim-gen-${Date.now()}-${emp.id}-A`,
          category: 'general',
          employeeId: emp.id,
          employeeName: emp.name,
          employeeDepartment: emp.department,
          candidateId: teamA.id,
          weight: 2,
          isExecutive: true,
          timestamp: time,
        };

        const voteB: VoteRecord = {
          id: `vote-sim-gen-${Date.now()}-${emp.id}-B`,
          category: 'general',
          employeeId: emp.id,
          employeeName: emp.name,
          employeeDepartment: emp.department,
          candidateId: teamB.id,
          weight: 1,
          isExecutive: true,
          timestamp: time,
        };

        newRecords.push(voteA, voteB);
        const target = updatedEmployees.find((e) => e.id === emp.id);
        if (target) {
          target.hasVotedGeneral = true;
          target.votedGeneralFor = `${teamA.code} (+2), ${teamB.code} (+1)`;
          target.votedGeneralAt = time;
        }

        await castVoteInFirestore([voteA, voteB], emp.id, 'general', `${teamA.code} (+2), ${teamB.code} (+1)`, time).catch(() => {});
      } else if (emp.isSupervisor || emp.voteWeight === 2) {
        const shuffled = [...eligible].sort(() => 0.5 - Math.random());
        const teamA = shuffled[0];
        const v: VoteRecord = {
          id: `vote-sim-gen-${Date.now()}-${emp.id}`,
          category: 'general',
          employeeId: emp.id,
          employeeName: emp.name,
          employeeDepartment: emp.department,
          candidateId: teamA.id,
          weight: 2,
          isExecutive: false,
          isSupervisor: true,
          timestamp: time,
        };
        newRecords.push(v);
        const target = updatedEmployees.find((e) => e.id === emp.id);
        if (target) {
          target.hasVotedGeneral = true;
          target.votedGeneralFor = `${teamA.code} (+2)`;
          target.votedGeneralAt = time;
        }
        await castVoteInFirestore([v], emp.id, 'general', `${teamA.code} (+2)`, time).catch(() => {});
      } else {
        const randomCand = eligible[Math.floor(Math.random() * eligible.length)];
        const v: VoteRecord = {
          id: `vote-sim-gen-${Date.now()}-${emp.id}`,
          category: 'general',
          employeeId: emp.id,
          employeeName: emp.name,
          employeeDepartment: emp.department,
          candidateId: randomCand.id,
          weight: 1,
          isExecutive: false,
          isSupervisor: false,
          timestamp: time,
        };
        newRecords.push(v);
        const target = updatedEmployees.find((e) => e.id === emp.id);
        if (target) {
          target.hasVotedGeneral = true;
          target.votedGeneralFor = `${randomCand.code} (+1)`;
          target.votedGeneralAt = time;
        }
        await castVoteInFirestore([v], emp.id, 'general', `${randomCand.code} (+1)`, time).catch(() => {});
      }
    }

    // Simulate for 3 unvoted in popular
    for (const emp of unvotedPopular.slice(0, 3)) {
      const eligible = votableCandidates.filter((c) => !isSameDepartment(emp.department, c));
      if (eligible.length === 0) continue;
      const randomCand = eligible[Math.floor(Math.random() * eligible.length)];
      const time = new Date().toLocaleTimeString('th-TH');
      const v: VoteRecord = {
        id: `vote-sim-pop-${Date.now()}-${emp.id}`,
        category: 'popular',
        employeeId: emp.id,
        employeeName: emp.name,
        employeeDepartment: emp.department,
        candidateId: randomCand.id,
        weight: 1,
        isExecutive: emp.isExecutive,
        isSupervisor: emp.isSupervisor,
        timestamp: time,
      };
      newRecords.push(v);
      const target = updatedEmployees.find((e) => e.id === emp.id);
      if (target) {
        target.hasVotedPopular = true;
        target.votedPopularFor = `${randomCand.code} (+1)`;
        target.votedPopularAt = time;
      }
      await castVoteInFirestore([v], emp.id, 'popular', `${randomCand.code} (+1)`, time).catch(() => {});
    }

    setVotes((prev) => [...prev, ...newRecords]);
    setEmployees(updatedEmployees);
    sound.playVoteSubmitted(true);
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    sound.enabled = next;
    setSoundEnabled(next);
  };

  const isAdmin = isAuthorizedAdmin(currentUser?.email);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white antialiased">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <Header
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onOpenSheetModal={() => setIsSheetModalOpen(true)}
        onOpenPresentation={() => setIsPresentationOpen(true)}
        sheetConnected={!!sheetConfig?.spreadsheetId}
        sheetTitle={sheetConfig?.sheetTitle}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        currentUser={currentUser}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        isLoadingAuth={isLoadingAuth}
        firebaseConnected={firebaseConnected}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-10">
        {activeTab === 'vote' && (
          <VoterPortal
            employees={employees}
            candidates={candidates}
            onCastVote={handleCastVote}
            sheetTitle={sheetConfig?.sheetTitle}
            onOpenSheetModal={() => setIsSheetModalOpen(true)}
            isAdmin={isAdmin}
          />
        )}

        {activeTab === 'dashboard' && (
          <LiveDashboard
            candidates={candidates}
            employees={employees}
            votes={votes}
            onOpenPresentation={() => setIsPresentationOpen(true)}
            onRefreshFromSheet={sheetConfig?.spreadsheetId ? handleRefreshFromSheet : undefined}
            isSyncingSheet={isSyncingSheet}
          />
        )}

        {activeTab === 'admin' && (
          <AdminManager
            employees={employees}
            candidates={candidates}
            votes={votes}
            onUpdateEmployees={handleUpdateEmployees}
            onUpdateCandidates={handleUpdateCandidates}
            onResetVotes={handleResetVotes}
            onSimulateVotes={handleSimulateVotes}
            onOpenSheetModal={() => setIsSheetModalOpen(true)}
            sheetTitle={sheetConfig?.sheetTitle}
            currentUser={currentUser}
            onSignIn={handleSignIn}
            isLoadingAuth={isLoadingAuth}
          />
        )}
      </main>

      {/* Google Sheets Modal */}
      <GoogleSheetsModal
        isOpen={isSheetModalOpen}
        onClose={() => setIsSheetModalOpen(false)}
        currentUser={currentUser}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        sheetConfig={sheetConfig}
        onSaveConfig={async (cfg, loadedEmps) => {
          setSheetConfig(cfg);
          setEmployees(loadedEmps);
          await updateSystemConfigInFirestore(cfg);
          await seedEmployeesToFirestore(loadedEmps);
        }}
        isLoadingAuth={isLoadingAuth}
        onLoadEmployees={handleUpdateEmployees}
      />

      {/* Stage Presentation Mode */}
      {isPresentationOpen && (
        <PresentationMode
          candidates={candidates}
          votes={votes}
          totalEligible={employees.length}
          onClose={() => setIsPresentationOpen(false)}
        />
      )}

      {/* Modernized Footer */}
      <footer className="border-t border-slate-900/90 bg-slate-950/60 backdrop-blur-md py-4 text-center text-xs text-slate-500 relative z-10">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
            <span>ระบบโหวตคะแนน 8 ทีม (T01 - T08) พร้อมระบบคำนวณน้ำหนักสิทธิ์</span>
          </div>
          <div className="text-slate-400 font-mono text-[11px] flex items-center gap-3">
            <span>ผู้บริหาร 3 คะแนน (+1,+2,+3)</span>
            <span>•</span>
            <span>หัวหน้างาน 2 คะแนน (+1,+2)</span>
            <span>•</span>
            <span>พนักงาน 1 คะแนน</span>
            <span>•</span>
            <span className="text-pink-400">Popular Vote 1 คะแนน</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
