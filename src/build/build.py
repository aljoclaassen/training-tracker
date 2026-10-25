import json, re
hd_src = json.load(open('../hd.json'))
pb = json.load(open('pb.json'))
config = json.load(open('config.json'))
hd = {
  "id": "hd", "name": "Heavy Duty", "fullName": "Strength and Hypertrophy Plan",
  "summary": "Five training days, two rest days. Warm up, then one all-out working set per exercise.",
  "legend": [
    "Percentages are of each exercise's working-set weight. The working set is 100%.",
    "Sets: \"2W + 1\" means two warm-up sets well short of failure, then one working set taken to failure. The working target comes after the arrow."
  ],
  "weekLabels": ["Week 1", "Week 2"],
  "variants": hd_src["variants"],
  "days": hd_src["days"]
}
programme = {"version": 2, "plans": {"hd": hd, "pb": pb}}

logic = open('logic.js').read()
display = open('display.js').read()
shell = open('shell.html').read().replace('/*{{THEME}}*/', open('theme.css').read())

# Function list for the header, taken from the comments above each logic function
funcs = []
lines = logic.split('\n')
section = ''
for i, line in enumerate(lines):
    m = re.match(r'/\* -+ (2\.\d+ .*?) -+ \*/', line)
    if m: section = m.group(1); funcs.append(('#', section)); continue
    m = re.match(r'function (\w+)\(([^)]*)\)', line)
    if m:
        j = i - 1; doc = []
        while j >= 0 and lines[j].startswith('//'):
            doc.insert(0, lines[j][2:].strip()); j -= 1
        funcs.append((m.group(1) + '(' + m.group(2) + ')', ' '.join(doc)))
flist = []
for name, doc in funcs:
    if name == '#': flist.append('\n  ' + doc); continue
    flist.append('    ' + name + (' : ' + doc if doc else ''))
flist = '\n'.join(flist).replace('--', '–')

header = open('header.txt').read().replace('{{FUNCTIONS}}', flist)

compat = r'''/* =====================================================================
   LAYER 0: COMPATIBILITY
   Small fixes so older Android and Huawei browsers can run the app.
   ===================================================================== */
(function(){
  if (!Object.assign) Object.assign = function(t){ for (var i = 1; i < arguments.length; i++){ var s = arguments[i]; if (s) for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) t[k] = s[k]; } return t; };
  if (!Array.prototype.findIndex) Array.prototype.findIndex = function(fn){ for (var i = 0; i < this.length; i++) if (fn(this[i], i, this)) return i; return -1; };
  if (!String.prototype.padStart) String.prototype.padStart = function(len, pad){ var s = String(this); pad = pad === undefined ? " " : String(pad); while (s.length < len) s = pad + s; return s; };
  if (!window.CSS) window.CSS = {};
  if (!CSS.escape) CSS.escape = function(v){ return String(v).replace(/[^a-zA-Z0-9_-]/g, function(c){ return "\\" + c; }); };
  if (window.Element && !Element.prototype.closest) Element.prototype.closest = function(sel){ var el = this; while (el && el.nodeType === 1){ if (el.matches(sel)) return el; el = el.parentElement; } return null; };
  if (window.Element && !Element.prototype.matches) Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
  var shown = false;
  window.addEventListener("error", function(){
    if (shown || !document.body) return; shown = true;
    var b = document.createElement("div"); b.className = "compat-banner"; b.setAttribute("role", "alert");
    b.textContent = "Part of the app couldn't run on this browser. Update the browser, or try Firefox or Opera.";
    document.body.appendChild(b);
  });
})();
'''
data = '''/* =====================================================================
   LAYER 1: DATA
   Plain JSON: settings and both plans. Loads into Python unchanged
   (json.loads on the object text). No logic here.
   ===================================================================== */
const CONFIG = ''' + json.dumps(config, ensure_ascii=False, indent=1) + ''';

const PROGRAMME = ''' + json.dumps(programme, ensure_ascii=False, indent=1) + ''';
'''
script = compat + '\n' + data + '\n' + logic + '\n' + display
out = header + '\n' + shell.replace('/*SCRIPT*/', script)
open('../training-tracker.html', 'w').write(out)
import os
os.makedirs('../site-pages', exist_ok=True)
open('../site-pages/index.html', 'w').write(out)
sw = open('sw.template.js').read().replace('__VERSION__', config['appVersion'])
open('../site-pages/sw.js', 'w').write(sw)
open('../site-pages/theme.css', 'w').write(open('theme.css').read())   # the editable token file, kept beside the app
print(len(out))
