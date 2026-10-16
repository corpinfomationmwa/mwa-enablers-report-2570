import { AttachedEvidenceFile } from '../types/enablers';

/**
 * MWA Enablers Report 2570 - Current PDF Store
 * 
 * หน้าที่:
 * เก็บรักษาสถานะ PDF Blob และ AttachedEvidenceFile ตัวจริง (รวม dataUrl/base64) ล่าสุด
 * เพื่อให้:
 * 1. PDF Viewer บนหน้าเว็บ
 * 2. การดาวน์โหลดไฟล์ PDF
 * 3. คำสั่งพิมพ์ / Browser Print
 * 4. ไฟล์แนบในอีเมลยืนยัน
 * 5. การแสดงตัวอย่างภาพ/ไฟล์ในหน้าต่าง Preview (EvidenceFilePreview)
 * ทั้งหมดใช้เอกสารและข้อมูลไฟล์จริงชุดเดียวกันอย่างแม่นยำ ไม่สูญหายระหว่างการแปลง
 */

class CurrentPdfStore {
  private pdfCache = new Map<string, Blob>();
  private evidenceFilesCache = new Map<string, AttachedEvidenceFile[]>();
  private allEvidenceFilesMap = new Map<string, AttachedEvidenceFile>();
  private latestRecordId: string | null = null;

  setCurrentPdfBlob(recordId: string, blob: Blob): void {
    if (!recordId || !blob) return;
    this.pdfCache.set(recordId, blob);
    this.latestRecordId = recordId;
  }

  getCurrentPdfBlob(recordId?: string): Blob | null {
    const targetId = recordId || this.latestRecordId;
    if (!targetId) return null;
    return this.pdfCache.get(targetId) || null;
  }

  hasPdfBlob(recordId: string): boolean {
    return this.pdfCache.has(recordId);
  }

  /**
   * บันทึกรายการไฟล์หลักฐานตัวจริง (รวม dataUrl / base64) ของรายงาน
   */
  setEvidenceFiles(recordId: string, files: AttachedEvidenceFile[]): void {
    if (!recordId || !Array.isArray(files)) return;
    this.evidenceFilesCache.set(recordId, files);
    this.cacheEvidenceFiles(files);
  }

  /**
   * แคชไฟล์หลักฐานลงใน global lookup map (ค้นหาได้ทั้งจาก ID และชื่อไฟล์)
   */
  cacheEvidenceFiles(files: AttachedEvidenceFile[]): void {
    if (!Array.isArray(files)) return;
    files.forEach(f => {
      if (f.id) this.allEvidenceFilesMap.set(f.id, f);
      if (f.name) this.allEvidenceFilesMap.set(f.name, f);
    });
  }

  /**
   * ดึงไฟล์หลักฐานตัวจริงของรายงานตาม record ID
   */
  getEvidenceFiles(recordId?: string): AttachedEvidenceFile[] {
    const targetId = recordId || this.latestRecordId;
    if (!targetId) return [];
    return this.evidenceFilesCache.get(targetId) || [];
  }

  /**
   * ค้นหาไฟล์หลักฐานตัวจริงตาม ID หรือชื่อไฟล์
   */
  findEvidenceFile(idOrName?: string): AttachedEvidenceFile | undefined {
    if (!idOrName) return undefined;
    return this.allEvidenceFilesMap.get(idOrName);
  }

  clear(recordId?: string): void {
    if (recordId) {
      this.pdfCache.delete(recordId);
      this.evidenceFilesCache.delete(recordId);
      if (this.latestRecordId === recordId) {
        this.latestRecordId = null;
      }
    } else {
      this.pdfCache.clear();
      this.evidenceFilesCache.clear();
      this.allEvidenceFilesMap.clear();
      this.latestRecordId = null;
    }
  }
}

export const currentPdfStore = new CurrentPdfStore();

