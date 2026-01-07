import PDFDocument from 'pdfkit';

export async function renderContractPdf(params: {
  title: string;
  artistName: string;
  creatorName: string;
  contractId: string;
  contractText: string;
}): Promise<Buffer> {
  return await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text(params.title, { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Contract ID: ${params.contractId}`);
    doc.text(`Artist: ${params.artistName}`);
    doc.text(`Creator: ${params.creatorName}`);
    doc.moveDown();
    doc.fontSize(10).text(params.contractText, { align: 'left' });

    doc.end();
  });
}
