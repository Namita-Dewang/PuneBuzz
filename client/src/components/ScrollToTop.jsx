import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router';

// BrowserRouter keeps the scroll position between pages, so saving a long
// form used to land you halfway down the next page (under the sticky navbar).
// Jump to the top when the path changes, except on Back/Forward (POP), where
// the browser restores the previous position itself. Query-string changes
// (filters, pagination, tabs) don't count; those pages manage their own scroll.
export default function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType !== 'POP') window.scrollTo(0, 0);
  }, [pathname, navigationType]);

  return null;
}
