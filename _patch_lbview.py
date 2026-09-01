"""One-shot: show lab points on the leaderboard page."""
import io

path = 'src/views/Leaderboard.vue'
text = io.open(path, encoding='utf-8').read()


def swap(old, new, why):
    global text
    assert old in text, 'anchor missing: ' + why
    assert text.count(old) == 1, 'anchor not unique: ' + why
    text = text.replace(old, new, 1)
    print('ok:', why)


# ---- the sort dropdown ----------------------------------------------------
swap("""          <option value="certificates">{{ $t('Certificates') }}</option>""",
     """          <option value="certificates">{{ $t('Certificates') }}</option>
          <option value="labsCompleted">{{ $t('Labs completed') }}</option>""",
     'sort option')

swap("""const sortKey = ref<'points' | 'certificates' | 'averageScore' | 'lastActiveAt'>('points');""",
     """const sortKey = ref<'points' | 'certificates' | 'labsCompleted'
    | 'averageScore' | 'lastActiveAt'>('points');""",
     'sortKey type')

# ---- the podium meta ------------------------------------------------------
swap("""              <span v-if="row.certificates" class="lb-podium__stat">
                <span>{{ row.certificates }}</span>
                {{ row.certificates === 1 ? 'credential' : 'credentials' }}""",
     """              <span v-if="row.labsCompleted" class="lb-podium__stat">
                <span>{{ row.labsCompleted }}</span>
                {{ row.labsCompleted === 1 ? 'lab' : 'labs' }}
              </span>

              <span v-if="row.certificates" class="lb-podium__stat">
                <span>{{ row.certificates }}</span>
                {{ row.certificates === 1 ? 'credential' : 'credentials' }}""",
     'podium stat')

# ---- the table -----------------------------------------------------------
swap("""                  <td class="lb-num lb-hide-sm">{{ row.quizzesPassed }}</td>
                  <td class="lb-num lb-hide-md">{{ row.certificates }}</td>""",
     """                  <td class="lb-num lb-hide-sm">{{ row.quizzesPassed }}</td>
                  <td class="lb-num lb-hide-md">{{ row.labsCompleted }}</td>
                  <td class="lb-num lb-hide-md">{{ row.certificates }}</td>""",
     'table cell')

# ---- the printed scoring table -------------------------------------------
swap("""                  <td>+{{ POINTS.distinction }}</td>""",
     """                  <td>+{{ POINTS.distinction }}</td>""",
     'noop') if False else None

io.open(path, 'w', encoding='utf-8', newline='').write(text)
print('\nview part 1 patched')
