import { Candidate } from '../types';

/**
 * Checks whether an employee's department matches a candidate team.
 * Rule: Employees are NOT permitted to vote for a team belonging to their own department.
 */
export const isSameDepartment = (
  empDepartment?: string | null,
  candidate?: Candidate | null
): boolean => {
  if (!empDepartment || !candidate) return false;

  const emp = empDepartment.trim().toLowerCase();
  const candName = candidate.name.trim().toLowerCase();
  const candCode = candidate.code.trim().toLowerCase();

  // Executives / Board of Directors belonging to corporate group (e.g. 'P2V Group Co.,LTD')
  // do not belong to the competing division teams, so they can vote across all teams.
  if (
    emp.includes('p2v') ||
    emp.includes('group') ||
    emp.includes('executive') ||
    emp.includes('ผู้บริหาร')
  ) {
    return false;
  }

  // Exact name or code match
  if (emp === candName || emp === candCode) return true;

  // Normalized matching (replacing & with and, removing spaces & symbols)
  const normEmp = emp.replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
  const normCandName = candName.replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
  const normCandCode = candCode.replace(/[^a-z0-9]/g, '');

  if (normEmp === normCandName || normEmp === normCandCode) return true;

  // Substring inclusion
  if (normEmp.length >= 4 && normCandName.includes(normEmp)) return true;
  if (normCandName.length >= 4 && normEmp.includes(normCandName)) return true;

  // Keyword-based mapping for Thai and English variations
  if (emp.includes('account') || emp.includes('บัญชี') || emp.includes('finance')) {
    if (candCode === 't01' || normCandName.includes('accounting')) return true;
  }
  if (emp.includes('market') || emp.includes('graphic') || emp.includes('ตลาด')) {
    if (candCode === 't02' || normCandName.includes('marketing')) return true;
  }
  if (emp.includes('procure') || emp.includes('จัดซื้อ') || emp.includes('จัดหา')) {
    if (candCode === 't03' || normCandName.includes('procurement')) return true;
  }
  if (
    emp.includes('warehouse') ||
    emp.includes('logistic') ||
    emp.includes('คลัง') ||
    emp.includes('ขนส่ง')
  ) {
    if (candCode === 't04' || normCandName.includes('warehouse')) return true;
  }
  if (emp.includes('online') || emp.includes('ออนไลน์')) {
    if (candCode === 't05' || normCandName.includes('online')) return true;
  }
  if (
    emp.includes('ibs') ||
    (emp.includes('shop') && !emp.includes('bike')) ||
    emp.includes('หน้าร้าน')
  ) {
    if (candCode === 't06' || normCandName.includes('ibs')) return true;
  }
  if (emp.includes('bike') || emp.includes('จักรยาน')) {
    if (candCode === 't07' || normCandName.includes('bikeshop')) return true;
  }
  if (emp.includes('hr') || emp.includes('human') || emp.includes('บุคคล')) {
    if (candCode === 't08' || normCandName.includes('hr')) return true;
  }

  return false;
};
