/**
 * MWA Enablers Report 2570 - Print Helper
 * 
 * ดำเนินการพิมพ์ตาม Pattern ของ Reference:
 * 1. เปิด window.open('', '_blank') จาก user click โดยตรง
 * 2. สร้างเอกสารราชการแบบเก่า:
 *    - กระดาษขาว เส้นกรอบดำ เส้นตารางดำ
 *    - หัวกลางหน้า: รายงานการสื่อสารตามแผนการสื่อสารภายในและภายนอกองค์กรของผู้บริหาร ประจำปีงบประมาณ 2570
 *    - ประจำเดือน <เดือน>
 *    - ผู้จัดทำเอกสาร: <ชื่อ> ตำแหน่ง: <ตำแหน่ง> สายงาน/หน่วยงาน: <สายงาน>/<หน่วยงาน> โทรศัพท์: <เบอร์>
 *    - ตาราง 5 ช่องเส้นกรอบดำ: | ผู้ถ่ายทอดสาร | ประเด็นการสื่อสาร | ช่องทางการสื่อสาร | ผู้รับสาร | หลักฐาน (ถ้ามี) |
 *    - ปัญหา/อุปสรรค และข้อเสนอแนะท้ายเอกสารแบบเรียบ
 *    - ชื่อ-นามสกุลและตำแหน่งผู้รายงานด้านขวาล่าง โดยไม่แสดงบรรทัดลงชื่อ
 * 3. รอ document.fonts.ready และเรียก window.print()
 * 4. onafterprint ปิด window
 */

import { PrintDocumentPayload, formatSignOffPosition } from './mwaPrintConverter';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';
import { AttachedEvidenceFile } from '../types/enablers';

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function escapeHtml(str?: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function evidenceSource(file: AttachedEvidenceFile): string {
  if (file.dataUrl) return file.dataUrl;
  if (file.base64) return /^data:/i.test(file.base64) ? file.base64 : `data:${file.mimeType || 'application/octet-stream'};base64,${file.base64}`;
  return file.url || '';
}

async function evidenceBytes(file: AttachedEvidenceFile): Promise<ArrayBuffer> {
  const source = evidenceSource(file);
  if (!source) throw new Error('ไม่มีข้อมูลไฟล์');
  if (/^data:/i.test(source)) {
    const comma = source.indexOf(',');
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

async function evidencePreviewMarkup(file: AttachedEvidenceFile): Promise<string> {
  const name = escapeHtml(file.name || 'ไฟล์แนบ');
  const ext = (file.name || '').split('.').pop()?.toLowerCase() || '';
  const mime = (file.mimeType || file.type || '').toLowerCase();
  const source = evidenceSource(file);
  const image = mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
  try {
    if (image && source) {
      return `<div class="evidence-item"><img class="evidence-image" src="${escapeHtml(source)}" alt="${name}"><div class="evidence-name">${name}</div></div>`;
    }
    if (ext === 'pdf' || mime.includes('pdf')) {
      const bytes = await evidenceBytes(file);
      const pdf = await (pdfjsLib as any).getDocument({ data: new Uint8Array(bytes) }).promise;
      const page = await pdf.getPage(1);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(900 / base.width, 1.5) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('สร้างภาพตัวอย่างไม่ได้');
      await page.render({ canvasContext: context, viewport }).promise;
      return `<div class="evidence-item"><img class="evidence-page" src="${canvas.toDataURL('image/png')}" alt="หน้าแรก ${name}"><div class="evidence-name">${name}</div></div>`;
    }
    if (ext === 'docx' || mime.includes('wordprocessingml')) {
      const bytes = await evidenceBytes(file);
      const result = await mammoth.convertToHtml({ arrayBuffer: bytes });
      if (!result.value.trim()) throw new Error('เอกสารไม่มีเนื้อหาที่แสดงได้');
      return `<div class="evidence-item"><div class="word-page">${result.value}</div><div class="evidence-name">${name}</div></div>`;
    }
    const reason = ext === 'doc'
      ? 'ไฟล์ .doc รุ่นเก่าไม่รองรับการสร้างตัวอย่างอัตโนมัติ กรุณาบันทึกเป็น .docx'
      : 'ไม่รองรับการสร้างตัวอย่างไฟล์ชนิดนี้';
    return `<div class="evidence-item"><div class="evidence-error">${escapeHtml(reason)}</div><div class="evidence-name">${name}</div></div>`;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ไม่สามารถสร้างภาพตัวอย่างได้';
    return `<div class="evidence-item"><div class="evidence-error">สร้างตัวอย่างไม่ได้: ${escapeHtml(message)}</div><div class="evidence-name">${name}</div></div>`;
  }
}

export async function printReportDocument(payload: PrintDocumentPayload): Promise<boolean> {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    return false;
  }

  const tableRowsHtml = (await Promise.all(payload.tableRows.map(async row => {
    const evidenceHtml = row.evidenceFiles.length === 0
      ? '<span style="color:#000000;font-style:normal;">-</span>'
      : (await Promise.all(row.evidenceFiles.map(evidencePreviewMarkup))).join('');

    return `
      <tr>
        <td style="padding:4px 5px;border:1px solid #000000;font-weight:normal;width:150px;color:#000000;vertical-align:top;">
          ${escapeHtml(row.communicator)}
        </td>
        <td style="padding:4px 5px;border:1px solid #000000;color:#000000;line-height:1.35;white-space:pre-wrap;vertical-align:top;">
          ${escapeHtml(row.topicOrDetails)}
        </td>
        <td style="padding:4px 5px;border:1px solid #000000;width:130px;color:#000000;vertical-align:top;">
          ${escapeHtml(row.channel)}
        </td>
        <td style="padding:4px 5px;border:1px solid #000000;width:140px;color:#000000;vertical-align:top;">
          ${escapeHtml(row.recipients)}
        </td>
        <td style="padding:4px 5px;border:1px solid #000000;width:150px;color:#000000;vertical-align:top;">
          ${evidenceHtml}
        </td>
      </tr>
    `;
  }))).join('');

  const htmlContent = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <title>รายงานการสื่อสารตามแผนการสื่อสาร_${escapeHtml(payload.reportId)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 landscape;
      margin: 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'TH Sarabun New', 'Sarabun', 'THSarabunNew', sans-serif;
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-size: 14px;
      line-height: 1.5;
    }
    .evidence-item { margin: 0 0 8px; break-inside: avoid; page-break-inside: avoid; }
    .evidence-image, .evidence-page { display:block; max-width:100%; width:auto; height:auto; max-height:85px; object-fit:contain; border:1px solid #cbd5e1; margin:0 auto 4px; }
    .evidence-name { font-size:11px; line-height:1.25; overflow-wrap:anywhere; }
    .evidence-error { font-size:10px; line-height:1.3; border:1px solid #d97706; padding:5px; overflow-wrap:anywhere; }
    .word-page { height:85px; overflow:hidden; padding:5px; font-size:8px; line-height:1.2; border:1px solid #cbd5e1; background:#fff; overflow-wrap:anywhere; }
    .word-page img { max-width:100%; height:auto; }
    .word-page table { max-width:100%; border-collapse:collapse; }
    .page-container {
      width: 100%;
      max-width: none;
      margin: 0 auto;
      padding: 4px 6px;
      background: #ffffff;
    }
    /* หัวกลางหน้าแบบทางการ */
    .official-header {
      text-align: center;
      margin-bottom: 12px;
      padding-bottom: 4px;
    }
    .official-title {
      font-size: 17px;
      font-weight: bold;
      color: #000000;
      margin: 0 0 4px 0;
      line-height: 1.4;
    }
    .official-month {
      font-size: 15px;
      font-weight: bold;
      color: #000000;
      margin: 0 0 8px 0;
    }
    /* ข้อมูลผู้จัดทำเอกสาร */
    .official-author {
      font-size: 12px;
      line-height: 1.4;
      margin-bottom: 8px;
      color: #000000;
    }
    .official-author-row {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 8px;
    }
    /* ตารางเส้นกรอบสีดำ */
    table.official-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      border: 1px solid #000000;
      page-break-inside: auto;
    }
    table.official-table thead {
      display: table-header-group;
    }
    table.official-table tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    table.official-table th {
      background-color: #ffffff;
      color: #000000;
      border: 1px solid #000000;
      padding: 4px 5px;
      text-align: center;
      font-weight: bold;
      font-size: 13px;
    }
    table.official-table td {
      border: 1px solid #000000;
      padding: 4px 5px;
      font-size: 12.5px;
      color: #000000;
      vertical-align: top;
    }
    /* ส่วนปัญหาและข้อเสนอแนะท้ายเอกสาร */
    .official-notes {
      margin-top: 14px;
      margin-bottom: 20px;
      font-size: 13px;
      line-height: 1.6;
      color: #000000;
    }
    .official-note-item {
      margin-bottom: 8px;
    }
    .official-note-item strong {
      font-weight: bold;
      color: #000000;
    }
    /* ลายเซ็นท้ายเอกสารด้านขวา */
    .official-signature-container {
      margin-top: 25px;
      display: flex;
      justify-content: flex-end;
      padding-right: 40px;
    }
    .official-signature-box {
      width: 320px;
      text-align: center;
      font-size: 13px;
      line-height: 1.5;
    }
    .signature-name {
      margin-top: 8px;
      margin-bottom: 3px;
      font-weight: normal;
    }
    .signature-position {
      margin-top: 0;
      font-weight: normal;
    }
    @media print {
      html, body { width: 100%; min-height: 0; margin: 0 !important; padding: 0 !important; }
      .page-container { width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; }
      table.official-table { width: 100% !important; }
      .official-signature-container { break-inside: avoid; page-break-inside: avoid; }
    }
    .no-print {
      display: none !important;
    }
  </style>
</head>
<body>
  <div class="page-container">
    <!-- หัวกลางหน้า -->
    <div class="official-header">
      <h1 class="official-title">
        รายงานการสื่อสารตามแผนการสื่อสารภายในและภายนอกองค์กรของผู้บริหาร ประจำปีงบประมาณ ${escapeHtml(payload.fiscalYear)}
      </h1>
      <div class="official-month">
        ประจำเดือน ${escapeHtml(payload.month)}
      </div>
    </div>

    <!-- ข้อมูลผู้จัดทำเอกสาร -->
    <div class="official-author">
      <div class="official-author-row">
        <div>
          <strong>ผู้จัดทำเอกสาร:</strong> ${escapeHtml(payload.author.name)}
        </div>
        <div>
          <strong>ตำแหน่ง:</strong> ${escapeHtml(payload.author.position)}
        </div>
      </div>
      <div class="official-author-row" style="margin-top: 3px;">
        <div>
          <strong>สายงาน/หน่วยงาน:</strong> ${escapeHtml(payload.author.affiliationDepartment)}
        </div>
        <div>
          <strong>โทรศัพท์:</strong> ${escapeHtml(payload.author.phone)}
          ${payload.author.email ? `&nbsp;&nbsp;<strong>อีเมล:</strong> ${escapeHtml(payload.author.email)}` : ''}
        </div>
      </div>
      ${payload.enablersTopics && payload.enablersTopics.length > 0 ? `
      <div class="official-author-row" style="margin-top: 3px;">
        <div>
          <strong>ประเด็น Enablers ที่เกี่ยวข้อง:</strong> ${escapeHtml(payload.enablersTopics.join(', '))}
        </div>
      </div>
      ` : ''}
    </div>

    <!-- ตาราง 5 ช่องเส้นกรอบสีดำ แบบเอกสารราชการเก่า -->
    <table class="official-table">
      <thead>
        <tr>
          <th style="width: 150px;">ผู้ถ่ายทอดสาร</th>
          <th>ประเด็นการสื่อสาร</th>
          <th style="width: 130px;">ช่องทางการสื่อสาร</th>
          <th style="width: 140px;">ผู้รับสาร</th>
          <th style="width: 150px;">หลักฐาน (ถ้ามี)</th>
        </tr>
      </thead>
      <tbody>
        ${tableRowsHtml}
      </tbody>
    </table>

    <!-- ปัญหาและอุปสรรค & ข้อเสนอแนะ (ข้อความเรียบ ๆ ใต้ตาราง) -->
    <div class="official-notes">
      <div class="official-note-item">
        <strong>ปัญหาและอุปสรรคในการสื่อสาร/ขับเคลื่อน:</strong>
        <span style="white-space: pre-wrap;">${escapeHtml(payload.problems) || '-'}</span>
      </div>
      <div class="official-note-item">
        <strong>ข้อเสนอแนะในการปรับปรุงและพัฒนา:</strong>
        <span style="white-space: pre-wrap;">${escapeHtml(payload.suggestions) || '-'}</span>
      </div>
    </div>

    <!-- แสดงเฉพาะชื่อ-นามสกุลและตำแหน่งผู้รายงาน ไม่แสดงบรรทัด (ลงชื่อ) -->
    <div class="official-signature-container">
      <div class="official-signature-box">
        <div class="signature-name">
          ${escapeHtml(payload.signOff.recorderName || '')}
        </div>
        <div class="signature-position">
          ${escapeHtml(payload.signOff.recorderPosition || '')}
        </div>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      if (document.fonts) {
        document.fonts.ready.then(function() {
          setTimeout(function() {
            window.focus();
            window.print();
          }, 300);
        });
      } else {
        setTimeout(function() {
          window.focus();
          window.print();
        }, 500);
      }
    };
    window.onafterprint = function() {
      window.close();
    };
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  return true;
}
