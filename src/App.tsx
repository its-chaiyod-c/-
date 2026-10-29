import React, { useState, useEffect, useCallback } from 'react';
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
import { initAuth, googleSignIn, logout } from './services/firebase';
import { sound } from './utils/audio';

export default function App() {
  const [activeTab, setActiveTab] = useState<'vote' | 'dashboard' | 'admin'>('vote');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);
  const [isPresentationOpen, setIsPresentationOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);

  // Core state: Employees
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem('voting_employees_v4') || localStorage.getItem('voting_employees_v3');
    if (saved) {
      try {
        const parsed: Employee[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Auto-heal any previous bad sync where name was mistakenly set to ID
          const healed = parsed.map((emp) => {
            if (emp.name === emp.id || !emp.name) {
              const matched = DEFAULT_EMPLOYEES.find((d) => d.id === emp.id);
              if (matched) {
                return {
                  ...emp,
                  name: matched.name,
                  department: matched.department,
                  position: matched.position,
                };
              }
            }
            return emp;
          });
          // If previous dataset was old 12-item demo, update to the actual 33 employees
          if (healed.length < 20) {
            return DEFAULT_EMPLOYEES;
          }
          return healed;
        }
      } catch {
        // fallback
      }
    }
    return DEFAULT_EMPLOYEES;
  });

  // Core state: The 8 Teams (T01 - T08, where T08 HR is non-votable)
  const [candidates, setCandidates] = useState<Candidate[]>(() => {
    const saved = localStorage.getItem('voting_candidates_v5');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 8 && parsed[0]?.code) {
          return parsed;
        }
      } catch {
        // fallback
      }
    }
    return INITIAL_TEAMS;
  });

  // Core state: Votes
  const [votes, setVotes] = useState<VoteRecord[]>(() => {
    const saved = localStorage.getItem('voting_records_v3');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return [];
  });

  // Google Sheet configuration
  const [sheetConfig, setSheetConfig] = useState<SheetConfig | null>(() => {
    const saved = localStorage.getItem('voting_sheet_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return null;
  });

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

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem('voting_employees_v4', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('voting_candidates_v5', JSON.stringify(candidates));
  }, [candidates]);

  useEffect(() => {
    localStorage.setItem('voting_records_v3', JSON.stringify(votes));
  }, [votes]);

  useEffect(() => {
    if (sheetConfig) {
      localStorage.setItem('voting_sheet_config', JSON.stringify(sheetConfig));
    }
  }, [sheetConfig]);

  // Real-time synchronization across browser tabs using BroadcastChannel
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
      setSheetConfig((prev) => (prev ? { ...prev, lastSyncedAt: new Date().toLocaleTimeString('th-TH') } : null));
      broadcastEvent({ type: 'UPDATE_EMPLOYEES', employees: merged });
    } catch (err) {
      console.error('Failed to sync sheet:', err);
      alert(err instanceof Error ? err.message : 'ไม่สามารถซิงค์ข้อมูลกับ Google Sheets ได้');
    } finally {
      setIsSyncingSheet(false);
    }
  }, [sheetConfig, votes]);

  // Cast Vote Action (Supports allocations: +1, +2, +3)
  const handleCastVote = async (
    employee: Employee,
    allocations: VoteAllocation[],
    category: VoteCategory
  ): Promise<boolean> => {
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
      isExecutive: employee.isExecutive,
      timestamp,
    }));

    const summary = allocations
      .map((a) => {
        const team = candidates.find((c) => c.id === a.candidateId);
        return `${team?.code || a.candidateId} (+${a.weight})`;
      })
      .join(', ');

    // Update state
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

    // Broadcast in real-time
    broadcastEvent({
      type: 'VOTE_CAST_MULTI',
      votes: newVoteRecords,
      employeeId: employee.id,
      category,
      summary,
    });

    // Append to Google Sheets in background
    if (sheetConfig?.spreadsheetId) {
      for (const rec of newVoteRecords) {
        const team = candidates.find((c) => c.id === rec.candidateId);
        appendVoteRecordToSheet(
          sheetConfig.spreadsheetId,
          rec,
          team ? `[${team.code}] ${team.name}` : rec.candidateId
        );
      }
    }

    return true;
  };

  // Reset Votes
  const handleResetVotes = (category: 'all' | 'general' | 'popular' = 'all') => {
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
    broadcastEvent({ type: 'RESET_VOTES', category });
  };

  // Simulate Demo Votes (with executive +1, +2, +3 splits)
  const handleSimulateVotes = () => {
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
    unvotedGeneral.slice(0, 3).forEach((emp) => {
      const time = new Date().toLocaleTimeString('th-TH');

      if (emp.isExecutive) {
        // Executive split: e.g. +2 to one team and +1 to another
        const shuffled = [...votableCandidates].sort(() => 0.5 - Math.random());
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
      } else if (emp.isSupervisor || emp.voteWeight === 2) {
        // Supervisor: +2 to one team, or +1 and +1 to two teams
        const shuffled = [...votableCandidates].sort(() => 0.5 - Math.random());
        const teamA = shuffled[0];
        const teamB = shuffled[1];
        const giveSplit = Math.random() > 0.5 && teamB;

        if (giveSplit) {
          const vA: VoteRecord = {
            id: `vote-sim-gen-${Date.now()}-${emp.id}-A`,
            category: 'general',
            employeeId: emp.id,
            employeeName: emp.name,
            employeeDepartment: emp.department,
            candidateId: teamA.id,
            weight: 1,
            isExecutive: false,
            isSupervisor: true,
            timestamp: time,
          };
          const vB: VoteRecord = {
            id: `vote-sim-gen-${Date.now()}-${emp.id}-B`,
            category: 'general',
            employeeId: emp.id,
            employeeName: emp.name,
            employeeDepartment: emp.department,
            candidateId: teamB.id,
            weight: 1,
            isExecutive: false,
            isSupervisor: true,
            timestamp: time,
          };
          newRecords.push(vA, vB);
          const target = updatedEmployees.find((e) => e.id === emp.id);
          if (target) {
            target.hasVotedGeneral = true;
            target.votedGeneralFor = `${teamA.code} (+1), ${teamB.code} (+1)`;
            target.votedGeneralAt = time;
          }
        } else {
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
        }
      } else {
        const randomCand = votableCandidates[Math.floor(Math.random() * votableCandidates.length)];
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
      }
    });

    // Simulate for 3 unvoted in popular
    unvotedPopular.slice(0, 3).forEach((emp) => {
      const randomCand = votableCandidates[Math.floor(Math.random() * votableCandidates.length)];
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
    });

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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
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
      />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
            onUpdateEmployees={setEmployees}
            onUpdateCandidates={setCandidates}
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
        onSaveConfig={(cfg, loadedEmps) => {
          setSheetConfig(cfg);
          setEmployees(loadedEmps);
        }}
        isLoadingAuth={isLoadingAuth}
        onLoadEmployees={setEmployees}
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

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 text-center text-xs text-slate-500">
        ระบบโหวต 6 ทีม • หมวดคะแนนทั่วไป (ผู้บริหาร 3 คะแนน เลือกกระจาย +1, +2, +3 ได้ / พนักงาน 1 คะแนน) และ Popular Vote
      </footer>
    </div>
  );
}
