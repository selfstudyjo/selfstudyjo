// Stands in for `@/services/lab.service` in the Labs preview.
//
// The data is deliberately awkward: a 12-column SQL result that has to scroll, a
// long error, terminal output with tabs and a very long path, and Python output
// with a traceback. A preview fed tidy data proves nothing.
export type { CommandResult, PythonResult, SQLResult, Student, StudentResponse }
    from '../../../src/services/lab.service';
import type { CommandResult, PythonResult, SQLResult, Student }
    from '../../../src/services/lab.service';

const params = new URLSearchParams(location.search);
const state = params.get('state') || 'ok';
const delay = <T,>(v: T, ms = 240): Promise<T> => new Promise(r => setTimeout(() => r(v), ms));

const STUDENT: Student = {
    id: 41,
    username: 'mahmoud',
    uuid_credentials: 'b7d1f0c2-9a44-4e18-8f61-2c0d5a7e9b33',
    created_at: '2026-02-11T08:00:00Z',
    expire_date: '2027-02-11T08:00:00Z',
    home_replica: 'https://sfsuserlab2.pythonanywhere.com/',
};

export const labService = {
    getOrCreateStudent: (_u: string) =>
        state === 'error' ? Promise.reject(new Error(
            'The lab replica did not answer. Its first request of the day can take about twenty seconds — try again.'))
        : state === 'loading' ? new Promise<Student>(() => { /* never resolves */ })
        : delay(STUDENT),

    runSQL: (_u: string, _q: string): Promise<SQLResult> => delay({
        result: [
            { id: 1, title: 'Web Technologies', instructor: 'Dr. Odeh', hours: 42, price: '49.90', level: 'intermediate', lessons: 20, quizzes: 6, created_at: '2026-01-04', updated_at: '2026-08-19', published: 1, external_course_id: 'course-web-technologies-2026' },
            { id: 2, title: 'Networking Fundamentals', instructor: 'Dr. Odeh', hours: 36, price: '49.90', level: 'beginner', lessons: 16, quizzes: 4, created_at: '2026-02-18', updated_at: '2026-07-02', published: 1, external_course_id: 'course-networking-fundamentals' },
            { id: 3, title: 'Information Security Fundamentals', instructor: 'Ms. Haddad', hours: 28, price: '0.00', level: 'beginner', lessons: 12, quizzes: 3, created_at: '2026-03-30', updated_at: '2026-08-27', published: 0, external_course_id: 'course-information-security' },
        ],
        truncated: true,
        message: 'Showing the first 3 of 25 rows.',
    }, 600),

    resetDemoDatabase: (_u: string): Promise<CommandResult> =>
        delay({ output: 'demo_db.sqlite3 restored from the template.', error: '' }),

    runLinuxCommand: (_u: string, cmd: string): Promise<CommandResult> => delay({
        output: cmd.startsWith('ls')
            ? 'total 28\ndrwxr-xr-x 2 mahmoud mahmoud 4096 Aug 31 09:14 .\ndrwxr-xr-x 9 mahmoud mahmoud 4096 Aug 31 09:02 ..\n-rw-r--r-- 1 mahmoud mahmoud  612 Aug 31 09:14 notes.md\n-rw-r--r-- 1 mahmoud mahmoud 2048 Aug 30 17:41 demo_db.sqlite3\n-rw-r--r-- 1 mahmoud mahmoud   84 Aug 29 11:20 very_long_file_name_that_has_no_break_opportunities_at_all.txt'
            : `${cmd}: command executed`,
        error: '',
        ran_on: 'https://sfsuserlab2.pythonanywhere.com/',
    }, 500),

    killProcess: (_u: string): Promise<CommandResult> =>
        delay({ output: 'Stopped 1 process.', error: '' }),

    runPythonCode: (_u: string, _code: string): Promise<PythonResult> => delay({
        output: 'Hello from the Self Study lab\n[1, 4, 9, 16, 25]\n',
        error: 'Traceback (most recent call last):\n  File "/home/mahmoud/workspace/main.py", line 7, in <module>\n    print(total / count)\nZeroDivisionError: division by zero',
    }, 700),

    checkLabHealth: () => delay(true),
};
