/**
 * Downloading an interview report as PDF or Word.
 *
 * Reached ONLY through `import()` from `ReportDownloads.vue`, so none of this --
 * and in particular not the canvas layout -- is in the entry chunk that every
 * route downloads (working rule 47). The PDF layout is a second dynamic import
 * inside that, so a Word download does not pay for it either.
 */

import { buildReportModel, type BuildOptions, type ReportSession } from './model';
import { DOCX_MIME, buildDocx } from './docx';

export type ReportFormat = 'pdf' | 'docx';

/**
 * Hand the bytes to the browser as a file.
 *
 * The object URL is revoked on a delay rather than at once: Safari starts the
 * download asynchronously and a URL revoked in the same tick is a download of
 * nothing, with no error anywhere.
 */
export function saveBytes(bytes: Uint8Array, filename: string, mime: string): void {
    const blob = new Blob([bytes as BlobPart], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadInterviewReport(
    session: ReportSession, format: ReportFormat, options: BuildOptions,
): Promise<void> {
    const model = buildReportModel(session, options);
    if (format === 'docx') {
        saveBytes(buildDocx(model), `${model.fileBase}.docx`, DOCX_MIME);
        return;
    }
    const { buildReportPdf } = await import('./pdfLayout');
    saveBytes(await buildReportPdf(model), `${model.fileBase}.pdf`, 'application/pdf');
}
