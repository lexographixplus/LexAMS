import assert from 'node:assert/strict';
import test from 'node:test';
import { printCertificate } from '../src/lib/printCertificate.js';

function fakeClassList() {
  const classes = new Set();
  return {
    add: value => classes.add(value),
    contains: value => classes.has(value),
    remove: value => classes.delete(value),
  };
}

test('certificate print mode isolates the document and restores its title', () => {
  const bodyClassList = fakeClassList();
  const rootClassList = fakeClassList();
  let afterPrint;
  let printCalls = 0;

  global.document = {
    title: 'LexAMS - Activity Management System',
    body: { classList: bodyClassList },
    documentElement: { classList: rootClassList },
  };
  global.window = {
    addEventListener: (event, callback) => {
      if (event === 'afterprint') afterPrint = callback;
    },
    removeEventListener: () => {},
    print: () => { printCalls += 1; },
    setTimeout: () => 1,
  };

  try {
    printCertificate('DEMO/2026:001 - Fatou Ceesay');

    assert.equal(printCalls, 1);
    assert.equal(document.title, 'DEMO-2026-001 - Fatou Ceesay');
    assert.equal(bodyClassList.contains('certificate-printing'), true);
    assert.equal(rootClassList.contains('certificate-printing'), true);

    afterPrint();

    assert.equal(document.title, 'LexAMS - Activity Management System');
    assert.equal(bodyClassList.contains('certificate-printing'), false);
    assert.equal(rootClassList.contains('certificate-printing'), false);
  } finally {
    delete global.document;
    delete global.window;
  }
});
