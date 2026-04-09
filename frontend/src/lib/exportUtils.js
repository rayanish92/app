import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const exportToCSV = (data, headers, filename) => {
  const csvRows = [headers.join(',')];
  data.forEach(row => {
    csvRows.push(row.map(cell => {
      const str = String(cell ?? '');
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(','));
  });
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const exportToPDF = (data, headers, title, filename) => {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text(title, 14, 20);

  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28);

  autoTable(doc, {
    startY: 34,
    head: [headers],
    body: data,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 60, 45], textColor: 255, fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 245, 240] },
    margin: { left: 14, right: 14 },
  });

  doc.save(filename);
};
