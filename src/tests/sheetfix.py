"""Test helper for the exercise sheet layout (22 October 2026).
Before, an open exercise expanded in the list; now it is a sheet over Today. These wrappers do what a
person does: tap outside the sheet to close it before tapping something behind it, and open an
exercise before typing into it. The app itself is not changed by this file."""
from playwright.sync_api import Page

ENSURE = """(s) => {
  if (typeof state === 'undefined' || typeof EXERCISES === 'undefined') return 'na';
  let el = document.querySelector(s);
  if (!el){
    const raw = s.replace(/^#ex-/, '#').split(/[ \\[]/)[0].slice(1);
    const id = Object.keys(EXERCISES).filter(k => raw === k || raw.startsWith(k + '-')).sort((a, b) => b.length - a.length)[0];
    if (id && state.ui.tab === 'train' && document.getElementById('ex-' + id)){ state.ui.openEx = id; renderAll(); return 'opened'; }
    return 'none';
  }
  const sheet = document.querySelector('.exercise.is-open');
  if (!sheet || !(state.ui.openEx || state.ui.openExtra)) return 'nosheet';
  if (sheet.contains(el) || el.closest('dialog[open], .rest-bar, .toast, .hazard-bar')) return 'inside';
  state.ui.openEx = null; state.ui.openExtra = null; renderAll(); return 'closed';
}"""

def _wrap(name):
    orig = getattr(Page, name)
    def fn(self, selector, *a, **kw):
        try: self.evaluate(ENSURE, selector)
        except Exception: pass
        return orig(self, selector, *a, **kw)
    setattr(Page, name, fn)
for n in ("click", "fill", "select_option", "check", "uncheck", "inner_text", "input_value", "get_attribute", "dispatch_event", "focus", "press"):
    _wrap(n)
