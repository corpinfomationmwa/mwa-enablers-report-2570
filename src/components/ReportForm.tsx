import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  PlusCircle,
  Trash2,
  Calendar,
  User,
  Building2,
  Phone,
  Mail,
  FileCheck2,
  AlertCircle,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  FileText,
  Eye,
  FileCheck,
  History,
  Loader2
} from 'lucide-react';
import {
  CommunicationDetailItem,
  EvidenceLinkItem,
  AttachedEvidenceFile,
  CreateReportInput,
  EnablersReport
} from '../types/enablers';
import {
  MWA_AFFILIATION_DEPARTMENT_MAP,
  ENABLERS_EXECUTIVE_TOPICS
} from '../config/enablersConfig';
import {
  FISCAL_YEAR_TARGET,
  getFiscalQuarterFromMonthName,
  FISCAL_QUARTERS_INFO
} from '../utils/fiscalYear';
import enablersApiService from '../services/enablersApiService';
import { sendConfirmationEmail } from '../services/emailService';
import {
  generateSubmissionId,
  saveFormDraft,
  getFormDraft,
  clearFormDraft,
  hasFormDraft,
  EnablersFormDraft
} from '../utils/draftStorage';
import { verifySavedRecord } from '../utils/saveVerification';
import { currentPdfStore } from '../utils/currentPdfStore';
import { PdfViewerModal, generateThaiPdfBlob } from './PdfViewerModal';
import { syncReportToGoogleSheetSafe } from '../services/googleSheetSync';

interface ReportFormProps {
  onSuccess: (newReport: EnablersReport) => void;
  onCancel?: () => void;
}

// 12 เดือนในรอบปีงบประมาณ 2570 เรียงตามลำดับดำเนินงานจริง (ไม่มี Q1/Q2/Q3/Q4 ใน Dropdown)
const FISCAL_12_MONTHS_NAMES = [
  'ตุลาคม 2569',
  'พฤศจิกายน 2569',
  'ธันวาคม 2569',
  'มกราคม 2570',
  'กุมภาพันธ์ 2570',
  'มีนาคม 2570',
  'เมษายน 2570',
  'พฤษภาคม 2570',
  'มิถุนายน 2570',
  'กรกฎาคม 2570',
  'สิงหาคม 2570',
  'กันยายน 2570'
];

// รายการคำแนะนำตำแหน่งเริ่มต้น (PATCH-Q ข้อ 2)
const POSITION_SUGGESTIONS = [
  'นักประชาสัมพันธ์',
  'นักวิทยาศาสตร์',
  'นักบริหารงาน',
  'นักการตลาด',
  'นักทรัพยากรบุคคล',
  'นักวิเคราะห์นโยบายและแผน',
  'นักวิชาการ',
  'นักบัญชี',
  'นักกฎหมาย',
  'วิศวกร',
  'สถาปนิก',
  'นักเทคโนโลยีสารสนเทศ',
  'เจ้าหน้าที่บริหารงานทั่วไป',
  'เจ้าหน้าที่การเงิน',
  'เจ้าหน้าที่พัสดุ',
];

// รายการคำแนะนำช่องทางการสื่อสาร (PATCH-Q ข้อ 9: Non-blocking Hints)
const CHANNEL_HINTS = [
  'Line',
  'Facebook',
  'Email',
  'เว็บไซต์',
  'ประชุม',
  'หนังสือเวียน',
  'Intranet',
  'MWA onMobile'
];

// Local-only memory key สำหรับตำแหน่งที่เคยใช้
const RECENT_POSITIONS_STORAGE_KEY = 'mwa_recent_positions_v1';

function getStoredRecentPositions(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_POSITIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecentPosition(pos: string): void {
  if (typeof window === 'undefined' || !pos || !pos.trim()) return;
  try {
    const clean = pos.trim();
    const existing = getStoredRecentPositions().filter(p => p !== clean);
    const updated = [clean, ...existing].slice(0, 10);
    localStorage.setItem(RECENT_POSITIONS_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

// Matching function: Prefix match first, substring match second, case-insensitive, whitespace normalized
function matchPositionSuggestions(query: string, allSuggestions: string[]): string[] {
  const normalizedQuery = query.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!normalizedQuery) return [];

  const prefixMatches: string[] = [];
  const substringMatches: string[] = [];

  for (const item of allSuggestions) {
    const normalizedItem = item.trim().replace(/\s+/g, ' ').toLowerCase();
    if (normalizedItem.startsWith(normalizedQuery)) {
      prefixMatches.push(item);
    } else if (normalizedItem.includes(normalizedQuery)) {
      substringMatches.push(item);
    }
  }

  return [...prefixMatches, ...substringMatches];
}

// Highlighting component for matched text inside autocomplete
const HighlightMatch: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  const cleanQ = query.trim().toLowerCase();
  if (!cleanQ) return <span>{text}</span>;

  const idx = text.toLowerCase().indexOf(cleanQ);
  if (idx === -1) return <span>{text}</span>;

  const before = text.slice(0, idx);
  const matched = text.slice(idx, idx + cleanQ.length);
  const after = text.slice(idx + cleanQ.length);

  return (
    <span>
      {before}
      <span className="font-bold text-[#1976d2] bg-blue-100/70 rounded px-0.5">{matched}</span>
      {after}
    </span>
  );
};

interface SubmissionSuccessData {
  report: EnablersReport;
  submissionId: string;
  emailSent: boolean;
  emailMessage: string;
  sheetSynced: boolean;
  sheetMessage: string;
  driveUploaded?: boolean;
  pdfGenerated: boolean;
}

// Helper จัดรูปแบบขนาดไฟล์
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Helper ประเภทไฟล์
function getFileTypeLabel(filename: string, mime?: string): string {
  const ext = filename.split('.').pop()?.toUpperCase() || '';
  if (ext === 'PDF' || (mime && mime.includes('pdf'))) return 'PDF';
  if (['JPG', 'JPEG', 'PNG'].includes(ext) || (mime && mime.includes('image'))) return ext || 'IMG';
  return ext || 'FILE';
}

// Helper แปลงไฟล์เป็น Base64 Data URL
const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const ReportForm: React.FC<ReportFormProps> = ({ onSuccess }) => {
  // 1. ข้อมูลผู้รายงาน
  const [recorderFirstName, setRecorderFirstName] = useState('');
  const [recorderSurname, setRecorderSurname] = useState('');
  const [recorderPosition, setRecorderPosition] = useState(''); // ตำแหน่ง (Text Input)
  const [recorderAffiliation, setRecorderAffiliation] = useState(''); // สายงาน
  const [recorderDept, setRecorderDept] = useState(''); // หน่วยงาน
  const [recorderPlace] = useState('การประปานครหลวง'); // ตัดออกจาก UI แต่คงค่า fallback ใน payload
  const [recorderPhone, setRecorderPhone] = useState('');
  const [recorderEmail, setRecorderEmail] = useState('');

  // 2. ข้อมูลรอบการสื่อสาร (เริ่มที่ ต.ค. 2569)
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

  // 3. รายการรายละเอียดการสื่อสาร (แต่ละประเด็นแนบไฟล์ได้สูงสุด 3 ไฟล์)
  const [communicationDetails, setCommunicationDetails] = useState<CommunicationDetailItem[]>([
    {
      id: 'item-1',
      communicator: '',
      channel: '',
      recipients: '',
      details: '',
      attachmentDetails: '',
      evidenceFiles: []
    }
  ]);

  // 4. ปัญหา อุปสรรค และข้อเสนอแนะ
  const [problems, setProblems] = useState('');
  const [suggestions, setSuggestions] = useState('');

  // File Input References
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Submission & Duplicate Guard States
  const [submissionId, setSubmissionId] = useState<string>(() => generateSubmissionId());
  const [submitStep, setSubmitStep] = useState<string>('');
  const [hasDraftNotice, setHasDraftNotice] = useState<string | null>(null);
  const [isRetryingEmail, setIsRetryingEmail] = useState<boolean>(false);
  const [isRetryingSheet, setIsRetryingSheet] = useState<boolean>(false);
  const submitLockRef = useRef<boolean>(false);
  const isInitialMount = useRef<boolean>(true);

  // UI States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<SubmissionSuccessData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activePdfReport, setActivePdfReport] = useState<EnablersReport | null>(null);
  const [detectedDraft, setDetectedDraft] = useState<EnablersFormDraft | null>(null);
  const [validationErrors, setValidationErrors] = useState<Array<{ section: string; message: string }> | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState<boolean>(true);

  // Position Autocomplete State (PATCH-Q)
  const [isPositionDropdownOpen, setIsPositionDropdownOpen] = useState(false);
  const [activePositionIndex, setActivePositionIndex] = useState(-1);
  const positionWrapperRef = useRef<HTMLDivElement>(null);
  const [storedPositions, setStoredPositions] = useState<string[]>([]);

  // Pipeline Step State for Processing Modal (PATCH-Q)
  type PipelineStepState = 'pending' | 'running' | 'done' | 'error';
  interface PipelineStatus {
    save: PipelineStepState;
    verify: PipelineStepState;
    pdf: PipelineStepState;
    email: PipelineStepState;
  }
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>({
    save: 'pending',
    verify: 'pending',
    pdf: 'pending',
    email: 'pending'
  });

  // Load stored positions on mount
  useEffect(() => {
    setStoredPositions(getStoredRecentPositions());
  }, []);

  // Click outside to close position autocomplete dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        positionWrapperRef.current &&
        !positionWrapperRef.current.contains(e.target as Node)
      ) {
        setIsPositionDropdownOpen(false);
        setActivePositionIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Compute matching positions for autocomplete
  const allPositionCandidates = Array.from(
    new Set([...POSITION_SUGGESTIONS, ...storedPositions])
  );
  const matchingPositions = matchPositionSuggestions(recorderPosition, allPositionCandidates);

  // Handle position select
  const handleSelectPosition = (pos: string) => {
    setRecorderPosition(pos);
    setIsPositionDropdownOpen(false);
    setActivePositionIndex(-1);
    saveRecentPosition(pos);
    setStoredPositions(getStoredRecentPositions());
  };

  // Keyboard navigation for position autocomplete
  const handlePositionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isPositionDropdownOpen || matchingPositions.length === 0) {
      if (e.key === 'ArrowDown' && matchingPositions.length > 0) {
        e.preventDefault();
        setIsPositionDropdownOpen(true);
        setActivePositionIndex(0);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActivePositionIndex(prev =>
          prev < matchingPositions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActivePositionIndex(prev =>
          prev > 0 ? prev - 1 : matchingPositions.length - 1
        );
        break;
      case 'Enter':
        if (activePositionIndex >= 0 && activePositionIndex < matchingPositions.length) {
          e.preventDefault(); // Stop Enter from submitting form!
          handleSelectPosition(matchingPositions[activePositionIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsPositionDropdownOpen(false);
        setActivePositionIndex(-1);
        break;
      case 'Tab':
        setIsPositionDropdownOpen(false);
        setActivePositionIndex(-1);
        break;
      default:
        break;
    }
  };

  // Helper สำหรับแปลงเวลา draft เป็น HH:mm น.
  const formatDraftTime = (updatedAtStr?: string): string => {
    if (!updatedAtStr) return '-';
    try {
      const d = new Date(updatedAtStr);
      if (isNaN(d.getTime())) return updatedAtStr;
      const hours = d.getHours().toString().padStart(2, '0');
      const minutes = d.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes} น.`;
    } catch {
      return updatedAtStr;
    }
  };

  // 1. ตรวจสอบข้อมูลแบบร่าง (PATCH-O: Check Draft on Mount)
  useEffect(() => {
    if (hasFormDraft()) {
      const draft = getFormDraft();
      if (draft) {
        setDetectedDraft(draft);
      }
    }
  }, []);

  // กู้คืนข้อมูลแบบร่างเข้าสู่ฟอร์ม
  const handleRestoreDraft = (draft: EnablersFormDraft) => {
    if (draft.submissionId) setSubmissionId(draft.submissionId);
    // รองรับแบบร่างเก่าที่เก็บชื่อ-นามสกุลรวมไว้ใน recorderName
    if (draft.recorderName) {
      const parts = draft.recorderName.trim().split(/\s+/);
      setRecorderFirstName(parts.shift() || '');
      setRecorderSurname(parts.join(' '));
    }
    if ((draft as any).recorderFirstName) setRecorderFirstName((draft as any).recorderFirstName);
    if ((draft as any).recorderSurname) setRecorderSurname((draft as any).recorderSurname);
    if (draft.recorderPosition) setRecorderPosition(draft.recorderPosition);
    if (draft.recorderAffiliation) setRecorderAffiliation(draft.recorderAffiliation);
    if (draft.recorderDept) setRecorderDept(draft.recorderDept);
    if (draft.recorderPhone) setRecorderPhone(draft.recorderPhone);
    if (draft.recorderEmail) setRecorderEmail(draft.recorderEmail);
    if (draft.selectedMonth) setSelectedMonth(draft.selectedMonth);
    if (Array.isArray(draft.selectedTopics)) setSelectedTopics(draft.selectedTopics);
    if (draft.problems) setProblems(draft.problems);
    if (draft.suggestions) setSuggestions(draft.suggestions);
    if (draft.communicationDetails && draft.communicationDetails.length > 0) {
      let hadAttachments = false;
      const restoredDetails = draft.communicationDetails.map(d => {
        if (d.evidenceFilesMeta && d.evidenceFilesMeta.length > 0) {
          hadAttachments = true;
        }
        return {
          id: d.id,
          communicator: d.communicator || '',
          channel: d.channel || '',
          recipients: d.recipients || '',
          details: d.details || '',
          attachmentDetails: d.attachmentDetails || '',
          evidenceFiles: []
        };
      });
      setCommunicationDetails(restoredDetails);
      if (hadAttachments) {
        setHasDraftNotice('กู้คืนแบบร่างเรียบร้อยแล้ว (ไฟล์แนบต้องเลือกใหม่)');
      } else {
        setHasDraftNotice('กู้คืนแบบร่างเรียบร้อยแล้ว');
      }
    } else {
      setHasDraftNotice('กู้คืนแบบร่างเรียบร้อยแล้ว');
    }
    setDetectedDraft(null);
  };

  // เริ่มกรอกใหม่ (ล้างแบบร่างและ reset ฟอร์ม)
  const handleDiscardDraft = () => {
    clearFormDraft();
    setDetectedDraft(null);
    setSubmissionId(generateSubmissionId());
    setRecorderFirstName('');
    setRecorderSurname('');
    setRecorderPosition('');
    setRecorderAffiliation('');
    setRecorderDept('');
    setRecorderPhone('');
    setRecorderEmail('');
    setSelectedMonth('');
    setSelectedTopics([]);
    setProblems('');
    setSuggestions('');
    setCommunicationDetails([
      {
        id: `item-${Date.now()}`,
        communicator: '',
        channel: '',
        recipients: '',
        details: '',
        attachmentDetails: '',
        evidenceFiles: []
      }
    ]);
    setHasDraftNotice(null);
  };

  // 2. บันทึกแบบร่างอัตโนมัติ (Autosave Debounced 750ms)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (isSubmitting || submissionSuccess || detectedDraft) return;

    const timer = setTimeout(() => {
      const hasAnyContent =
        recorderFirstName.trim() ||
        recorderSurname.trim() ||
        recorderPosition.trim() ||
        recorderDept.trim() ||
        problems.trim() ||
        suggestions.trim() ||
        communicationDetails.some(d => d.details.trim() || d.communicator.trim());

      if (hasAnyContent) {
        saveFormDraft({
          submissionId,
          recorderName: `${recorderFirstName.trim()} ${recorderSurname.trim()}`.trim(),
          recorderFirstName,
          recorderSurname,
          recorderPosition,
          recorderAffiliation,
          recorderDept,
          recorderPhone,
          recorderEmail,
          selectedMonth,
          selectedTopics,
          communicationDetails: communicationDetails.map(d => ({
            id: d.id,
            communicator: d.communicator,
            channel: d.channel,
            recipients: d.recipients,
            details: d.details,
            attachmentDetails: d.attachmentDetails,
            evidenceFilesMeta: (d.evidenceFiles || []).map(f => ({
              name: f.name,
              size: f.size,
              type: f.type,
              mimeType: f.mimeType
            }))
          })),
          problems,
          suggestions,
          updatedAt: new Date().toISOString()
        });
      }
    }, 750);

    return () => clearTimeout(timer);
  }, [
    submissionId,
    recorderFirstName,
    recorderSurname,
    recorderPosition,
    recorderAffiliation,
    recorderDept,
    recorderPhone,
    recorderEmail,
    selectedMonth,
    selectedTopics,
    communicationDetails,
    problems,
    suggestions,
    isSubmitting,
    submissionSuccess
  ]);

  // หน่วยงานที่มีให้เลือกตามสายงานที่เลือก
  const availableDepartments = recorderAffiliation
    ? MWA_AFFILIATION_DEPARTMENT_MAP[recorderAffiliation] || []
    : [];

  // เมื่อเปลี่ยนสายงาน ต้อง clear หน่วยงานเดิมก่อน
  const handleAffiliationChange = (newAffiliation: string) => {
    setRecorderAffiliation(newAffiliation);
    setRecorderDept('');
  };

  // คำนวณไตรมาสปีงบประมาณอัตโนมัติจากเดือนที่เลือก
  const currentQuarter = getFiscalQuarterFromMonthName(selectedMonth);
  const quarterInfo = FISCAL_QUARTERS_INFO[currentQuarter];

  // Helper สำหรับ Topic checkboxes (Enablers 8 ด้าน)
  const handleToggleTopic = (topic: string) => {
    if (selectedTopics.includes(topic)) {
      setSelectedTopics(selectedTopics.filter(t => t !== topic));
    } else {
      setSelectedTopics([...selectedTopics, topic]);
    }
  };

  // จัดการรายการสื่อสาร
  const handleAddCommunicationItem = () => {
    setCommunicationDetails([
      ...communicationDetails,
      {
        id: `item-${Date.now()}`,
        communicator: '',
        channel: '',
        recipients: '',
        details: '',
        attachmentDetails: '',
        evidenceFiles: []
      }
    ]);
  };

  const handleRemoveCommunicationItem = (index: number) => {
    if (communicationDetails.length <= 1) return;
    const updated = [...communicationDetails];
    updated.splice(index, 1);
    setCommunicationDetails(updated);
  };

  const handleUpdateCommunicationItem = (index: number, field: keyof CommunicationDetailItem, value: string) => {
    const updated = [...communicationDetails];
    updated[index] = { ...updated[index], [field]: value };
    setCommunicationDetails(updated);
  };

  // จัดการไฟล์แนบจริง (สูงสุด 3 ไฟล์ต่อ 1 ประเด็น)
  const processFiles = async (newFiles: File[], topicIndex: number) => {
    setErrorMessage(null);
    const currentItem = communicationDetails[topicIndex];
    const currentFiles = currentItem.evidenceFiles || [];

    if (currentFiles.length >= 3) {
      setErrorMessage(`ประเด็นที่ ${topicIndex + 1} แนบไฟล์ครบ 3 ไฟล์แล้ว ไม่สามารถเพิ่มเกิน 3 ไฟล์ได้`);
      return;
    }

    const allowedExtensions = ['jpg', 'jpeg', 'png', 'pdf'];
    const validFiles = newFiles.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ext && allowedExtensions.includes(ext);
    });

    if (validFiles.length < newFiles.length) {
      setErrorMessage('รองรับเฉพาะไฟล์ประเภท JPG, JPEG, PNG, และ PDF เท่านั้น');
    }

    const remainingSlots = 3 - currentFiles.length;
    if (validFiles.length > remainingSlots) {
      setErrorMessage(
        `แนบไฟล์หลักฐานได้สูงสุด 3 ไฟล์ต่อประเด็นการสื่อสาร (ระบบจะรับเพียง ${remainingSlots} ไฟล์แรก)`
      );
    }

    const filesToProcess = validFiles.slice(0, remainingSlots);
    if (filesToProcess.length === 0) return;

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per file
    const oversizedFiles = filesToProcess.filter(f => f.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      setErrorMessage(
        `ไฟล์ "${oversizedFiles.map(f => f.name).join(', ')}" มีขนาดเกิน 10 MB กรุณาเลือกไฟล์ที่มีขนาดไม่เกิน 10 MB ต่อไฟล์`
      );
      return;
    }

    const processedList: AttachedEvidenceFile[] = [];
    for (const f of filesToProcess) {
      try {
        const dataUrl = await readFileAsDataUrl(f);
        const fileItem: AttachedEvidenceFile = {
          id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          name: f.name,
          size: f.size,
          type: getFileTypeLabel(f.name, f.type),
          mimeType: f.type,
          dataUrl,
          url: dataUrl
        };
        processedList.push(fileItem);
      } catch (err) {
        console.warn('File read error:', err);
      }
    }

    if (processedList.length > 0) {
      currentPdfStore.cacheEvidenceFiles(processedList);
    }

    const updated = [...communicationDetails];
    updated[topicIndex] = {
      ...updated[topicIndex],
      evidenceFiles: [...currentFiles, ...processedList]
    };
    setCommunicationDetails(updated);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, topicIndex: number) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processFiles(Array.from(files), topicIndex);
    e.target.value = '';
  };

  const handleFileDrop = async (e: React.DragEvent<HTMLDivElement>, topicIndex: number) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    await processFiles(Array.from(files), topicIndex);
  };

  const handleRemoveFile = (topicIndex: number, fileIndex: number) => {
    const updated = [...communicationDetails];
    const currentFiles = [...(updated[topicIndex].evidenceFiles || [])];
    currentFiles.splice(fileIndex, 1);
    updated[topicIndex] = {
      ...updated[topicIndex],
      evidenceFiles: currentFiles
    };
    setCommunicationDetails(updated);
  };

  // Submit Handler: Flow SAVE -> VERIFY -> PDF -> EMAIL (PATCH-Q: 4 Verified Steps with Visual Transition)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setValidationErrors(null);

    // Validation — Collect dynamic missing fields (PATCH-P & PATCH-Q)
    const errors: Array<{ section: string; message: string }> = [];

    if (!recorderFirstName.trim()) {
      errors.push({ section: 'ชื่อผู้รายงาน', message: 'กรุณาระบุชื่อผู้รายงาน' });
    }
    if (!recorderSurname.trim()) {
      errors.push({ section: 'นามสกุลผู้รายงาน', message: 'กรุณาระบุนามสกุลผู้รายงาน' });
    }
    if (!selectedMonth) {
      errors.push({ section: 'เดือนที่ดำเนินการสื่อสาร', message: 'กรุณาเลือกเดือนที่ดำเนินการสื่อสาร' });
    }
    if (!recorderPosition.trim()) {
      errors.push({ section: 'ตำแหน่ง', message: 'กรุณากรอกตำแหน่ง' });
    }
    if (!recorderAffiliation) {
      errors.push({ section: 'สายงาน', message: 'กรุณาเลือกสายงาน' });
    }
    if (!recorderDept) {
      errors.push({ section: 'หน่วยงาน', message: 'กรุณาเลือกหน่วยงาน' });
    }
    if (!recorderEmail.trim()) {
      errors.push({ section: 'Email', message: 'กรุณากรอก Email' });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recorderEmail.trim())) {
      errors.push({ section: 'Email', message: 'รูปแบบ Email ไม่ถูกต้อง (เช่น user@mwa.co.th)' });
    }
    if (selectedTopics.length === 0) {
      errors.push({ section: 'ประเด็นการสื่อสาร Enablers', message: 'กรุณาเลือกประเด็นการสื่อสารอย่างน้อย 1 ด้าน' });
    }

    // ตรวจสอบรายการสื่อสารแต่ละประเด็น
    communicationDetails.forEach((item, index) => {
      const topicNum = index + 1;
      if (!item.communicator.trim()) {
        errors.push({ section: `ประเด็นที่ ${topicNum}`, message: 'กรุณากรอกผู้สื่อสาร' });
      }
      if (!item.channel.trim()) {
        errors.push({ section: `ประเด็นที่ ${topicNum}`, message: 'กรุณากรอกช่องทางการสื่อสาร' });
      }
      if (!item.recipients.trim()) {
        errors.push({ section: `ประเด็นที่ ${topicNum}`, message: 'กรุณากรอกกลุ่มเป้าหมาย/ผู้รับการสื่อสาร' });
      }
      if (!item.details.trim()) {
        errors.push({ section: `ประเด็นที่ ${topicNum}`, message: 'กรุณากรอกสาระสำคัญของการสื่อสาร' });
      }
    });

    // ตรวจสอบขนาดไฟล์หลักฐานรวมทั้งหมด
    let totalEvidenceSize = 0;
    communicationDetails.forEach(item => {
      (item.evidenceFiles || []).forEach(f => {
        totalEvidenceSize += (f.size || 0);
      });
    });
    if (totalEvidenceSize > 25 * 1024 * 1024) {
      errors.push({
        section: 'ไฟล์หลักฐาน',
        message: `ขนาดไฟล์หลักฐานรวมทั้งหมด (${(totalEvidenceSize / 1048576).toFixed(1)} MB) เกินขีดจำกัด 25 MB กรุณาลดขนาดไฟล์ก่อนส่งรายงาน`
      });
    }

    // หาก validation ไม่ผ่าน: ห้ามส่ง POST, ห้ามสร้าง PDF, ห้ามส่ง Email, ห้าม sync Sheet, ห้ามล้าง draft
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setPipelineStatus({
      save: 'running',
      verify: 'pending',
      pdf: 'pending',
      email: 'pending'
    });

    try {
      // รวบรวมไฟล์แนบทั้งหมดจากทุกประเด็น
      const allEvidenceFiles: AttachedEvidenceFile[] = [];
      communicationDetails.forEach(item => {
        if (item.evidenceFiles && item.evidenceFiles.length > 0) {
          allEvidenceFiles.push(...item.evidenceFiles);
        }
      });

      // Canonical file payload: เก็บ binary Data URL เพียงฟิลด์เดียวต่อไฟล์
      // ไฟล์เดิมจาก processFiles มีทั้ง dataUrl และ url ซึ่งมักเป็นข้อความเดียวกัน
      const canonicalEvidenceFiles: AttachedEvidenceFile[] = allEvidenceFiles.map(file => {
        const fileDataUrl = file.dataUrl || (file.url && file.url.startsWith('data:') ? file.url : undefined);
        const resolvedMime = file.mimeType || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : file.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
        return {
          id: file.id,
          name: file.name,
          size: file.size,
          type: file.type,
          mimeType: resolvedMime,
          ...(fileDataUrl ? { dataUrl: fileDataUrl } : {}),
          ...(file.base64 ? { base64: file.base64 } : {}),
          ...(file.url && !file.url.startsWith('data:') ? { url: file.url } : {})
        };
      });

      // แปลงเป็น evidence_links แบบ metadata เท่านั้น
      // ห้ามทำสำเนา dataUrl/Base64 ซ้ำใน evidence_links เพราะไฟล์จริงส่งใน evidenceFiles เพียงชุดเดียว
      const compiledEvidenceLinks: EvidenceLinkItem[] = allEvidenceFiles.map(f => ({
        id: f.id,
        title: f.name,
        url: (f.url && !f.url.startsWith('data:')) ? f.url : '',
        type: f.type === 'PDF' ? 'document' : 'image'
      }));

      // เก็บไฟล์จริงไว้เพียงตำแหน่งเดียวใน payload.evidenceFiles
      // ส่วน communication_details_text เก็บ metadata/ID สำหรับจับคู่กลับใน normalizeReportRow
      const compactCommunicationDetails = communicationDetails.map(item => ({
        ...item,
        evidenceFiles: (item.evidenceFiles || []).map(file => ({
          id: file.id,
          name: file.name,
          size: file.size,
          type: file.type,
          mimeType: file.mimeType,
          ...(file.url && !file.url.startsWith('data:') ? { url: file.url } : {})
        }))
      }));

      const payload: CreateReportInput = {
        submission_id: submissionId,
        submissionId: submissionId,
        recorder_name: `${recorderFirstName.trim()} ${recorderSurname.trim()}`.trim(),
        recorder_status: recorderPosition.trim(), // ตำแหน่ง
        recorder_affiliation: recorderAffiliation,
        recorder_dept: recorderDept,
        recorder_place: recorderPlace.trim() || 'การประปานครหลวง',
        recorder_phone: recorderPhone.trim(),
        recorder_email: recorderEmail.trim(),
        communication_month: selectedMonth,
        fiscal_year: FISCAL_YEAR_TARGET,
        fiscal_quarter: currentQuarter,
        executive_topics: selectedTopics,
        communication_details_text: compactCommunicationDetails,
        problems: problems.trim(),
        suggestions: suggestions.trim(),
        evidence_links: compiledEvidenceLinks,
        // Send metadata only to Supabase. Base64/Data URL attachments can make the Edge
        // Function request exceed its request limit and cause a non-2xx save failure.
        // Keep the original bytes in canonicalEvidenceFiles in browser memory for PDF,
        // email, and the existing Google Sheets sync later in this same submission flow.
        evidenceFiles: canonicalEvidenceFiles.map(({ dataUrl, base64, ...file }) => ({
          ...file,
          ...(file.url && file.url.startsWith('data:') ? { url: undefined } : {})
        }))
      };

      // 1. SAVE: บันทึกลงฐานข้อมูล / GAS (เริ่มบันทึกทันที ไม่มีการ delay ก่อน API)
      setSubmitStep('กำลังบันทึกข้อมูล...');
      const response = await enablersApiService.create(payload);

      if (!response.success || !response.data) {
        setPipelineStatus(p => ({ ...p, save: 'error' }));
        setErrorMessage(response.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        setIsSubmitting(false);
        setSubmitStep('');
        submitLockRef.current = false;
        return;
      }

      const savedReport = response.data;
      const verificationToken = response.verification_token;
      setPipelineStatus(p => ({ ...p, save: 'done' }));

      // Minimum visual transition (~350ms) สำหรับ Frontend animation เท่านั้น
      await new Promise(r => setTimeout(r, 350));

      // 2. VERIFY: ตรวจสอบข้อมูลจากฐานข้อมูล (Read-Back Verification)
      setSubmitStep('กำลังตรวจสอบข้อมูลที่บันทึก...');
      setPipelineStatus(p => ({ ...p, verify: 'running' }));
      const verifyResult = verifySavedRecord(payload, savedReport, submissionId);
      if (!verifyResult.success) {
        console.warn('[Verification] Mismatched fields:', verifyResult.mismatchFields);
        setPipelineStatus(p => ({ ...p, verify: 'error' }));
        setErrorMessage(`การตรวจสอบข้อมูลหลังบันทึกไม่ผ่าน: ${verifyResult.message}`);
        setIsSubmitting(false);
        setSubmitStep('');
        submitLockRef.current = false;
        return;
      }

      const verifyResponse = await enablersApiService.verify(savedReport.id, {
        status: 'verified',
        verified_by: 'ระบบตรวจสอบข้อมูลอัตโนมัติ (MWA Read-Back Verification)',
        verification_notes: verifyResult.message,
        submission_id: submissionId,
        verification_token: verificationToken
      });

      if (!verifyResponse.success || !verifyResponse.data) {
        setPipelineStatus(p => ({ ...p, verify: 'error' }));
        setErrorMessage(verifyResponse.error || 'เกิดข้อผิดพลาดในการรับรองข้อมูลในฐานข้อมูล');
        setIsSubmitting(false);
        setSubmitStep('');
        submitLockRef.current = false;
        return;
      }

      const verifiedReport = verifyResponse.data;
      setPipelineStatus(p => ({ ...p, verify: 'done' }));
      await new Promise(r => setTimeout(r, 350));

      // 3. PDF: สร้าง PDF Blob ฉบับแม่แบบ (Authoritative Document) และบันทึกลง Current PDF Store
      setSubmitStep('กำลังจัดทำเอกสาร PDF...');
      setPipelineStatus(p => ({ ...p, pdf: 'running' }));
      let pdfBlob: Blob | null = null;
      let pdfGenerated = false;
      try {
        // Build the authoritative PDF from the verified report plus the original file bytes
        // collected from the form. The database read-back may contain metadata-only evidence rows.
        // Reattach the canonical file payload before generating so PDF download and email share
        // exactly the same PDF Blob, including actual image/PDF/DOCX previews.
        const authoritativePdfReport: EnablersReport = {
          ...verifiedReport,
          evidenceFiles: canonicalEvidenceFiles,
          communication_details_text: (verifiedReport.communication_details_text || []).map((detail, index) => ({
            ...detail,
            evidenceFiles: communicationDetails[index]?.evidenceFiles || detail.evidenceFiles || []
          }))
        };
        pdfBlob = await generateThaiPdfBlob(authoritativePdfReport);
        if (pdfBlob) {
          currentPdfStore.setCurrentPdfBlob(verifiedReport.id, pdfBlob);
          pdfGenerated = true;
        }
      } catch (pdfErr) {
        console.warn('[PDF] Failed to pre-generate authoritative PDF:', pdfErr);
      }

      setPipelineStatus(p => ({ ...p, pdf: 'done' }));
      await new Promise(r => setTimeout(r, 350));

      // 4. EMAIL: ส่งอีเมลยืนยันพร้อมแนบไฟล์ PDF ฉบับเดียวกัน
      setSubmitStep('กำลังส่ง Email...');
      setPipelineStatus(p => ({ ...p, email: 'running' }));
      let emailResult: any = {
        success: false,
        message: 'ไม่ได้ระบุ Email',
        status: 'EMAIL_FAILED',
        emailSent: false
      };
      if (recorderEmail.trim()) {
        emailResult = await sendConfirmationEmail(verifiedReport, submissionId, pdfBlob);
      }

      // ตรวจสอบสถานะความสำเร็จของ Email ตามเงื่อนไข PATCH-Q ข้อ 12
      const emailSuccess =
        emailResult?.success === true &&
        (
          emailResult?.status === 'EMAIL_SENT' ||
          emailResult?.status === 'EMAIL_SUCCESS' ||
          emailResult?.emailSent === true ||
          emailResult?.stage === 'EMAIL_SUCCESS'
        );

      if (emailSuccess) {
        setPipelineStatus(p => ({ ...p, email: 'done' }));
      } else {
        setPipelineStatus(p => ({ ...p, email: 'error' }));
      }
      await new Promise(r => setTimeout(r, 400));

      // 5. GOOGLE SHEET: ซิงก์ข้อมูลสรุปไปยัง Google Sheet (Non-Blocking Safe Sync)
      // ผนวกไฟล์หลักฐานตัวจริงที่มี Data URL/Base64 เพื่อให้อัปโหลดเข้า Google Drive ได้สมบูรณ์
      // และเก็บรักษาข้อมูลไฟล์ไว้ใน currentPdfStore สำหรับ Preview / Print
      currentPdfStore.setEvidenceFiles(verifiedReport.id, canonicalEvidenceFiles);
      currentPdfStore.setEvidenceFiles(submissionId, canonicalEvidenceFiles);

      const reportForGoogleSheet: EnablersReport = {
        ...verifiedReport,
        evidenceFiles: (canonicalEvidenceFiles && canonicalEvidenceFiles.length > 0)
          ? canonicalEvidenceFiles
          : (verifiedReport.evidenceFiles || []),
        evidence_files: (canonicalEvidenceFiles && canonicalEvidenceFiles.length > 0)
          ? canonicalEvidenceFiles
          : (verifiedReport.evidence_files || []),
        communication_details_text: (verifiedReport.communication_details_text || []).map((detail, index) => ({
          ...detail,
          evidenceFiles: communicationDetails[index]?.evidenceFiles || detail.evidenceFiles || []
        }))
      };
      const sheetResult = await syncReportToGoogleSheetSafe(reportForGoogleSheet, submissionId);

      // 6. CLEAR DRAFT & SAVE RECENT POSITION
      clearFormDraft();
      setHasDraftNotice(null);
      saveRecentPosition(recorderPosition);
      setStoredPositions(getStoredRecentPositions());

      // Success UI state
      setSubmissionSuccess({
        report: reportForGoogleSheet,
        submissionId,
        emailSent: emailSuccess,
        emailMessage: emailResult.message || (emailSuccess ? 'ส่ง Email สำเร็จ' : 'ส่ง Email ไม่สำเร็จ'),
        sheetSynced: sheetResult.success,
        sheetMessage: sheetResult.message,
        driveUploaded: sheetResult.driveUploaded,
        pdfGenerated
      });

      // PATCH-R: แสดง Success Modal เป็นหลัก และห้ามเปิด PDF Viewer อัตโนมัติ
      setActivePdfReport(null);
      setIsStatusModalOpen(true);

      submitLockRef.current = false;
      onSuccess(verifiedReport);
    } catch (err: any) {
      submitLockRef.current = false;
      setErrorMessage(err.message || 'ไม่สามารถบันทึกข้อมูลได้');
    } finally {
      setIsSubmitting(false);
      setSubmitStep('');
    }
  };

  // Retry sending email
  const handleRetryEmail = async () => {
    if (!submissionSuccess || isRetryingEmail) return;
    setIsRetryingEmail(true);
    try {
      const pdf = currentPdfStore.getCurrentPdfBlob(submissionSuccess.report.id);
      const res = await sendConfirmationEmail(submissionSuccess.report, submissionSuccess.submissionId, pdf);
      setSubmissionSuccess(prev => prev ? {
        ...prev,
        emailSent: res.success,
        emailMessage: res.message
      } : null);

      // PATCH-R: หากส่งซ้ำแล้วสำเร็จ ให้เปิดแสดง Success Modal
      if (res.success) {
        setIsStatusModalOpen(true);
      }
    } finally {
      setIsRetryingEmail(false);
    }
  };

  // Retry syncing to Google Sheet
  const handleRetrySheet = async () => {
    if (!submissionSuccess || isRetryingSheet) return;
    setIsRetryingSheet(true);
    try {
      const res = await syncReportToGoogleSheetSafe(submissionSuccess.report, submissionSuccess.submissionId);
      setSubmissionSuccess(prev => prev ? {
        ...prev,
        sheetSynced: res.success,
        sheetMessage: res.message,
        driveUploaded: res.driveUploaded
      } : null);
    } finally {
      setIsRetryingSheet(false);
    }
  };

  // PATCH-R: ดูเอกสาร PDF จากการกดปุ่มของผู้ใช้ใน Success Modal
  const handleOpenPdfFromSuccessModal = () => {
    if (submissionSuccess) {
      setIsStatusModalOpen(false);
      setActivePdfReport(submissionSuccess.report);
    }
  };

  // Reset Form
  const handleReset = () => {
    setSubmissionSuccess(null);
    setIsStatusModalOpen(false);
    setActivePdfReport(null);
    setValidationErrors(null);
    setSubmissionId(generateSubmissionId());
    setSubmitStep('');
    setErrorMessage(null);
    setHasDraftNotice(null);
    setRecorderFirstName('');
    setRecorderSurname('');
    setRecorderPosition('');
    setRecorderAffiliation('');
    setRecorderDept('');
    setRecorderPhone('');
    setRecorderEmail('');
    setProblems('');
    setSuggestions('');
    setCommunicationDetails([
      {
        id: `item-${Date.now()}`,
        communicator: '',
        channel: '',
        recipients: '',
        details: '',
        attachmentDetails: '',
        evidenceFiles: []
      }
    ]);
    clearFormDraft();
  };

  return (
    <div className="w-full">
      {/* ========================================================
          SUCCESS UI (Section 14 Specification)
          SAVE -> VERIFY -> PDF -> EMAIL
         ======================================================== */}
      {submissionSuccess && (
        <div className="mb-6 p-6 sm:p-7 bg-emerald-50 border-2 border-emerald-400 rounded-[15px] shadow-[0_4px_20px_rgba(16,185,129,0.15)] text-emerald-950">
          <div className="flex items-start gap-4">
            <CheckCircle2 className="w-9 h-9 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-3 flex-1">
              <div>
                <h3 className="text-xl font-bold text-emerald-900">
                  {submissionSuccess.emailSent
                    ? 'บันทึกข้อมูลสำเร็จ'
                    : 'บันทึกข้อมูลสำเร็จ แต่การส่งอีเมลไม่สำเร็จ'}
                </h3>
                <p className="text-sm text-emerald-800 mt-0.5">
                  ระบบได้ประมวลผลข้อมูลการรายงานผล Enablers ประจำปีงบประมาณ {FISCAL_YEAR_TARGET} ครบถ้วนตามขั้นตอน
                </p>
              </div>

              {/* 5 Status Checkpoints */}
              <div className="bg-white/80 border border-emerald-200 rounded-[10px] p-3.5 space-y-2 text-xs sm:text-sm font-medium">
                <div className="flex items-center gap-2 text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>บันทึกข้อมูลลงฐานข้อมูลเรียบร้อยแล้ว</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>ตรวจสอบข้อมูลจากฐานข้อมูลสำเร็จแล้ว (Read-Back Verification Passed)</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>เอกสาร PDF ถูกสร้างและพร้อมใช้งาน {submissionSuccess.pdfGenerated ? '(ฉบับสมบูรณ์)' : ''}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {submissionSuccess.emailSent ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-emerald-800">ส่งอีเมลยืนยันเรียบร้อยแล้ว (แนบเอกสาร PDF แล้ว)</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="text-amber-800">
                          {recorderEmail.trim()
                            ? `การส่งอีเมลไม่สำเร็จ (${submissionSuccess.emailMessage || 'ไม่สามารถส่งได้'})`
                            : 'ไม่ได้ระบุอีเมลผู้บันทึก (ข้ามขั้นตอนส่งอีเมล)'}
                        </span>
                      </>
                    )}
                  </div>
                  {recorderEmail.trim() && !submissionSuccess.emailSent && (
                    <button
                      type="button"
                      onClick={handleRetryEmail}
                      disabled={isRetryingEmail}
                      className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded px-2 py-0.5 font-medium flex items-center gap-1 cursor-pointer transition disabled:opacity-50"
                    >
                      <RotateCcw className={`w-3 h-3 ${isRetryingEmail ? 'animate-spin' : ''}`} />
                      <span>{isRetryingEmail ? 'กำลังส่งซ้ำ...' : 'ส่งอีเมลซ้ำ'}</span>
                    </button>
                  )}
                </div>
                
              </div>

              {/* Record ID & Submission ID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="bg-white border border-emerald-300 p-2.5 rounded-[8px]">
                  <span className="text-[11px] text-slate-500 block">รหัสรายงาน (Record ID):</span>
                  <span className="font-mono text-sm font-bold text-emerald-800">
                    {submissionSuccess.report.id}
                  </span>
                </div>
                <div className="bg-white border border-emerald-300 p-2.5 rounded-[8px]">
                  <span className="text-[11px] text-slate-500 block">รหัสการส่ง (Submission ID):</span>
                  <span className="font-mono text-sm font-bold text-blue-700">
                    {submissionSuccess.submissionId}
                  </span>
                </div>
              </div>

              <div className="text-xs text-emerald-800 pt-1">
                ประจำเดือน: <span className="font-semibold">{submissionSuccess.report.communication_month}</span> | ผู้รายงาน: {submissionSuccess.report.recorder_name} ({submissionSuccess.report.recorder_status} • {submissionSuccess.report.recorder_dept})
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setActivePdfReport(submissionSuccess.report)}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-[8px] px-4 py-2 text-sm font-medium shadow-sm flex items-center gap-2 transition cursor-pointer"
                >
                  <Eye className="w-4 h-4 text-emerald-200" />
                  <span>เปิดดูเอกสาร PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="bg-gradient-to-r from-[#1976d2] to-[#42a5f5] text-white rounded-[8px] px-5 py-2 text-sm font-medium shadow-sm hover:opacity-95 transition cursor-pointer"
                >
                  บันทึกรายงานฉบับใหม่
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Draft Notification Banner */}
      {hasDraftNotice && !submissionSuccess && (
        <div className="mb-4 p-3.5 bg-blue-50 border border-blue-200 rounded-[10px] flex items-center justify-between text-blue-900 text-xs sm:text-sm shadow-sm">
          <div className="flex items-center gap-2.5">
            <FileText className="w-4 h-4 text-blue-600 shrink-0" />
            <span>{hasDraftNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              clearFormDraft();
              setHasDraftNotice(null);
              handleReset();
            }}
            className="text-blue-700 hover:text-blue-900 underline text-xs ml-3 cursor-pointer shrink-0"
          >
            ล้างแบบร่าง
          </button>
        </div>
      )}

      {/* Main Form Content - White card */}
      <div className="bg-white rounded-[15px] p-[20px] sm:p-[30px] shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
        <form onSubmit={handleSubmit} noValidate>
          {errorMessage && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-[8px] flex items-center gap-3 text-rose-800 text-sm">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ========================================================
              SECTION 1: ข้อมูลผู้รายงาน
              (ตัด กอง / ส่วน / สถานที่ปฏิบัติงาน ออกจาก UI แล้ว)
             ======================================================== */}
          <div className="bg-[#f8f9fa] border-l-[5px] border-[#1976d2] rounded-[12px] p-[20px] sm:p-[25px] mb-[30px] sm:mb-[35px] shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <h3 className="text-lg sm:text-xl font-semibold text-[#1976d2] flex items-center gap-2.5 mb-5">
              <User className="w-6 h-6 text-[#1976d2]" />
              <span>1. ข้อมูลผู้รายงาน</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  ชื่อ ผู้รายงาน <span className="text-[#f44336]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น สมเกียรติ"
                  value={recorderFirstName}
                  onChange={e => setRecorderFirstName(e.target.value)}
                  className="w-full bg-white border-2 border-[#e0e0e0] rounded-[8px] py-[12px] px-[15px] text-sm text-slate-800 focus:border-[#1976d2] focus:ring-2 focus:ring-[#90caf9]/50 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  นามสกุล ผู้รายงาน <span className="text-[#f44336]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ยิ่งเจริญ"
                  value={recorderSurname}
                  onChange={e => setRecorderSurname(e.target.value)}
                  className="w-full bg-white border-2 border-[#e0e0e0] rounded-[8px] py-[12px] px-[15px] text-sm text-slate-800 focus:border-[#1976d2] focus:ring-2 focus:ring-[#90caf9]/50 outline-none transition-all"
                />
              </div>

              {/* ตำแหน่ง (Text Input + Autocomplete Suggestion - PATCH-Q) */}
              <div ref={positionWrapperRef} className="relative">
                <label htmlFor="recorderPosition" className="block text-sm font-medium text-slate-700 mb-1.5">
                  ตำแหน่ง <span className="text-[#f44336]">*</span>
                </label>
                <input
                  id="recorderPosition"
                  type="text"
                  required
                  spellCheck={true}
                  autoCorrect="on"
                  autoCapitalize="words"
                  autoComplete="off"
                  placeholder="กรอกตำแหน่ง เช่น นักประชาสัมพันธ์ 5, ผอ.ฝ่าย"
                  value={recorderPosition}
                  onChange={e => {
                    setRecorderPosition(e.target.value);
                    setIsPositionDropdownOpen(true);
                    setActivePositionIndex(-1);
                  }}
                  onFocus={() => {
                    if (recorderPosition.trim().length > 0) {
                      setIsPositionDropdownOpen(true);
                    }
                  }}
                  onKeyDown={handlePositionKeyDown}
                  className="w-full bg-white border-2 border-[#e0e0e0] rounded-[8px] py-[12px] px-[15px] text-sm text-slate-800 focus:border-[#1976d2] focus:ring-2 focus:ring-[#90caf9]/50 outline-none transition-all"
                />

                {/* Autocomplete Suggestions Menu */}
                {isPositionDropdownOpen && recorderPosition.trim().length > 0 && matchingPositions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white border border-slate-200 rounded-[12px] shadow-lg max-h-56 overflow-y-auto overflow-x-hidden py-1 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between">
                      <span>คำแนะนำตำแหน่ง (เลือกหรือพิมพ์เองได้)</span>
                      <span>{matchingPositions.length} รายการ</span>
                    </div>
                    {matchingPositions.map((pos, idx) => {
                      const isActive = idx === activePositionIndex;
                      return (
                        <div
                          key={`${pos}-${idx}`}
                          onMouseDown={e => {
                            e.preventDefault();
                            handleSelectPosition(pos);
                          }}
                          onMouseEnter={() => setActivePositionIndex(idx)}
                          className={`px-3.5 py-2.5 text-xs sm:text-sm cursor-pointer transition-colors flex items-center justify-between ${
                            isActive
                              ? 'bg-blue-50 text-[#1976d2] font-medium'
                              : 'text-slate-700 hover:bg-slate-50'
                          } ${idx !== 0 ? 'border-t border-slate-100' : ''}`}
                        >
                          <HighlightMatch text={pos} query={recorderPosition} />
                          {isActive && (
                            <span className="text-[11px] text-blue-600 font-normal shrink-0 ml-2">
                              กด Enter เพื่อเลือก
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* เลือกสายงานก่อน */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  สายงาน <span className="text-[#f44336]">*</span>
                </label>
                <select
                  required
                  value={recorderAffiliation}
                  onChange={e => handleAffiliationChange(e.target.value)}
                  className="w-full bg-white border-2 border-[#e0e0e0] rounded-[8px] py-[12px] px-[15px] text-sm text-slate-800 focus:border-[#1976d2] focus:ring-2 focus:ring-[#90caf9]/50 outline-none transition-all"
                >
                  <option value="">-- กรุณาเลือกสายงาน --</option>
                  {Object.keys(MWA_AFFILIATION_DEPARTMENT_MAP).map(aff => (
                    <option key={aff} value={aff}>{aff}</option>
                  ))}
                </select>
              </div>

              {/* เมื่อเลือกสายงานแล้ว จึงแสดงเฉพาะหน่วยงานของสายงานนั้น */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  หน่วยงาน <span className="text-[#f44336]">*</span>
                </label>
                <select
                  required
                  disabled={!recorderAffiliation}
                  value={recorderDept}
                  onChange={e => setRecorderDept(e.target.value)}
                  className="w-full bg-white border-2 border-[#e0e0e0] rounded-[8px] py-[12px] px-[15px] text-sm text-slate-800 focus:border-[#1976d2] focus:ring-2 focus:ring-[#90caf9]/50 outline-none transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {recorderAffiliation ? '-- กรุณาเลือกหน่วยงาน --' : 'กรุณาเลือกสายงานก่อน'}
                  </option>
                  {availableDepartments.map((dept, idx) => (
                    <option key={`${dept}-${idx}`} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  เบอร์โทรศัพท์ติดต่อ / เบอร์ภายใน
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    placeholder="เช่น 02-500-2500 ต่อ 1234 หรือ 081-xxx-xxxx"
                    value={recorderPhone}
                    onChange={e => setRecorderPhone(e.target.value)}
                    className="w-full bg-white border-2 border-[#e0e0e0] rounded-[8px] py-[12px] pl-[38px] pr-[15px] text-sm text-slate-800 focus:border-[#1976d2] focus:ring-2 focus:ring-[#90caf9]/50 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Email (PATCH-Q: Label = Email *, placeholder = กรอก Email) */}
              <div>
                <label htmlFor="recorderEmail" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email <span aria-hidden="true" className="text-[#f44336]">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    id="recorderEmail"
                    type="email"
                    required
                    autoComplete="email"
                    spellCheck={false}
                    placeholder="กรอก Email"
                    value={recorderEmail}
                    onChange={e => setRecorderEmail(e.target.value)}
                    className="w-full bg-white border-2 border-[#e0e0e0] rounded-[8px] py-[12px] pl-[38px] pr-[15px] text-sm text-slate-800 focus:border-[#1976d2] focus:ring-2 focus:ring-[#90caf9]/50 outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================
              SECTION 2: ข้อมูลรอบการสื่อสาร & Enablers 8 ด้าน
              (เดือนเหลือเฉพาะ 12 เดือนของปีงบประมาณ 2570 ไม่มี Q1-Q4 ใน Dropdown)
             ======================================================== */}
          <div className="bg-[#f8f9fa] border-l-[5px] border-[#1976d2] rounded-[12px] p-[20px] sm:p-[25px] mb-[30px] sm:mb-[35px] shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <h3 className="text-lg sm:text-xl font-semibold text-[#1976d2] flex items-center justify-between mb-5">
              <span className="flex items-center gap-2.5">
                <Calendar className="w-6 h-6 text-[#1976d2]" />
                <span>2. ข้อมูลการสื่อสาร Enablers ประจำปีงบประมาณ {FISCAL_YEAR_TARGET}</span>
              </span>
            </h3>

            {/* เดือนที่ดำเนินการสื่อสาร (แสดงช่องเดือนช่องเดียว ไม่มีกล่องคำนวณไตรมาส) */}
            <div className="mb-5 bg-white p-4 rounded-[10px] border-2 border-[#e0e0e0]">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  เดือนที่ดำเนินการสื่อสาร <span className="text-[#f44336]">*</span>
                </label>
                <select
                  required
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="w-full bg-white border-2 border-[#e0e0e0] rounded-[8px] py-[12px] px-[15px] text-sm text-slate-800 focus:border-[#1976d2] focus:ring-2 focus:ring-[#90caf9]/50 outline-none transition-all"
                >
                  <option value="">-- กรุณาเลือกเดือน --</option>
                  {FISCAL_12_MONTHS_NAMES.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1.5">
                  * ตัวเลือกครอบคลุม 12 เดือนของปีงบประมาณ 2570 (ตุลาคม 2569 ถึง กันยายน 2570)
                </p>
              </div>
            </div>

            {/* ประเด็นสำคัญที่สื่อสาร - Enablers 8 ด้าน */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2.5">
                ประเด็นสำคัญที่ผู้บริหารสื่อสารตามเกณฑ์ Enablers 8 ด้าน <span className="text-[#f44336]">* (เลือกได้หลายข้อ)</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {ENABLERS_EXECUTIVE_TOPICS.map(topic => {
                  const isChecked = selectedTopics.includes(topic);
                  return (
                    <label
                      key={topic}
                      className={`bg-white border-2 rounded-[8px] p-[12px] transition-all cursor-pointer flex items-start gap-3 select-none ${
                        isChecked
                          ? 'border-[#1976d2] bg-[#e3f2fd]/40 shadow-xs'
                          : 'border-[#e0e0e0] hover:bg-[#e3f2fd] hover:border-[#90caf9]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleTopic(topic)}
                        className="mt-1 rounded text-[#1976d2] focus:ring-[#1976d2]"
                      />
                      <span className={`text-sm ${isChecked ? 'font-medium text-[#1976d2]' : 'text-slate-700'}`}>
                        {topic}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ========================================================
              SECTION 3: รายละเอียดการสื่อสาร
              (label: 3. รายละเอียดการสื่อสาร)
              (ผู้สื่อสาร: Text Input | ช่องทาง: Text Input
               ผู้รับสาร & สาระสำคัญ: Textarea ขนาดเท่ากัน กว้างเท่ากัน
               ตัด attachmentDetails ออกจาก UI
               แนบไฟล์จริงสูงสุด 3 ไฟล์ต่อประเด็น อยู่หลังสาระสำคัญ)
             ======================================================== */}
          <div className="bg-[#f8f9fa] border-l-[5px] border-[#1976d2] rounded-[12px] p-[20px] sm:p-[25px] mb-[30px] sm:mb-[35px] shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <h3 className="text-lg sm:text-xl font-semibold text-[#1976d2] flex items-center gap-2.5">
                <FileCheck2 className="w-6 h-6 text-[#1976d2]" />
                <span>3. รายละเอียดการสื่อสาร</span>
              </h3>

            </div>

            <div className="space-y-6">
              {communicationDetails.map((item, index) => {
                const files = item.evidenceFiles || [];
                const isMax = files.length >= 3;

                return (
                  <div
                    key={item.id || index}
                    className="bg-white border-2 border-[#e0e0e0] hover:border-[#1976d2] rounded-[12px] p-[20px] transition-colors space-y-5"
                  >
                    <div className="flex items-center justify-between border-b border-[#e0e0e0] pb-3">
                      <span className="text-sm font-semibold text-[#1976d2]">
                        ประเด็นการสื่อสารที่ #{index + 1}
                      </span>

                      {communicationDetails.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCommunicationItem(index)}
                          className="bg-[#f44336] text-white rounded-[8px] px-3 py-1.5 hover:bg-red-600 transition text-xs font-medium flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>ลบประเด็นนี้</span>
                        </button>
                      )}
                    </div>

                    {/* ผู้สื่อสาร & ช่องทางการสื่อสาร (Text Inputs) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          ผู้สื่อสาร <span className="text-[#f44336]">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          spellCheck={true}
                          placeholder="เช่น ผู้ว่าการ กปน., รองผู้ว่าการ (เทคโนโลยีดิจิทัล), ผอ.ฝ่าย"
                          value={item.communicator}
                          onChange={e => handleUpdateCommunicationItem(index, 'communicator', e.target.value)}
                          className="w-full bg-white border-2 border-[#e0e0e0] rounded-[8px] py-[12px] px-[15px] text-sm text-slate-800 focus:border-[#1976d2] focus:ring-2 focus:ring-[#90caf9]/50 outline-none transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          ช่องทางการสื่อสาร <span className="text-[#f44336]">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          spellCheck={true}
                          placeholder="เช่น การประชุมผู้บริหารระดับสูง, Line Official, Town Hall, Morning Talk"
                          value={item.channel}
                          onChange={e => handleUpdateCommunicationItem(index, 'channel', e.target.value)}
                          className="w-full bg-white border-2 border-[#e0e0e0] rounded-[8px] py-[12px] px-[15px] text-sm text-slate-800 focus:border-[#1976d2] focus:ring-2 focus:ring-[#90caf9]/50 outline-none transition-all"
                        />
                        {/* Non-blocking suggestion hint chips (PATCH-Q ข้อ 9) */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <span className="text-[11px] text-slate-400 mr-1">คำแนะนำ:</span>
                          {CHANNEL_HINTS.map(hint => (
                            <button
                              key={hint}
                              type="button"
                              onClick={() => {
                                const current = item.channel.trim();
                                if (!current) {
                                  handleUpdateCommunicationItem(index, 'channel', hint);
                                } else if (!current.includes(hint)) {
                                  handleUpdateCommunicationItem(index, 'channel', `${current}, ${hint}`);
                                }
                              }}
                              className="text-[11px] bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-[#1976d2] border border-slate-200 hover:border-blue-300 rounded-full px-2 py-0.5 cursor-pointer transition select-none"
                            >
                              + {hint}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* กลุ่มเป้าหมาย/ผู้รับสาร & สาระสำคัญของการสื่อสาร (Textareas ขนาดเท่ากัน) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          กลุ่มเป้าหมาย / ผู้รับการสื่อสาร <span className="text-[#f44336]">*</span>
                        </label>
                        <textarea
                          rows={4}
                          required
                          spellCheck={true}
                          placeholder="ระบุกลุ่มเป้าหมายหรือผู้รับการสื่อสาร เช่น ผู้บริหารระดับส่วนและพนักงาน ฝทด. ทุกคน (จำนวน 45 คน), คณะทำงาน Enablers..."
                          value={item.recipients}
                          onChange={e => handleUpdateCommunicationItem(index, 'recipients', e.target.value)}
                          className="w-full h-32 bg-white border-2 border-[#e0e0e0] rounded-[8px] py-[12px] px-[15px] text-sm text-slate-800 focus:border-[#1976d2] focus:ring-2 focus:ring-[#90caf9]/50 outline-none transition-all resize-y"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          สาระสำคัญของการสื่อสาร <span className="text-[#f44336]">*</span>
                        </label>
                        <textarea
                          rows={4}
                          required
                          spellCheck={true}
                          placeholder="ระบุข้อความ/สาระสำคัญในการขับเคลื่อน Enablers นโยบาย ข้อสั่งการ หรือแนวทางปฏิบัติ..."
                          value={item.details}
                          onChange={e => handleUpdateCommunicationItem(index, 'details', e.target.value)}
                          className="w-full h-32 bg-white border-2 border-[#e0e0e0] rounded-[8px] py-[12px] px-[15px] text-sm text-slate-800 focus:border-[#1976d2] focus:ring-2 focus:ring-[#90caf9]/50 outline-none transition-all resize-y"
                        />
                      </div>
                    </div>

                    {/* หลักฐาน / ไฟล์แนบจริง (อยู่หลังสาระสำคัญของการสื่อสารทันที สูงสุด 3 ไฟล์ต่อประเด็น) */}
                    <div className="pt-4 border-t border-[#e0e0e0] space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <UploadCloud className="w-4 h-4 text-[#1976d2]" />
                          <span>หลักฐาน / ภาพถ่าย / เอกสารประกอบ</span>
                        </label>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                            isMax
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-[#e3f2fd] text-[#1976d2]'
                          }`}
                        >
                          {files.length}/3 ไฟล์
                        </span>
                      </div>

                      {/* Drag and Drop Zone */}
                      <div
                        onClick={() => {
                          if (isMax) {
                            setErrorMessage(
                              `ประเด็นการสื่อสารที่ ${index + 1} แนบไฟล์ครบ 3 ไฟล์แล้ว (สูงสุด 3 ไฟล์ต่อประเด็น)`
                            );
                            return;
                          }
                          fileInputRefs.current[index]?.click();
                        }}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => handleFileDrop(e, index)}
                        className={`border-2 border-dashed rounded-[8px] p-5 text-center transition-all ${
                          isMax
                            ? 'border-slate-300 bg-slate-100/60 cursor-not-allowed opacity-75'
                            : 'border-[#1976d2] bg-[#f0f7ff]/50 hover:bg-[#e3f2fd]/60 cursor-pointer'
                        }`}
                      >
                        <input
                          type="file"
                          ref={el => {
                            fileInputRefs.current[index] = el;
                          }}
                          className="hidden"
                          accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                          multiple
                          disabled={isMax}
                          onChange={e => handleFileSelect(e, index)}
                        />
                        <UploadCloud
                          className={`w-8 h-8 mx-auto mb-1.5 ${
                            isMax ? 'text-slate-400' : 'text-[#1976d2]'
                          }`}
                        />
                        <p className="text-xs sm:text-sm font-medium text-slate-700">
                          {isMax
                            ? 'แนบไฟล์ครบ 3 ไฟล์แล้ว (ไม่สามารถเพิ่มไฟล์เกิน 3 ได้)'
                            : 'คลิกเพื่อเลือกไฟล์ หรือ ลากไฟล์มาวาง'}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          รองรับไฟล์ JPG, JPEG, PNG, PDF (สูงสุด 3 ไฟล์ต่อประเด็น)
                        </p>
                      </div>

                      {/* File List Cards */}
                      {files.length > 0 && (
                        <div className="space-y-2 pt-1">
                          {files.map((file, fileIdx) => (
                            <div
                              key={file.id || fileIdx}
                              className="bg-[#f8f9fa] border border-[#e0e0e0] hover:border-[#1976d2] rounded-[8px] p-2.5 flex items-center justify-between shadow-2xs transition-colors"
                            >
                              <div className="flex items-center gap-2.5 overflow-hidden pr-2">
                                <div className="w-8 h-8 rounded bg-[#e3f2fd] text-[#1976d2] flex items-center justify-center shrink-0 font-bold text-xs uppercase">
                                  {file.type || getFileTypeLabel(file.name, file.mimeType)}
                                </div>
                                <div className="truncate">
                                  <p
                                    className="text-xs font-medium text-slate-800 truncate"
                                    title={file.name}
                                  >
                                    {file.name}
                                  </p>
                                  <p className="text-[11px] text-slate-400">
                                    {formatFileSize(file.size)} •{' '}
                                    {file.type || getFileTypeLabel(file.name, file.mimeType)}
                                  </p>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveFile(index, fileIdx)}
                                className="bg-[#f44336] text-white rounded-[6px] px-2.5 py-1 text-xs hover:bg-red-600 transition flex items-center gap-1 shrink-0 cursor-pointer"
                                title="ลบไฟล์"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>ลบ</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleAddCommunicationItem}
                className="bg-gradient-to-r from-[#1976d2] to-[#42a5f5] text-white rounded-[8px] px-4 py-2 text-xs sm:text-sm font-medium flex items-center gap-1.5 shadow-sm hover:opacity-95 transition cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>เพิ่มประเด็นการสื่อสาร</span>
              </button>
            </div>
          </div>

          {/* ========================================================
              SECTION 4: ปัญหา อุปสรรค และข้อเสนอแนะ
             ======================================================== */}
          <div className="bg-[#f8f9fa] border-l-[5px] border-[#1976d2] rounded-[12px] p-[20px] sm:p-[25px] mb-[30px] sm:mb-[35px] shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <h3 className="text-lg sm:text-xl font-semibold text-[#1976d2] flex items-center gap-2.5 mb-5">
              <Building2 className="w-6 h-6 text-[#1976d2]" />
              <span>4. ปัญหา อุปสรรค และข้อเสนอแนะ</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  ปัญหาและอุปสรรคในการสื่อสาร/ขับเคลื่อน
                </label>
                <textarea
                  rows={3}
                  spellCheck={true}
                  placeholder="ระบุปัญหา อุปสรรค หรือข้อจำกัดที่พบในการดำเนินงาน..."
                  value={problems}
                  onChange={e => setProblems(e.target.value)}
                  className="w-full bg-white border-2 border-[#e0e0e0] rounded-[8px] py-[12px] px-[15px] text-sm text-slate-800 focus:border-[#1976d2] focus:ring-2 focus:ring-[#90caf9]/50 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  ข้อเสนอแนะในการปรับปรุงและพัฒนา
                </label>
                <textarea
                  rows={3}
                  spellCheck={true}
                  placeholder="ระบุข้อคิดเห็น หรือแนวทางแก้ไขที่เสนอแนะ..."
                  value={suggestions}
                  onChange={e => setSuggestions(e.target.value)}
                  className="w-full bg-white border-2 border-[#e0e0e0] rounded-[8px] py-[12px] px-[15px] text-sm text-slate-800 focus:border-[#1976d2] focus:ring-2 focus:ring-[#90caf9]/50 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Form Actions - Centered Submit Button */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 border-t border-[#e0e0e0]">
            <button
              type="button"
              onClick={handleReset}
              disabled={isSubmitting}
              className="w-full sm:w-auto bg-[#f5f5f5] text-slate-700 border border-[#e0e0e0] rounded-[8px] px-6 py-3 hover:bg-slate-200 transition text-sm font-medium cursor-pointer"
            >
              ล้างข้อมูล
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto bg-gradient-to-r from-[#1976d2] to-[#42a5f5] text-white rounded-[8px] px-8 py-3 text-base font-medium flex items-center justify-center gap-2 hover:opacity-95 shadow-[0_4px_15px_rgba(25,118,210,0.3)] transition disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{submitStep || 'กำลังส่งข้อมูล...'}</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>ส่งข้อมูล</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* PDF Viewer Modal (PATCH-R: เมื่อปิดให้กลับมาที่ Status Modal) */}
      {activePdfReport && (
        <PdfViewerModal
          report={activePdfReport}
          onClose={() => {
            setActivePdfReport(null);
            if (submissionSuccess) {
              setIsStatusModalOpen(true);
            }
          }}
        />
      )}

      {/* ========================================================
          1. VALIDATION MODAL (PATCH-P)
         ======================================================== */}
      {validationErrors && validationErrors.length > 0 && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] shadow-2xl max-w-md w-full p-6 sm:p-8 text-center relative border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Icon: Warning triangle in light yellow circle */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto mb-5">
              <AlertTriangle className="w-10 h-10 sm:w-12 sm:h-12 text-amber-500" />
            </div>

            {/* Title */}
            <h3 className="text-xl sm:text-2xl font-bold text-slate-800 text-center mb-2">
              กรุณากรอกข้อมูลให้ครบถ้วน
            </h3>

            {/* Body */}
            <div className="bg-[#f8fafc] border border-amber-100/80 rounded-2xl p-3 sm:p-4 mb-6 text-left max-h-60 overflow-y-auto space-y-2">
              {validationErrors.map((err, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-white border border-slate-200/70 shadow-xs">
                  <span className="text-xs font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-md inline-block mb-1">
                    {err.section}
                  </span>
                  <p className="text-xs sm:text-sm text-slate-700 font-medium">
                    {err.message}
                  </p>
                </div>
              ))}
            </div>

            {/* Button */}
            <button
              type="button"
              onClick={() => setValidationErrors(null)}
              className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-[#1976d2] to-[#1565c0] hover:from-[#1565c0] hover:to-[#0d47a1] text-white font-semibold text-sm sm:text-base shadow-md hover:shadow-lg transition cursor-pointer"
            >
              กลับไปแก้ไข
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          2. PROCESSING MODAL (PATCH-Q: 4 Verified Steps with Visual Transition)
         ======================================================== */}
      {isSubmitting && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] shadow-2xl max-w-md w-full p-6 sm:p-8 text-center relative border border-slate-100 animate-in fade-in zoom-in-95 duration-200 font-['Mitr',sans-serif]">
            {/* Icon: Spinner in light blue circle */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 text-[#1976d2] animate-spin" />
            </div>

            {/* Title */}
            <h3 className="text-xl sm:text-2xl font-bold text-slate-800 text-center mb-1.5">
              กำลังประมวลผลข้อมูล
            </h3>

            {/* Subtitle */}
            <p className="text-slate-600 text-xs sm:text-sm mb-5">
              กรุณารอสักครู่ ระบบกำลังดำเนินการตามขั้นตอนแบบเป็นลำดับ
            </p>

            {/* 4 Clear Processing Steps (PATCH-Q ข้อ 11) */}
            <div className="bg-[#f8fafc] border border-blue-100/90 rounded-2xl p-4 sm:p-5 text-left space-y-3 shadow-inner">
              {/* Step 1: SAVE */}
              <div className="flex items-center gap-3">
                {pipelineStatus.save === 'done' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : pipelineStatus.save === 'running' ? (
                  <Loader2 className="w-5 h-5 text-[#1976d2] animate-spin shrink-0" />
                ) : pipelineStatus.save === 'error' ? (
                  <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full border border-slate-300 bg-slate-100 shrink-0 flex items-center justify-center text-[10px] text-slate-400 font-bold">
                    1
                  </div>
                )}
                <span className={`text-xs sm:text-sm ${
                  pipelineStatus.save === 'done'
                    ? 'text-emerald-800 font-semibold'
                    : pipelineStatus.save === 'running'
                    ? 'text-[#1976d2] font-semibold'
                    : 'text-slate-400 font-normal'
                }`}>
                  {pipelineStatus.save === 'done' ? '✓ บันทึกข้อมูลสำเร็จ' : 'กำลังบันทึกข้อมูล...'}
                </span>
              </div>

              {/* Step 2: VERIFY */}
              <div className="flex items-center gap-3">
                {pipelineStatus.verify === 'done' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : pipelineStatus.verify === 'running' ? (
                  <Loader2 className="w-5 h-5 text-[#1976d2] animate-spin shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full border border-slate-300 bg-slate-100 shrink-0 flex items-center justify-center text-[10px] text-slate-400 font-bold">
                    2
                  </div>
                )}
                <span className={`text-xs sm:text-sm ${
                  pipelineStatus.verify === 'done'
                    ? 'text-emerald-800 font-semibold'
                    : pipelineStatus.verify === 'running'
                    ? 'text-[#1976d2] font-semibold'
                    : 'text-slate-400 font-normal'
                }`}>
                  {pipelineStatus.verify === 'done' ? '✓ ตรวจสอบข้อมูลสำเร็จ' : 'กำลังตรวจสอบข้อมูลที่บันทึก...'}
                </span>
              </div>

              {/* Step 3: PDF */}
              <div className="flex items-center gap-3">
                {pipelineStatus.pdf === 'done' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : pipelineStatus.pdf === 'running' ? (
                  <Loader2 className="w-5 h-5 text-[#1976d2] animate-spin shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full border border-slate-300 bg-slate-100 shrink-0 flex items-center justify-center text-[10px] text-slate-400 font-bold">
                    3
                  </div>
                )}
                <span className={`text-xs sm:text-sm ${
                  pipelineStatus.pdf === 'done'
                    ? 'text-emerald-800 font-semibold'
                    : pipelineStatus.pdf === 'running'
                    ? 'text-[#1976d2] font-semibold'
                    : 'text-slate-400 font-normal'
                }`}>
                  {pipelineStatus.pdf === 'done' ? '✓ สร้าง PDF สำเร็จ' : 'กำลังจัดทำเอกสาร PDF...'}
                </span>
              </div>

              {/* Step 4: EMAIL (Must NEVER show success before Email API finishes!) */}
              <div className="flex items-center gap-3">
                {pipelineStatus.email === 'done' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : pipelineStatus.email === 'running' ? (
                  <Loader2 className="w-5 h-5 text-[#1976d2] animate-spin shrink-0" />
                ) : pipelineStatus.email === 'error' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full border border-slate-300 bg-slate-100 shrink-0 flex items-center justify-center text-[10px] text-slate-400 font-bold">
                    4
                  </div>
                )}
                <span className={`text-xs sm:text-sm ${
                  pipelineStatus.email === 'done'
                    ? 'text-emerald-800 font-semibold'
                    : pipelineStatus.email === 'running'
                    ? 'text-[#1976d2] font-semibold'
                    : pipelineStatus.email === 'error'
                    ? 'text-amber-800 font-semibold'
                    : 'text-slate-400 font-normal'
                }`}>
                  {pipelineStatus.email === 'done'
                    ? '✓ ส่ง Email สำเร็จ'
                    : pipelineStatus.email === 'error'
                    ? 'ส่ง Email ไม่สำเร็จ'
                    : 'กำลังส่ง Email...'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          3. SUCCESS MODAL (EMAIL_SUCCESS / ส่ง Email สำเร็จ) (PATCH-R)
         ======================================================== */}
      {isStatusModalOpen && submissionSuccess && submissionSuccess.emailSent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] shadow-2xl max-w-md sm:max-w-lg w-full p-6 sm:p-8 text-center relative border border-slate-100 animate-in fade-in zoom-in-95 duration-200 font-['Mitr',sans-serif]">
            {/* Icon: Check circle in light green circle */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-3.5">
              <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-600" />
            </div>

            {/* Badge */}
            <div className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full mb-2 tracking-wide font-mono">
              EMAIL_SUCCESS
            </div>

            {/* Title */}
            <h3 className="text-xl sm:text-2xl font-bold text-slate-800 text-center mb-1">
              ส่ง Email สำเร็จ
            </h3>

            {/* Subtitle */}
            <p className="text-slate-600 text-xs sm:text-sm mb-4">
              ระบบได้บันทึกข้อมูลและส่ง Email ยืนยันเรียบร้อยแล้ว
            </p>

            {/* Information Card (PATCH-R ข้อ 3) */}
            <div className="bg-[#f8fafc] border border-emerald-100/80 rounded-2xl p-4 sm:p-5 mb-4 text-sm text-slate-700 space-y-2 text-left">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-slate-500 font-medium">Record ID:</span>
                <span className="font-mono font-bold text-emerald-800">#{submissionSuccess.report.id}</span>
              </div>
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-slate-500 font-medium">Submission ID:</span>
                <span className="font-mono font-bold text-blue-700">{submissionSuccess.submissionId}</span>
              </div>
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-slate-500 font-medium">ผู้บริหาร / ผู้สื่อสาร:</span>
                <span className="font-semibold text-slate-800 truncate max-w-[220px]">
                  {Array.from(new Set(submissionSuccess.report.communication_details_text.map(c => c.communicator.trim()).filter(Boolean))).join(', ') || submissionSuccess.report.executive_topics.join(', ') || '-'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-slate-500 font-medium">เดือนที่สื่อสาร:</span>
                <span className="font-semibold text-slate-800">{submissionSuccess.report.communication_month}</span>
              </div>
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-slate-500 font-medium">ผู้บันทึก:</span>
                <span className="font-semibold text-slate-800">{submissionSuccess.report.recorder_name} ({submissionSuccess.report.recorder_status})</span>
              </div>
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-slate-500 font-medium">Email ผู้รับ:</span>
                <span className="font-semibold text-slate-800 truncate max-w-[220px]">
                  {submissionSuccess.report.recorder_email || recorderEmail.trim() || 'ไม่ได้ระบุ'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs sm:text-sm pt-2 border-t border-slate-200/70">
                <span className="text-slate-500 font-medium">ไฟล์แนบ PDF:</span>
                <span className="text-emerald-700 font-mono text-xs font-semibold flex items-center gap-1 truncate max-w-[220px]">
                  <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>MWA_Communication_Report_{submissionSuccess.report.id}.pdf</span>
                </span>
              </div>
            </div>

            {/* Success Checklist (PATCH-R ข้อ 4) */}
            <div className="bg-white border border-emerald-200/70 rounded-xl p-3 sm:p-3.5 mb-5 text-left text-xs text-emerald-900 space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>บันทึกข้อมูลสำเร็จ</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>ตรวจสอบข้อมูลสำเร็จ (Read-Back Verification Passed)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>สร้าง PDF สำเร็จ</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>ส่ง Email สำเร็จ</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>แนบ PDF สำเร็จ</span>
              </div>
</div>

            {/* Buttons (PATCH-R ข้อ 5 & 6) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                type="button"
                onClick={handleOpenPdfFromSuccessModal}
                className="w-full sm:w-1/2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold text-sm sm:text-base shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>📄 ดูเอกสาร PDF</span>
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="w-full sm:w-1/2 py-3 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm sm:text-base transition cursor-pointer"
              >
                เริ่มกรอกรายการใหม่
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          4. DRAFT RECOVERY MODAL (พบข้อมูลที่บันทึกไว้ชั่วคราว) (PATCH-O & PATCH-P)
         ======================================================== */}
      {detectedDraft && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] shadow-2xl max-w-md w-full p-6 sm:p-8 text-center relative border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            {/* A. Icon: clock-rewind / history / restore */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-5">
              <History className="w-10 h-10 sm:w-12 sm:h-12 text-[#0d47a1]" />
            </div>

            {/* B. หัวข้อ */}
            <h3 className="text-xl sm:text-2xl font-bold text-slate-800 text-center mb-2">
              พบข้อมูลที่บันทึกไว้ชั่วคราว
            </h3>

            {/* C. คำอธิบาย */}
            <div className="text-center text-slate-600 text-sm sm:text-base space-y-1 mb-6">
              <p>ระบบพบข้อมูลที่คุณกรอกไว้ก่อนหน้านี้ แต่ยังไม่ได้บันทึกเข้าสู่ฐานข้อมูล</p>
              <p className="font-semibold text-slate-800 pt-0.5">ต้องการเรียกคืนข้อมูลนี้หรือไม่?</p>
            </div>

            {/* 3) กล่องแสดงรายละเอียดแบบร่าง */}
            <div className="bg-[#f8fafc] border border-blue-100/80 rounded-2xl p-4 sm:p-5 mb-6 text-sm text-slate-700 space-y-3 text-left">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">ขั้นตอนค้างไว้:</span>
                <span className="font-semibold text-slate-800">ขั้นตอนที่ 1</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">ประจำเดือน:</span>
                <span className="font-semibold text-slate-800">{detectedDraft.selectedMonth || 'ไม่ระบุ'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">บันทึกล่าสุดเมื่อ:</span>
                <span className="font-semibold text-slate-800">{formatDraftTime(detectedDraft.updatedAt)}</span>
              </div>
            </div>

            {/* 4) ปุ่มด้านล่าง */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                type="button"
                onClick={() => handleRestoreDraft(detectedDraft)}
                className="w-full sm:w-1/2 py-3 px-5 rounded-xl bg-gradient-to-r from-[#1976d2] to-[#1565c0] hover:from-[#1565c0] hover:to-[#0d47a1] text-white font-semibold text-sm sm:text-base shadow-md hover:shadow-lg transition cursor-pointer"
              >
                เรียกคืนข้อมูล
              </button>
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="w-full sm:w-1/2 py-3 px-5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm sm:text-base transition cursor-pointer"
              >
                เริ่มกรอกใหม่
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          5. EMAIL FAILED MODAL (บันทึกสำเร็จแต่ส่ง Email ไม่สำเร็จ) (PATCH-P)
         ======================================================== */}
      {isStatusModalOpen && submissionSuccess && !submissionSuccess.emailSent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] shadow-2xl max-w-md sm:max-w-lg w-full p-6 sm:p-8 text-center relative border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Icon: Warning triangle in amber circle */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto mb-5">
              <AlertTriangle className="w-10 h-10 sm:w-12 sm:h-12 text-amber-500" />
            </div>

            {/* Title */}
            <h3 className="text-xl sm:text-2xl font-bold text-slate-800 text-center mb-2">
              บันทึกข้อมูลสำเร็จ แต่ส่งอีเมลไม่สำเร็จ
            </h3>

            {/* Subtitle */}
            <p className="text-slate-600 text-sm sm:text-base mb-4">
              ระบบได้บันทึกข้อมูลและจัดทำเอกสาร PDF เรียบร้อยแล้ว แต่ไม่สามารถส่งอีเมลไปยังผู้รับได้
            </p>

            {/* Details / Error Card */}
            <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 sm:p-5 mb-5 text-sm text-slate-700 space-y-2 text-left">
              <div className="text-xs text-amber-900 font-medium pb-2 border-b border-amber-200/60">
                สาเหตุ: <span className="font-semibold text-rose-700">{submissionSuccess.emailMessage || 'ไม่พบ Email ผู้รับที่ถูกต้อง หรือเกิดข้อผิดพลาดในการส่ง'}</span>
              </div>
              <div className="flex items-center justify-between text-xs sm:text-sm pt-1">
                <span className="text-slate-500 font-medium">รหัสรายงาน (Record ID):</span>
                <span className="font-mono font-bold text-slate-800">{submissionSuccess.report.id}</span>
              </div>
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-slate-500 font-medium">รหัสการส่ง (Submission ID):</span>
                <span className="font-mono font-bold text-blue-700">{submissionSuccess.submissionId}</span>
              </div>
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-slate-500 font-medium">อีเมลผู้รับ:</span>
                <span className="font-semibold text-slate-800 truncate max-w-[220px]">
                  {submissionSuccess.report.recorder_email || recorderEmail.trim() || 'ไม่ได้ระบุ'}
                </span>
              </div>
            </div>

            {/* Buttons */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {recorderEmail.trim() && (
                  <button
                    type="button"
                    onClick={handleRetryEmail}
                    disabled={isRetryingEmail}
                    className="w-full sm:w-1/2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold text-sm sm:text-base shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className={`w-4 h-4 ${isRetryingEmail ? 'animate-spin' : ''}`} />
                    <span>{isRetryingEmail ? 'กำลังส่งซ้ำ...' : 'ส่งอีเมลซ้ำ'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleOpenPdfFromSuccessModal}
                  className={`py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm sm:text-base shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer ${recorderEmail.trim() ? 'w-full sm:w-1/2' : 'w-full'}`}
                >
                  <Eye className="w-4 h-4 text-emerald-100" />
                  <span>เปิดดูเอกสาร PDF</span>
                </button>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 font-medium text-sm transition cursor-pointer"
              >
                บันทึกรายงานฉบับใหม่
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ReportForm;
