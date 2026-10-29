import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Crown,
  RotateCcw,
  Vote,
  Building,
  Briefcase,
  Check,
  Heart,
  Flame,
  Award,
  Plus,
  Minus,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Candidate, Employee, VoteAllocation, VoteCategory } from '../types';
import { sound } from '../utils/audio';

interface VoterPortalProps {
  employees: Employee[];
  candidates: Candidate[];
  onCastVote: (
    employee: Employee,
    allocations: VoteAllocation[],
    category: VoteCategory
  ) => Promise<boolean>;
  sheetTitle?: string;
  onOpenSheetModal: () => void;
  isAdmin: boolean;
}

export const VoterPortal: React.FC<VoterPortalProps> = ({
  employees,
  candidates,
  onCastVote,
  sheetTitle,
  onOpenSheetModal,
  isAdmin,
}) => {
  const [inputCode, setInputCode] = useState('');
  const [activeCategory, setActiveCategory] = useState<VoteCategory>('general');
  // For standard 1-vote mode (popular vote or regular employee general vote)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  // For executive multi-point distribution in general vote (e.g. { 'T01': 2, 'T02': 1 })
  const [execAllocations, setExecAllocations] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voteSuccess, setVoteSuccess] = useState<boolean>(false);
  const [successData, setSuccessData] = useState<{
    employee: Employee;
    allocations: VoteAllocation[];
    category: VoteCategory;
    totalWeight: number;
  } | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);

  // Match employee by ID or clean match
  const matchedEmployee = useMemo(() => {
    if (!inputCode.trim()) return null;
    const clean = inputCode.trim().toLowerCase();
    return (
      employees.find(
        (e) =>
          e.id.toLowerCase() === clean ||
          e.id.toLowerCase().replace(/[^a-z0-9]/g, '') === clean.replace(/[^a-z0-9]/g, '')
      ) || null
    );
  }, [inputCode, employees]);

  // Suggestions while typing
  const suggestions = useMemo(() => {
    if (!inputCode.trim() || matchedEmployee) return [];
    const clean = inputCode.trim().toLowerCase();
    return employees
      .filter(
        (e) =>
          e.id.toLowerCase().includes(clean) ||
          e.name.toLowerCase().includes(clean)
      )
      .slice(0, 5);
  }, [inputCode, employees, matchedEmployee]);

  // Sound feedback on employee match
  useEffect(() => {
    if (matchedEmployee) {
      sound.playSelect();
    }
  }, [matchedEmployee]);

  // Reset executive points when employee or category changes
  useEffect(() => {
    setExecAllocations({});
    setSelectedCandidateId(null);
  }, [matchedEmployee?.id, activeCategory]);

  // Check if matched employee already voted in current category
  const hasVotedCurrentCategory = useMemo(() => {
    if (!matchedEmployee) return false;
    return activeCategory === 'general'
      ? !!matchedEmployee.hasVotedGeneral
      : !!matchedEmployee.hasVotedPopular;
  }, [matchedEmployee, activeCategory]);

  // Multi-point vote calculation for General Vote (Executives get 3 pts, Supervisors get 2 pts)
  const isExecutiveGeneralVote =
    !!matchedEmployee?.isExecutive && activeCategory === 'general';
  const isSupervisorGeneralVote =
    !matchedEmployee?.isExecutive &&
    (!!matchedEmployee?.isSupervisor || matchedEmployee?.voteWeight === 2) &&
    activeCategory === 'general';
  const isMultiPointVote = isExecutiveGeneralVote || isSupervisorGeneralVote;
  const maxQuota = isExecutiveGeneralVote ? 3 : isSupervisorGeneralVote ? 2 : 1;

  const totalAllocatedPoints = useMemo(() => {
    return Object.values(execAllocations).reduce((sum, val) => sum + val, 0);
  }, [execAllocations]);

  const remainingQuotaPoints = Math.max(0, maxQuota - totalAllocatedPoints);

  // Multi-point adjustment handlers
  const handleAddPoints = (teamId: string, delta: number) => {
    const targetTeam = candidates.find((c) => c.id === teamId);
    if (targetTeam?.isNonVotable) return;

    const current = execAllocations[teamId] || 0;
    const available = remainingQuotaPoints;
    const toAdd = Math.min(delta, available);
    if (toAdd <= 0) return;

    sound.playSelect();
    setExecAllocations((prev) => ({
      ...prev,
      [teamId]: current + toAdd,
    }));
  };

  const handleMinusPoints = (teamId: string) => {
    const current = execAllocations[teamId] || 0;
    if (current <= 0) return;

    sound.playSelect();
    setExecAllocations((prev) => {
      const next = { ...prev };
      if (current === 1) {
        delete next[teamId];
      } else {
        next[teamId] = current - 1;
      }
      return next;
    });
  };

  const handleSetExactPoints = (teamId: string, exact: number) => {
    const targetTeam = candidates.find((c) => c.id === teamId);
    if (targetTeam?.isNonVotable) return;

    const current = execAllocations[teamId] || 0;
    const otherPoints = totalAllocatedPoints - current;
    if (otherPoints + exact > maxQuota) {
      setExecAllocations({ [teamId]: exact });
    } else {
      setExecAllocations((prev) => ({
        ...prev,
        [teamId]: exact,
      }));
    }
    sound.playSelect();
  };

  const handleSelectStandardCandidate = (candidateId: string) => {
    const targetTeam = candidates.find((c) => c.id === candidateId);
    if (targetTeam?.isNonVotable) return;

    sound.playSelect();
    setSelectedCandidateId(candidateId);
  };

  // Check validity to submit
  const canSubmit = useMemo(() => {
    if (!matchedEmployee || hasVotedCurrentCategory || isSubmitting) return false;
    if (isMultiPointVote) {
      return totalAllocatedPoints === maxQuota;
    }
    return !!selectedCandidateId;
  }, [
    matchedEmployee,
    hasVotedCurrentCategory,
    isSubmitting,
    isMultiPointVote,
    totalAllocatedPoints,
    maxQuota,
    selectedCandidateId,
  ]);

  const handleConfirmVote = async () => {
    if (!matchedEmployee || !canSubmit) return;

    setIsSubmitting(true);
    try {
      let finalAllocations: VoteAllocation[] = [];

      if (isMultiPointVote) {
        finalAllocations = Object.entries(execAllocations)
          .filter(([, weight]) => weight > 0)
          .map(([candidateId, weight]) => ({
            candidateId,
            weight,
          }));
      } else if (selectedCandidateId) {
        finalAllocations = [
          {
            candidateId: selectedCandidateId,
            weight: 1,
          },
        ];
      }

      if (finalAllocations.length === 0) return;

      const ok = await onCastVote(matchedEmployee, finalAllocations, activeCategory);
      if (ok) {
        sound.playVoteSubmitted(activeCategory === 'general' && (matchedEmployee.isExecutive || matchedEmployee.isSupervisor));

        confetti({
          particleCount: matchedEmployee.isExecutive && activeCategory === 'general' ? 120 : matchedEmployee.isSupervisor && activeCategory === 'general' ? 95 : 70,
          spread: 70,
          origin: { y: 0.6 },
          colors:
            activeCategory === 'popular'
              ? ['#EC4899', '#F43F5E', '#A855F7', '#FB7185']
              : matchedEmployee.isExecutive
              ? ['#F59E0B', '#FBBF24', '#6366F1', '#EC4899', '#10B981']
              : matchedEmployee.isSupervisor
              ? ['#10B981', '#34D399', '#06B6D4', '#6366F1']
              : ['#6366F1', '#38BDF8', '#10B981'],
        });

        const totalWeight = finalAllocations.reduce((s, a) => s + a.weight, 0);
        setSuccessData({
          employee: matchedEmployee,
          allocations: finalAllocations,
          category: activeCategory,
          totalWeight,
        });
        setVoteSuccess(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForNextVoter = () => {
    setInputCode('');
    setSelectedCandidateId(null);
    setExecAllocations({});
    setVoteSuccess(false);
    setSuccessData(null);
  };

  const handleSwitchToOtherCategory = () => {
    const otherCat = activeCategory === 'general' ? 'popular' : 'general';
    setActiveCategory(otherCat);
    setSelectedCandidateId(null);
    setExecAllocations({});
    setVoteSuccess(false);
    setSuccessData(null);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Category Tabs Selector */}
      <div className="grid grid-cols-2 gap-3 bg-slate-900/90 p-2 rounded-2xl border border-slate-800 shadow-xl">
        <button
          onClick={() => {
            sound.playSelect();
            setActiveCategory('general');
            setSelectedCandidateId(null);
            setExecAllocations({});
            setVoteSuccess(false);
          }}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
            activeCategory === 'general'
              ? 'bg-gradient-to-r from-indigo-950/70 to-indigo-900/50 border-indigo-500 shadow-lg shadow-indigo-500/20'
              : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-400'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                activeCategory === 'general'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                1. โหวตคะแนนทั่วไป (General)
              </div>
              <div className="text-[11px] text-slate-400">
                ผู้บริหาร <span className="text-amber-400 font-bold">3 คะแนน (+1,+2,+3)</span> • หัวหน้างาน{' '}
                <span className="text-emerald-400 font-bold">2 คะแนน (+1,+2)</span> • พนักงาน{' '}
                <span className="text-indigo-300 font-bold">1 คะแนน</span>
              </div>
            </div>
          </div>
          {activeCategory === 'general' && (
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => {
            sound.playSelect();
            setActiveCategory('popular');
            setSelectedCandidateId(null);
            setExecAllocations({});
            setVoteSuccess(false);
          }}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
            activeCategory === 'popular'
              ? 'bg-gradient-to-r from-pink-950/70 to-rose-900/50 border-pink-500 shadow-lg shadow-pink-500/20'
              : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-400'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                activeCategory === 'popular'
                  ? 'bg-gradient-to-tr from-pink-600 to-rose-500 text-white'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              <Flame className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                2. Popular Vote (คะแนนนิยม)
              </div>
              <div className="text-[11px] text-slate-400">
                ทุกคนมีสิทธิ์เท่ากัน <span className="text-pink-400 font-bold">คนละ 1 คะแนน</span>
              </div>
            </div>
          </div>
          {activeCategory === 'popular' && (
            <span className="w-2.5 h-2.5 rounded-full bg-pink-400 animate-pulse" />
          )}
        </button>
      </div>

      {/* Step 1: Employee ID Input Section */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-xs font-bold">
                1
              </span>
              ใส่รหัสพนักงาน (Employee ID)
            </h2>
            <p className="text-xs text-slate-400">
              พิมพ์รหัสพนักงานเพื่อดึงข้อมูลชื่อ-สกุล และตรวจสอบสิทธิ์คะแนนโหวตอัตโนมัติ
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={onOpenSheetModal}
              className="text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg border border-emerald-500/30 transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {sheetTitle ? `ชีต: ${sheetTitle}` : 'เชื่อมต่อ Google Sheets'}
            </button>
          )}
        </div>

        {/* Input box */}
        <div className="relative">
          <div className="relative flex items-center">
            <div className="absolute left-4 pointer-events-none text-slate-500">
              <Search className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={inputCode}
              onChange={(e) => {
                setInputCode(e.target.value);
                setVoteSuccess(false);
              }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              placeholder="ตัวอย่าง: EMP-001 หรือพิมพ์ชื่อเพื่อค้นหา..."
              className="w-full pl-12 pr-28 py-3.5 bg-slate-950/80 border-2 border-slate-700/80 focus:border-indigo-500 rounded-xl text-base text-white placeholder-slate-500 focus:outline-hidden transition-all shadow-inner font-mono tracking-wide"
            />
            {inputCode && (
              <button
                onClick={() => {
                  setInputCode('');
                  setSelectedCandidateId(null);
                  setExecAllocations({});
                  setVoteSuccess(false);
                }}
                className="absolute right-3 px-2 py-1 text-xs text-slate-400 hover:text-white bg-slate-800 rounded-md transition-colors cursor-pointer"
              >
                ล้างรหัส
              </button>
            )}
          </div>

          {/* Autocomplete suggestions */}
          {suggestions.length > 0 && searchFocused && (
            <div className="absolute z-20 left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden divide-y divide-slate-800">
              {suggestions.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => {
                    setInputCode(emp.id);
                    setSearchFocused(false);
                  }}
                  className="w-full px-4 py-2.5 text-left hover:bg-indigo-600/20 flex items-center justify-between text-xs transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-indigo-400">{emp.id}</span>
                    <span className="text-slate-200">{emp.name}</span>
                    <span className="text-slate-500">({emp.department})</span>
                  </div>
                  <div>
                    {emp.isExecutive ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 text-[10px]">
                        ⭐ ผู้บริหาร (3 คะแนน)
                      </span>
                    ) : emp.isSupervisor || emp.voteWeight === 2 ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 text-[10px]">
                        🛡️ หัวหน้างาน (2 คะแนน)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px]">
                        พนักงาน (1 คะแนน)
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}


        </div>

        {/* Matched Employee Identity Pop-up Card */}
        {matchedEmployee && (
          <div className="mt-5 animate-in fade-in slide-in-from-top-2 duration-200">
            <div
              className={`p-4 rounded-xl border relative overflow-hidden transition-all ${
                matchedEmployee.isExecutive
                  ? 'bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-slate-900 border-amber-500/50 shadow-lg shadow-amber-500/10'
                  : matchedEmployee.isSupervisor || matchedEmployee.voteWeight === 2
                  ? 'bg-gradient-to-r from-emerald-950/40 via-teal-900/20 to-slate-900 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                  : 'bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 border-indigo-500/40 shadow-lg shadow-indigo-500/10'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-inner ${
                      matchedEmployee.isExecutive
                        ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 border border-amber-300'
                        : matchedEmployee.isSupervisor || matchedEmployee.voteWeight === 2
                        ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950 border border-emerald-300'
                        : 'bg-gradient-to-br from-indigo-500 to-cyan-500 text-white border border-indigo-400'
                    }`}
                  >
                    {matchedEmployee.isExecutive ? (
                      <Crown className="w-6 h-6 text-slate-950 fill-amber-300" />
                    ) : matchedEmployee.isSupervisor || matchedEmployee.voteWeight === 2 ? (
                      <Award className="w-6 h-6 text-slate-950" />
                    ) : (
                      matchedEmployee.name[0] || 'E'
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-800 text-indigo-300 font-semibold border border-slate-700">
                        {matchedEmployee.id}
                      </span>
                      <h3 className="text-base font-bold text-white">
                        {matchedEmployee.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Building className="w-3.5 h-3.5 text-slate-500" />
                        {matchedEmployee.department}
                      </span>
                      <span className="flex items-center gap-1">
                        <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                        {matchedEmployee.position}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Voting Weight Details */}
                <div className="border-t sm:border-t-0 border-slate-700/50 pt-3 sm:pt-0 flex flex-col items-end gap-1.5">
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 mr-2">สิทธิ์การโหวตรอบนี้:</span>
                    <span
                      className={`text-sm font-black px-2.5 py-0.5 rounded-lg border ${
                        activeCategory === 'popular'
                          ? 'bg-pink-500/20 text-pink-300 border-pink-500/40'
                          : matchedEmployee.isExecutive
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : matchedEmployee.isSupervisor || matchedEmployee.voteWeight === 2
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                      }`}
                    >
                      {activeCategory === 'popular'
                        ? '1 คะแนน (Popular Vote)'
                        : matchedEmployee.isExecutive
                        ? '⭐ 3 คะแนน (กระจาย +1, +2, +3 ได้)'
                        : matchedEmployee.isSupervisor || matchedEmployee.voteWeight === 2
                        ? '🛡️ 2 คะแนน (กระจาย +1, +2 ได้)'
                        : '1 คะแนน (พนักงานทั่วไป)'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px]">
                    <span
                      className={`px-2 py-0.5 rounded-md border ${
                        matchedEmployee.hasVotedGeneral
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      โหวตทั่วไป: {matchedEmployee.hasVotedGeneral ? '✓ โหวตแล้ว' : 'ยังไม่โหวต'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md border ${
                        matchedEmployee.hasVotedPopular
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      Popular: {matchedEmployee.hasVotedPopular ? '✓ โหวตแล้ว' : 'ยังไม่โหวต'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Already voted warning */}
              {hasVotedCurrentCategory && (
                <div className="mt-3 p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>
                      คุณได้ทำการโหวตในหมวด <strong className="text-white">{activeCategory === 'general' ? 'คะแนนทั่วไป' : 'Popular Vote'}</strong> เรียบร้อยแล้ว
                    </span>
                  </div>
                  {((activeCategory === 'general' && !matchedEmployee.hasVotedPopular) ||
                    (activeCategory === 'popular' && !matchedEmployee.hasVotedGeneral)) && (
                    <button
                      onClick={handleSwitchToOtherCategory}
                      className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                    >
                      สลับไปโหวตอีกหมวด ➔
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {inputCode && !matchedEmployee && (
          <div className="mt-3 p-3 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              ไม่พบรหัสพนักงาน <strong className="text-white">"{inputCode}"</strong> ในระบบ
            </span>
          </div>
        )}
      </div>

      {/* Vote Success Card */}
      {voteSuccess && successData && (
        <div className="bg-gradient-to-br from-emerald-950/80 via-slate-900 to-indigo-950/80 border-2 border-emerald-500/50 rounded-2xl p-6 shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
            <CheckCircle className="w-10 h-10" />
          </div>

          <div className="space-y-1">
            <h3 className="text-xl font-bold text-white">บันทึกการลงคะแนนสำเร็จแล้ว!</h3>
            <p className="text-xs text-slate-300">
              คะแนนของคุณได้ถูกบันทึกและอัปเดตบนกราฟสรุปผลแบบเรียลไทม์เรียบร้อยแล้ว
            </p>
          </div>

          <div className="max-w-md mx-auto p-4 rounded-xl bg-slate-900/80 border border-slate-700/80 text-left text-xs space-y-2">
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">หมวดการโหวต:</span>
              <span className="text-white font-bold">
                {successData.category === 'general' ? 'โหวตคะแนนทั่วไป' : 'Popular Vote'}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">ผู้ลงคะแนน:</span>
              <span className="text-white font-medium">{successData.employee.name}</span>
            </div>
            <div className="border-b border-slate-800 pb-2 space-y-1">
              <span className="text-slate-400 block mb-1">ทีมที่ได้รับคะแนน:</span>
              {successData.allocations.map((alloc) => {
                const team = candidates.find((c) => c.id === alloc.candidateId);
                return (
                  <div key={alloc.candidateId} className="flex justify-between items-center bg-slate-950/60 px-2.5 py-1.5 rounded-lg">
                    <span className="text-indigo-300 font-semibold">
                      [{team?.code}] {team?.name}
                    </span>
                    <span className="text-amber-400 font-black">
                      +{alloc.weight} คะแนน
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-slate-400">รวมคะแนนที่มอบให้:</span>
              <span className="text-emerald-400 font-black text-sm">
                +{successData.totalWeight} คะแนน
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            {successData.category === 'general' && !matchedEmployee?.hasVotedPopular && (
              <button
                onClick={handleSwitchToOtherCategory}
                className="px-5 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-pink-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Heart className="w-4 h-4 fill-white" /> โหวตต่อในหมวด Popular Vote (1 คะแนน)
              </button>
            )}

            {successData.category === 'popular' && !matchedEmployee?.hasVotedGeneral && (
              <button
                onClick={handleSwitchToOtherCategory}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Award className="w-4 h-4" /> โหวตต่อในหมวดคะแนนทั่วไป (
                {matchedEmployee?.isExecutive
                  ? '3 คะแนน'
                  : matchedEmployee?.isSupervisor || matchedEmployee?.voteWeight === 2
                  ? '2 คะแนน'
                  : '1 คะแนน'}
                )
              </button>
            )}

            <button
              onClick={handleResetForNextVoter}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" /> ส่งต่อให้ผู้โหวตท่านต่อไป
            </button>
          </div>
        </div>
      )}

      {/* Step 2: The Teams Selection Section */}
      {!voteSuccess && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-xs font-bold">
                  2
                </span>
                เลือกทีมที่ต้องการโหวต ({activeCategory === 'general' ? 'คะแนนทั่วไป' : 'Popular Vote'})
              </h2>
              <p className="text-xs text-slate-400">
                {isExecutiveGeneralVote
                  ? 'ท่านมีสิทธิ์ 3 คะแนน สามารถเลือกให้ทีมเดียว +3 หรือกระจาย +1, +2, +3 ข้ามทีมได้'
                  : isSupervisorGeneralVote
                  ? 'ท่านมีสิทธิ์ 2 คะแนน สามารถเลือกให้ทีมเดียว +2 หรือกระจาย +1, +2 ข้ามทีมได้'
                  : 'คลิกเลือก 1 ทีมเพื่อมอบคะแนนของคุณ (1 คะแนน)'}
              </p>
            </div>

            {/* Multi-Point Budget Indicator (Executive 3 pts / Supervisor 2 pts) */}
            {isMultiPointVote && (
              <div
                className={`p-2.5 rounded-xl border flex items-center gap-3 ${
                  isExecutiveGeneralVote
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-emerald-500/10 border-emerald-500/30'
                }`}
              >
                <div className="text-xs">
                  <span className="text-slate-400">จัดสรรคะแนน: </span>
                  <span
                    className={`font-black text-sm ${
                      isExecutiveGeneralVote ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {totalAllocatedPoints} / {maxQuota} คะแนน
                  </span>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: maxQuota }).map((_, idx) => {
                    const starIdx = idx + 1;
                    return (
                      <span
                        key={starIdx}
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          starIdx <= totalAllocatedPoints
                            ? isExecutiveGeneralVote
                              ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                              : 'bg-emerald-400 text-slate-950 font-black shadow-xs'
                            : 'bg-slate-800 text-slate-600'
                        }`}
                      >
                        {isExecutiveGeneralVote ? '★' : '◆'}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Teams Grid (8 Teams including T08 Non-Votable) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {candidates.map((cand) => {
              const allocatedPoints = execAllocations[cand.id] || 0;
              const isSelectedStandard = selectedCandidateId === cand.id;
              const isNonVotable = !!cand.isNonVotable;

              if (isNonVotable) {
                return (
                  <div
                    key={cand.id}
                    className="p-4 rounded-xl border-2 border-dashed border-slate-800/80 bg-slate-950/40 opacity-60 cursor-not-allowed select-none flex flex-col justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm text-slate-400 shrink-0 shadow-md bg-slate-800 border border-slate-700"
                      >
                        {cand.code}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-sm font-bold text-slate-400 truncate">
                            {cand.name}
                          </h4>
                          <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[10px] font-bold">
                            🚫 งดรับโหวต
                          </span>
                        </div>

                        <div className="text-xs text-slate-500 font-medium mt-0.5">
                          {cand.subtitle}
                        </div>

                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                          ช่องของ {cand.code} {cand.name} จะไม่มีใครสามารถโหวตได้
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-800/60 text-[11px] text-slate-500 flex items-center justify-center gap-1.5 font-medium">
                      <span>ไม่เปิดรับการลงคะแนนในทุกหมวด</span>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={cand.id}
                  className={`p-4 rounded-xl border-2 transition-all relative overflow-hidden flex flex-col justify-between ${
                    isMultiPointVote
                      ? allocatedPoints > 0
                        ? isExecutiveGeneralVote
                          ? 'bg-amber-950/40 border-amber-500/80 shadow-lg shadow-amber-500/20'
                          : 'bg-emerald-950/40 border-emerald-500/80 shadow-lg shadow-emerald-500/20'
                        : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                      : isSelectedStandard
                      ? activeCategory === 'popular'
                        ? 'bg-pink-950/50 border-pink-500 shadow-lg shadow-pink-500/20 cursor-pointer'
                        : 'bg-indigo-950/50 border-indigo-500 shadow-lg shadow-indigo-500/20 cursor-pointer'
                      : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40 cursor-pointer'
                  }`}
                  onClick={() => {
                    if (!isMultiPointVote) {
                      handleSelectStandardCandidate(cand.id);
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm text-white shrink-0 shadow-md ${cand.color}`}
                    >
                      {cand.code}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-sm font-bold text-white truncate">
                          {cand.name}
                        </h4>

                        {/* Standard 1-point checkmark */}
                        {!isMultiPointVote && (
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                              isSelectedStandard
                                ? activeCategory === 'popular'
                                  ? 'bg-pink-500 border-pink-400 text-white'
                                  : 'bg-indigo-500 border-indigo-400 text-white'
                                : 'border-slate-600 bg-slate-900'
                            }`}
                          >
                            {isSelectedStandard && <Check className="w-3.5 h-3.5" />}
                          </div>
                        )}

                        {/* Multi-point allocated score badge */}
                        {isMultiPointVote && allocatedPoints > 0 && (
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-black text-xs shadow-md animate-in zoom-in-75 ${
                              isExecutiveGeneralVote
                                ? 'bg-amber-400 text-slate-950'
                                : 'bg-emerald-400 text-slate-950'
                            }`}
                          >
                            +{allocatedPoints} คะแนน
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-indigo-300 font-medium mt-0.5">
                        {cand.subtitle}
                      </div>

                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {cand.description}
                      </p>
                    </div>
                  </div>

                  {/* Multi-Point Stepper & Quick Shortcuts (+1, +2, and +3 for Exec) */}
                  {isMultiPointVote && (
                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMinusPoints(cand.id);
                          }}
                          disabled={allocatedPoints === 0}
                          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center font-bold text-white text-xs">
                          {allocatedPoints}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddPoints(cand.id, 1);
                          }}
                          disabled={remainingQuotaPoints <= 0}
                          className={`w-7 h-7 rounded-lg text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer ${
                            isExecutiveGeneralVote
                              ? 'bg-amber-600 hover:bg-amber-500'
                              : 'bg-emerald-600 hover:bg-emerald-500'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Quick Shortcut Buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetExactPoints(cand.id, 1);
                          }}
                          className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                            allocatedPoints === 1
                              ? isExecutiveGeneralVote
                                ? 'bg-amber-400 text-slate-950'
                                : 'bg-emerald-400 text-slate-950'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          +1
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetExactPoints(cand.id, 2);
                          }}
                          className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                            allocatedPoints === 2
                              ? isExecutiveGeneralVote
                                ? 'bg-amber-400 text-slate-950'
                                : 'bg-emerald-400 text-slate-950'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          +2
                        </button>
                        {isExecutiveGeneralVote && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetExactPoints(cand.id, 3);
                            }}
                            className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                              allocatedPoints === 3
                                ? 'bg-amber-400 text-slate-950 shadow-md'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            +3
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Step 3: Confirmation and Submit Action */}
          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-400 text-center sm:text-left">
              {matchedEmployee ? (
                <span>
                  กำลังโหวตในนาม: <strong className="text-white">{matchedEmployee.name}</strong>{' '}
                  {isMultiPointVote ? (
                    <span
                      className={`font-bold ml-1 ${
                        isExecutiveGeneralVote ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      (จัดสรร {totalAllocatedPoints} / {maxQuota} คะแนน
                      {remainingQuotaPoints > 0
                        ? ` — ยังเหลืออีก ${remainingQuotaPoints} คะแนน`
                        : ' — ครบถ้วน ✓'}
                      )
                    </span>
                  ) : (
                    <span
                      className={
                        activeCategory === 'popular'
                          ? 'text-pink-400 font-bold ml-1'
                          : 'text-indigo-400 font-bold ml-1'
                      }
                    >
                      (1 คะแนน)
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1.5 justify-center sm:justify-start">
                  <AlertCircle className="w-3.5 h-3.5" />
                  กรุณาใส่รหัสพนักงานในขั้นตอนที่ 1 ก่อนลงคะแนน
                </span>
              )}
            </div>

            <button
              onClick={handleConfirmVote}
              disabled={!canSubmit}
              className={`w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
                activeCategory === 'popular'
                  ? 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white shadow-pink-600/25'
                  : isExecutiveGeneralVote
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-amber-500/25'
                  : isSupervisorGeneralVote
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/25'
                  : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-indigo-600/25'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <Vote className="w-4 h-4" />
              {isSubmitting
                ? 'กำลังบันทึกคะแนน...'
                : activeCategory === 'popular'
                ? 'ยืนยันโหวต Popular Vote (1 คะแนน)'
                : isExecutiveGeneralVote
                ? totalAllocatedPoints === 3
                  ? 'ยืนยันการลงคะแนน (ใช้ครบ 3 คะแนน)'
                  : `กรุณาจัดสรรให้ครบ 3 คะแนน (เหลือ ${remainingQuotaPoints})`
                : isSupervisorGeneralVote
                ? totalAllocatedPoints === 2
                  ? 'ยืนยันการลงคะแนน (ใช้ครบ 2 คะแนน)'
                  : `กรุณาจัดสรรให้ครบ 2 คะแนน (เหลือ ${remainingQuotaPoints})`
                : 'ยืนยันโหวตทั่วไป (1 คะแนน)'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
