"""Writes theme.css: every design token for the app. build.py inlines it into the page.
Sources: the 8 existing palettes (palettes.json, read from the app before this change) and the
Tempo palette chosen from the theme previews. Style rules follow the Summit preview."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))

def mix(h1, h2, t):
    a = [int(h1[i:i + 2], 16) for i in (1, 3, 5)]; b = [int(h2[i:i + 2], 16) for i in (1, 3, 5)]
    return "#%02X%02X%02X" % tuple(round(x * (1 - t) + y * t) for x, y in zip(a, b))

ORDER = ["bg", "surface", "surface-alt", "surface-raised", "fill-track", "text", "text-muted", "border", "border-control", "accent", "on-accent", "accent-soft", "accent-text",
         "metric-1", "metric-2", "metric-3", "metric-4", "grad-start", "grad-end",
         "success", "on-success", "success-soft", "best", "on-best", "best-line", "missed", "danger", "on-danger", "hazard", "on-hazard", "inverse-bg", "inverse-text", "focus", "scrim", "canvas"]
# Five multi-colour themes (from the Fitness-style concept, 22 October 2026). Metric colours always mean:
# 1 sets and volume, 2 rest and time, 3 exercises and the week, 4 personal bests.
SETS = {
 "pulse": ("Pulse", "Coral, lime, cyan and amber on true black. High energy.",
   dict(bg="#F2F2F5", surface="#FFFFFF", inset="#ECECF1", raised="#FFFFFF", track="#E2E2E8", sep="#D8D8DF", ctrl="#7C7C86", text="#0B0B0F", muted="#585862", accent="#BC0C35", onaccent="#FFFFFF", m1="#C8123C", m2="#3D7300", m3="#006F86", m4="#8A5800", g1="#FF2E63", g2="#FF8A5B"),
   dict(bg="#000000", surface="#1A1A1E", inset="#26262B", raised="#222227", track="#2E2E34", sep="#2C2C32", ctrl="#6E6E78", text="#F5F5F7", muted="#A1A1AA", accent="#FF4D6D", onaccent="#1A0009", m1="#FF4D6D", m2="#B6F34A", m3="#3FD7F5", m4="#FFC23D", g1="#FF2E63", g2="#FF9A6B")),
 "dune": ("Dune", "Terracotta, saffron, sage and rose on warm sand and espresso.",
   dict(bg="#F6F0E7", surface="#FFFDF9", inset="#F0E8DC", raised="#FFFDF9", track="#E6DCCD", sep="#DED2C1", ctrl="#857560", text="#1E150D", muted="#625545", accent="#A6461B", onaccent="#FFFFFF", m1="#A6461B", m2="#855A00", m3="#3F6B3D", m4="#A33A3A", g1="#D9622B", g2="#F2B04E"),
   dict(bg="#0D0A07", surface="#1E1914", inset="#2A231C", raised="#251F19", track="#322A22", sep="#3A3028", ctrl="#7E705E", text="#F7F0E6", muted="#B5A893", accent="#EE8A55", onaccent="#1E0B02", m1="#EE8A55", m2="#F2C14E", m3="#9CC79A", m4="#F59A9A", g1="#EE7A45", g2="#F2C14E")),
 "glacier": ("Glacier", "Ice blue, mint, periwinkle and lemon on cold slate.",
   dict(bg="#EDF2F7", surface="#FFFFFF", inset="#E6EDF4", raised="#FFFFFF", track="#DAE3EC", sep="#D2DCE6", ctrl="#718395", text="#0A1420", muted="#4E5D6E", accent="#0B63A8", onaccent="#FFFFFF", m1="#0B63A8", m2="#00715D", m3="#4A49B8", m4="#6B6100", g1="#1E8FE0", g2="#3CCFB4"),
   dict(bg="#04080C", surface="#111A22", inset="#1B2630", raised="#16202A", track="#22303C", sep="#25333F", ctrl="#647A8E", text="#EEF4F9", muted="#9DAEBF", accent="#5CC8FF", onaccent="#00121F", m1="#5CC8FF", m2="#64E6C8", m3="#A3ABFF", m4="#E6EE7A", g1="#4FB4FF", g2="#64E6C8")),
 "forge": ("Forge", "Molten orange, steel blue, brass and ember on graphite.",
   dict(bg="#ECECEE", surface="#FFFFFF", inset="#E5E5E8", raised="#FFFFFF", track="#DADADE", sep="#D2D2D7", ctrl="#76787F", text="#111214", muted="#55575D", accent="#A84200", onaccent="#FFFFFF", m1="#A84200", m2="#1D5FA8", m3="#7A5800", m4="#B3261E", g1="#E85D04", g2="#FFB02E"),
   dict(bg="#090909", surface="#1A1B1D", inset="#252629", raised="#202124", track="#2D2E32", sep="#2E2F33", ctrl="#6F7178", text="#F4F4F5", muted="#A3A5AB", accent="#FF7A1A", onaccent="#1A0A00", m1="#FF7A1A", m2="#6FB6FF", m3="#E8C468", m4="#FF6B60", g1="#FF6A00", g2="#FFC04D")),
 "bloom": ("Bloom", "Magenta, leaf, sunflower and ocean on soft plum.",
   dict(bg="#F6F0F7", surface="#FFFFFF", inset="#EFE7F1", raised="#FFFFFF", track="#E5DAE8", sep="#DDD0E1", ctrl="#7D6F85", text="#1A0F1F", muted="#5E5066", accent="#B0127A", onaccent="#FFFFFF", m1="#B0127A", m2="#2D7535", m3="#7A5800", m4="#0A62A8", g1="#E0258F", g2="#8A5CF6"),
   dict(bg="#0A0610", surface="#1C1424", inset="#271D31", raised="#22192B", track="#30253B", sep="#33283E", ctrl="#7A6C86", text="#F8F0FA", muted="#B4A3BF", accent="#FF5FBF", onaccent="#1F0014", m1="#FF5FBF", m2="#7EE08A", m3="#FFD447", m4="#5DB8FF", g1="#FF4FB8", g2="#A47CFF")),
}
COMMON = {
 "light": {"success": "#1C7440", "on-success": "#FFFFFF", "success-soft": "#DDF2E5", "danger": "#B42318", "on-danger": "#FFFFFF", "hazard": "#FFD21F", "on-hazard": "#111111", "scrim": "rgba(8, 10, 14, .45)"},
 "dark": {"success": "#3CCB79", "on-success": "#03140A", "success-soft": "#10291B", "danger": "#FF7B6F", "on-danger": "#1A0503", "hazard": "#FFD21F", "on-hazard": "#111111", "scrim": "rgba(0, 0, 0, .65)"}}
def roles(p, mode):
    d = {"bg": p["bg"], "surface": p["surface"], "surface-alt": p["inset"], "surface-raised": p["raised"], "fill-track": p["track"], "text": p["text"], "text-muted": p["muted"],
         "border": p["sep"], "border-control": p["ctrl"], "accent": p["accent"], "on-accent": p["onaccent"],
         "accent-soft": mix(p["surface"], p["accent"], .12 if mode == "light" else .18), "accent-text": p["accent"] if mode == "light" else mix(p["accent"], "#FFFFFF", .15),
         "metric-1": p["m1"], "metric-2": p["m2"], "metric-3": p["m3"], "metric-4": p["m4"], "grad-start": p["g1"], "grad-end": p["g2"],
         "best": mix(p["surface"], p["m4"], .2 if mode == "light" else .24), "on-best": p["text"], "best-line": p["m4"], "missed": p["muted"],
         "inverse-bg": p["text"], "inverse-text": p["surface"], "focus": p["text"]}
    d.update(COMMON[mode]); return d

# Canvas: the picture under the cards, one per theme (a stack of CSS gradients, nothing downloaded).
# Every layer is a low-strength tint of the theme's own colours, so text sitting straight on the canvas keeps its contrast.
def tint(var, pct): return "color-mix(in srgb, var(--color-%s) %d%%, transparent)" % (var, pct)
def canvas(name, mode):
    s = 1 if mode == "light" else 1.25
    t = lambda var, pct: tint(var, round(pct * s))
    if name == "pulse":   # two glows: coral from the top right, cyan from the bottom left
        return "radial-gradient(110%% 55%% at 100%% 0%%, %s, transparent 70%%), radial-gradient(90%% 50%% at 0%% 100%%, %s, transparent 70%%)" % (t("grad-start", 16), t("metric-3", 11))
    if name == "dune":    # warm sun over soft sand ripples
        return "radial-gradient(130%% 45%% at 50%% 0%%, %s, transparent 70%%), repeating-linear-gradient(168deg, transparent 0 26px, %s 26px 27px)" % (t("grad-end", 20), t("accent", 6))
    if name == "glacier": # cold light from above over a faint ice grid
        return "linear-gradient(180deg, %s, transparent 45%%), linear-gradient(90deg, %s 1px, transparent 1px) 0 0 / 32px 32px, linear-gradient(0deg, %s 1px, transparent 1px) 0 0 / 32px 32px" % (t("grad-start", 14), t("metric-1", 7), t("metric-1", 7))
    if name == "forge":   # diagonal steel hatch with embers glowing from the bottom
        return "radial-gradient(110%% 40%% at 50%% 100%%, %s, transparent 70%%), repeating-linear-gradient(135deg, transparent 0 11px, %s 11px 12px)" % (t("grad-start", 16), t("text", 4))
    return "radial-gradient(70%% 40%% at 12%% 8%%, %s, transparent 70%%), radial-gradient(60%% 40%% at 95%% 45%%, %s, transparent 70%%), radial-gradient(70%% 40%% at 15%% 95%%, %s, transparent 70%%)" % (t("grad-start", 15), t("grad-end", 13), t("metric-3", 9))   # bloom: soft petals
PAL = {k: {"light": dict(roles(v[2], "light"), canvas=canvas(k, "light")), "dark": dict(roles(v[3], "dark"), canvas=canvas(k, "dark"))} for k, v in SETS.items()}
NAMES = [k for k in SETS if k != "pulse"]

def block(d, indent="  "):
    return "\n".join("%s--%s%s: %s;" % (indent, "" if k == "canvas" else "color-", k, d[k]) for k in ORDER)

css = ['''/* =====================================================================
   THEME: design tokens for the whole app (Fitness style, five multi-colour themes)
   Edit here, then run build.py: it inlines this file into index.html so the
   app still works as one offline file. Components read only these tokens.
   ===================================================================== */
:root{
  /* Type: system fonts only, nothing downloaded */
  --font-family-body: -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, Arial, sans-serif;
  --font-family-numeral: ui-rounded, "SF Pro Rounded", -apple-system, system-ui, "Segoe UI", Roboto, Arial, sans-serif;
  --font-size-xs: 12px;          /* tags, counts, badges */
  --font-size-small: 14px;       /* secondary text */
  --font-size-base: 16px;        /* body */
  --font-size-large: 20px;       /* section and session titles */
  --font-size-title: 34px;       /* large page titles */
  --font-size-section: 22px;     /* section titles */
  --font-size-metric: 28px;      /* colour-coded numbers */
  --font-size-numeral: 22px;     /* set inputs */
  --font-size-timer: 28px;       /* rest timer */
  --font-weight-normal: 400;
  --font-weight-bold: 600;
  --font-weight-heavy: 700;      /* page titles and numbers (was 800: too heavy) */
  --line-height-base: 1.45;
  --line-height-tight: 1.2;
  --letter-spacing-tight: -.02em;
  /* Spacing: 8px scale with a 4px half step */
  --space-0-5: 4px;
  --space-1: 8px;
  --space-1-5: 12px;
  --space-2: 16px;
  --space-3: 24px;
  --space-4: 32px;
  --space-5: 40px;
  --space-6: 48px;
  /* Sizes */
  --size-tap: 44px;              /* minimum touch target */
  --size-input: 56px;
  --size-input-height: 52px;     /* set inputs and steppers: bigger for sweaty thumbs */
  --size-badge: 30px;
  --size-status: 30px;
  --size-icon: 22px;
  --size-content-max: 960px;
  --size-dialog-max: 560px;
  --size-nav: 64px;
  --size-ring-summary: 104px;
  --size-sheet-top: 96px;        /* space kept above the exercise sheet */
  --size-grabber: 40px;
  --size-progress: 8px;
  --size-chevron: 10px;
  --size-check: 22px;
  --size-textarea: 120px;
  --size-tile: 72px;
  --size-tile-min: 88px;
  --size-stepper-min: 128px;
  --size-select-min: 160px;
  --size-table-min: 640px;
  --size-rest-clearance: 72px;   /* toast sits below the rest bar */
  --size-hazard-default: 96px;
  --border-width: 1px;
  --border-width-control: 1.5px;
  --border-width-strong: 2px;
  --border-width-marker: 4px;
  --focus-width: 3px;
  --focus-offset: 2px;
  --ring-stroke: 6px;
  /* Shape */
  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-lg: 22px;
  --radius-pill: 999px;
  --radius-round: 50%;
  /* Motion: 150 to 250ms, eased; all off with reduced motion */
  --ease: cubic-bezier(.2, .8, .2, 1);
  --duration-fast: 150ms;
  --duration-med: 200ms;
  --duration-slow: 250ms;
  --press-scale: scale(.97);
  /* Depth (light): layered shadows */
  --shadow-1: 0 1px 2px rgba(16, 24, 40, .06);
  --shadow-2: 0 1px 2px rgba(16, 24, 40, .06), 0 6px 18px rgba(16, 24, 40, .08);
  --shadow-3: 0 12px 32px rgba(16, 24, 40, .18);
  --color-card-border: var(--color-border);
  --blur-bar: saturate(180%) blur(20px);
  --nav-opacity: 90%;
}
/* Depth (dark): no shadows on cards; lighter surfaces on a near-black base do the work */
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){ --shadow-1: none; --shadow-2: none; --shadow-3: 0 12px 32px rgba(0, 0, 0, .6); --color-card-border: transparent; }
}
:root[data-theme="dark"]{ --shadow-1: none; --shadow-2: none; --shadow-3: 0 12px 32px rgba(0, 0, 0, .6); --color-card-border: transparent; }

/* =====================================================================
   COLOUR TOKENS: 5 themes, each in light and dark. Pulse is the default.
   Roles: bg (page) · surface (cards) · surface-alt (inset rows) · surface-raised (dialogs)
   text · text-muted (4.5:1+) · border (dividers) · border-control (inputs, 3:1+)
   accent · on-accent · accent-soft · accent-text · metric-1 to 4 (colour-coded numbers) · grad (progress)
   success · best (beat last time)
   missed · danger · hazard (missed-day card) · inverse (toast, rest bar) · focus · scrim
   ===================================================================== */
''']
css.append(":root{\n" + block(PAL["pulse"]["light"]) + "\n}\n")
for k in NAMES:
    css.append(':root[data-palette="%s"]{\n%s\n}\n' % (k, block(PAL[k]["light"])))
css.append('@media (prefers-color-scheme: dark){\n  :root:not([data-theme="light"]){\n' + block(PAL["pulse"]["dark"], "    ") + "\n  }\n")
for k in NAMES:
    css.append('  :root[data-palette="%s"]:not([data-theme="light"]){\n%s\n  }\n' % (k, block(PAL[k]["dark"], "    ")))
css.append("}\n")
css.append(':root[data-theme="dark"]{\n' + block(PAL["pulse"]["dark"]) + "\n}\n")
for k in NAMES:
    css.append(':root[data-palette="%s"][data-theme="dark"]{\n%s\n}\n' % (k, block(PAL[k]["dark"])))
css.append('''/* Extra contrast: phone setting or the app's own switch. Secondary text and dividers take full strength, cards keep outlines. */
@media (prefers-contrast: more){
  :root, :root[data-palette], :root[data-theme], :root[data-palette][data-theme]{ --canvas: none; --color-text-muted: var(--color-text); --color-border: var(--color-border-control); --color-border-control: var(--color-text); --color-card-border: var(--color-border-control); }
}
:root[data-contrast="more"], :root[data-contrast="more"][data-palette], :root[data-contrast="more"][data-theme], :root[data-contrast="more"][data-palette][data-theme]{ --canvas: none; --color-text-muted: var(--color-text); --color-border: var(--color-border-control); --color-border-control: var(--color-text); --color-card-border: var(--color-border-control); }
/* Theme switch: a short cross-fade, off when motion is reduced */
:root.theme-switching *, :root.theme-switching *::before, :root.theme-switching *::after{ transition: background-color var(--duration-med) var(--ease), color var(--duration-med) var(--ease), border-color var(--duration-med) var(--ease), fill var(--duration-med) var(--ease), stroke var(--duration-med) var(--ease) !important; }
''')
open(os.path.join(HERE, "theme.css"), "w").write("".join(css))
print("theme.css written")
