<template>
  <div class="cve" v-if="cv">
    <!-- ═══ Header ═══ -->
    <header class="cve-head">
      <div class="cve-head-left">
        <button class="icon-btn" title="Back to my CVs" @click="goBack">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        </button>
        <div class="cve-title-wrap">
          <input v-model="cv.title" class="cve-title" placeholder="CV title" @input="markDirty" />
          <p class="cve-sub">
            <span class="meter" :title="`${completeness}% complete`">
              <span class="meter-fill" :style="{ width: completeness + '%' }"></span>
            </span>
            {{ completeness }}% complete · {{ wordCount }} words
            <span v-if="cv.job_target?.match_report?.score != null" class="pill">
              {{ cv.job_target.match_report.score }}% job match
            </span>
            <span class="save-state" :class="saveState">{{ saveLabel }}</span>
          </p>
        </div>
      </div>

      <div class="cve-head-actions">
        <button class="btn btn-ghost" :disabled="saving || !dirty" @click="save()">
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
        <button class="btn btn-primary" :disabled="!!downloading" @click="downloadCv('pdf')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
          {{ downloading === 'pdf' ? 'Building…' : 'PDF' }}
        </button>
        <button class="btn btn-secondary" :disabled="!!downloading" @click="downloadCv('docx')">
          {{ downloading === 'docx' ? 'Building…' : 'DOCX' }}
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
            <h3>Personal details</h3>
          </div>
          <div class="grid-2">
            <label class="field"><span>Full name</span>
              <input v-model="cv.personal.full_name" @input="markDirty" placeholder="Layla Haddad" /></label>
            <label class="field"><span>Professional title</span>
              <input v-model="cv.personal.headline" @input="markDirty" placeholder="Senior Backend Engineer" /></label>
            <label class="field"><span>Email</span>
              <input v-model="cv.personal.email" @input="markDirty" type="email" /></label>
            <label class="field"><span>Phone</span>
              <input v-model="cv.personal.phone" @input="markDirty" /></label>
            <label class="field"><span>Location</span>
              <input v-model="cv.personal.location" @input="markDirty" placeholder="Amman, Jordan" /></label>
            <label class="field"><span>Website</span>
              <input v-model="cv.personal.website" @input="markDirty" /></label>
            <label class="field"><span>LinkedIn</span>
              <input v-model="cv.personal.linkedin" @input="markDirty" /></label>
            <label class="field"><span>GitHub</span>
              <input v-model="cv.personal.github" @input="markDirty" /></label>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <h3>Professional summary</h3>
            <button class="btn btn-ai btn-sm" :disabled="busySection === 'summary' || !aiReady"
                    @click="rewrite('summary')">
              {{ busySection === 'summary' ? 'Rewriting…' : '✨ Improve with AI' }}
            </button>
          </div>
          <textarea v-model="cv.personal.summary" rows="5" @input="markDirty"
                    placeholder="Three or four sentences: your seniority, your specialism, and the two things you are best at."></textarea>
          <p class="hint">{{ (cv.personal.summary || '').length }} characters. Recruiters read this
             first and often only this.</p>
        </div>

        <!-- Experience -->
        <div class="card">
          <div class="card-head">
            <h3>Experience <span class="badge">{{ cv.experience.length }}</span></h3>
            <div class="card-head-actions">
              <button class="btn btn-ai btn-sm" :disabled="busySection === 'experience' || !aiReady || !cv.experience.length"
                      @click="rewrite('experience')">
                {{ busySection === 'experience' ? 'Rewriting…' : '✨ Improve all bullets' }}
              </button>
              <button class="btn btn-ghost btn-sm" @click="addEntry('experience')">+ Add role</button>
            </div>
          </div>

          <div v-for="(entry, i) in cv.experience" :key="entry.id || i" class="entry">
            <div class="entry-head">
              <span class="entry-index">{{ i + 1 }}</span>
              <div class="entry-move">
                <button class="icon-btn sm" :disabled="i === 0" title="Move up" @click="move('experience', i, -1)">↑</button>
                <button class="icon-btn sm" :disabled="i === cv.experience.length - 1" title="Move down" @click="move('experience', i, 1)">↓</button>
                <button class="icon-btn sm danger" title="Remove" @click="removeEntry('experience', i)">×</button>
              </div>
            </div>
            <div class="grid-2">
              <label class="field"><span>Job title</span>
                <input v-model="entry.role" @input="markDirty" /></label>
              <label class="field"><span>Company</span>
                <input v-model="entry.company" @input="markDirty" /></label>
              <label class="field"><span>Location</span>
                <input v-model="entry.location" @input="markDirty" /></label>
              <label class="field"><span>Dates</span>
                <div class="date-row">
                  <input v-model="entry.start" @input="markDirty" placeholder="Mar 2021" />
                  <input v-model="entry.end" @input="markDirty" :disabled="entry.current"
                         :placeholder="entry.current ? 'Present' : 'Feb 2024'" />
                </div>
              </label>
            </div>
            <label class="check">
              <input type="checkbox" v-model="entry.current" @change="markDirty" />
              I still work here
            </label>
            <label class="field"><span>What you achieved — one per line</span>
              <textarea :value="linesOf(entry.bullets)" rows="4" @input="setLines(entry, 'bullets', $event)"
                        placeholder="Led migration of the payments monolith to 11 services, cutting p95 latency from 820ms to 310ms"></textarea>
            </label>
            <label class="field"><span>Tools and technologies — comma separated</span>
              <input :value="(entry.tech || []).join(', ')" @input="setList(entry, 'tech', $event)" /></label>
          </div>
          <p v-if="!cv.experience.length" class="empty-note">No roles yet. Add one, or import a CV
             and the AI fills this in for you.</p>
        </div>

        <!-- Education -->
        <div class="card">
          <div class="card-head">
            <h3>Education <span class="badge">{{ cv.education.length }}</span></h3>
            <button class="btn btn-ghost btn-sm" @click="addEntry('education')">+ Add</button>
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
              <label class="field"><span>Qualification</span>
                <input v-model="entry.degree" @input="markDirty" placeholder="BSc" /></label>
              <label class="field"><span>Field of study</span>
                <input v-model="entry.field" @input="markDirty" placeholder="Computer Science" /></label>
              <label class="field"><span>Institution</span>
                <input v-model="entry.institution" @input="markDirty" /></label>
              <label class="field"><span>Grade</span>
                <input v-model="entry.grade" @input="markDirty" placeholder="Very Good / 3.6 GPA" /></label>
              <label class="field"><span>From</span>
                <input v-model="entry.start" @input="markDirty" /></label>
              <label class="field"><span>To</span>
                <input v-model="entry.end" @input="markDirty" /></label>
            </div>
          </div>
        </div>

        <!-- Skills -->
        <div class="card">
          <div class="card-head">
            <h3>Skills</h3>
            <div class="card-head-actions">
              <button class="btn btn-ai btn-sm" :disabled="busySection === 'skills' || !aiReady || !cv.skills.length"
                      @click="rewrite('skills')">
                {{ busySection === 'skills' ? 'Grouping…' : '✨ Regroup with AI' }}
              </button>
              <button class="btn btn-ghost btn-sm" @click="addEntry('skills')">+ Add group</button>
            </div>
          </div>
          <div v-for="(group, i) in cv.skills" :key="i" class="entry entry-tight">
            <div class="grid-skill">
              <label class="field"><span>Group name — optional</span>
                <input v-model="group.category" @input="markDirty" placeholder="Languages" /></label>
              <label class="field"><span>Skills — comma separated</span>
                <input :value="(group.items || []).join(', ')" @input="setList(group, 'items', $event)" /></label>
              <button class="icon-btn sm danger" @click="removeEntry('skills', i)">×</button>
            </div>
          </div>
        </div>

        <!-- Projects -->
        <div class="card">
          <div class="card-head">
            <h3>Projects <span class="badge">{{ cv.projects.length }}</span></h3>
            <button class="btn btn-ghost btn-sm" @click="addEntry('projects')">+ Add</button>
          </div>
          <div v-for="(entry, i) in cv.projects" :key="entry.id || i" class="entry">
            <div class="entry-head">
              <span class="entry-index">{{ i + 1 }}</span>
              <button class="icon-btn sm danger" @click="removeEntry('projects', i)">×</button>
            </div>
            <div class="grid-2">
              <label class="field"><span>Name</span><input v-model="entry.name" @input="markDirty" /></label>
              <label class="field"><span>Link</span><input v-model="entry.link" @input="markDirty" /></label>
            </div>
            <label class="field"><span>Description</span>
              <textarea v-model="entry.description" rows="2" @input="markDirty"></textarea></label>
            <label class="field"><span>Highlights — one per line</span>
              <textarea :value="linesOf(entry.bullets)" rows="2" @input="setLines(entry, 'bullets', $event)"></textarea></label>
            <label class="field"><span>Tech — comma separated</span>
              <input :value="(entry.tech || []).join(', ')" @input="setList(entry, 'tech', $event)" /></label>
          </div>
        </div>

        <!-- Certifications / Languages -->
        <div class="grid-2 gap">
          <div class="card">
            <div class="card-head">
              <h3>Certifications <span class="badge">{{ cv.certifications.length }}</span></h3>
              <button class="btn btn-ghost btn-sm" @click="addEntry('certifications')">+ Add</button>
            </div>
            <div v-for="(entry, i) in cv.certifications" :key="entry.id || i" class="entry entry-tight">
              <div class="grid-3">
                <label class="field"><span>Name</span><input v-model="entry.name" @input="markDirty" /></label>
                <label class="field"><span>Issuer</span><input v-model="entry.issuer" @input="markDirty" /></label>
                <label class="field"><span>Year</span><input v-model="entry.date" @input="markDirty" /></label>
                <button class="icon-btn sm danger" @click="removeEntry('certifications', i)">×</button>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-head">
              <h3>Languages <span class="badge">{{ cv.languages.length }}</span></h3>
              <button class="btn btn-ghost btn-sm" @click="addEntry('languages')">+ Add</button>
            </div>
            <div v-for="(entry, i) in cv.languages" :key="i" class="entry entry-tight">
              <div class="grid-3">
                <label class="field"><span>Language</span><input v-model="entry.name" @input="markDirty" /></label>
                <label class="field"><span>Level</span>
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
          <div class="card-head"><h3>Extras</h3></div>
          <label class="field"><span>Interests — comma separated</span>
            <input :value="(cv.interests || []).join(', ')" @input="setList(cv, 'interests', $event)" /></label>

          <div class="sub-head">
            <h4>Awards <span class="badge">{{ cv.awards.length }}</span></h4>
            <button class="btn btn-ghost btn-sm" @click="addEntry('awards')">+ Add</button>
          </div>
          <div v-for="(entry, i) in cv.awards" :key="entry.id || i" class="grid-3 row-gap">
            <label class="field"><span>Award</span><input v-model="entry.name" @input="markDirty" /></label>
            <label class="field"><span>Issuer</span><input v-model="entry.issuer" @input="markDirty" /></label>
            <label class="field"><span>Year</span><input v-model="entry.date" @input="markDirty" /></label>
            <button class="icon-btn sm danger" @click="removeEntry('awards', i)">×</button>
          </div>

          <div class="sub-head">
            <h4>Volunteering <span class="badge">{{ cv.volunteering.length }}</span></h4>
            <button class="btn btn-ghost btn-sm" @click="addEntry('volunteering')">+ Add</button>
          </div>
          <div v-for="(entry, i) in cv.volunteering" :key="entry.id || i" class="entry entry-tight">
            <div class="grid-3">
              <label class="field"><span>Role</span><input v-model="entry.role" @input="markDirty" /></label>
              <label class="field"><span>Organisation</span><input v-model="entry.organisation" @input="markDirty" /></label>
              <label class="field"><span>Dates</span>
                <div class="date-row">
                  <input v-model="entry.start" @input="markDirty" placeholder="2020" />
                  <input v-model="entry.end" @input="markDirty" placeholder="2022" />
                </div>
              </label>
              <button class="icon-btn sm danger" @click="removeEntry('volunteering', i)">×</button>
            </div>
            <label class="field"><span>What you did — one per line</span>
              <textarea :value="linesOf(entry.bullets)" rows="2" @input="setLines(entry, 'bullets', $event)"></textarea></label>
          </div>

          <div class="sub-head">
            <h4>References <span class="badge">{{ cv.references.length }}</span></h4>
            <button class="btn btn-ghost btn-sm" @click="addEntry('references')">+ Add</button>
          </div>
          <div v-for="(entry, i) in cv.references" :key="entry.id || i" class="grid-3 row-gap">
            <label class="field"><span>Name</span><input v-model="entry.name" @input="markDirty" /></label>
            <label class="field"><span>Title & company</span><input v-model="entry.title" @input="markDirty" /></label>
            <label class="field"><span>Email</span><input v-model="entry.email" @input="markDirty" /></label>
            <button class="icon-btn sm danger" @click="removeEntry('references', i)">×</button>
          </div>
        </div>
      </section>

      <!-- ══════════════════════ AI ASSIST ══════════════════════ -->
      <section v-show="activeTab === 'ai'" class="cve-panel">
        <div v-if="!aiReady" class="card warn-card">
          <h3>AI is unavailable on this replica</h3>
          <p>No AI provider key is configured on the CV Builder service, so enhancing, reviewing and
             tailoring cannot run right now. Editing, templates and downloads all still work.</p>
        </div>

        <div class="card">
          <div class="card-head"><h3>Rewrite the whole CV</h3></div>
          <p class="card-note">
            The AI sharpens your wording, turns responsibilities into achievements and fixes the
            grammar. It will not add a job, a date, a degree or a metric you did not write — if it
            appears to, treat that as a bug and tell us.
          </p>
          <div class="grid-2">
            <label class="field"><span>Tone</span>
              <select v-model="enhanceTone">
                <option value="professional">Professional — the default</option>
                <option value="concise">Concise — cut every spare word</option>
                <option value="impact">Impact-first — lead with outcomes</option>
                <option value="academic">Academic — formal and precise</option>
              </select>
            </label>
            <label class="field"><span>Target role — optional</span>
              <input v-model="enhanceTarget" placeholder="Senior DevOps Engineer" /></label>
          </div>
          <label class="field"><span>Anything specific to change — optional</span>
            <textarea v-model="enhanceInstructions" rows="3"
                      placeholder="Play down the support work, emphasise the Kubernetes migration, keep it to one page."></textarea></label>
          <div class="row-actions">
            <button class="btn btn-ai" :disabled="enhancing || !aiReady" @click="enhance(false)">
              {{ enhancing ? 'Rewriting your CV…' : '✨ Enhance this CV' }}
            </button>
            <button class="btn btn-ghost" :disabled="enhancing || !aiReady" @click="enhance(true)">
              Enhance into a copy
            </button>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3>Get it reviewed</h3></div>
          <p class="card-note">A recruiter-style critique. It changes nothing — it tells you what a
             screener would notice in the 30 seconds they spend.</p>
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
                <h4>Working well</h4>
                <ul><li v-for="(item, i) in review.strengths" :key="i">{{ item }}</li></ul>
              </div>
              <div v-if="review.quick_wins?.length">
                <h4>Quick wins</h4>
                <ul><li v-for="(item, i) in review.quick_wins" :key="i">{{ item }}</li></ul>
              </div>
            </div>

            <div v-if="review.issues?.length" class="review-issues">
              <h4>Issues</h4>
              <div v-for="(issue, i) in review.issues" :key="i" class="review-issue">
                <span class="review-issue-section">{{ issue.section }}</span>
                <p class="review-issue-problem">{{ issue.problem }}</p>
                <p class="review-issue-fix">→ {{ issue.fix }}</p>
              </div>
            </div>

            <div v-if="review.ats_notes?.length" class="review-ats">
              <h4>ATS notes</h4>
              <ul><li v-for="(item, i) in review.ats_notes" :key="i">{{ item }}</li></ul>
            </div>
          </div>
        </div>

        <div v-if="sectionNotes.length" class="card">
          <div class="card-head"><h3>What the AI changed</h3></div>
          <ul class="notes"><li v-for="(note, i) in sectionNotes" :key="i">{{ note }}</li></ul>
        </div>
      </section>

      <!-- ══════════════════ JOB DESCRIPTION ══════════════════ -->
      <section v-show="activeTab === 'job'" class="cve-panel">
        <div class="card">
          <div class="card-head"><h3>Match this CV to a job</h3></div>
          <p class="card-note">
            Paste the job description. The AI rewrites your summary, reorders your bullets so the
            relevant ones come first and mirrors the posting's vocabulary — using only experience
            you already have. Requirements you do not evidence are reported as gaps, not invented.
          </p>
          <textarea v-model="jobDescription" rows="12" class="jd"
                    placeholder="Paste the full job description here — responsibilities, requirements, nice-to-haves."></textarea>
          <p class="hint">{{ jobDescription.trim().length }} characters
             <span v-if="jobDescription.trim().length && jobDescription.trim().length < 80">
               — paste a bit more; 80 is the minimum.</span>
          </p>

          <div class="row-actions">
            <button class="btn btn-ai" :disabled="tailoring || !aiReady || jobDescription.trim().length < 80"
                    @click="tailor(false)">
              {{ tailoring ? 'Tailoring your CV…' : '⚡ Make my CV suit this job' }}
            </button>
            <button class="btn btn-ghost" :disabled="tailoring || !aiReady || jobDescription.trim().length < 80"
                    @click="tailor(true)">
              Tailor into a separate CV
            </button>
            <span class="hint inline">Tailoring into a copy keeps this CV as your general one.</span>
          </div>
        </div>

        <div v-if="matchReport" class="card">
          <div class="card-head">
            <h3>Match report</h3>
            <span v-if="cv.job_target?.tailored_at" class="badge">
              tailored {{ formatDate(cv.job_target.tailored_at) }}
            </span>
          </div>

          <div class="match-top">
            <div class="review-score" :class="scoreClass(matchReport.score)">
              <span class="review-score-value">{{ matchReport.score ?? '—' }}</span>
              <span class="review-score-label">% match</span>
            </div>
            <div class="match-title">
              <h4>{{ matchReport.job_title || 'This role' }}</h4>
              <p v-if="matchReport.seniority">{{ matchReport.seniority }}</p>
            </div>
          </div>

          <div class="kw-groups">
            <div v-if="matchReport.matched_keywords?.length">
              <h4>Matched</h4>
              <div class="kws">
                <span v-for="(kw, i) in matchReport.matched_keywords" :key="i" class="kw good">{{ kw }}</span>
              </div>
            </div>
            <div v-if="matchReport.missing_keywords?.length">
              <h4>Not evidenced in your CV</h4>
              <div class="kws">
                <span v-for="(kw, i) in matchReport.missing_keywords" :key="i" class="kw bad">{{ kw }}</span>
              </div>
              <p class="hint">These were deliberately not added. If you do have the experience, put
                 it in the editor and tailor again.</p>
            </div>
          </div>

          <div class="review-cols">
            <div v-if="matchReport.strengths?.length">
              <h4>Why you fit</h4>
              <ul><li v-for="(item, i) in matchReport.strengths" :key="i">{{ item }}</li></ul>
            </div>
            <div v-if="matchReport.gaps?.length">
              <h4>Gaps</h4>
              <ul><li v-for="(item, i) in matchReport.gaps" :key="i">{{ item }}</li></ul>
            </div>
          </div>

          <div v-if="matchReport.actions?.length" class="review-ats">
            <h4>What to do about it</h4>
            <ul><li v-for="(item, i) in matchReport.actions" :key="i">{{ item }}</li></ul>
          </div>
          <div v-if="matchReport.ats_notes?.length" class="review-ats">
            <h4>ATS notes</h4>
            <ul><li v-for="(item, i) in matchReport.ats_notes" :key="i">{{ item }}</li></ul>
          </div>
        </div>
      </section>

      <!-- ══════════════════════ VOICE ══════════════════════ -->
      <section v-show="activeTab === 'voice'" class="cve-panel">
        <div class="card">
          <div class="card-head"><h3>Add to this CV by talking</h3></div>
          <p class="card-note">
            Dictate the experience you want on this CV. The AI rewrites the CV from what you say —
            so use this when you want to rebuild the content, not to add a single line.
            <strong>Your current content will be replaced</strong>, or use “as a new CV” to keep it.
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
              Replace this CV's content
            </button>
          </div>
        </div>
      </section>

      <!-- ══════════════════════ DESIGN ══════════════════════ -->
      <section v-show="activeTab === 'design'" class="cve-panel">
        <div class="card">
          <div class="card-head"><h3>Template</h3></div>
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
              <em v-if="tpl.ats_safe" class="ats">ATS-safe</em>
            </button>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3>Colour & type</h3></div>
          <div class="swatches">
            <button v-for="accent in accents" :key="accent.value"
                    :class="['swatch', { active: cv.accent_color === accent.value }]"
                    :style="{ background: accent.value }" :title="accent.name"
                    @click="setAccent(accent.value)"></button>
            <button class="swatch reset" :class="{ active: !cv.accent_color }"
                    title="Use the template's own colour" @click="setAccent('')">auto</button>
            <label class="swatch-custom">
              <input type="color" :value="cv.accent_color || currentSpec?.accent || '#4F46E5'"
                     @input="setAccent(($event.target as HTMLInputElement).value.toUpperCase())" />
              custom
            </label>
          </div>
          <div class="grid-2">
            <label class="field"><span>Font</span>
              <select v-model="cv.font" @change="markDirty">
                <option v-for="font in fonts" :key="font.key" :value="font.key">{{ font.name }}</option>
              </select>
            </label>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3>Profile picture</h3></div>
          <p class="card-note">
            Optional. Some markets expect a photo, others screen it out — if you are unsure, leave
            the avatar or turn the photo off. Pick a default avatar and it is used in the PDF and
            DOCX exactly as you see it here.
          </p>

          <div class="photo-row">
            <div class="photo-current" :class="`shape-${cv.photo.shape}`">
              <img v-if="photoPreview" :src="photoPreview" alt="" />
              <span v-else>none</span>
            </div>

            <div class="photo-controls">
              <label class="btn btn-secondary btn-sm photo-upload">
                {{ photoBusy ? 'Uploading…' : 'Upload a photo' }}
                <input type="file" accept="image/png,image/jpeg,image/webp" :disabled="photoBusy"
                       @change="onPhotoPicked" />
              </label>
              <button v-if="cv.photo.data_url" class="btn btn-ghost btn-sm" @click="clearPhoto">
                Remove photo
              </button>

              <div class="avatar-picker">
                <span class="avatar-label">Or use a default avatar</span>
                <div class="avatars">
                  <button v-for="avatar in avatars" :key="avatar.key"
                          :class="['avatar-option', { active: !cv.photo.data_url && cv.photo.avatar === avatar.key }]"
                          :title="avatar.label" @click="pickAvatar(avatar.key)">
                    <img :src="avatar.data_url" :alt="avatar.label" />
                  </button>
                </div>
              </div>

              <div class="photo-flags">
                <label class="field inline-field"><span>Shape</span>
                  <select v-model="cv.photo.shape" @change="markDirty">
                    <option value="circle">Circle</option>
                    <option value="rounded">Rounded</option>
                    <option value="square">Square</option>
                  </select>
                </label>
                <label class="check">
                  <input type="checkbox" v-model="cv.photo.show" @change="markDirty" />
                  Show a picture on the CV
                </label>
              </div>
              <p v-if="photoError" class="path-error">{{ photoError }}</p>
              <p v-if="currentSpec?.photo === 'none'" class="hint">
                The {{ currentSpec.name }} template never prints a picture — pick another template
                if you want one shown.
              </p>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3>Sections</h3></div>
          <p class="card-note">Drag-free ordering: move a section up or down, or hide it. Hidden
             sections keep their content — they just do not print.</p>
          <ul class="section-order">
            <li v-for="(key, i) in cv.sections_order" :key="key"
                :class="{ hidden: cv.hidden_sections.includes(key), empty: !hasContent(key) }">
              <span class="so-name">{{ sectionTitles[key] || key }}</span>
              <span v-if="!hasContent(key)" class="so-empty">empty</span>
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
            <button class="btn btn-primary btn-sm" :disabled="!!downloading" @click="downloadCv('pdf')">
              {{ downloading === 'pdf' ? 'Building…' : 'Download PDF' }}
            </button>
            <button class="btn btn-secondary btn-sm" :disabled="!!downloading" @click="downloadCv('docx')">
              {{ downloading === 'docx' ? 'Building…' : 'Download DOCX' }}
            </button>
          </div>
        </div>
        <p class="hint preview-hint">
          The download is rendered on the server from this same template, so the file matches what
          you see here. Unsaved edits are included in the download.
        </p>
        <CvPreview :cv="cv" :spec="currentSpec" :section-titles="sectionTitles" :avatars="avatars" />
      </section>

      <!-- Sticky preview beside the editor on wide screens -->
      <aside v-if="showSplitPreview" class="cve-side-preview">
        <CvPreview :cv="cv" :spec="currentSpec" :section-titles="sectionTitles" :avatars="avatars" />
      </aside>
    </div>

    <div v-if="toast" class="toast" :class="toastType">{{ toast }}</div>
  </div>

  <div v-else class="cve-loading">
    <p v-if="loadError" class="load-error">{{ loadError }}</p>
    <p v-else>Loading your CV…</p>
    <button v-if="loadError" class="btn btn-ghost" @click="goBack">Back to my CVs</button>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import CvPreview from '@/components/cvbuilder/CvPreview.vue';
import CvVoiceRecorder from '@/components/cvbuilder/CvVoiceRecorder.vue';
import {
  blankEntry, cvBuilderService, downscaleImage,
  type AvatarOption, type CvRecord, type CvSectionKey, type CvTemplate,
  type CvReview, type ExportFormat, type MatchReport,
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
const tailoring = ref(false);

const voiceTranscript = ref('');
const voiceNotes = ref('');
const voiceBusy = ref(false);

const photoBusy = ref(false);
const photoError = ref('');

const windowWide = ref(window.innerWidth >= 1380);

const currentSpec = computed<CvTemplate | null>(() =>
  templates.value.find(t => t.key === cv.value?.template) || templates.value[0] || null);

const matchReport = computed<MatchReport | null>(() =>
  (cv.value?.job_target?.match_report as MatchReport) || null);

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
  tailoring.value = true;
  try {
    const result = await cvBuilderService.tailorToJob(userId.value, {
      cv_id: cv.value!.id,
      job_description: jobDescription.value,
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
    const score = result.match_report?.score;
    showToast(score != null
      ? `Tailored — the AI rates this a ${score}% match. Check the gaps it listed.`
      : 'CV tailored to that job description.');
  } catch (e: any) {
    showToast(e?.message || 'The CV could not be tailored.', 'error');
  } finally {
    tailoring.value = false;
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

async function onPhotoPicked(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  photoError.value = '';
  photoBusy.value = true;
  try {
    // Downscale first: a phone photo is several MB, and it is embedded in the CV
    // record, so every later read of that CV would carry it.
    const resized = await downscaleImage(file);
    const upload = new File([resized], file.name, { type: resized.type });
    const result = await cvBuilderService.uploadPhoto(userId.value, upload);
    cv.value!.photo.data_url = result.data_url;
    cv.value!.photo.repo_path = result.repo_path;
    cv.value!.photo.filename = result.filename;
    cv.value!.photo.show = true;
    markDirty();
    await save('Profile photo updated');
    showToast('Photo added.');
  } catch (e: any) {
    photoError.value = e?.message || 'That photo could not be uploaded.';
  } finally {
    photoBusy.value = false;
    input.value = '';
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
async function downloadCv(format: ExportFormat) {
  downloading.value = format;
  try {
    // Send the in-memory record so the file includes edits the user can see but
    // has not saved - anything else would download a document they did not expect.
    const { blob, filename } = await cvBuilderService.download(
      userId.value, cv.value!.id, format, { cv: cv.value! });
    cvBuilderService.saveBlob(blob, filename);
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
.cve { padding: 18px 22px 60px; max-width: 1700px; margin: 0 auto; color: #fff; }
.cve-loading {
  min-height: 60vh; display: grid; place-content: center; gap: 14px;
  color: rgba(255, 255, 255, 0.6); text-align: center;
}
.load-error { color: #fca5a5; max-width: 460px; }

/* ── Header ─────────────────────────────────────────────────── */
.cve-head {
  display: flex; justify-content: space-between; align-items: flex-start;
  gap: 16px; flex-wrap: wrap; margin-bottom: 14px;
}
.cve-head-left { display: flex; gap: 12px; align-items: flex-start; flex: 1 1 320px; min-width: 0; }
.cve-title-wrap { min-width: 0; flex: 1; }
.cve-title {
  background: transparent; border: none; border-bottom: 1px solid transparent;
  color: #fff; font-size: 1.32rem; font-weight: 650; padding: 2px 0; width: 100%;
  font-family: inherit;
}
.cve-title:hover { border-bottom-color: rgba(255, 255, 255, 0.18); }
.cve-title:focus { outline: none; border-bottom-color: rgba(102, 126, 234, 0.8); }

.cve-sub {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  color: rgba(255, 255, 255, 0.52); font-size: 0.8rem; margin-top: 5px;
}
.meter {
  width: 90px; height: 5px; border-radius: 3px;
  background: rgba(255, 255, 255, 0.12); overflow: hidden; display: inline-block;
}
.meter-fill { display: block; height: 100%; background: linear-gradient(90deg, #667eea, #a855f7); }
.pill {
  background: rgba(102, 126, 234, 0.2); color: #c7d2fe;
  padding: 1px 9px; border-radius: 20px; font-size: 0.74rem;
}
.save-state { font-size: 0.75rem; }
.save-state.dirty { color: #fcd34d; }
.save-state.saving { color: #93c5fd; }
.save-state.saved { color: rgba(134, 239, 172, 0.85); }

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
.btn-primary { background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; }
.btn-secondary { background: rgba(102, 126, 234, 0.2); color: #c7d2fe; border: 1px solid rgba(102, 126, 234, 0.45); }
.btn-ghost { background: rgba(255, 255, 255, 0.07); color: rgba(255, 255, 255, 0.85); border: 1px solid rgba(255, 255, 255, 0.14); }
.btn-ai { background: linear-gradient(135deg, #a855f7, #ec4899); color: #fff; }

.icon-btn {
  background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 255, 255, 0.14);
  color: rgba(255, 255, 255, 0.8); width: 34px; height: 34px; border-radius: 9px;
  display: grid; place-items: center; cursor: pointer; font-size: 0.9rem;
}
.icon-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.13); }
.icon-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.icon-btn.sm { width: 26px; height: 26px; border-radius: 7px; font-size: 0.78rem; }
.icon-btn.danger { color: #fca5a5; border-color: rgba(239, 68, 68, 0.35); }

/* ── Banner ─────────────────────────────────────────────────── */
.cve-banner {
  padding: 11px 15px; border-radius: 10px; font-size: 0.86rem; margin-bottom: 14px;
  display: flex; align-items: center; gap: 12px;
}
.cve-banner.info { background: rgba(59, 130, 246, 0.12); border: 1px solid rgba(59, 130, 246, 0.32); color: #bfdbfe; }
.cve-banner.warn { background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.32); color: #fcd34d; }
.cve-banner.error { background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.32); color: #fca5a5; }
.banner-x {
  margin-left: auto; background: none; border: none; color: inherit;
  font-size: 1.2rem; cursor: pointer; line-height: 1;
}

/* ── Tabs ───────────────────────────────────────────────────── */
.cve-tabs {
  display: flex; gap: 5px; overflow-x: auto; padding-bottom: 3px; margin-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.09);
}
.cve-tab {
  display: inline-flex; align-items: center; gap: 7px; white-space: nowrap;
  background: transparent; border: none; border-bottom: 2px solid transparent;
  color: rgba(255, 255, 255, 0.55); padding: 10px 14px; font-size: 0.87rem;
  font-weight: 600; cursor: pointer; font-family: inherit;
}
.cve-tab:hover { color: rgba(255, 255, 255, 0.85); }
.cve-tab.active { color: #fff; border-bottom-color: #8b5cf6; }
.cve-tab-icon { display: inline-flex; }

/* ── Layout ─────────────────────────────────────────────────── */
.cve-body.split { display: grid; grid-template-columns: minmax(0, 1fr) 620px; gap: 20px; align-items: start; }
.cve-side-preview { position: sticky; top: 16px; max-height: calc(100vh - 40px); overflow: auto; }
.cve-panel { min-width: 0; }

/* ── Cards & fields ─────────────────────────────────────────── */
.card {
  background: rgba(255, 255, 255, 0.042); border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 13px; padding: 17px 18px; margin-bottom: 15px;
}
.card.warn-card { border-color: rgba(245, 158, 11, 0.35); background: rgba(245, 158, 11, 0.07); }
.card.warn-card h3 { color: #fcd34d; }
.card-head {
  display: flex; justify-content: space-between; align-items: center;
  gap: 12px; flex-wrap: wrap; margin-bottom: 13px;
}
.card-head h3 { font-size: 1.02rem; font-weight: 650; }
.card-head-actions { display: flex; gap: 7px; flex-wrap: wrap; }
.card-note { color: rgba(255, 255, 255, 0.6); font-size: 0.85rem; line-height: 1.58; margin-bottom: 14px; }
.card-note strong { color: #fcd34d; }
.badge {
  font-size: 0.72rem; background: rgba(255, 255, 255, 0.1); padding: 1px 8px;
  border-radius: 20px; color: rgba(255, 255, 255, 0.65); margin-left: 6px;
}

.grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 11px; }
.grid-2.gap { gap: 15px; align-items: start; }
.grid-3 { display: grid; grid-template-columns: 1fr 1fr 0.7fr auto; gap: 9px; align-items: end; }
.grid-skill { display: grid; grid-template-columns: 0.7fr 2fr auto; gap: 9px; align-items: end; }
.row-gap { margin-bottom: 9px; }

.field { display: block; }
.field > span {
  display: block; color: rgba(255, 255, 255, 0.62); font-size: 0.76rem;
  font-weight: 600; margin-bottom: 5px;
}
.field input, .field textarea, .field select, .jd, textarea {
  width: 100%; background: rgba(0, 0, 0, 0.28); border: 1px solid rgba(255, 255, 255, 0.13);
  border-radius: 9px; color: #fff; padding: 9px 11px; font-size: 0.87rem;
  font-family: inherit; line-height: 1.5; resize: vertical;
}
.field input:focus, .field textarea:focus, .field select:focus, .jd:focus, textarea:focus {
  outline: none; border-color: rgba(102, 126, 234, 0.7);
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.14);
}
.field input:disabled { opacity: 0.5; }
.field select option { background: #141428; }
.inline-field { max-width: 160px; }
.date-row { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }

.check {
  display: inline-flex; align-items: center; gap: 8px; margin: 9px 0;
  color: rgba(255, 255, 255, 0.72); font-size: 0.84rem; cursor: pointer;
}
.check input { width: 16px; height: 16px; accent-color: #8b5cf6; }

.hint { color: rgba(255, 255, 255, 0.42); font-size: 0.78rem; margin-top: 6px; line-height: 1.5; }
.hint.inline { margin-top: 0; flex: 1 1 200px; }
.empty-note { color: rgba(255, 255, 255, 0.42); font-size: 0.84rem; }
.row-actions { display: flex; gap: 9px; align-items: center; flex-wrap: wrap; margin-top: 13px; }

.entry {
  border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 11px;
  padding: 13px; margin-bottom: 11px; background: rgba(0, 0, 0, 0.14);
}
.entry-tight { padding: 11px 13px; }
.entry-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 9px; }
.entry-index {
  width: 22px; height: 22px; border-radius: 50%; background: rgba(139, 92, 246, 0.22);
  color: #ddd6fe; font-size: 0.74rem; display: grid; place-items: center; font-weight: 700;
}
.entry-move { display: flex; gap: 5px; }
.entry .field { margin-top: 9px; }

.sub-head {
  display: flex; justify-content: space-between; align-items: center;
  margin: 18px 0 9px; padding-top: 13px; border-top: 1px solid rgba(255, 255, 255, 0.07);
}
.sub-head h4 { font-size: 0.9rem; font-weight: 650; }

/* ── Review / match ─────────────────────────────────────────── */
.review { margin-top: 16px; padding-top: 15px; border-top: 1px solid rgba(255, 255, 255, 0.08); }
.review-score {
  display: inline-flex; align-items: baseline; gap: 4px; padding: 7px 15px;
  border-radius: 11px; font-weight: 700;
}
.review-score.good { background: rgba(34, 197, 94, 0.16); color: #86efac; }
.review-score.mid { background: rgba(245, 158, 11, 0.16); color: #fcd34d; }
.review-score.low { background: rgba(239, 68, 68, 0.16); color: #fca5a5; }
.review-score-value { font-size: 1.7rem; line-height: 1; }
.review-score-label { font-size: 0.8rem; opacity: 0.8; }
.review-verdict { margin-top: 11px; font-size: 0.95rem; line-height: 1.55; color: rgba(255, 255, 255, 0.88); }

.review-cols {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px; margin-top: 16px;
}
.review-cols h4, .review-issues h4, .review-ats h4, .kw-groups h4 {
  font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.5); margin-bottom: 7px;
}
.review-cols ul, .review-ats ul, .notes {
  padding-left: 17px; color: rgba(255, 255, 255, 0.78); font-size: 0.86rem; line-height: 1.6;
}
.review-cols li, .review-ats li, .notes li { margin-bottom: 4px; }

.review-issues { margin-top: 16px; }
.review-issue {
  border-left: 2px solid rgba(245, 158, 11, 0.55); padding: 3px 0 3px 11px; margin-bottom: 11px;
}
.review-issue-section {
  font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em;
  color: #fcd34d; font-weight: 700;
}
.review-issue-problem { font-size: 0.87rem; color: rgba(255, 255, 255, 0.85); margin-top: 2px; }
.review-issue-fix { font-size: 0.85rem; color: #a5b4fc; margin-top: 2px; }
.review-ats { margin-top: 16px; }

.match-top { display: flex; align-items: center; gap: 15px; flex-wrap: wrap; margin-bottom: 16px; }
.match-title h4 { font-size: 1.02rem; font-weight: 650; }
.match-title p { color: rgba(255, 255, 255, 0.55); font-size: 0.84rem; }

.kw-groups { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
.kws { display: flex; flex-wrap: wrap; gap: 6px; }
.kw { font-size: 0.76rem; padding: 3px 9px; border-radius: 20px; }
.kw.good { background: rgba(34, 197, 94, 0.15); color: #86efac; }
.kw.bad { background: rgba(239, 68, 68, 0.13); color: #fca5a5; }

/* ── Template picker ────────────────────────────────────────── */
.tpl-picker { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 11px; }
.tpl-option {
  background: rgba(0, 0, 0, 0.2); border: 1.5px solid rgba(255, 255, 255, 0.1);
  border-radius: 11px; padding: 10px; cursor: pointer; text-align: left;
  color: #fff; font-family: inherit; transition: border-color 0.15s ease, transform 0.15s ease;
}
.tpl-option:hover { transform: translateY(-2px); border-color: rgba(139, 92, 246, 0.5); }
.tpl-option.active { border-color: #8b5cf6; box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.18); }
.tpl-option strong { display: block; font-size: 0.87rem; margin-bottom: 2px; }
.tpl-option small { display: block; color: rgba(255, 255, 255, 0.45); font-size: 0.72rem; line-height: 1.4; }
.tpl-option .ats {
  display: inline-block; margin-top: 5px; font-size: 0.66rem; font-style: normal;
  background: rgba(34, 197, 94, 0.16); color: #86efac; padding: 1px 7px; border-radius: 20px;
}
.tpl-mini {
  position: relative; display: block; height: 62px; background: #fff;
  border-radius: 5px; overflow: hidden; margin-bottom: 8px;
}
.tpl-mini .band { position: absolute; background: var(--tpl-accent); }
.tpl-mini.tpl-banner .band { top: 0; left: 0; right: 0; height: 17px; }
.tpl-mini.tpl-sidebar .band { top: 0; bottom: 0; left: 0; width: 34%; }
.tpl-mini.tpl-single .band { top: 8px; left: 8px; width: 46%; height: 3px; border-radius: 2px; }
.tpl-mini .l { position: absolute; height: 3px; border-radius: 2px; background: #d8dbe3; }
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
  cursor: pointer; color: #fff; font-size: 0.62rem; font-family: inherit;
}
.swatch.active { border-color: #fff; box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.16); }
.swatch.reset { background: rgba(255, 255, 255, 0.1); color: rgba(255, 255, 255, 0.7); }
.swatch-custom {
  display: inline-flex; flex-direction: column; align-items: center; gap: 2px;
  font-size: 0.62rem; color: rgba(255, 255, 255, 0.55); cursor: pointer;
}
.swatch-custom input { width: 34px; height: 30px; border: none; background: none; padding: 0; cursor: pointer; }

/* ── Photo ──────────────────────────────────────────────────── */
.photo-row { display: flex; gap: 18px; flex-wrap: wrap; align-items: flex-start; }
.photo-current {
  width: 104px; height: 104px; flex: 0 0 auto; overflow: hidden;
  background: rgba(255, 255, 255, 0.07); display: grid; place-items: center;
  color: rgba(255, 255, 255, 0.35); font-size: 0.76rem;
}
.photo-current.shape-circle { border-radius: 50%; }
.photo-current.shape-rounded { border-radius: 16px; }
.photo-current.shape-square { border-radius: 3px; }
.photo-current img { width: 100%; height: 100%; object-fit: cover; }
.photo-controls { flex: 1 1 260px; display: flex; flex-direction: column; gap: 11px; }
.photo-upload { position: relative; overflow: hidden; align-self: flex-start; }
.photo-upload input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.avatar-label { display: block; color: rgba(255, 255, 255, 0.62); font-size: 0.76rem; font-weight: 600; margin-bottom: 6px; }
.avatars { display: flex; gap: 8px; }
.avatar-option {
  width: 52px; height: 52px; border-radius: 50%; overflow: hidden; padding: 0;
  border: 2px solid rgba(255, 255, 255, 0.14); background: none; cursor: pointer;
}
.avatar-option.active { border-color: #8b5cf6; box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2); }
.avatar-option img { width: 100%; height: 100%; object-fit: cover; display: block; }
.photo-flags { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
.path-error { color: #fca5a5; font-size: 0.83rem; line-height: 1.5; }

/* ── Section order ──────────────────────────────────────────── */
.section-order { list-style: none; }
.section-order li {
  display: flex; align-items: center; gap: 10px; padding: 8px 11px;
  border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 9px; margin-bottom: 6px;
  background: rgba(0, 0, 0, 0.16); font-size: 0.86rem;
}
.section-order li.hidden { opacity: 0.45; }
.section-order li.empty .so-name { color: rgba(255, 255, 255, 0.45); }
.so-name { flex: 1; }
.so-empty { font-size: 0.7rem; color: rgba(255, 255, 255, 0.35); }
.so-actions { display: flex; gap: 5px; }

/* ── Preview tab ────────────────────────────────────────────── */
.preview-bar {
  display: flex; justify-content: space-between; align-items: center;
  gap: 14px; flex-wrap: wrap; margin-bottom: 6px;
}
.preview-bar-left strong { font-size: 0.98rem; }
.preview-bar-left span { color: rgba(255, 255, 255, 0.5); font-size: 0.83rem; margin-left: 9px; }
.preview-bar-actions { display: flex; gap: 8px; }
.preview-hint { margin-bottom: 14px; }

/* ── Toast ──────────────────────────────────────────────────── */
.toast {
  position: fixed; bottom: 22px; left: 50%; transform: translateX(-50%);
  padding: 12px 20px; border-radius: 10px; font-size: 0.87rem; z-index: 950;
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.45); max-width: 90vw; text-align: center;
}
.toast.success { background: #16a34a; color: #fff; }
.toast.error { background: #dc2626; color: #fff; }

@media (max-width: 900px) {
  .cve { padding: 14px 13px 50px; }
  .grid-3, .grid-skill { grid-template-columns: 1fr; }
  .grid-3 .icon-btn, .grid-skill .icon-btn { justify-self: end; }
}
</style>
