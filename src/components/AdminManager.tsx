import React, { useState } from 'react';
import { User } from 'firebase/auth';
import {
  Users,
  Crown,
  Search,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Play,
  FileSpreadsheet,
  Download,
  Lock,
  ShieldCheck,
  Award,
  Flame,
} from 'lucide-react';
import { Candidate, Employee, VoteRecord } from '../types';
import { GoogleSignInButton } from './GoogleSignInButton';
import { ADMIN_EMAILS, isAuthorizedAdmin } from './Header';

interface AdminManagerProps {
  employees: Employee[];
  candidates: Candidate[];
  votes: VoteRecord[];
  onUpdateEmployees: (employees: Employee[]) => void;
  onUpdateCandidates: (candidates: Candidate[]) => void;
  onResetVotes: (category?: 'all' | 'general' | 'popular') => void;
  onSimulateVotes: () => void;
  onOpenSheetModal: () => void;
  sheetTitle?: string;
  currentUser: User | null;
  onSignIn: () => void;
  isLoadingAuth: boolean;
}

export const AdminManager: React.FC<AdminManagerProps> = ({
  employees,
  candidates,
  votes,
  onUpdateEmployees,
  onUpdateCandidates,
  onResetVotes,
  onSimulateVotes,
  onOpenSheetModal,
  sheetTitle,
  currentUser,
  onSignIn,
  isLoadingAuth,
}) => {
  const isAdmin = isAuthorizedAdmin(currentUser?.email);

  const [activeSubTab, setActiveSubTab] = useState<'employees' | 'teams' | 'logs'>('employees');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'executives' | 'supervisors' | 'staff' | 'votedGeneral' | 'votedPopular'>('all');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetTarget, setResetTarget] = useState<'all' | 'general' | 'popular'>('all');

  // Cycle role: Staff (1 pt) -> Supervisor (2 pts) -> Executive (3 pts) -> Staff (1 pt)
  const handleCycleRole = (employeeId: string) => {
    const updated = employees.map((emp) => {
      if (emp.id === employeeId) {
        if (emp.isExecutive) {
          // Executive -> Staff
          return {
            ...emp,
            isExecutive: false,
            isSupervisor: false,
            role: 'staff' as const,
            voteWeight: 1,
            position: emp.position.includes('ผู้บริหาร') ? 'พนักงานทั่วไป (Staff)' : emp.position,
          };
        } else if (emp.isSupervisor || emp.voteWeight === 2) {
          // Supervisor -> Executive
          return {
            ...emp,
            isExecutive: true,
            isSupervisor: false,
            role: 'executive' as const,
            voteWeight: 3,
            position: emp.position.includes('หัวหน้า') ? 'ผู้บริหาร (Executive)' : emp.position,
          };
        } else {
          // Staff -> Supervisor
          return {
            ...emp,
            isExecutive: false,
            isSupervisor: true,
            role: 'supervisor' as const,
            voteWeight: 2,
            position: !emp.position || emp.position.includes('พนักงาน') ? 'หัวหน้างาน (Supervisor)' : emp.position,
          };
        }
      }
      return emp;
    });
    onUpdateEmployees(updated);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['วันเวลา', 'หมวดการโหวต', 'รหัสพนักงาน', 'ชื่อพนักงาน', 'สิทธิ์', 'คะแนน', 'รหัสทีม', 'ชื่อทีม'];
    const rows = votes.map((v) => {
      const cand = candidates.find((c) => c.id === v.candidateId);
      const roleName = v.isExecutive
        ? 'ผู้บริหาร (3 คะแนน)'
        : v.isSupervisor || v.weight === 2
        ? 'หัวหน้างาน (2 คะแนน)'
        : 'พนักงานทั่วไป (1 คะแนน)';
      return [
        `"${v.timestamp}"`,
        `"${v.category === 'general' ? 'โหวตทั่วไป (ถ่วงน้ำหนัก)' : 'Popular Vote'}"`,
        `"${v.employeeId}"`,
        `"${v.employeeName}"`,
        `"${roleName}"`,
        v.weight,
        `"${cand?.code || v.candidateId}"`,
        `"${cand?.name || ''}"`,
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `vote_results_8teams_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // If NOT authorized admin, show security barrier
  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl text-center space-y-5 animate-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
          <Lock className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white">
            เฉพาะผู้ดูแลระบบ (Admin Access Only)
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            ส่วนตั้งค่าและจัดการข้อมูลนี้สงวนสิทธิ์เฉพาะผู้ดูแลระบบที่มีรายชื่ออีเมลที่ได้รับอนุญาต:
          </p>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-indigo-300 space-y-1">
            {ADMIN_EMAILS.map((email) => (
              <div key={email} className="flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>{email}</span>
              </div>
            ))}
          </div>
        </div>

        {currentUser && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
            คุณเข้าสู่ระบบด้วยอีเมล: <strong>{currentUser.email}</strong> ซึ่งยังไม่มีสิทธิ์จัดการข้อมูล
          </div>
        )}

        <div className="pt-2">
          <GoogleSignInButton
            onClick={onSignIn}
            isLoading={isLoadingAuth}
            text="เข้าสู่ระบบด้วยบัญชี Google ผู้ดูแล"
            className="w-full sm:w-auto"
          />
        </div>

        <p className="text-[11px] text-slate-500">
          * พนักงานทุกคนสามารถเข้าใช้งานส่วน "ลงคะแนน" และ "ผลคะแนนสด" ได้โดยไม่ต้องเข้าสู่ระบบ
        </p>
      </div>
    );
  }

  // Filtered employees
  const filteredEmployees = employees.filter((emp) => {
    const q = searchQuery.toLowerCase();
    const matchQuery =
      !q ||
      emp.id.toLowerCase().includes(q) ||
      emp.name.toLowerCase().includes(q) ||
      emp.department.toLowerCase().includes(q) ||
      emp.position.toLowerCase().includes(q);

    if (!matchQuery) return false;

    if (filterRole === 'executives') return emp.isExecutive;
    if (filterRole === 'supervisors') return !emp.isExecutive && (emp.isSupervisor || emp.voteWeight === 2);
    if (filterRole === 'staff') return !emp.isExecutive && !emp.isSupervisor && emp.voteWeight !== 2;
    if (filterRole === 'votedGeneral') return emp.hasVotedGeneral;
    if (filterRole === 'votedPopular') return emp.hasVotedPopular;
    return true;
  });

  const execCount = employees.filter((e) => e.isExecutive).length;
  const superCount = employees.filter((e) => !e.isExecutive && (e.isSupervisor || e.voteWeight === 2)).length;
  const staffCount = employees.filter((e) => !e.isExecutive && !e.isSupervisor && e.voteWeight !== 2).length;

  return (
    <div className="space-y-6">
      {/* Admin Authorization Banner */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-950/40 via-indigo-950/40 to-slate-900 border border-purple-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <span className="text-white font-bold mr-1">สิทธิ์ผู้ดูแลระบบ (Admin Mode):</span>
            <span className="text-indigo-300 font-mono">{currentUser?.email}</span>
          </div>
        </div>
        <div className="text-[11px] text-slate-400">
          คุณสามารถจัดการรายชื่อพนักงาน ผู้บริหาร และการตั้งค่าคะแนนได้เต็มรูปแบบ
        </div>
      </div>

      {/* Sub Tabs Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('employees')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'employees'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            รายชื่อพนักงานและผู้บริหาร ({employees.length})
          </button>

          <button
            onClick={() => setActiveSubTab('teams')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'teams'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Crown className="w-4 h-4" />
            รายชื่อ 8 ทีม ({candidates.length})
          </button>

          <button
            onClick={() => setActiveSubTab('logs')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'logs'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            ประวัติการโหวต ({votes.length})
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onSimulateVotes}
            title="สุ่มจำลองการลงคะแนนอัตโนมัติทั้ง 2 หมวด"
            className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            จำลองโหวตสุ่ม (Demo)
          </button>

          <button
            onClick={handleExportCSV}
            disabled={votes.length === 0}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            ส่งออก CSV
          </button>

          <button
            onClick={() => {
              setResetTarget('all');
              setShowResetConfirm(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            รีเซ็ตคะแนน
          </button>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-white">ต้องการรีเซ็ตผลคะแนนโหวต?</h3>
              <p className="text-xs text-slate-400">
                เลือกล้างคะแนนทั้งหมด หรือเฉพาะหมวดที่ต้องการ
              </p>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-800 cursor-pointer text-xs">
                <input
                  type="radio"
                  name="resetTarget"
                  checked={resetTarget === 'all'}
                  onChange={() => setResetTarget('all')}
                />
                <span className="text-white font-medium">ล้างทั้ง 2 หมวด (ทั่วไป + Popular)</span>
              </label>
              <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-800 cursor-pointer text-xs">
                <input
                  type="radio"
                  name="resetTarget"
                  checked={resetTarget === 'general'}
                  onChange={() => setResetTarget('general')}
                />
                <span className="text-white font-medium">ล้างเฉพาะโหวตคะแนนทั่วไป</span>
              </label>
              <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-800 cursor-pointer text-xs">
                <input
                  type="radio"
                  name="resetTarget"
                  checked={resetTarget === 'popular'}
                  onChange={() => setResetTarget('popular')}
                />
                <span className="text-white font-medium">ล้างเฉพาะ Popular Vote</span>
              </label>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  onResetVotes(resetTarget);
                  setShowResetConfirm(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
              >
                ยืนยันรีเซ็ต
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 1: Employees Directory */}
      {activeSubTab === 'employees' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white">
                  รายชื่อบุคลากรและการกำหนดสิทธิ์ตำแหน่ง
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                  ผู้บริหาร {execCount} ท่าน (3 pt)
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                  หัวหน้างาน {superCount} ท่าน (2 pt)
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-bold">
                  พนักงาน {staffCount} ท่าน (1 pt)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                โหวตคะแนนทั่วไป: ผู้บริหาร 3 คะแนน (+1,+2,+3), หัวหน้างาน 2 คะแนน (+1,+2), พนักงาน 1 คะแนน | Popular Vote: ทุกคน 1 คะแนน
              </p>
            </div>

            <button
              onClick={onOpenSheetModal}
              className="px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              {sheetTitle ? `เชื่อมต่อ: ${sheetTitle}` : 'เชื่อมต่อ Google Sheets'}
            </button>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหารหัส, ชื่อ-นามสกุล, หรือแผนก..."
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setFilterRole('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  filterRole === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                ทั้งหมด ({employees.length})
              </button>
              <button
                onClick={() => setFilterRole('executives')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  filterRole === 'executives'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-amber-300'
                }`}
              >
                ⭐ ผู้บริหาร ({execCount})
              </button>
              <button
                onClick={() => setFilterRole('supervisors')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  filterRole === 'supervisors'
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-emerald-300'
                }`}
              >
                🛡️ หัวหน้างาน ({superCount})
              </button>
              <button
                onClick={() => setFilterRole('staff')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  filterRole === 'staff'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                👤 พนักงาน ({staffCount})
              </button>
              <button
                onClick={() => setFilterRole('votedGeneral')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  filterRole === 'votedGeneral'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-emerald-300'
                }`}
              >
                โหวตทั่วไปแล้ว ({employees.filter((e) => e.hasVotedGeneral).length})
              </button>
              <button
                onClick={() => setFilterRole('votedPopular')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  filterRole === 'votedPopular'
                    ? 'bg-pink-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-pink-300'
                }`}
              >
                โหวต Popular แล้ว ({employees.filter((e) => e.hasVotedPopular).length})
              </button>
            </div>
          </div>

          {/* Employee Table */}
          <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/60">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-3">1. รหัสพนักงาน (ID)</th>
                    <th className="py-3 px-3">2. ชื่อ-นามสกุล (Full Name)</th>
                    <th className="py-3 px-3">3. แผนก (Department)</th>
                    <th className="py-3 px-3">4. ตำแหน่ง (Position)</th>
                    <th className="py-3 px-3 text-center">5. คะแนนโหวตทั่วไป (General Weight)</th>
                    <th className="py-3 px-3 text-center">6. คะแนน Popular Vote</th>
                    <th className="py-3 px-3 text-center">สถานะการโหวต</th>
                    <th className="py-3 px-3 text-right">ปรับสิทธิ์ (Role)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredEmployees.map((emp) => {
                    const isSuper = !emp.isExecutive && (emp.isSupervisor || emp.voteWeight === 2);
                    return (
                      <tr
                        key={emp.id}
                        className={`hover:bg-slate-900/50 transition-colors ${
                          emp.isExecutive
                            ? 'bg-amber-950/15'
                            : isSuper
                            ? 'bg-emerald-950/15'
                            : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-400">
                          {emp.id}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-white">
                          {emp.name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">{emp.department}</td>
                        <td className="py-2.5 px-3 text-slate-400">{emp.position}</td>
                        <td className="py-2.5 px-3 text-center">
                          {emp.isExecutive ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 text-[11px]">
                              <Crown className="w-3 h-3 text-amber-400" />
                              3 คะแนน (ผู้บริหาร)
                            </span>
                          ) : isSuper ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 text-[11px]">
                              <Award className="w-3 h-3 text-emerald-400" />
                              2 คะแนน (หัวหน้างาน)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium text-[11px]">
                              1 คะแนน (พนักงาน)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-300 font-medium text-[11px]">
                            1 คะแนน
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] ${
                                emp.hasVotedGeneral
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-slate-800 text-slate-500'
                              }`}
                            >
                              ทั่วไป {emp.hasVotedGeneral ? '✓' : '✗'}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] ${
                                emp.hasVotedPopular
                                  ? 'bg-pink-500/20 text-pink-300'
                                  : 'bg-slate-800 text-slate-500'
                              }`}
                            >
                              Popular {emp.hasVotedPopular ? '✓' : '✗'}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            onClick={() => handleCycleRole(emp.id)}
                            title="คลิกเพื่อสลับบทบาท: พนักงาน (1) ➔ หัวหน้างาน (2) ➔ ผู้บริหาร (3)"
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                              emp.isExecutive
                                ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30'
                                : isSuper
                                ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                            }`}
                          >
                            {emp.isExecutive
                              ? '👑 ผู้บริหาร ➔ สลับเป็นพนักงาน'
                              : isSuper
                              ? '🛡️ หัวหน้า ➔ สลับเป็นผู้บริหาร'
                              : '👤 พนักงาน ➔ สลับเป็นหัวหน้า'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: The Teams */}
      {activeSubTab === 'teams' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white">
                รายชื่อทีมที่เข้าชิงรางวัล ({candidates.length} ทีม)
              </h3>
              <p className="text-xs text-slate-400">
                ทีม T01 ถึง T08 (โดยช่องของ T08 HR จะไม่มีใครสามารถโหวตได้)
              </p>
            </div>
            <span className="text-xs text-indigo-400 font-mono font-bold">
              {candidates.length} ทีมอย่างเป็นทางการ
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {candidates.map((cand) => (
              <div
                key={cand.id}
                className={`p-4 rounded-xl border flex flex-col justify-between ${
                  cand.isNonVotable
                    ? 'border-dashed border-slate-800 bg-slate-950/40 opacity-70'
                    : 'border-slate-800 bg-slate-950/60'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-sm shadow-md ${
                        cand.isNonVotable ? 'bg-slate-800 text-slate-400' : cand.color
                      }`}
                    >
                      {cand.code}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-bold text-white">{cand.name}</h4>
                        {cand.isNonVotable && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-rose-500/15 text-rose-400 font-bold border border-rose-500/30">
                            งดรับโหวต
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-indigo-300">{cand.subtitle}</div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 mt-2.5 line-clamp-3">
                    {cand.description}
                  </p>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  {cand.isNonVotable ? (
                    <span className="text-slate-500 italic text-[11px]">
                      🚫 ไม่มีใครสามารถโหวตให้ทีมนี้ได้
                    </span>
                  ) : (
                    <>
                      <span className="flex items-center gap-1">
                        <Award className="w-3.5 h-3.5 text-indigo-400" />
                        คะแนนทั่วไป:{' '}
                        <strong className="text-white">
                          {votes.filter((v) => v.candidateId === cand.id && v.category === 'general').reduce((s, v) => s + v.weight, 0)}
                        </strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5 text-pink-400" />
                        Popular:{' '}
                        <strong className="text-white">
                          {votes.filter((v) => v.candidateId === cand.id && v.category === 'popular').length}
                        </strong>
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 3: Live Logs */}
      {activeSubTab === 'logs' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white">
                บันทึกการลงคะแนน (Audit Logs)
              </h3>
              <p className="text-xs text-slate-400">
                ตรวจสอบความถูกต้องของการลงคะแนนทั้ง 2 หมวด
              </p>
            </div>
            <span className="text-xs text-slate-400">ทั้งหมด {votes.length} ครั้ง</span>
          </div>

          <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/60">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">เวลา</th>
                  <th className="py-3 px-4">หมวดการโหวต</th>
                  <th className="py-3 px-4">รหัสพนักงาน</th>
                  <th className="py-3 px-4">ชื่อผู้โหวต</th>
                  <th className="py-3 px-4">ประเภทสิทธิ์</th>
                  <th className="py-3 px-4 text-center">คะแนน</th>
                  <th className="py-3 px-4">ทีมที่โหวต</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {votes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      ยังไม่มีรายการโหวตในระบบ
                    </td>
                  </tr>
                ) : (
                  [...votes].reverse().map((vote) => {
                    const team = candidates.find((c) => c.id === vote.candidateId);
                    return (
                      <tr key={vote.id} className="hover:bg-slate-900/50">
                        <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">
                          {vote.timestamp}
                        </td>
                        <td className="py-2.5 px-4 font-semibold">
                          {vote.category === 'popular' ? (
                            <span className="px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 text-[10px]">
                              Popular Vote
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px]">
                              คะแนนทั่วไป
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold text-indigo-300">
                          {vote.employeeId}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-white">
                          {vote.employeeName}
                        </td>
                        <td className="py-2.5 px-4">
                          {vote.isExecutive ? (
                            <span className="text-amber-400 font-bold">
                              ⭐ ผู้บริหาร
                            </span>
                          ) : (
                            <span className="text-slate-400">พนักงานทั่วไป</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-center font-bold">
                          <span
                            className={
                              vote.category === 'popular'
                                ? 'text-pink-400 font-black'
                                : vote.isExecutive
                                ? 'text-amber-400 font-black'
                                : 'text-cyan-400'
                            }
                          >
                            +{vote.weight}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-indigo-300">
                          [{team?.code}] {team?.name}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
