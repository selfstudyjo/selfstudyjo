<template>
  <div class="home-container">
    <!-- =====================================================================
         Welcome banner.

         Three things live here rather than being scattered down the page: who
         you are, how you are doing, and where you might go next. The score ring
         is on the banner because it is the one number a learner opens this page
         to see, and burying it in the fifth card is what made the old dashboard
         read as five lists rather than as a dashboard.
         ===================================================================== -->
    <header class="welcome-header glass-effect">
      <div class="header-content">
        <p class="hero-eyebrow">{{ $t('Your learning dashboard') }}</p>
        <h1>{{ $t('Welcome back, {v0}!', { v0: username }) }}</h1>
        <p class="subtitle">{{ $t('Track your learning progress and achievements') }}</p>

        <!--
          A <nav> with a name, not a row of divs: on a screen reader this is a
          landmark somebody can jump to, and it is the fastest route out of the
          dashboard to the four things it talks about. All four routes are
          reachable by any signed-in user — none of them carries
          `requiredFeatures` — so none of these can be a button that goes
          nowhere, which is the rule the sidebar follows for the same reason.
        -->
        <nav class="hero-actions" :aria-label="$t('Quick actions')">
          <router-link to="/courses" class="sfs-btn sfs-btn--primary sfs-btn--sm">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path :d="ICONS.book" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            {{ $t('Browse Courses') }}
          </router-link>
          <router-link to="/exams" class="sfs-btn sfs-btn--secondary sfs-btn--sm">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path :d="ICONS.check" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            {{ $t('Exams') }}
          </router-link>
          <router-link to="/leaderboard" class="sfs-btn sfs-btn--secondary sfs-btn--sm">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path :d="ICONS.crown" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            {{ $t('Leaderboard') }}
          </router-link>
          <router-link to="/certificates" class="sfs-btn sfs-btn--ghost sfs-btn--sm">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path :d="ICONS.award" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            {{ $t('My Certificates') }}
          </router-link>
        </nav>
      </div>

      <!--
        The score ring.

        `role="img"` with a full sentence for its label, because the ring itself
        is a conic gradient and a screen reader has nothing else to go on — and
        the number inside it is a fragment ("82%") that says nothing about what
        was measured. The visible number is aria-hidden so the two are not read
        one after the other.

        `--ring-value` is the only thing bound; everything else about the ring
        is CSS. See home.css for why it is a gradient and a mask rather than an
        SVG circle.
      -->
      <div class="hero-score">
        <div
          class="score-ring"
          :class="ringBand"
          :style="{ '--ring-value': ringPercent }"
          role="img"
          :aria-label="ringAria"
        >
          <div class="score-ring__face" aria-hidden="true">
            <span class="score-ring__value sfs-nums">{{ ringText }}</span>
            <span v-if="summary.averageScore !== null" class="score-ring__unit">%</span>
          </div>
        </div>
        <p class="hero-score__caption">
          {{ summary.averageScore === null ? $t('Take your first quiz') : $t('Average quiz score') }}
        </p>
      </div>
    </header>

    <!-- =====================================================================
         At a glance.

         Four counts, and every one of them is a fact the records support. There
         is deliberately no "streak", no "hours studied" and no "% of course
         complete": this platform records none of the three, and a tile that
         invents one is a tile a learner will eventually catch out.
         ===================================================================== -->
    <section class="stats-row" :aria-label="$t('Your learning at a glance')">
      <div v-for="tile in tiles" :key="tile.id" class="stat-tile glass-effect">
        <span class="stat-tile__icon" :class="`is-${tile.id}`" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path :d="ICONS[tile.icon]" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span class="stat-tile__value sfs-nums">{{ tile.value }}</span>
        <span class="stat-tile__label">{{ tile.label }}</span>
      </div>
    </section>

    <!-- =====================================================================
         Achievements.

         Locked badges are SHOWN, with what each one needs. A row that only
         shows what somebody has already earned tells a learner on their first
         day nothing at all and reads as a broken feature — showing the locked
         ones is the whole reason the row is motivating. Nothing here is awarded
         for merely turning up; the first badge needs an enrolment.
         ===================================================================== -->
    <section class="achievements glass-effect">
      <div class="achievements__head">
        <h2 class="achievements__title">{{ $t('Achievements') }}</h2>
        <span class="sfs-chip sfs-chip--accent sfs-nums">
          {{ $t('{v0} of {v1} earned', { v0: earnedBadges, v1: badgeList.length }) }}
        </span>
      </div>
      <ul class="badge-row">
        <li
          v-for="badge in badgeList"
          :key="badge.id"
          class="badge-card"
          :class="[`is-${badge.tier}`, badge.earned ? 'is-earned' : 'is-locked']"
        >
          <span class="badge-card__medal" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path :d="ICONS[badge.icon]" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <span class="badge-card__name">{{ badgeName(badge.id) }}</span>
          <!--
            The requirement, always — on an earned badge it is the reason it was
            earned, which is what makes the row readable rather than a set of
            names nobody can interpret.
          -->
          <span class="badge-card__note">{{ badgeNote(badge.id) }}</span>
          <span class="sfs-sr-only">{{ badge.earned ? $t('Earned') : $t('Not earned yet') }}</span>
        </li>
      </ul>
    </section>

    <!-- Main Content Grid -->
    <div class="main-grid">
      <!-- ===================================================================
           Progress.

           Labelled "quiz performance", never "course completion", and the
           footnote says so. There is no lesson-completion record anywhere on
           this platform — app 19 stores a course, its lessons, its homeworks
           and a registration, and nothing that says a person has READ a lesson
           — so a completion percentage would be a number that moves for reasons
           the learner cannot see and stalls partway through a course whose
           remaining lessons have no quiz. See dashboardProgress.ts.
           =================================================================== -->
      <div class="dashboard-card card--progress glass-effect">
        <div class="card-header">
          <div class="card-title">
            <div class="title-icon progress-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path :d="ICONS.chart" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <h2>{{ $t('Your progress') }}</h2>
            <span class="card-count sfs-nums">{{ summary.quizzesTaken }}</span>
          </div>
          <p class="card-subtitle">{{ $t('Measured from your quiz results — one attempt per quiz, your best') }}</p>
        </div>

        <div class="progress-body">
          <div v-if="loading.quizResults || loading.courses" class="loading-placeholder">
            <div class="placeholder-item"></div>
            <div class="placeholder-item"></div>
          </div>

          <template v-else>
            <!-- The three headline rates. A null renders as an em dash and an
                 empty track, never as 0% — "you scored nothing" is a different
                 statement from "you have not started". -->
            <div class="rate-row">
              <div v-for="rate in rates" :key="rate.id" class="rate">
                <div class="rate__head">
                  <span class="rate__label">{{ rate.label }}</span>
                  <span class="rate__value sfs-nums">{{ rate.value === null ? '—' : rate.value + '%' }}</span>
                </div>
                <div
                  class="sfs-meter"
                  :style="{ '--meter-fill': meterWidth(rate.value) }"
                  role="progressbar"
                  :aria-valuenow="rate.value ?? 0"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  :aria-label="rate.label"
                >
                  <div class="sfs-meter__fill" :class="rate.fill"></div>
                </div>
              </div>
            </div>

            <!-- Per course. Every REGISTERED course appears, including the ones
                 with no attempts — a learner's newest enrolment is exactly the
                 one with nothing in it, and dropping it would also make this
                 list disagree with the Courses tile above. -->
            <h3 class="progress-subhead">{{ $t('By course') }}</h3>
            <div v-if="courseRows.length === 0" class="empty-state small">
              <p class="empty-text">{{ $t('No courses enrolled yet') }}</p>
              <router-link to="/courses" class="empty-action">{{ $t('Browse Courses') }}</router-link>
            </div>
            <ul v-else class="course-progress-list">
              <li v-for="row in courseRows" :key="row.courseId" class="course-progress">
                <div class="course-progress__head">
                  <span class="course-progress__name">{{ courseTitleFor(row.courseId) }}</span>
                  <span class="course-progress__count sfs-nums">
                    {{ row.quizzesTaken === 0
                      ? $t('No quizzes yet')
                      : $t('{v0} of {v1} passed', { v0: row.quizzesPassed, v1: row.quizzesTaken }) }}
                  </span>
                </div>
                <div
                  class="sfs-meter"
                  :style="{ '--meter-fill': meterWidth(row.passRate) }"
                  role="progressbar"
                  :aria-valuenow="row.passRate ?? 0"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  :aria-label="courseTitleFor(row.courseId)"
                >
                  <div class="sfs-meter__fill" :class="fillFor(row.passRate)"></div>
                </div>
              </li>
            </ul>
          </template>
        </div>
      </div>

      <!-- Registered Courses Section -->
      <div class="dashboard-card card--courses glass-effect">
        <div class="card-header">
          <div class="card-title">
            <div class="title-icon course-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7L12 12L22 7L12 2ZM2 17L12 22L22 17M2 12L12 17L22 12" stroke="currentColor" stroke-width="2"/>
              </svg>
            </div>
            <h2>{{ $t('My Courses') }}</h2>
            <span class="card-count">{{ registeredCoursesCount }}</span>
          </div>
          <p class="card-subtitle">{{ $t('Courses you\'re currently enrolled in') }}</p>
        </div>
        
        <div class="courses-list">
          <div v-if="loading.courses" class="loading-placeholder">
            <div class="placeholder-item"></div>
            <div class="placeholder-item"></div>
            <div class="placeholder-item"></div>
          </div>
          <div v-else-if="registeredCourses.length === 0" class="empty-state">
            <div class="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7L12 12L22 7L12 2ZM2 17L12 22L22 17M2 12L12 17L22 12" stroke="#94A3B8" stroke-width="1.5"/>
              </svg>
            </div>
            <p class="empty-text">{{ $t('No courses enrolled yet') }}</p>
            <router-link to="/courses" class="empty-action">{{ $t('Browse Courses') }}</router-link>
          </div>
          <div v-else>
            <router-link 
              v-for="course in registeredCourses" 
              :key="course.course_external_id" 
              :to="`/course/${course.course_external_id || course.course}`"
              class="course-item-link"
            >
              <div class="course-item">
                <div class="course-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L2 7L12 12L22 7L12 2ZM2 17L12 22L22 17M2 12L12 17L22 12" stroke="currentColor" stroke-width="2"/>
                  </svg>
                </div>
                <div class="course-info">
                  <h3 class="course-title">{{ courseTitleFor(course.course_external_id || course.course) }}</h3>
                  <p class="course-date">{{ $t('Registered: {v0}', { v0: formatDate(course.date_registered) }) }}</p>
                </div>
                <div class="course-arrow">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
              </div>
            </router-link>
          </div>
        </div>
      </div>

      <!-- Certificates Section -->
      <div class="dashboard-card card--certificates glass-effect">
        <div class="card-header">
          <div class="card-title">
            <div class="title-icon certificate-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M9 12L11 14L15 10M12 2C13.3132 2 14.6136 2.25866 15.8268 2.7612C17.0401 3.26375 18.1425 4.00035 19.0711 4.92893C19.9997 5.85752 20.7362 6.95991 21.2388 8.17317C21.7413 9.38642 22 10.6868 22 12C22 13.3132 21.7413 14.6136 21.2388 15.8268C20.7362 17.0401 19.9997 18.1425 19.0711 19.0711C18.1425 19.9997 17.0401 20.7362 15.8268 21.2388C14.6136 21.7413 13.3132 22 12 22C10.6868 22 9.38642 21.7413 8.17317 21.2388C6.95991 20.7362 5.85752 19.9997 4.92893 19.0711C4.00035 18.1425 3.26375 17.0401 2.7612 15.8268C2.25866 14.6136 2 13.3132 2 12C2 9.34784 3.05357 6.8043 4.92893 4.92893C6.8043 3.05357 9.34784 2 12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <h2>{{ $t('Certificates') }}</h2>
            <span class="card-count">{{ totalCertificatesCount }}</span>
          </div>
          <p class="card-subtitle">{{ $t('Your earned certificates') }}</p>
        </div>
        
        <div class="certificates-grid">
          <!-- Exam Certificates -->
          <div class="certificate-section">
            <h3 class="section-title">{{ $t('Exam Certificates') }}</h3>
            <div v-if="loading.examCertificates" class="loading-placeholder">
              <div class="placeholder-item small"></div>
              <div class="placeholder-item small"></div>
            </div>
            <div v-else-if="examCertificates.length === 0" class="empty-state small">
              <p class="empty-text">{{ $t('No exam certificates yet') }}</p>
            </div>
            <div v-else class="certificate-list">
              <router-link 
                v-for="cert in examCertificates.slice(0, 3)" 
                :key="cert.certificate_id" 
                :to="{
                  path: `/certificate/${cert.certificate_id}`,
                  query: { type: 'exam' }
                }"
                class="certificate-item-link"
              >
                <div class="certificate-item">
                  <div class="certificate-icon exam">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M9 12L11 14L15 10M12 2C13.3132 2 14.6136 2.25866 15.8268 2.7612C17.0401 3.26375 18.1425 4.00035 19.0711 4.92893C19.9997 5.85752 20.7362 6.95991 21.2388 8.17317C21.7413 9.38642 22 10.6868 22 12C22 13.3132 21.7413 14.6136 21.2388 15.8268C20.7362 17.0401 19.9997 18.1425 19.0711 19.0711C18.1425 19.9997 17.0401 20.7362 15.8268 21.2388C14.6136 21.7413 13.3132 22 12 22C10.6868 22 9.38642 21.7413 8.17317 21.2388C6.95991 20.7362 5.85752 19.9997 4.92893 19.0711C4.00035 18.1425 3.26375 17.0401 2.7612 15.8268C2.25866 14.6136 2 13.3132 2 12C2 9.34784 3.05357 6.8043 4.92893 4.92893C6.8043 3.05357 9.34784 2 12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="certificate-info">
                    <!-- `$td`, so an Arabic exam title shows on an Arabic page; then the
                         name the certificate itself carries; then a label. Never the
                         raw `exam_id`, which is a uuid and is not a title. -->
                    <h4 class="certificate-title">{{ $td(examCertificateDetails[cert.exam_id]) || cert.exam_name || $t('Exam Certificate') }}</h4>
                    <div class="certificate-meta">
                      <span class="certificate-date">{{ formatDate(cert.taken_date) }}</span>
                      <span class="certificate-status" :class="{ valid: cert.is_valid }">
                        {{ cert.is_valid ? $t('Valid') : $t('Expired') }}
                      </span>
                    </div>
                  </div>
                  <div class="certificate-arrow">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                </div>
              </router-link>
            </div>
          </div>

          <!-- Course Certificates -->
          <div class="certificate-section">
            <h3 class="section-title">{{ $t('Course Certificates') }}</h3>
            <div v-if="loading.courseCertificates" class="loading-placeholder">
              <div class="placeholder-item small"></div>
              <div class="placeholder-item small"></div>
            </div>
            <div v-else-if="courseCertificates.length === 0" class="empty-state small">
              <p class="empty-text">{{ $t('No course certificates yet') }}</p>
            </div>
            <div v-else class="certificate-list">
              <router-link 
                v-for="cert in courseCertificates.slice(0, 3)" 
                :key="cert.certificate_id" 
                :to="{
                  path: `/certificate/${cert.certificate_id}`,
                  query: { type: 'course' }
                }"
                class="certificate-item-link"
              >
                <div class="certificate-item">
                  <div class="certificate-icon course">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2L2 7L12 12L22 7L12 2ZM2 17L12 22L22 17M2 12L12 17L22 12" stroke="currentColor" stroke-width="2"/>
                    </svg>
                  </div>
                  <div class="certificate-info">
                    <h4 class="certificate-title">{{ $td(courseDetails[cert.course_id]) || cert.course_name || $t('Course Certificate') }}</h4>
                    <div class="certificate-meta">
                      <span class="certificate-date">{{ formatDate(cert.date) }}</span>
                      <!-- `42h` is not a unit anybody reads in Arabic or Chinese. -->
                      <span class="certificate-hours">{{ $t('{v0} hours', { v0: cert.hours }) }}</span>
                    </div>
                  </div>
                  <div class="certificate-arrow">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                </div>
              </router-link>
            </div>
          </div>
        </div>
      </div>

      <!-- Quiz Results Section -->
      <div class="dashboard-card card--quizzes glass-effect">
        <div class="card-header">
          <div class="card-title">
            <div class="title-icon quiz-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M8.5 12.5L10.5 14.5L15.5 9.5M12 3C13.1819 3 14.3522 3.23279 15.4442 3.68508C16.5361 4.13738 17.5282 4.80031 18.364 5.63604C19.1997 6.47177 19.8626 7.46392 20.3149 8.55585C20.7672 9.64778 21 10.8181 21 12C21 13.1819 20.7672 14.3522 20.3149 15.4442C19.8626 16.5361 19.1997 17.5282 18.364 18.364C17.5282 19.1997 16.5361 19.8626 15.4442 20.3149C14.3522 20.7672 13.1819 21 12 21C10.8181 21 9.64778 20.7672 8.55585 20.3149C7.46392 19.8626 6.47177 19.1997 5.63604 18.364C4.80031 17.5282 4.13738 16.5361 3.68508 15.4442C3.23279 14.3522 3 13.1819 3 12C3 9.61305 3.94821 7.32387 5.63604 5.63604C7.32387 3.94821 9.61305 3 12 3Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <h2>{{ $t('Quiz Results') }}</h2>
            <span class="card-count">{{ quizResults.length }}</span>
          </div>
          <p class="card-subtitle">{{ $t('Your recent quiz performance') }}</p>
        </div>
        
        <div class="quiz-results">
          <div v-if="loading.quizResults" class="loading-placeholder">
            <div class="placeholder-item"></div>
            <div class="placeholder-item"></div>
            <div class="placeholder-item"></div>
          </div>
          <div v-else-if="quizResults.length === 0" class="empty-state">
            <div class="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <path d="M8.5 12.5L10.5 14.5L15.5 9.5M12 3C13.1819 3 14.3522 3.23279 15.4442 3.68508C16.5361 4.13738 17.5282 4.80031 18.364 5.63604C19.1997 6.47177 19.8626 7.46392 20.3149 8.55585C20.7672 9.64778 21 10.8181 21 12C21 13.1819 20.7672 14.3522 20.3149 15.4442C19.8626 16.5361 19.1997 17.5282 18.364 18.364C17.5282 19.1997 16.5361 19.8626 15.4442 20.3149C14.3522 20.7672 13.1819 21 12 21C10.8181 21 9.64778 20.7672 8.55585 20.3149C7.46392 19.8626 6.47177 19.1997 5.63604 18.364C4.80031 17.5282 4.13738 16.5361 3.68508 15.4442C3.23279 14.3522 3 13.1819 3 12C3 9.61305 3.94821 7.32387 5.63604 5.63604C7.32387 3.94821 9.61305 3 12 3Z" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <p class="empty-text">{{ $t('No quiz results yet') }}</p>
          </div>
          <div v-else>
            <div v-for="quiz in quizResults.slice(0, 5)" :key="quiz.external_id" class="quiz-item">
              <div class="quiz-score" :class="getScoreClass(quiz.score)">
                <span class="score-value">{{ quiz.score }}%</span>
              </div>
              <div class="quiz-info">
                <h3 class="quiz-title">{{ quizDetails[quiz.quiz]?.quizTitle || $t('Untitled Quiz') }}</h3>
                <div class="quiz-meta">
                  <span class="quiz-course">{{ quizDetails[quiz.quiz]?.courseTitle || $t('Unknown Course') }}</span>
                  <span class="quiz-lesson">{{ quizDetails[quiz.quiz]?.lessonTitle || $t('Unknown Lesson') }}</span>
                </div>
                <div class="quiz-footer">
                  <span class="quiz-status" :class="{ passed: quiz.result_status === 'PASSED' }">
                    <!--
                      Spelled out rather than `$t(quiz.result_status)`. The type
                      is `'PASSED' | 'FAILED'`, so the dynamic form works — and
                      `check:i18n` scans for LITERAL keys, so it read `FAILED` as
                      a catalogue entry nothing asks for and would have gone on
                      doing so until somebody "tidied" it away. A key reached
                      through a variable is exempted only where the table it
                      comes from can be imported by the check; two branches is
                      cheaper than an exemption.
                    -->
                    {{ quiz.result_status === 'PASSED' ? $t('PASSED') : $t('FAILED') }}
                  </span>
                  <span class="quiz-date">{{ formatDate(quiz.date_taken) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Homeworks Section -->
      <div class="dashboard-card card--homeworks glass-effect">
        <div class="card-header">
          <div class="card-title">
            <div class="title-icon homework-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 14L12 20M9 21H15M19 13C19 15.2091 17.2091 17 15 17H9C6.79086 17 5 15.2091 5 13V7C5 4.79086 6.79086 3 9 3H15C17.2091 3 19 4.79086 19 7V13Z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            <h2>{{ $t('Assigned Homeworks') }}</h2>
            <span class="card-count">{{ totalHomeworksCount }}</span>
          </div>
          <p class="card-subtitle">{{ $t('Homework for your enrolled courses') }}</p>
        </div>
        
        <div class="homeworks-list">
          <div v-if="loading.homeworks" class="loading-placeholder">
            <div class="placeholder-item"></div>
            <div class="placeholder-item"></div>
            <div class="placeholder-item"></div>
          </div>
          <div v-else-if="homeworks.length === 0" class="empty-state">
            <div class="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <path d="M12 14L12 20M9 21H15M19 13C19 15.2091 17.2091 17 15 17H9C6.79086 17 5 15.2091 5 13V7C5 4.79086 6.79086 3 9 3H15C17.2091 3 19 4.79086 19 7V13Z" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </div>
            <p class="empty-text">{{ $t('No homeworks assigned') }}</p>
          </div>
          <div v-else>
            <router-link 
              v-for="homework in homeworks.slice(0, 5)" 
              :key="homework.external_homework_id" 
              :to="{
                path: `/course/${homework.course_external_id || 'unknown'}/lesson/${homework.lesson_external_id || 'unknown'}/homework`,
                query: { homeworkId: homework.external_homework_id }
              }"
              class="homework-item-link"
            >
              <div class="homework-item">
                <div class="homework-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M12 14L12 20M9 21H15M19 13C19 15.2091 17.2091 17 15 17H9C6.79086 17 5 15.2091 5 13V7C5 4.79086 6.79086 3 9 3H15C17.2091 3 19 4.79086 19 7V13Z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </div>
                <div class="homework-info">
                  <h3 class="homework-title">{{ $td(homework) || $t('Untitled Homework') }}</h3>
                  <p class="homework-description">{{ truncateText(homework.description, 60) }}</p>
                  <div class="homework-meta">
                    <span class="homework-course">{{ homeworkDetails[homework.external_homework_id]?.courseTitle || $t('Unknown Course') }}</span>
                    <span class="homework-lesson">{{ homeworkDetails[homework.external_homework_id]?.lessonTitle || $t('Unknown Lesson') }}</span>
                  </div>
                </div>
                <div class="homework-arrow">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
              </div>
            </router-link>
          </div>
        </div>
      </div>

      <!-- Active Subscriptions Section -->
      <div class="dashboard-card card--subscription glass-effect">
        <div class="card-header">
          <div class="card-title">
            <div class="title-icon subscription-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7L12 12L22 7L12 2ZM2 17L12 22L22 17M2 12L12 17L22 12" stroke="currentColor" stroke-width="2"/>
                <path d="M9 12L11 14L15 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <h2>{{ $t('Active Subscriptions') }}</h2>
            <span class="card-status" :class="{ active: activeSubscriptions.length > 0 }">
              {{ activeSubscriptions.length > 0
                ? $t('{v0} Active', { v0: activeSubscriptions.length })
                : $t('None') }}
            </span>
          </div>
          <p class="card-subtitle">
            {{ $t('All your currently active subscription plans') }}
            <span v-if="combinedFeaturesCount > 0" class="combined-features-hint">
              {{ $t('· {v0} combined feature{v1}', { v0: combinedFeaturesCount, v1: combinedFeaturesCount > 1 ? 's' : '' }) }}
            </span>
          </p>
        </div>
        
        <div class="subscription-content">
          <div v-if="loading.subscription" class="loading-placeholder">
            <div class="placeholder-item"></div>
          </div>
          <div v-else-if="activeSubscriptions.length === 0" class="empty-state">
            <div class="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7L12 12L22 7L12 2ZM2 17L12 22L22 17M2 12L12 17L22 12" stroke="#94A3B8" stroke-width="1.5"/>
              </svg>
            </div>
            <p class="empty-text">{{ $t('No active subscription') }}</p>
            <router-link to="/plans" class="empty-action">{{ $t('View Plans') }}</router-link>
          </div>
          <div v-else class="active-subscriptions-list">
            <div
              v-for="sub in activeSubscriptions"
              :key="sub.external_id"
              class="subscription-details"
            >
              <div class="subscription-plan">
                <h3 class="plan-title">{{ $td(sub.subscription_type) || $t('Unknown Plan') }}</h3>
                <div class="plan-price">
                  <span class="price-amount sfs-nums">{{ sub.subscription_type?.price || $t('Free') }}</span>
                  <span class="price-period">{{ $t('/year') }}</span>
                </div>
                <p class="plan-description">{{ sub.subscription_type?.description || '' }}</p>
              </div>

              <div class="subscription-features">
                <h4 class="features-title">
                  {{ $t('Features included') }}
                  <span v-if="sub.subscription_type?.features?.length" class="features-count">
                    ({{ sub.subscription_type.features.length }})
                  </span>
                </h4>
                <div class="features-list">
                  <div
                    v-for="feature in (sub.subscription_type?.features || [])"
                    :key="feature.external_id"
                    class="feature-item"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M9 12L11 14L15 10" stroke="#48BB78" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <!--
                      `description`, NOT `name`. The live values of `name` are
                      `ai_feature`, `lab_feature`, `runbook_feature` … —
                      identifiers `subscription-guard.ts` matches a route's
                      `requiredFeatures` against, and app 22 declares only
                      `description` translatable for exactly this reason. Rendered
                      as-is they put `ai_feature` in front of a paying subscriber
                      as the name of what they bought.
                    -->
                    <span>{{ $td(feature, 'description') || feature.name }}</span>
                  </div>
                  <div
                    v-if="!sub.subscription_type?.features || sub.subscription_type.features.length === 0"
                    class="feature-item feature-empty"
                  >
                    <span>{{ $t('No features attached to this plan') }}</span>
                  </div>
                </div>
              </div>

              <div class="subscription-meta">
                <div class="meta-item">
                  <span class="meta-label">{{ $t('Plan Name') }}</span>
                  <span class="meta-value">{{ sub.title }}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">{{ $t('Expires') }}</span>
                  <span class="meta-value">{{ formatDate(sub.expire_date) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/auth';
import { courseService, type CourseRegistration, type Homework, type Course } from '@/services/course.service';
import { certificateService, type ExamCertificate, type CourseCertificate } from '@/services/certificate.service';
import { quizService, type UserQuizResult } from '@/services/quiz.service';
import { subscriptionService, type Subscription } from '@/services/subscription.service';
import { examService, type Exam } from '@/services/exam.service';
import { d, t, td } from '@/i18n/runtime';
/*
  Every number this page reports is decided in `dashboardProgress.ts` — a plain
  module with no Vue in it, on the precedent of `photoMask.ts`,
  `leaderboardEngine.ts` and `examShuffle.ts`. The view fetches and renders; it
  does not decide who has passed what. Read that file before changing a figure
  here: the reason there is no "% of course complete" anywhere on this page is
  written down at the top of it.
*/
import {
    BADGE_NAMES,
    BADGE_NOTES,
    badges,
    courseProgress,
    meterWidth,
    scoreBand,
    summarise,
    type ProgressInput,
} from '@/utils/dashboardProgress';

const authStore = useAuthStore();

// Reactive data
const registeredCourses = ref<CourseRegistration[]>([]);
const examCertificates = ref<ExamCertificate[]>([]);
const courseCertificates = ref<CourseCertificate[]>([]);
const quizResults = ref<UserQuizResult[]>([]);
const homeworks = ref<Homework[]>([]);

// CHANGED: now an array of ALL non-expired active subscriptions
const activeSubscriptions = ref<Subscription[]>([]);

// Additional details storage
const courseDetails = ref<Record<string, Course>>({});
/**
 * Courses whose record could not be fetched.
 *
 * A `ref` rather than a plain Set because `courseTitleFor` reads it from a
 * template: a plain Set is not reactive, so the row would render "Loading…" and
 * never update when the request settled.
 */
const failedCourses = ref(new Set<string>());
const examCertificateDetails = ref<Record<string, Exam>>({});
const quizDetails = ref<Record<string, {
  quizTitle: string;
  courseTitle: string;
  lessonTitle: string;
  /* The course this quiz belongs to. Already fetched by `fetchQuizResults` to
     resolve the title; kept so the progress card can group by course without a
     second lookup. Optional because the quiz record may not name one, and
     `dashboardProgress` counts an unattributed quiz in the totals and in no
     course rather than filing it under a guess. */
  courseId?: string;
}>>({});
const homeworkDetails = ref<Record<string, {
  courseTitle: string;
  lessonTitle: string;
}>>({});

// Loading states
const loading = ref({
  courses: true,
  examCertificates: true,
  courseCertificates: true,
  quizResults: true,
  homeworks: true,
  subscription: true,
});

// Computed properties
const username = computed(() => {
  return authStore.user?.username || 'Student';
});

const registeredCoursesCount = computed(() => registeredCourses.value.length);
const totalCertificatesCount = computed(() => examCertificates.value.length + courseCertificates.value.length);
const totalHomeworksCount = computed(() => homeworks.value.length);

// Union count of feature names across all active subscriptions
const combinedFeaturesCount = computed(() => {
  const set = new Set<string>();
  for (const sub of activeSubscriptions.value) {
    for (const f of (sub.subscription_type?.features || [])) {
      if (f?.name) set.add(f.name);
    }
  }
  return set.size;
});


/* -------------------------------------------------------------------------- *
 * Icons
 *
 * Path data, not components. `lucide-vue-next` is a dependency and is the
 * right tool where a page needs dozens of glyphs; here it is nine, every one of
 * them already drawn inline elsewhere in this template, and importing a
 * component per icon would put nine more modules in the dashboard's chunk for
 * nine strings. They live in one map rather than in nine `v-if` branches so a
 * badge or a tile can name its icon as data.
 * -------------------------------------------------------------------------- */
const ICONS: Record<string, string> = {
    book: 'M12 2L2 7L12 12L22 7L12 2ZM2 17L12 22L22 17M2 12L12 17L22 12',
    check: 'M9 12L11 14L15 10M12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3Z',
    award: 'M12 15C15.3137 15 18 12.3137 18 9C18 5.68629 15.3137 3 12 3C8.68629 3 6 5.68629 6 9C6 12.3137 8.68629 15 12 15ZM8.5 14L7 22L12 19L17 22L15.5 14',
    crown: 'M3 7L7 11L12 4L17 11L21 7V18C21 19.1046 20.1046 20 19 20H5C3.89543 20 3 19.1046 3 18V7Z',
    chart: 'M4 20V10M10 20V4M16 20V14M22 20H2',
    compass: 'M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21ZM15.5 8.5L13.5 13.5L8.5 15.5L10.5 10.5L15.5 8.5Z',
    flame: 'M12 22C15.866 22 19 18.866 19 15C19 11 12 2 12 2C12 2 5 11 5 15C5 18.866 8.13401 22 12 22ZM12 18C13.6569 18 15 16.6569 15 15C15 13.5 12 10 12 10',
    target: 'M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21ZM12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16ZM12 13C12.5523 13 13 12.5523 13 12C13 11.4477 12.5523 11 12 11C11.4477 11 11 11.4477 11 12C11 12.5523 11.4477 13 12 13Z',
    star: 'M12 3L14.7 9.1L21 9.9L16.4 14.3L17.6 20.6L12 17.5L6.4 20.6L7.6 14.3L3 9.9L9.3 9.1L12 3Z',
};

/* -------------------------------------------------------------------------- *
 * Progress, achievements and the headline figures
 * -------------------------------------------------------------------------- */

/**
 * The quiz rows, in the shape `dashboardProgress` wants.
 *
 * `courseId` comes from `quizDetails`, which is filled by `fetchQuizResults`
 * from the quiz's own `course_id`. It is optional in the engine and often
 * genuinely absent — a quiz whose course lookup failed, or one whose course the
 * learner is no longer registered on — and the per-course rows simply do not
 * count it rather than filing it under a guess.
 */
const quizAttempts = computed(() => quizResults.value.map(r => ({
    quizId: r.quiz,
    score: r.score,
    // The record's own verdict. Unlike an exam, a quiz carries no pass mark, so
    // there is nothing here to re-derive it from — see QUIZ_PASS_FALLBACK.
    passed: r.result_status ? r.result_status === 'PASSED' : undefined,
    takenAt: r.date_taken,
    courseId: quizDetails.value[r.quiz]?.courseId,
})));

const progressInput = computed<ProgressInput>(() => ({
    courseIds: registeredCourses.value
        .map(r => r.course_external_id || r.course)
        .filter((id): id is string => Boolean(id)),
    quizzes: quizAttempts.value,
    examCertificates: examCertificates.value.length,
    courseCertificates: courseCertificates.value.length,
    homeworks: homeworks.value.length,
}));

const summary = computed(() => summarise(progressInput.value));
const courseRows = computed(() => courseProgress(progressInput.value));
const badgeList = computed(() => badges(summary.value));
const earnedBadges = computed(() => badgeList.value.filter(b => b.earned).length);

/* ---- The score ring ---- */

/** `0` when there is nothing to show — an empty track, never a full one. */
const ringPercent = computed(() => meterWidth(summary.value.averageScore));

/** An em dash, not a zero. See `summarise()` for why the value is nullable. */
const ringText = computed(() =>
    summary.value.averageScore === null ? '—' : String(summary.value.averageScore));

/**
 * The ring is a conic gradient, so a screen reader has nothing to read off it,
 * and the number inside is a fragment that says nothing about what was
 * measured. This is the whole sentence.
 */
const ringAria = computed(() => summary.value.averageScore === null
    ? t('No quiz results yet')
    : t('Average quiz score: {v0}%', { v0: summary.value.averageScore }));

const ringBand = computed(() => summary.value.averageScore === null
    ? 'is-empty'
    : `is-${scoreBand(summary.value.averageScore)}`);

/* ---- The tiles and the rates ---- */

const tiles = computed(() => [
    { id: 'courses', icon: 'book', value: summary.value.courses, label: t('Courses') },
    { id: 'passed', icon: 'check', value: summary.value.quizzesPassed, label: t('Quizzes passed') },
    { id: 'certificates', icon: 'award', value: summary.value.certificates, label: t('Certificates') },
    { id: 'badges', icon: 'crown', value: earnedBadges.value, label: t('Badges') },
]);

/**
 * Which of the four fills a rate gets.
 *
 * Returns the WHOLE class, including the empty string, so a template never has
 * to build a class name out of a conditional — that is where a stray
 * `sfs-meter__fill--null` comes from.
 *
 * "Good" deliberately gets no modifier and therefore the brand gradient: a
 * meter is green at a distinction and amber or red when it needs attention, and
 * green at 71% would leave nothing to say about 95%.
 */
const fillFor = (value: number | null): string => {
    if (value === null) return '';
    switch (scoreBand(value)) {
        case 'excellent': return 'sfs-meter__fill--success';
        case 'average': return 'sfs-meter__fill--warning';
        case 'poor': return 'sfs-meter__fill--danger';
        default: return '';
    }
};

const rates = computed(() => [
    {
        id: 'pass',
        label: t('Pass rate'),
        value: summary.value.passRate,
        fill: fillFor(summary.value.passRate),
    },
    {
        id: 'average',
        label: t('Average score'),
        value: summary.value.averageScore,
        fill: fillFor(summary.value.averageScore),
    },
    {
        id: 'best',
        label: t('Best score'),
        value: summary.value.bestScore,
        fill: fillFor(summary.value.bestScore),
    },
]);

/* ---- Badge copy ---- */

/*
  The two tables are English KEYS and live in `dashboardProgress.ts`, so
  `check:i18n` can import them and prove both catalogues cover every badge —
  a key reached through a variable appears in no file as a literal and would
  otherwise be reported as an orphan. Same arrangement as the sidebar's labels
  and the AI Chat's date headings.
*/
const badgeName = (id: string): string => t(BADGE_NAMES[id] ?? id);
const badgeNote = (id: string): string => t(BADGE_NOTES[id] ?? '');

/**
 * The registered course's title, translated.
 *
 * Three states, not two, and the third is the reason this is a function rather
 * than the inline `$td(...) || $t('Loading...')` it replaced: a course whose
 * record 404s or whose replica never answers would otherwise say "Loading…" for
 * as long as the page is open, which reads as a stuck spinner rather than as a
 * lookup that failed. `ensureCourse` caches a failure as `null`, so the two are
 * distinguishable — and the row still appears, because the registration is real
 * whatever happened to the course record.
 */
const courseTitleFor = (courseId: string): string => {
    const title = td(courseDetails.value[courseId]);
    if (title) return title;
    return failedCourses.value.has(courseId) ? t('Course unavailable') : t('Loading...');
};

// Helper functions
/*
  Was `toLocaleDateString('en-US', …)`, hardcoded, so every date on this page
  rendered in English on an Arabic or a Chinese page — the same fault
  `Courses.vue` had with its hand-rolled relative dates. `d()` is the
  platform's own `Intl.DateTimeFormat` wrapper and follows the locale the
  sidebar picked.

  An unparseable date is an em dash rather than "N/A": a two-letter English
  abbreviation is not translated anywhere, and `Invalid Date` is what
  `toLocaleDateString` would otherwise print.
*/
const formatDate = (dateString?: string): string => {
  /* Optional, because several of the records this page renders declare their
     date field optional (`date_taken?`, `expire_date?`) — the parameter was
     typed `string` and every call site was a type error nobody was looking at,
     because `vue-tsc` is not part of `build`. */
  if (!dateString) return '—';
  const parsed = Date.parse(dateString);
  if (Number.isNaN(parsed)) return '—';
  return d(parsed, { month: 'short', day: 'numeric', year: 'numeric' });
};

const truncateText = (text: string, maxLength: number): string => {
  if (!text) return t('No description');
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
};

/* The same four thresholds this file used to carry inline. They now live in
   `dashboardProgress.ts` so the ring, the meters and the quiz rows cannot
   disagree about what counts as a good score. */
const getScoreClass = (score: number): string => scoreBand(score);

/* -------------------------------------------------------------------------- *
 * Fetching
 *
 * ==========================================================================
 * WHY THERE IS A MEMO HERE AND NOT JUST A `courseDetails` DICT
 * ==========================================================================
 * `courseDetails` was already a cache and nothing consulted it, so this page
 * re-fetched the same course over and over. Measured against the real data
 * shapes, one dashboard load for a learner on 5 courses with 20 lessons each
 * and 60 homeworks was issuing:
 *
 *   * one `getCourse` per REGISTRATION            (5, all distinct — fine)
 *   * one `getCourse` + one `getLesson` per HOMEWORK  (120 requests, ~5 distinct
 *     courses and ~60 lessons — and the lesson object was ALREADY IN SCOPE in
 *     the loop that fetched it)
 *   * one `getCourse` + one `getLesson` per QUIZ RESULT
 *   * one `getCourse` per certificate
 *
 * Every one of those goes to a PythonAnywhere replica whose first answer of the
 * day takes ~20 seconds, and they were sequential. That is the other half of
 * "the site is slow", and unlike the background it is not a rendering cost —
 * it is a dashboard that takes minutes to fill in.
 *
 * `ensureCourse` caches the PROMISE, not the result, which is what makes it
 * safe to call from several loops at once: the second caller joins the first
 * request instead of starting a duplicate. A failure is cached as `null` too —
 * retrying a 404 sixty times is sixty round trips to the same answer.
 * -------------------------------------------------------------------------- */
const courseRequests = new Map<string, Promise<Course | null>>();


const ensureCourse = (courseId: string): Promise<Course | null> => {
  if (!courseId) return Promise.resolve(null);
  const held = courseRequests.get(courseId);
  if (held) return held;
  const request = courseService.getCourse(courseId)
    .then(course => {
      courseDetails.value[courseId] = course;
      return course;
    })
    .catch(error => {
      console.error(`Failed to fetch course details for ${courseId}:`, error);
      /* A new Set, not `.add`: a Set mutated in place is the same object, so
         Vue's reactivity has nothing to compare and the template never
         re-renders. */
      failedCourses.value = new Set(failedCourses.value).add(courseId);
      return null;
    });
  courseRequests.set(courseId, request);
  return request;
};

const lessonRequests = new Map<string, Promise<{ title: string } | null>>();

const ensureLesson = (lessonId: string): Promise<{ title: string } | null> => {
  if (!lessonId) return Promise.resolve(null);
  const held = lessonRequests.get(lessonId);
  if (held) return held;
  const request = courseService.getLesson(lessonId)
    .then(lesson => lesson as { title: string })
    .catch(error => {
      console.error(`Failed to fetch lesson ${lessonId}:`, error);
      return null;
    });
  lessonRequests.set(lessonId, request);
  return request;
};

// Fetch data functions
const fetchRegisteredCourses = async () => {
  try {
    loading.value.courses = true;
    if (authStore.user?.id) {
      registeredCourses.value = await courseService.getUserRegistrations(authStore.user.id);

      /*
        In parallel, and this is the one place on the page where that is
        clearly right: the registrations are already in hand, the courses are
        distinct, and serially this is one cold-replica wait per course before
        the first card can render a single title.
      */
      await Promise.all(registeredCourses.value.map(registration =>
        ensureCourse(registration.course_external_id || registration.course)
      ));
    }
  } catch (error) {
    console.error('Failed to fetch registered courses:', error);
    registeredCourses.value = [];
  } finally {
    loading.value.courses = false;
  }
};

const fetchCertificates = async () => {
  try {
    loading.value.examCertificates = true;
    loading.value.courseCertificates = true;
    
    if (authStore.user?.id) {
      const [examCerts, courseCerts] = await Promise.all([
        certificateService.getExamCertificates({ user_id: authStore.user.id }),
        certificateService.getCourseCertificates({ user_id: authStore.user.id })
      ]);
      
      examCertificates.value = examCerts;
      courseCertificates.value = courseCerts;
      
      /*
        In parallel and de-duplicated. Two certificates for the same exam, or a
        course certificate for a course the learner is also registered on — both
        are ordinary and both were a second identical request. `ensureCourse`
        joins the one already in flight from `fetchRegisteredCourses`.
      */
      await Promise.all([
        ...new Set(examCerts.map(c => c.exam_id).filter(Boolean))
      ].map(examId => examService.getExam(examId)
        .then(exam => { examCertificateDetails.value[examId] = exam; })
        .catch(error => console.error(`Failed to fetch exam details for ${examId}:`, error))
      ));

      await Promise.all([
        ...new Set(courseCerts.map(c => c.course_id).filter(Boolean))
      ].map(courseId => ensureCourse(courseId)));
    }
  } catch (error) {
    console.error('Failed to fetch certificates:', error);
    examCertificates.value = [];
    courseCertificates.value = [];
  } finally {
    loading.value.examCertificates = false;
    loading.value.courseCertificates = false;
  }
};

const fetchQuizResults = async () => {
  try {
    loading.value.quizResults = true;
    if (authStore.user?.id) {
      const results = await quizService.getUserQuizResults(authStore.user.id);
      quizResults.value = results;

      /*
        One pass per DISTINCT quiz, in parallel, with the course and lesson
        lookups memoised.

        A learner who re-sat one quiz four times had four identical `getQuiz` +
        `getCourse` + `getLesson` chains, sequentially — and the course is
        almost always one they are registered on, so it had already been fetched
        by `fetchRegisteredCourses`. `courseId` is stored alongside the titles
        because the progress card groups by course and must not need a second
        lookup to do it.
      */
      const quizIds = [...new Set(results.map(r => r.quiz).filter(Boolean))];

      await Promise.all(quizIds.map(async quizId => {
        try {
          const quiz = await quizService.getQuiz(quizId);
          const [course, lesson] = await Promise.all([
            quiz.course_id ? ensureCourse(quiz.course_id) : Promise.resolve(null),
            quiz.lesson_id ? ensureLesson(quiz.lesson_id) : Promise.resolve(null),
          ]);

          quizDetails.value[quizId] = {
            quizTitle: quiz.title,
            /* Empty where the lookup failed, and the TEMPLATE supplies the
               fallback through `$t()`. Putting an English sentence in the
               store here is how a translated page ends up with two English
               words in the middle of an Arabic row — and the template has to
               have a fallback anyway, for a record written before this ran. */
            courseTitle: course ? td(course) : '',
            lessonTitle: lesson?.title || '',
            courseId: quiz.course_id || undefined,
          };
        } catch (error) {
          console.error(`Failed to fetch quiz details for ${quizId}:`, error);
        }
      }));
    }
  } catch (error) {
    console.error('Failed to fetch quiz results:', error);
    quizResults.value = [];
  } finally {
    loading.value.quizResults = false;
  }
};

const fetchHomeworks = async () => {
  try {
    loading.value.homeworks = true;
    if (authStore.user?.id && registeredCourses.value.length > 0) {
      /*
        This function was the single most expensive thing on the page.

        Per HOMEWORK it issued a `getCourse(courseId)` — for a course id that is
        constant inside the loop and had already been fetched twice by the time
        it got here — plus a `getLesson(lesson.external_lesson_id)` for a lesson
        whose object was ALREADY IN SCOPE, one line up, complete with its title.
        For a learner with 60 homeworks that is 120 sequential requests to a
        replica whose first answer takes ~20 seconds, to produce two strings
        that were already in memory.

        Now: one `getCourseLessons` per course, one `getLessonHomeworks` per
        lesson, and zero per homework.

        Courses run in parallel and lessons within a course run in sequence,
        which is a deliberate middle. Firing every lesson of every course at
        once would be ~100 concurrent requests at one PythonAnywhere web app,
        which has a handful of worker processes — the requests would queue
        behind each other anyway and some would time out, so it would be slower
        AND less reliable. A learner is typically on a few courses, so the
        parallel dimension is the small one on purpose.
      */
      const perCourse = await Promise.all(registeredCourses.value.map(async registration => {
        const courseId = registration.course_external_id || registration.course;
        const found: Homework[] = [];
        try {
          const [course, lessons] = await Promise.all([
            ensureCourse(courseId),
            courseService.getCourseLessons(courseId),
          ]);

          for (const lesson of lessons) {
            if (!lesson.external_lesson_id) continue;
            const lessonHomeworks = await courseService.getLessonHomeworks(lesson.external_lesson_id);
            for (const hw of lessonHomeworks) {
              found.push({
                ...hw,
                course_external_id: courseId,
                lesson_external_id: lesson.external_lesson_id,
              });
              homeworkDetails.value[hw.external_homework_id] = {
                courseTitle: course?.title || courseId,
                // The lesson we are standing in. No request.
                lessonTitle: lesson.title,
              };
            }
          }
        } catch (error) {
          console.error(`Failed to fetch homeworks for course ${courseId}:`, error);
        }
        return found;
      }));

      homeworks.value = perCourse.flat();
    }
  } catch (error) {
    console.error('Failed to fetch homeworks:', error);
    homeworks.value = [];
  } finally {
    loading.value.homeworks = false;
  }
};

/**
 * Fetch ALL non-expired active subscriptions, not just the selected one.
 * This way the Home page reflects every plan currently giving the user features.
 */
const fetchActiveSubscriptions = async () => {
  try {
    loading.value.subscription = true;
    if (authStore.user?.id) {
      activeSubscriptions.value = await subscriptionService.getUsableSubscriptions(authStore.user.id);
    } else {
      activeSubscriptions.value = [];
    }
  } catch (error) {
    console.error('Failed to fetch active subscriptions:', error);
    activeSubscriptions.value = [];
  } finally {
    loading.value.subscription = false;
  }
};

// Initialize data fetching
const initializeData = async () => {
  await Promise.all([
    fetchRegisteredCourses(),
    fetchCertificates(),
    fetchQuizResults(),
    fetchActiveSubscriptions(),
  ]);
  
  if (registeredCourses.value.length > 0) {
    await fetchHomeworks();
  } else {
    /*
      `loading.homeworks` starts true and `fetchHomeworks` is the only thing
      that clears it — so a learner with no enrolments sat looking at three
      skeleton bars on the Homeworks card for as long as the page was open. It
      reads as a request that never came back, on the one screen a brand-new
      account lands on, and it was invisible until the dashboard was rendered
      with empty data. There is nothing to fetch, so there is nothing loading.
    */
    loading.value.homeworks = false;
  }
};

onMounted(async () => {
  await authStore.checkAuth();
  
  if (authStore.isAuthenticated) {
    await initializeData();
  }
});
</script>

<style scoped src="@/assets/css/home.css"></style>

<style scoped>
/* Minimal additions for multi-subscription rendering — does not override existing design */
.active-subscriptions-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.active-subscriptions-list .subscription-details + .subscription-details {
  border-top: 1px dashed rgb(var(--sfs-accent-rgb, 148 163 184) / 0.4);
  padding-top: 16px;
}

.features-count {
  font-size: 12px;
  font-weight: 500;
  color: var(--sfs-accent-text, #64748b);
  margin-inline-start: 4px;
}

.feature-empty {
  color: var(--sfs-accent-text, #94a3b8);
  font-style: italic;
}

.combined-features-hint {
  color: var(--sfs-accent-text, #64748b);
  font-size: 12px;
  margin-inline-start: 4px;
}
</style>