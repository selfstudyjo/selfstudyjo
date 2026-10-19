// Three finished interviews, one per language, written to exercise the layout:
// long answers that cross a page break, a candidate's own question, an
// unanswered question, a mixed-direction line, and a breakdown with every tone.
import type { ReportSession } from '../../src/utils/interviewReport/model';

const longEn = 'In my last role I owned the migration of 140 services from a hand-built VM fleet to Kubernetes. '
    + 'I started by measuring: deploy frequency was twice a week and the median rollback took 47 minutes. '
    + 'I wrote the migration plan, ran a pilot on the three least critical services, and built a golden-path Helm chart '
    + 'so that each team could move without learning the whole platform. When the payments team pushed back, I paired '
    + 'with them for a week instead of escalating, and we found two real gaps in the chart that we fixed for everybody. '
    + 'By the end deploys were daily, rollback was under five minutes, and on-call pages dropped by about a third.';

export const FIXTURES: Record<string, ReportSession> = {
    en: {
        user_full_name: 'Layla Haddad', username: 'layla', interview_type: 'Technical',
        topic: 'Senior DevOps Engineer', cv_title: 'DevOps CV — 2026', attempt: 2,
        created_at: '2026-10-18T10:00:00Z', duration_seconds: 1214, status: 'complete',
        question_source: 'mixed', custom_questions: ['What is the difference between a liveness and a readiness probe?'],
        score: 74, recommendation: 'Hire — strong fundamentals and clear ownership; practise quantifying impact.',
        summary: 'A confident, well-structured interview. You answered every question that was asked and backed most claims with a real project. The weakest moments were where you described what the team did rather than what you did.',
        strengths: 'You used numbers without being prompted ("rollback under five minutes"), and your Kubernetes answer showed genuine depth: you explained the trade-off, not just the definition.',
        improvements: 'Question 3 drifted into a general description of CI/CD. Lead with the decision you made, then the result. Say "I" when it was you.',
        technical_assessment: 'Solid on Linux, containers and Kubernetes probes. Monitoring answers were correct but generic — name the tools and the alert you would actually write.',
        communication: 'Clear pace and very little filler. Two answers ran past two minutes; a 90-second structure would make them land harder.',
        standout_moment: '"I paired with them for a week instead of escalating" — this shows influence without authority, which is exactly what a senior role is hiring for.',
        red_flags: 'One answer blamed "management" for a failed release without saying what you would do differently.',
        action_plan: ['Rewrite your three best stories in STAR form with one number each.',
            'Practise a 90-second answer for "tell me about a failure", ending on what changed.',
            'Name the exact monitoring stack (Prometheus, Alertmanager, Grafana) in every operations answer.'],
        score_breakdown: { structure: 78, relevance: 88, depth: 62, communication: 81, impact: 40 },
        qa_pairs: [
            { question: 'What is the difference between a liveness and a readiness probe?', source: 'candidate', seconds: 74,
              answer: 'Liveness tells Kubernetes whether to restart the container, readiness tells it whether to send traffic. I once had a readiness probe hitting the database, so a DB blip took every pod out of the service at once — we moved it to a local check.',
              coaching: { rating: 8, feedback: 'Accurate and you added a real incident, which is what makes it memorable. You could close with the rule you took away.',
                fix: 'End with the principle: readiness should check this pod, never a shared dependency.',
                improved_answer: 'Liveness decides whether Kubernetes restarts my container; readiness decides whether it receives traffic. I learned the difference the hard way: our readiness probe queried the database, so one database blip removed every pod from the service at once. I moved it to a local health check, and the rule I follow now is that readiness checks this pod, never a shared dependency.',
                model_answer: 'Liveness answers "should this container be restarted?"; readiness answers "should it receive traffic right now?". I keep readiness local to the pod — when we had it call the database, one blip drained the whole service.',
                why: 'Probes are where theory meets outages. The commonest mistake is wiring readiness to a shared dependency.' } },
            { question: 'Tell me about a large migration you led. What did you measure, and what changed?', source: 'interviewer', seconds: 128,
              answer: longEn,
              coaching: { rating: 9, feedback: 'Excellent: baseline, plan, obstacle, result, all with numbers. This is the answer to lead with in a real interview.',
                fix: 'Trim the middle by 20 seconds — the Helm chart detail can be a follow-up.',
                improved_answer: longEn.replace('I wrote the migration plan', 'I owned the plan'),
                model_answer: 'I led a 140-service move to Kubernetes. Baseline: two deploys a week, 47-minute rollbacks. I piloted on three low-risk services and built a shared Helm chart. Result: daily deploys, five-minute rollbacks, a third fewer pages.',
                why: 'Senior candidates are hired for outcomes. The interviewer is listening for a baseline, a decision you owned, and a measured result.' } },
            { question: 'How would you design alerting for a payments API?', source: 'interviewer', seconds: 0, answer: '',
              coaching: { model_answer: 'I alert on symptoms users feel: error rate above 1% for five minutes and p99 latency above 800 ms, paged; everything else goes to a ticket. Each alert links a runbook.',
                why: 'This checks whether you alert on causes (noisy) or symptoms (actionable).' } },
        ],
    },
    ar: {
        user_full_name: 'محمود القضاة', username: 'mahmoud', interview_type: 'Technical',
        topic: 'مهندس DevOps', created_at: '2026-10-18T10:00:00Z', duration_seconds: 640, status: 'complete',
        question_source: 'custom', custom_questions: ['ما الفرق بين Docker و Kubernetes؟', 'حدثني عن مشكلة إنتاج حللتها.'],
        score: 58, recommendation: 'ربما — أساس جيد يحتاج إلى أمثلة أكثر تحديدًا',
        summary: 'مقابلة جيدة بشكل عام. أجبت عن الأسئلة بوضوح، لكن الإجابات افتقرت إلى أرقام تقيس أثر عملك.',
        strengths: 'شرحت الفرق بين Docker و Kubernetes بدقة، واستخدمت مثالًا من مشروع حقيقي.',
        improvements: 'ابدأ كل إجابة بالقرار الذي اتخذته أنت، ثم النتيجة. استخدم «أنا» بدل «نحن» عندما يكون العمل عملك.',
        technical_assessment: 'معرفة جيدة بالحاويات وأساسيات Kubernetes. تحتاج إلى التعمق في المراقبة والتنبيهات.',
        communication: 'إيقاع هادئ وواضح، مع بعض التردد في بداية الإجابات.',
        standout_moment: '«أعدت كتابة ملف الـ Dockerfile فانخفض حجم الصورة من 1.2 GB إلى 180 MB» — مثال ملموس وقابل للقياس.',
        action_plan: ['اكتب ثلاث قصص بأسلوب STAR مع رقم واحد على الأقل في كل منها.', 'تدرّب على إجابة مدتها 90 ثانية عن مشكلة إنتاج.'],
        score_breakdown: { structure: 52, relevance: 75, depth: 48, communication: 70, impact: 30 },
        qa_pairs: [
            { question: 'ما الفرق بين Docker و Kubernetes؟', source: 'candidate', seconds: 66,
              answer: 'Docker يبني الحاوية ويشغّلها على جهاز واحد، أما Kubernetes فيدير مئات الحاويات على عدة خوادم ويعيد تشغيلها عند الفشل. في مشروعي الأخير أعدت كتابة ملف الـ Dockerfile فانخفض حجم الصورة من 1.2 GB إلى 180 MB.',
              coaching: { rating: 7, feedback: 'إجابة دقيقة ومثال ممتاز بالأرقام.', fix: 'اختم بمتى تختار كل أداة.',
                improved_answer: 'Docker يبني الحاوية ويشغّلها، وKubernetes يدير أسطولًا منها على عدة خوادم. في مشروعي الأخير خفّضت حجم الصورة من 1.2 GB إلى 180 MB، وهذا سرّع النشر على Kubernetes بشكل واضح.',
                model_answer: 'Docker أداة لبناء الحاويات وتشغيلها، وKubernetes منصة لتشغيلها على نطاق واسع: الجدولة، والتوسع، والاستعادة الذاتية.',
                why: 'يتحقق المحاور من أنك تفهم الفرق بين بناء الحاوية وتشغيلها على نطاق واسع.' } },
            { question: 'حدثني عن مشكلة إنتاج حللتها.', source: 'candidate', seconds: 81,
              answer: 'تعطلت خدمة الدفع بسبب امتلاء القرص، فقمنا بتنظيف السجلات وإضافة تنبيه.',
              coaching: { rating: 5, feedback: 'الإجابة قصيرة وتصف ما فعله الفريق لا ما فعلته أنت.', fix: 'أضف ما قست به الأثر وما تغيّر بعد الحادثة.',
                improved_answer: 'عندما تعطلت خدمة الدفع بسبب امتلاء القرص، حددت السبب خلال عشر دقائق، ونظّفت السجلات، ثم أضفت تدويرًا تلقائيًا للسجلات وتنبيهًا عند 80% من سعة القرص، فلم تتكرر المشكلة.',
                model_answer: 'تعطلت خدمة الدفع ليلًا بسبب امتلاء القرص. حددت السبب خلال عشر دقائق، وأعدت الخدمة، ثم أضفت تدوير السجلات وتنبيهًا عند 80%.',
                why: 'يبحث المحاور عن الهدوء تحت الضغط، وعن التحسين الدائم بعد الحادثة.' } },
        ],
    },
    zh: {
        user_full_name: '张伟', username: 'zhangwei', interview_type: 'HR', topic: 'HR / General',
        created_at: '2026-10-18T10:00:00Z', duration_seconds: 512, status: 'in_progress',
        score: 0, summary: '', recommendation: '',
        qa_pairs: [
            { question: '请介绍一下你自己。', seconds: 70,
              answer: '我是一名有五年经验的后端工程师，主要使用 Python 和 Go。在上一家公司，我负责把订单系统迁移到微服务架构，系统的可用性从 99.5% 提高到了 99.95%。',
              coaching: { rating: 8, feedback: '结构清晰，并且用数字说明了成果。', fix: '最后一句说明你为什么想要这个职位。',
                improved_answer: '我是一名有五年经验的后端工程师，擅长 Python 和 Go。我主导了订单系统向微服务的迁移，把可用性从 99.5% 提高到 99.95%。我希望在贵公司继续做高可用系统。',
                model_answer: '我有五年后端开发经验，最自豪的是把订单系统迁移到微服务，可用性提升到 99.95%。我希望把这方面的经验带到这个职位。',
                why: '面试官想在两分钟内了解你是谁、做过什么，以及为什么适合这个职位。' } },
        ],
    },
};
