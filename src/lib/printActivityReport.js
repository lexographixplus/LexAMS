export function printActivityReport(title) {
  const body = document.body;
  const root = document.documentElement;
  const originalTitle = document.title;

  function finishPrinting() {
    body.classList.remove('activity-report-printing');
    root.classList.remove('activity-report-printing');
    document.title = originalTitle;
    window.removeEventListener('afterprint', finishPrinting);
  }

  if (title) document.title = String(title).replace(/[\\/:*?"<>|]+/g, '-');
  body.classList.add('activity-report-printing');
  root.classList.add('activity-report-printing');
  window.addEventListener('afterprint', finishPrinting);
  window.print();

  // Mobile share sheets do not consistently dispatch afterprint.
  window.setTimeout(finishPrinting, 30000);
}
