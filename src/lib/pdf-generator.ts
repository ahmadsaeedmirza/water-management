import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatRs, formatDate, formatTime } from "./format";

export interface PDFReportData {
  title: string;
  subtitle: string;
  dateRange: string;
  generatedAt: string;
  totals: {
    bottles: number;
    sales: number;
    payments: number;
    expenses: number;
    pending: number;
    net: number;
  };
  deliveries: any[];
  payments: any[];
  expenses: any[];
  customerId: string;
}

export function generateReportPDF(data: PDFReportData) {
  const doc = new jsPDF();

  // Colors & Styles
  const primaryColor = [0, 119, 182]; // #0077B6 (Shifaf Aab Primary)
  const textColor = [51, 65, 85];
  const mutedTextColor = [100, 116, 139];

  // Header section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("Shifaf Aab", 14, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
  doc.text("Pure Water Delivery Management", 14, 25);

  // Report title & info (Right aligned-ish)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(51, 65, 85);
  doc.text(data.title, 120, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
  doc.text(`Period: ${data.dateRange}`, 120, 25);
  doc.text(`Generated: ${data.generatedAt}`, 120, 29);

  doc.setLineWidth(0.5);
  doc.setDrawColor(226, 232, 240);
  doc.line(14, 34, 196, 34);

  // Totals Grid Cards (simulated)
  doc.setFillColor(248, 250, 252);
  doc.rect(14, 40, 182, 22, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
  doc.text("TOTAL BOTTLES", 20, 46);
  doc.text("TOTAL SALES", 55, 46);
  doc.text("PAYMENTS IN", 95, 46);

  if (data.customerId === "all") {
    doc.text("EXPENSES", 135, 46);
    doc.text("NET REVENUE", 165, 46);
  } else {
    doc.text("PENDING DUES", 135, 46);
  }

  doc.setFontSize(12);
  doc.setTextColor(51, 65, 85);
  doc.text(data.totals.bottles.toString(), 20, 54);
  doc.text(formatRs(data.totals.sales), 55, 54);
  doc.setTextColor(22, 163, 74); // success green
  doc.text(formatRs(data.totals.payments), 95, 54);

  if (data.customerId === "all") {
    doc.setTextColor(220, 38, 38); // destructive red
    doc.text(formatRs(data.totals.expenses), 135, 54);
    doc.setTextColor(
      data.totals.net >= 0 ? 22 : 220,
      data.totals.net >= 0 ? 163 : 38,
      data.totals.net >= 0 ? 74 : 38,
    );
    doc.text(formatRs(data.totals.net), 165, 54);
  } else {
    doc.setTextColor(217, 119, 6); // amber/warning
    doc.text(formatRs(data.totals.pending), 135, 54);
  }

  let currentY = 70;

  // Deliveries Table
  if (data.deliveries.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    doc.text("Deliveries Log", 14, currentY);
    currentY += 4;

    const body = data.deliveries.map((d) => [
      formatDate(d.created_at),
      d.customers?.name || "Walk-in",
      d.bottles_delivered.toString(),
      d.payment_mode.toUpperCase(),
      formatRs(d.total_amount),
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [["Date", "Customer", "Bottles", "Payment Method", "Amount"]],
      body: body,
      theme: "striped",
      headStyles: { fillColor: primaryColor, fontSize: 9 },
      bodyStyles: { fontSize: 8, textColor: textColor },
      margin: { left: 14, right: 14 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;
  }

  // Payments Table
  if (data.payments.length > 0) {
    if (currentY > 240) {
      doc.addPage();
      currentY = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    doc.text("Payments Recorded", 14, currentY);
    currentY += 4;

    const body = data.payments.map((p) => [
      formatDate(p.created_at),
      p.payment_mode.toUpperCase(),
      formatRs(p.amount),
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [["Date", "Payment Mode", "Amount Received"]],
      body: body,
      theme: "striped",
      headStyles: { fillColor: [22, 163, 74], fontSize: 9 },
      bodyStyles: { fontSize: 8, textColor: textColor },
      margin: { left: 14, right: 14 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;
  }

  // Expenses Table
  if (data.customerId === "all" && data.expenses.length > 0) {
    if (currentY > 240) {
      doc.addPage();
      currentY = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    doc.text("Expenses Log", 14, currentY);
    currentY += 4;

    const body = data.expenses.map((e) => [formatDate(e.created_at), e.name, formatRs(e.amount)]);

    autoTable(doc, {
      startY: currentY,
      head: [["Date", "Expense Description", "Amount Spent"]],
      body: body,
      theme: "striped",
      headStyles: { fillColor: [220, 38, 38], fontSize: 9 },
      bodyStyles: { fontSize: 8, textColor: textColor },
      margin: { left: 14, right: 14 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;
  }

  // Summary Footer Note
  if (currentY > 260) {
    doc.addPage();
    currentY = 20;
  }
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(mutedTextColor[0], mutedTextColor[1], mutedTextColor[2]);
  doc.text(
    "Generated via Shifaf Aab Business Management Console · Thank you for your business.",
    14,
    currentY + 5,
  );

  const filename = `${data.title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_report.pdf`;
  doc.save(filename);
}
