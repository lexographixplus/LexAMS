import { useEffect } from 'react';

const SUFFIX = 'LexAMS';

/**
 * Sets the browser tab title for a screen. Pass null or an empty string while a
 * title is still being resolved (an activity name still loading, for example) so
 * the previous title is kept rather than replaced with a placeholder.
 */
export default function useDocumentTitle(title) {
  useEffect(() => {
    if (!title) return;
    document.title = `${title} · ${SUFFIX}`;
  }, [title]);
}
