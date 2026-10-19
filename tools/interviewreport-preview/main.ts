// The real report model, both real writers and the real canvas layout, run in a
// browser against the fixtures -- the only way to SEE the PDF pages, which are
// drawn on canvas and therefore out of reach of `check:interviewreport`.
//
//   npm run preview:interviewreport   (builds, renders en/ar/zh, writes out/)
import { d, setLocale, t } from '../../src/i18n/runtime';
import { buildReportModel } from '../../src/utils/interviewReport/model';
import { buildDocx } from '../../src/utils/interviewReport/docx';
import { buildReportPdf, layoutReport } from '../../src/utils/interviewReport/pdfLayout';
import { FIXTURES } from './fixtures';

function b64(bytes: Uint8Array): string {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
}

(window as any).__render = async (lang: 'en' | 'ar' | 'zh') => {
    setLocale(lang);
    const options = {
        tr: t, dir: (lang === 'ar' ? 'rtl' : 'ltr') as 'ltr' | 'rtl', lang,
        formatDate: (iso: string) => d(iso, { year: 'numeric', month: 'long', day: 'numeric' }),
        now: new Date('2026-10-19T09:30:00Z'),
    };
    const model = buildReportModel(FIXTURES[lang], options);
    const canvases = await layoutReport(model);
    const pages = canvases.map(c => c.toDataURL('image/png').split(',')[1]);
    const pdf = await buildReportPdf(model);
    const docx = buildDocx(model, options.now);
    return { fileBase: model.fileBase, pages, pdf: b64(pdf), docx: b64(docx) };
};
(window as any).__ready = true;
