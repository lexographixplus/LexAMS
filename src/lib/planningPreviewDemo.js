const members = [
  { id: 'preview-manager', name: 'Neneh Sowe', email: 'neneh@example.invalid', role: 'programme_manager' },
  { id: 'preview-facilitator-1', name: 'Ebrima Njie', email: 'ebrima@example.invalid', role: 'facilitator' },
  { id: 'preview-facilitator-2', name: 'Awa Ceesay', email: 'awa@example.invalid', role: 'facilitator' },
  { id: 'preview-me', name: 'Mariama Sanyang', email: 'mariama@example.invalid', role: 'me_officer' },
];

const tasks = [
  { id: -9201, title: 'Confirm venue and accessibility', description: 'Complete the venue checklist and confirm room layout.', stage: 'pre', assignee_user_id: 'preview-manager', assignee_name: 'Neneh Sowe', due_date: '2026-08-01', priority: 'high', status: 'done', sort_order: 0 },
  { id: -9202, title: 'Prepare participant workbooks', description: 'Print and pack one workbook for every confirmed participant.', stage: 'pre', assignee_user_id: 'preview-facilitator-1', assignee_name: 'Ebrima Njie', due_date: '2026-08-02', priority: 'medium', status: 'done', sort_order: 1 },
  { id: -9203, title: 'Test presentation equipment', description: 'Test projector, sound and backup power before opening.', stage: 'pre', assignee_user_id: 'preview-facilitator-2', assignee_name: 'Awa Ceesay', due_date: '2026-08-03', priority: 'urgent', status: 'in_progress', sort_order: 2 },
  { id: -9204, title: 'Record weekly delivery highlights', description: 'Capture achievements, challenges and follow-up actions each week.', stage: 'during', assignee_user_id: 'preview-me', assignee_name: 'Mariama Sanyang', due_date: '2026-08-17', priority: 'high', status: 'in_progress', sort_order: 0 },
  { id: -9205, title: 'Review participant feedback', description: 'Summarise survey themes for the close-out discussion.', stage: 'post', assignee_user_id: 'preview-me', assignee_name: 'Mariama Sanyang', due_date: '2026-08-22', priority: 'medium', status: 'todo', sort_order: 0 },
];

const sessions = [
  { id: -9301, title: 'Orientation and digital foundations', session_date: '2026-08-03', starts_at: '09:00', ends_at: '12:30', venue: 'Training room A', description: 'Welcome, expectations and baseline digital skills.', learning_objectives: 'Participants can navigate the learning platform and apply safe account practices.', planning_status: 'ready', status: 'scheduled', sort_order: 0, facilitators: [{ user_id: 'preview-facilitator-1', name: 'Ebrima Njie', email: 'ebrima@example.invalid', is_lead: true, role_label: 'Lead facilitator' }] },
  { id: -9302, title: 'Productivity tools in practice', session_date: '2026-08-04', starts_at: '09:00', ends_at: '15:30', venue: 'Training room A', description: 'Hands-on document, spreadsheet and collaboration exercises.', learning_objectives: 'Participants create and share a structured work product.', planning_status: 'ready', status: 'scheduled', sort_order: 1, facilitators: [{ user_id: 'preview-facilitator-2', name: 'Awa Ceesay', email: 'awa@example.invalid', is_lead: true, role_label: 'Lead facilitator' }, { user_id: 'preview-facilitator-1', name: 'Ebrima Njie', email: 'ebrima@example.invalid', is_lead: false, role_label: 'Facilitator' }] },
  { id: -9303, title: 'Digital communication clinic', session_date: '2026-08-10', starts_at: '09:00', ends_at: '13:00', venue: 'Training room B', description: 'Practical communication planning and content exercises.', learning_objectives: 'Participants prepare a clear audience-focused message.', planning_status: 'delivered', status: 'closed', sort_order: 2, facilitators: [{ user_id: 'preview-facilitator-1', name: 'Ebrima Njie', email: 'ebrima@example.invalid', is_lead: true, role_label: 'Lead facilitator' }] },
  { id: -9304, title: 'Data and spreadsheet lab', session_date: '2026-08-12', starts_at: '09:00', ends_at: '15:30', venue: 'Innovation lab', description: 'Teams clean, organise and interpret a small programme dataset.', learning_objectives: 'Participants can structure data and produce a useful summary.', planning_status: 'ready', status: 'scheduled', sort_order: 3, facilitators: [{ user_id: 'preview-facilitator-2', name: 'Awa Ceesay', email: 'awa@example.invalid', is_lead: true, role_label: 'Lead facilitator' }, { user_id: 'preview-me', name: 'Mariama Sanyang', email: 'mariama@example.invalid', is_lead: false, role_label: 'M&E support' }] },
  { id: -9305, title: 'Community project studio', session_date: '2026-08-17', starts_at: '09:00', ends_at: '15:30', venue: 'Innovation lab', description: 'Teams apply the programme learning to a community challenge.', learning_objectives: 'Teams produce and test a practical digital solution.', planning_status: 'draft', status: 'scheduled', sort_order: 4, facilitators: [] },
  { id: -9306, title: 'Project showcase and reflection', session_date: '2026-08-20', starts_at: '10:00', ends_at: '14:00', venue: 'Main hall', description: 'Team presentations, peer feedback and closing reflection.', learning_objectives: 'Participants present their solution and identify next steps.', planning_status: 'draft', status: 'scheduled', sort_order: 5, facilitators: [{ user_id: 'preview-facilitator-1', name: 'Ebrima Njie', email: 'ebrima@example.invalid', is_lead: true, role_label: 'Lead facilitator' }, { user_id: 'preview-facilitator-2', name: 'Awa Ceesay', email: 'awa@example.invalid', is_lead: false, role_label: 'Facilitator' }] },
];

const budgetItems = [
  { id: -9401, category: 'Venue', item_name: 'Training venue hire', planned_amount: 18000, actual_amount: 18000, evidence_date: '2026-08-03', notes: 'Three-week programme venue package.', evidence_url: 'https://example.invalid/evidence/venue', created_by: 'preview-manager' },
  { id: -9402, category: 'Catering', item_name: 'Participant refreshments', planned_amount: 12000, actual_amount: 13850, evidence_date: '2026-08-12', notes: 'Attendance was higher during the practical labs.', evidence_url: '', created_by: 'preview-manager' },
  { id: -9403, category: 'Materials', item_name: 'Workbooks and printing', planned_amount: 6500, actual_amount: 5900, evidence_date: '2026-08-02', notes: 'Printed in two batches to reduce waste.', evidence_url: '', created_by: 'preview-manager' },
  { id: -9404, category: 'Transport', item_name: 'Facilitator transport', planned_amount: 8000, actual_amount: 7200, evidence_date: '2026-08-17', notes: '', evidence_url: '', created_by: 'preview-manager' },
  { id: -9405, category: 'Communications', item_name: 'Mobile data support', planned_amount: null, actual_amount: 1500, evidence_date: '2026-08-10', notes: 'Unplanned support for two participants.', evidence_url: '', created_by: 'preview-manager' },
];

const journalEntries = [
  { id: -9503, entry_mode: 'daily', entry_date: '2026-08-17', period_end: null, progress_summary: 'Project teams moved from ideas into working prototypes and completed their first peer review.', achievements: 'All four teams produced a testable prototype before the end of the studio.', challenges: 'One team needs extra access to a laptop before the showcase.', observations_lessons: 'Short peer-review rounds produced more specific feedback than the larger plenary format.', actions_follow_up: 'Confirm a spare laptop and assign a 30-minute support slot on Wednesday.', follow_up_status: 'open', evidence_url: 'https://example.invalid/evidence/project-studio', include_in_report: true, created_by: 'preview-me', author_name: 'Mariama Sanyang', linked_sessions: [{ id: -9305, title: 'Community project studio', session_date: '2026-08-17' }], linked_tasks: [{ id: -9204, title: 'Record weekly delivery highlights', status: 'in_progress' }] },
  { id: -9502, entry_mode: 'weekly', entry_date: '2026-08-10', period_end: '2026-08-16', progress_summary: 'Week two focused on communication and data practice, with strong participation in both applied labs.', achievements: 'Participants completed a communications plan and analysed a sample programme dataset.', challenges: 'The practical lab ran longer than planned because several participants needed additional spreadsheet support.', observations_lessons: 'Keeping the same working groups across sessions improved peer support.', actions_follow_up: 'Provide a simplified spreadsheet reference sheet before week three.', follow_up_status: 'resolved', evidence_url: '', include_in_report: true, created_by: 'preview-me', author_name: 'Mariama Sanyang', linked_sessions: [{ id: -9303, title: 'Digital communication clinic', session_date: '2026-08-10' }, { id: -9304, title: 'Data and spreadsheet lab', session_date: '2026-08-12' }], linked_tasks: [] },
  { id: -9501, entry_mode: 'weekly', entry_date: '2026-08-03', period_end: '2026-08-09', progress_summary: 'The first week established programme expectations and baseline digital productivity skills.', achievements: 'Every participant accessed the learning tools and completed the first practical exercise.', challenges: '', observations_lessons: 'Participants responded best when demonstrations were followed immediately by guided practice.', actions_follow_up: '', follow_up_status: 'not_required', evidence_url: '', include_in_report: true, created_by: 'preview-manager', author_name: 'Neneh Sowe', linked_sessions: [{ id: -9301, title: 'Orientation and digital foundations', session_date: '2026-08-03' }, { id: -9302, title: 'Productivity tools in practice', session_date: '2026-08-04' }], linked_tasks: [{ id: -9201, title: 'Confirm venue and accessibility', status: 'done' }] },
];

export function getPlanningPreview(activity = {}) {
  return {
    activity: {
      id: activity.id,
      title: activity.title || 'Youth Digital Skills Bootcamp',
      status: activity.status || 'Upcoming',
      start_date: activity.start_date || '2026-08-03',
      end_date: activity.end_date || '2026-08-21',
      venue: activity.venue || 'Community Learning Centre',
      description: activity.description || 'A practical multi-day digital skills training for youth leaders.',
      budget_currency: activity.budget_currency || 'GMD',
    },
    tasks: tasks.map(task => ({ ...task })),
    sessions: sessions.map(session => ({ ...session, facilitators: session.facilitators.map(person => ({ ...person })) })),
    members: members.map(member => ({ ...member })),
    budgetItems: budgetItems.map(item => ({ ...item })),
    journalEntries: journalEntries.map(entry => ({ ...entry, linked_sessions: entry.linked_sessions.map(session => ({ ...session })), linked_tasks: entry.linked_tasks.map(task => ({ ...task })) })),
    permissions: {
      canManagePlanning: false,
      canUpdateAssignedTasks: false,
      canManageBudget: false,
      canCreateJournal: false,
      currentUserId: 'preview-user',
      role: 'owner',
      readOnlyPreview: true,
    },
  };
}
