/**
 * MWA Enablers Report 2570 - ID Generator Utility
 * 
 * รูปแบบ ID เฉพาะของ Enablers Report 2570:
 * ENB-2570-xxxxxxxx (ตัวเลข/อักษร 8 หลัก เช่น ENB-2570-A7F92B1C)
 * 
 * *ห้ามใช้ ID Pattern ของ Improvement Report โดยเด็ดขาด*
 */

export const ENABLERS_ID_PREFIX = 'ENB-2570-';

/**
 * สร้าง Unique ID ตามข้อกำหนดของ Enablers Report 2570
 * รูปแบบ: ENB-2570-xxxxxxxx (8 หลัก สุ่มตัวอักษรใหญ่และตัวเลข)
 */
export function generateEnablersReportId(): string {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let randomSegment = '';
  
  // สร้าง 8 ตัวอักษรที่ไม่ซ้ำซ้อน
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : null;
  if (cryptoObj && cryptoObj.getRandomValues) {
    const randomBytes = new Uint8Array(8);
    cryptoObj.getRandomValues(randomBytes);
    for (let i = 0; i < 8; i++) {
      randomSegment += chars[randomBytes[i] % chars.length];
    }
  } else {
    for (let i = 0; i < 8; i++) {
      randomSegment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }

  return `${ENABLERS_ID_PREFIX}${randomSegment}`;
}

/**
 * ตรวจสอบความถูกต้องของ ID สำหรับ Enablers Report 2570
 */
export function isValidEnablersId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  // รูปแบบ ENB-2570- ตามด้วยตัวอักษร 6-12 หลัก
  const regex = /^ENB-2570-[A-Za-z0-9]{6,12}$/;
  return regex.test(id.trim());
}
