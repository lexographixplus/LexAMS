export function printCertificate(title) {
  const body = document.body;
  const root = document.documentElement;
  const originalTitle = document.title;

  function finishPrinting() {
    body.classList.remove('certificate-printing');
    root.classList.remove('certificate-printing');
    document.title = originalTitle;
    window.removeEventListener('afterprint', finishPrinting);
  }

  if (title) document.title = String(title).replace(/[\\/:*?"<>|]+/g, '-');
  body.classList.add('certificate-printing');
  root.classList.add('certificate-printing');
  window.addEventListener('afterprint', finishPrinting);
  window.print();

  // Some mobile browsers do not dispatch afterprint after their share sheet closes.
  window.setTimeout(finishPrinting, 30000);
}
