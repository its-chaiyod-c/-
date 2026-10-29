import React, { useState } from 'react';
import {
  Trophy,
  Users,
  Award,
  Crown,
  TrendingUp,
  Activity,
  Maximize2,
  RefreshCw,
  Clock,
  Flame,
  Layers,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { Candidate, Employee, VoteCategory, VoteRecord } from '../types';

interface LiveDashboardProps {
  candidates: Candidate[];
  employees: Employee[];
  votes: VoteRecord[];
  onOpenPresentation: () => void;
  onRefreshFromSheet?: () => void;
  isSyncingSheet?: boolean;
}

export const LiveDashboard: React.FC<LiveDashboardProps> = ({
  candidates,
  employees,
  votes,
  onOpenPresentation,
  onRefreshFromSheet,
  isSyncingSheet = false,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<VoteCategory | 'all'>('general');
  const [metricView, setMetricView] = useState<'score' | 'headcount'>('score');

  // Filter votes based on selected category
  const filteredVotes =
    selectedCategory === 'all'
      ? votes
      : votes.filter((v) => v.category === selectedCategory);

  // Stats calculation per team
  const candidateStats = candidates.map((cand) => {
    const teamVotes = filteredVotes.filter((v) => v.candidateId === cand.id);
    const executiveVotes = teamVotes.filter((v) => v.isExecutive);
    const supervisorVotes = teamVotes.filter(
      (v) => !v.isExecutive && (v.isSupervisor || v.weight === 2)
    );
    const regularVotes = teamVotes.filter(
      (v) => !v.isExecutive && !v.isSupervisor && v.weight !== 2
    );

    const executiveScore = executiveVotes.reduce((sum, v) => sum + v.weight, 0);
    const supervisorScore = supervisorVotes.reduce((sum, v) => sum + v.weight, 0);
    const regularScore = regularVotes.reduce((sum, v) => sum + v.weight, 0);
    const totalScore = executiveScore + supervisorScore + regularScore;
    const voterCount = teamVotes.length;

    // Distinct category stats
    const generalScore = votes
      .filter((v) => v.candidateId === cand.id && v.category === 'general')
      .reduce((s, v) => s + v.weight, 0);

    const popularScore = votes
      .filter((v) => v.candidateId === cand.id && v.category === 'popular')
      .reduce((s, v) => s + v.weight, 0);

    return {
      ...cand,
      voterCount,
      totalScore,
      regularVotesCount: regularVotes.length,
      supervisorVotesCount: supervisorVotes.length,
      executiveVotesCount: executiveVotes.length,
      regularScore,
      supervisorScore,
      executiveScore,
      generalScore,
      popularScore,
    };
  });

  // Totals
  const totalPoints = candidateStats.reduce((sum, c) => sum + c.totalScore, 0);
  const totalVotersCount = filteredVotes.length;
  const totalEligibleEmployees = employees.length;
  const totalEligibleExecutives = employees.filter((e) => e.isExecutive).length;
  const totalEligibleSupervisors = employees.filter(
    (e) => !e.isExecutive && (e.isSupervisor || e.voteWeight === 2)
  ).length;
  const totalEligibleRegular = employees.filter(
    (e) => !e.isExecutive && !e.isSupervisor && e.voteWeight !== 2
  ).length;

  const votedExecutives = filteredVotes.filter((v) => v.isExecutive).length;
  const votedSupervisors = filteredVotes.filter(
    (v) => !v.isExecutive && (v.isSupervisor || v.weight === 2)
  ).length;
  const votedRegular = filteredVotes.filter(
    (v) => !v.isExecutive && !v.isSupervisor && v.weight !== 2
  ).length;

  const turnoutPercentage =
    totalEligibleEmployees > 0
      ? Math.round(
          (new Set(filteredVotes.map((v) => v.employeeId)).size / totalEligibleEmployees) * 100
        )
      : 0;

  // Sorting for Graph (votable teams first, then non-votable)
  const sortedCandidates = [...candidateStats].sort((a, b) => {
    if (a.isNonVotable && !b.isNonVotable) return 1;
    if (!a.isNonVotable && b.isNonVotable) return -1;
    if (metricView === 'score') {
      return b.totalScore - a.totalScore;
    }
    return b.voterCount - a.voterCount;
  });

  // Podium (Only for votable teams)
  const votableSorted = sortedCandidates.filter((c) => !c.isNonVotable);
  const top1 = votableSorted[0];
  const top2 = votableSorted[1];
  const top3 = votableSorted[2];

  const maxVal = Math.max(
    ...candidateStats.map((c) => (metricView === 'score' ? c.totalScore : c.voterCount)),
    1
  );

  return (
    <div className="space-y-6">
      {/* Category Selection Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 backdrop-blur-xl p-4 sm:p-5 rounded-2xl border border-slate-800/90 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-1/4 w-72 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center gap-3 relative z-10">
          <div className="relative flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 shadow-sm shadow-emerald-500/50"></span>
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <span>ผลคะแนนการโหวตแบบเรียลไทม์</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                LIVE
              </span>
            </h2>
            <p className="text-xs text-slate-400 font-medium">
              {selectedCategory === 'general'
                ? 'โหมด: คะแนนทั่วไป (ผู้บริหาร 3 คะแนน (+1,+2,+3) / หัวหน้างาน 2 คะแนน (+1,+2) / พนักงาน 1 คะแนน)'
                : selectedCategory === 'popular'
                ? 'โหมด: Popular Vote (ทุกคน 1 คะแนนเท่ากัน)'
                : 'โหมด: สรุปคะแนนสะสมรวมทั้ง 2 หมวด'}
            </p>
          </div>
        </div>

        {/* Category Pills & Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap relative z-10">
          <div className="bg-slate-950/90 p-1 rounded-xl border border-slate-800 flex items-center shadow-inner">
            <button
              onClick={() => setSelectedCategory('general')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === 'general'
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>โหวตทั่วไป</span>
            </button>

            <button
              onClick={() => setSelectedCategory('popular')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === 'popular'
                  ? 'bg-gradient-to-r from-pink-600 to-rose-500 text-white shadow-md shadow-pink-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-300" />
              <span>Popular Vote</span>
            </button>

            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === 'all'
                  ? 'bg-gradient-to-r from-purple-600 to-violet-500 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>รวมทุกหมวด</span>
            </button>
          </div>

          {onRefreshFromSheet && (
            <button
              onClick={onRefreshFromSheet}
              disabled={isSyncingSheet}
              title="ซิงค์ข้อมูลกับ Google Sheets"
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors disabled:opacity-50 cursor-pointer shadow-md"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingSheet ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          )}

          <button
            onClick={onOpenPresentation}
            className="px-3.5 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/25 flex items-center gap-1.5 transition-all cursor-pointer hover:scale-105 active:scale-95"
          >
            <Maximize2 className="w-4 h-4" />
            <span>จอฉายเวที</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Points */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900/90 to-slate-900 border border-indigo-500/30 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-15 text-indigo-400 group-hover:scale-110 transition-transform">
            <Trophy className="w-14 h-14" />
          </div>
          <div className="text-xs font-semibold text-slate-400">
            {selectedCategory === 'general'
              ? 'คะแนนทั่วไปรวม'
              : selectedCategory === 'popular'
              ? 'คะแนน Popular รวม'
              : 'คะแนนสะสมรวม'}
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white mt-1 flex items-baseline gap-1.5">
            {totalPoints}
            <span className="text-xs font-normal text-indigo-400">คะแนน</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 truncate">
            {selectedCategory === 'popular'
              ? 'คนละ 1 คะแนนเท่ากัน'
              : 'ถ่วงน้ำหนักตามตำแหน่ง'}
          </div>
        </div>

        {/* Turnout & Submissions */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-slate-900/90 to-slate-900 border border-emerald-500/30 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-15 text-emerald-400 group-hover:scale-110 transition-transform">
            <Users className="w-14 h-14" />
          </div>
          <div className="text-xs font-semibold text-slate-400">จำนวนการลงคะแนน</div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1 flex items-baseline gap-1.5">
            {totalVotersCount}
            <span className="text-xs font-normal text-slate-400">ครั้ง</span>
          </div>
          <div className="mt-2 w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-400 h-1.5 rounded-full transition-all duration-700 shadow-xs shadow-emerald-400/50"
              style={{ width: `${turnoutPercentage}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>ผู้มีสิทธิ์โหวต</span>
            <span className="font-bold text-emerald-400">{turnoutPercentage}%</span>
          </div>
        </div>

        {/* Executive participation */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/50 via-slate-900/90 to-slate-900 border border-amber-500/40 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-20 text-amber-400 group-hover:scale-110 transition-transform">
            <Crown className="w-14 h-14" />
          </div>
          <div className="text-xs font-bold text-amber-300 flex items-center gap-1">
            ⭐ ผู้บริหาร ({selectedCategory === 'general' ? '3 คะแนน' : '1 คะแนน'})
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-400 mt-1 flex items-baseline gap-1.5">
            {votedExecutives}
            <span className="text-xs font-normal text-amber-200/70">/ {totalEligibleExecutives} ท่าน</span>
          </div>
          <div className="mt-2 text-[11px] text-amber-300/80 truncate">
            {selectedCategory === 'popular'
              ? `คะแนน Popular: ${votedExecutives} คะแนน`
              : `ถ่วงน้ำหนัก: ${votedExecutives * 3} คะแนน`}
          </div>
        </div>

        {/* Supervisor participation */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-950/50 via-slate-900/90 to-slate-900 border border-teal-500/40 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-20 text-teal-400 group-hover:scale-110 transition-transform">
            <Award className="w-14 h-14" />
          </div>
          <div className="text-xs font-bold text-teal-300 flex items-center gap-1">
            🛡️ หัวหน้างาน ({selectedCategory === 'general' ? '2 คะแนน' : '1 คะแนน'})
          </div>
          <div className="text-2xl sm:text-3xl font-black text-teal-400 mt-1 flex items-baseline gap-1.5">
            {votedSupervisors}
            <span className="text-xs font-normal text-teal-200/70">/ {totalEligibleSupervisors} ท่าน</span>
          </div>
          <div className="mt-2 text-[11px] text-teal-300/80 truncate">
            {selectedCategory === 'popular'
              ? `คะแนน Popular: ${votedSupervisors} คะแนน`
              : `ถ่วงน้ำหนัก: ${votedSupervisors * 2} คะแนน`}
          </div>
        </div>

        {/* Staff participation */}
        <div className="col-span-2 lg:col-span-1 p-4 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-slate-900/90 to-slate-900 border border-cyan-500/30 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-15 text-cyan-400 group-hover:scale-110 transition-transform">
            <Users className="w-14 h-14" />
          </div>
          <div className="text-xs font-semibold text-cyan-300">
            👤 พนักงาน (1 คะแนน)
          </div>
          <div className="text-2xl sm:text-3xl font-black text-cyan-400 mt-1 flex items-baseline gap-1.5">
            {votedRegular}
            <span className="text-xs font-normal text-slate-400">/ {totalEligibleRegular} คน</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 truncate">
            มอบแล้ว: <strong className="text-cyan-300">{votedRegular} คะแนน</strong>
          </div>
        </div>
      </div>

      {/* Main Graph & Podium Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Detailed Teams Ranking Graph */}
        <div className="lg:col-span-2 bg-slate-900/80 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3.5 flex-wrap gap-2">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
                <span>อันดับผลคะแนนรายทีม (Team Rankings)</span>
              </h3>
              <p className="text-xs text-slate-400">
                {selectedCategory === 'popular'
                  ? 'คะแนน Popular Vote (ทุกคน 1 คะแนนเท่ากัน)'
                  : 'ทอง: ผู้บริหาร (3 คะแนน) | เขียว: หัวหน้างาน (2 คะแนน) | ฟ้า: พนักงาน (1 คะแนน)'}
              </p>
            </div>

            {selectedCategory !== 'popular' && (
              <div className="hidden sm:flex items-center gap-3 text-xs flex-wrap font-medium">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-amber-500 to-yellow-400 shadow-xs" />
                  ผู้บริหาร (3)
                </span>
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-emerald-500 to-teal-400 shadow-xs" />
                  หัวหน้างาน (2)
                </span>
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-indigo-500 to-cyan-400 shadow-xs" />
                  พนักงาน (1)
                </span>
              </div>
            )}
          </div>

          {/* Graph bars for teams */}
          <div className="space-y-3.5 pt-1">
            {sortedCandidates.map((cand, idx) => {
              const currentVal = metricView === 'score' ? cand.totalScore : cand.voterCount;
              const barPercent = Math.max(Math.round((currentVal / maxVal) * 100), 2);
              const isLeader = idx === 0 && currentVal > 0 && !cand.isNonVotable;
              const isNonVotable = !!cand.isNonVotable;

              const execPercentOfTotal =
                cand.totalScore > 0
                  ? Math.round((cand.executiveScore / cand.totalScore) * 100)
                  : 0;
              const superPercentOfTotal =
                cand.totalScore > 0
                  ? Math.round((cand.supervisorScore / cand.totalScore) * 100)
                  : 0;

              return (
                <div
                  key={cand.id}
                  className={`p-3.5 rounded-2xl border transition-all duration-300 ${
                    isNonVotable
                      ? 'bg-slate-950/20 border-dashed border-slate-800/80 opacity-60'
                      : isLeader
                      ? 'bg-gradient-to-r from-indigo-950/50 via-slate-900 to-slate-900 border-indigo-500/60 shadow-lg shadow-indigo-500/10'
                      : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700/90'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-sm ${
                          isNonVotable
                            ? 'bg-slate-800 text-slate-500'
                            : idx === 0
                            ? 'bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 shadow-amber-500/30'
                            : idx === 1
                            ? 'bg-gradient-to-tr from-slate-200 to-slate-400 text-slate-950'
                            : idx === 2
                            ? 'bg-gradient-to-tr from-amber-700 to-amber-600 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {isNonVotable ? '-' : idx + 1}
                      </span>

                      <div className="truncate">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-800 text-indigo-300 mr-2 border border-slate-700">
                          {cand.code}
                        </span>
                        <span className="text-sm font-bold text-white mr-2">
                          {cand.name}
                        </span>
                        {cand.subtitle && (
                          <span className="text-xs text-slate-400 hidden sm:inline">({cand.subtitle})</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex items-baseline gap-2">
                      {isNonVotable ? (
                        <span className="text-xs px-2.5 py-0.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold">
                          🚫 งดรับโหวต
                        </span>
                      ) : (
                        <>
                          <span className="text-xl font-black text-white">
                            {cand.totalScore}
                          </span>
                          <span className="text-xs text-slate-400">คะแนน</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Multi-layered progress bar */}
                  <div className="w-full bg-slate-900/90 rounded-xl h-4 overflow-hidden p-0.5 border border-slate-800 flex shadow-inner">
                    {isNonVotable ? (
                      <div className="h-full w-full bg-slate-800/40 flex items-center justify-center text-[10px] text-slate-500 font-medium">
                        ไม่เปิดรับการลงคะแนนในทุกหมวด
                      </div>
                    ) : (
                      <div
                        className="h-full rounded-lg transition-all duration-700 ease-out flex overflow-hidden shadow-inner"
                        style={{ width: `${barPercent}%` }}
                      >
                        {selectedCategory === 'popular' ? (
                          <div className="h-full w-full bg-gradient-to-r from-pink-500 to-rose-400 transition-all duration-500" />
                        ) : (
                          <>
                            {cand.executiveScore > 0 && (
                              <div
                                className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500"
                                style={{ width: `${execPercentOfTotal}%` }}
                                title={`คะแนนจากผู้บริหาร: ${cand.executiveScore} คะแนน`}
                              />
                            )}
                            {cand.supervisorScore > 0 && (
                              <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                                style={{ width: `${superPercentOfTotal}%` }}
                                title={`คะแนนจากหัวหน้างาน: ${cand.supervisorScore} คะแนน`}
                              />
                            )}
                            {cand.regularScore > 0 && (
                              <div
                                className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-500"
                                style={{
                                  width: `${Math.max(
                                    0,
                                    100 - execPercentOfTotal - superPercentOfTotal
                                  )}%`,
                                }}
                                title={`คะแนนจากพนักงาน: ${cand.regularScore} คะแนน`}
                              />
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Micro Breakdown info */}
                  {!isNonVotable && (
                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>
                          ผู้โหวต: <strong className="text-slate-200">{cand.voterCount} คน</strong>
                        </span>
                        {cand.executiveVotesCount > 0 && selectedCategory !== 'popular' && (
                          <span className="text-amber-400 font-semibold">
                            (ผู้บริหาร {cand.executiveVotesCount} = {cand.executiveScore} pt)
                          </span>
                        )}
                        {cand.supervisorVotesCount > 0 && selectedCategory !== 'popular' && (
                          <span className="text-emerald-400 font-semibold">
                            (หัวหน้า {cand.supervisorVotesCount} = {cand.supervisorScore} pt)
                          </span>
                        )}
                        {selectedCategory === 'all' && (
                          <span className="text-indigo-300">
                            (ทั่วไป {cand.generalScore} pt / Popular {cand.popularScore} pt)
                          </span>
                        )}
                      </div>

                      <div className="text-indigo-300 font-bold font-mono">
                        {totalPoints > 0
                          ? `${Math.round((cand.totalScore / totalPoints) * 100)}%`
                          : '0%'}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Top 3 Podium & Live Stream */}
        <div className="space-y-6">
          {/* Top 3 Olympic-Style Podium */}
          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>ทีมผู้นำสูงสุด (Top 3 Teams)</span>
              </span>
              <Sparkles className="w-4 h-4 text-yellow-400 animate-spin" />
            </h3>

            <div className="pt-6 pb-2 flex items-end justify-center gap-2 text-center">
              {/* 2nd Place */}
              {top2 && (
                <div className="flex-1 flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-300 flex items-center justify-center text-slate-100 font-black text-xs mb-2 shadow-lg shadow-black/40">
                    🥈 2
                  </div>
                  <div className="text-xs font-bold text-white line-clamp-1 w-full px-1">
                    {top2.code}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate w-full px-1">
                    {top2.name}
                  </div>
                  <div className="text-xs text-slate-200 font-black mb-2 font-mono">
                    {top2.totalScore} คะแนน
                  </div>
                  <div className="w-full h-20 bg-gradient-to-t from-slate-900 to-slate-800 rounded-t-2xl border-t-2 border-slate-400 flex items-center justify-center text-slate-300 font-bold text-xs shadow-inner">
                    อันดับ 2
                  </div>
                </div>
              )}

              {/* 1st Place */}
              {top1 && (
                <div className="flex-1 flex flex-col items-center z-10">
                  <div className="w-13 h-13 rounded-full bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-200 border-2 border-amber-100 flex items-center justify-center text-slate-950 font-black text-sm mb-2 shadow-xl shadow-amber-500/40 ring-4 ring-amber-500/20">
                    🥇 1
                  </div>
                  <div className="text-xs font-black text-amber-300 line-clamp-1 w-full px-1">
                    {top1.code}
                  </div>
                  <div className="text-[11px] text-white truncate w-full px-1 font-bold">
                    {top1.name}
                  </div>
                  <div className="text-sm text-amber-300 font-black mb-2 font-mono">
                    {top1.totalScore} คะแนน
                  </div>
                  <div className="w-full h-28 bg-gradient-to-t from-amber-950/60 via-amber-600/30 to-amber-500/20 rounded-t-2xl border-t-2 border-amber-400 flex items-center justify-center text-amber-300 font-black text-xs shadow-xl shadow-amber-500/10">
                    ผู้นำอันดับ 1
                  </div>
                </div>
              )}

              {/* 3rd Place */}
              {top3 && (
                <div className="flex-1 flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-amber-950 border-2 border-amber-700 flex items-center justify-center text-amber-200 font-black text-xs mb-2 shadow-lg shadow-black/40">
                    🥉 3
                  </div>
                  <div className="text-xs font-bold text-white line-clamp-1 w-full px-1">
                    {top3.code}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate w-full px-1">
                    {top3.name}
                  </div>
                  <div className="text-xs text-slate-300 font-black mb-2 font-mono">
                    {top3.totalScore} คะแนน
                  </div>
                  <div className="w-full h-16 bg-gradient-to-t from-slate-900 to-amber-950/40 rounded-t-2xl border-t-2 border-amber-700 flex items-center justify-center text-amber-600 font-bold text-xs shadow-inner">
                    อันดับ 3
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Live Recent Votes Stream */}
          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-5 shadow-2xl space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span>การลงคะแนนล่าสุด ({selectedCategory === 'popular' ? 'Popular' : 'ทั่วไป'})</span>
              </h3>
              <span className="text-[11px] font-mono text-slate-400">{filteredVotes.length} ครั้ง</span>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {filteredVotes.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  ยังไม่มีการลงคะแนนในหมวดนี้
                </div>
              ) : (
                [...filteredVotes]
                  .reverse()
                  .slice(0, 8)
                  .map((vote) => {
                    const team = candidates.find((c) => c.id === vote.candidateId);
                    return (
                      <div
                        key={vote.id}
                        className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs flex items-center justify-between gap-2 hover:border-slate-700/80 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-white truncate">
                              {vote.employeeName}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                                vote.category === 'popular'
                                  ? 'bg-pink-500/20 text-pink-300'
                                  : vote.isExecutive
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : vote.isSupervisor || vote.weight === 2
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {vote.category === 'popular'
                                ? 'Popular 1 pt'
                                : vote.isExecutive
                                ? `⭐ +${vote.weight} pt`
                                : vote.isSupervisor || vote.weight === 2
                                ? `🛡️ +${vote.weight} pt`
                                : '+1 pt'}
                            </span>
                          </div>
                          <div className="text-[11px] text-indigo-300 mt-0.5 truncate">
                            โหวตให้: <strong>[{team?.code}] {team?.name}</strong>
                          </div>
                        </div>

                        <div className="text-[10px] font-mono text-slate-500 shrink-0 text-right">
                          <Clock className="w-3 h-3 inline mr-0.5" />
                          {vote.timestamp}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
