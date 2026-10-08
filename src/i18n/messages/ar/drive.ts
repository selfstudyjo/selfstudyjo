/**
 * The self-driving simulator pane (CARLA track, app 11) and its GUI panels.
 *
 * Its own area because "drive", "run", "brake" and "replay" here are a CAR and a
 * RECORDING, not a lab run or a tutor reply. Key names on the keyboard line
 * (W, S, A, D, R, Space) are left as printed on the keyboard; `python drive.py`,
 * `save_to_disk`, `sfs_eval` and `--vehicle` are code and stay in English.
 */

import type { Catalogue } from '../../index';

const drive: Catalogue = {
    /* The pane. */
    'Simulator view': 'عرض المحاكي',
    'Loading the simulator…': 'جارٍ تحميل المحاكي…',
    'The simulator could not be reached.': 'تعذّر الوصول إلى المحاكي.',
    '3D is not available in this browser, so the replay is drawn from above.':
        'العرض ثلاثي الأبعاد غير متاح في هذا المتصفح، لذلك تُعرض الإعادة من الأعلى.',
    'Town': 'المدينة',
    'Weather': 'الطقس',
    'Script': 'السكربت',
    'Go': 'انطلق',
    'Drive': 'قيادة',
    'Play': 'تشغيل',
    'Replay': 'الإعادة',
    'Replay position': 'موضع الإعادة',
    'Playback speed': 'سرعة التشغيل',
    'Wider view': 'عرض أوسع',
    'Running… {v0}s': 'قيد التشغيل… {v0} ث',
    'Brake': 'الفرامل',
    'BRAKE': 'فرامل',
    'Off the road': 'خارج الطريق',
    'Crashed - press R to reset': 'اصطدام - اضغط R لإعادة الضبط',
    'W / ↑ throttle · S / ↓ brake, then reverse · A D / ← → steer · Space handbrake · R reset':
        'W / ↑ تسارع · S / ↓ فرامل ثم رجوع · A D / ← → توجيه · Space فرامل اليد · R إعادة الضبط',
    'Pick the car your script drives. The pane passes it as --vehicle; the starter scripts read it with argparse.':
        'اختر السيارة التي يقودها السكربت. تمرّرها اللوحة كوسيط --vehicle، وتقرؤها السكربتات الأولية باستخدام argparse.',
    'No run yet. Press Run - or type python drive.py in the CARLA Console.':
        'لا يوجد تشغيل بعد. اضغط تشغيل - أو اكتب python drive.py في وحدة تحكم CARLA.',
    'No collisions, red lights or lane invasions in this run.':
        'لا اصطدامات ولا إشارات حمراء ولا تجاوز للمسار في هذا التشغيل.',
    'What your script prints appears here.': 'يظهر هنا ما يطبعه السكربت.',
    'Images your script saves with save_to_disk, and estimates it submits with sfs_eval, appear here.':
        'تظهر هنا الصور التي يحفظها السكربت باستخدام save_to_disk، والتقديرات التي يرسلها باستخدام sfs_eval.',
    'frame': 'إطار',
    'ground truth': 'القيمة الحقيقية',
    'your estimate': 'تقديرك',

    /* The GUI panels and their columns. */
    'Self-Driving (CARLA)': 'القيادة الذاتية (CARLA)',
    'Goals': 'الأهداف',
    'Goal': 'الهدف',
    'What it asks': 'المطلوب',
    'Met': 'تحقّق',
    'Last run': 'آخر تشغيل',
    'Your runs': 'تشغيلاتك',
    'Defaults': 'الإعدادات الافتراضية',
    'Map': 'الخريطة',
    'Vehicle': 'المركبة',
    'Collisions': 'الاصطدامات',
    'Lane invasions': 'تجاوزات المسار',
    'Red lights': 'الإشارات الحمراء',
    'Driving score': 'درجة القيادة',
    'Goals met': 'الأهداف المحققة',
    'Distance (m)': 'المسافة (م)',
    'Max speed (m/s)': 'السرعة القصوى (م/ث)',
    'Sim time (s)': 'زمن المحاكاة (ث)',
};

export default drive;
