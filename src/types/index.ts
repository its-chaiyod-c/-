export type VoteCategory = 'general' | 'popular';

export type EmployeeRole = 'executive' | 'supervisor' | 'staff';

export interface Employee {
  id: string; // e.g. A1002, E1001
  name: string; // ชื่อ-นามสกุล
  department: string; // แผนก
  position: string; // ตำแหน่ง (ผู้บริหาร / หัวหน้างาน / พนักงานทั่วไป)
  isExecutive: boolean; // เป็นผู้บริหารหรือไม่ (3 คะแนน)
  isSupervisor?: boolean; // เป็นหัวหน้างานหรือไม่ (2 คะแนน)
  role?: EmployeeRole; // 'executive' | 'supervisor' | 'staff'
  voteWeight: number; // 3 สำหรับผู้บริหาร, 2 สำหรับหัวหน้างาน, 1 สำหรับพนักงานทั่วไป
  hasVotedGeneral?: boolean;
  votedGeneralFor?: string; // สรุปทีมที่โหวต เช่น "T01 (+2), T02 (+1)"
  votedGeneralAt?: string;
  hasVotedPopular?: boolean;
  votedPopularFor?: string; // Team ID
  votedPopularAt?: string;
}

export interface Candidate {
  id: string;
  code: string; // e.g. T01, T02 ... T08
  name: string; // e.g. Sales BikeShop, HR
  subtitle?: string;
  description?: string;
  color: string;
  badgeBg?: string;
  isNonVotable?: boolean; // T08 HR: ไม่สามารถโหวตได้
}

export interface VoteAllocation {
  candidateId: string;
  weight: number; // 1, 2, or 3
}

export interface VoteRecord {
  id: string;
  category: VoteCategory; // 'general' or 'popular'
  employeeId: string;
  employeeName: string;
  employeeDepartment: string;
  candidateId: string; // Team ID (e.g. T01)
  weight: number; // General: 1, 2, or 3. Popular: 1.
  isExecutive: boolean;
  isSupervisor?: boolean;
  timestamp: string;
}

export interface SheetConfig {
  spreadsheetId: string;
  sheetTitle: string;
  range: string;
  url?: string;
  lastSyncedAt?: string;
}
