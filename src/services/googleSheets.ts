import { Candidate, Employee, VoteRecord } from '../types';
import { getAccessToken } from './firebase';

export interface SpreadsheetMeta {
  id: string;
  title: string;
  sheets: { id: number; title: string }[];
}

export const extractSpreadsheetId = (input: string): string => {
  if (!input) return '';
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
};

// The 8 official teams requested by user
export const INITIAL_TEAMS: Candidate[] = [
  {
    id: 'T01',
    code: 'T01',
    name: 'Accounting and Finance',
    subtitle: 'ฝ่ายบัญชีและการเงิน',
    description: 'ทีมผู้เชี่ยวชาญด้านการเงิน บัญชี และการวางแผนต้นทุนองค์กร',
    color: 'bg-emerald-600',
    badgeBg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  },
  {
    id: 'T02',
    code: 'T02',
    name: 'Marketing & Graphic Design',
    subtitle: 'ฝ่ายการตลาดและออกแบบสร้างสรรค์',
    description: 'ทีมสร้างสรรค์สื่อ แคมเปญการตลาดดิจิทัล และภาพลักษณ์แบรนด์',
    color: 'bg-pink-600',
    badgeBg: 'bg-pink-500/10 text-pink-300 border-pink-500/30',
  },
  {
    id: 'T03',
    code: 'T03',
    name: 'Procurement Specialist',
    subtitle: 'ฝ่ายจัดซื้อและจัดหาพัสดุ',
    description: 'ทีมจัดซื้อเชิงกลยุทธ์ คัดสรรสินค้าและบริหารจัดการคู่ค้าคุณภาพสูง',
    color: 'bg-amber-600',
    badgeBg: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  },
  {
    id: 'T04',
    code: 'T04',
    name: 'Warehouse and logistics',
    subtitle: 'ฝ่ายคลังสินค้าและการขนส่ง',
    description: 'ทีมบริหารจัดการคลังสินค้า สต็อกสินค้า และระบบกระจายสินค้าแม่นยำ',
    color: 'bg-blue-600',
    badgeBg: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  },
  {
    id: 'T05',
    code: 'T05',
    name: 'Sales Online',
    subtitle: 'ฝ่ายขายช่องทางออนไลน์',
    description: 'ทีมขับเคลื่อนยอดขายผ่าน E-commerce, Social Media และช่องทางออนไลน์',
    color: 'bg-violet-600',
    badgeBg: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
  },
  {
    id: 'T06',
    code: 'T06',
    name: 'Sales Shop IBS',
    subtitle: 'ฝ่ายขายหน้าร้าน Shop IBS',
    description: 'ทีมบริการและส่งมอบประสบการณ์การซื้อสินค้าหน้าร้าน IBS อย่างมืออาชีพ',
    color: 'bg-orange-600',
    badgeBg: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
  },
  {
    id: 'T07',
    code: 'T07',
    name: 'Sales BikeShop',
    subtitle: 'ฝ่ายขายและบริการ BikeShop',
    description: 'ทีมผู้เชี่ยวชาญด้านจักรยาน อุปกรณ์กีฬา และการดูแลบริการลูกค้า BikeShop',
    color: 'bg-teal-600',
    badgeBg: 'bg-teal-500/10 text-teal-300 border-teal-500/30',
  },
  {
    id: 'T08',
    code: 'T08',
    name: 'HR',
    subtitle: 'ฝ่ายทรัพยากรบุคคล (งดรับคะแนนโหวต)',
    description: 'ฝ่ายทรัพยากรบุคคล — งดรับการลงคะแนนโหวตในทุกกรณี',
    color: 'bg-slate-700',
    badgeBg: 'bg-slate-600/30 text-slate-400 border-slate-600/50',
    isNonVotable: true,
  },
];

// Default high quality Thai corporate demo employee list (3 executives having 3 points, supervisors 2 points, staff 1 point)
export const DEFAULT_EMPLOYEES: Employee[] = [
  { id: 'A1002', name: 'สุภาพร บางม่วง', department: 'Accounting and Finance', position: 'หัวหน้างาน (Supervisor)', isExecutive: false, isSupervisor: true, role: 'supervisor', voteWeight: 2 },
  { id: 'A2001', name: 'ชัยวัฒน์ เอมอิ่ม', department: 'Accounting and Finance', position: 'พนักงานทั่วไป (Staff)', isExecutive: false, isSupervisor: false, role: 'staff', voteWeight: 1 },
  { id: 'A2003', name: 'ชรัญฏา โตรุ่ง', department: 'Accounting and Finance', position: 'พนักงานทั่วไป (Staff)', isExecutive: false, isSupervisor: false, role: 'staff', voteWeight: 1 },
  { id: 'E1001', name: 'วิรุฬห์ สุพรรณวัฒนชัย', department: 'P2V Group Co.,LTD', position: 'ผู้บริหาร (Executive)', isExecutive: true, isSupervisor: false, role: 'executive', voteWeight: 3 },
  { id: 'E1004', name: 'ธนนท์ มณีมาส', department: 'P2V Group Co.,LTD', position: 'ผู้บริหาร (Executive)', isExecutive: true, isSupervisor: false, role: 'executive', voteWeight: 3 },
  { id: 'E1005', name: 'ศิริพงศ์ จงวิวัฒน์สุนทร', department: 'P2V Group Co.,LTD', position: 'ผู้บริหาร (Executive)', isExecutive: true, isSupervisor: false, role: 'executive', voteWeight: 3 },
  { id: 'M2003', name: 'โกสินทร์ ประเสริฐศรี', department: 'Marketing & Graphic Design', position: 'หัวหน้างาน (Supervisor)', isExecutive: false, isSupervisor: true, role: 'supervisor', voteWeight: 2 },
  { id: 'M2009', name: 'ภัทธิดา แสงมณี', department: 'Marketing & Graphic Design', position: 'พนักงานทั่วไป (Staff)', isExecutive: false, isSupervisor: false, role: 'staff', voteWeight: 1 },
  { id: 'M2011', name: 'สิทธิผล ใจหาญ', department: 'Marketing & Graphic Design', position: 'พนักงานทั่วไป (Staff)', isExecutive: false, isSupervisor: false, role: 'staff', voteWeight: 1 },
  { id: 'M2012', name: 'ธารทิพย์ โชติบูรณ์', department: 'Marketing & Graphic Design', position: 'พนักงานทั่วไป (Staff)', isExecutive: false, isSupervisor: false, role: 'staff', voteWeight: 1 },
  { id: 'S3014', name: 'เสาวรจน์ นุ่มเตี้ย', department: 'Marketing & Graphic Design', position: 'พนักงานทั่วไป (Staff)', isExecutive: false, isSupervisor: false, role: 'staff', voteWeight: 1 },
  { id: 'P2001', name: 'ขวัญวลี กิจพายัพ', department: 'Procurement Specialist', position: 'หัวหน้างาน (Supervisor)', isExecutive: false, isSupervisor: true, role: 'supervisor', voteWeight: 2 },
  { id: 'P2004', name: 'จิรชาโรจน์ ธนาชัยกฤติวงษ์', department: 'Procurement Specialist', position: 'พนักงานทั่วไป (Staff)', isExecutive: false, isSupervisor: false, role: 'staff', voteWeight: 1 },
  { id: 'S2002', name: 'อนุพันธ์ กิตติวัฒนานันท์', department: 'Sales', position: 'พนักงานทั่วไป (Staff)', isExecutive: false, isSupervisor: false, role: 'staff', voteWeight: 1 },
  { id: 'S2003', name: 'ชัชวิน ศิวะโกเศศ', department: 'Sales', position: 'พนักงานทั่วไป (Staff)', isExecutive: false, isSupervisor: false, role: 'staff', voteWeight: 1 },
  { id: 'S2004', name: 'ชินพันธ์ สุวรรณวัฒน์', department: 'Sales', position: 'พนักงานทั่วไป (Staff)', isExecutive: false, isSupervisor: false, role: 'staff', voteWeight: 1 },
  { id: 'A2002', name: 'สุพัชชา โชติวรรณพฤกษ์', department: 'Sales Online', position: 'พนักงานทั่วไป (Staff)', isExecutive: false, isSupervisor: false, role: 'staff', voteWeight: 1 },
  { id: 'S3003', name: 'ศุภาพิชญ์ เมฆอากาศ', department: 'Sales Online', position: 'พนักงานทั่วไป (Staff)', isExecutive: false, isSupervisor: false, role: 'staff', voteWeight: 1 },
  { id: 'S3006', name: 'จรีพร พาเหมาะ', department: 'Sales Online', position: 'พนักงานทั่วไป (Staff)', isExecutive: false, isSupervisor: false, role: 'staff', voteWeight: 1 },
  { id: 'S3013', name: 'วราญาดา มีปะทัง', department: 'Sales Online', position: 'พนักงานทั่วไป (Staff)', isExecutive: false, isSupervisor: false, role: 'staff', voteWeight: 1 },
  { id: 'S3018', name: 'ธีรพล ศรีมุกดา', department: 'Sales Online', position: 'พนักงานทั่วไป (Staff)', isExecutive: false, isSupervisor: false, role: 'staff', voteWeight: 1 },
  { id: 'S3021', name: 'สิทธิกร เหมือนชอบ', department: 'Sales Online', position: 'พนักงานทั่วไป (Staff)', isExecutive: false, isSupervisor: false, role: 'staff', voteWeight: 1 },
  { id: 'S3019', name: 'ชัยยศ ชื่นกำเหนิด', department: 'Sales Shop IBS', position: 'หัวหน้างาน (Supervisor)', isExecutive: false, isSupervisor: true, role: 'supervisor', voteWeight: 2 },
  { id: 'S4003', name: 'สุรพัฒน์ โพธิ์ทอง', department: 'Sales Shop IBS', position: 'พนักงานทั่วไป (Staff)', isExecutive: false, isSupervisor: false, role: 'staff', voteWeight: 1 },
  { id: 'M2001', name: 'ณัฐภัทร วงษาเนาว์', department: 'Sales Shop IBS', position: 'พนักงานทั่วไป (Staff)', isExecutive: false, isSupervisor: false, role: 'staff', voteWeight: 1 },
  { id: 'W1001', name: 'ชุลีพร แนบกระโทก', department: 'Human Resources', position: 'หัวหน้างาน (Supervisor)', isExecutive: false, isSupervisor: true, role: 'supervisor', voteWeight: 2 },
  { id: 'W2001', name: 'พัฒนา ศรีโยธา', department: 'Warehouse and logistics', position: 'หัวหน้างาน (Supervisor)', isExecutive: false, isSupervisor: true, role: 'supervisor', voteWeight: 2 },
  { id: 'W2003', name: 'สิทธิพร เทียมตะขบ', department: 'Warehouse and logistics', position: 'พนักงานทั่วไป (Staff)', isExecutive: false, isSupervisor: false, role: 'staff', voteWeight: 1 },
  { id: 'W2004', name: 'ธนวัฒน์ ประทุม', department: 'Warehouse and logistics', position: 'พนักงานทั่วไป (Staff)', isExecutive: false, isSupervisor: false, role: 'staff', voteWeight: 1 },
  { id: 'W2005', name: 'สิทธิพงศ์ ทองแดง', department: 'Warehouse and logistics', position: 'พนักงานทั่วไป (Staff)', isExecutive: false, isSupervisor: false, role: 'staff', voteWeight: 1 },
  { id: 'W2006', name: 'กฤษฎา คำภู', department: 'Warehouse and logistics', position: 'พนักงานทั่วไป (Staff)', isExecutive: false, isSupervisor: false, role: 'staff', voteWeight: 1 },
  { id: 'W2009', name: 'ตุลยากร พรพุทธิชัย', department: 'Warehouse and logistics', position: 'พนักงานทั่วไป (Staff)', isExecutive: false, isSupervisor: false, role: 'staff', voteWeight: 1 },
  { id: 'W2011', name: 'ณัฐวุฒิ ศัพทานนท์', department: 'Warehouse and logistics', position: 'พนักงานทั่วไป (Staff)', isExecutive: false, isSupervisor: false, role: 'staff', voteWeight: 1 },
];

/**
 * Fetch metadata for a Google Sheet (tabs, title)
 */
export const getSpreadsheetMetadata = async (
  spreadsheetId: string
): Promise<SpreadsheetMeta> => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('กรุณาลงชื่อเข้าใช้ด้วย Google ก่อนเชื่อมต่อ Google Sheets');
  }

  const cleanId = extractSpreadsheetId(spreadsheetId);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}?fields=spreadsheetId,properties.title,sheets.properties`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message =
      errorData?.error?.message ||
      `ไม่สามารถเข้าถึง Google Sheets ได้ (Status: ${response.status})`;
    throw new Error(message);
  }

  const data = await response.json();
  const sheets = (data.sheets || []).map((s: { properties: { sheetId: number; title: string } }) => ({
    id: s.properties.sheetId,
    title: s.properties.title,
  }));

  return {
    id: data.spreadsheetId,
    title: data.properties?.title || 'Google Sheet',
    sheets,
  };
};

/**
 * Fetch and parse employee list from Google Sheet tab
 */
export const fetchEmployeesFromSheet = async (
  spreadsheetId: string,
  tabTitle: string
): Promise<Employee[]> => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('กรุณาลงชื่อเข้าใช้ด้วย Google ก่อน');
  }

  const cleanId = extractSpreadsheetId(spreadsheetId);
  const range = `'${tabTitle}'!A1:Z1000`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(
    range
  )}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err?.error?.message || `เกิดข้อผิดพลาดในการอ่านข้อมูลแถว (Status ${res.status})`
    );
  }

  const json = await res.json();
  const rows: string[][] = json.values || [];

  if (rows.length < 2) {
    throw new Error('ไม่พบข้อมูลพนักงานในแผ่นงานนี้ (ต้องการอย่างน้อยหัวตารางและข้อมูล 1 แถว)');
  }

  const header = rows[0].map((h) => (h || '').trim().toLowerCase());

  // 1. Look for ID column (must contain 'id' or 'รหัส')
  let idCol = header.findIndex(
    (col) =>
      col.includes('รหัส') ||
      col.includes('id') ||
      col.includes('emp') ||
      col.includes('code')
  );

  // 2. Look for Name column (must contain 'ชื่อ' or 'name', and NEVER match 'รหัส' or 'id')
  let nameCol = header.findIndex(
    (col) =>
      !col.includes('รหัส') &&
      !col.includes('id') &&
      (col.includes('ชื่อ') || col.includes('name') || col.includes('full name'))
  );

  // 3. Look for Department (แผนก)
  let deptCol = header.findIndex(
    (col) =>
      col.includes('แผนก') ||
      col.includes('department') ||
      col.includes('dept') ||
      col.includes('สังกัด') ||
      col.includes('ฝ่าย')
  );

  // 4. Look for Position (ตำแหน่ง)
  let posCol = header.findIndex(
    (col) =>
      col.includes('ตำแหน่ง') ||
      col.includes('position') ||
      col.includes('role') ||
      col.includes('หน้าที่')
  );

  // 5. General Weight (คะแนนโหวตทั่วไป)
  let weightCol = header.findIndex(
    (col) =>
      col.includes('ทั่วไป') ||
      col.includes('general') ||
      (col.includes('คะแนน') && !col.includes('popular')) ||
      (col.includes('weight') && !col.includes('popular'))
  );

  // 6. Executive role column (if present)
  let execCol = header.findIndex(
    (col) =>
      col.includes('ผู้บริหาร') ||
      col.includes('executive') ||
      col.includes('exec') ||
      col.includes('ceo')
  );

  // Fallback defaults for standard 6-column sheet: [ID, Name, Department, Position, Weight, Popular]
  if (idCol === -1) idCol = 0;
  if (nameCol === -1 || nameCol === idCol) nameCol = idCol === 0 ? 1 : 0;
  if (deptCol === -1 && header.length > 2) deptCol = 2;
  if (posCol === -1 && header.length > 3) posCol = 3;
  if (weightCol === -1 && header.length > 4) weightCol = 4;

  const parsed: Employee[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const id = idCol !== -1 && row[idCol] ? row[idCol].trim() : `EMP-${String(i).padStart(3, '0')}`;
    const name = nameCol !== -1 && row[nameCol] ? row[nameCol].trim() : `พนักงานท่านที่ ${i}`;
    const department = deptCol !== -1 && row[deptCol] ? row[deptCol].trim() : 'ทั่วไป';
    const position = posCol !== -1 && row[posCol] ? row[posCol].trim() : 'พนักงาน';

    let isExec = false;
    let isSuper = false;
    let weight = 1;

    if (weightCol !== -1 && row[weightCol]) {
      const val = parseInt(row[weightCol], 10);
      if (!isNaN(val)) {
        if (val >= 3) {
          isExec = true;
          weight = 3;
        } else if (val === 2) {
          isSuper = true;
          weight = 2;
        } else {
          weight = 1;
        }
      }
    }

    if (!isExec && execCol !== -1 && row[execCol]) {
      const v = row[execCol].toLowerCase();
      if (v.includes('ผู้บริหาร') || v.includes('executive') || v.includes('ceo') || v === '3') {
        isExec = true;
        weight = 3;
      } else if (v.includes('หัวหน้า') || v.includes('supervisor') || v === '2') {
        isSuper = true;
        weight = 2;
      }
    }

    const posLower = `${position} ${department}`.toLowerCase();
    if (!isExec && !isSuper) {
      const execKeywords = ['ceo', 'cto', 'coo', 'cfo', 'managing director', 'กรรมการผู้จัดการ', 'ประธานเจ้าหน้าที่', 'executive', 'ผู้บริหารระดับสูง'];
      if (execKeywords.some((k) => posLower.includes(k)) || position.includes('ผู้บริหาร')) {
        isExec = true;
        weight = 3;
      } else if (
        posLower.includes('หัวหน้างาน') ||
        posLower.includes('หัวหน้า') ||
        posLower.includes('supervisor') ||
        posLower.includes('team lead')
      ) {
        isSuper = true;
        weight = 2;
      }
    }

    let displayPos = position;
    if (isExec && (!displayPos || displayPos === 'พนักงาน')) displayPos = 'ผู้บริหาร (Executive)';
    if (isSuper && (!displayPos || displayPos === 'พนักงาน')) displayPos = 'หัวหน้างาน (Supervisor)';
    if (!isExec && !isSuper && !displayPos) displayPos = 'พนักงานทั่วไป (Staff)';

    parsed.push({
      id,
      name,
      department,
      position: displayPos,
      isExecutive: isExec,
      isSupervisor: isSuper,
      role: isExec ? 'executive' : isSuper ? 'supervisor' : 'staff',
      voteWeight: isExec ? 3 : isSuper ? 2 : 1,
    });
  }

  // Ensure 3 executives designated if none marked
  const currentExecCount = parsed.filter((e) => e.isExecutive).length;
  if (currentExecCount === 0 && parsed.length >= 3) {
    for (let k = 0; k < 3; k++) {
      parsed[k].isExecutive = true;
      parsed[k].voteWeight = 3;
    }
  }

  return parsed;
};

/**
 * Creates a complete sample Google Spreadsheet in the user's Google Drive
 */
export const createSampleGoogleSheet = async (): Promise<{
  id: string;
  url: string;
  title: string;
}> => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('กรุณาลงชื่อเข้าใช้ด้วย Google ก่อนสร้างไฟล์ Sheet');
  }

  const title = `ระบบโหวตคะแนน - Employee & Popular Voting (${new Date().toLocaleDateString('th-TH')})`;

  const payload = {
    properties: {
      title,
    },
    sheets: [
      {
        properties: {
          title: 'Employees_พนักงาน',
          gridProperties: {
            frozenRowCount: 1,
          },
        },
        data: [
          {
            startRow: 0,
            startColumn: 0,
            rowData: [
              {
                values: [
                  { userEnteredValue: { stringValue: 'รหัสพนักงาน (ID)' } },
                  { userEnteredValue: { stringValue: 'ชื่อ-นามสกุล (Full Name)' } },
                  { userEnteredValue: { stringValue: 'แผนก (Department)' } },
                  { userEnteredValue: { stringValue: 'ตำแหน่ง (Position)' } },
                  { userEnteredValue: { stringValue: 'คะแนนโหวตทั่วไป (General Weight)' } },
                  { userEnteredValue: { stringValue: 'คะแนน Popular Vote' } },
                ],
              },
              ...DEFAULT_EMPLOYEES.map((emp) => ({
                values: [
                  { userEnteredValue: { stringValue: emp.id } },
                  { userEnteredValue: { stringValue: emp.name } },
                  { userEnteredValue: { stringValue: emp.department } },
                  { userEnteredValue: { stringValue: emp.position } },
                  { userEnteredValue: { numberValue: emp.voteWeight } },
                  { userEnteredValue: { numberValue: 1 } },
                ],
              })),
            ],
          },
        ],
      },
      {
        properties: {
          title: 'Teams_รายชื่อทีม',
          gridProperties: {
            frozenRowCount: 1,
          },
        },
        data: [
          {
            startRow: 0,
            startColumn: 0,
            rowData: [
              {
                values: [
                  { userEnteredValue: { stringValue: 'รหัสทีม (Code)' } },
                  { userEnteredValue: { stringValue: 'ชื่อทีม (Team Name)' } },
                  { userEnteredValue: { stringValue: 'คำอธิบาย (Description)' } },
                ],
              },
              ...INITIAL_TEAMS.map((team) => ({
                values: [
                  { userEnteredValue: { stringValue: team.code } },
                  { userEnteredValue: { stringValue: team.name } },
                  { userEnteredValue: { stringValue: team.description || '' } },
                ],
              })),
            ],
          },
        ],
      },
      {
        properties: {
          title: 'Vote_Logs_ประวัติการโหวต',
          gridProperties: {
            frozenRowCount: 1,
          },
        },
        data: [
          {
            startRow: 0,
            startColumn: 0,
            rowData: [
              {
                values: [
                  { userEnteredValue: { stringValue: 'วัน-เวลาที่โหวต (Timestamp)' } },
                  { userEnteredValue: { stringValue: 'ประเภทการโหวต (Category)' } },
                  { userEnteredValue: { stringValue: 'รหัสพนักงาน (Employee ID)' } },
                  { userEnteredValue: { stringValue: 'ชื่อพนักงาน (Name)' } },
                  { userEnteredValue: { stringValue: 'ประเภทสิทธิ์ (Voter Type)' } },
                  { userEnteredValue: { stringValue: 'คะแนนที่มอบให้ (Weight)' } },
                  { userEnteredValue: { stringValue: 'ทีมที่โหวต (Team Voted)' } },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err?.error?.message || `ไม่สามารถสร้าง Google Sheets ได้ (${res.status})`
    );
  }

  const result = await res.json();
  const id = result.spreadsheetId;
  const url = `https://docs.google.com/spreadsheets/d/${id}/edit`;

  return {
    id,
    url,
    title,
  };
};

/**
 * Append vote record to Google Sheet
 */
export const appendVoteRecordToSheet = async (
  spreadsheetId: string,
  record: VoteRecord,
  candidateName: string
): Promise<boolean> => {
  const token = await getAccessToken();
  if (!token || !spreadsheetId) return false;

  const cleanId = extractSpreadsheetId(spreadsheetId);
  const categoryLabel = record.category === 'general' ? 'โหวตทั่วไป (ถ่วงน้ำหนัก)' : 'Popular Vote (1 คะแนน)';
  const rowValues = [
    record.timestamp,
    categoryLabel,
    record.employeeId,
    record.employeeName,
    record.isExecutive ? '⭐ ผู้บริหาร (Executive)' : '👤 พนักงานทั่วไป',
    record.weight,
    candidateName,
  ];

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/'Vote_Logs_ประวัติการโหวต'!A:G:append?valueInputOption=USER_ENTERED`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [rowValues],
      }),
    });

    return res.ok;
  } catch (err) {
    console.warn('Failed to append vote to Google Sheet', err);
    return false;
  }
};
