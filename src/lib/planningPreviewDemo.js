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
  { id: -9204, title: 'Record daily delivery highlights', description: 'Capture achievements, challenges and follow-up actions.', stage: 'during', assignee_user_id: 'preview-me', assignee_name: 'Mariama Sanyang', due_date: '2026-08-07', priority: 'high', status: 'in_progress', sort_order: 0 },
  { id: -9205, title: 'Review participant feedback', description: 'Summarise survey themes for the close-out discussion.', stage: 'post', assignee_user_id: 'preview-me', assignee_name: 'Mariama Sanyang', due_date: '2026-08-09', priority: 'medium', status: 'todo', sort_order: 0 },
];

const sessions = [
  { id: -9301, title: 'Orientation and digital foundations', session_date: '2026-08-03', starts_at: '09:00', ends_at: '12:30', venue: 'Training room A', description: 'Welcome, expectations and baseline digital skills.', learning_objectives: 'Participants can navigate the learning platform and apply safe account practices.', planning_status: 'ready', status: 'scheduled', sort_order: 0, facilitators: [{ user_id: 'preview-facilitator-1', name: 'Ebrima Njie', email: 'ebrima@example.invalid', is_lead: true, role_label: 'Lead facilitator' }] },
  { id: -9302, title: 'Productivity tools in practice', session_date: '2026-08-04', starts_at: '09:00', ends_at: '15:30', venue: 'Training room A', description: 'Hands-on document, spreadsheet and collaboration exercises.', learning_objectives: 'Participants create and share a structured work product.', planning_status: 'ready', status: 'scheduled', sort_order: 1, facilitators: [{ user_id: 'preview-facilitator-2', name: 'Awa Ceesay', email: 'awa@example.invalid', is_lead: true, role_label: 'Lead facilitator' }, { user_id: 'preview-facilitator-1', name: 'Ebrima Njie', email: 'ebrima@example.invalid', is_lead: false, role_label: 'Facilitator' }] },
  { id: -9303, title: 'Community project studio', session_date: '2026-08-06', starts_at: '09:00', ends_at: '15:30', venue: 'Innovation lab', description: 'Teams apply the week’s learning to a community challenge.', learning_objectives: 'Teams produce and present a practical digital solution.', planning_status: 'draft', status: 'scheduled', sort_order: 2, facilitators: [] },
];

export function getPlanningPreview(activity = {}) {
  return {
    activity: {
      id: activity.id,
      title: activity.title || 'Youth Digital Skills Bootcamp',
      status: activity.status || 'Upcoming',
      start_date: activity.start_date || '2026-08-03',
      end_date: activity.end_date || '2026-08-07',
      venue: activity.venue || 'Community Learning Centre',
      description: activity.description || 'A practical multi-day digital skills training for youth leaders.',
    },
    tasks: tasks.map(task => ({ ...task })),
    sessions: sessions.map(session => ({ ...session, facilitators: session.facilitators.map(person => ({ ...person })) })),
    members: members.map(member => ({ ...member })),
    permissions: {
      canManagePlanning: false,
      canUpdateAssignedTasks: false,
      currentUserId: 'preview-user',
      role: 'owner',
      readOnlyPreview: true,
    },
  };
}
