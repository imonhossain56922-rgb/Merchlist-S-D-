import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { MockupRequest } from '../types';
import { formatDateInTimezone } from './dateUtils';
import { WORDMARK_LOGO_DATA_URL } from '../components/brand/logoData';

/**
 * PRODUCTION JOB SHEET PDF
 * Follows Reference Image 1 (Merchlist Production Job Sheet design):
 * - merchlist logo on top-left
 * - "PRODUCTION JOB SHEET" on top-right
 * - Dynamic QR code with "SCAN TO OPEN"
 * - Horizontal rule
 * - Large Request / Job Number
 * - Black section header "SALES TEAM ORDER"
 * - Multi-column structured order information
 * - Structured Item table with separate rows for each item
 */
export async function generateProductionJobSheetPdf(params: {
  request: MockupRequest;
  timezone: string;
  companyName?: string;
  applicationName?: string;
}): Promise<void> {
  const { request, timezone } = params;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 595.28 pt
  const pageHeight = doc.internal.pageSize.getHeight(); // 841.89 pt
  const margin = 36;
  const contentWidth = pageWidth - margin * 2; // 523.28 pt

  // 1. merchlist logo on top-left
  try {
    doc.addImage(WORDMARK_LOGO_DATA_URL, 'PNG', margin, 30, 140, 36);
  } catch {
    doc.setFont('times', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(20, 20, 20);
    doc.text('merchlist', margin, 58);
  }

  // 2. Title "PRODUCTION JOB SHEET" on upper-right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text('PRODUCTION JOB SHEET', pageWidth - margin - 85, 52, { align: 'right' });

  // 3. Dynamic QR code on top-right
  const qrUrl = typeof window !== 'undefined'
    ? `${window.location.origin}?request=${encodeURIComponent(request.requestId)}`
    : `https://merchlist.app/request/${request.requestId}`;

  try {
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      margin: 1,
      width: 120,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
    doc.addImage(qrDataUrl, 'PNG', pageWidth - margin - 60, 20, 60, 60);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(50, 50, 50);
    doc.text('SCAN TO OPEN', pageWidth - margin - 30, 88, { align: 'center' });
  } catch (err) {
    console.warn('QR Code generation notice:', err);
  }

  // 4. Horizontal divider rule
  doc.setDrawColor(20, 20, 20);
  doc.setLineWidth(1.5);
  doc.line(margin, 98, pageWidth - margin, 98);

  // 5. Large Request / Job Number
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.setTextColor(15, 23, 42);
  doc.text(request.requestId, margin, 134);

  // 6. Solid Black Banner: "SALES TEAM ORDER" + "Questions -> Salesperson [Name]"
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, 146, contentWidth, 24, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('SALES TEAM ORDER', margin + 10, 161);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `Questions \u2192 Salesperson ${request.salesRepresentativeName}`,
    pageWidth - margin - 10,
    161,
    { align: 'right' }
  );

  // 7. Structured Multi-Column Order Information
  const itemsList = request.itemNames && request.itemNames.length > 0
    ? request.itemNames
    : request.itemName
    ? [request.itemName]
    : ['Custom Merchandise'];

  const col1X = margin;
  const col2X = margin + 175;
  const col3X = margin + 350;
  let currentY = 190;

  const renderField = (label: string, value: string, x: number, y: number, maxWidth = 160) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(label.toUpperCase(), x, y);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42); // slate-900
    const splitLines = doc.splitTextToSize(value || '—', maxWidth);
    doc.text(splitLines, x, y + 13);
  };

  // Row 1
  renderField('CUSTOMER', request.clientName || 'Merchlist Client', col1X, currentY);
  renderField('COMPANY', request.clientName || 'Merchlist Client', col2X, currentY);
  renderField('CONTACT', request.clientMobileNumber ? `${request.clientName || 'Client'} \u00B7 ${request.clientMobileNumber}` : (request.contactBy || '—'), col3X, currentY, 140);

  // Row 2
  currentY += 40;
  renderField('MERCHANDISER', request.contactBy || 'Direct Request', col1X, currentY);
  renderField('DELIVERY DATE', formatDateInTimezone(request.createdAt, timezone, false), col2X, currentY);
  renderField('FULFILMENT', '\u{1F69A} Delivery', col3X, currentY);

  // Row 3
  currentY += 40;
  renderField('TOTAL QUANTITY', `${itemsList.length * 100} pcs (Est.)`, col1X, currentY);
  renderField('LINE ITEMS', String(itemsList.length), col2X, currentY);
  renderField('SALESPERSON', request.salesRepresentativeName, col3X, currentY);

  // Row 4
  currentY += 40;
  renderField('DESIGNER', request.designerName, col1X, currentY);
  const stageLabel = request.status === 'COMPLETED'
    ? 'Completed'
    : request.status === 'REQUEST_BACK'
    ? 'Request Back (Updating)'
    : request.status === 'REJECTED'
    ? 'Rejected'
    : 'Production / Mockup';
  renderField('STAGE', stageLabel, col2X, currentY);
  renderField('SAMPLE', 'None uploaded \u2014 not required. Start on the approved artwork.', col3X, currentY, 140);

  // Row 5: SHIP TO
  currentY += 46;
  const shipToAddress = request.clientName
    ? `${request.clientName}, Dubai, United Arab Emirates`
    : 'Merchlist Hub, Dubai, United Arab Emirates';
  renderField('SHIP TO', shipToAddress, col1X, currentY, 400);

  // 8. Item Table (Matching Reference Image 1)
  currentY += 46;

  const tableBody = itemsList.map((item, index) => {
    return [
      String(index + 1),
      item,
      '\u2014',
      'Standard',
      'UV Print / Screen',
      '\u2014',
      '1',
      '\u25A2',
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'ITEM', 'SIZE', 'COLOUR', 'PRINT', 'PICK FROM', 'QTY', 'DONE']],
    body: tableBody,
    theme: 'plain',
    headStyles: {
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
      cellPadding: { top: 6, bottom: 6, left: 4, right: 4 },
      lineWidth: { bottom: 1 },
      lineColor: [20, 20, 20],
    },
    styles: {
      fontSize: 8.5,
      textColor: [15, 23, 42],
      cellPadding: { top: 7, bottom: 7, left: 4, right: 4 },
      lineColor: [226, 232, 240],
      lineWidth: { bottom: 0.5 },
    },
    columnStyles: {
      0: { cellWidth: 24, fontStyle: 'bold' },
      1: { cellWidth: 200, fontStyle: 'bold' },
      2: { cellWidth: 38, halign: 'center' },
      3: { cellWidth: 55 },
      4: { cellWidth: 65 },
      5: { cellWidth: 65 },
      6: { cellWidth: 35, fontStyle: 'bold', halign: 'center' },
      7: { cellWidth: 35, halign: 'center', fontSize: 10 },
    },
    margin: { left: margin, right: margin },
  });

  // Get final Y from table
  const finalTableY = (doc as any).lastAutoTable?.finalY || currentY + 100;
  let notesY = finalTableY + 25;

  // 9. Notes / Design Instructions & Reference Links
  if (request.notes && request.notes.trim()) {
    if (notesY > pageHeight - 120) {
      doc.addPage();
      notesY = margin + 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('DESIGN INSTRUCTIONS & NOTES', margin, notesY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    const splitNotes = doc.splitTextToSize(request.notes.trim(), contentWidth);
    doc.text(splitNotes, margin, notesY + 14);

    notesY += splitNotes.length * 11 + 25;
  }

  // Reference Links
  const allLinks: string[] = [];
  if (request.additionalReferenceLinks && request.additionalReferenceLinks.length > 0) {
    allLinks.push(...request.additionalReferenceLinks);
  } else if (request.additionalLinks) {
    allLinks.push(request.additionalLinks);
  }
  if (request.referenceLinks) {
    allLinks.push(request.referenceLinks);
  }

  if (allLinks.length > 0 && notesY < pageHeight - 60) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('REFERENCE LINKS', margin, notesY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(14, 116, 144);
    allLinks.forEach((link, idx) => {
      if (notesY + 12 + idx * 12 < pageHeight - 40) {
        doc.text(`\u2022 ${link}`, margin, notesY + 12 + idx * 12);
      }
    });
  }

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Merchlist Production Job Sheet \u00B7 ${request.requestId} \u00B7 Generated ${formatDateInTimezone(new Date(), timezone, true)} \u00B7 Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 20,
      { align: 'center' }
    );
  }

  const filename = `JobSheet_${request.requestId}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

/**
 * OPERATIONS REPORT PDF
 * Combines:
 * - Reference Image 1 Design: merchlist logo, white background, black headers, clean dividers, production style
 * - Reference Image 2 Information: Date Range, Applied Filters, Generated By (Display Name!), Total, Completed,
 *   Pending, Rate, Request ID, Item (multiple numbered), Sales Rep, Designer, Created, Completed, Status, Priority.
 * - (Mockup Title is completely REMOVED as required by Requirement 4 and 25).
 * - Landscape orientation so all columns fit cleanly without tiny fonts.
 */
export function generateReportPdf(params: {
  requests: MockupRequest[];
  dateRangeLabel: string;
  appliedFilters: {
    status?: string;
    priority?: string;
    source?: string;
    salesRep?: string;
    designer?: string;
  };
  generatedByName: string; // MUST be Display Name, never Login ID
  timezone: string;
  companyName?: string;
  applicationName?: string;
}): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 841.89 pt
  const pageHeight = doc.internal.pageSize.getHeight(); // 595.28 pt
  const margin = 36;
  const contentWidth = pageWidth - margin * 2; // 769.89 pt
  const nowStr = formatDateInTimezone(new Date(), params.timezone, true);

  // 1. merchlist logo on top-left
  try {
    doc.addImage(WORDMARK_LOGO_DATA_URL, 'PNG', margin, 24, 130, 33);
  } catch {
    doc.setFont('times', 'bold');
    doc.setFontSize(26);
    doc.setTextColor(20, 20, 20);
    doc.text('merchlist', margin, 50);
  }

  // 2. Report Title & Generation timestamp on top-right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('OFFICIAL OPERATIONS REPORT', pageWidth - margin, 38, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${nowStr} (${params.timezone})`, pageWidth - margin, 52, { align: 'right' });

  // 3. Horizontal divider line
  doc.setDrawColor(20, 20, 20);
  doc.setLineWidth(1.5);
  doc.line(margin, 66, pageWidth - margin, 66);

  // 4. Report Summary Black Header
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, 76, contentWidth, 22, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('REPORT SUMMARY', margin + 10, 90);

  // 5. Dynamic Summary KPI & Filter Box
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.rect(margin, 98, contentWidth, 48, 'FD');

  // Compute metrics dynamically from actual application data
  const total = params.requests.length;
  const completed = params.requests.filter((r) => r.status === 'COMPLETED').length;
  const pending = params.requests.filter((r) => r.status === 'PENDING').length;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Active filters summary
  const filtersApplied = [
    params.appliedFilters.status ? `Status: ${params.appliedFilters.status}` : '',
    params.appliedFilters.priority ? `Priority: ${params.appliedFilters.priority.replace('_', ' ')}` : '',
    params.appliedFilters.source ? `Source: ${params.appliedFilters.source.toUpperCase()}` : '',
    params.appliedFilters.salesRep ? `Sales Rep: ${params.appliedFilters.salesRep}` : '',
    params.appliedFilters.designer ? `Designer: ${params.appliedFilters.designer}` : '',
  ]
    .filter(Boolean)
    .join('  \u00B7  ') || 'All Records';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); // slate-600

  // Left col: Date Range & Generated By
  doc.text(`Date Range: ${params.dateRangeLabel}`, margin + 14, 116);
  doc.text(`Generated By: ${params.generatedByName}`, margin + 14, 134);

  // Right col: Applied Filters & Metrics
  doc.setFont('helvetica', 'normal');
  doc.text(`Applied Filters: ${filtersApplied}`, margin + 300, 116);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(
    `Total Requests: ${total}    Completed: ${completed}    Pending: ${pending}    Completion Rate: ${rate}%`,
    margin + 300,
    134
  );

  // 6. Request Table
  // Columns: # | REQUEST ID | ITEM | SALES REP | DESIGNER | CREATED | COMPLETED | STATUS | PRIORITY
  // (No Mockup Title)
  const tableRows = params.requests.map((req, idx) => {
    const createdStr = formatDateInTimezone(req.createdAt, params.timezone, true);
    const completedStr = req.completedAt
      ? formatDateInTimezone(req.completedAt, params.timezone, true)
      : 'Not Completed';

    // Format multiple items cleanly as numbered entries
    let itemsText = '—';
    if (req.itemNames && req.itemNames.length > 0) {
      itemsText = req.itemNames.map((name, i) => `${i + 1}. ${name}`).join('\n');
    } else if (req.itemName) {
      itemsText = req.itemName;
    } else if (req.source === 'gallabox') {
      itemsText = 'Gallabox Request';
    }

    return [
      String(idx + 1),
      req.requestId,
      itemsText,
      req.salesRepresentativeName,
      req.designerName,
      createdStr,
      completedStr,
      req.status.replace('_', ' '),
      req.priority.replace('_', ' '),
    ];
  });

  autoTable(doc, {
    startY: 156,
    head: [
      [
        '#',
        'REQUEST ID',
        'ITEM',
        'SALES REP',
        'DESIGNER',
        'CREATED',
        'COMPLETED',
        'STATUS',
        'PRIORITY',
      ],
    ],
    body: tableRows.length > 0 ? tableRows : [['—', '—', 'No mockup requests found matching filters', '—', '—', '—', '—', '—', '—']],
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
      cellPadding: 5,
    },
    styles: {
      fontSize: 8,
      cellPadding: 5,
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
    },
    alternateRowStyles: {
      fillColor: [250, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 26, fontStyle: 'bold', halign: 'center' },
      1: { cellWidth: 68, fontStyle: 'bold' },
      2: { cellWidth: 175 },
      3: { cellWidth: 90 },
      4: { cellWidth: 90 },
      5: { cellWidth: 105 },
      6: { cellWidth: 105 },
      7: { cellWidth: 65, fontStyle: 'bold' },
      8: { cellWidth: 65, fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin, bottom: 35 },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Merchlist Operations Report \u00B7 Confidential \u00B7 Page ${data.pageNumber} of ${pageCount}`,
        pageWidth / 2,
        pageHeight - 16,
        { align: 'center' }
      );
    },
  });

  const filename = `Merchlist_Operations_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

export const generateOperationsReportPdf = generateReportPdf;

