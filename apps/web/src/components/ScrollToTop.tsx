import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * BrowserRouter does not scroll to top on navigation by default, so users land
 * mid-page after clicking a link from a long screen. Reset scroll when the
 * location changes (path or query).
 */
export function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname, search]);

  return null;
}
