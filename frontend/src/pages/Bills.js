import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const exportToCSV = (rows, headers, fileName) => {
  const content = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.click();
};

export const exportToPDF = (rows, headers, title, fileName) => {
  const doc = new jsPDF();
  doc.text(title, 14, 15);
  doc.autoTable({
    head: [headers],
    body: rows,
    startY: 20,
    theme: 'grid',
    headStyles: { fillColor: [5, 16, 57] } // Your #051039 Navy
  });
  doc.save(fileName);
};
