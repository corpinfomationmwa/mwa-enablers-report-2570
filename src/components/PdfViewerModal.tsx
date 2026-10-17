import React, { useState } from 'react';
import {
  X,
  Printer,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  FileText
} from 'lucide-react';
import { EnablersReport } from '../types/enablers';
import { recordToPrintPayload, formatSignOffPosition } from '../utils/mwaPrintConverter';
import { currentPdfStore } from '../utils/currentPdfStore';
import { EvidenceFilePreview } from './EvidenceFilePreview';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';
import { AttachedEvidenceFile } from '../types/enablers';

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfViewerModalProps {
  report: EnablersReport | null;
  onClose: () => void;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function base64ToBlob(base64: string, mimeType = 'application/pdf'): Blob {
  const clean = base64.replace(/^data:[^;]+;base64,/, '');
  const binary = atob(clean);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

function evidenceSource(file: AttachedEvidenceFile): string {
  if (file.dataUrl) return file.dataUrl;
  if (file.base64) {
    if (/^data:/i.test(file.base64)) return file.base64;
    const ext = (file.name || '').split('.').pop()?.toLowerCase();
    const inferred = ext === 'pdf' ? 'application/pdf' : ['jpg', 'jpeg'].includes(ext || '') ? 'image/jpeg' : ext === 'png' ? 'image/png' : ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/octet-stream';
    return `data:${file.mimeType || inferred};base64,${file.base64}`;
  }
  return file.url || '';
}

async function evidenceBytes(file: AttachedEvidenceFile): Promise<ArrayBuffer> {
  const source = evidenceSource(file);
  if (!source) throw new Error('ไม่มีข้อมูลไฟล์ต้นฉบับ');
  if (/^data:/i.test(source)) {
    const comma = source.indexOf(',');
    if (comma < 0) throw new Error('ข้อมูลไฟล์ไม่ถูกต้อง');
    const meta = source.slice(0, comma);
    const body = source.slice(comma + 1);
    if (/;base64/i.test(meta)) {
      const binary = atob(body);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes.buffer;
    }
    return new TextEncoder().encode(decodeURIComponent(body)).buffer;
  }
  const response = await fetch(source);
  if (!response.ok) throw new Error(`อ่านไฟล์ไม่ได้ (${response.status})`);
  return response.arrayBuffer();
}

/** Render a real image/PDF first page, or a clearly-labelled DOCX text preview, for the authoritative PDF. */
async function renderEvidenceThumbnail(file: AttachedEvidenceFile): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 260;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('สร้างภาพตัวอย่างไม่ได้');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const ext = (file.name || '').split('.').pop()?.toLowerCase() || '';
  const mime = (file.mimeType || file.type || '').toLowerCase();
  const source = evidenceSource(file);
  const isImage = mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
  if (isImage) {
    if (!source) throw new Error('ไม่มีข้อมูลภาพต้นฉบับ');
    const img = new Image();
    img.src = source;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('อ่านภาพแนบไม่ได้'));
    });
    const scale = Math.min(560 / img.naturalWidth, 220 / img.naturalHeight, 1);
    const w = Math.max(1, img.naturalWidth * scale);
    const h = Math.max(1, img.naturalHeight * scale);
    ctx.drawImage(img, (600 - w) / 2, (230 - h) / 2, w, h);
    return canvas;
  }
  if (ext === 'pdf' || mime.includes('pdf')) {
    const bytes = await evidenceBytes(file);
    const pdf = await (pdfjsLib as any).getDocument({ data: new Uint8Array(bytes) }).promise;
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(560 / base.width, 220 / base.height, 1.5) });
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = Math.ceil(viewport.width);
    pageCanvas.height = Math.ceil(viewport.height);
    const pageCtx = pageCanvas.getContext('2d');
    if (!pageCtx) throw new Error('สร้างภาพหน้าแรก PDF ไม่ได้');
    await page.render({ canvasContext: pageCtx, viewport }).promise;
    ctx.drawImage(pageCanvas, (600 - pageCanvas.width) / 2, (230 - pageCanvas.height) / 2, pageCanvas.width, pageCanvas.height);
    return canvas;
  }
  if (ext === 'docx' || mime.includes('wordprocessingml')) {
    const bytes = await evidenceBytes(file);
    const result = await mammoth.extractRawText({ arrayBuffer: bytes });
    const text = result.value.trim();
    if (!text) throw new Error('เอกสาร Word ไม่มีข้อความสำหรับสร้างตัวอย่าง');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(15, 12, 570, 236);
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(15, 12, 570, 236);
    ctx.fillStyle = '#111827';
    ctx.font = '16px sans-serif';
    const words = text.split(/\s+/);
    let line = '';
    let y = 38;
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > 530 && line) {
        ctx.fillText(line, 32, y);
        line = word;
        y += 22;
        if (y > 225) break;
      } else line = next;
    }
    if (line && y <= 225) ctx.fillText(line, 32, y);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('ตัวอย่างข้อความจากเอกสาร DOCX (ไม่ใช่ภาพจำลองรูปแบบหน้า Word)', 22, 244);
    return canvas;
  }
  throw new Error(ext === 'doc' ? 'ไฟล์ .doc รุ่นเก่าไม่รองรับตัวอย่างอัตโนมัติ กรุณาแปลงเป็น .docx' : 'ไม่รองรับการสร้างตัวอย่างไฟล์ชนิดนี้');
}

function createPdfFromJpeg(jpegBytes: Uint8Array, width: number, height: number): Blob {
  const pageWidth = 842;
  const pageHeight = 595;

  const header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  const obj2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
  const obj3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`;
  const obj4Head = `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`;
  const obj4Tail = '\nendstream\nendobj\n';
  const streamContent = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im1 Do\nQ\n`;
  const obj5 = `5 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}endstream\nendobj\n`;

  const enc = new TextEncoder();
  const bHeader = enc.encode(header);
  const bObj1 = enc.encode(obj1);
  const bObj2 = enc.encode(obj2);
  const bObj3 = enc.encode(obj3);
  const bObj4Head = enc.encode(obj4Head);
  const bObj4Tail = enc.encode(obj4Tail);
  const bObj5 = enc.encode(obj5);

  const offset1 = bHeader.length;
  const offset2 = offset1 + bObj1.length;
  const offset3 = offset2 + bObj2.length;
  const offset4 = offset3 + bObj3.length;
  const offset5 = offset4 + bObj4Head.length + jpegBytes.length + bObj4Tail.length;
  const startXref = offset5 + bObj5.length;

  const xref = `xref\n0 6\n0000000000 65535 f \n${String(offset1).padStart(10, '0')} 00000 n \n${String(offset2).padStart(10, '0')} 00000 n \n${String(offset3).padStart(10, '0')} 00000 n \n${String(offset4).padStart(10, '0')} 00000 n \n${String(offset5).padStart(10, '0')} 00000 n \n`;
  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;
  const bXref = enc.encode(xref + trailer);

  return new Blob([
    bHeader,
    bObj1,
    bObj2,
    bObj3,
    bObj4Head,
    jpegBytes as any,
    bObj4Tail,
    bObj5,
    bXref
  ], { type: 'application/pdf' });
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (!text) return ['-'];
  const lines: string[] = [];
  const rawParagraphs = text.split('\n');

  for (const para of rawParagraphs) {
    if (!para.trim()) {
      lines.push('');
      continue;
    }
    const words = para.split(' ');
    let currentLine = '';

    for (let n = 0; n < words.length; n++) {
      const testLine = currentLine + (currentLine ? ' ' : '') + words[n];
      const testWidth = ctx.measureText(testLine).width;
      if (testWidth > maxWidth && n > 0) {
        lines.push(currentLine);
        currentLine = words[n];
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

/**
 * วาดและแปลงเป็น PDF ภาษาไทยความคมชัดสูง (A4 Landscape 300 DPI)
 * อิงโครงสร้างตามเอกสารราชการแบบ Reference:
 * - หัวกลางหน้า
 * - ข้อมูลผู้จัดทำเอกสาร
 * - ตาราง 5 ช่องเส้นกรอบสีดำ
 * - ปัญหาและข้อเสนอแนะท้ายเอกสาร
 * - ลายเซ็นด้านขวาล่าง
 */
export async function generateThaiPdfBlob(report: EnablersReport): Promise<Blob> {
  const printPayload = recordToPrintPayload(report);

  if (document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // ignore
    }
  }

  const canvas = document.createElement('canvas');
  // 1754 x 1240 px (A4 Landscape at ~150 DPI)
  const width = 1754;
  const height = 1240;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get 2d context');

  // Background White
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const FONT_OFFICIAL = '"TH Sarabun New", "Sarabun", "THSarabunNew", sans-serif';

  // 1. หัวกลางหน้า (Official Title)
  ctx.fillStyle = '#000000';
  ctx.font = `bold 22px ${FONT_OFFICIAL}`;
  ctx.textAlign = 'center';
  ctx.fillText(
    `รายงานการสื่อสารตามแผนการสื่อสารภายในและภายนอกองค์กรของผู้บริหาร ประจำปีงบประมาณ ${printPayload.fiscalYear}`,
    width / 2,
    75
  );

  ctx.font = `bold 18px ${FONT_OFFICIAL}`;
  ctx.fillText(`ประจำเดือน ${printPayload.month}`, width / 2, 105);

  // 2. ข้อมูลผู้จัดทำเอกสาร (Official Author Metadata)
  ctx.textAlign = 'left';
  const metaY = 145;
  const leftX = 55;
  const rightX = 960;

  ctx.font = `15px ${FONT_OFFICIAL}`;
  ctx.fillStyle = '#000000';
  ctx.fillText(`ผู้จัดทำเอกสาร: ${printPayload.author.name}`, leftX, metaY);
  ctx.fillText(`ตำแหน่ง: ${printPayload.author.position}`, rightX, metaY);

  ctx.fillText(
    `สายงาน/หน่วยงาน: ${printPayload.author.affiliationDepartment}`,
    leftX,
    metaY + 28
  );
  ctx.fillText(
    `โทรศัพท์: ${printPayload.author.phone}${printPayload.author.email ? `   อีเมล: ${printPayload.author.email}` : ''}`,
    rightX,
    metaY + 28
  );

  let currentY = metaY + 28;
  if (printPayload.enablersTopics && printPayload.enablersTopics.length > 0) {
    currentY += 26;
    ctx.fillText(
      `ประเด็น Enablers ที่เกี่ยวข้อง: ${printPayload.enablersTopics.join(', ')}`,
      leftX,
      currentY
    );
  }

  // 3. ตาราง 5 ช่อง เส้นกรอบสีดำ
  // คอลัมน์: | ผู้ถ่ายทอดสาร | ประเด็นการสื่อสาร | ช่องทางการสื่อสาร | ผู้รับสาร | หลักฐาน (ถ้ามี) |
  const tableX = 55;
  const tableY = currentY + 24;
  const tableW = width - 110;
  const colW = [230, 684, 210, 240, 280]; // Total = 1644 px

  // Table Header
  const thHeight = 40;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(tableX, tableY, tableW, thHeight);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.strokeRect(tableX, tableY, tableW, thHeight);

  ctx.fillStyle = '#000000';
  ctx.font = `bold 15px ${FONT_OFFICIAL}`;
  ctx.textAlign = 'center';

  const headers = [
    'ผู้ถ่ายทอดสาร',
    'ประเด็นการสื่อสาร',
    'ช่องทางการสื่อสาร',
    'ผู้รับสาร',
    'หลักฐาน (ถ้ามี)'
  ];

  let curX = tableX;
  headers.forEach((h, i) => {
    ctx.fillText(h, curX + colW[i] / 2, tableY + 26);
    curX += colW[i];
    if (i < headers.length - 1) {
      ctx.beginPath();
      ctx.moveTo(curX, tableY);
      ctx.lineTo(curX, tableY + thHeight);
      ctx.stroke();
    }
  });

  // Table Body Rows
  ctx.textAlign = 'left';
  let rowY = tableY + thHeight;
  const lineHeight = 20;

  for (let rIdx = 0; rIdx < printPayload.tableRows.length; rIdx++) {
    const item = printPayload.tableRows[rIdx];

    // คำนวณความสูงของแถวตามเนื้อหา
    ctx.font = `14px ${FONT_OFFICIAL}`;
    const c1Lines = wrapTextLines(ctx, item.communicator, colW[0] - 16);
    const c2Lines = wrapTextLines(ctx, item.topicOrDetails, colW[1] - 16);
    const c3Lines = wrapTextLines(ctx, item.channel, colW[2] - 16);
    const c4Lines = wrapTextLines(ctx, item.recipients, colW[3] - 16);

    const files = item.evidenceFiles || [];
    const previews: Array<{ file: AttachedEvidenceFile; canvas?: HTMLCanvasElement; error?: string }> = await Promise.all(files.map(async file => {
      try { return { file, canvas: await renderEvidenceThumbnail(file) }; }
      catch (error) { return { file, error: error instanceof Error ? error.message : 'ไม่สามารถสร้างตัวอย่างได้' }; }
    }));
    const filesCount = files.length > 0 ? files.length : 1;
    const maxTextLines = Math.max(c1Lines.length, c2Lines.length, c3Lines.length, c4Lines.length);
    const evidenceBlockHeight = files.length ? files.length * 126 + 18 : 0;
    const dynamicHeight = Math.max(75, maxTextLines * lineHeight + 20, evidenceBlockHeight);

    // Draw row cell background and outline
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(tableX, rowY, tableW, dynamicHeight);
    ctx.strokeStyle = '#000000';
    ctx.strokeRect(tableX, rowY, tableW, dynamicHeight);

    // Draw vertical column dividers
    let colDividerX = tableX;
    for (let c = 0; c < colW.length - 1; c++) {
      colDividerX += colW[c];
      ctx.beginPath();
      ctx.moveTo(colDividerX, rowY);
      ctx.lineTo(colDividerX, rowY + dynamicHeight);
      ctx.stroke();
    }

    // Render texts
    ctx.fillStyle = '#000000';
    let cx = tableX;

    // Col 1: ผู้ถ่ายทอดสาร
    c1Lines.slice(0, 5).forEach((line, lIdx) => {
      ctx.fillText(line, cx + 8, rowY + 22 + lIdx * lineHeight);
    });
    cx += colW[0];

    // Col 2: ประเด็นการสื่อสาร
    c2Lines.slice(0, 12).forEach((line, lIdx) => {
      ctx.fillText(line, cx + 8, rowY + 22 + lIdx * lineHeight);
    });
    cx += colW[1];

    // Col 3: ช่องทางการสื่อสาร
    c3Lines.slice(0, 5).forEach((line, lIdx) => {
      ctx.fillText(line, cx + 8, rowY + 22 + lIdx * lineHeight);
    });
    cx += colW[2];

    // Col 4: ผู้รับสาร
    c4Lines.slice(0, 5).forEach((line, lIdx) => {
      ctx.fillText(line, cx + 8, rowY + 22 + lIdx * lineHeight);
    });
    cx += colW[3];

    // Col 5: หลักฐาน (ถ้ามี)
    if (files.length === 0) {
      ctx.fillText('-', cx + 8, rowY + 22);
    } else {
      previews.forEach((preview, fIdx) => {
        const blockY = rowY + 8 + fIdx * 126;
        if (preview.canvas) {
          const thumbW = 244;
          const thumbH = 88;
          const scale = Math.min(thumbW / preview.canvas.width, thumbH / preview.canvas.height);
          const drawW = preview.canvas.width * scale;
          const drawH = preview.canvas.height * scale;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(cx + 8, blockY, thumbW, thumbH);
          ctx.strokeStyle = '#cbd5e1';
          ctx.strokeRect(cx + 8, blockY, thumbW, thumbH);
          ctx.drawImage(preview.canvas, cx + 8 + (thumbW - drawW) / 2, blockY + (thumbH - drawH) / 2, drawW, drawH);
        } else {
          ctx.fillStyle = '#fff7ed';
          ctx.fillRect(cx + 8, blockY, 244, 88);
          ctx.strokeStyle = '#fdba74';
          ctx.strokeRect(cx + 8, blockY, 244, 88);
          ctx.fillStyle = '#9a3412';
          ctx.font = `12px ${FONT_OFFICIAL}`;
          const errorText = preview.error || 'ไม่สามารถสร้างตัวอย่างได้';
          ctx.fillText(errorText.slice(0, 38), cx + 14, blockY + 30);
          ctx.fillText(errorText.slice(38, 76), cx + 14, blockY + 50);
        }
        ctx.fillStyle = '#000000';
        ctx.font = `12px ${FONT_OFFICIAL}`;
        const filename = preview.file.name || `ไฟล์แนบ ${fIdx + 1}`;
        const maxChars = 36;
        const nameLines = filename.match(new RegExp(`.{1,${maxChars}}`, 'g')) || [filename];
        nameLines.slice(0, 2).forEach((line, index) => ctx.fillText(line, cx + 8, blockY + 104 + index * 14));
      });
    }

    rowY += dynamicHeight;
    if (rowY > height - 260) break; // Keep within page bounds
  }

  // 4. ปัญหาและอุปสรรค & ข้อเสนอแนะ (ข้อความเรียบใต้ตาราง)
  const notesY = rowY + 25;
  ctx.fillStyle = '#000000';
  ctx.font = `bold 15px ${FONT_OFFICIAL}`;
  ctx.fillText('ปัญหาและอุปสรรคในการสื่อสาร/ขับเคลื่อน:', 55, notesY);
  ctx.font = `14px ${FONT_OFFICIAL}`;
  ctx.fillText(printPayload.problems || '-', 365, notesY);

  ctx.font = `bold 15px ${FONT_OFFICIAL}`;
  ctx.fillText('ข้อเสนอแนะในการปรับปรุงและพัฒนา:', 55, notesY + 30);
  ctx.font = `14px ${FONT_OFFICIAL}`;
  ctx.fillText(printPayload.suggestions || '-', 365, notesY + 30);

  // 5. แสดงชื่อ-นามสกุล และตำแหน่งผู้รายงานด้านขวาล่าง โดยไม่แสดงบรรทัดลงชื่อ
  const signX = width - 420;
  const signY = notesY + 75;

  ctx.textAlign = 'center';
  ctx.fillStyle = '#000000';
  ctx.font = `14.5px ${FONT_OFFICIAL}`;
  ctx.fillText(String(printPayload.signOff.recorderName || '').trim(), signX + 160, signY + 28);
  ctx.font = `13.5px ${FONT_OFFICIAL}`;
  ctx.fillText(String(printPayload.signOff.recorderPosition || '').trim(), signX + 160, signY + 50);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('Canvas to Blob failed'));
        return;
      }
      blob.arrayBuffer().then(buf => {
        try {
          const pdfBlob = createPdfFromJpeg(new Uint8Array(buf), width, height);
          resolve(pdfBlob);
        } catch (err) {
          reject(err);
        }
      }).catch(reject);
    }, 'image/jpeg', 0.95);
  });
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  report,
  onClose
}) => {
  const [zoom, setZoom] = useState(100);
  const [isDownloading, setIsDownloading] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  if (!report) return null;

  const printPayload = recordToPrintPayload(report);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 10, 160));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 10, 60));
  const handleZoomReset = () => setZoom(100);

  /**
   * พิมพ์ / Save as PDF
   * ใช้ Pattern window.open('', '_blank') ใน click event โดยตรง
   * เพื่อแก้ปัญหา Popup Blocker
   */
  const handlePrint = async () => {
    // Open the same authoritative PDF bytes used by download and email attachment.
    // Open a blank tab synchronously to avoid popup blockers, then navigate it to the PDF Blob.
    const printTab = window.open('', '_blank');
    if (!printTab) {
      showNotification('เบราว์เซอร์บล็อกหน้าต่างใหม่ กรุณาอนุญาต Pop-up แล้วลองอีกครั้ง');
      return;
    }
    try {
      const blob = await getPdfBlobAsync();
      const objectUrl = URL.createObjectURL(blob);
      printTab.location.href = objectUrl;
      showNotification('เปิด PDF ฉบับเดียวกับไฟล์แนบอีเมลแล้ว ใช้ปุ่มพิมพ์ในตัวอ่าน PDF');
      // Keep object URL alive while the new PDF tab is open; revoking early can break the viewer.
    } catch (error) {
      printTab.close();
      console.error('[PDF] Could not open authoritative PDF:', error);
      showNotification('ไม่สามารถเปิด PDF ได้ กรุณาลองดาวน์โหลด PDF แทน');
    }
  };

  /**
   * ดึง PDF Blob จาก existing report bytes หรือ generate ใหม่
   */
  const getPdfBlobAsync = async (): Promise<Blob> => {
    // 1. ตรวจสอบจาก currentPdfStore ก่อน
    const cached = currentPdfStore.getCurrentPdfBlob(report.id);
    if (cached) return cached;

    // 2. ตรวจสอบจาก base64 ใน record
    if (report.pdf_base64 && report.pdf_base64.length > 50) {
      try {
        const blob = base64ToBlob(report.pdf_base64, 'application/pdf');
        currentPdfStore.setCurrentPdfBlob(report.id, blob);
        return blob;
      } catch (e) {
        console.warn('Cannot decode pdf_base64, generating from canvas:', e);
      }
    }

    // 3. Generate ใหม่และบันทึกลง store
    const generated = await generateThaiPdfBlob(report);
    currentPdfStore.setCurrentPdfBlob(report.id, generated);
    return generated;
  };

  /**
   * ดาวน์โหลดไฟล์ PDF จริง
   */
  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const blob = await getPdfBlobAsync();
      if (!blob) {
        showNotification('ไม่พบไฟล์ PDF สำหรับรายงานนี้');
        return;
      }

      const filename = `MWA_Communication_Report_${report.id}.pdf`;
      const objectUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = objectUrl;
      downloadLink.download = filename;
      downloadLink.style.display = 'none';
      document.body.appendChild(downloadLink);
      downloadLink.click();

      setTimeout(() => {
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(objectUrl);
      }, 1000);

      showNotification(`ดาวน์โหลดไฟล์ ${filename} เรียบร้อยแล้ว`);
    } catch (err) {
      console.error('Failed to download PDF:', err);
      showNotification('ไม่พบไฟล์ PDF สำหรับรายงานนี้');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-xs flex flex-col font-['Mitr',sans-serif] overflow-hidden">
      {/* ========================================================
          1. TOP TOOLBAR (Dark Theme - PDF Viewer Style)
         ======================================================== */}
      <div className="bg-[#1e293b] text-white px-4 py-2.5 sm:px-6 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-md border-b border-slate-700 print:hidden select-none">
        {/* Left: Document Title & Record ID */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#1976d2] text-white flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 text-cyan-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-medium text-slate-100">
                ตัวอย่างเอกสารรายงานการสื่อสาร (ฟอร์มราชการแบบเดิม)
              </span>
              <span className="font-mono text-xs bg-slate-800 text-cyan-300 px-2 py-0.5 rounded border border-slate-700">
                {report.id}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              การประปานครหลวง (กปน.) • ประจำเดือน {printPayload.month} (ปีงบประมาณ {printPayload.fiscalYear})
            </p>
          </div>
        </div>

        {/* Center: A4 Landscape Badge & Zoom Controls */}
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="hidden md:inline-flex items-center gap-1.5 text-xs bg-slate-800 text-slate-300 px-3 py-1.5 rounded-[6px] border border-slate-700 font-mono">
            <span>A4 แนวนอน (Landscape)</span>
            <span className="text-slate-500">•</span>
            <span>297mm × 210mm</span>
          </span>

          {/* Zoom controls */}
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-[6px] p-0.5 text-xs">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition cursor-pointer"
              title="ลดขนาด (Zoom out)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono text-[11px] text-slate-200 min-w-[42px] text-center">
              {zoom}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition cursor-pointer"
              title="เพิ่มขนาด (Zoom in)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleZoomReset}
              className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-cyan-300 border-l border-slate-700 ml-1 transition cursor-pointer"
              title="รีเซ็ตขนาด 100%"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Right Action Buttons: Download PDF, Print / Save as PDF, Close */}
        <div className="flex items-center gap-2">
          {/* 1. ปุ่มสีเขียว: ดาวน์โหลด PDF */}
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className={`bg-[#16a34a] hover:bg-[#15803d] text-white px-3 sm:px-3.5 py-1.5 rounded-[6px] text-xs font-medium flex items-center gap-1.5 shadow-sm transition cursor-pointer ${
              isDownloading ? 'opacity-70 cursor-wait' : ''
            }`}
            title="ดาวน์โหลดเป็นไฟล์ PDF จริง"
          >
            <Download className={`w-3.5 h-3.5 ${isDownloading ? 'animate-bounce' : ''}`} />
            <span>{isDownloading ? 'กำลังสร้าง PDF...' : 'ดาวน์โหลด PDF'}</span>
          </button>

          {/* 2. ปุ่มสีน้ำเงิน: พิมพ์ / Save as PDF */}
          <button
            type="button"
            onClick={handlePrint}
            className="bg-[#1976d2] hover:bg-[#1565c0] text-white px-3 sm:px-3.5 py-1.5 rounded-[6px] text-xs font-medium flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            title="สั่งพิมพ์ หรือ บันทึกเป็น PDF (เปิด Native Browser Print)"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>พิมพ์ / Save as PDF</span>
          </button>

          {/* 3. ปุ่มเข้ม/เทา: ปิดหน้าต่าง */}
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white px-3 py-1.5 rounded-[6px] text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
            title="ปิดหน้าต่างแสดงตัวอย่าง"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">ปิดหน้าต่าง</span>
          </button>
        </div>
      </div>

      {/* Notification Banner when needed */}
      {notification && (
        <div className="bg-amber-400 text-slate-900 px-4 py-2 text-center text-xs font-semibold shadow-md shrink-0 print:hidden flex items-center justify-center gap-2">
          <span>⚠️ {notification}</span>
        </div>
      )}

      {/* ========================================================
          2. VIEWER CANVAS (Centered A4 Landscape Sheet - Official Format)
         ======================================================== */}
      <div className="flex-1 overflow-auto bg-[#525659] p-4 sm:p-8 flex justify-center items-start">
        <div
          id="pdf-print-area"
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
            width: '1060px',
            minHeight: '750px',
            fontFamily: "'TH Sarabun New', 'Sarabun', 'THSarabunNew', sans-serif"
          }}
          className="bg-white text-black shadow-2xl p-10 sm:p-12 transition-transform duration-150 shrink-0 leading-relaxed select-text border-none"
        >
          {/* หัวกลางหน้า (Official Title Center) */}
          <div className="text-center mb-5">
            <h1 className="text-lg sm:text-xl font-bold text-black tracking-normal leading-snug">
              {printPayload.documentTitle} ประจำปีงบประมาณ {printPayload.fiscalYear}
            </h1>
            <div className="text-base font-bold text-black mt-1">
              ประจำเดือน {printPayload.month}
            </div>
          </div>

          {/* ข้อมูลผู้จัดทำเอกสาร (Official Author Metadata) */}
          <div className="mb-5 text-sm text-black space-y-1">
            <div className="flex flex-wrap justify-between gap-4">
              <div>
                <strong>ผู้จัดทำเอกสาร:</strong> {printPayload.author.name}
              </div>
              <div>
                <strong>ตำแหน่ง:</strong> {printPayload.author.position}
              </div>
            </div>
            <div className="flex flex-wrap justify-between gap-4">
              <div>
                <strong>สายงาน/หน่วยงาน:</strong> {printPayload.author.affiliationDepartment}
              </div>
              <div>
                <strong>โทรศัพท์:</strong> {printPayload.author.phone}
                {printPayload.author.email && (
                  <span className="ml-4">
                    <strong>อีเมล:</strong> {printPayload.author.email}
                  </span>
                )}
              </div>
            </div>
            {printPayload.enablersTopics && printPayload.enablersTopics.length > 0 && (
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <strong>ประเด็น Enablers ที่เกี่ยวข้อง:</strong> {printPayload.enablersTopics.join(', ')}
                </div>
              </div>
            )}
          </div>

          {/* ตาราง 5 ช่องเส้นกรอบสีดำ (Official 5-Column Table) */}
          <div className="mb-6">
            <table className="w-full text-left border-collapse text-xs sm:text-sm border border-black">
              <thead>
                <tr className="bg-white text-black font-bold border-b border-black">
                  <th className="py-2.5 px-3 text-center w-40 border-r border-black">ผู้ถ่ายทอดสาร</th>
                  <th className="py-2.5 px-3 text-center border-r border-black">ประเด็นการสื่อสาร</th>
                  <th className="py-2.5 px-3 text-center w-36 border-r border-black">ช่องทางการสื่อสาร</th>
                  <th className="py-2.5 px-3 text-center w-36 border-r border-black">ผู้รับสาร</th>
                  <th className="py-2.5 px-3 text-center w-44">หลักฐาน (ถ้ามี)</th>
                </tr>
              </thead>
              <tbody>
                {printPayload.tableRows.map((item, idx) => {
                  const files = item.evidenceFiles || [];

                  return (
                    <tr key={idx} className="align-top border-b border-black">
                      <td className="py-3 px-3 text-black border-r border-black">
                        {item.communicator}
                      </td>
                      <td className="py-3 px-3 text-black border-r border-black">
                        <p className="whitespace-pre-wrap leading-relaxed">{item.topicOrDetails}</p>
                      </td>
                      <td className="py-3 px-3 text-black border-r border-black">
                        {item.channel}
                      </td>
                      <td className="py-3 px-3 text-black border-r border-black">
                        {item.recipients}
                      </td>
                      <td className="py-3 px-3 space-y-2 text-black">
                        {files.length === 0 ? (
                          <span>-</span>
                        ) : (
                          files.map((file, fIdx) => {
                            return (
                              <EvidenceFilePreview
                                key={file.id || fIdx}
                                file={file}
                                index={fIdx}
                                compact
                              />
                            );
                          })
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ปัญหา อุปสรรค และข้อเสนอแนะ (ข้อความเรียบใต้ตาราง) */}
          <div className="text-sm text-black space-y-2 mb-8">
            <div>
              <strong>ปัญหาและอุปสรรคในการสื่อสาร/ขับเคลื่อน:</strong>{' '}
              <span className="whitespace-pre-wrap">{printPayload.problems || '-'}</span>
            </div>
            <div>
              <strong>ข้อเสนอแนะในการปรับปรุงและพัฒนา:</strong>{' '}
              <span className="whitespace-pre-wrap">{printPayload.suggestions || '-'}</span>
            </div>
          </div>

          {/* ลายเซ็น Sign-off ด้านขวาตามแบบ Reference (เหลือ ชื่อ + ตำแหน่ง เท่านั้น) */}
          <div className="flex justify-end pr-10 pt-4">
            <div className="w-80 text-center text-sm text-black space-y-1">
              <div className="font-normal">
                {printPayload.signOff.recorderName}
              </div>
              <div className="font-normal">
                {printPayload.signOff.recorderPosition || printPayload.author.position || ''}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PdfViewerModal;
