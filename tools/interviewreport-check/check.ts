// npm run check:interviewreport
//
// The downloadable Job Interview report: the model both writers read, the Word
// document, and the PDF container. No browser -- the canvas layout is the one
// part this cannot reach, and `tools/interviewreport-preview` renders it.
//
// The modules are imported, not re-implemented: a check written against a
// second copy of the logic proves nothing about the first.

import {
    DIMENSIONS, LABEL_KEYS, OTHER_KEYS, buildReportModel, cleanText, fill, safeFileBase,
    textDir, toneOf, type ReportSession,
} from '../../src/utils/interviewReport/model';
import { buildDocx, docxParts, esc } from '../../src/utils/interviewReport/docx';
import { crc32, unzipStore, zipStore } from '../../src/utils/interviewReport/zip';
import {
    A4_H, buildPdf, helveticaWidth, pdfUnicodeString, textLayer, winAnsi,
} from '../../src/utils/interviewReport/pdfWriter';
import ar from '../../src/i18n/messages/ar/index';
import zh from '../../src/i18n/messages/zh/index';

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : '  ' + JSON.stringify(detail)?.slice(0, 300)}`);
}

const tr = (key: string, params?: Record<string, string | number>) => (params ? fill(key, params) : key);
const NOW = new Date('2026-10-19T09:30:00Z');

const FULL: ReportSession = {
    user_full_name: 'Layla Haddad', username: 'layla', interview_type: 'Technical',
    topic: 'DevOps Engineer', cv_title: 'DevOps CV', attempt: 2,
    created_at: '2026-10-18T10:00:00Z', duration_seconds: 754, status: 'complete',
    question_source: 'mixed', custom_questions: ['What is a load balancer?'],
    score: 74, recommendation: 'Hire — strong fundamentals',
    summary: 'Clear and structured.\nGood use of numbers.', strengths: 'Specific examples.',
    improvements: 'Say "I" more.', technical_assessment: 'Solid Linux.', communication: 'Calm.',
    standout_moment: 'The migration answer.', red_flags: '',
    action_plan: ['Rehearse two STAR stories', '  ', 'Put a number in every answer'],
    score_breakdown: { structure: 80, relevance: 90, depth: 55, communication: 70, impact: 140 },
    qa_pairs: [
        { question: 'What is a load balancer?', answer: 'It spreads traffic\u0000 across servers.', seconds: 61,
          source: 'candidate', coaching: { model_answer: 'A load balancer…', improved_answer: 'I configured…',
          feedback: 'Good.', fix: 'Add a number.', why: 'Basics.', rating: 8 } },
        { question: 'Describe an outage <script>&"</script>', answer: '', seconds: 0,
          coaching: { model_answer: 'In 2023…', improved_answer: 'should be dropped', rating: 6 } },
        { question: '   ', answer: 'orphan answer' },
    ],
};

console.log('\n1. The model -- nothing invented');
{
    const m = buildReportModel(FULL, { tr, dir: 'ltr', lang: 'en', now: NOW });
    check('control characters are removed from an answer', m.questions[0].answer === 'It spreads traffic across servers.', m.questions[0].answer);
    check('a question with no text is not a question', m.questions.length === 2, m.questions.length);
    check('an empty red flag stays empty -- no "none found" sentence', m.redFlags === '');
    check('a blank action-plan step is dropped', m.actionPlan.length === 2, m.actionPlan);
    check('a breakdown value past 100 is clamped', m.breakdown.find(d => d.label === 'Impact')?.value === 100);
    check('the breakdown keeps the fixed dimension order', m.breakdown.map(d => d.label).join() === DIMENSIONS.map(d => d.label).join());
    check('an unanswered question has no rating', m.questions[1].rating === null && m.questions[1].tone === null);
    check('and no "improved" version of an answer nobody gave', m.questions[1].improved === '');
    check('but it keeps its model answer', m.questions[1].model === 'In 2023…');
    check('a candidate\'s own question is marked', m.questions[0].own && !m.questions[1].own);
    check('the facts name a mixed source', m.meta.some(x => x.value === 'Your list, then the interviewer’s'), m.meta);
    check('answered counts only real answers', m.meta.some(x => x.label === 'Questions answered' && x.value === '1 out of 2'), m.meta);
    check('the duration is minutes and seconds', m.meta.some(x => x.value === '12 min 34 s'), m.meta);
    check('the attempt is shown only past the first', m.meta.some(x => x.label === 'Attempt' && x.value === '#2'));
    check('score and tone', m.score === 74 && m.scoreTone === 'good');
    check('the file name carries the topic, the person and the day',
        m.fileBase === 'Interview_Report_-_DevOps_Engineer_-_Layla_Haddad_-_2026-10-18', m.fileBase);
    check('every label is filled from tr', Object.values(m.labels).every(Boolean));

    const unevaluated = buildReportModel({ ...FULL, score: 0, summary: '', recommendation: '', score_breakdown: {}, status: 'in_progress' },
        { tr, dir: 'ltr', lang: 'en', now: NOW });
    check('a report never evaluated draws no score -- 0 there is a judgement nobody made', unevaluated.score === null);
    check('and says it is unfinished', unevaluated.unfinished === true);

    const hr = buildReportModel({ interview_type: 'HR', topic: 'HR / General', qa_pairs: [] }, { tr, dir: 'ltr', lang: 'en', now: NOW });
    check('an HR interview does not print the placeholder topic', !hr.meta.some(x => x.value === 'HR / General'), hr.meta);
    check('nor put it in the file name', !hr.fileBase.includes('General'), hr.fileBase);
    check('and its assessment is a competency one', hr.assessmentTitle === 'Competency Assessment');
    check('an empty session still builds', hr.questions.length === 0 && hr.score === null);

    check('cleanText collapses runs of blank lines', cleanText('a\n\n\n\nb') === 'a\n\nb');
    check('a safe file name drops path characters', !/[\\/:*?"<>|]/.test(safeFileBase('a/b:c*d?"e<f>g|h')));
    check('and keeps Arabic', safeFileBase('تقرير', 'مطور') === 'تقرير_-_مطور');
    check('toneOf on a ten-point scale', toneOf(7, 10) === 'good' && toneOf(5, 10) === 'mid' && toneOf(2, 10) === 'low');
    check('toneOf on nothing is nothing', toneOf(null) === null);
}

console.log('\n2. Direction is per paragraph');
{
    check('Arabic is rtl', textDir('حدثني عن نفسك') === 'rtl');
    check('English is ltr even in an rtl report', textDir('Tell me about yourself', 'rtl') === 'ltr');
    check('Chinese is ltr', textDir('请介绍一下你自己') === 'ltr');
    check('a leading number does not decide it', textDir('5 سنوات من الخبرة') === 'rtl');
    // The bug the preview harness found: read by its first letter, an Arabic
    // answer that opens with a product name was laid out left to right.
    check('an Arabic paragraph that STARTS with an English word is still rtl',
        textDir('Docker يبني الحاوية ويشغّلها على جهاز واحد، أما Kubernetes فيدير مئات الحاويات') === 'rtl');
    // And the second render's: counted by LETTER, long product names outweigh
    // short Arabic function words and this heading went left to right.
    check('a short Arabic question with long English names is rtl',
        textDir('ما الفرق بين Docker و Kubernetes؟') === 'rtl');
    check('a tie goes to the first strong character',
        textDir('Docker مقابل') === 'ltr' && textDir('مقابل Docker') === 'rtl');
    check('an English paragraph naming an Arabic word is still ltr',
        textDir('The interviewer asked about مهندس roles in detail') === 'ltr');
    check('no strong character falls back', textDir('42% — 7/10', 'rtl') === 'rtl' && textDir('42%', 'ltr') === 'ltr');
}

console.log('\n3. The Word document');
{
    const m = buildReportModel(FULL, { tr, dir: 'ltr', lang: 'en', now: NOW });
    const bytes = buildDocx(m, NOW);
    const entries = unzipStore(bytes);
    check('it is a zip', bytes[0] === 0x50 && bytes[1] === 0x4b);
    check('[Content_Types].xml comes first', entries[0]?.name === '[Content_Types].xml', entries.map(e => e.name));
    check('every part\'s checksum matches its bytes', entries.every(e => e.crcOk));
    const names = entries.map(e => e.name);
    for (const part of ['_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/footer1.xml',
        'word/_rels/document.xml.rels', 'docProps/core.xml']) {
        check(`it carries ${part}`, names.includes(part));
    }

    const dec = new TextDecoder();
    const doc = dec.decode(entries.find(e => e.name === 'word/document.xml')!.data);
    // A tag balance check -- not a validator, but it catches the mistake a
    // string builder actually makes: a tag opened in one branch and closed in
    // another.
    const balanced = (xml: string) => {
        const stack: string[] = [];
        const re = /<(\/?)([A-Za-z][\w:.-]*)([^>]*?)(\/?)>/g;
        let mm: RegExpExecArray | null;
        while ((mm = re.exec(xml))) {
            if (mm[0].startsWith('<?')) continue;
            const [, close, name, , self] = mm;
            if (self) continue;
            if (close) { if (stack.pop() !== name) return false; } else stack.push(name);
        }
        return stack.length === 0;
    };
    for (const e of entries) check(`${e.name} is balanced`, balanced(dec.decode(e.data)));
    check('markup in a question is escaped, never emitted',
        doc.includes('&lt;script&gt;&amp;&quot;&lt;/script&gt;') && !doc.includes('<script>'));
    check('no control character reaches the XML', !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(doc));
    check('the candidate is named', doc.includes('Layla Haddad'));
    check('the model answer of an unanswered question is still there', doc.includes('In 2023…'));
    check('the "improved" text of an unanswered question is NOT', !doc.includes('should be dropped'));
    check('every own question is tagged', (doc.match(/Your question/g) || []).length >= 1);
    check('the footer has live page fields', dec.decode(entries.find(e => e.name === 'word/footer1.xml')!.data).includes('NUMPAGES'));
    check('headings use the built-in styles, so the navigation pane works',
        doc.includes('w:val="Heading1"') && doc.includes('w:val="Heading2"'));

    // CT_PPr is a SEQUENCE and Word rejects a document over one element out of
    // order, naming nothing. Check every pPr in every part.
    const ORDER = ['pStyle', 'keepNext', 'keepLines', 'pageBreakBefore', 'pBdr', 'shd', 'bidi', 'spacing', 'ind', 'jc', 'outlineLvl', 'rPr'];
    const RORDER = ['rStyle', 'rFonts', 'b', 'bCs', 'i', 'iCs', 'caps', 'color', 'spacing', 'sz', 'szCs', 'rtl', 'lang'];
    const TCORDER = ['tcW', 'tcBorders', 'shd', 'tcMar', 'vAlign'];
    const TBLORDER = ['bidiVisual', 'tblW', 'tblBorders', 'tblLayout', 'tblCellMar'];
    const inOrder = (xml: string, tag: string, order: string[]) => {
        const re = new RegExp(`<w:${tag}>([\\s\\S]*?)</w:${tag}>`, 'g');
        let mm: RegExpExecArray | null;
        while ((mm = re.exec(xml))) {
            const kids = [...mm[1].matchAll(/<w:([A-Za-z]+)[\s/>]/g)].map(x => x[1]).filter(k => order.includes(k));
            // Only direct-level ordering matters; nested children of pBdr etc.
            // are not in `order`, so they are filtered out.
            const idx = kids.map(k => order.indexOf(k));
            for (let i = 1; i < idx.length; i++) if (idx[i] < idx[i - 1]) return `${tag}: ${kids.join(',')}`;
        }
        return '';
    };
    // Over an ENGLISH and an ARABIC report: the English one has no w:bidi in
    // it at all, so checking it alone could not see bidi out of place -- which
    // is the ordering bug this file actually shipped first. Mutation-tested.
    const arModel = buildReportModel({
        ...FULL, topic: 'مطور', qa_pairs: [{ question: 'حدثني عن نفسك', answer: 'أنا مهندس', coaching: { feedback: 'جيد', rating: 7 } }],
    }, { tr, dir: 'rtl', lang: 'ar', now: NOW });
    const sets: [string, { name: string; data: string }[]][] = [
        ['en', entries.map(e => ({ name: e.name, data: dec.decode(e.data) }))],
        ['ar', docxParts(arModel, NOW)],
    ];
    for (const [lang, parts] of sets) {
        for (const e of parts.filter(x => x.name.endsWith('.xml'))) {
            const bad = inOrder(e.data, 'pPr', ORDER) || inOrder(e.data, 'rPr', RORDER)
                || inOrder(e.data, 'tcPr', TCORDER) || inOrder(e.data, 'tblPr', TBLORDER);
            check(`${lang} ${e.name}: properties are in schema order`, !bad, bad);
        }
    }
    check('the order check had a bidi paragraph to look at',
        /<w:bidi\/>/.test(sets[1][1].find(p => p.name === 'word/document.xml')!.data));
    check('a table cell never ends on a nested table', !/<\/w:tbl><\/w:tc>/.test(doc));

    const rtlModel = buildReportModel({
        ...FULL, topic: 'مطور', qa_pairs: [{ question: 'حدثني عن نفسك', answer: 'أنا مهندس DevOps' }],
    }, { tr, dir: 'rtl', lang: 'ar', now: NOW });
    const rtlDoc = docxParts(rtlModel, NOW).find(p => p.name === 'word/document.xml')!.data;
    check('an Arabic paragraph is marked bidi', /<w:bidi\/>[\s\S]{0,400}حدثني/.test(rtlDoc));
    check('and its runs rtl', /<w:rtl\/><\/w:rPr><w:t xml:space="preserve">حدثني/.test(rtlDoc));
    check('an rtl report mirrors its tables', rtlDoc.includes('<w:bidiVisual/>'));
    check('the section is bidi', /<w:sectPr>[\s\S]*<w:bidi\/>[\s\S]*<\/w:sectPr>/.test(rtlDoc));
    check('an English answer in that report is NOT marked rtl',
        !/<w:rtl\/><\/w:rPr><w:t xml:space="preserve">Layla/.test(rtlDoc));
    check('esc handles all four', esc('<a & "b">') === '&lt;a &amp; &quot;b&quot;&gt;');
}

console.log('\n4. The zip container');
{
    check('crc32 of "123456789" is the standard check value', crc32(new TextEncoder().encode('123456789')) === 0xcbf43926);
    const z = zipStore([{ name: 'a.txt', data: 'hello' }, { name: 'ب.txt', data: new Uint8Array([1, 2, 3]) }], NOW);
    const back = unzipStore(z);
    check('round trip', back.length === 2 && new TextDecoder().decode(back[0].data) === 'hello' && back[1].data[2] === 3);
    check('a non-ASCII name survives (UTF-8 flag)', back[1].name === 'ب.txt');
    const dv = new DataView(z.buffer);
    check('the end record counts the entries', dv.getUint16(z.length - 22 + 10, true) === 2);
}

console.log('\n5. The PDF container');
{
    check('WinAnsi takes curly quotes and dashes', JSON.stringify(winAnsi('It’s — “ok”')) === JSON.stringify([73, 116, 0x92, 115, 32, 0x97, 32, 0x93, 111, 107, 0x94]));
    check('WinAnsi refuses Arabic rather than writing ?', winAnsi('مرحبا') === null);
    check('WinAnsi refuses Chinese', winAnsi('你好') === null);
    check('Helvetica width of "Hello" at 10pt', Math.abs(helveticaWidth(winAnsi('Hello')!, 10) - 22.78) < 0.01);
    const layer = textLayer([
        { x: 50, y: 100, size: 10, width: 30, text: 'Hello' },
        { x: 50, y: 120, size: 10, width: 30, text: 'مرحبا' },
    ]);
    check('the text layer is invisible (render mode 3)', layer.startsWith('BT 3 Tr'));
    check('it scales the run to the drawn width', /131\.\d+ Tz/.test(layer), layer);
    check('it flips y to PDF space', layer.includes(` ${Math.round((A4_H - 100) * 100) / 100} Tm`), layer);
    check('and skips the line it cannot encode', (layer.match(/Tj/g) || []).length === 1);
    check('an empty layer writes nothing', textLayer([{ x: 0, y: 0, size: 9, width: 10, text: '你好' }]) === '');
    check('a unicode title is UTF-16BE with a BOM', pdfUnicodeString('A') === '<feff0041>');

    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const pdf = buildPdf([
        { jpeg, pxW: 10, pxH: 14, text: [{ x: 1, y: 2, size: 9, width: 20, text: 'Page one' }] },
        { jpeg, pxW: 10, pxH: 14, text: [] },
    ], { title: 'تقرير المقابلة', lang: 'ar' }, NOW);
    const raw = Array.from(pdf, b => String.fromCharCode(b)).join('');
    check('it starts with a PDF header', raw.startsWith('%PDF-1.4\n%'));
    check('the second line is binary, so transfers keep it binary', pdf[10] >= 0x80);
    const startxref = Number(/startxref\n(\d+)\n%%EOF/.exec(raw)?.[1]);
    check('startxref points at the xref table', raw.slice(startxref, startxref + 4) === 'xref', raw.slice(startxref, startxref + 20));
    const entriesX = [...raw.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map(x => Number(x[1]));
    check('one xref entry per object', entriesX.length === 4 + 2 * 3, entriesX.length);
    check('every xref offset lands on its object',
        entriesX.every((off, i) => raw.slice(off).startsWith(`${i + 1} 0 obj`)));
    check('two pages', /\/Count 2 /.test(raw));
    check('each page draws its image', (raw.match(/\/Im0 Do/g) || []).length === 2);
    check('the image is a JPEG stream of the right length', /\/Filter \/DCTDecode \/Length 4 >>/.test(raw));
    check('the language is declared', raw.includes('/Lang (ar)'));
    check('the title shows instead of the file name', raw.includes('/DisplayDocTitle true'));
}

console.log('\n6. Both catalogues cover every report label');
{
    const keys = [...Object.values(LABEL_KEYS), ...OTHER_KEYS];
    for (const [id, cat] of [['ar', ar], ['zh', zh]] as const) {
        const missing = keys.filter(k => (cat as Record<string, unknown>)[k] === undefined);
        check(`${id}: every heading and caption in the report is translated`, missing.length === 0, missing);
        const lost = keys.filter(k => {
            const v = (cat as Record<string, string>)[k];
            return typeof v === 'string' && ['{v0}', '{v1}'].some(p => k.includes(p) && !v.includes(p));
        });
        check(`${id}: no translation drops a page number or a count`, lost.length === 0, lost);
    }
}

console.log(failures === 0
    ? '\n✅ interview report: all checks passed\n'
    : `\n❌ interview report: ${failures} check(s) failed\n`);
process.exit(failures === 0 ? 0 : 1);
