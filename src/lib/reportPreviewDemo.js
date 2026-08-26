const PREVIEW_HOST = 'deploy-preview-8--lexams.netlify.app';

export function isReportingPreviewDemo() {
  return typeof window !== 'undefined' && window.location.hostname === PREVIEW_HOST;
}

export const reportPreviewDemo = {
  activities: [
    { id: -8101, title: 'Youth Digital Skills Bootcamp', type: 'Training', start_date: '2026-08-03', end_date: '2026-08-07' },
    { id: -8102, title: 'Community Leadership Workshop', type: 'Workshop', start_date: '2026-08-12', end_date: '2026-08-13' },
    { id: -8103, title: 'Monitoring & Evaluation Clinic', type: 'Clinic', start_date: '2026-08-18', end_date: '2026-08-19' },
  ],
  participants: [
    { id: -8201, name: 'Aminata Jallow', email: 'justformodapps@gmail.com', phone: '+220 300 1001', org: 'Young Changemakers Network', category: 'Youth' },
    { id: -8202, name: 'Lamin Touray', email: 'bepro01589@gmail.com', phone: '+220 300 1002', org: 'Community Action Hub', category: 'Community leader' },
    { id: -8203, name: 'Fatou Ceesay', email: 'fatou.demo@example.com', phone: '+220 300 1003', org: 'Women in Enterprise', category: 'Entrepreneur' },
    { id: -8204, name: 'Ousman Bah', email: 'ousman.demo@example.com', phone: '+220 300 1004', org: 'Community Action Hub', category: 'Youth' },
    { id: -8205, name: 'Mariama Sanyang', email: 'mariama.demo@example.com', phone: '+220 300 1005', org: 'Education Forward', category: 'Teacher' },
    { id: -8206, name: 'Ebrima Njie', email: 'ebrima.demo@example.com', phone: '+220 300 1006', org: 'Education Forward', category: 'Trainer' },
    { id: -8207, name: 'Binta Manneh', email: 'binta.demo@example.com', phone: '+220 300 1007', org: 'Women in Enterprise', category: 'Entrepreneur' },
    { id: -8208, name: 'Modou Faal', email: 'modou.demo@example.com', phone: '+220 300 1008', org: 'Young Changemakers Network', category: 'Youth' },
  ],
  registrations: [
    { id: -8301, activity_id: -8101, participant_id: -8201 }, { id: -8302, activity_id: -8101, participant_id: -8203 },
    { id: -8303, activity_id: -8101, participant_id: -8204 }, { id: -8304, activity_id: -8101, participant_id: -8205 },
    { id: -8305, activity_id: -8101, participant_id: -8208 }, { id: -8306, activity_id: -8102, participant_id: -8201 },
    { id: -8307, activity_id: -8102, participant_id: -8202 }, { id: -8308, activity_id: -8102, participant_id: -8203 },
    { id: -8309, activity_id: -8102, participant_id: -8206 }, { id: -8310, activity_id: -8102, participant_id: -8207 },
    { id: -8311, activity_id: -8103, participant_id: -8202 }, { id: -8312, activity_id: -8103, participant_id: -8204 },
    { id: -8313, activity_id: -8103, participant_id: -8205 }, { id: -8314, activity_id: -8103, participant_id: -8206 },
    { id: -8315, activity_id: -8103, participant_id: -8208 },
  ],
  attendance: [
    { id: -8401, activity_id: -8101, participant_id: -8201, session_label: 'Day 1', status: 'present' },
    { id: -8402, activity_id: -8101, participant_id: -8201, session_label: 'Day 2', status: 'present' },
    { id: -8403, activity_id: -8101, participant_id: -8201, session_label: 'Day 3', status: 'late' },
    { id: -8404, activity_id: -8101, participant_id: -8203, session_label: 'Day 1', status: 'present' },
    { id: -8405, activity_id: -8101, participant_id: -8203, session_label: 'Day 2', status: 'present' },
    { id: -8406, activity_id: -8101, participant_id: -8203, session_label: 'Day 3', status: 'present' },
    { id: -8407, activity_id: -8101, participant_id: -8204, session_label: 'Day 1', status: 'late' },
    { id: -8408, activity_id: -8101, participant_id: -8204, session_label: 'Day 2', status: 'absent' },
    { id: -8409, activity_id: -8101, participant_id: -8204, session_label: 'Day 3', status: 'present' },
    { id: -8410, activity_id: -8101, participant_id: -8205, session_label: 'Day 1', status: 'present' },
    { id: -8411, activity_id: -8101, participant_id: -8205, session_label: 'Day 2', status: 'present' },
    { id: -8412, activity_id: -8101, participant_id: -8205, session_label: 'Day 3', status: 'absent' },
    { id: -8413, activity_id: -8101, participant_id: -8208, session_label: 'Day 1', status: 'present' },
    { id: -8414, activity_id: -8101, participant_id: -8208, session_label: 'Day 2', status: 'late' },
    { id: -8415, activity_id: -8101, participant_id: -8208, session_label: 'Day 3', status: 'present' },
    { id: -8416, activity_id: -8102, participant_id: -8201, session_label: 'Session 1', status: 'present' },
    { id: -8417, activity_id: -8102, participant_id: -8201, session_label: 'Session 2', status: 'present' },
    { id: -8418, activity_id: -8102, participant_id: -8202, session_label: 'Session 1', status: 'present' },
    { id: -8419, activity_id: -8102, participant_id: -8202, session_label: 'Session 2', status: 'late' },
    { id: -8420, activity_id: -8102, participant_id: -8203, session_label: 'Session 1', status: 'absent' },
    { id: -8421, activity_id: -8102, participant_id: -8203, session_label: 'Session 2', status: 'present' },
    { id: -8422, activity_id: -8102, participant_id: -8206, session_label: 'Session 1', status: 'present' },
    { id: -8423, activity_id: -8102, participant_id: -8206, session_label: 'Session 2', status: 'present' },
    { id: -8424, activity_id: -8102, participant_id: -8207, session_label: 'Session 1', status: 'late' },
    { id: -8425, activity_id: -8102, participant_id: -8207, session_label: 'Session 2', status: 'present' },
    { id: -8426, activity_id: -8103, participant_id: -8202, session_label: 'Clinic 1', status: 'present' },
    { id: -8427, activity_id: -8103, participant_id: -8202, session_label: 'Clinic 2', status: 'present' },
    { id: -8428, activity_id: -8103, participant_id: -8204, session_label: 'Clinic 1', status: 'present' },
    { id: -8429, activity_id: -8103, participant_id: -8204, session_label: 'Clinic 2', status: 'present' },
    { id: -8430, activity_id: -8103, participant_id: -8205, session_label: 'Clinic 1', status: 'late' },
    { id: -8431, activity_id: -8103, participant_id: -8205, session_label: 'Clinic 2', status: 'present' },
    { id: -8432, activity_id: -8103, participant_id: -8206, session_label: 'Clinic 1', status: 'present' },
    { id: -8433, activity_id: -8103, participant_id: -8206, session_label: 'Clinic 2', status: 'absent' },
    { id: -8434, activity_id: -8103, participant_id: -8208, session_label: 'Clinic 1', status: 'present' },
    { id: -8435, activity_id: -8103, participant_id: -8208, session_label: 'Clinic 2', status: 'late' },
  ],
  certificates: [
    { id: -8501, cert_no: 'DEMO-2026-001', activity_id: -8101, participant_id: -8201, certificate_type: 'completion', issued_date: '2026-08-08' },
    { id: -8502, cert_no: 'DEMO-2026-002', activity_id: -8101, participant_id: -8203, certificate_type: 'completion', issued_date: '2026-08-08' },
    { id: -8503, cert_no: 'DEMO-2026-003', activity_id: -8101, participant_id: -8208, certificate_type: 'participation', issued_date: '2026-08-08' },
    { id: -8504, cert_no: 'DEMO-2026-004', activity_id: -8102, participant_id: -8202, certificate_type: 'completion', issued_date: '2026-08-14' },
    { id: -8505, cert_no: 'DEMO-2026-005', activity_id: -8102, participant_id: -8206, certificate_type: 'completion', issued_date: '2026-08-14' },
    { id: -8506, cert_no: 'DEMO-2026-006', activity_id: -8103, participant_id: -8204, certificate_type: 'completion', issued_date: '2026-08-20' },
    { id: -8507, cert_no: 'DEMO-2026-007', activity_id: -8103, participant_id: -8205, certificate_type: 'participation', issued_date: '2026-08-20' },
  ],
  surveys: [
    { id: -8601, title: 'Bootcamp Participant Feedback', activity_id: -8101, status: 'closed', created_at: '2026-08-03T09:00:00Z' },
    { id: -8602, title: 'Leadership Workshop Feedback', activity_id: -8102, status: 'closed', created_at: '2026-08-12T09:00:00Z' },
  ],
  assessments: [
    { id: -8701, title: 'Digital Skills Pre-test', activity_id: -8101, assessment_type: 'pre_test', passing_score: 60, status: 'closed' },
    { id: -8702, title: 'Digital Skills Post-test', activity_id: -8101, assessment_type: 'post_test', passing_score: 70, status: 'closed' },
    { id: -8703, title: 'M&E Clinic Knowledge Check', activity_id: -8103, assessment_type: 'quiz', passing_score: 70, status: 'closed' },
  ],
};

const participantById = new Map(reportPreviewDemo.participants.map(item => [item.id, item]));

const surveyResponses = [
  { id: -8801, surveyId: -8601, activityId: -8101, survey: 'Bootcamp Participant Feedback', activity: 'Youth Digital Skills Bootcamp', participantId: -8201, respondent: 'Aminata Jallow', email: 'justformodapps@gmail.com', submittedAt: '2026-08-07T16:30:00Z', rating: 5, pace: 'Just right', recommend: 'Yes', comment: 'Very practical sessions and clear examples.' },
  { id: -8802, surveyId: -8601, activityId: -8101, survey: 'Bootcamp Participant Feedback', activity: 'Youth Digital Skills Bootcamp', participantId: -8203, respondent: 'Fatou Ceesay', email: 'fatou.demo@example.com', submittedAt: '2026-08-07T16:35:00Z', rating: 4, pace: 'Just right', recommend: 'Yes', comment: 'The exercises helped me understand the tools.' },
  { id: -8803, surveyId: -8601, activityId: -8101, survey: 'Bootcamp Participant Feedback', activity: 'Youth Digital Skills Bootcamp', participantId: -8204, respondent: 'Ousman Bah', email: 'ousman.demo@example.com', submittedAt: '2026-08-07T16:40:00Z', rating: 3, pace: 'Fast', recommend: 'Yes', comment: 'More time for practice would improve the course.' },
  { id: -8804, surveyId: -8601, activityId: -8101, survey: 'Bootcamp Participant Feedback', activity: 'Youth Digital Skills Bootcamp', participantId: -8208, respondent: 'Modou Faal', email: 'modou.demo@example.com', submittedAt: '2026-08-07T16:42:00Z', rating: 5, pace: 'Just right', recommend: 'Yes', comment: 'Useful and engaging from start to finish.' },
  { id: -8805, surveyId: -8602, activityId: -8102, survey: 'Leadership Workshop Feedback', activity: 'Community Leadership Workshop', participantId: -8202, respondent: 'Lamin Touray', email: 'bepro01589@gmail.com', submittedAt: '2026-08-13T15:20:00Z', rating: 4, pace: 'Just right', recommend: 'Yes', comment: 'Strong facilitation and relevant group discussions.' },
  { id: -8806, surveyId: -8602, activityId: -8102, survey: 'Leadership Workshop Feedback', activity: 'Community Leadership Workshop', participantId: -8203, respondent: 'Fatou Ceesay', email: 'fatou.demo@example.com', submittedAt: '2026-08-13T15:25:00Z', rating: 4, pace: 'Slow', recommend: 'Yes', comment: 'Good content; a shorter opening would help.' },
  { id: -8807, surveyId: -8602, activityId: -8102, survey: 'Leadership Workshop Feedback', activity: 'Community Leadership Workshop', participantId: -8206, respondent: 'Ebrima Njie', email: 'ebrima.demo@example.com', submittedAt: '2026-08-13T15:30:00Z', rating: 5, pace: 'Just right', recommend: 'Yes', comment: 'The scenarios were excellent for trainers.' },
  { id: -8808, surveyId: -8602, activityId: -8102, survey: 'Leadership Workshop Feedback', activity: 'Community Leadership Workshop', participantId: -8207, respondent: 'Binta Manneh', email: 'binta.demo@example.com', submittedAt: '2026-08-13T15:34:00Z', rating: 4, pace: 'Just right', recommend: 'No', comment: 'I would add more examples for small organisations.' },
];

const assessmentSubmissions = [
  { id: -8901, assessmentId: -8701, activityId: -8101, assessment: 'Digital Skills Pre-test', activity: 'Youth Digital Skills Bootcamp', type: 'pre_test', participantId: -8201, respondent: 'Aminata Jallow', email: 'justformodapps@gmail.com', percentage: 52, passed: false, submittedAt: '2026-08-03T09:20:00Z' },
  { id: -8902, assessmentId: -8701, activityId: -8101, assessment: 'Digital Skills Pre-test', activity: 'Youth Digital Skills Bootcamp', type: 'pre_test', participantId: -8203, respondent: 'Fatou Ceesay', email: 'fatou.demo@example.com', percentage: 64, passed: true, submittedAt: '2026-08-03T09:22:00Z' },
  { id: -8903, assessmentId: -8701, activityId: -8101, assessment: 'Digital Skills Pre-test', activity: 'Youth Digital Skills Bootcamp', type: 'pre_test', participantId: -8204, respondent: 'Ousman Bah', email: 'ousman.demo@example.com', percentage: 48, passed: false, submittedAt: '2026-08-03T09:25:00Z' },
  { id: -8904, assessmentId: -8701, activityId: -8101, assessment: 'Digital Skills Pre-test', activity: 'Youth Digital Skills Bootcamp', type: 'pre_test', participantId: -8208, respondent: 'Modou Faal', email: 'modou.demo@example.com', percentage: 58, passed: false, submittedAt: '2026-08-03T09:28:00Z' },
  { id: -8905, assessmentId: -8702, activityId: -8101, assessment: 'Digital Skills Post-test', activity: 'Youth Digital Skills Bootcamp', type: 'post_test', participantId: -8201, respondent: 'Aminata Jallow', email: 'justformodapps@gmail.com', percentage: 86, passed: true, submittedAt: '2026-08-07T14:10:00Z' },
  { id: -8906, assessmentId: -8702, activityId: -8101, assessment: 'Digital Skills Post-test', activity: 'Youth Digital Skills Bootcamp', type: 'post_test', participantId: -8203, respondent: 'Fatou Ceesay', email: 'fatou.demo@example.com', percentage: 92, passed: true, submittedAt: '2026-08-07T14:12:00Z' },
  { id: -8907, assessmentId: -8702, activityId: -8101, assessment: 'Digital Skills Post-test', activity: 'Youth Digital Skills Bootcamp', type: 'post_test', participantId: -8204, respondent: 'Ousman Bah', email: 'ousman.demo@example.com', percentage: 74, passed: true, submittedAt: '2026-08-07T14:15:00Z' },
  { id: -8908, assessmentId: -8702, activityId: -8101, assessment: 'Digital Skills Post-test', activity: 'Youth Digital Skills Bootcamp', type: 'post_test', participantId: -8208, respondent: 'Modou Faal', email: 'modou.demo@example.com', percentage: 80, passed: true, submittedAt: '2026-08-07T14:18:00Z' },
  { id: -8909, assessmentId: -8703, activityId: -8103, assessment: 'M&E Clinic Knowledge Check', activity: 'Monitoring & Evaluation Clinic', type: 'quiz', participantId: -8202, respondent: 'Lamin Touray', email: 'bepro01589@gmail.com', percentage: 88, passed: true, submittedAt: '2026-08-19T15:00:00Z' },
  { id: -8910, assessmentId: -8703, activityId: -8103, assessment: 'M&E Clinic Knowledge Check', activity: 'Monitoring & Evaluation Clinic', type: 'quiz', participantId: -8204, respondent: 'Ousman Bah', email: 'ousman.demo@example.com', percentage: 72, passed: true, submittedAt: '2026-08-19T15:03:00Z' },
  { id: -8911, assessmentId: -8703, activityId: -8103, assessment: 'M&E Clinic Knowledge Check', activity: 'Monitoring & Evaluation Clinic', type: 'quiz', participantId: -8205, respondent: 'Mariama Sanyang', email: 'mariama.demo@example.com', percentage: 66, passed: false, submittedAt: '2026-08-19T15:05:00Z' },
  { id: -8912, assessmentId: -8703, activityId: -8103, assessment: 'M&E Clinic Knowledge Check', activity: 'Monitoring & Evaluation Clinic', type: 'quiz', participantId: -8208, respondent: 'Modou Faal', email: 'modou.demo@example.com', percentage: 78, passed: true, submittedAt: '2026-08-19T15:08:00Z' },
];

function average(values) {
  const nums = values.filter(value => Number.isFinite(Number(value))).map(Number);
  return nums.length ? Math.round((nums.reduce((sum, value) => sum + value, 0) / nums.length) * 100) / 100 : null;
}

function percent(part, total) {
  return total ? Math.round((part / total) * 10000) / 100 : null;
}

function matchesCommonFilters(row, filters = {}) {
  if (filters.activity && filters.activity !== 'all' && String(row.activityId) !== String(filters.activity)) return false;
  const participant = participantById.get(row.participantId);
  if (filters.category && filters.category !== 'all' && participant?.category !== filters.category) return false;
  if (filters.organization && filters.organization !== 'all' && participant?.org !== filters.organization) return false;
  if (filters.from && String(row.submittedAt).slice(0, 10) < filters.from) return false;
  if (filters.to && String(row.submittedAt).slice(0, 10) > filters.to) return false;
  return true;
}

function distribution(values, labels) {
  return labels.map(label => ({ label, value: values.filter(value => value === label).length }));
}

export function getReportPreviewAdvanced(filters = {}) {
  const filteredSurveyResponses = surveyResponses.filter(row => matchesCommonFilters(row, filters))
    .filter(row => !filters.survey || filters.survey === 'all' || String(row.surveyId) === String(filters.survey));
  const filteredAssessmentSubmissions = assessmentSubmissions.filter(row => matchesCommonFilters(row, filters))
    .filter(row => !filters.assessment || filters.assessment === 'all' || String(row.assessmentId) === String(filters.assessment));

  const surveyGroups = reportPreviewDemo.surveys
    .filter(item => !filters.survey || filters.survey === 'all' || String(item.id) === String(filters.survey))
    .filter(item => !filters.activity || filters.activity === 'all' || String(item.activity_id) === String(filters.activity))
    .map(item => ({
      id: item.id,
      title: item.title,
      activityId: item.activity_id,
      activityTitle: reportPreviewDemo.activities.find(activity => activity.id === item.activity_id)?.title || 'Standalone',
      status: item.status,
      responseCount: filteredSurveyResponses.filter(row => row.surveyId === item.id).length,
    }));

  const ratings = filteredSurveyResponses.map(row => row.rating);
  const paceValues = filteredSurveyResponses.map(row => row.pace);
  const recommendValues = filteredSurveyResponses.map(row => row.recommend);
  const surveyQuestions = [
    { id: -8611, question: 'How would you rate the overall programme?', type: 'rating', answered: ratings.length, totalResponses: filteredSurveyResponses.length, responseRate: percent(ratings.length, filteredSurveyResponses.length), average: average(ratings), distribution: [1, 2, 3, 4, 5].map(value => ({ label: String(value), value: ratings.filter(item => item === value).length })), samples: [] },
    { id: -8612, question: 'How was the pace of the sessions?', type: 'multiple_choice', answered: paceValues.length, totalResponses: filteredSurveyResponses.length, responseRate: percent(paceValues.length, filteredSurveyResponses.length), average: null, distribution: distribution(paceValues, ['Slow', 'Just right', 'Fast']), samples: [] },
    { id: -8613, question: 'Would you recommend this programme?', type: 'yes_no', answered: recommendValues.length, totalResponses: filteredSurveyResponses.length, responseRate: percent(recommendValues.length, filteredSurveyResponses.length), average: null, distribution: distribution(recommendValues, ['Yes', 'No']), samples: [] },
    { id: -8614, question: 'What should we keep or improve?', type: 'text', answered: filteredSurveyResponses.length, totalResponses: filteredSurveyResponses.length, responseRate: percent(filteredSurveyResponses.length, filteredSurveyResponses.length), average: null, distribution: [], samples: filteredSurveyResponses.slice(0, 5).map(row => row.comment) },
  ];

  const scoreValues = filteredAssessmentSubmissions.map(row => row.percentage);
  const passed = filteredAssessmentSubmissions.filter(row => row.passed).length;
  const pre = filteredAssessmentSubmissions.filter(row => row.type === 'pre_test');
  const post = filteredAssessmentSubmissions.filter(row => row.type === 'post_test');
  const matchedIds = pre.map(row => row.participantId).filter(id => post.some(row => row.participantId === id));
  const matchedPre = matchedIds.map(id => pre.find(row => row.participantId === id)?.percentage).filter(value => value != null);
  const matchedPost = matchedIds.map(id => post.find(row => row.participantId === id)?.percentage).filter(value => value != null);
  const preAverage = average(pre.map(row => row.percentage));
  const postAverage = average(post.map(row => row.percentage));
  const matchedPreAverage = average(matchedPre);
  const matchedPostAverage = average(matchedPost);

  const assessmentQuestions = [
    { id: -8711, question: 'Choose the strongest password practice.', type: 'multiple_choice', answered: filteredAssessmentSubmissions.length, responseRate: percent(filteredAssessmentSubmissions.length, filteredAssessmentSubmissions.length), correctRate: 83.33, samples: [] },
    { id: -8712, question: 'Identify the correct way to structure an indicator.', type: 'multiple_choice', answered: filteredAssessmentSubmissions.length, responseRate: percent(filteredAssessmentSubmissions.length, filteredAssessmentSubmissions.length), correctRate: 75, samples: [] },
    { id: -8713, question: 'Apply the concept to a short scenario.', type: 'short_text', answered: filteredAssessmentSubmissions.length, responseRate: percent(filteredAssessmentSubmissions.length, filteredAssessmentSubmissions.length), correctRate: null, samples: ['Clear practical application with measurable outcome.', 'Correct idea but the indicator needs a timeframe.'] },
  ];

  return {
    surveys: {
      summary: { surveyCount: surveyGroups.length, responseCount: filteredSurveyResponses.length, averageRating: average(ratings), ratingQuestionCount: 1 },
      surveys: surveyGroups,
      questions: surveyQuestions,
      responseRecords: filteredSurveyResponses.map(row => ({ ...row, answered: 4 })),
      insights: filteredSurveyResponses.length ? [`${filteredSurveyResponses.length} demo survey responses match the current preview filters.`, `Average satisfaction is ${average(ratings)?.toFixed(2) || '—'} out of 5.`] : [],
      dataQuality: ['Preview demo data is synthetic and exists only to exercise the reporting interface.'],
    },
    assessments: {
      summary: { assessmentCount: new Set(filteredAssessmentSubmissions.map(row => row.assessmentId)).size, submissionCount: filteredAssessmentSubmissions.length, averageScore: average(scoreValues), passRate: percent(passed, filteredAssessmentSubmissions.length) },
      questions: assessmentQuestions,
      submissionRecords: filteredAssessmentSubmissions,
      prePost: {
        preCount: pre.length,
        postCount: post.length,
        preAverage,
        postAverage,
        aggregateChange: preAverage == null || postAverage == null ? null : Math.round((postAverage - preAverage) * 100) / 100,
        matchedParticipants: matchedIds.length,
        matchedPreAverage,
        matchedPostAverage,
        matchedChange: matchedPreAverage == null || matchedPostAverage == null ? null : Math.round((matchedPostAverage - matchedPreAverage) * 100) / 100,
      },
      insights: filteredAssessmentSubmissions.length ? [`${filteredAssessmentSubmissions.length} demo assessment submissions match the current preview filters.`, `${percent(passed, filteredAssessmentSubmissions.length)?.toFixed(2) || '0'}% of the filtered submissions meet their assessment pass requirement.`] : [],
      dataQuality: ['Preview demo assessment results are synthetic and are not written to Neon.'],
    },
  };
}

export function mixReportingPreviewData(data = {}) {
  if (!isReportingPreviewDemo()) return data;
  return {
    ...data,
    activities: [...(data.activities || []), ...reportPreviewDemo.activities],
    participants: [...(data.participants || []), ...reportPreviewDemo.participants],
    registrations: [...(data.registrations || []), ...reportPreviewDemo.registrations],
    attendance: [...(data.attendance || []), ...reportPreviewDemo.attendance],
    certificates: [...(data.certificates || []), ...reportPreviewDemo.certificates],
    surveys: [...(data.surveys || []), ...reportPreviewDemo.surveys],
    assessments: [...(data.assessments || []), ...reportPreviewDemo.assessments],
  };
}
