/**
 * Inspections are done on a phone, in a stairwell, often one-handed — tabs get
 * backgrounded and killed, and a stray refresh shouldn't cost someone eight
 * analysed photos. Only the id is kept locally: the inspection itself (photos,
 * verdicts, contact details) already lives on the server, so recovery is a
 * re-fetch rather than a client-side copy of someone's personal data.
 */
export const ACTIVE_INSPECTION_KEY = 'aed_active_inspection';

/** Set by RESUME_PROBE before first paint while a saved inspection may be
 *  restored, so the server-rendered form and landing stay hidden instead of
 *  flashing up and vanishing. Cleared by the app once the restore settles. */
export const RESUMING_ATTR = 'data-resuming';

/**
 * Runs inline, ahead of the form, on the server-rendered home page. The form
 * is in the HTML from the start (for search engines, and so it paints without
 * waiting on JavaScript); this hides it in the one case it shouldn't show: a
 * hand-off link or a saved inspection that is about to be restored.
 * Kept out of the app's 'use client' module so the server page can read it.
 */
export const RESUME_PROBE = `try{var q=new URLSearchParams(location.search).get('resume');if((q&&/^[0-9a-f-]{36}$/i.test(q))||localStorage.getItem('${ACTIVE_INSPECTION_KEY}'))document.documentElement.setAttribute('${RESUMING_ATTR}','')}catch(e){}`;
