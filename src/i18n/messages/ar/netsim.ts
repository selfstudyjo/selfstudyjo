/**
 * The Network Simulator, its lessons and the Roblox studio — Arabic.
 *
 * ============================================================
 * A CLI KEYWORD IS NOT A WORD, AND THIS FILE IS MOSTLY ABOUT THAT LINE
 * ============================================================
 *
 * The simulator's screens are half prose and half vocabulary a student TYPES
 * into a router. `permit`, `deny`, `trunk`, `access`, `rstp`, `icmp`, `inside`,
 * `full`, `half`, `standard`, `extended` — every one of those is a literal that
 * a Cisco IOS command line accepts and nothing else. Translated, a student
 * reading the Arabic screen types the Arabic word and the command is rejected,
 * which is a worse outcome than the label having been in English.
 *
 * So they are on `tools/i18n-check/untranslated.json` with that reason
 * recorded, and the check fails if one of them is ever also given a
 * translation. What IS translated is everything around them: the headings, the
 * explanations, the empty states and the diagnostics — which is where the
 * teaching actually lives, and which a student who reads Arabic cannot
 * currently follow at all.
 *
 * The same line runs through the labs (`ls -la` is `ls -la`) and through
 * `rtl.css` (a `<pre>` is pinned LTR). It is the platform's most consistently
 * useful distinction: **a name a machine parses is not prose.**
 *
 * Protocol NAMES are a third category and are also left alone by the codemod's
 * `ATOMIC` list — VLAN, ACL, ARP, MTU, DHCP. They are written the same way in
 * an Arabic networking textbook, so three identical catalogue entries would be
 * three chances for one of them to be wrong.
 */

import type { Catalogue } from '../../index';

const netsim: Catalogue = {
    /* ---------------------------------------------------------------- *
     * The canvas and the palette
     * ---------------------------------------------------------------- */
    'Your canvas is empty': 'لوحتك فارغة',
    'Drag a device from the palette on the left, load a template, or ask the AI to build a network for you.':
        'اسحب جهازاً من اللوحة على اليسار، أو حمّل قالباً، أو اطلب من الذكاء الاصطناعي بناء شبكة لك.',
    'Drag onto the canvas, or click to drop it in the centre.': 'اسحبه إلى اللوحة، أو اضغط لإسقاطه في الوسط.',
    'Click a device to configure it, or a cable to inspect the link.':
        'اضغط على جهاز لضبط إعداداته، أو على كابل لفحص الوصلة.',
    'Click the second device to complete the cable — press': 'اضغط على الجهاز الثاني لإكمال الكابل — واضغط',
    'to cancel': 'للإلغاء',
    'Search 60+ devices…': 'ابحث في أكثر من 60 جهازاً…',
    'Nothing selected': 'لم يُحدَّد شيء',
    'Start from a template': 'ابدأ من قالب',
    'Load the starter topology': 'حمّل الطبولوجيا المبدئية',
    'Generate a topology': 'أنشئ طبولوجيا',
    'Generate with AI': 'أنشئ بالذكاء الاصطناعي',
    'Build on canvas': 'ابنِ على اللوحة',
    'Build': 'بناء',
    'Fit': 'ملاءمة',
    'Fit to view': 'ملاءمة العرض',
    'Browse…': 'استعراض…',
    'Browse the curriculum': 'استعرض المنهج',
    'Label': 'التسمية',
    'Notes': 'ملاحظات',
    'devices': 'أجهزة',
    'devices ·': 'أجهزة ·',
    'links': 'وصلات',
    'links ready to build': 'وصلة جاهزة للبناء',
    'hosts': 'مضيفاً',
    'Recalculate': 'إعادة الحساب',
    'Run "Recalculate" after cabling some devices together.': 'شغّل «إعادة الحساب» بعد توصيل بعض الأجهزة.',

    /* ---------------------------------------------------------------- *
     * Interfaces and addressing
     * ---------------------------------------------------------------- */
    'About this device': 'عن هذا الجهاز',
    'Interface': 'الواجهة',
    'Interface enabled (no shutdown)': 'الواجهة مُفعَّلة (no shutdown)',
    'IPv4 address': 'عنوان IPv4',
    'IPv6 address': 'عنوان IPv6',
    'IPv6 prefix': 'بادئة IPv6',
    'Subnet mask': 'قناع الشبكة الفرعية',
    'Default gateway': 'البوابة الافتراضية',
    'Default route / gateway of last resort': 'المسار الافتراضي / بوابة الملاذ الأخير',
    'Address': 'العنوان',
    'Obtain address by DHCP': 'الحصول على عنوان عبر DHCP',
    'Use DHCP for addressing': 'استخدم DHCP للعنونة',
    'Cable type': 'نوع الكابل',
    'Cabled ports': 'المنافذ الموصولة',
    'Port': 'المنفذ',
    'Duplex': 'نمط الإرسال',
    'speed': 'السرعة',
    'Bandwidth (Mbps)': 'عرض النطاق (ميغابت/ث)',
    'Latency': 'زمن الاستجابة',
    'Frame size': 'حجم الإطار',
    'errors': 'أخطاء',
    'Value': 'القيمة',
    'Host': 'المضيف',
    'Source': 'المصدر',
    'Destination': 'الوجهة',
    'Via': 'عبر',
    'Previous hop': 'القفزة السابقة',
    'Action': 'الإجراء',
    'Hits': 'المطابقات',
    'Reachable addresses': 'العناوين القابلة للوصول',
    'Empty — address and enable the interfaces first.': 'فارغ — عنونة الواجهات وتفعيلها أولاً.',
    '{v0} usable · {v1}': '{v0} قابل للاستخدام · {v1}',
    '{v0} · Layer {v1} · {v2}': '{v0} · الطبقة {v1} · {v2}',
    '{v0} · priority {v1}': '{v0} · الأولوية {v1}',
    '{v0} · {v1} · {v2} · MAC {v3}': '{v0} · {v1} · {v2} · MAC {v3}',
    'rx {v0} frames / {v1} B · tx {v2} frames / {v3} B · drops {v4}':
        'مستقبَل {v0} إطاراً / {v1} بايت · مُرسَل {v2} إطاراً / {v3} بايت · مُهمَل {v4}',
    '· {v0} bits': '· {v0} بت',
    'Layers {v0}': 'الطبقات {v0}',
    'hop {v0} / {v1}': 'القفزة {v0} / {v1}',

    /* ---------------------------------------------------------------- *
     * VLANs and switching
     * ---------------------------------------------------------------- */
    'VLANs': 'شبكات VLAN',
    'VLAN {v0}': 'VLAN {v0}',
    'VLAN database': 'قاعدة بيانات VLAN',
    'VLANs in this topology': 'شبكات VLAN في هذه الطبولوجيا',
    'VLAN tag': 'وسم VLAN',
    'Add VLAN': 'إضافة VLAN',
    'Delete VLAN': 'حذف VLAN',
    'Access VLAN': 'VLAN الوصول',
    'Native VLAN': 'VLAN الأصلية',
    'Mapped VLAN': 'VLAN المرتبطة',
    'Allowed VLANs (blank = all)': 'شبكات VLAN المسموحة (اتركها فارغة للكل)',
    'Access ports': 'منافذ الوصول',
    'Switchport mode': 'وضع منفذ التبديل',
    'Add SVI': 'إضافة SVI',
    'SVIs (inter-VLAN routing)': 'واجهات SVI (التوجيه بين شبكات VLAN)',
    'No SVIs yet. Each VLAN needs one to be routable.': 'لا توجد واجهات SVI بعد. تحتاج كل VLAN إلى واحدة لتكون قابلة للتوجيه.',
    'MAC address table': 'جدول عناوين MAC',
    'Empty — a switch only learns from frames it receives.': 'فارغ — لا يتعلّم المبدّل إلا من الإطارات التي تصله.',
    'ARP cache': 'ذاكرة ARP',
    'Empty — ARP is populated on demand, when traffic needs it.':
        'فارغة — تُملأ ذاكرة ARP عند الحاجة، حين تتطلّبها حركة البيانات.',
    '{v0} devices share this domain': '{v0} جهازاً تتشارك هذا النطاق',
    'A broadcast domain is the set of devices that receive each other\'s broadcast frames. A switch does not split them — only a VLAN boundary or a router does.':
        'نطاق البثّ هو مجموعة الأجهزة التي تتلقّى إطارات البثّ من بعضها. والمبدّل لا يفصلها — بل يفصلها حدّ VLAN أو موجّه فقط.',

    /* ---------------------------------------------------------------- *
     * Spanning tree
     * ---------------------------------------------------------------- */
    'Spanning tree': 'الشجرة الممتدة',
    'Spanning tree enabled': 'الشجرة الممتدة مُفعَّلة',
    'Bridge priority': 'أولوية الجسر',
    '· STP {v0}': '· STP {v0}',
    'Lowest priority wins the root election; the MAC address breaks ties. Set this deliberately on the switch you want as root — leaving every switch at 32768 means the oldest box wins by accident.':
        'تفوز أقل أولوية في انتخاب الجذر، ويحسم عنوان MAC التعادل. اضبط هذه القيمة بقصدٍ على المبدّل الذي تريده جذراً — فترك كل المبدّلات على 32768 يعني أن أقدم جهاز يفوز بالمصادفة.',

    /* ---------------------------------------------------------------- *
     * Routing
     * ---------------------------------------------------------------- */
    'Static routes': 'المسارات الثابتة',
    'Dynamic routing': 'التوجيه الديناميكي',
    'Add route': 'إضافة مسار',
    'Routing table (live)': 'جدول التوجيه (مباشر)',
    'None. A router only knows its connected networks until you add routes.':
        'لا شيء. لا يعرف الموجّه سوى شبكاته المتّصلة حتى تضيف مسارات.',
    'Router ID': 'معرّف الموجّه',
    'Process ID': 'معرّف العملية',
    'RIP version': 'إصدار RIP',
    'Traceroute': 'تتبّع المسار',
    'trace': 'تتبّع',

    /* ---------------------------------------------------------------- *
     * ACLs and NAT
     * ---------------------------------------------------------------- */
    'Access control lists': 'قوائم التحكّم بالوصول',
    'New ACL': 'قائمة ACL جديدة',
    'Add rule': 'إضافة قاعدة',
    'ACL inbound': 'ACL للداخل',
    'ACL outbound': 'ACL للخارج',
    'No ACLs. Create one, add rules, then apply it to an interface on the Interfaces tab.':
        'لا توجد قوائم ACL. أنشئ واحدة، وأضف القواعد، ثم طبّقها على واجهة من تبويب الواجهات.',
    'implicit deny any — every ACL ends with this': 'رفض ضمني للكل — تنتهي كل قائمة ACL بهذا',
    'NAT enabled': 'NAT مُفعَّل',
    'NAT role': 'دور NAT',
    'Inside global': 'داخلي عام',
    'Inside local': 'داخلي محلي',
    'Outside': 'خارجي',
    'Outside address': 'العنوان الخارجي',
    'Mark interfaces as NAT inside / outside on the Interfaces tab, or nothing is translated.':
        'حدّد الواجهات كـ NAT داخلي / خارجي من تبويب الواجهات، وإلا لن يُترجَم أي عنوان.',

    /* ---------------------------------------------------------------- *
     * Services
     * ---------------------------------------------------------------- */
    'Address pools': 'مجمّعات العناوين',
    'Add pool': 'إضافة مجمّع',
    'Active leases': 'الإيجارات النشطة',
    'Lease (hours)': 'مدة الإيجار (ساعات)',
    'Range start': 'بداية النطاق',
    'Range end': 'نهاية النطاق',
    'dynamic pool': 'مجمّع ديناميكي',
    'DNS server': 'خادم DNS',
    'Authoritative records': 'السجلات المرجعية',
    'Add record': 'إضافة سجل',
    'Domains': 'النطاقات',
    'No records. Without one, clients get NXDOMAIN.': 'لا توجد سجلات. وبدونها يتلقّى العملاء NXDOMAIN.',
    'HTTP server (port {v0})': 'خادم HTTP (المنفذ {v0})',
    'Also serve HTTPS (443)': 'قدّم HTTPS أيضاً (443)',
    'Page title': 'عنوان الصفحة',
    'Page body (HTML)': 'محتوى الصفحة (HTML)',

    /* ---------------------------------------------------------------- *
     * Wireless
     * ---------------------------------------------------------------- */
    'Band': 'النطاق الترددي',
    'Channel': 'القناة',
    'Channel width (MHz)': 'عرض القناة (ميغاهرتز)',
    'Passphrase': 'عبارة المرور',
    'Security': 'الأمان',
    'Guest SSID (optional)': 'SSID للزوّار (اختياري)',
    'Join SSID': 'الانضمام إلى SSID',
    'Associated clients ({v0})': 'العملاء المرتبطون ({v0})',
    'matches the AP exactly': 'يطابق نقطة الوصول تماماً',
    'None. A client associates when its wireless interface has the same SSID and passphrase.':
        'لا شيء. يرتبط العميل عندما تحمل واجهته اللاسلكية نفس SSID ونفس عبارة المرور.',
    'Hide the SSID (security theatre — it does not stop anyone)':
        'إخفاء SSID (إجراء شكلي — لا يمنع أحداً)',

    /* ---------------------------------------------------------------- *
     * The simulation, the packet inspector and the event log
     * ---------------------------------------------------------------- */
    'Ping': 'اختبار Ping',
    'Ping…': 'اختبار Ping…',
    'Target (IP or name)': 'الهدف (عنوان IP أو اسم)',
    'Commands': 'الأوامر',
    'Reachability matrix': 'مصفوفة إمكانية الوصول',
    'Every addressed host pinged against every other, one packet each. Green means both directions work.':
        'كل مضيف معنون يُختبر مع كل مضيف آخر، بحزمة واحدة لكل اختبار. اللون الأخضر يعني أن الاتجاهين يعملان.',
    'Run a ping, request DHCP, resolve a name or fetch a page. Every hop is captured with its real headers, so you can watch the encapsulation change layer by layer.':
        'شغّل اختبار Ping، أو اطلب DHCP، أو حلّ اسماً، أو اجلب صفحة. تُسجَّل كل قفزة بترويساتها الحقيقية، لتراقب تغيّر التغليف طبقةً بطبقة.',
    'No packet captured yet': 'لم تُسجَّل أي حزمة بعد',
    'Open this packet trace': 'افتح تتبّع هذه الحزمة',
    'Protocol stack': 'مكدّس البروتوكولات',
    'Encapsulation — top of the stack is the application, bottom is bits on the medium':
        'التغليف — أعلى المكدّس هو التطبيق، وأسفله هو البتات على وسط النقل',
    'Event log': 'سجل الأحداث',
    'No events yet. Run the simulation, ping between two hosts, or request DHCP on a client.':
        'لا أحداث بعد. شغّل المحاكاة، أو اختبر Ping بين مضيفين، أو اطلب DHCP على عميل.',
    'Running configuration': 'الإعداد الجاري',
    'Copy the whole session': 'نسخ الجلسة كاملةً',
    'Clear the screen': 'مسح الشاشة',
    'Clear the conversation': 'مسح المحادثة',

    /* ---------------------------------------------------------------- *
     * Checking a design, and the diagnostics
     * ---------------------------------------------------------------- */
    'Check my work': 'تحقّق من عملي',
    'Re-check': 'إعادة التحقّق',
    'Design review': 'مراجعة التصميم',
    'Issues on this device': 'ملاحظات على هذا الجهاز',
    'Nothing wrong': 'لا يوجد خطأ',
    'Problem:': 'المشكلة:',
    'Why this matters:': 'لماذا يهمّ هذا:',
    'Remember:': 'تذكّر:',
    'Fix': 'التصحيح',
    'Fix: {v0}': 'التصحيح: {v0}',
    'Hint: {v0}': 'تلميح: {v0}',
    'Next: {v0}': 'التالي: {v0}',
    '{v0} match{v1}': '{v0} مطابقة',
    'Addressing, cabling, VLANs, routing and services all check out. Run a ping to confirm end-to-end behaviour.':
        'العنونة والكوابل وشبكات VLAN والتوجيه والخدمات كلها سليمة. شغّل اختبار Ping للتأكّد من السلوك من طرف إلى طرف.',
    'the gateway {v0} is not inside any of this host\'s own subnets. A host cannot even ARP for an address outside its subnet — this is nearly always a wrong subnet mask.':
        'البوابة {v0} ليست داخل أي من الشبكات الفرعية لهذا المضيف. والمضيف لا يستطيع حتى إرسال ARP لعنوان خارج شبكته الفرعية — وهذا في الغالب قناع شبكة فرعية خطأ.',
    'a host compares the destination against its own address using the mask. Same network → ARP directly. Different network → send the frame to the gateway\'s MAC while the IP header still targets the final destination.':
        'يقارن المضيف الوجهة بعنوانه الخاص باستخدام القناع. الشبكة نفسها ← ARP مباشرةً. شبكة مختلفة ← أرسل الإطار إلى عنوان MAC للبوابة بينما تبقى ترويسة IP موجَّهة إلى الوجهة النهائية.',

    /* ---------------------------------------------------------------- *
     * The AI tutor
     * ---------------------------------------------------------------- */
    'AI Network Tutor': 'مدرّس الشبكات بالذكاء الاصطناعي',
    'Tutor': 'المدرّس',
    'Teach': 'تعليم',
    'Explain and teach': 'اشرح وعلّم',
    'Troubleshoot a symptom': 'تشخيص عارض',
    'Ask anything about networking': 'اسأل أي شيء عن الشبكات',
    '— I can see every device, address, VLAN, route and ACL on your canvas, plus the last simulation run.':
        '— أستطيع رؤية كل جهاز وعنوان وVLAN ومسار وقائمة ACL على لوحتك، وكذلك آخر تشغيل للمحاكاة.',
    '“Build me a campus network with redundant uplinks.”': '«ابنِ لي شبكة حرم جامعي بوصلات صاعدة احتياطية.»',
    '“Explain what my trunk is actually doing, using my devices.”':
        '«اشرح لي ما يفعله منفذ trunk عندي فعلاً، باستخدام أجهزتي.»',
    '“Review my design like a senior engineer would.”': '«راجع تصميمي كما يفعل مهندس خبير.»',
    '“Why can PC-A not reach the server?”': '«لماذا لا يستطيع PC-A الوصول إلى الخادم؟»',
    'choose a device…': 'اختر جهازاً…',

    /* ---------------------------------------------------------------- *
     * The lesson panel and the Learn hub
     * ---------------------------------------------------------------- */
    'Tasks': 'المهام',
    'Tests': 'الاختبارات',
    'Theory': 'النظرية',
    'Quiz': 'اختبار قصير',
    'Standard': 'قياسي',
    'Pro': 'متقدّم',
    'Lesson complete': 'اكتمل الدرس',
    'No lesson attached': 'لا يوجد درس مرتبط',
    'Pick a lesson from the Learn hub and the studio will check your work against the live network as you build it.':
        'اختر درساً من مركز التعلّم وسيتحقّق الاستوديو من عملك في مقابل الشبكة الحيّة أثناء بنائك لها.',
    'Every task was verified against your running network — not a multiple-choice answer.':
        'تم التحقّق من كل مهمة في مقابل شبكتك العاملة — لا في مقابل إجابة اختيار من متعدد.',
    '{v0} lessons across {v1} tracks, roughly {v2} hours of work. Every task is checked against your live simulated network — not against a multiple-choice answer.':
        '{v0} درساً في {v1} مسارات، بما يقارب {v2} ساعة عمل. تُتحقَّق كل مهمة في مقابل شبكتك المحاكاة الحيّة — لا في مقابل إجابة اختيار من متعدد.',
    '← Network Simulator': '← محاكي الشبكات',
};

export default netsim;
