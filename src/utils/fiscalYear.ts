/**
 * MWA Fiscal Year & Quarter Utility for MWA Enablers Report 2570
 * 
 * กฎปีงบประมาณของการประปานครหลวง (กปน.):
 * - Q1 = ตุลาคม + พฤศจิกายน + ธันวาคม
 * - Q2 = มกราคม + กุมภาพันธ์ + มีนาคม
 * - Q3 = เมษายน + พฤษภาคม + มิถุนายน
 * - Q4 = กรกฎาคม + สิงหาคม + กันยายน
 * 
 * *ห้ามใช้ Calendar Quarter แบบมกราคม-มีนาคมเป็น Q1*
 */

import { FiscalQuarter } from '../types/enablers';

export interface FiscalMonthDefinition {
  monthName: string;
  monthIndex: number; // 0-based calendar month (0 = ม.ค., 9 = ต.ค., etc.)
  quarter: FiscalQuarter;
  quarterLabel: string;
  quarterDescription: string;
  displayYearBE: number; // e.g. 2569 for Oct-Dec, 2570 for Jan-Sep of FY 2570
  fullLabel: string;
}

export const FISCAL_YEAR_TARGET = 2570;

export const FISCAL_QUARTERS_INFO: Record<FiscalQuarter, {
  name: string;
  months: string[];
  description: string;
  calendarPeriod: string;
  color: string;
}> = {
  Q1: {
    name: 'ไตรมาสที่ 1 (Q1)',
    months: ['ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'],
    description: 'ตุลาคม - ธันวาคม 2569 (เริ่มต้นปีงบประมาณ 2570)',
    calendarPeriod: 'ต.ค. - ธ.ค.',
    color: 'emerald',
  },
  Q2: {
    name: 'ไตรมาสที่ 2 (Q2)',
    months: ['มกราคม', 'กุมภาพันธ์', 'มีนาคม'],
    description: 'มกราคม - มีนาคม 2570',
    calendarPeriod: 'ม.ค. - มี.ค.',
    color: 'blue',
  },
  Q3: {
    name: 'ไตรมาสที่ 3 (Q3)',
    months: ['เมษายน', 'พฤษภาคม', 'มิถุนายน'],
    description: 'เมษายน - มิถุนายน 2570',
    calendarPeriod: 'เม.ย. - มิ.ย.',
    color: 'amber',
  },
  Q4: {
    name: 'ไตรมาสที่ 4 (Q4)',
    months: ['กรกฎาคม', 'สิงหาคม', 'กันยายน'],
    description: 'กรกฎาคม - กันยายน 2570 (สิ้นสุดปีงบประมาณ 2570)',
    calendarPeriod: 'ก.ค. - ก.ย.',
    color: 'purple',
  },
};

/**
 * รายการ 12 เดือนในรอบปีงบประมาณ 2570 เรียงตามลำดับดำเนินงานจริง (ต.ค. 2569 ถึง ก.ย. 2570)
 */
export const MWA_FISCAL_MONTHS_2570: FiscalMonthDefinition[] = [
  // Q1
  {
    monthName: 'ตุลาคม',
    monthIndex: 9,
    quarter: 'Q1',
    quarterLabel: 'ไตรมาสที่ 1',
    quarterDescription: 'ต.ค. - ธ.ค.',
    displayYearBE: 2569,
    fullLabel: 'ตุลาคม 2569 (Q1)',
  },
  {
    monthName: 'พฤศจิกายน',
    monthIndex: 10,
    quarter: 'Q1',
    quarterLabel: 'ไตรมาสที่ 1',
    quarterDescription: 'ต.ค. - ธ.ค.',
    displayYearBE: 2569,
    fullLabel: 'พฤศจิกายน 2569 (Q1)',
  },
  {
    monthName: 'ธันวาคม',
    monthIndex: 11,
    quarter: 'Q1',
    quarterLabel: 'ไตรมาสที่ 1',
    quarterDescription: 'ต.ค. - ธ.ค.',
    displayYearBE: 2569,
    fullLabel: 'ธันวาคม 2569 (Q1)',
  },
  // Q2
  {
    monthName: 'มกราคม',
    monthIndex: 0,
    quarter: 'Q2',
    quarterLabel: 'ไตรมาสที่ 2',
    quarterDescription: 'ม.ค. - มี.ค.',
    displayYearBE: 2570,
    fullLabel: 'มกราคม 2570 (Q2)',
  },
  {
    monthName: 'กุมภาพันธ์',
    monthIndex: 1,
    quarter: 'Q2',
    quarterLabel: 'ไตรมาสที่ 2',
    quarterDescription: 'ม.ค. - มี.ค.',
    displayYearBE: 2570,
    fullLabel: 'กุมภาพันธ์ 2570 (Q2)',
  },
  {
    monthName: 'มีนาคม',
    monthIndex: 2,
    quarter: 'Q2',
    quarterLabel: 'ไตรมาสที่ 2',
    quarterDescription: 'ม.ค. - มี.ค.',
    displayYearBE: 2570,
    fullLabel: 'มีนาคม 2570 (Q2)',
  },
  // Q3
  {
    monthName: 'เมษายน',
    monthIndex: 3,
    quarter: 'Q3',
    quarterLabel: 'ไตรมาสที่ 3',
    quarterDescription: 'เม.ย. - มิ.ย.',
    displayYearBE: 2570,
    fullLabel: 'เมษายน 2570 (Q3)',
  },
  {
    monthName: 'พฤษภาคม',
    monthIndex: 4,
    quarter: 'Q3',
    quarterLabel: 'ไตรมาสที่ 3',
    quarterDescription: 'เม.ย. - มิ.ย.',
    displayYearBE: 2570,
    fullLabel: 'พฤษภาคม 2570 (Q3)',
  },
  {
    monthName: 'มิถุนายน',
    monthIndex: 5,
    quarter: 'Q3',
    quarterLabel: 'ไตรมาสที่ 3',
    quarterDescription: 'เม.ย. - มิ.ย.',
    displayYearBE: 2570,
    fullLabel: 'มิถุนายน 2570 (Q3)',
  },
  // Q4
  {
    monthName: 'กรกฎาคม',
    monthIndex: 6,
    quarter: 'Q4',
    quarterLabel: 'ไตรมาสที่ 4',
    quarterDescription: 'ก.ค. - ก.ย.',
    displayYearBE: 2570,
    fullLabel: 'กรกฎาคม 2570 (Q4)',
  },
  {
    monthName: 'สิงหาคม',
    monthIndex: 7,
    quarter: 'Q4',
    quarterLabel: 'ไตรมาสที่ 4',
    quarterDescription: 'ก.ค. - ก.ย.',
    displayYearBE: 2570,
    fullLabel: 'สิงหาคม 2570 (Q4)',
  },
  {
    monthName: 'กันยายน',
    monthIndex: 8,
    quarter: 'Q4',
    quarterLabel: 'ไตรมาสที่ 4',
    quarterDescription: 'ก.ค. - ก.ย.',
    displayYearBE: 2570,
    fullLabel: 'กันยายน 2570 (Q4)',
  },
];

/**
 * คำนวณไตรมาสปีงบประมาณ กปน. จากเลขเดือน (0-11)
 * 0 = ม.ค., 9 = ต.ค., 11 = ธ.ค.
 */
export function getFiscalQuarterFromMonthIndex(monthZeroIndexed: number): FiscalQuarter {
  if (monthZeroIndexed >= 9 && monthZeroIndexed <= 11) {
    return 'Q1'; // ต.ค., พ.ย., ธ.ค.
  } else if (monthZeroIndexed >= 0 && monthZeroIndexed <= 2) {
    return 'Q2'; // ม.ค., ก.พ., มี.ค.
  } else if (monthZeroIndexed >= 3 && monthZeroIndexed <= 5) {
    return 'Q3'; // เม.ย., พ.ค., มิ.ย.
  } else {
    return 'Q4'; // ก.ค., ส.ค., ก.ย.
  }
}

/**
 * คำนวณไตรมาสปีงบประมาณ กปน. จากชื่อเดือนภาษาไทย
 */
export function getFiscalQuarterFromMonthName(monthName: string): FiscalQuarter {
  const trimmed = monthName.trim();
  if (trimmed.includes('ตุลาคม') || trimmed.includes('พฤศจิกายน') || trimmed.includes('ธันวาคม') || trimmed.includes('ต.ค.') || trimmed.includes('พ.ย.') || trimmed.includes('ธ.ค.')) {
    return 'Q1';
  }
  if (trimmed.includes('มกราคม') || trimmed.includes('กุมภาพันธ์') || trimmed.includes('มีนาคม') || trimmed.includes('ม.ค.') || trimmed.includes('ก.พ.') || trimmed.includes('มี.ค.')) {
    return 'Q2';
  }
  if (trimmed.includes('เมษายน') || trimmed.includes('พฤษภาคม') || trimmed.includes('มิถุนายน') || trimmed.includes('เม.ย.') || trimmed.includes('พ.ค.') || trimmed.includes('มิ.ย.')) {
    return 'Q3';
  }
  return 'Q4'; // กรกฎาคม, สิงหาคม, กันยายน
}

/**
 * คำนวณปีงบประมาณ พ.ศ. จาก Date object
 * ตัวอย่าง: 15 ต.ค. 2026 (ค.ศ. 2026 + 543 = 2569) => ปีงบประมาณ 2570
 */
export function getMwaFiscalYear(date: Date = new Date()): number {
  const month = date.getMonth(); // 0-11
  const yearBE = date.getFullYear() + 543;
  return month >= 9 ? yearBE + 1 : yearBE;
}

/**
 * คำนวณไตรมาสปีงบประมาณจาก Date object
 */
export function getMwaFiscalQuarterFromDate(date: Date = new Date()): FiscalQuarter {
  return getFiscalQuarterFromMonthIndex(date.getMonth());
}

/**
 * จัดรูปแบบวันที่เป็นภาษาไทยที่เป็นทางการ
 */
export function formatThaiDate(dateInput: string | Date | undefined): string {
  if (!dateInput) return '-';
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);

    const thaiMonths = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];
    const day = d.getDate();
    const month = thaiMonths[d.getMonth()];
    const yearBE = d.getFullYear() + 543;
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return `${day} ${month} ${yearBE} ${hours}:${minutes} น.`;
  } catch {
    return String(dateInput);
  }
}

/**
 * จัดรูปแบบเดือนให้แสดง "เดือน + ปี พ.ศ." ตามปีงบประมาณ 2570
 * ตัวอย่าง:
 * - "ตุลาคม" -> "ตุลาคม 2569"
 * - "พฤศจิกายน" -> "พฤศจิกายน 2569"
 * - "ธันวาคม" -> "ธันวาคม 2569"
 * - "มกราคม" -> "มกราคม 2570"
 * - "กันยายน" -> "กันยายน 2570"
 * - หากมีปี พ.ศ. 4 หลักอยู่แล้ว เช่น "ตุลาคม 2569" ให้คงค่านั้นไว้
 */
export function formatFiscalMonthWithYear(rawMonth?: string, fiscalYear: number | string = FISCAL_YEAR_TARGET): string {
  if (!rawMonth) return '-';
  const trimmed = rawMonth.trim();
  // ถ้ามีปี พ.ศ. 4 หลักอยู่แล้ว เช่น "ตุลาคม 2569" หรือ "มกราคม 2570" ให้ใช้ค่านั้นเลย
  if (/\b(25\d{2})\b/.test(trimmed)) {
    return trimmed;
  }

  const fyNum = typeof fiscalYear === 'number' ? fiscalYear : (parseInt(String(fiscalYear), 10) || FISCAL_YEAR_TARGET);
  const prevYear = fyNum - 1; // 2569 สำหรับ ต.ค. - ธ.ค.
  const currYear = fyNum;     // 2570 สำหรับ ม.ค. - ก.ย.

  if (trimmed.includes('ตุลาคม') || trimmed.includes('ต.ค.')) return `ตุลาคม ${prevYear}`;
  if (trimmed.includes('พฤศจิกายน') || trimmed.includes('พ.ย.')) return `พฤศจิกายน ${prevYear}`;
  if (trimmed.includes('ธันวาคม') || trimmed.includes('ธ.ค.')) return `ธันวาคม ${prevYear}`;
  if (trimmed.includes('มกราคม') || trimmed.includes('ม.ค.')) return `มกราคม ${currYear}`;
  if (trimmed.includes('กุมภาพันธ์') || trimmed.includes('ก.พ.')) return `กุมภาพันธ์ ${currYear}`;
  if (trimmed.includes('มีนาคม') || trimmed.includes('มี.ค.')) return `มีนาคม ${currYear}`;
  if (trimmed.includes('เมษายน') || trimmed.includes('เม.ย.')) return `เมษายน ${currYear}`;
  if (trimmed.includes('พฤษภาคม') || trimmed.includes('พ.ค.')) return `พฤษภาคม ${currYear}`;
  if (trimmed.includes('มิถุนายน') || trimmed.includes('มิ.ย.')) return `มิถุนายน ${currYear}`;
  if (trimmed.includes('กรกฎาคม') || trimmed.includes('ก.ค.')) return `กรกฎาคม ${currYear}`;
  if (trimmed.includes('สิงหาคม') || trimmed.includes('ส.ค.')) return `สิงหาคม ${currYear}`;
  if (trimmed.includes('กันยายน') || trimmed.includes('ก.ย.')) return `กันยายน ${currYear}`;

  return trimmed;
}

