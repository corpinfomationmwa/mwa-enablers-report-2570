/**
 * MWA Enablers Report 2570 - Configuration
 * การตั้งค่าและ Master Data เฉพาะของ Enablers Report 2570
 * 
 * ข้อตกลงสำคัญ:
 * 1. ระบบนี้แยกจาก MWA Improvement Report อย่างเด็ดขาด
 * 2. ตัวแปร ENABLERS_GAS_API_URL ใช้สำหรับใส่ Web App URL ของ Google Apps Script ใหม่สำหรับ Enablers 2570
 */

export interface EnablersConfig {
  appName: string;
  appTitleTh: string;
  orgName: string;
  fiscalYear: number;
  gasApiUrl: string;
  isGasConfigured: boolean;
}

// Key สำหรับเก็บการตั้งค่า URL ผ่านหน้า UI (เพื่อให้ผู้ใช้ทดสอบเปลี่ยน URL ได้สะดวก)
export const ENABLERS_GAS_STORAGE_KEY = 'mwa_enablers_2570_gas_url';
export const ENABLERS_LOCAL_REPORTS_KEY = 'mwa_enablers_2570_reports_db';

/**
 * ดึงค่า ENABLERS_GAS_API_URL ปัจจุบัน (จาก Environment หรือ Local Override)
 */
export function getEnablersGasApiUrl(): string {
  if (typeof window !== 'undefined') {
    const userOverride = localStorage.getItem(ENABLERS_GAS_STORAGE_KEY);
    if (userOverride && userOverride.trim().length > 0) {
      return userOverride.trim();
    }
  }
  return import.meta.env.VITE_ENABLERS_GAS_API_URL || '';
}

/**
 * บันทึก URL การเชื่อมต่อ GAS ตัวใหม่
 */
export function setEnablersGasApiUrl(newUrl: string): void {
  if (typeof window !== 'undefined') {
    if (!newUrl || newUrl.trim() === '') {
      localStorage.removeItem(ENABLERS_GAS_STORAGE_KEY);
    } else {
      localStorage.setItem(ENABLERS_GAS_STORAGE_KEY, newUrl.trim());
    }
  }
}

/**
 * ตรวจสอบว่า URL ที่ตั้งไว้เป็น URL ของ GAS จริงที่พร้อมยิงหรือไม่
 */
export function isGasEndpointConfigured(url: string = getEnablersGasApiUrl()): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  return (
    trimmed.startsWith('https://script.google.com/macros/s/') &&
    !trimmed.includes('YOUR_ENABLERS_2570_DEPLOYMENT_ID')
  );
}

// Master Data: สายงาน EXACT 5 รายการ
export const MWA_AFFILIATIONS: string[] = [
  'สายงานผู้ว่าการ',
  'สายงานบริหาร',
  'สายงานบริการด้านตะวันออก',
  'สายงานแผนและพัฒนา',
  'สายงานเทคโนโลยีดิจิทัล',
];

// Master Data: Mapping สายงาน -> หน่วยงาน EXACT
export const MWA_AFFILIATION_DEPARTMENT_MAP: Record<string, string[]> = {
  'สายงานผู้ว่าการ': [
    'สำนักตรวจสอบ',
    'ฝ่ายธรรมาภิบาล',
    'ฝ่ายบริหารความรับผิดชอบต่อสังคม',
  ],
  'สายงานบริหาร': [
    'ฝ่ายบริหารทรัพยากรบุคคล',
    'ฝ่ายพัฒนาทรัพยากรบุคคล',
    'ฝ่ายสวัสดิการและกิจการสัมพันธ์',
    'กองความปลอดภัย สวัสดิภาพและอาชีวอนามัย',
  ],
  'สายงานบริการด้านตะวันออก': [
    'ฝ่ายการตลาดและลูกค้าสัมพันธ์',
  ],
  'สายงานแผนและพัฒนา': [
    'ฝ่ายนโยบายและยุทธศาสตร์',
    'ฝ่ายบริหารความเสี่ยง',
  ],
  'สายงานเทคโนโลยีดิจิทัล': [
    'ฝ่ายพัฒนาระบบงานดิจิทัล',
    'ฝ่ายโครงสร้างพื้นฐานเทคโนโลยีดิจิทัล',
    'ฝ่ายยุทธศาสตร์และนวัตกรรมดิจิทัล',
  ],
};

// หน่วยงานทั้งหมด (สำหรับ fallback / ตัวกรองข้อมูล)
export const MWA_DEPARTMENTS: string[] = Array.from(
  new Set(Object.values(MWA_AFFILIATION_DEPARTMENT_MAP).flat())
);

// Master Data: ประเด็นสำคัญ Enablers 8 ด้าน EXACT
export const ENABLERS_EXECUTIVE_TOPICS: string[] = [
  'ด้านที่ 1 การกำกับดูแลที่ดีและการนำองค์กร',
  'ด้านที่ 2 การวางแผนเชิงกลยุทธ์',
  'ด้านที่ 3 การบริหารความเสี่ยงและควบคุมภายใน',
  'ด้านที่ 4 การมุ่งเน้นผู้มีส่วนได้ส่วนเสียและลูกค้า',
  'ด้านที่ 5 การพัฒนาเทคโนโลยีดิจิทัล',
  'ด้านที่ 6 การบริหารทุนมนุษย์',
  'ด้านที่ 7 การจัดการความรู้และนวัตกรรม',
  'ด้านที่ 8 การตรวจสอบภายใน',
];

// Master Data: ช่องทางการสื่อสารของ Enablers
export const COMMUNICATION_CHANNELS: string[] = [
  'การประชุมผู้บริหารระดับสูง / Morning Talk',
  'การประชุมประจำเดือนของฝ่าย/สำนัก',
  'การประชุม Town Hall / ถ่ายทอดนโยบาย',
  'เวทีแลกเปลี่ยนเรียนรู้ (Knowledge Sharing / CoP)',
  'ระบบ MWA Intranet / ข่าวสารองค์กร',
  'Line Official / Line Group ประจำสายงาน',
  'อีเมลเวียน / บันทึกข้อความสื่อสารภายใน',
  'สื่อประชาสัมพันธ์ Infographic / วิดีทัศน์',
  'การตรวจเยี่ยมพื้นที่ / On-site Visit',
];
