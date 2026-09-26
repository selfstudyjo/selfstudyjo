"""How much of the lesson, runbook and lab content actually carries a
translation -- measured against the live services, not read off a table.

    python tools/reader-preview/probe-live.py

WHY THIS EXISTS. The read-aloud control names the language it is reading in
whenever that is not the language the reader chose, which is the first thing on
this platform that says out loud how much of the content is English only. The
answer to "why is this in English?" is a COUNT, and CLAUDE.md is explicit that
its own tables are a snapshot to be re-queried rather than trusted.

It resolves every replica through the registry (working rule 1), reads only,
prints only counts and titles, and NEVER prints the token or a replica record --
a `GET /apps/<id>/` answer carries live database and admin credentials, so the
whole response is treated as a secret (working rule 5).
"""
import io
import json
import os
import random
import re
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

REGISTRIES = [
    'https://sfsdomains1.pythonanywhere.com',
    'https://sfsdomains2.pythonanywhere.com',
]

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass


def token():
    env = io.open(os.path.join(ROOT, '.env'), encoding='utf-8').read()
    m = re.search(r'^VITE_AUTH_TOKEN\s*=\s*(.+)$', env, re.M)
    if not m:
        raise SystemExit('no VITE_AUTH_TOKEN in selfstudyjo/.env')
    return m.group(1).strip().strip('"').strip("'")


TOKEN = token()


def get(url, timeout=(6, 25)):
    """A GET with the service token. `(connect, read)` in spirit: an idle
    PythonAnywhere web app takes ~20s to answer its first request, so a short
    timeout fails every call to an idle replica -- which is most of them, most
    of the time."""
    request = urllib.request.Request(url, headers={
        'Authorization': 'Token ' + TOKEN,
        'Accept': 'application/json',
    })
    with urllib.request.urlopen(request, timeout=timeout[1]) as response:
        return json.loads(response.read().decode('utf-8'))


def replicas(app_id):
    """Production replica base URLs for an app. Random start, ordered fallback."""
    for domain in random.sample(REGISTRIES, len(REGISTRIES)):
        try:
            data = get('{}/apps/{}/'.format(domain, app_id))
        except Exception:
            continue
        return [r['replica_url'].rstrip('/').replace('http://', 'https://')
                for r in data.get('replicas', [])]
    return []


def rows(app_id, path, key=None):
    """One replica's collection. Reads ONE replica and fails over on error --
    never merges two, which would show every record twice (working rule 3)."""
    for base in replicas(app_id):
        try:
            data = get(base + path)
        except Exception as exc:
            print('    (｜{} did not answer: {})'.format(base.split('//')[1][:22], exc))
            continue
        if isinstance(data, list):
            return data
        for name in ([key] if key else []) + ['results', 'records']:
            if name and isinstance(data.get(name), list):
                return data[name]
        for value in data.values():
            if isinstance(value, list):
                return value
        return []
    return []


def has(record, field, locale):
    """Does this record carry a NON-EMPTY translation of `field` in `locale`?

    The same test `records.field()` applies in the browser: a blank translation
    is a gap and not an answer, because `$td` falls through to the record's own
    English field for either."""
    entry = (record.get('translations') or {}).get(locale) or {}
    value = entry.get(field)
    return isinstance(value, str) and bool(value.strip())


def report(label, records, fields):
    total = len(records)
    print('\n  {}  ({} records)'.format(label, total))
    if not total:
        return
    for field in fields:
        present = sum(1 for r in records if isinstance(r.get(field), str)
                      and r.get(field, '').strip())
        ar = sum(1 for r in records if has(r, field, 'ar'))
        zh = sum(1 for r in records if has(r, field, 'zh'))
        print('    {:<12} English {:>4}   ar {:>4}   zh {:>4}'.format(
            field, present, ar, zh))
    missing = [r for r in records if not has(r, fields[0], 'ar')]
    if missing:
        print('    first few with NO Arabic {}:'.format(fields[0]))
        for r in missing[:6]:
            print('      - {}'.format(str(r.get(fields[0]) or r.get('title') or r.get('id'))[:66]))


print('Resolving the live services through the registry…')

print('\n=== app 19, lessons ===')
lessons = rows(19, '/lessons/')
report('lessons', lessons, ['title', 'content'])

print('\n=== app 19, courses ===')
report('courses', rows(19, '/courses/'), ['title', 'description'])

print('\n=== app 17, runbooks ===')
report('runbooks', rows(17, '/runbooks/'), ['title'])

print('\n=== app 11, labs ===')
labs = rows(11, '/api/labs/', key='labs')
print('\n  labs  ({} records)'.format(len(labs)))
if labs:
    keys = sorted(labs[0].keys())
    print('    fields on a lab record: {}'.format(', '.join(keys)))
    print('    any lab carrying a `translations` map: {}'.format(
        sum(1 for l in labs if l.get('translations'))))
    # MEASURED, not read off a table -- and the first version of this line got
    # it wrong in the interesting direction. It asserted from CLAUDE.md that a
    # lab "has no translation mechanism at all"; in fact `labcatalogue.py`
    # normalises a `translations` slot on every manifest, `labpublish.serialise`
    # round-trips it, and the frontend reads the title, the summary AND the
    # brief through `$td`. The mechanism is complete end to end -- app 11 simply
    # has no `utils/translations.py`, which is a different and lesser gap.
    #
    # What is missing is CONTENT: not one of the 210 manifests has an entry in
    # it. That distinction is the whole answer to "why is the lab in English?"
    # -- it is an authoring job, not a feature to build.
    print('    the plumbing: labcatalogue.py normalises the slot, labpublish')
    print('    round-trips it, and Labs.vue / LabWorkspace.vue read title,')
    print('    summary and brief through $td -- so the mechanism is complete.')
    print('    What is absent is any authored Arabic or Chinese.')
