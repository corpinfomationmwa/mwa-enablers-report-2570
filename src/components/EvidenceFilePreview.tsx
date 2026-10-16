import React, { useEffect, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';
import { AttachedEvidenceFile } from '../types/enablers';
import { currentPdfStore } from '../utils/currentPdfStore';

// Use the worker bundled with pdfjs-dist so the preview does not depend on a CDN.
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function extension(name: string): string {
  return (name.split('.').pop() || '').toLowerCase();
}

/**
 * ดึงข้อมูลไฟล์ที่มีเนื้อหาจริง หากไฟล์ที่ส่งมามีเฉพาะ metadata
 * จะค้นหาจากแคชใน currentPdfStore เพื่อดึง dataUrl / base64 ตัวจริงกลับมา
 */
function resolveFileWithBytes(file: AttachedEvidenceFile): AttachedEvidenceFile {
  if (file.dataUrl || file.base64 || (file.url && /^data:/i.test(file.url))) {
    return file;
  }
  const cached = (file.id ? currentPdfStore.findEvidenceFile(file.id) : undefined) ||
                 (file.name ? currentPdfStore.findEvidenceFile(file.name) : undefined);
  if (cached && (cached.dataUrl || cached.base64 || cached.url)) {
    return {
      ...file,
      dataUrl: cached.dataUrl || file.dataUrl,
      base64: cached.base64 || file.base64,
      url: cached.url || file.url,
      mimeType: file.mimeType || cached.mimeType,
      type: file.type || cached.type
    };
  }
  return file;
}

function sourceOf(file: AttachedEvidenceFile): string {
  const resolved = resolveFileWithBytes(file);
  if (resolved.dataUrl) return resolved.dataUrl;
  if (resolved.base64) {
    if (/^data:/i.test(resolved.base64)) return resolved.base64;
    const ext = (resolved.name || '').split('.').pop()?.toLowerCase();
    const inferred = ext === 'pdf' ? 'application/pdf' : ['jpg', 'jpeg'].includes(ext || '') ? 'image/jpeg' : ext === 'png' ? 'image/png' : ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/octet-stream';
    const candidate = resolved.mimeType || '';
    const mime = candidate.includes('/') ? candidate : inferred;
    return `data:${mime};base64,${resolved.base64}`;
  }
  return resolved.url || '';
}

async function loadBytes(file: AttachedEvidenceFile): Promise<ArrayBuffer> {
  const source = sourceOf(file);
  if (!source) throw new Error('ไม่มีข้อมูลไฟล์ต้นฉบับสำหรับสร้างตัวอย่าง');
  if (/^data:/i.test(source)) {
    const comma = source.indexOf(',');
    if (comma < 0) throw new Error('รูปแบบข้อมูลไฟล์ไม่ถูกต้อง');
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

  // หากเป็น URL ตรวจสอบการอ่านข้อมูลจริงก่อนใช้
  try {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`ไม่สามารถอ่านไฟล์ต้นฉบับได้ (${response.status})`);
    return await response.arrayBuffer();
  } catch (err) {
    throw new Error('ไม่สามารถเข้าถึงข้อมูลไฟล์จาก URL ได้: ' + (err instanceof Error ? err.message : String(err)));
  }
}

interface EvidenceFilePreviewProps {
  file: AttachedEvidenceFile;
  index: number;
  compact?: boolean;
}

/** Shows the actual first page for PDFs, rendered DOCX content, or the original image. */
export const EvidenceFilePreview: React.FC<EvidenceFilePreviewProps> = ({ file, index, compact = false }) => {
  const [preview, setPreview] = useState<{ kind: 'image'; src: string } | { kind: 'word'; html: string } | { kind: 'error'; message: string } | { kind: 'loading' }>({ kind: 'loading' });
  const ext = extension(file.name || '');
  const resolved = resolveFileWithBytes(file);
  const source = sourceOf(resolved);
  const mime = (resolved.mimeType || resolved.type || '').toLowerCase();
  const isImage = mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
  const isPdf = mime.includes('pdf') || ext === 'pdf';
  const isDocx = ext === 'docx' || mime.includes('wordprocessingml');
  const isLegacyDoc = ext === 'doc';

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (isImage) {
          if (!source) throw new Error('ไม่มีข้อมูลภาพต้นฉบับ');
          // หากเป็น Data URL หรือ Blob ใช้ได้ทันที
          if (/^data:/i.test(source) || /^blob:/i.test(source)) {
            if (!cancelled) setPreview({ kind: 'image', src: source });
            return;
          }
          // หากเป็น URL ภายนอก ตรวจสอบว่าสามารถโหลดภาพได้จริงก่อนแสดง
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('ไม่สามารถเปิดรูปภาพจาก URL ที่ระบุได้'));
            img.src = source;
          });
          if (!cancelled) setPreview({ kind: 'image', src: source });
          return;
        }
        if (isPdf) {
          const bytes = await loadBytes(resolved);
          const task = (pdfjsLib as any).getDocument({ data: new Uint8Array(bytes) });
          const pdf = await task.promise;
          const page = await pdf.getPage(1);
          const baseViewport = page.getViewport({ scale: 1 });
          const targetWidth = compact ? 700 : 1000;
          const viewport = page.getViewport({ scale: Math.min(targetWidth / baseViewport.width, 1.8) });
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext('2d');
          if (!context) throw new Error('ไม่สามารถสร้างภาพตัวอย่าง PDF ได้');
          await page.render({ canvasContext: context, viewport }).promise;
          const src = canvas.toDataURL('image/png');
          if (!cancelled) setPreview({ kind: 'image', src });
          return;
        }
        if (isDocx) {
          const bytes = await loadBytes(resolved);
          const result = await mammoth.convertToHtml({ arrayBuffer: bytes });
          if (!result.value.trim()) throw new Error('เอกสารไม่มีข้อความที่แปลงเป็นตัวอย่างได้');
          if (!cancelled) setPreview({ kind: 'word', html: result.value });
          return;
        }
        if (isLegacyDoc) throw new Error('ไฟล์ .doc รุ่นเก่าไม่รองรับการสร้างตัวอย่างอัตโนมัติ กรุณาบันทึกเป็น .docx แล้วแนบใหม่');
        throw new Error('ชนิดไฟล์นี้ยังไม่รองรับการสร้างภาพตัวอย่าง');
      } catch (error) {
        if (!cancelled) setPreview({ kind: 'error', message: error instanceof Error ? error.message : 'ไม่สามารถสร้างภาพตัวอย่างได้' });
      }
    };
    setPreview({ kind: 'loading' });
    void run();
    return () => { cancelled = true; };
  }, [file.id, file.name, file.dataUrl, file.base64, file.url, file.mimeType, file.type, compact, isImage, isPdf, isDocx, isLegacyDoc, source]);

  const frameClass = compact
    ? 'w-full max-h-[180px] min-h-[100px]'
    : 'w-full max-h-[320px] min-h-[140px]';

  return (
    <div className="evidence-preview-card min-w-0 border border-slate-200 rounded-lg p-2 bg-white break-inside-avoid">
      <div className={`${frameClass} overflow-hidden flex items-start justify-center bg-slate-50 border border-slate-100 rounded`}>
        {preview.kind === 'loading' && <span className="p-4 text-xs text-slate-500">กำลังสร้างตัวอย่างเอกสาร…</span>}
        {preview.kind === 'image' && <img src={preview.src} alt={`ตัวอย่างไฟล์ ${file.name}`} className={`block max-w-full ${compact ? 'max-h-[160px]' : 'max-h-[300px]'} w-auto h-auto object-contain`} />}
        {preview.kind === 'word' && (
          <div className={`word-first-page w-full ${compact ? 'max-h-[160px]' : 'max-h-[300px]'} overflow-hidden bg-white p-3 text-[10px] leading-snug text-slate-800`} dangerouslySetInnerHTML={{ __html: preview.html }} />
        )}
        {preview.kind === 'error' && <div className="p-3 text-center text-xs text-amber-800"><div className="font-semibold mb-1">สร้างตัวอย่างไม่ได้</div>{preview.message}</div>}
      </div>
      <div className="mt-2 text-[11px] leading-snug text-slate-700 break-words">
        <strong className="block">{file.name || `ไฟล์แนบ ${index + 1}`}</strong>
        <span className="text-slate-500">{isImage ? 'ภาพจริง' : isPdf ? 'ตัวอย่างหน้าแรกของ PDF' : isDocx ? 'ตัวอย่างเนื้อหา DOCX' : isLegacyDoc ? 'เอกสาร Word' : 'ไฟล์แนบ'}{file.size ? ` • ${(file.size / 1024).toFixed(file.size >= 1024 * 1024 ? 0 : 1)} KB` : ''}</span>
      </div>
    </div>
  );
};
