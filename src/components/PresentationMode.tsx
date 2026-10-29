import React, { useEffect, useState } from 'react';
import { Minimize2, Trophy, Crown, Award, Flame, Layers } from 'lucide-react';
import { Candidate, VoteCategory, VoteRecord } from '../types';

interface PresentationModeProps {
  candidates: Candidate[];
  votes: VoteRecord[];
  totalEligible: number;
  onClose: () => void;
}

export const PresentationMode: React.FC<PresentationModeProps> = ({
  candidates,
  votes,
  totalEligible,
  onClose,
}) => {
  const [currentCategory, setCurrentCategory] = useState<VoteCategory | 'all'>('general');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const activeVotes = currentCategory === 'all'
    ? votes
    : votes.filter((v) => v.category === currentCategory);

  const stats = candidates.map((c) => {
    const teamVotes = activeVotes.filter((v) => v.candidateId === c.id);
    const score = teamVotes.reduce((sum, v) => sum + v.weight, 0);
    const execCount = teamVotes.filter((v) => v.isExecutive).length;
    const execScore = teamVotes.filter((v) => v.isExecutive).reduce((s, v) => s + v.weight, 0);
    const superCount = teamVotes.filter((v) => !v.isExecutive && (v.isSupervisor || v.weight === 2)).length;
    const superScore = teamVotes.filter((v) => !v.isExecutive && (v.isSupervisor || v.weight === 2)).reduce((s, v) => s + v.weight, 0);
    const regCount = teamVotes.filter((v) => !v.isExecutive && !v.isSupervisor && v.weight !== 2).length;
    const regScore = teamVotes.filter((v) => !v.isExecutive && !v.isSupervisor && v.weight !== 2).reduce((s, v) => s + v.weight, 0);
    return {
      ...c,
      score,
      voterCount: teamVotes.length,
      execCount,
      execScore,
      superCount,
      superScore,
      regCount,
      regScore,
    };
  });

  const sorted = [...stats].sort((a, b) => {
    if (a.isNonVotable && !b.isNonVotable) return 1;
    if (!a.isNonVotable && b.isNonVotable) return -1;
    return b.score - a.score;
  });

  const votableSorted = sorted.filter((s) => !s.isNonVotable);
  const maxScore = Math.max(...votableSorted.map((s) => s.score), 1);
  const totalScore = sorted.reduce((sum, s) => sum + s.score, 0);
  const totalVoters = new Set(activeVotes.map((v) => v.employeeId)).size;
  const recentVotes = [...activeVotes].reverse().slice(0, 3);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col p-6 sm:p-8 select-none overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Bar */}
      <div className="relative z-10 flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-pink-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-3">
              LIVE VOTING STAGE — 8 TEAMS
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold flex items-center gap-1.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> สดบนเวที
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              {currentCategory === 'general'
                ? 'โหวตคะแนนทั่วไป: ผู้บริหาร 3 คะแนน / หัวหน้างาน 2 คะแนน / พนักงาน 1 คะแนน'
                : currentCategory === 'popular'
                ? 'Popular Vote: 1 คน 1 เสียง เท่ากันทุกคน'
                : 'สรุปคะแนนรวมทั้ง 2 รางวัล'}
            </p>
          </div>
        </div>

        {/* Category Switcher in Presentation Mode */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-900/90 p-1 rounded-xl border border-slate-800 flex items-center">
            <button
              onClick={() => setCurrentCategory('general')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                currentCategory === 'general'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Award className="w-3.5 h-3.5" /> ทั่วไป
            </button>
            <button
              onClick={() => setCurrentCategory('popular')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                currentCategory === 'popular'
                  ? 'bg-pink-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-300" /> Popular Vote
            </button>
            <button
              onClick={() => setCurrentCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                currentCategory === 'all'
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> ทั้งหมด
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-md"
          >
            <Minimize2 className="w-4 h-4" />
            <span className="hidden sm:inline">ESC ย่อจอ</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 py-6 items-center overflow-hidden">
        {/* Left Col: Leader Spotlight */}
        <div className="lg:col-span-1 flex flex-col justify-center space-y-4">
          <div className="p-5 rounded-3xl bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-900 border-2 border-amber-500/40 shadow-2xl relative overflow-hidden text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-300 text-slate-950 flex items-center justify-center font-black text-xl shadow-xl shadow-amber-500/30 mb-3">
              <Crown className="w-8 h-8 fill-slate-950" />
            </div>

            <div className="text-[11px] font-bold text-amber-400 tracking-wider uppercase mb-1">
              CURRENT LEADER (ทีมนำอันดับ 1)
            </div>
            <div className="font-mono text-xs px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 inline-block mb-1">
              {sorted[0]?.code}
            </div>
            <h2 className="text-xl font-black text-white line-clamp-2">
              {sorted[0]?.name || 'รอผลการโหวต'}
            </h2>
            <div className="text-xs text-indigo-300 font-medium mt-0.5">
              {sorted[0]?.subtitle}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-around">
              <div>
                <div className="text-2xl font-black text-amber-400">
                  {sorted[0]?.score || 0}
                </div>
                <div className="text-[11px] text-slate-400">คะแนนสะสม</div>
              </div>
              <div className="w-px h-8 bg-slate-800" />
              <div>
                <div className="text-2xl font-black text-white">
                  {sorted[0]?.voterCount || 0}
                </div>
                <div className="text-[11px] text-slate-400">คนโหวต</div>
              </div>
            </div>
          </div>

          {/* Quick Recent votes */}
          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-xs space-y-2">
            <div className="font-bold text-slate-400 text-[11px]">การโหวตล่าสุด</div>
            {recentVotes.length === 0 ? (
              <div className="text-slate-500 text-[11px]">รอการลงคะแนน...</div>
            ) : (
              recentVotes.map((v) => (
                <div
                  key={v.id}
                  className="p-1.5 rounded-lg bg-slate-950/70 border border-slate-800/60 flex items-center justify-between text-[11px]"
                >
                  <span className="text-slate-300 truncate max-w-[120px]">{v.employeeName}</span>
                  <span className={v.isExecutive && v.category === 'general' ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                    +{v.weight} pt
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right 3 Cols: Teams Animated Bars */}
        <div className="lg:col-span-3 flex flex-col justify-center space-y-3.5">
          {sorted.map((item, index) => {
            const barWidth = Math.max(Math.round((item.score / maxScore) * 100), 2);
            const isWinner = index === 0 && item.score > 0 && !item.isNonVotable;
            const percentOfTotal = totalScore > 0 ? Math.round((item.score / totalScore) * 100) : 0;
            const isNonVotable = !!item.isNonVotable;

            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-2xl border transition-all duration-500 ${
                  isNonVotable
                    ? 'bg-slate-900/30 border-dashed border-slate-800 opacity-60'
                    : isWinner
                    ? 'bg-indigo-950/40 border-amber-500/60 shadow-xl shadow-indigo-500/20'
                    : 'bg-slate-900/60 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                        isNonVotable
                          ? 'bg-slate-800 text-slate-500'
                          : index === 0
                          ? 'bg-amber-400 text-slate-950'
                          : index === 1
                          ? 'bg-slate-300 text-slate-950'
                          : index === 2
                          ? 'bg-amber-800 text-amber-200'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isNonVotable ? '-' : index + 1}
                    </span>
                    <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded-md bg-slate-800 text-indigo-300">
                      {item.code}
                    </span>
                    <div className="truncate">
                      <span className="text-base sm:text-lg font-bold text-white mr-2">
                        {item.name}
                      </span>
                      {isNonVotable && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold">
                          🚫 งดรับคะแนนโหวต
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex items-baseline gap-2">
                    {isNonVotable ? (
                      <span className="text-xs text-slate-500">ไม่เปิดให้ลงคะแนน</span>
                    ) : (
                      <>
                        <span className="text-xs text-slate-400">({item.voterCount} คน)</span>
                        <span className="text-2xl sm:text-3xl font-black text-white">
                          {item.score}
                        </span>
                        <span className="text-xs font-semibold text-indigo-400">คะแนน</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Big Bar */}
                <div className="w-full bg-slate-950 rounded-xl h-5 p-0.5 border border-slate-800/80 overflow-hidden shadow-inner flex">
                  {isNonVotable ? (
                    <div className="h-full w-full bg-slate-900 flex items-center justify-center text-[10px] text-slate-500">
                      ช่องของ {item.code} {item.name} งดรับการลงคะแนนในทุกกรณี
                    </div>
                  ) : (
                    <div
                      className="h-full rounded-lg transition-all duration-700 ease-out flex overflow-hidden shadow-md"
                      style={{ width: `${barWidth}%` }}
                    >
                      {currentCategory === 'popular' ? (
                        <div className="h-full w-full bg-gradient-to-r from-pink-500 to-rose-400" />
                      ) : (
                        <>
                          {item.execScore > 0 && (
                            <div
                              className="h-full bg-gradient-to-r from-amber-500 to-yellow-400"
                              style={{
                                width: `${item.score > 0 ? (item.execScore / item.score) * 100 : 0}%`,
                              }}
                              title={`ผู้บริหาร: ${item.execScore} คะแนน`}
                            />
                          )}
                          {item.superScore > 0 && (
                            <div
                              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400"
                              style={{
                                width: `${item.score > 0 ? (item.superScore / item.score) * 100 : 0}%`,
                              }}
                              title={`หัวหน้างาน: ${item.superScore} คะแนน`}
                            />
                          )}
                          {item.regScore > 0 && (
                            <div
                              className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400"
                              style={{
                                width: `${item.score > 0 ? (item.regScore / item.score) * 100 : 0}%`,
                              }}
                              title={`พนักงาน: ${item.regScore} คะแนน`}
                            />
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {!isNonVotable && (
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400 flex-wrap gap-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      {item.execScore > 0 && currentCategory !== 'popular' && (
                        <span className="text-amber-400 font-semibold">
                          ⭐ ผู้บริหาร ({item.execScore} pt)
                        </span>
                      )}
                      {item.superScore > 0 && currentCategory !== 'popular' && (
                        <span className="text-emerald-400 font-semibold">
                          🛡️ หัวหน้างาน ({item.superScore} pt)
                        </span>
                      )}
                      {item.regScore > 0 && (
                        <span>พนักงาน ({item.regScore} pt)</span>
                      )}
                    </div>
                    <div className="text-indigo-300 font-bold">{percentOfTotal}% ของคะแนนรวม</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 border-t border-slate-800 pt-3 flex items-center justify-between text-xs text-slate-400 flex-wrap gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-amber-500 to-yellow-400" />
            ผู้บริหาร (3 คะแนน)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-emerald-500 to-teal-400" />
            หัวหน้างาน (2 คะแนน)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-indigo-500 to-cyan-400" />
            พนักงาน (1 คะแนน)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-pink-500 to-rose-400" />
            Popular Vote (1 คะแนน)
          </span>
        </div>

        <div>
          ผู้ลงคะแนนทั้งหมด {totalVoters} / {totalEligible} คน
        </div>
      </div>
    </div>
  );
};
