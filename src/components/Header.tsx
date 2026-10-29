import React from 'react';
import { User } from 'firebase/auth';
import {
  Vote,
  BarChart3,
  Lock,
  ShieldCheck,
  LogIn,
  LogOut,
  Radio,
  FileSpreadsheet,
  Volume2,
  VolumeX,
  Maximize2,
  CloudCheck,
  CloudAlert,
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
  firebaseConnected?: boolean;
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
  firebaseConnected = true,
}) => {
  const isAdmin = isAuthorizedAdmin(currentUser?.email);

  const handleAdminTabClick = () => {
    sound.playSelect();
    if (!isAdmin) {
      if (!currentUser) {
        onSignIn();
      } else {
        alert(
          `อีเมล ${currentUser.email} ไม่มีสิทธิ์เข้าถึงส่วนจัดการข้อมูล\n(สงวนสิทธิ์เฉพาะผู้ดูแลระบบ: ${ADMIN_EMAILS.join(', ')})`
        );
      }
      return;
    }
    onChangeTab('admin');
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-xl border-b border-slate-800/80 shadow-2xl shadow-black/40 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-3">
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-3.5">
            <div className="relative group cursor-pointer" onClick={() => onChangeTab('vote')}>
              <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl blur-xs opacity-75 group-hover:opacity-100 transition duration-300"></div>
              <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-900 border border-slate-700/50 flex items-center justify-center text-white shadow-xl">
                <Vote className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400 group-hover:scale-110 transition-transform" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                  <span className="bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                    ระบบโหวตคะแนน
                  </span>
                </h1>

                {/* Firebase Real-time Status Badge */}
                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border backdrop-blur-xs transition-all ${
                    firebaseConnected
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-xs shadow-emerald-500/10'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}
                  title={firebaseConnected ? 'เชื่อมต่อ Firebase Firestore เรียลไทม์สมบูรณ์' : 'กำลังเชื่อมต่อ Firebase'}
                >
                  <span className="relative flex h-2 w-2">
                    {firebaseConnected && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    )}
                    <span
                      className={`relative inline-flex rounded-full h-2 w-2 ${
                        firebaseConnected ? 'bg-emerald-400' : 'bg-amber-400'
                      }`}
                    ></span>
                  </span>
                  <span className="hidden sm:inline font-mono font-medium">Firebase Live</span>
                </div>
              </div>

              <p className="text-[11px] sm:text-xs text-slate-400 font-medium hidden sm:flex items-center gap-2">
                <span>คะแนนทั่วไป: ผู้บริหาร 3 / หัวหน้างาน 2 / พนักงาน 1</span>
                <span className="text-slate-600">•</span>
                <span className="text-pink-400 font-semibold">Popular Vote คนละ 1 คะแนน</span>
              </p>
            </div>
          </div>

          {/* Navigation Pill Switcher */}
          <nav className="flex items-center bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800/90 shadow-inner shadow-black/60">
            <button
              onClick={() => {
                sound.playSelect();
                onChangeTab('vote');
              }}
              className={`px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'vote'
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/30 ring-1 ring-indigo-400/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Vote className="w-4 h-4" />
              <span>ลงคะแนน</span>
            </button>

            <button
              onClick={() => {
                sound.playSelect();
                onChangeTab('dashboard');
              }}
              className={`px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30 ring-1 ring-purple-400/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>ผลคะแนนสด</span>
            </button>

            <button
              onClick={handleAdminTabClick}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-600/30 ring-1 ring-pink-400/30'
                  : isAdmin
                  ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
                  : 'text-slate-500 hover:text-slate-400 hover:bg-slate-800/40'
              }`}
            >
              {isAdmin ? (
                <ShieldCheck className="w-4 h-4 text-amber-400 animate-pulse" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span className="hidden sm:inline">จัดการข้อมูล</span>
              {!isAdmin && <span className="text-[10px] text-slate-500 hidden md:inline">(Admin)</span>}
            </button>
          </nav>

          {/* Quick Action Tools & Admin User Status */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Google Sheets Modal trigger (if Admin) */}
            {isAdmin && (
              <button
                onClick={onOpenSheetModal}
                className={`px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  sheetConnected
                    ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-xs shadow-emerald-500/10'
                    : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border-slate-800'
                }`}
                title={sheetTitle ? `Google Sheets: ${sheetTitle}` : 'เชื่อมต่อ Google Sheets'}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden xl:inline truncate max-w-[120px]">
                  {sheetConnected ? (sheetTitle || 'ชีตพร้อมใช้งาน') : 'เชื่อมต่อ Sheets'}
                </span>
              </button>
            )}

            {/* Stage Presentation Mode */}
            <button
              onClick={onOpenPresentation}
              title="เปิดมุมมองจอฉายเวที (Projector / Stage View)"
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer hover:scale-105 active:scale-95"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>จอใหญ่</span>
            </button>

            {/* Sound Mute/Unmute */}
            <button
              onClick={onToggleSound}
              title={soundEnabled ? 'ปิดเสียงเอฟเฟกต์ (Mute)' : 'เปิดเสียงเอฟเฟกต์ (Unmute)'}
              className="p-2 sm:p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-indigo-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-500" />
              )}
            </button>

            {/* Admin Profile & Authentication */}
            {currentUser ? (
              <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl pl-2.5 pr-1.5 py-1 shadow-inner">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || ''}
                    className="w-6 h-6 rounded-full border border-indigo-500/50 object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-[10px] font-black text-white">
                    {currentUser.displayName?.[0] || currentUser.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                {isAdmin ? (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 hidden sm:inline">
                    ADMIN
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-300 font-medium hidden sm:inline truncate max-w-[100px]">
                    {currentUser.email}
                  </span>
                )}
                <button
                  onClick={onSignOut}
                  title="ออกจากระบบ"
                  className="p-1 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={onSignIn}
                disabled={isLoadingAuth}
                className="px-3 sm:px-3.5 py-1.5 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-slate-200 hover:text-white border border-slate-700/60 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-md hover:shadow-indigo-500/10"
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
