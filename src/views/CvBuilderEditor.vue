<template>
  <div class="cve" v-if="cv">
    <!-- ═══ Header ═══ -->
    <header class="cve-head">
      <div class="cve-head-left">
        <button class="icon-btn" :title="$t('Back to my CVs')" @click="goBack">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        </button>
        <div class="cve-title-wrap">
          <input v-model="cv.title" class="cve-title" :placeholder="$t('CV title')" @input="markDirty" />
          <p class="cve-sub">
            <span class="meter" :title="`${completeness}% complete`">
              <span class="meter-fill" :style="{ width: completeness + '%' }"></span>
            </span>
            {{ $t('{v0}% complete · {v1} words', { v0: completeness, v1: wordCount }) }}
            <span v-if="cv.job_target?.match_report?.score != null" class="pill">
              {{ $t('{v0}% job match', { v0: cv.job_target.match_report.score }) }}
            </span>
            <span class="save-state" :class="saveState">{{ saveLabel }}</span>
          </p>
        </div>
      </div>

      <div class="cve-head-actions">
        <button class="btn btn-ghost" :disabled="saving || !dirty" @click="save()">
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
        <button class="btn btn-primary" :disabled="!!downloading" @click="askDownload">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
          {{ downloading ? 'Building…' : 'Download' }}
        </button>
      </div>
    </header>

    <div v-if="banner" class="cve-banner" :class="bannerType">
      {{ banner }}
      <button class="banner-x" @click="banner = ''">×</button>
    </div>

    <!-- ═══ Tabs ═══ -->
    <nav class="cve-tabs" role="tablist">
      <button v-for="tab in TABS" :key="tab.key" role="tab"
              :class="['cve-tab', { active: activeTab === tab.key }]"
              @click="switchTab(tab.key)">
        <span class="cve-tab-icon" v-html="tab.icon"></span>
        {{ tab.label }}
      </button>
    </nav>

    <div class="cve-body" :class="{ split: showSplitPreview }">
      <!-- ══════════════════════ CONTENT ══════════════════════ -->
      <section v-show="activeTab === 'content'" class="cve-panel">
        <div class="card">
          <div class="card-head">
            <h3>{{ $t('Personal details') }}</h3>
          </div>
          <div class="grid-2">
            <label class="field"><span>{{ $t('Full name') }}</span>
              <input v-model="cv.personal.full_name" @input="markDirty" :placeholder="$t('Layla Haddad')" /></label>
            <label class="field"><span>{{ $t('Professional title') }}</span>
              <input v-model="cv.personal.headline" @input="markDirty" :placeholder="$t('Senior Backend Engineer')" /></label>
            <label class="field"><span>{{ $t('Email') }}</span>
              <input v-model="cv.personal.email" @input="markDirty" type="email" /></label>
            <label class="field"><span>{{ $t('Phone') }}</span>
              <input v-model="cv.personal.phone" @input="markDirty" /></label>
            <label class="field"><span>{{ $t('Location') }}</span>
              <input v-model="cv.personal.location" @input="markDirty" :placeholder="$t('Amman, Jordan')" /></label>
            <label class="field"><span>{{ $t('Website') }}</span>
              <input v-model="cv.personal.website" @input="markDirty" /></label>
            <label class="field"><span>LinkedIn</span>
              <input v-model="cv.personal.linkedin" @input="markDirty" /></label>
            <label class="field"><span>GitHub</span>
              <input v-model="cv.personal.github" @input="markDirty" /></label>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <h3>{{ $t('Professional summary') }}</h3>
            <button class="btn btn-ai btn-sm" :disabled="busySection === 'summary' || !aiReady"
                    @click="rewrite('summary')">
              {{ busySection === 'summary' ? 'Rewriting…' : '✨ Improve with AI' }}
            </button>
          </div>
          <textarea v-model="cv.personal.summary" rows="5" @input="markDirty"
                    placeholder="Three or four sentences: your seniority, your specialism, and the two things you are best at."></textarea>
          <p class="hint">{{ $t('{v0} characters. Recruiters read this first and often only this.', { v0: (cv.personal.summary || '').length }) }}</p>
        </div>

        <!-- Experience -->
        <div class="card">
          <div class="card-head">
            <h3>{{ $t('Experience') }} <span class="badge">{{ cv.experience.length }}</span></h3>
            <div class="card-head-actions">
              <button class="btn btn-ai btn-sm" :disabled="busySection === 'experience' || !aiReady || !cv.experience.length"
                      @click="rewrite('experience')">
                {{ busySection === 'experience' ? 'Rewriting…' : '✨ Improve all bullets' }}
              </button>
              <button class="btn btn-ghost btn-sm" @click="addEntry('experience')">{{ $t('+ Add role') }}</button>
            </div>
          </div>

          <div v-for="(entry, i) in cv.experience" :key="entry.id || i" class="entry">
            <div class="entry-head">
              <span class="entry-index">{{ i + 1 }}</span>
              <div class="entry-move">
                <button class="icon-btn sm" :disabled="i === 0" :title="$t('Move up')" @click="move('experience', i, -1)">↑</button>
                <button class="icon-btn sm" :disabled="i === cv.experience.length - 1" :title="$t('Move down')" @click="move('experience', i, 1)">↓</button>
                <button class="icon-btn sm danger" :title="$t('Remove')" @click="removeEntry('experience', i)">×</button>
              </div>
            </div>
            <div class="grid-2">
              <label class="field"><span>{{ $t('Job title') }}</span>
                <input v-model="entry.role" @input="markDirty" /></label>
              <label class="field"><span>{{ $t('Company') }}</span>
                <input v-model="entry.company" @input="markDirty" /></label>
              <label class="field"><span>{{ $t('Location') }}</span>
                <input v-model="entry.location" @input="markDirty" /></label>
              <label class="field"><span>{{ $t('Dates') }}</span>
                <div class="date-row">
                  <input v-model="entry.start" @input="markDirty" :placeholder="$t('Mar 2021')" />
                  <input v-model="entry.end" @input="markDirty" :disabled="entry.current"
                         :placeholder="entry.current ? 'Present' : 'Feb 2024'" />
                </div>
              </label>
            </div>
            <label class="check">
              <input type="checkbox" v-model="entry.current" @change="markDirty" />
              {{ $t('I still work here') }}
            </label>
            <label class="field"><span>{{ $t('What you achieved — one per line') }}</span>
              <textarea :value="linesOf(entry.bullets)" rows="4" @input="setLines(entry, 'bullets', $event)"
                        placeholder="Led migration of the payments monolith to 11 services, cutting p95 latency from 820ms to 310ms"></textarea>
            </label>
            <label class="field"><span>{{ $t('Tools and technologies — comma separated') }}</span>
              <input :value="(entry.tech || []).join(', ')" @input="setList(entry, 'tech', $event)" /></label>
          </div>
          <p v-if="!cv.experience.length" class="empty-note">{{ $t('No roles yet. Add one, or import a CV and the AI fills this in for you.') }}</p>
        </div>

        <!-- Education -->
        <div class="card">
          <div class="card-head">
            <h3>{{ $t('Education') }} <span class="badge">{{ cv.education.length }}</span></h3>
            <button class="btn btn-ghost btn-sm" @click="addEntry('education')">{{ $t('+ Add') }}</button>
          </div>
          <div v-for="(entry, i) in cv.education" :key="entry.id || i" class="entry">
            <div class="entry-head">
              <span class="entry-index">{{ i + 1 }}</span>
              <div class="entry-move">
                <button class="icon-btn sm" :disabled="i === 0" @click="move('education', i, -1)">↑</button>
                <button class="icon-btn sm" :disabled="i === cv.education.length - 1" @click="move('education', i, 1)">↓</button>
                <button class="icon-btn sm danger" @click="removeEntry('education', i)">×</button>
              </div>
            </div>
            <div class="grid-2">
              <label class="field"><span>{{ $t('Qualification') }}</span>
                <input v-model="entry.degree" @input="markDirty" placeholder="BSc" /></label>
              <label class="field"><span>{{ $t('Field of study') }}</span>
                <input v-model="entry.field" @input="markDirty" :placeholder="$t('Computer Science')" /></label>
              <label class="field"><span>{{ $t('Institution') }}</span>
                <input v-model="entry.institution" @input="markDirty" /></label>
              <label class="field"><span>{{ $t('Grade') }}</span>
                <input v-model="entry.grade" @input="markDirty" :placeholder="$t('Very Good / 3.6 GPA')" /></label>
              <label class="field"><span>{{ $t('From') }}</span>
                <input v-model="entry.start" @input="markDirty" /></label>
              <label class="field"><span>{{ $t('To') }}</span>
                <input v-model="entry.end" @input="markDirty" /></label>
            </div>
          </div>
        </div>

        <!-- Skills -->
        <div class="card">
          <div class="card-head">
            <h3>{{ $t('Skills') }}</h3>
            <div class="card-head-actions">
              <button class="btn btn-ai btn-sm" :disabled="busySection === 'skills' || !aiReady || !cv.skills.length"
                      @click="rewrite('skills')">
                {{ busySection === 'skills' ? 'Grouping…' : '✨ Regroup with AI' }}
              </button>
              <button class="btn btn-ghost btn-sm" @click="addEntry('skills')">{{ $t('+ Add group') }}</button>
            </div>
          </div>
          <div v-for="(group, i) in cv.skills" :key="i" class="entry entry-tight">
            <div class="grid-skill">
              <label class="field"><span>{{ $t('Group name — optional') }}</span>
                <input v-model="group.category" @input="markDirty" :placeholder="$t('Languages')" /></label>
              <label class="field"><span>{{ $t('Skills — comma separated') }}</span>
                <input :value="(group.items || []).join(', ')" @input="setList(group, 'items', $event)" /></label>
              <button class="icon-btn sm danger" @click="removeEntry('skills', i)">×</button>
            </div>
          </div>
        </div>

        <!-- Projects -->
        <div class="card">
          <div class="card-head">
            <h3>{{ $t('Projects') }} <span class="badge">{{ cv.projects.length }}</span></h3>
            <button class="btn btn-ghost btn-sm" @click="addEntry('projects')">{{ $t('+ Add') }}</button>
          </div>
          <div v-for="(entry, i) in cv.projects" :key="entry.id || i" class="entry">
            <div class="entry-head">
              <span class="entry-index">{{ i + 1 }}</span>
              <button class="icon-btn sm danger" @click="removeEntry('projects', i)">×</button>
            </div>
            <div class="grid-2">
              <label class="field"><span>{{ $t('Name') }}</span><input v-model="entry.name" @input="markDirty" /></label>
              <label class="field"><span>{{ $t('Link') }}</span><input v-model="entry.link" @input="markDirty" /></label>
            </div>
            <label class="field"><span>{{ $t('Description') }}</span>
              <textarea v-model="entry.description" rows="2" @input="markDirty"></textarea></label>
            <label class="field"><span>{{ $t('Highlights — one per line') }}</span>
              <textarea :value="linesOf(entry.bullets)" rows="2" @input="setLines(entry, 'bullets', $event)"></textarea></label>
            <label class="field"><span>{{ $t('Tech — comma separated') }}</span>
              <input :value="(entry.tech || []).join(', ')" @input="setList(entry, 'tech', $event)" /></label>
          </div>
        </div>

        <!-- Certifications / Languages -->
        <div class="grid-2 gap">
          <div class="card">
            <div class="card-head">
              <h3>{{ $t('Certifications') }} <span class="badge">{{ cv.certifications.length }}</span></h3>
              <button class="btn btn-ghost btn-sm" @click="addEntry('certifications')">{{ $t('+ Add') }}</button>
            </div>
            <div v-for="(entry, i) in cv.certifications" :key="entry.id || i" class="entry entry-tight">
              <div class="grid-3">
                <label class="field"><span>{{ $t('Name') }}</span><input v-model="entry.name" @input="markDirty" /></label>
                <label class="field"><span>{{ $t('Issuer') }}</span><input v-model="entry.issuer" @input="markDirty" /></label>
                <label class="field"><span>{{ $t('Year') }}</span><input v-model="entry.date" @input="markDirty" /></label>
                <button class="icon-btn sm danger" @click="removeEntry('certifications', i)">×</button>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-head">
              <h3>{{ $t('Languages') }} <span class="badge">{{ cv.languages.length }}</span></h3>
              <button class="btn btn-ghost btn-sm" @click="addEntry('languages')">{{ $t('+ Add') }}</button>
            </div>
            <div v-for="(entry, i) in cv.languages" :key="i" class="entry entry-tight">
              <div class="grid-3">
                <label class="field"><span>{{ $t('Language') }}</span><input v-model="entry.name" @input="markDirty" /></label>
                <label class="field"><span>{{ $t('Level') }}</span>
                  <select v-model="entry.level" @change="markDirty">
                    <option value="">—</option>
                    <option v-for="level in LANG_LEVELS" :key="level" :value="level">{{ level }}</option>
                  </select>
                </label>
                <button class="icon-btn sm danger" @click="removeEntry('languages', i)">×</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Extras -->
        <div class="card">
          <div class="card-head"><h3>{{ $t('Extras') }}</h3></div>
          <label class="field"><span>{{ $t('Interests — comma separated') }}</span>
            <input :value="(cv.interests || []).join(', ')" @input="setList(cv, 'interests', $event)" /></label>

          <div class="sub-head">
            <h4>{{ $t('Awards') }} <span class="badge">{{ cv.awards.length }}</span></h4>
            <button class="btn btn-ghost btn-sm" @click="addEntry('awards')">{{ $t('+ Add') }}</button>
          </div>
          <div v-for="(entry, i) in cv.awards" :key="entry.id || i" class="grid-3 row-gap">
            <label class="field"><span>{{ $t('Award') }}</span><input v-model="entry.name" @input="markDirty" /></label>
            <label class="field"><span>{{ $t('Issuer') }}</span><input v-model="entry.issuer" @input="markDirty" /></label>
            <label class="field"><span>{{ $t('Year') }}</span><input v-model="entry.date" @input="markDirty" /></label>
            <button class="icon-btn sm danger" @click="removeEntry('awards', i)">×</button>
          </div>

          <div class="sub-head">
            <h4>{{ $t('Volunteering') }} <span class="badge">{{ cv.volunteering.length }}</span></h4>
            <button class="btn btn-ghost btn-sm" @click="addEntry('volunteering')">{{ $t('+ Add') }}</button>
          </div>
          <div v-for="(entry, i) in cv.volunteering" :key="entry.id || i" class="entry entry-tight">
            <div class="grid-3">
              <label class="field"><span>{{ $t('Role') }}</span><input v-model="entry.role" @input="markDirty" /></label>
              <label class="field"><span>{{ $t('Organisation') }}</span><input v-model="entry.organisation" @input="markDirty" /></label>
              <label class="field"><span>{{ $t('Dates') }}</span>
                <div class="date-row">
                  <input v-model="entry.start" @input="markDirty" placeholder="2020" />
                  <input v-model="entry.end" @input="markDirty" placeholder="2022" />
                </div>
              </label>
              <button class="icon-btn sm danger" @click="removeEntry('volunteering', i)">×</button>
            </div>
            <label class="field"><span>{{ $t('What you did — one per line') }}</span>
              <textarea :value="linesOf(entry.bullets)" rows="2" @input="setLines(entry, 'bullets', $event)"></textarea></label>
          </div>

          <div class="sub-head">
            <h4>{{ $t('References') }} <span class="badge">{{ cv.references.length }}</span></h4>
            <button class="btn btn-ghost btn-sm" @click="addEntry('references')">{{ $t('+ Add') }}</button>
          </div>
          <div v-for="(entry, i) in cv.references" :key="entry.id || i" class="grid-3 row-gap">
            <label class="field"><span>{{ $t('Name') }}</span><input v-model="entry.name" @input="markDirty" /></label>
            <label class="field"><span>{{ $t('Title & company') }}</span><input v-model="entry.title" @input="markDirty" /></label>
            <label class="field"><span>{{ $t('Email') }}</span><input v-model="entry.email" @input="markDirty" /></label>
            <button class="icon-btn sm danger" @click="removeEntry('references', i)">×</button>
          </div>
        </div>
      </section>

      <!-- ══════════════════════ AI ASSIST ══════════════════════ -->
      <section v-show="activeTab === 'ai'" class="cve-panel">
        <div v-if="!aiReady" class="card warn-card">
          <h3>{{ $t('AI is unavailable on this replica') }}</h3>
          <p>{{ $t('No AI provider key is configured on the CV Builder service, so enhancing, reviewing and tailoring cannot run right now. Editing, templates and downloads all still work.') }}</p>
        </div>

        <div class="card">
          <div class="card-head"><h3>{{ $t('Rewrite the whole CV') }}</h3></div>
          <p class="card-note">
            {{ $t('The AI sharpens your wording, turns responsibilities into achievements and fixes the grammar. It will not add a job, a date, a degree or a metric you did not write — if it appears to, treat that as a bug and tell us.') }}
          </p>
          <div class="grid-2">
            <label class="field"><span>{{ $t('Tone') }}</span>
              <select v-model="enhanceTone">
                <option value="professional">{{ $t('Professional — the default') }}</option>
                <option value="concise">{{ $t('Concise — cut every spare word') }}</option>
                <option value="impact">{{ $t('Impact-first — lead with outcomes') }}</option>
                <option value="academic">{{ $t('Academic — formal and precise') }}</option>
              </select>
            </label>
            <label class="field"><span>{{ $t('Target role — optional') }}</span>
              <input v-model="enhanceTarget" :placeholder="$t('Senior DevOps Engineer')" /></label>
          </div>
          <label class="field"><span>{{ $t('Anything specific to change — optional') }}</span>
            <textarea v-model="enhanceInstructions" rows="3"
                      placeholder="Play down the support work, emphasise the Kubernetes migration, keep it to one page."></textarea></label>
          <div class="row-actions">
            <button class="btn btn-ai" :disabled="enhancing || !aiReady" @click="enhance(false)">
              {{ enhancing ? 'Rewriting your CV…' : '✨ Enhance this CV' }}
            </button>
            <button class="btn btn-ghost" :disabled="enhancing || !aiReady" @click="enhance(true)">
              {{ $t('Enhance into a copy') }}
            </button>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3>{{ $t('Get it reviewed') }}</h3></div>
          <p class="card-note">{{ $t('A recruiter-style critique. It changes nothing — it tells you what a screener would notice in the 30 seconds they spend.') }}</p>
          <div class="row-actions">
            <button class="btn btn-secondary" :disabled="reviewing || !aiReady" @click="runReview">
              {{ reviewing ? 'Reading it…' : 'Review my CV' }}
            </button>
          </div>

          <div v-if="review" class="review">
            <div class="review-score" :class="scoreClass(review.score)">
              <span class="review-score-value">{{ review.score ?? '—' }}</span>
              <span class="review-score-label">/ 100</span>
            </div>
            <p class="review-verdict">{{ review.verdict }}</p>

            <div class="review-cols">
              <div v-if="review.strengths?.length">
                <h4>{{ $t('Working well') }}</h4>
                <ul><li v-for="(item, i) in review.strengths" :key="i">{{ item }}</li></ul>
              </div>
              <div v-if="review.quick_wins?.length">
                <h4>{{ $t('Quick wins') }}</h4>
                <ul><li v-for="(item, i) in review.quick_wins" :key="i">{{ item }}</li></ul>
              </div>
            </div>

            <div v-if="review.issues?.length" class="review-issues">
              <h4>{{ $t('Issues') }}</h4>
              <div v-for="(issue, i) in review.issues" :key="i" class="review-issue">
                <span class="review-issue-section">{{ issue.section }}</span>
                <p class="review-issue-problem">{{ issue.problem }}</p>
                <p class="review-issue-fix">→ {{ issue.fix }}</p>
              </div>
            </div>

            <div v-if="review.ats_notes?.length" class="review-ats">
              <h4>{{ $t('ATS notes') }}</h4>
              <ul><li v-for="(item, i) in review.ats_notes" :key="i">{{ item }}</li></ul>
            </div>
          </div>
        </div>

        <div v-if="sectionNotes.length" class="card">
          <div class="card-head"><h3>{{ $t('What the AI changed') }}</h3></div>
          <ul class="notes"><li v-for="(note, i) in sectionNotes" :key="i">{{ note }}</li></ul>
        </div>
      </section>

      <!-- ══════════════════ JOB DESCRIPTION ══════════════════ -->
      <section v-show="activeTab === 'job'" class="cve-panel">
        <div class="card">
          <div class="card-head"><h3>{{ $t('Match this CV to a job') }}</h3></div>
          <p class="card-note">
            {{ $t('Paste the job description and the AI rewrites the CV to answer it — writing the posting\'s required skills, tools and technologies into your skills section and into the roles where that work belongs, then rewriting your summary and headline to target the title. Everything it adds is listed below for you to review.') }}
          </p>
          <textarea v-model="jobDescription" rows="12" class="jd"
                    placeholder="Paste the full job description here — responsibilities, requirements, nice-to-haves."></textarea>
          <p class="hint">{{ $t('{v0} characters', { v0: jobDescription.trim().length }) }}
             <span v-if="jobDescription.trim().length && jobDescription.trim().length < 80">
               {{ $t('— paste a bit more; 80 is the minimum.') }}</span>
          </p>

          <div class="coverage-picker">
            <button v-for="mode in coverageModes" :key="mode.key" type="button"
                    :class="['coverage-option', { active: coverage === mode.key }]"
                    @click="coverage = mode.key">
              <strong>{{ mode.name }}</strong>
              <span>{{ mode.description }}</span>
            </button>
          </div>

          <div class="row-actions">
            <button class="btn btn-ai" :disabled="tailorDisabled" @click="tailor(false)">
              <span v-if="tailoring === 'inplace'" class="btn-spinner" aria-hidden="true"></span>
              {{ tailoring === 'inplace' ? 'Tailoring your CV…' : '⚡ Make my CV suit this job' }}
            </button>
            <button class="btn btn-ghost" :disabled="tailorDisabled" @click="tailor(true)">
              <span v-if="tailoring === 'copy'" class="btn-spinner" aria-hidden="true"></span>
              {{ tailoring === 'copy' ? 'Creating the tailored copy…' : 'Tailor into a separate CV' }}
            </button>
            <span class="hint inline">{{ $t('Tailoring into a copy keeps this CV as your general one.') }}</span>
          </div>
          <!-- A progress line as well as the button spinner: the button can scroll out
               of view on a phone, and this is the one action here that takes seconds. -->
          <p v-if="tailoring" class="tailor-progress" role="status" aria-live="polite">
            <span class="btn-spinner" aria-hidden="true"></span>
            {{ $t('Reading the posting and rewriting your CV against it — this usually takes a few seconds. Your CV is saved either way.') }}
          </p>
          <p v-if="coverage === 'full'" class="hint">
            {{ $t('Read the “Added to your CV” list before you apply and delete anything you cannot stand behind in an interview. Credentials — certifications, licences, degrees — are never added for you, because they are checked.') }}
          </p>
        </div>

        <!-- A CV the AI drafted from this posting, rather than one it tailored.
             The gaps are the whole point of that feature, so they are stated here
             where the posting is, not buried in the history. -->
        <div v-if="buildReport" class="card">
          <div class="card-head">
            <h3>{{ $t('Drafted from this job ad') }}</h3>
            <span v-if="cv.job_target?.tailored_at" class="badge">
              {{ formatDate(cv.job_target.tailored_at) }}
            </span>
          </div>
          <p v-if="buildReport.placeholder_count" class="card-note">
            <strong>{{ $t('{v0} detail{v1} still in square brackets.', { v0: buildReport.placeholder_count, v1: buildReport.placeholder_count === 1 ? '' : 's' }) }}</strong>
            {{ $t('Nothing about your history was invented, so each one is a fact only you can supply. Replace them all before you send this CV anywhere.') }}
          </p>
          <p v-else class="card-note">
            {{ $t('No blanks left. Read it through anyway — the bullets were written from the advert, so they describe the job rather than what you actually did.') }}
          </p>
          <div v-if="buildReport.placeholder_fields?.length" class="draft-gaps">
            <span v-for="(gap, i) in buildReport.placeholder_fields" :key="i" class="draft-gap">
              {{ gap }}
            </span>
          </div>
          <div v-if="buildReport.missing_credentials?.length" class="match-block">
            <h4>{{ $t('Credentials this role asks for') }}</h4>
            <p class="card-note">{{ $t('Never added for you — a certificate is checked.') }}</p>
            <ul><li v-for="(item, i) in buildReport.missing_credentials" :key="i">{{ item }}</li></ul>
          </div>
          <div v-if="buildReport.next_steps?.length" class="match-block">
            <h4>{{ $t('What to do next') }}</h4>
            <ul><li v-for="(item, i) in buildReport.next_steps" :key="i">{{ item }}</li></ul>
          </div>
        </div>

        <div v-if="matchReport" class="card">
          <div class="card-head">
            <h3>{{ $t('Match report') }}</h3>
            <span v-if="cv.job_target?.tailored_at" class="badge">
              {{ $t('tailored {v0}', { v0: formatDate(cv.job_target.tailored_at) }) }}
            </span>
          </div>

          <div class="match-top">
            <div class="review-score" :class="scoreClass(matchReport.score)">
              <span class="review-score-value">{{ matchReport.score ?? '—' }}</span>
              <span class="review-score-label">{{ $t('% match') }}</span>
            </div>
            <div class="match-title">
              <h4>{{ matchReport.job_title || 'This role' }}</h4>
              <p v-if="matchReport.seniority">{{ matchReport.seniority }}</p>
              <p v-if="matchReport.baseline_score != null" class="match-delta">
                {{ $t('was {v0}%', { v0: matchReport.baseline_score }) }}
                <span v-if="matchReport.score != null && matchReport.score > matchReport.baseline_score"
                      class="up">▲ +{{ matchReport.score - matchReport.baseline_score }}</span>
              </p>
            </div>
          </div>

          <div class="kw-groups">
            <div v-if="matchReport.added_keywords?.length">
              <h4>{{ $t('Added to your CV — review these') }}</h4>
              <div class="kws">
                <span v-for="(kw, i) in matchReport.added_keywords" :key="i" class="kw added">{{ kw }}</span>
              </div>
              <ul v-if="matchReport.added_items?.length" class="added-list">
                <li v-for="(item, i) in matchReport.added_items" :key="i">
                  <span v-if="item.section" class="added-where">{{ item.section }}</span>{{ item.detail }}
                </li>
              </ul>
              <p class="hint">{{ $t('Open the editor tabs and delete anything here you could not defend in an interview — you are the last check on this list.') }}</p>
            </div>
            <div v-if="matchReport.matched_keywords?.length">
              <h4>{{ $t('Already evidenced') }}</h4>
              <div class="kws">
                <span v-for="(kw, i) in matchReport.matched_keywords" :key="i" class="kw good">{{ kw }}</span>
              </div>
            </div>
            <div v-if="matchReport.missing_keywords?.length">
              <h4>{{ $t('Still missing — only you can add these') }}</h4>
              <div class="kws">
                <span v-for="(kw, i) in matchReport.missing_keywords" :key="i" class="kw bad">{{ kw }}</span>
              </div>
              <p class="hint">{{ $t('Certifications, licences and degrees are never written in for you because employers verify them. Add any you genuinely hold in the editor.') }}</p>
            </div>
          </div>

          <div v-if="matchReport.review_notes?.length" class="review-warn">
            <h4>{{ $t('Confirm before you send this') }}</h4>
            <ul><li v-for="(item, i) in matchReport.review_notes" :key="i">{{ item }}</li></ul>
          </div>

          <div class="review-cols">
            <div v-if="matchReport.strengths?.length">
              <h4>{{ $t('Why you fit') }}</h4>
              <ul><li v-for="(item, i) in matchReport.strengths" :key="i">{{ item }}</li></ul>
            </div>
            <div v-if="matchReport.gaps?.length">
              <h4>{{ $t('Gaps') }}</h4>
              <ul><li v-for="(item, i) in matchReport.gaps" :key="i">{{ item }}</li></ul>
            </div>
          </div>

          <div v-if="matchReport.actions?.length" class="review-ats">
            <h4>{{ $t('What to do about it') }}</h4>
            <ul><li v-for="(item, i) in matchReport.actions" :key="i">{{ item }}</li></ul>
          </div>
          <div v-if="matchReport.ats_notes?.length" class="review-ats">
            <h4>{{ $t('ATS notes') }}</h4>
            <ul><li v-for="(item, i) in matchReport.ats_notes" :key="i">{{ item }}</li></ul>
          </div>
        </div>
      </section>

      <!-- ══════════════════════ VOICE ══════════════════════ -->
      <section v-show="activeTab === 'voice'" class="cve-panel">
        <div class="card">
          <div class="card-head"><h3>{{ $t('Add to this CV by talking') }}</h3></div>
          <p class="card-note">
            {{ $t('Dictate the experience you want on this CV. The AI rewrites the CV from what you say — so use this when you want to rebuild the content, not to add a single line.') }}
            <strong>{{ $t('Your current content will be replaced') }}</strong>{{ $t(', or use “as a new CV” to keep it.') }}
          </p>
          <CvVoiceRecorder v-model="voiceTranscript" :notes-value="voiceNotes" :user-id="userId"
                           @update:notes="voiceNotes = $event" />
          <div class="row-actions">
            <button class="btn btn-ai" :disabled="voiceBusy || !aiReady || voiceTranscript.trim().length < 60"
                    @click="buildFromVoice(true)">
              {{ voiceBusy ? 'Writing…' : 'Build as a new CV' }}
            </button>
            <button class="btn btn-ghost" :disabled="voiceBusy || !aiReady || voiceTranscript.trim().length < 60"
                    @click="buildFromVoice(false)">
              {{ $t('Replace this CV\'s content') }}
            </button>
          </div>
        </div>
      </section>

      <!-- ══════════════════════ DESIGN ══════════════════════ -->
      <section v-show="activeTab === 'design'" class="cve-panel">
        <div class="card">
          <div class="card-head"><h3>{{ $t('Template') }}</h3></div>
          <div class="tpl-picker">
            <button v-for="tpl in templates" :key="tpl.key"
                    :class="['tpl-option', { active: cv.template === tpl.key }]"
                    @click="pickTemplate(tpl.key)">
              <span class="tpl-mini" :class="`tpl-${tpl.layout}`"
                    :style="{ '--tpl-accent': cv.accent_color || tpl.accent }">
                <i class="band"></i><i class="l l1"></i><i class="l l2"></i><i class="l l3"></i>
              </span>
              <strong>{{ tpl.name }}</strong>
              <small>{{ tpl.best_for }}</small>
              <em v-if="tpl.ats_safe" class="ats">{{ $t('ATS-safe') }}</em>
            </button>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3>{{ $t('Colour & type') }}</h3></div>
          <div class="swatches">
            <button v-for="accent in accents" :key="accent.value"
                    :class="['swatch', { active: cv.accent_color === accent.value }]"
                    :style="{ background: accent.value }" :title="accent.name"
                    @click="setAccent(accent.value)"></button>
            <button class="swatch reset" :class="{ active: !cv.accent_color }"
                    :title="$t('Use the template\'s own colour')" @click="setAccent('')">{{ $t('auto') }}</button>
            <label class="swatch-custom">
              <input type="color" :value="cv.accent_color || currentSpec?.accent || '#4F46E5'"
                     @input="setAccent(($event.target as HTMLInputElement).value.toUpperCase())" />
              {{ $t('custom') }}
            </label>
          </div>
          <div class="grid-2">
            <label class="field"><span>{{ $t('Font') }}</span>
              <select v-model="cv.font" @change="markDirty">
                <option v-for="font in fonts" :key="font.key" :value="font.key">{{ font.name }}</option>
              </select>
            </label>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3>{{ $t('Profile picture') }}</h3></div>
          <p class="card-note">
            {{ $t('Optional. Some markets expect a photo, others screen it out — if you are unsure, leave the avatar or turn the photo off. Pick a default avatar and it is used in the PDF and DOCX exactly as you see it here.') }}
          </p>

          <div class="photo-row">
            <div class="photo-current" :class="`shape-${cv.photo.shape}`">
              <img v-if="photoPreview" :src="photoPreview" alt="" />
              <span v-else>{{ $t('none') }}</span>
            </div>

            <div class="photo-controls">
              <div class="photo-buttons">
                <button class="btn btn-secondary btn-sm" :disabled="photoBusy"
                        @click="openStudio()">
                  {{ photoBusy ? 'Saving…' : (cv.photo.data_url ? 'Edit photo' : 'Add a photo') }}
                </button>
                <button v-if="!cv.photo.data_url" class="btn btn-ghost btn-sm" :disabled="photoBusy"
                        @click="openStudio()">
                  {{ $t('Take a photo') }}
                </button>
                <button v-if="cv.photo.data_url" class="btn btn-ghost btn-sm" @click="clearPhoto">
                  {{ $t('Remove photo') }}
                </button>
              </div>
              <p class="hint">
                {{ $t('Upload or take a photo, drag it to centre your face, and swap the background for a professional colour. Your face is never removed — only the area around you.') }}
              </p>

              <div class="avatar-picker">
                <span class="avatar-label">{{ $t('Or use a default avatar') }}</span>
                <div class="avatars">
                  <button v-for="avatar in avatars" :key="avatar.key"
                          :class="['avatar-option', { active: !cv.photo.data_url && cv.photo.avatar === avatar.key }]"
                          :title="avatar.label" @click="pickAvatar(avatar.key)">
                    <img :src="avatar.data_url" :alt="avatar.label" />
                  </button>
                </div>
              </div>

              <div class="photo-flags">
                <label class="field inline-field"><span>{{ $t('Shape') }}</span>
                  <select v-model="cv.photo.shape" @change="markDirty">
                    <option value="circle">{{ $t('Circle') }}</option>
                    <option value="rounded">{{ $t('Rounded') }}</option>
                    <option value="square">{{ $t('Square') }}</option>
                  </select>
                </label>
                <label class="check">
                  <input type="checkbox" v-model="cv.photo.show" @change="markDirty" />
                  {{ $t('Show a picture on the CV') }}
                </label>
              </div>
              <p v-if="photoError" class="path-error">{{ photoError }}</p>
              <p v-if="currentSpec?.photo === 'none'" class="hint">
                {{ $t('The {v0} template never prints a picture — pick another template if you want one shown.', { v0: currentSpec.name }) }}
              </p>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3>{{ $t('Sections') }}</h3></div>
          <p class="card-note">{{ $t('Drag-free ordering: move a section up or down, or hide it. Hidden sections keep their content — they just do not print.') }}</p>
          <ul class="section-order">
            <li v-for="(key, i) in cv.sections_order" :key="key"
                :class="{ hidden: cv.hidden_sections.includes(key), empty: !hasContent(key) }">
              <span class="so-name">{{ sectionTitles[key] || key }}</span>
              <span v-if="!hasContent(key)" class="so-empty">{{ $t('empty') }}</span>
              <span class="so-actions">
                <button class="icon-btn sm" :disabled="i === 0" @click="moveSection(i, -1)">↑</button>
                <button class="icon-btn sm" :disabled="i === cv.sections_order.length - 1" @click="moveSection(i, 1)">↓</button>
                <button class="icon-btn sm" @click="toggleSection(key)">
                  {{ cv.hidden_sections.includes(key) ? 'show' : 'hide' }}
                </button>
              </span>
            </li>
          </ul>
        </div>
      </section>

      <!-- ══════════════════════ PREVIEW ══════════════════════ -->
      <section v-show="activeTab === 'preview'" class="cve-panel preview-panel">
        <div class="preview-bar">
          <div class="preview-bar-left">
            <strong>{{ currentSpec?.name || cv.template }}</strong>
            <span>{{ currentSpec?.description }}</span>
          </div>
          <div class="preview-bar-actions">
            <button class="btn btn-primary btn-sm" :disabled="!!downloading" @click="askDownload">
              {{ downloading ? 'Building…' : 'Download as…' }}
            </button>
          </div>
        </div>
        <p class="hint preview-hint">
          {{ $t('The download is rendered on the server from this same template, so the file matches what you see here. Unsaved edits are included in the download.') }}
        </p>
        <CvPreview :cv="cv" :spec="currentSpec" :section-titles="sectionTitles" :avatars="avatars" />
      </section>

      <!-- Sticky preview beside the editor on wide screens -->
      <aside v-if="showSplitPreview" class="cve-side-preview">
        <CvPreview :cv="cv" :spec="currentSpec" :section-titles="sectionTitles" :avatars="avatars" />
      </aside>
    </div>

    <CvPhotoStudio
      v-if="studioOpen"
      :user-id="userId"
      :shape="cv.photo.shape"
      :current-data-url="cv.photo.data_url"
      :source-path="cv.photo.source_path"
      :initial-edit="cv.photo.edit"
      @apply="onStudioApply"
      @cancel="studioOpen = false"
    />

    <div v-if="downloadOpen" class="modal-backdrop" @click.self="downloadOpen = false">
      <div class="modal">
        <h3>{{ $t('Download this CV') }}</h3>
        <p>{{ $t('Rendered on the server from the template you can see, including edits you have not saved. Name the file so you can tell this application from the next one.') }}</p>
        <label class="modal-field">
          <span>{{ $t('File name') }}</span>
          <input ref="downloadNameInput" v-model="downloadName" type="text" maxlength="70"
                 @keyup.enter="downloadCv('pdf')" />
        </label>
        <p class="modal-hint">{{ $t('Saves as') }} <strong>{{ previewFilename }}</strong></p>
        <div class="modal-actions">
          <button class="btn btn-primary" :disabled="!!downloading" @click="downloadCv('pdf')">
            {{ downloading === 'pdf' ? 'Building…' : 'Download PDF' }}
          </button>
          <button class="btn btn-secondary" :disabled="!!downloading" @click="downloadCv('docx')">
            {{ downloading === 'docx' ? 'Building…' : 'Download DOCX' }}
          </button>
          <button class="btn btn-ghost" :disabled="!!downloading" @click="downloadOpen = false">
            {{ $t('Cancel') }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="toast" class="toast" :class="toastType">{{ toast }}</div>
  </div>

  <div v-else class="cve-loading">
    <p v-if="loadError" class="load-error">{{ loadError }}</p>
    <p v-else>{{ $t('Loading your CV…') }}</p>
    <button v-if="loadError" class="btn btn-ghost" @click="goBack">{{ $t('Back to my CVs') }}</button>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import CvPhotoStudio from '@/components/cvbuilder/CvPhotoStudio.vue';
import CvPreview from '@/components/cvbuilder/CvPreview.vue';
import CvVoiceRecorder from '@/components/cvbuilder/CvVoiceRecorder.vue';
import {
  blankEntry, cvBuilderService,
  type AvatarOption, type CvRecord, type CvSectionKey, type CvTemplate,
  type BuildReport, type CvPhotoEdit, type CvReview, type ExportFormat,
  type MatchReport,
  type TailorCoverage,
} from '@/services/cvbuilder.service';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const userId = computed(() => String(authStore.user?.id || ''));
const cvId = computed(() => String(route.params.id || ''));

const TABS = [
  { key: 'content', label: 'Editor', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>' },
  { key: 'ai', label: 'AI assist', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2L12 2zm7 12l1.1 2.9L23 18l-2.9 1.1L19 22l-1.1-2.9L15 18l2.9-1.1L19 14z"/></svg>' },
  { key: 'job', label: 'Job description', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-4V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2H4a2 2 0 00-2 2v11a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2zm-6 0h-4V4h4v2z"/></svg>' },
  { key: 'voice', label: 'Voice', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.92V21h2v-3.08A7 7 0 0019 11h-2z"/></svg>' },
  { key: 'design', label: 'Template & photo', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a9 9 0 000 18c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.37-.61-.37-.99 0-.83.67-1.5 1.5-1.5H16a5 5 0 005-5c0-4.42-4.03-8-9-8zm-5.5 9a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm3-4a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm3.5 4a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/></svg>' },
  { key: 'preview', label: 'Preview & download', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12a4.5 4.5 0 110-9 4.5 4.5 0 010 9z"/></svg>' },
] as const;

const LANG_LEVELS = ['Native', 'Fluent', 'Advanced', 'Intermediate', 'Basic'];

const cv = ref<CvRecord | null>(null);
const loadError = ref('');
const activeTab = ref<string>('content');
const dirty = ref(false);
const saving = ref(false);
const savedAt = ref('');
const downloading = ref<'' | ExportFormat>('');
const downloadOpen = ref(false);
const downloadName = ref('');
const downloadNameInput = ref<HTMLInputElement | null>(null);
const banner = ref('');
const bannerType = ref<'info' | 'warn' | 'error'>('info');
const toast = ref('');
const toastType = ref<'success' | 'error'>('success');

const templates = ref<CvTemplate[]>([]);
const accents = ref<{ name: string; value: string }[]>([]);
const fonts = ref<{ key: string; name: string }[]>([]);
const sectionTitles = ref<Record<string, string>>({});
const avatars = ref<AvatarOption[]>([]);
const aiReady = ref(true);

const enhanceTone = ref('professional');
const enhanceTarget = ref('');
const enhanceInstructions = ref('');
const enhancing = ref(false);
const busySection = ref('');
const sectionNotes = ref<string[]>([]);

const reviewing = ref(false);
const review = ref<CvReview | null>(null);

const jobDescription = ref('');
/** Which tailor button is running: 'inplace' | 'copy' | null. A plain boolean
 *  put the spinner on both buttons at once. */
const tailoring = ref<'inplace' | 'copy' | null>(null);
const coverage = ref<TailorCoverage>('full');

const coverageModes: { key: TailorCoverage; name: string; description: string }[] = [
  { key: 'full', name: 'Close the gaps',
    description: "Writes the posting's skills, tools and technologies into your CV, and lists every addition for you to review." },
  { key: 'strict', name: 'Reword only',
    description: 'Rewrites and reorders what you already have. Claims nothing new.' },
];

// Not gated on aiReady any more: /ai/tailor always tailors, falling back to a
// keyword pass when no provider answers, so disabling the button on AI health
// would hide a feature that works.
const tailorDisabled = computed(() =>
  !!tailoring.value || jobDescription.value.trim().length < 80);

const voiceTranscript = ref('');
const voiceNotes = ref('');
const voiceBusy = ref(false);

const photoBusy = ref(false);
const photoError = ref('');
const studioOpen = ref(false);

const windowWide = ref(window.innerWidth >= 1380);

const currentSpec = computed<CvTemplate | null>(() =>
  templates.value.find(t => t.key === cv.value?.template) || templates.value[0] || null);

const matchReport = computed<MatchReport | null>(() =>
  (cv.value?.job_target?.match_report as MatchReport) || null);

/**
 * Present only on a CV the AI drafted from a posting (`/api/cv/ai/from-job`).
 *
 * Separate from `matchReport` because the two answer different questions: a match
 * report scores a CV against a job, and there is nothing to score here - the CV
 * came out of the job. What this one carries is the list of blanks.
 */
const buildReport = computed<BuildReport | null>(() =>
  (cv.value?.job_target?.build_report as BuildReport) || null);

const completeness = computed(() => {
  const record = cv.value;
  if (!record) return 0;
  // Mirrors utils/cvmodel.completeness() so the meter does not jump after a save.
  const p = record.personal || ({} as any);
  const checks = [
    !!p.full_name,
    !!(p.email || p.phone),
    !!p.headline,
    (p.summary || '').length > 80,
    !!record.experience?.length,
    record.experience?.some(e => e.bullets?.length),
    !!record.education?.length,
    !!record.skills?.length,
    !!(record.projects?.length || record.certifications?.length),
    !!(record.languages?.length || record.interests?.length),
  ];
  return Math.round((100 * checks.filter(Boolean).length) / checks.length);
});

const wordCount = computed(() => {
  const record = cv.value;
  if (!record) return 0;
  const chunks: string[] = [record.personal?.summary || ''];
  record.experience?.forEach(e => { chunks.push(e.description || '', ...(e.bullets || [])); });
  record.projects?.forEach(e => { chunks.push(e.description || '', ...(e.bullets || [])); });
  record.education?.forEach(e => chunks.push(e.details || ''));
  record.volunteering?.forEach(e => { chunks.push(e.description || '', ...(e.bullets || [])); });
  record.skills?.forEach(g => chunks.push(...(g.items || [])));
  return chunks.filter(Boolean).join(' ').split(/\s+/).filter(Boolean).length;
});

const showSplitPreview = computed(() =>
  windowWide.value && ['content', 'design'].includes(activeTab.value));

const photoPreview = computed(() => {
  const photo = cv.value?.photo;
  if (!photo || photo.show === false) return '';
  if (photo.data_url) return photo.data_url;
  return avatars.value.find(a => a.key === photo.avatar)?.data_url || '';
});

const saveState = computed(() => (saving.value ? 'saving' : dirty.value ? 'dirty' : 'saved'));
const saveLabel = computed(() => {
  if (saving.value) return 'saving…';
  if (dirty.value) return 'unsaved changes';
  return savedAt.value ? `saved ${savedAt.value}` : 'saved';
});

function markDirty() { dirty.value = true; }

function showToast(message: string, type: 'success' | 'error' = 'success') {
  toast.value = message;
  toastType.value = type;
  window.setTimeout(() => { toast.value = ''; }, 4200);
}

function showBanner(message: string, type: 'info' | 'warn' | 'error' = 'info') {
  banner.value = message;
  bannerType.value = type;
}

function formatDate(value?: string) {
  if (!value) return '';
  const date = new Date(value.endsWith('Z') ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : date.toLocaleDateString();
}

function scoreClass(score?: number | null) {
  if (score == null) return 'mid';
  if (score >= 75) return 'good';
  if (score >= 50) return 'mid';
  return 'low';
}

// ── Multi-line / list field helpers ───────────────────────────────────
// Bullets and tag lists are edited as text, because a row of inputs per bullet
// is far more clicks than typing a list - and paste-from-anywhere just works.
function linesOf(value?: string[]) { return (value || []).join('\n'); }

function setLines(target: any, field: string, event: Event) {
  target[field] = (event.target as HTMLTextAreaElement).value
    .split('\n').map(line => line.trim()).filter(Boolean);
  markDirty();
}

function setList(target: any, field: string, event: Event) {
  target[field] = (event.target as HTMLInputElement).value
    .split(',').map(part => part.trim()).filter(Boolean);
  markDirty();
}

function hasContent(key: CvSectionKey) {
  const record = cv.value;
  if (!record) return false;
  if (key === 'summary') return !!record.personal?.summary?.trim();
  const value = (record as any)[key];
  return Array.isArray(value) ? value.length > 0 : !!value;
}

// ── Entry manipulation ────────────────────────────────────────────────
function addEntry(section: CvSectionKey) {
  (cv.value as any)[section].push(blankEntry(section));
  markDirty();
}

function removeEntry(section: CvSectionKey, index: number) {
  (cv.value as any)[section].splice(index, 1);
  markDirty();
}

function move(section: CvSectionKey, index: number, delta: number) {
  const list = (cv.value as any)[section] as any[];
  const target = index + delta;
  if (target < 0 || target >= list.length) return;
  [list[index], list[target]] = [list[target], list[index]];
  markDirty();
}

function moveSection(index: number, delta: number) {
  const order = cv.value!.sections_order;
  const target = index + delta;
  if (target < 0 || target >= order.length) return;
  [order[index], order[target]] = [order[target], order[index]];
  markDirty();
}

function toggleSection(key: CvSectionKey) {
  const hidden = cv.value!.hidden_sections;
  const at = hidden.indexOf(key);
  if (at === -1) hidden.push(key); else hidden.splice(at, 1);
  markDirty();
}

// ── Load ──────────────────────────────────────────────────────────────
async function load() {
  try {
    cv.value = await cvBuilderService.getCv(userId.value, cvId.value);
    jobDescription.value = cv.value.job_target?.job_description || '';
    savedAt.value = formatDate(cv.value.updated_at);
  } catch (e: any) {
    loadError.value = e?.message || 'That CV could not be loaded.';
  }
}

async function loadCatalogue() {
  try {
    const catalogue = await cvBuilderService.getTemplates(userId.value);
    templates.value = catalogue.templates || [];
    accents.value = catalogue.accents || [];
    fonts.value = catalogue.fonts || [];
    sectionTitles.value = Object.fromEntries(
      (catalogue.sections || []).map(section => [section.key, section.title]));
  } catch { /* the editor still works with the fallback titles in CvPreview */ }

  try {
    avatars.value = await cvBuilderService.getAvatars(userId.value);
  } catch { /* avatars are optional */ }

  try {
    const status = await cvBuilderService.aiStatus();
    aiReady.value = status.available;
    if (!status.available) {
      showBanner('No AI provider is configured on the CV Builder service, so the AI actions are '
        + 'disabled. Editing, templates and downloads still work.', 'warn');
    }
  } catch { /* assume available; the individual call will report the truth */ }
}

// ── Save ──────────────────────────────────────────────────────────────
async function save(note?: string): Promise<boolean> {
  if (!cv.value || saving.value) return true;
  saving.value = true;
  try {
    const saved = await cvBuilderService.updateCv(userId.value, cv.value.id, cv.value, note);
    cv.value = saved;
    dirty.value = false;
    savedAt.value = formatDate(saved.updated_at);
    return true;
  } catch (e: any) {
    showToast(e?.message || 'The CV could not be saved.', 'error');
    return false;
  } finally {
    saving.value = false;
  }
}

async function switchTab(key: string) {
  // Save on the way out: every AI action below sends the *stored* record, so an
  // unsaved edit would silently not be part of what the AI sees.
  if (dirty.value) await save();
  activeTab.value = key;
}

// ── AI ────────────────────────────────────────────────────────────────
async function enhance(asCopy: boolean) {
  if (dirty.value && !(await save())) return;
  enhancing.value = true;
  try {
    const result = await cvBuilderService.enhance(userId.value, {
      cv_id: cv.value!.id,
      instructions: enhanceInstructions.value,
      tone: enhanceTone.value,
      target_role: enhanceTarget.value,
      as_copy: asCopy,
    });
    if (asCopy) {
      showToast('Enhanced copy created — opening it.');
      await router.push({ name: 'CvBuilderEditor', params: { id: result.cv.id } });
      return;
    }
    cv.value = result.cv;
    dirty.value = false;
    savedAt.value = formatDate(result.cv.updated_at);
    showToast('CV enhanced. Read it through — you know your history, the AI does not.');
    activeTab.value = 'preview';
  } catch (e: any) {
    showToast(e?.message || 'The CV could not be enhanced.', 'error');
  } finally {
    enhancing.value = false;
  }
}

async function rewrite(section: CvSectionKey) {
  if (dirty.value && !(await save())) return;
  busySection.value = section;
  try {
    const result = await cvBuilderService.rewriteSection(userId.value, {
      cv_id: cv.value!.id,
      section,
    });
    cv.value = result.cv;
    dirty.value = false;
    sectionNotes.value = result.notes || [];
    showToast(`${sectionTitles.value[section] || section} rewritten.`);
  } catch (e: any) {
    showToast(e?.message || 'That section could not be rewritten.', 'error');
  } finally {
    busySection.value = '';
  }
}

async function runReview() {
  if (dirty.value && !(await save())) return;
  reviewing.value = true;
  try {
    const result = await cvBuilderService.review(userId.value, {
      cv_id: cv.value!.id,
      target_role: enhanceTarget.value,
    });
    review.value = result.review;
  } catch (e: any) {
    showToast(e?.message || 'The review could not be produced.', 'error');
  } finally {
    reviewing.value = false;
  }
}

async function tailor(asCopy: boolean) {
  if (dirty.value && !(await save())) return;
  tailoring.value = asCopy ? 'copy' : 'inplace';
  try {
    const result = await cvBuilderService.tailorToJob(userId.value, {
      cv_id: cv.value!.id,
      job_description: jobDescription.value,
      coverage: coverage.value,
      as_copy: asCopy,
    });
    if (asCopy) {
      showToast('Tailored CV created — opening it.');
      await router.push({ name: 'CvBuilderEditor', params: { id: result.cv.id } });
      return;
    }
    cv.value = result.cv;
    dirty.value = false;
    savedAt.value = formatDate(result.cv.updated_at);
    const report = result.match_report;
    const added = report?.added_keywords?.length || 0;
    const score = report?.score;
    // `changed` is what the backend actually altered, so the toast can name it
    // rather than claiming a rewrite that may not have happened.
    const changed = report?.changed?.length ? ` Updated: ${report.changed.join(', ')}.` : '';
    showToast(added
      ? `Tailored — ${added} requirement${added === 1 ? '' : 's'} added${
          score != null ? `, now a ${score}% match` : ''}.${changed} Review the “Added to your CV” list.`
      : (score != null
          ? `Tailored — this is a ${score}% match against that posting.${changed}`
          : `CV tailored to that job description.${changed}`));
  } catch (e: any) {
    showToast(e?.message || 'The CV could not be tailored.', 'error');
  } finally {
    tailoring.value = null;
  }
}

async function buildFromVoice(asNew: boolean) {
  voiceBusy.value = true;
  try {
    const result = await cvBuilderService.buildFromVoice(userId.value, {
      transcript: voiceTranscript.value,
      notes: voiceNotes.value,
      save: asNew,
    });
    if (asNew) {
      showToast('New CV written from your recording — opening it.');
      await router.push({ name: 'CvBuilderEditor', params: { id: result.cv.id } });
      return;
    }
    // Replace content in place, keeping this CV's identity and presentation.
    const target = cv.value!;
    const built = result.cv;
    const keep = { id: target.id, title: target.title, template: target.template,
                   accent_color: target.accent_color, font: target.font, photo: target.photo,
                   job_target: target.job_target, created_at: target.created_at };
    cv.value = { ...built, ...keep };
    dirty.value = true;
    await save('Content rebuilt from a spoken description');
    showToast('This CV now reflects what you said. Check the details before you send it.');
    activeTab.value = 'content';
  } catch (e: any) {
    showToast(e?.message || 'The CV could not be built from that recording.', 'error');
  } finally {
    voiceBusy.value = false;
  }
}

// ── Design ────────────────────────────────────────────────────────────
function pickTemplate(key: string) {
  cv.value!.template = key;
  markDirty();
}

function setAccent(value: string) {
  cv.value!.accent_color = value;
  markDirty();
}

function pickAvatar(kind: string) {
  cv.value!.photo.avatar = kind as any;
  cv.value!.photo.data_url = '';
  cv.value!.photo.show = true;
  markDirty();
}

function openStudio() {
  photoError.value = '';
  studioOpen.value = true;
}

/**
 * Store what the studio produced.
 *
 * Two separate things are saved: the framed, background-swapped picture goes into
 * the CV record (that is what gets printed), and the untouched capture is
 * archived in the data repo so the framing can be redone later without
 * re-cropping an already-cropped image. The archive is best effort - losing it
 * costs a future re-edit, not this one.
 */
async function onStudioApply(payload: { dataUrl: string; edit: CvPhotoEdit; original: Blob | null }) {
  studioOpen.value = false;
  photoBusy.value = true;
  photoError.value = '';
  const photo = cv.value!.photo;

  try {
    if (payload.original) {
      try {
        const archived = await cvBuilderService.uploadPhoto(
          userId.value,
          new File([payload.original], `photo-${Date.now()}.jpg`, { type: payload.original.type }));
        photo.source_path = archived.repo_path;
        photo.filename = archived.filename;
      } catch (e: any) {
        showToast('The photo is on your CV, but the original could not be archived: '
          + (e?.message || 'upload failed'), 'error');
      }
    }

    photo.data_url = payload.dataUrl;
    photo.edit = payload.edit;
    photo.avatar = '';
    photo.show = true;
    markDirty();
    await save('Profile photo updated');
    showToast('Photo updated.');
  } catch (e: any) {
    photoError.value = e?.message || 'That photo could not be saved.';
  } finally {
    photoBusy.value = false;
  }
}

function clearPhoto() {
  cv.value!.photo.data_url = '';
  cv.value!.photo.repo_path = '';
  cv.value!.photo.filename = '';
  if (!cv.value!.photo.avatar) cv.value!.photo.avatar = 'neutral';
  markDirty();
}

// ── Download ──────────────────────────────────────────────────────────
/**
 * `\p{L}\p{N}` rather than `\w`, because JavaScript's `\w` is ASCII-only while the
 * backend's Python one is Unicode-aware. With `\w` the preview of an Arabic name
 * renders as empty while the file downloads with the name intact - the preview
 * would be lying to exactly the users most likely to notice.
 */
const UNSAFE_IN_FILENAME = /[^\p{L}\p{N}_\s-]/gu;

/** Mirrors export_filename() in the backend. A preview only - it sanitises again. */
const previewFilename = computed(() => {
  const extension = downloading.value || 'pdf';
  const typed = downloadName.value.trim().replace(/\.(pdf|docx)$/i, '');
  const cleaned = typed.replace(UNSAFE_IN_FILENAME, '').trim()
    .replace(/\s+/g, '_').slice(0, 70);
  if (cleaned) return `${cleaned}.${extension}`;
  const fallback = (cv.value?.personal.full_name || cv.value?.title || 'cv')
    .replace(UNSAFE_IN_FILENAME, '').trim().replace(/\s+/g, '_').slice(0, 70) || 'cv';
  return `${fallback}_CV.${extension}`;
});

function askDownload() {
  downloadName.value = cv.value?.title || '';
  downloadOpen.value = true;
  // Selected, not merely focused: the default is a name to replace.
  void nextTick(() => downloadNameInput.value?.select());
}

async function downloadCv(format: ExportFormat) {
  downloading.value = format;
  try {
    // Send the in-memory record so the file includes edits the user can see but
    // has not saved - anything else would download a document they did not expect.
    const { blob, filename } = await cvBuilderService.download(
      userId.value, cv.value!.id, format,
      { cv: cv.value!, filename: downloadName.value.trim() });
    cvBuilderService.saveBlob(blob, filename);
    downloadOpen.value = false;
  } catch (e: any) {
    showToast(e?.message || `The ${format.toUpperCase()} could not be built.`, 'error');
  } finally {
    downloading.value = '';
  }
}

function goBack() {
  router.push({ name: 'CvBuilder' });
}

// ── Lifecycle ─────────────────────────────────────────────────────────
function onResize() { windowWide.value = window.innerWidth >= 1380; }

function beforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value) return;
  event.preventDefault();
  event.returnValue = '';
}

onMounted(async () => {
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('beforeunload', beforeUnload);
  await load();
  await loadCatalogue();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
  window.removeEventListener('beforeunload', beforeUnload);
});

onBeforeRouteLeave(async () => {
  if (!dirty.value) return true;
  // Save rather than nag: the user's edits are the point, and a lost CV is worse
  // than an unexpected save.
  await save();
  return true;
});
</script>

<style scoped>
.cve { padding: 18px 22px 60px; max-width: 1700px; margin: 0 auto; color: var(--sfs-text, #fff); }
.cve-loading {
  min-height: 60vh; display: grid; place-content: center; gap: 14px;
  color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.6); text-align: center;
}
.load-error { color: var(--sfs-danger-text, #fca5a5); max-width: 460px; }

/* ── Header ─────────────────────────────────────────────────── */
.cve-head {
  display: flex; justify-content: space-between; align-items: flex-start;
  gap: 16px; flex-wrap: wrap; margin-bottom: 14px;
}
.cve-head-left { display: flex; gap: 12px; align-items: flex-start; flex: 1 1 320px; min-width: 0; }
.cve-title-wrap { min-width: 0; flex: 1; }
.cve-title {
  background: transparent; border: none; border-bottom: 1px solid transparent;
  color: var(--sfs-text, #fff); font-size: 1.32rem; font-weight: 650; padding: 2px 0; width: 100%;
  font-family: inherit;
}
.cve-title:hover { border-bottom-color: rgb(var(--sfs-line-rgb, 255 255 255) / 0.18); }
.cve-title:focus { outline: none; border-bottom-color: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.8); }

.cve-sub {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.52); font-size: 0.8rem; margin-top: 5px;
}
.meter {
  width: 90px; height: 5px; border-radius: 3px;
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.12); overflow: hidden; display: inline-block;
}
.meter-fill { display: block; height: 100%; background: linear-gradient(90deg, var(--sfs-accent, #667eea), var(--sfs-accent-2, #a855f7)); }
.pill {
  background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.2); color: var(--sfs-text-muted, #c7d2fe);
  padding: 1px 9px; border-radius: 20px; font-size: 0.74rem;
}
.save-state { font-size: 0.75rem; }
.save-state.dirty { color: var(--sfs-warning-text, #fcd34d); }
.save-state.saving { color: var(--sfs-text-muted, #93c5fd); }
.save-state.saved { color: rgb(var(--sfs-success-rgb, 134 239 172) / 0.85); }

.cve-head-actions { display: flex; gap: 8px; flex-wrap: wrap; }

/* ── Buttons & inputs ───────────────────────────────────────── */
.btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 9px 15px;
  border: none; border-radius: 9px; font-size: 0.86rem; font-weight: 600;
  cursor: pointer; font-family: inherit;
  transition: transform 0.15s ease, filter 0.15s ease;
}
.btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.08); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-sm { padding: 6px 11px; font-size: 0.78rem; border-radius: 7px; }
.btn-primary { background: linear-gradient(135deg, var(--sfs-accent, #667eea), var(--sfs-accent-2, #764ba2)); color: var(--sfs-on-accent, #fff); }
.btn-secondary { background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.2); color: var(--sfs-text-muted, #c7d2fe); border: 1px solid rgb(var(--sfs-accent-rgb, 102 126 234) / 0.45); }
.btn-ghost { background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.07); color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.85); border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.14); }
.btn-ai { background: linear-gradient(135deg, var(--sfs-accent-2, #a855f7), var(--sfs-accent-2, #ec4899)); color: var(--sfs-on-accent-2, #fff); }

/* ── Busy indicator ─────────────────────────────────────────────
   An inline spinner, sized in `em` so it tracks whatever font size the button it
   sits in uses, and drawn with `currentColor` so it is legible on the gradient
   button, on the ghost button and in all ten galaxies without naming a colour.
   `flex-shrink: 0` because a button whose label grows to "Tailoring your CV…"
   would otherwise squash the circle into an ellipse. */
.btn-spinner {
  display: inline-block; flex-shrink: 0;
  width: 0.9em; height: 0.9em; vertical-align: -0.1em;
  border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%;
  animation: cve-spin 0.7s linear infinite;
}
@keyframes cve-spin { to { transform: rotate(360deg); } }

.tailor-progress {
  display: flex; align-items: center; gap: 8px;
  margin: 10px 0 0; font-size: 0.85rem;
  color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.75);
}

/* Someone who asked for less motion still needs to know it is working, so the
   ring stays and only the rotation stops. */
@media (prefers-reduced-motion: reduce) {
  .btn-spinner { animation: none; border-top-color: currentColor; opacity: 0.6; }
}

.icon-btn {
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.07); border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.14);
  color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.8); width: 34px; height: 34px; border-radius: 9px;
  display: grid; place-items: center; cursor: pointer; font-size: 0.9rem;
}
.icon-btn:hover:not(:disabled) { background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.13); }
.icon-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.icon-btn.sm { width: 26px; height: 26px; border-radius: 7px; font-size: 0.78rem; }
.icon-btn.danger { color: var(--sfs-danger-text, #fca5a5); border-color: rgb(var(--sfs-danger-rgb, 239 68 68) / 0.35); }

/* ── Banner ─────────────────────────────────────────────────── */
.cve-banner {
  padding: 11px 15px; border-radius: 10px; font-size: 0.86rem; margin-bottom: 14px;
  display: flex; align-items: center; gap: 12px;
}
.cve-banner.info { background: rgb(var(--sfs-accent-rgb, 59 130 246) / 0.12); border: 1px solid rgb(var(--sfs-accent-rgb, 59 130 246) / 0.32); color: var(--sfs-text-muted, #bfdbfe); }
.cve-banner.warn { background: rgb(var(--sfs-warning-rgb, 245 158 11) / 0.12); border: 1px solid rgb(var(--sfs-warning-rgb, 245 158 11) / 0.32); color: var(--sfs-warning-text, #fcd34d); }
.cve-banner.error { background: rgb(var(--sfs-danger-rgb, 239 68 68) / 0.12); border: 1px solid rgb(var(--sfs-danger-rgb, 239 68 68) / 0.32); color: var(--sfs-danger-text, #fca5a5); }
.banner-x {
  margin-inline-start: auto; background: none; border: none; color: inherit;
  font-size: 1.2rem; cursor: pointer; line-height: 1;
}

/* ── Tabs ───────────────────────────────────────────────────── */
.cve-tabs {
  display: flex; gap: 5px; overflow-x: auto; padding-bottom: 3px; margin-bottom: 16px;
  border-bottom: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.09);
}
.cve-tab {
  display: inline-flex; align-items: center; gap: 7px; white-space: nowrap;
  background: transparent; border: none; border-bottom: 2px solid transparent;
  color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.55); padding: 10px 14px; font-size: 0.87rem;
  font-weight: 600; cursor: pointer; font-family: inherit;
}
.cve-tab:hover { color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.85); }
.cve-tab.active { color: var(--sfs-text, #fff); border-bottom-color: var(--sfs-accent-2, #8b5cf6); }
.cve-tab-icon { display: inline-flex; }

/* ── Layout ─────────────────────────────────────────────────── */
.cve-body.split { display: grid; grid-template-columns: minmax(0, 1fr) 620px; gap: 20px; align-items: start; }
.cve-side-preview { position: sticky; top: 16px; max-height: calc(100vh - 40px); overflow: auto; }
.cve-panel { min-width: 0; }

/* ── Cards & fields ─────────────────────────────────────────── */
.card {
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.042); border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.09);
  border-radius: 13px; padding: 17px 18px; margin-bottom: 15px;
}
.card.warn-card { border-color: rgb(var(--sfs-warning-rgb, 245 158 11) / 0.35); background: rgb(var(--sfs-warning-rgb, 245 158 11) / 0.07); }
.card.warn-card h3 { color: var(--sfs-warning-text, #fcd34d); }
.card-head {
  display: flex; justify-content: space-between; align-items: center;
  gap: 12px; flex-wrap: wrap; margin-bottom: 13px;
}
.card-head h3 { font-size: 1.02rem; font-weight: 650; }
.card-head-actions { display: flex; gap: 7px; flex-wrap: wrap; }
.card-note { color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.6); font-size: 0.85rem; line-height: 1.58; margin-bottom: 14px; }
.card-note strong { color: var(--sfs-warning-text, #fcd34d); }
.badge {
  font-size: 0.72rem; background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.1); padding: 1px 8px;
  border-radius: 20px; color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.65); margin-inline-start: 6px;
}

.grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 11px; }
.grid-2.gap { gap: 15px; align-items: start; }
.grid-3 { display: grid; grid-template-columns: 1fr 1fr 0.7fr auto; gap: 9px; align-items: end; }
.grid-skill { display: grid; grid-template-columns: 0.7fr 2fr auto; gap: 9px; align-items: end; }
.row-gap { margin-bottom: 9px; }

.field { display: block; }
.field > span {
  display: block; color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.62); font-size: 0.76rem;
  font-weight: 600; margin-bottom: 5px;
}
.field input, .field textarea, .field select, .jd, textarea {
  width: 100%; background: rgb(var(--sfs-shade-rgb, 0 0 0) / 0.28); border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.13);
  border-radius: 9px; color: var(--sfs-text, #fff); padding: 9px 11px; font-size: 0.87rem;
  font-family: inherit; line-height: 1.5; resize: vertical;
}
.field input:focus, .field textarea:focus, .field select:focus, .jd:focus, textarea:focus {
  outline: none; border-color: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.7);
  box-shadow: 0 0 0 3px rgb(var(--sfs-accent-rgb, 102 126 234) / 0.14);
}
.field input:disabled { opacity: 0.5; }
.field select option { background: var(--sfs-surface-2, #141428); }
.inline-field { max-width: 160px; }
.date-row { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }

.check {
  display: inline-flex; align-items: center; gap: 8px; margin: 9px 0;
  color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.72); font-size: 0.84rem; cursor: pointer;
}
.check input { width: 16px; height: 16px; accent-color: var(--sfs-accent-2, #8b5cf6); }

.hint { color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.42); font-size: 0.78rem; margin-top: 6px; line-height: 1.5; }
.hint.inline { margin-top: 0; flex: 1 1 200px; }
.empty-note { color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.42); font-size: 0.84rem; }
.row-actions { display: flex; gap: 9px; align-items: center; flex-wrap: wrap; margin-top: 13px; }

.entry {
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.08); border-radius: 11px;
  padding: 13px; margin-bottom: 11px; background: rgb(var(--sfs-shade-rgb, 0 0 0) / 0.14);
}
.entry-tight { padding: 11px 13px; }
.entry-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 9px; }
.entry-index {
  width: 22px; height: 22px; border-radius: 50%; background: rgb(var(--sfs-accent-2-rgb, 139 92 246) / 0.22);
  color: var(--sfs-text-muted, #ddd6fe); font-size: 0.74rem; display: grid; place-items: center; font-weight: 700;
}
.entry-move { display: flex; gap: 5px; }
.entry .field { margin-top: 9px; }

.sub-head {
  display: flex; justify-content: space-between; align-items: center;
  margin: 18px 0 9px; padding-top: 13px; border-top: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.07);
}
.sub-head h4 { font-size: 0.9rem; font-weight: 650; }

/* ── Review / match ─────────────────────────────────────────── */
.review { margin-top: 16px; padding-top: 15px; border-top: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.08); }
.review-score {
  display: inline-flex; align-items: baseline; gap: 4px; padding: 7px 15px;
  border-radius: 11px; font-weight: 700;
}
.review-score.good { background: rgb(var(--sfs-success-rgb, 34 197 94) / 0.16); color: var(--sfs-success-text, #86efac); }
.review-score.mid { background: rgb(var(--sfs-warning-rgb, 245 158 11) / 0.16); color: var(--sfs-warning-text, #fcd34d); }
.review-score.low { background: rgb(var(--sfs-danger-rgb, 239 68 68) / 0.16); color: var(--sfs-danger-text, #fca5a5); }
.review-score-value { font-size: 1.7rem; line-height: 1; }
.review-score-label { font-size: 0.8rem; opacity: 0.8; }
.review-verdict { margin-top: 11px; font-size: 0.95rem; line-height: 1.55; color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.88); }

.review-cols {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px; margin-top: 16px;
}
.review-cols h4, .review-issues h4, .review-ats h4, .kw-groups h4 {
  font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.5); margin-bottom: 7px;
}
.review-cols ul, .review-ats ul, .notes {
  padding-inline-start: 17px; color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.78); font-size: 0.86rem; line-height: 1.6;
}
.review-cols li, .review-ats li, .notes li { margin-bottom: 4px; }

.review-issues { margin-top: 16px; }
.review-issue {
  border-inline-start: 2px solid rgb(var(--sfs-warning-rgb, 245 158 11) / 0.55); padding: 3px 0 3px 11px; margin-bottom: 11px;
}
.review-issue-section {
  font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--sfs-warning-text, #fcd34d); font-weight: 700;
}
.review-issue-problem { font-size: 0.87rem; color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.85); margin-top: 2px; }
.review-issue-fix { font-size: 0.85rem; color: var(--sfs-text-muted, #a5b4fc); margin-top: 2px; }
.review-ats { margin-top: 16px; }

.match-top { display: flex; align-items: center; gap: 15px; flex-wrap: wrap; margin-bottom: 16px; }
.match-title h4 { font-size: 1.02rem; font-weight: 650; }
.match-title p { color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.55); font-size: 0.84rem; }

.match-delta { margin-top: 3px; font-size: 0.78rem; }
.match-delta .up { color: var(--sfs-success-text, #86efac); font-weight: 700; margin-inline-start: 4px; }

.kw-groups { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
.kws { display: flex; flex-wrap: wrap; gap: 6px; }
.kw { font-size: 0.76rem; padding: 3px 9px; border-radius: 20px; }
.kw.good { background: rgb(var(--sfs-success-rgb, 34 197 94) / 0.15); color: var(--sfs-success-text, #86efac); }
.kw.bad { background: rgb(var(--sfs-danger-rgb, 239 68 68) / 0.13); color: var(--sfs-danger-text, #fca5a5); }
/* Additions read as "new, check me", not as pass or fail. */
.kw.added {
  background: rgb(var(--sfs-accent-2-rgb, 139 92 246) / 0.18); color: var(--sfs-text-muted, #ddd6fe);
  border: 1px solid rgb(var(--sfs-accent-2-rgb, 139 92 246) / 0.45);
}

.added-list {
  margin-top: 9px; padding-inline-start: 17px;
  color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.76); font-size: 0.83rem; line-height: 1.55;
}
.added-list li { margin-bottom: 4px; }
.added-where {
  display: inline-block; margin-inline-end: 6px;
  font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--sfs-text-muted, #c4b5fd);
}

.review-warn {
  margin-top: 16px; padding: 11px 13px;
  background: rgb(var(--sfs-warning-rgb, 245 158 11) / 0.09);
  border: 1px solid rgb(var(--sfs-warning-rgb, 245 158 11) / 0.3);
  border-radius: 11px;
}
.review-warn h4 {
  font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--sfs-warning-text, #fcd34d); margin-bottom: 7px;
}
.review-warn ul {
  padding-inline-start: 17px; color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.82); font-size: 0.86rem; line-height: 1.6;
}
.review-warn li { margin-bottom: 4px; }

/* ── Coverage picker (tailor strength) ──────────────────────── */
.coverage-picker {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 10px; margin: 13px 0 4px;
}
.coverage-option {
  background: rgb(var(--sfs-shade-rgb, 0 0 0) / 0.2); border: 1.5px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.1);
  border-radius: 11px; padding: 11px 12px; cursor: pointer; text-align: start;
  color: inherit; font: inherit;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}
.coverage-option:hover { transform: translateY(-2px); border-color: rgb(var(--sfs-accent-2-rgb, 139 92 246) / 0.5); }
.coverage-option.active { border-color: var(--sfs-accent-2, #8b5cf6); box-shadow: 0 0 0 3px rgb(var(--sfs-accent-2-rgb, 139 92 246) / 0.18); }
.coverage-option strong { display: block; font-size: 0.88rem; margin-bottom: 3px; }
.coverage-option span {
  display: block; color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.5); font-size: 0.75rem; line-height: 1.45;
}

/* ── Template picker ────────────────────────────────────────── */
.tpl-picker { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 11px; }
.tpl-option {
  background: rgb(var(--sfs-shade-rgb, 0 0 0) / 0.2); border: 1.5px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.1);
  border-radius: 11px; padding: 10px; cursor: pointer; text-align: start;
  color: var(--sfs-text, #fff); font-family: inherit; transition: border-color 0.15s ease, transform 0.15s ease;
}
.tpl-option:hover { transform: translateY(-2px); border-color: rgb(var(--sfs-accent-2-rgb, 139 92 246) / 0.5); }
.tpl-option.active { border-color: var(--sfs-accent-2, #8b5cf6); box-shadow: 0 0 0 3px rgb(var(--sfs-accent-2-rgb, 139 92 246) / 0.18); }
.tpl-option strong { display: block; font-size: 0.87rem; margin-bottom: 2px; }
.tpl-option small { display: block; color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.45); font-size: 0.72rem; line-height: 1.4; }
.tpl-option .ats {
  display: inline-block; margin-top: 5px; font-size: 0.66rem; font-style: normal;
  background: rgb(var(--sfs-success-rgb, 34 197 94) / 0.16); color: var(--sfs-success-text, #86efac); padding: 1px 7px; border-radius: 20px;
}
.tpl-mini {
  position: relative; display: block; height: 62px; background: var(--sfs-paper, #fff);
  border-radius: 5px; overflow: hidden; margin-bottom: 8px;
}
.tpl-mini .band { position: absolute; background: var(--tpl-accent); }
.tpl-mini.tpl-banner .band { top: 0; left: 0; right: 0; height: 17px; }
.tpl-mini.tpl-sidebar .band { top: 0; bottom: 0; left: 0; width: 34%; }
.tpl-mini.tpl-single .band { top: 8px; left: 8px; width: 46%; height: 3px; border-radius: 2px; }
.tpl-mini .l { position: absolute; height: 3px; border-radius: 2px; background: var(--sfs-paper-2, #d8dbe3); }
.tpl-mini.tpl-banner .l1 { top: 25px; left: 8px; right: 8px; }
.tpl-mini.tpl-banner .l2 { top: 34px; left: 8px; right: 26px; }
.tpl-mini.tpl-banner .l3 { top: 43px; left: 8px; right: 16px; }
.tpl-mini.tpl-sidebar .l1 { top: 13px; left: 40%; right: 7px; }
.tpl-mini.tpl-sidebar .l2 { top: 22px; left: 40%; right: 18px; }
.tpl-mini.tpl-sidebar .l3 { top: 31px; left: 40%; right: 11px; }
.tpl-mini.tpl-single .l1 { top: 18px; left: 8px; right: 8px; }
.tpl-mini.tpl-single .l2 { top: 27px; left: 8px; right: 22px; }
.tpl-mini.tpl-single .l3 { top: 36px; left: 8px; right: 14px; }

/* ── Colours ────────────────────────────────────────────────── */
.swatches { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; align-items: center; }
.swatch {
  width: 34px; height: 34px; border-radius: 9px; border: 2px solid transparent;
  cursor: pointer; color: var(--sfs-text, #fff); font-size: 0.62rem; font-family: inherit;
}
.swatch.active { border-color: var(--sfs-border-strong, #fff); box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.16); }
.swatch.reset { background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.1); color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.7); }
.swatch-custom {
  display: inline-flex; flex-direction: column; align-items: center; gap: 2px;
  font-size: 0.62rem; color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.55); cursor: pointer;
}
.swatch-custom input { width: 34px; height: 30px; border: none; background: none; padding: 0; cursor: pointer; }

/* ── Photo ──────────────────────────────────────────────────── */
.photo-row { display: flex; gap: 18px; flex-wrap: wrap; align-items: flex-start; }
.photo-current {
  width: 104px; height: 104px; flex: 0 0 auto; overflow: hidden;
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.07); display: grid; place-items: center;
  color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.35); font-size: 0.76rem;
}
.photo-current.shape-circle { border-radius: 50%; }
.photo-current.shape-rounded { border-radius: 16px; }
.photo-current.shape-square { border-radius: 3px; }
.photo-current img { width: 100%; height: 100%; object-fit: cover; }
.photo-controls { flex: 1 1 260px; display: flex; flex-direction: column; gap: 11px; }
.photo-upload { position: relative; overflow: hidden; align-self: flex-start; }
.photo-upload input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.avatar-label { display: block; color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.62); font-size: 0.76rem; font-weight: 600; margin-bottom: 6px; }
.avatars { display: flex; gap: 8px; }
.avatar-option {
  width: 52px; height: 52px; border-radius: 50%; overflow: hidden; padding: 0;
  border: 2px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.14); background: none; cursor: pointer;
}
.avatar-option.active { border-color: var(--sfs-accent-2, #8b5cf6); box-shadow: 0 0 0 3px rgb(var(--sfs-accent-2-rgb, 139 92 246) / 0.2); }
.avatar-option img { width: 100%; height: 100%; object-fit: cover; display: block; }
.photo-flags { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
.path-error { color: var(--sfs-danger-text, #fca5a5); font-size: 0.83rem; line-height: 1.5; }

/* ── Section order ──────────────────────────────────────────── */
.section-order { list-style: none; }
.section-order li {
  display: flex; align-items: center; gap: 10px; padding: 8px 11px;
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.08); border-radius: 9px; margin-bottom: 6px;
  background: rgb(var(--sfs-shade-rgb, 0 0 0) / 0.16); font-size: 0.86rem;
}
.section-order li.hidden { opacity: 0.45; }
.section-order li.empty .so-name { color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.45); }
.so-name { flex: 1; }
.so-empty { font-size: 0.7rem; color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.35); }
.so-actions { display: flex; gap: 5px; }

/* ── Preview tab ────────────────────────────────────────────── */
.preview-bar {
  display: flex; justify-content: space-between; align-items: center;
  gap: 14px; flex-wrap: wrap; margin-bottom: 6px;
}
.preview-bar-left strong { font-size: 0.98rem; }
.preview-bar-left span { color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.5); font-size: 0.83rem; margin-inline-start: 9px; }
.preview-bar-actions { display: flex; gap: 8px; }
.preview-hint { margin-bottom: 14px; }

/* ── Toast ──────────────────────────────────────────────────── */
/* ── Download dialog ─────────────────────────────────────────── */
/* This screen had no dialog before the named download, so the layer is new here
   rather than shared. It matches CvBuilder.vue's so the two read as one product. */
.modal-backdrop {
  position: fixed; inset: 0; z-index: 900; padding: 20px;
  background: rgb(var(--sfs-surface-rgb, 0 0 0) / 0.62); backdrop-filter: blur(3px);
  display: grid; place-items: center;
}
.modal {
  background: var(--sfs-surface-2, #131327); border-radius: 14px; padding: 22px;
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.12);
  max-width: 440px; width: 100%;
}
.modal h3 { font-size: 1.1rem; font-weight: 650; margin-bottom: 8px; }
.modal p {
  color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.62);
  font-size: 0.88rem; line-height: 1.55; margin-bottom: 16px;
}
.modal-actions { display: flex; gap: 9px; flex-wrap: wrap; }
.modal-field { display: block; margin-bottom: 12px; }
.modal-field span {
  display: block; font-size: 0.78rem; font-weight: 600; margin-bottom: 6px;
  color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.72);
}
.modal-field input {
  width: 100%; padding: 10px 12px; border-radius: 9px; font-size: 0.9rem;
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06);
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.14);
  color: var(--sfs-text, #fff);
}
.modal-field input:focus { outline: none; border-color: var(--sfs-accent, #667eea); }
.modal-hint {
  font-size: 0.8rem; margin-bottom: 16px; word-break: break-all;
  color: rgb(var(--sfs-text-rgb, 255 255 255) / 0.55);
}
.modal-hint strong { color: var(--sfs-text, #fff); font-weight: 600; }

/* ── "Drafted from a job ad" gaps ────────────────────────────── */
.draft-gaps { display: flex; flex-wrap: wrap; gap: 7px; margin: 4px 0 12px; }
.draft-gap {
  font-size: 0.8rem; padding: 4px 10px; border-radius: 999px;
  background: rgb(var(--sfs-warning-rgb, 245 158 11) / 0.3);
  color: var(--sfs-warning-text, #fbbf24);
}

.toast {
  position: fixed; bottom: 22px; left: 50%; transform: translateX(-50%);
  padding: 12px 20px; border-radius: 10px; font-size: 0.87rem; z-index: 950;
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.45); max-width: 90vw; text-align: center;
}
.toast.success { background: var(--sfs-success, #16a34a); color: var(--sfs-on-success, #fff); }
.toast.error { background: var(--sfs-danger, #dc2626); color: var(--sfs-on-danger, #fff); }

@media (max-width: 900px) {
  .cve { padding: 14px 13px 50px; }
  .grid-3, .grid-skill { grid-template-columns: 1fr; }
  .grid-3 .icon-btn, .grid-skill .icon-btn { justify-self: end; }
}
</style>
