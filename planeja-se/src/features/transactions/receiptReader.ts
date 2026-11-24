/**
 * Extrai o texto de um comprovante anexado, tudo no navegador (nada é enviado ao servidor).
 * - PDF com camada de texto: lido direto com pdf.js (rápido e sem erros de OCR).
 * - Imagem ou PDF escaneado: reconhecimento óptico com Tesseract em português.
 * As bibliotecas são carregadas sob demanda para não pesar no carregamento inicial.
 */

export type ReceiptText = { text: string; source: 'pdf' | 'ocr' };
type Progress = (message: string) => void;

export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const MAX_PDF_PAGES = 3;

const isPdf = (file: File) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

async function ocr(image: File | Blob, onProgress: Progress) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('por', 1, {
    logger: (message) => {
      if (message.status === 'recognizing text') {
        onProgress(`Reconhecendo texto: ${Math.round(message.progress * 100)}%`);
      }
    },
  });
  try {
    const { data } = await worker.recognize(image);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

async function loadPdf(file: File) {
  const pdfjs = await import('pdfjs-dist');
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
}

async function readPdf(file: File, onProgress: Progress): Promise<ReceiptText> {
  onProgress('Abrindo PDF...');
  const pdf = await loadPdf(file);
  try {
    const pages = Math.min(pdf.numPages, MAX_PDF_PAGES);
    let text = '';
    for (let number = 1; number <= pages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      for (const item of content.items) {
        if ('str' in item) text += item.str + (item.hasEOL ? '\n' : ' ');
      }
      text += '\n';
    }
    if (text.replace(/\s/g, '').length >= 20) return { text, source: 'pdf' };

    // PDF sem texto (foto/scan): renderiza a 1ª página e passa pelo OCR.
    onProgress('PDF escaneado: convertendo página em imagem...');
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvas, viewport }).promise;
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((value) => (value ? resolve(value) : reject(new Error('Falha ao converter PDF.'))), 'image/png'),
    );
    return { text: await ocr(blob, onProgress), source: 'ocr' };
  } finally {
    await pdf.loadingTask.destroy();
  }
}

export async function readReceiptText(file: File, onProgress: Progress): Promise<ReceiptText> {
  if (file.size > MAX_RECEIPT_BYTES) throw new Error('Arquivo maior que 10 MB.');
  if (isPdf(file)) return readPdf(file, onProgress);
  if (!file.type.startsWith('image/')) throw new Error('Formato não suportado. Use imagem (JPG/PNG) ou PDF.');
  onProgress('Lendo imagem em português...');
  return { text: await ocr(file, onProgress), source: 'ocr' };
}
