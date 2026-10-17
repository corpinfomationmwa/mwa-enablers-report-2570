import React from 'react';
import { EnablersReport } from '../types/enablers';
import { PdfViewerModal } from './PdfViewerModal';

interface ReportPrintModalProps {
  report: EnablersReport | null;
  mode: 'pdf' | 'print';
  onClose: () => void;
}

/**
 * Keep every report output on the same approved A4-landscape template.
 * The canonical PDF viewer owns PDF generation, download and browser printing;
 * using it here avoids a second, visually different HTML print layout.
 */
export const ReportPrintModal: React.FC<ReportPrintModalProps> = ({
  report,
  mode: _mode,
  onClose
}) => {
  if (!report) return null;
  return <PdfViewerModal report={report} onClose={onClose} />;
};

export default ReportPrintModal;
