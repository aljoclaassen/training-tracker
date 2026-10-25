# Training tracker source

Build sources, data and tests for the live app. Working brief: `HANDOVER.md`.

## Build
    cd src/build && python3 build.py
Writes `../training-tracker.html` and `../site-pages/{index.html, sw.js, theme.css}` (git-ignored).

## Deploy
Copy `src/site-pages/{index.html, sw.js, theme.css}` to the repo root, raise `appVersion` (`build/config.json`) and `VERSION` (`build/sw.template.js`) together, rebuild, commit, push to `main`.

## Tests
Tests load `file://<root>/site/new.html`. Set up from `src/`:

    mkdir site && cp training-tracker.html site/new.html
    mv tests/* . && rmdir tests
    sed -i "s#/tmp/claude-0/-home-claude/254544d4-b786-5ad2-a8ac-aef5d5b30988/scratchpad#$PWD#g" *.py p3/*.py p4/*.py

Details on t2-t13, p3 and p4: see HANDOVER.md, "How to build, test and deploy".
