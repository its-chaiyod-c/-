import React from 'react';
import { User } from 'firebase/auth';
import {
  Vote,
  BarChart3,
  Settings,
  FileSpreadsheet,
  Volume2,
  VolumeX,
  Maximize2,
  Lock,
  ShieldCheck,
  LogIn,
  LogOut,
} from 'lucide-react';
import { sound } from '../utils/audio';

export const ADMIN_EMAILS = [
  'chuleeporn180231@gmail.com',
  'its.chaiyod.c@gmail.com',
];

export const isAuthorizedAdmin = (userEmail?: string | null): boolean => {
  if (!userEmail) return false;
  return ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(userEmail.toLowerCase());
};

interface HeaderProps {
  activeTab: 'vote' | 'dashboard' | 'admin';
  onChangeTab: (tab: 'vote' | 'dashboard' | 'admin') => void;
  onOpenSheetModal: () => void;
  onOpenPresentation: () => void;
  sheetConnected: boolean;
  sheetTitle?: string;
  soundEnabled: boolean;
  onToggleSound: () => void;
  currentUser: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
  isLoadingAuth: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onChangeTab,
  onOpenSheetModal,
  onOpenPresentation,
  sheetConnected,
  sheetTitle,
  soundEnabled,
  onToggleSound,
  currentUser,
  onSignIn,
  onSignOut,
  isLoadingAuth,
}) => {
  const isAdmin = isAuthorizedAdmin(currentUser?.email);

  const handleAdminTabClick = () => {
    sound.playSelect();
    if (!isAdmin) {
      if (!currentUser) {
        // Prompt login
        onSignIn();
      } else {
        alert(
          `อีเมล ${currentUser.email} ไม่มีสิทธิ์เข้าถึงส่วนจัดการข้อมูล\n(สงวนสิทธิ์เฉพาะ: ${ADMIN_EMAILS.join(', ')})`
        );
      }
      return;
    }
    onChangeTab('admin');
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20 shrink-0">
              <Vote className="w-5 h-5 text-white" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black text-white tracking-tight flex items-center gap-2">
                  ระบบโหวตคะแนน
                </h1>
                <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                โหวตคะแนนทั่วไป (ผู้บริหาร 3 / หัวหน้างาน 2 / พนักงาน 1) & Popular Vote (คนละ 1 คะแนน)
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => {
                sound.playSelect();
                onChangeTab('vote');
              }}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'vote'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Vote className="w-3.5 h-3.5" />
              <span>ลงคะแนน</span>
            </button>

            <button
              onClick={() => {
                sound.playSelect();
                onChangeTab('dashboard');
              }}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>ผลคะแนนสด</span>
            </button>

            {/* Admin Tab (Requires Admin login) */}
            <button
              onClick={handleAdminTabClick}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : isAdmin
                  ? 'text-amber-300 hover:text-amber-200'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {isAdmin ? (
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span className="hidden sm:inline">จัดการข้อมูล</span>
              {!isAdmin && <span className="text-[10px] text-slate-500 hidden md:inline">(Admin)</span>}
            </button>
          </nav>

          {/* Action Tools & Admin Login */}
          <div className="flex items-center gap-2">
            {/* Google Sheets button (only if admin or connected) */}
            {isAdmin && (
              <button
                onClick={onOpenSheetModal}
                className={`px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  sheetConnected
                    ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden lg:inline">
                  {sheetConnected ? (sheetTitle ? `ชีต: ${sheetTitle}` : 'เชื่อมต่อแล้ว') : 'Google Sheets'}
                </span>
              </button>
            )}

            {/* Sound Toggle */}
            <button
              onClick={onToggleSound}
              title={soundEnabled ? 'ปิดเสียงเอฟเฟกต์' : 'เปิดเสียงเอฟเฟกต์'}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-indigo-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-500" />
              )}
            </button>

            {/* Presentation Stage Mode */}
            <button
              onClick={onOpenPresentation}
              title="เปิดมุมมองจอภาพใหญ่ (Projector / Stage)"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>จอใหญ่</span>
            </button>

            {/* Admin User Account Section */}
            {currentUser ? (
              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl pl-2 pr-1 py-1">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || ''}
                    className="w-6 h-6 rounded-full border border-indigo-500/40"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white">
                    {currentUser.displayName?.[0] || 'U'}
                  </div>
                )}
                {isAdmin ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 hidden sm:inline">
                    Admin
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 hidden sm:inline truncate max-w-[80px]">
                    {currentUser.email}
                  </span>
                )}
                <button
                  onClick={onSignOut}
                  title="ออกจากระบบ"
                  className="p-1 text-slate-400 hover:text-rose-300 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={onSignIn}
                disabled={isLoadingAuth}
                className="px-2.5 sm:px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline">เข้าสู่ระบบ Admin</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
