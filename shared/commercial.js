export const PHASE_TWO_ENTITLEMENTS = Object.freeze({
  free: Object.freeze({
    sessionCsvImport: false,
    reportsPerActivity: 1,
    customReportTemplates: false,
    narrativeGeneration: false,
    reportApprovals: false,
    reportStructureEditing: false,
  }),
  pro: Object.freeze({
    sessionCsvImport: true,
    reportsPerActivity: 25,
    customReportTemplates: true,
    narrativeGeneration: true,
    reportApprovals: true,
    reportStructureEditing: true,
  }),
});

export function phaseTwoEntitlements(plan) {
  return PHASE_TWO_ENTITLEMENTS[plan === 'pro' ? 'pro' : 'free'];
}

export function canCreateActivityReport(currentReports, entitlements) {
  return Number(currentReports || 0) < Number(entitlements?.reportsPerActivity || 0);
}

export function isBasicReportStatus(status) {
  return String(status || 'draft') === 'draft';
}
