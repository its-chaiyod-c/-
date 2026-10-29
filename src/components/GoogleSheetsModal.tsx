import React, { useState } from 'react';
import { User } from 'firebase/auth';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Sparkles,
  RefreshCw,
  LogOut,
  X,
  ShieldCheck,
} from 'lucide-react';
import { GoogleSignInButton } from './GoogleSignInButton';
import {
  createSampleGoogleSheet,
  fetchEmployeesFromSheet,
  getSpreadsheetMetadata,
  SpreadsheetMeta,
} from '../services/googleSheets';
import { Employee, SheetConfig } from '../types';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  sheetConfig: SheetConfig | null;
  onSaveConfig: (config: SheetConfig, employees: Employee[]) => void;
  isLoadingAuth: boolean;
  onLoadEmployees: (employees: Employee[]) => void;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSignIn,
  onSignOut,
  sheetConfig,
  onSaveConfig,
  isLoadingAuth,
  onLoadEmployees,
}) => {
  const [sheetInput, setSheetInput] = useState(sheetConfig?.url || sheetConfig?.spreadsheetId || '');
  const [meta, setMeta] = useState<SpreadsheetMeta | null>(null);
  const [selectedTab, setSelectedTab] = useState(sheetConfig?.sheetTitle || '');
  const [loading, setLoading] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [previewEmployees, setPreviewEmployees] = useState<Employee[] | null>(null);

  if (!isOpen) return null;

  const handleFetchMetadata = async () => {
    if (!sheetInput.trim()) {
      setError('กรุณาระบุ URL หรือ Spreadsheet ID');
      return;
    }
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const data = await getSpreadsheetMetadata(sheetInput);
      setMeta(data);
      if (data.sheets.length > 0) {
        const defaultTab =
          data.sheets.find(
            (s) =>
              s.title.toLowerCase().includes('emp') ||
              s.title.includes('พนักงาน') ||
              s.title.includes('รายชื่อ')
          )?.title || data.sheets[0].title;
        setSelectedTab(defaultTab);

        // Auto load preview
        const emps = await fetchEmployeesFromSheet(data.id, defaultTab);
        setPreviewEmployees(emps);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดชีต';
      setError(msg);
      setMeta(null);
      setPreviewEmployees(null);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = async (tabName: string) => {
    setSelectedTab(tabName);
    if (!meta) return;
    setLoading(true);
    setError(null);
    try {
      const emps = await fetchEmployeesFromSheet(meta.id, tabName);
      setPreviewEmployees(emps);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ไม่สามารถอ่านแผ่นงานนี้ได้';
      setError(msg);
      setPreviewEmployees(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    setError(null);
    setSuccessMsg(null);
    setCreatingTemplate(true);
    try {
      const res = await createSampleGoogleSheet();
      setSheetInput(res.url);
      setSuccessMsg(`สร้าง Google Sheet สำเร็จแล้ว: "${res.title}"`);

      const metadata = await getSpreadsheetMetadata(res.id);
      setMeta(metadata);
      setSelectedTab('Employees_พนักงาน');

      const emps = await fetchEmployeesFromSheet(res.id, 'Employees_พนักงาน');
      setPreviewEmployees(emps);

      // Auto save
      onSaveConfig(
        {
          spreadsheetId: res.id,
          sheetTitle: 'Employees_พนักงาน',
          range: 'A1:Z1000',
          url: res.url,
          lastSyncedAt: new Date().toLocaleTimeString('th-TH'),
        },
        emps
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ไม่สามารถสร้างชีตตัวอย่างได้';
      setError(msg);
    } finally {
      setCreatingTemplate(false);
    }
  };

  const handleApply = () => {
    if (!meta || !selectedTab || !previewEmployees) {
      setError('กรุณาเลือกชีตและตรวจสอบข้อมูลก่อนบันทึก');
      return;
    }

    onSaveConfig(
      {
        spreadsheetId: meta.id,
        sheetTitle: selectedTab,
        range: 'A1:Z1000',
        url: sheetInput.includes('http')
          ? sheetInput
          : `https://docs.google.com/spreadsheets/d/${meta.id}/edit`,
        lastSyncedAt: new Date().toLocaleTimeString('th-TH'),
      },
      previewEmployees
    );
    onLoadEmployees(previewEmployees);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl text-slate-100 flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                เชื่อมต่อ Google Sheets
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                  Workspace
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                ดึงรหัสพนักงาน ตรวจสอบชื่อ และกำหนดสิทธิ์คะแนน 1 / 3 คะแนนอัตโนมัติ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 flex-1">
          {/* User Auth Status */}
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {currentUser ? (
                <>
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.displayName || ''}
                      className="w-10 h-10 rounded-full border border-emerald-500/50"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white">
                      {currentUser.displayName?.[0] || 'U'}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">
                        {currentUser.displayName || 'Google User'}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 flex items-center gap-1 font-medium">
                        <ShieldCheck className="w-3 h-3" /> เชื่อมต่อแล้ว
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">{currentUser.email}</span>
                  </div>
                </>
              ) : (
                <div>
                  <div className="text-sm font-semibold text-white">ยังไม่ได้เชื่อมต่อ Google</div>
                  <div className="text-xs text-slate-400">
                    เข้าสู่ระบบเพื่อเข้าถึง Google Sheets ขององค์กรคุณ
                  </div>
                </div>
              )}
            </div>

            <div>
              {currentUser ? (
                <button
                  onClick={onSignOut}
                  className="px-3 py-1.5 text-xs text-rose-300 hover:text-rose-200 hover:bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" /> ออกจากระบบ
                </button>
              ) : (
                <GoogleSignInButton onClick={onSignIn} isLoading={isLoadingAuth} />
              )}
            </div>
          </div>

          {/* Quick Create Sample Sheet Card */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-slate-800 border border-emerald-500/30 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-10">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  ยังไม่มี Google Sheets ที่มีข้อมูลพนักงาน?
                </div>
                <p className="text-xs text-slate-300 max-w-md">
                  สร้างชีตตัวอย่างพร้อมรายชื่อพนักงาน 12 ท่าน มีผู้บริหาร 3 คน (สิทธิ์ 3 คะแนน)
                  และพนักงานทั่วไป (1 คะแนน) พร้อมแผ่นงานบันทึกประวัติการโหวตลง Drive ของคุณใน 1 คลิก!
                </p>
              </div>

              <button
                onClick={handleCreateTemplate}
                disabled={creatingTemplate || !currentUser}
                className="whitespace-nowrap px-4 py-2 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-semibold text-xs rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-500/20 cursor-pointer"
              >
                {creatingTemplate ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> กำลังสร้างชีต...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" /> สร้างชีตตัวอย่างอัตโนมัติ
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Existing Sheet Input Form */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-300">
              หรือระบุ Google Sheets URL / Spreadsheet ID:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={sheetInput}
                onChange={(e) => setSheetInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XR.../edit หรือ ID"
                disabled={!currentUser}
                className="flex-1 px-3.5 py-2.5 rounded-lg bg-slate-950/70 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50"
              />
              <button
                onClick={handleFetchMetadata}
                disabled={loading || !sheetInput.trim() || !currentUser}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium text-xs rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'ดึงข้อมูลชีต'}
              </button>
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Sheet Preview & Tab Selection */}
          {meta && (
            <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    {meta.title}
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${meta.id}/edit`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> เปิดชีต
                    </a>
                  </div>
                  <div className="text-xs text-slate-400">ID: {meta.id}</div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-300">เลือกแผ่นงาน (Tab):</span>
                  <select
                    value={selectedTab}
                    onChange={(e) => handleTabChange(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-600 text-xs text-white focus:outline-hidden"
                  >
                    {meta.sheets.map((s) => (
                      <option key={s.id} value={s.title}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Employees summary badge */}
              {previewEmployees && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-700/50 text-center">
                      <div className="text-xs text-slate-400">พนักงานทั้งหมด</div>
                      <div className="text-lg font-bold text-white">
                        {previewEmployees.length} คน
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-center">
                      <div className="text-xs text-amber-300 font-medium">⭐ ผู้บริหาร (3 คะแนน)</div>
                      <div className="text-lg font-bold text-amber-400">
                        {previewEmployees.filter((e) => e.isExecutive).length} คน
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-center">
                      <div className="text-xs text-cyan-300 font-medium">👤 พนักงานทั่วไป (1 คะแนน)</div>
                      <div className="text-lg font-bold text-cyan-400">
                        {previewEmployees.filter((e) => !e.isExecutive).length} คน
                      </div>
                    </div>
                  </div>

                  {/* Sample table preview */}
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-700/80 bg-slate-950/50">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 sticky top-0 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-2 px-3">1. รหัสพนักงาน (ID)</th>
                          <th className="py-2 px-3">2. ชื่อ-นามสกุล (Full Name)</th>
                          <th className="py-2 px-3">3. แผนก (Department)</th>
                          <th className="py-2 px-3">4. ตำแหน่ง (Position)</th>
                          <th className="py-2 px-3 text-center">5. คะแนนโหวตทั่วไป (General Weight)</th>
                          <th className="py-2 px-3 text-center">6. คะแนน Popular Vote</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {previewEmployees.slice(0, 8).map((emp) => (
                          <tr key={emp.id} className="hover:bg-slate-900/40">
                            <td className="py-1.5 px-3 font-mono font-medium text-indigo-300">
                              {emp.id}
                            </td>
                            <td className="py-1.5 px-3 font-medium text-slate-200">
                              {emp.name}
                            </td>
                            <td className="py-1.5 px-3 text-slate-400">{emp.department}</td>
                            <td className="py-1.5 px-3 text-slate-400">{emp.position}</td>
                            <td className="py-1.5 px-3 text-center">
                              {emp.isExecutive ? (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                                  ⭐ 3 คะแนน
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-medium">
                                  1 คะแนน
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 px-3 text-center">
                              <span className="px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-300 font-medium">
                                1 คะแนน
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {previewEmployees.length > 8 && (
                    <div className="text-center text-[11px] text-slate-400">
                      แสดง 8 คนแรกจากทั้งหมด {previewEmployees.length} คน
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>

          <button
            onClick={handleApply}
            disabled={!previewEmployees || previewEmployees.length === 0}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-xs rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-600/30 flex items-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" /> ใช้งานข้อมูลนี้ในระบบโหวต
          </button>
        </div>
      </div>
    </div>
  );
};
