# Infographic Admin Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin upload and delete infographic images from a simple
password-gated `admin.html` page, with the public carousel on `index.html`
rendering itself automatically from those changes.

**Architecture:** All file paths below are relative to the repo root
(`MWAfamily-main/`, which mirrors `dc18sagittariuz/MWAfamily` on GitHub). A
JSON manifest (`assets/images/infographics.json`) is the single source of
truth for carousel contents. `index.html`'s carousel renders itself from
that manifest via `fetch` at page load. `admin.html` is a new standalone
page that authenticates with a GitHub personal access token and commits
directly to the repo via the GitHub Contents API — no backend server, no
new third-party service.

**Tech Stack:** Vanilla ES5-style JavaScript (`var`, function expressions
— matches the existing inline scripts in `index.html`), Fetch API, Canvas
API for client-side image compression, GitHub REST API v3 (Contents
endpoints), Bootstrap 5 (already bundled) for the carousel widget.

## Global Constraints

- Repo: `dc18sagittariuz/MWAfamily`. GitHub API base:
  `https://api.github.com/repos/dc18sagittariuz/MWAfamily`.
- Manifest file path (repo-relative): `assets/images/infographics.json`.
- New images are written under `assets/images/`.
- Admin token is cached in `localStorage` under the key `mwa_admin_token`.
  It must be a GitHub fine-grained personal access token scoped to just
  this repo with Contents read/write permission — created manually by the
  admin in GitHub's settings. This is a manual prerequisite for testing
  Tasks 4–6; it is not something the code generates.
- `admin.html` is never linked from site navigation (`index.html`'s
  `<nav>` is not modified to reference it).
- Client-side image compression: max width 1600px, JPEG quality 0.82.
- Code style matches the existing site: ES5 function syntax, `var`
  declarations, IIFEs — no build step, no transpilation, no npm
  dependencies. This is an internal admin tool for modern evergreen
  browsers only (no IE11 support needed), so `fetch`, `Promise`,
  `Array.prototype.some`/`.findIndex`, and `Object.assign` are all fine to
  use directly.
- No test framework exists in this project (confirmed: no `node`/`npm`
  available in this environment). Verification throughout this plan is
  manual: serve the directory locally with
  `python3 -m http.server 8000` (run from `MWAfamily-main/`) and open
  pages in a real browser (use the `run` skill if available, or open
  manually).

---

### Task 1: Seed the infographics manifest

**Files:**
- Create: `assets/images/infographics.json`

**Interfaces:**
- Produces: the manifest file consumed by `assets/carousel-loader.js`
  (Task 3) and `admin.html` (Tasks 4–6). Shape: JSON array of
  `{ "file": "assets/images/<name>.jpg", "alt": "<string>" }`, ordered
  first-to-last as carousel slide order.

- [ ] **Step 1: Create the manifest with the current 7 carousel images**

```json
[
  { "file": "assets/images/6904.jpg", "alt": "Infographic" },
  { "file": "assets/images/6903.jpg", "alt": "Infographic" },
  { "file": "assets/images/6902.jpg", "alt": "Infographic" },
  { "file": "assets/images/6901.jpg", "alt": "Infographic" },
  { "file": "assets/images/6812.jpg", "alt": "Infographic" },
  { "file": "assets/images/6811.jpg", "alt": "Infographic" },
  { "file": "assets/images/6810.jpg", "alt": "Infographic" }
]
```

This exact order matches the current hardcoded carousel in `index.html`
(6904 first/active, 6810 last).

- [ ] **Step 2: Verify it's valid JSON with 7 entries**

Run: `python3 -m json.tool assets/images/infographics.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d))"`
Expected output: `7`

- [ ] **Step 3: Commit**

```bash
git add assets/images/infographics.json
git commit -m "Add infographics manifest seeded from current carousel"
```

---

### Task 2: Pure manifest-manipulation helpers + self-test

**Files:**
- Create: `assets/admin/manifest-utils.js`
- Create: `assets/admin/manifest-utils.selftest.html`

**Interfaces:**
- Consumes: nothing (pure functions, no dependencies).
- Produces: `window.ManifestUtils` with three functions, used by
  `admin.html` in Tasks 5–6:
  - `generateFilename(date: Date, existingFiles: string[]) -> string` —
    returns a collision-safe filename like `infographic-20260712-1.jpg`
    given the full repo-relative paths already in use.
  - `addEntry(manifest: Array<{file,alt}>, entry: {file,alt}) ->
    Array<{file,alt}>` — returns a **new** array with `entry` appended
    (does not mutate `manifest`).
  - `removeEntry(manifest: Array<{file,alt}>, file: string) ->
    Array<{file,alt}>` — returns a **new** array excluding any entry
    whose `file` matches.

- [ ] **Step 1: Write `assets/admin/manifest-utils.js`**

```js
(function (global) {
  'use strict';

  function generateFilename(date, existingFiles) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    var base = 'infographic-' + y + m + d;
    var n = 1;
    var candidate = base + '-' + n + '.jpg';
    var existingNames = existingFiles.map(function (f) {
      var parts = f.split('/');
      return parts[parts.length - 1];
    });
    while (existingNames.indexOf(candidate) !== -1) {
      n += 1;
      candidate = base + '-' + n + '.jpg';
    }
    return candidate;
  }

  function addEntry(manifest, entry) {
    return manifest.concat([entry]);
  }

  function removeEntry(manifest, file) {
    return manifest.filter(function (item) {
      return item.file !== file;
    });
  }

  global.ManifestUtils = {
    generateFilename: generateFilename,
    addEntry: addEntry,
    removeEntry: removeEntry
  };
})(window);
```

- [ ] **Step 2: Write the self-test harness `assets/admin/manifest-utils.selftest.html`**

```html
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>manifest-utils self-test</title></head>
<body>
  <pre id="results">Running...</pre>
  <script src="manifest-utils.js"></script>
  <script>
    (function () {
      var lines = [];
      var failures = 0;

      function assertEqual(actual, expected, label) {
        var pass = JSON.stringify(actual) === JSON.stringify(expected);
        if (!pass) failures += 1;
        lines.push((pass ? 'PASS' : 'FAIL') + ' - ' + label +
          (pass ? '' : ' (expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual) + ')'));
      }

      assertEqual(
        ManifestUtils.generateFilename(new Date(2026, 6, 12), []),
        'infographic-20260712-1.jpg',
        'generateFilename with no existing files'
      );

      assertEqual(
        ManifestUtils.generateFilename(new Date(2026, 6, 12), ['assets/images/infographic-20260712-1.jpg']),
        'infographic-20260712-2.jpg',
        'generateFilename skips existing name'
      );

      var original = [{ file: 'a.jpg', alt: 'x' }];
      var added = ManifestUtils.addEntry(original, { file: 'b.jpg', alt: 'y' });
      assertEqual(added, [{ file: 'a.jpg', alt: 'x' }, { file: 'b.jpg', alt: 'y' }], 'addEntry appends entry');
      assertEqual(original, [{ file: 'a.jpg', alt: 'x' }], 'addEntry does not mutate original');

      var withTwo = [{ file: 'a.jpg', alt: 'x' }, { file: 'b.jpg', alt: 'y' }];
      var removed = ManifestUtils.removeEntry(withTwo, 'a.jpg');
      assertEqual(removed, [{ file: 'b.jpg', alt: 'y' }], 'removeEntry removes matching file');

      document.getElementById('results').textContent =
        lines.join('\n') + '\n\n' + (failures === 0 ? 'All tests passed' : failures + ' test(s) FAILED');
    })();
  </script>
</body>
</html>
```

- [ ] **Step 3: Run the self-test and verify it fails first (TDD sanity check)**

Temporarily rename `manifest-utils.js` to confirm the test harness reports
missing functions, e.g.:

Run: `mv assets/admin/manifest-utils.js assets/admin/manifest-utils.js.bak`

Then serve and open the page:

Run: `python3 -m http.server 8000` (from `MWAfamily-main/`, leave running)
Open: `http://localhost:8000/assets/admin/manifest-utils.selftest.html`
Expected: browser console shows a `ReferenceError: ManifestUtils is not defined` (page fails to render results) — confirms the test harness actually exercises the file.

Restore the file:

Run: `mv assets/admin/manifest-utils.js.bak assets/admin/manifest-utils.js`

- [ ] **Step 4: Run the self-test for real and verify all pass**

Reload `http://localhost:8000/assets/admin/manifest-utils.selftest.html`
Expected: page text ends with `All tests passed`, no `FAIL` lines above it.

- [ ] **Step 5: Commit**

```bash
git add assets/admin/manifest-utils.js assets/admin/manifest-utils.selftest.html
git commit -m "Add pure manifest manipulation helpers with self-test harness"
```

---

### Task 3: Dynamic carousel rendering in `index.html`

**Files:**
- Create: `assets/carousel-loader.js`
- Modify: `index.html:520-584` (carousel section markup)
- Modify: `index.html:818-899` (lightbox script — convert to a named,
  externally-callable init function)

**Interfaces:**
- Consumes: `assets/images/infographics.json` (Task 1), fetched at
  runtime via `fetch`.
- Consumes: `window.initInfographicLightbox()` — must exist by the time
  `initInfographicCarousel()` calls it (defined in this same task, see
  Step 2).
- Produces: `window.buildCarouselMarkup(manifest)`,
  `window.initInfographicCarousel()`, and `window.initInfographicLightbox()`
  — all three are used again by nothing outside this task, but are kept
  on `window` for manual debugging in devtools.

- [ ] **Step 1: Replace the hardcoded carousel markup in `index.html`**

Replace the entire block from `<section data-bs-version="5.1" class="slider05 cid-vhXDOSkMT1" id="slider05-1z">` through its closing `</section>` (originally lines 520–584) with:

```html
<section data-bs-version="5.1" class="slider05 cid-vhXDOSkMT1" id="slider05-1z">
    <div class="container">
        <div class="row justify-content-center">
            <div class="col-12 col-md-6">
                <div class="carousel slide carousel-fade" id="vhYvWmVi9Q" data-interval="5000" data-bs-interval="5000">
                    <ol class="carousel-indicators" id="infographic-carousel-indicators"></ol>
                    <div class="carousel-inner" id="infographic-carousel-inner"></div>
                    <a class="carousel-control carousel-control-prev" role="button" data-slide="prev" data-bs-slide="prev" href="#vhYvWmVi9Q">
                        <span class="mobi-mbri mobi-mbri-arrow-prev" aria-hidden="true"></span>
                        <span class="sr-only visually-hidden">Previous</span>
                    </a>
                    <a class="carousel-control carousel-control-next" role="button" data-slide="next" data-bs-slide="next" href="#vhYvWmVi9Q">
                        <span class="mobi-mbri mobi-mbri-arrow-next" aria-hidden="true"></span>
                        <span class="sr-only visually-hidden">Next</span>
                    </a>
                </div>
            </div>
        </div>
    </div>
</section>
```

- [ ] **Step 2: Replace the lightbox `<script>` block (originally lines 818–899) so it exposes a callable init function instead of auto-running**

Replace the whole `<script> (function () { ... })(); </script>` block that
starts with `var lightbox  = document.getElementById('infographic-lightbox');`
with:

```html
<script>
  (function () {
    var lightbox  = document.getElementById('infographic-lightbox');
    var lightboxImg = document.getElementById('lightbox-img');
    var closeBtn  = document.getElementById('lightbox-close');
    var prevBtn   = document.getElementById('lightbox-prev');
    var nextBtn   = document.getElementById('lightbox-next');
    var counter   = document.getElementById('lightbox-counter');

    var images = [];
    var currentIndex = 0;

    function openLightbox(idx) {
      currentIndex = idx;
      lightboxImg.src = images[currentIndex].src;
      lightboxImg.alt = images[currentIndex].alt;
      updateCounter();
      lightbox.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function showImage(idx) {
      lightboxImg.classList.add('fade-out');
      setTimeout(function () {
        currentIndex = (idx + images.length) % images.length;
        lightboxImg.src = images[currentIndex].src;
        lightboxImg.alt = images[currentIndex].alt;
        updateCounter();
        lightboxImg.classList.remove('fade-out');
      }, 150);
    }

    function updateCounter() {
      counter.textContent = (currentIndex + 1) + ' / ' + images.length;
    }

    function closeLightbox() {
      lightbox.classList.remove('active');
      document.body.style.overflow = '';
      lightboxImg.src = '';
    }

    function initInfographicLightbox() {
      images = [];
      document.querySelectorAll('.carousel-item .item-wrapper img').forEach(function (img) {
        images.push({ src: img.src, alt: img.alt });
        img.addEventListener('click', function (e) {
          e.stopPropagation();
          var idx = images.findIndex(function (o) { return o.src === img.src; });
          openLightbox(idx >= 0 ? idx : 0);
        });
      });
    }

    prevBtn.addEventListener('click', function (e) { e.stopPropagation(); showImage(currentIndex - 1); });
    nextBtn.addEventListener('click', function (e) { e.stopPropagation(); showImage(currentIndex + 1); });
    closeBtn.addEventListener('click', function (e) { e.stopPropagation(); closeLightbox(); });

    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) closeLightbox();
    });
    lightboxImg.addEventListener('click', function (e) { e.stopPropagation(); });

    document.addEventListener('keydown', function (e) {
      if (!lightbox.classList.contains('active')) return;
      if (e.key === 'Escape')      closeLightbox();
      if (e.key === 'ArrowRight')  showImage(currentIndex + 1);
      if (e.key === 'ArrowLeft')   showImage(currentIndex - 1);
    });

    var touchStartX = 0;
    lightbox.addEventListener('touchstart', function (e) { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
    lightbox.addEventListener('touchend', function (e) {
      var diff = touchStartX - e.changedTouches[0].screenX;
      if (Math.abs(diff) > 50) {
        diff > 0 ? showImage(currentIndex + 1) : showImage(currentIndex - 1);
      }
    });

    window.initInfographicLightbox = initInfographicLightbox;
  })();
</script>
```

- [ ] **Step 3: Create `assets/carousel-loader.js`**

```js
(function () {
  'use strict';

  function buildCarouselMarkup(manifest) {
    var inner = manifest.map(function (item, idx) {
      return (
        '<div class="carousel-item slider-image item' + (idx === 0 ? ' active' : '') + '">' +
          '<div class="item-wrapper">' +
            '<img class="d-block w-100" src="' + item.file + '" alt="' + item.alt + '" ' +
            'data-slide-to="' + idx + '" data-bs-slide-to="' + idx + '">' +
          '</div>' +
        '</div>'
      );
    }).join('');

    var indicators = manifest.map(function (item, idx) {
      return (
        '<li data-slide-to="' + idx + '" data-bs-slide-to="' + idx + '"' +
        (idx === 0 ? ' class="active"' : '') +
        ' data-target="#vhYvWmVi9Q" data-bs-target="#vhYvWmVi9Q"></li>'
      );
    }).join('');

    return { inner: inner, indicators: indicators };
  }

  function initInfographicCarousel() {
    var section = document.getElementById('slider05-1z');
    var innerEl = document.getElementById('infographic-carousel-inner');
    var indicatorsEl = document.getElementById('infographic-carousel-indicators');

    fetch('assets/images/infographics.json')
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load infographics.json: ' + res.status);
        return res.json();
      })
      .then(function (manifest) {
        if (!Array.isArray(manifest) || manifest.length === 0) {
          section.style.display = 'none';
          return;
        }
        var markup = buildCarouselMarkup(manifest);
        innerEl.innerHTML = markup.inner;
        indicatorsEl.innerHTML = markup.indicators;

        if (window.bootstrap && window.bootstrap.Carousel) {
          new window.bootstrap.Carousel(document.getElementById('vhYvWmVi9Q'));
        }

        if (typeof window.initInfographicLightbox === 'function') {
          window.initInfographicLightbox();
        }
      })
      .catch(function (err) {
        console.error(err);
        section.style.display = 'none';
      });
  }

  window.buildCarouselMarkup = buildCarouselMarkup;
  window.initInfographicCarousel = initInfographicCarousel;
  document.addEventListener('DOMContentLoaded', initInfographicCarousel);
})();
```

- [ ] **Step 4: Wire the new script into `index.html`**

Immediately after the lightbox `</script>` block from Step 2 (and before
the closing `</body>`), add:

```html
<script src="assets/carousel-loader.js"></script>
```

- [ ] **Step 5: Verify manually in a browser**

Run: `python3 -m http.server 8000` (from `MWAfamily-main/`)
Open: `http://localhost:8000/index.html` (use the `run` skill if available)

Confirm:
- All 7 infographic images appear in the carousel, same order as before
  (6904 first/active, 6810 last).
- Next/prev controls and indicator dots work.
- Clicking a slide image opens the lightbox; counter reads `1 / 7`
  (or matching position); arrow keys and swipe navigate; Escape and the
  close button close it.
- No errors in the browser devtools console.

- [ ] **Step 6: Commit**

```bash
git add index.html assets/carousel-loader.js
git commit -m "Render infographic carousel dynamically from manifest.json"
```

---

### Task 4: GitHub API wrapper + admin login gate

**Files:**
- Create: `assets/admin/github-api.js`
- Create: `admin.html`

**Interfaces:**
- Produces: `window.GitHubAPI` with:
  - `validateToken(token: string) -> Promise<boolean>`
  - `getFile(path: string, token: string) -> Promise<{sha, content}|null>`
    (`content` is base64-encoded; resolves `null` on 404)
  - `putFile(path: string, base64Content: string, message: string, token: string, sha?: string) -> Promise<object>`
  - `deleteFile(path: string, sha: string, message: string, token: string) -> Promise<object>`
- Produces: `admin.html` with a working password gate. `localStorage`
  key `mwa_admin_token` holds the token once validated.
- Produces: `window.refreshInfographicList` — **not yet defined in this
  task** (Task 6 defines it). This task's gate calls it defensively
  (`if (window.refreshInfographicList) ...`) so it's a no-op until Task 6
  lands.

- [ ] **Step 1: Create `assets/admin/github-api.js`**

```js
(function (global) {
  'use strict';

  var REPO = 'dc18sagittariuz/MWAfamily';
  var API_BASE = 'https://api.github.com/repos/' + REPO;

  function authHeaders(token) {
    return {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json'
    };
  }

  function validateToken(token) {
    return fetch(API_BASE, { headers: authHeaders(token) }).then(function (res) {
      return res.ok;
    });
  }

  function getFile(path, token) {
    return fetch(API_BASE + '/contents/' + path, { headers: authHeaders(token) })
      .then(function (res) {
        if (res.status === 404) return null;
        if (!res.ok) throw new Error('Failed to load ' + path + ': ' + res.status);
        return res.json();
      });
  }

  function putFile(path, base64Content, message, token, sha) {
    var body = { message: message, content: base64Content };
    if (sha) body.sha = sha;
    return fetch(API_BASE + '/contents/' + path, {
      method: 'PUT',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders(token)),
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) {
        return res.json().then(function (err) {
          throw new Error('Failed to save ' + path + ': ' + (err.message || res.status));
        });
      }
      return res.json();
    });
  }

  function deleteFile(path, sha, message, token) {
    return fetch(API_BASE + '/contents/' + path, {
      method: 'DELETE',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders(token)),
      body: JSON.stringify({ message: message, sha: sha })
    }).then(function (res) {
      if (!res.ok) {
        return res.json().then(function (err) {
          throw new Error('Failed to delete ' + path + ': ' + (err.message || res.status));
        });
      }
      return res.json();
    });
  }

  global.GitHubAPI = {
    validateToken: validateToken,
    getFile: getFile,
    putFile: putFile,
    deleteFile: deleteFile
  };
})(window);
```

- [ ] **Step 2: Create `admin.html` with the login gate**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Infographic Admin</title>
  <style>
    body { font-family: sans-serif; max-width: 480px; margin: 60px auto; padding: 0 16px; color: #0f172a; }
    h1 { font-size: 1.3rem; }
    input[type="password"] { width: 100%; padding: .6rem; font-size: 1rem; box-sizing: border-box; }
    button { margin-top: .75rem; padding: .6rem 1.2rem; font-size: 1rem; cursor: pointer; }
    #gate-error { color: #b91c1c; margin-top: .5rem; min-height: 1.2em; }
    #admin-app { display: none; }
  </style>
</head>
<body>
  <h1>Infographic Admin</h1>

  <div id="gate">
    <label for="gate-password">Access Password</label>
    <input type="password" id="gate-password" autocomplete="off">
    <div id="gate-error"></div>
    <button id="gate-unlock">Unlock</button>
  </div>

  <div id="admin-app">
    <p id="admin-status">Signed in as authorized admin.</p>
  </div>

  <script src="assets/admin/github-api.js"></script>
  <script>
    (function () {
      var STORAGE_KEY = 'mwa_admin_token';
      var gate = document.getElementById('gate');
      var app = document.getElementById('admin-app');
      var passwordInput = document.getElementById('gate-password');
      var errorEl = document.getElementById('gate-error');
      var unlockBtn = document.getElementById('gate-unlock');

      function showApp() {
        gate.style.display = 'none';
        app.style.display = 'block';
        if (typeof window.refreshInfographicList === 'function') {
          window.refreshInfographicList();
        }
      }

      function tryUnlock(token) {
        errorEl.textContent = '';
        return GitHubAPI.validateToken(token).then(function (ok) {
          if (ok) {
            localStorage.setItem(STORAGE_KEY, token);
            showApp();
          } else {
            errorEl.textContent = 'Invalid password / no access.';
          }
        }).catch(function () {
          errorEl.textContent = 'Could not reach GitHub. Check your connection and try again.';
        });
      }

      unlockBtn.addEventListener('click', function () {
        var token = passwordInput.value.trim();
        if (!token) {
          errorEl.textContent = 'Enter your access password.';
          return;
        }
        tryUnlock(token);
      });

      var savedToken = localStorage.getItem(STORAGE_KEY);
      if (savedToken) {
        tryUnlock(savedToken);
      }
    })();
  </script>
</body>
</html>
```

- [ ] **Step 3: Verify manually in a browser**

Prerequisite: create a GitHub fine-grained personal access token scoped to
just the `dc18sagittariuz/MWAfamily` repo with Contents read/write
permission (in GitHub Settings → Developer settings → Fine-grained
tokens).

Run: `python3 -m http.server 8000` (from `MWAfamily-main/`)
Open: `http://localhost:8000/admin.html`

Confirm:
- Entering a wrong/empty value shows `Invalid password / no access.` or
  `Enter your access password.` and the gate stays visible.
- Entering the real token unlocks the page (`admin-app` becomes visible)
  and `localStorage.getItem('mwa_admin_token')` (check via devtools
  console) holds the token.
- Reloading the page skips the gate automatically and goes straight to
  the unlocked view.

- [ ] **Step 4: Commit**

```bash
git add assets/admin/github-api.js admin.html
git commit -m "Add GitHub API wrapper and admin login gate"
```

---

### Task 5: Upload flow (compress, commit image, update manifest)

**Files:**
- Create: `assets/admin/image-compress.js`
- Modify: `admin.html` (extend `#admin-app`, add upload script)

**Interfaces:**
- Consumes: `window.GitHubAPI` (Task 4), `window.ManifestUtils` (Task 2).
- Produces: `window.ImageCompress` with:
  - `compressImage(file: File, maxWidth: number, quality: number) -> Promise<Blob>`
  - `blobToBase64(blob: Blob) -> Promise<string>` (base64 payload, no
    `data:` prefix)
- Produces: calls `window.refreshInfographicList()` defensively after a
  successful upload (defined in Task 6; no-op until then).

- [ ] **Step 1: Create `assets/admin/image-compress.js`**

```js
(function (global) {
  'use strict';

  function compressImage(file, maxWidth, quality) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var reader = new FileReader();

      reader.onerror = function () { reject(new Error('Could not read file')); };
      reader.onload = function () {
        img.onload = function () {
          var scale = Math.min(1, maxWidth / img.width);
          var canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(function (blob) {
            if (!blob) { reject(new Error('Compression failed')); return; }
            resolve(blob);
          }, 'image/jpeg', quality);
        };
        img.onerror = function () { reject(new Error('Could not decode image')); };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Could not read compressed image')); };
      reader.onload = function () {
        var result = reader.result;
        var base64 = result.substring(result.indexOf(',') + 1);
        resolve(base64);
      };
      reader.readAsDataURL(blob);
    });
  }

  global.ImageCompress = {
    compressImage: compressImage,
    blobToBase64: blobToBase64
  };
})(window);
```

- [ ] **Step 2: Add the upload section markup to `admin.html`**

Inside `#admin-app`, right after the `<p id="admin-status">...</p>` line,
add:

```html
    <section>
      <h2>Upload New Infographic</h2>
      <input type="file" id="upload-file" accept="image/*">
      <div id="upload-preview"></div>
      <button id="upload-btn" disabled>Upload</button>
      <button id="retry-manifest-btn" style="display:none;">Retry list update</button>
      <p id="upload-progress"></p>
      <p id="upload-error" style="color:#b91c1c;"></p>
    </section>
```

- [ ] **Step 3: Add the upload script to `admin.html`**

Right after `assets/admin/github-api.js`, add two more script tags, then
extend the final inline `<script>` block (or add a new one right after
the gate script) with:

```html
  <script src="assets/admin/manifest-utils.js"></script>
  <script src="assets/admin/image-compress.js"></script>
  <script>
    (function () {
      var MANIFEST_PATH = 'assets/images/infographics.json';
      var IMAGES_DIR = 'assets/images/';

      var fileInput = document.getElementById('upload-file');
      var previewEl = document.getElementById('upload-preview');
      var uploadBtn = document.getElementById('upload-btn');
      var retryBtn = document.getElementById('retry-manifest-btn');
      var progressEl = document.getElementById('upload-progress');
      var errorEl = document.getElementById('upload-error');

      var pendingBlob = null;
      var lastFailedUpload = null;

      function getToken() {
        return localStorage.getItem('mwa_admin_token');
      }

      function updateManifestWithEntry(imagePath, filename) {
        var token = getToken();
        progressEl.textContent = 'Updating carousel list...';
        errorEl.textContent = '';
        retryBtn.style.display = 'none';

        return GitHubAPI.getFile(MANIFEST_PATH, token).then(function (manifestFile) {
          var manifest = manifestFile ? JSON.parse(atob(manifestFile.content)) : [];
          var alreadyListed = manifest.some(function (m) { return m.file === imagePath; });
          var updatedManifest = alreadyListed ? manifest : ManifestUtils.addEntry(manifest, { file: imagePath, alt: 'Infographic' });
          return GitHubAPI.putFile(
            MANIFEST_PATH,
            btoa(JSON.stringify(updatedManifest, null, 2)),
            'Add ' + filename + ' to infographics list',
            token,
            manifestFile ? manifestFile.sha : undefined
          );
        }).then(function () {
          progressEl.textContent = 'Done, live in ~1 minute.';
          lastFailedUpload = null;
          fileInput.value = '';
          previewEl.innerHTML = '';
          pendingBlob = null;
          if (typeof window.refreshInfographicList === 'function') {
            window.refreshInfographicList();
          }
        }).catch(function (err) {
          progressEl.textContent = '';
          lastFailedUpload = { imagePath: imagePath, filename: filename };
          errorEl.textContent = 'Image uploaded as ' + imagePath +
            ' but the carousel list failed to update: ' + err.message + '.';
          retryBtn.style.display = 'inline-block';
        });
      }

      fileInput.addEventListener('change', function () {
        var file = fileInput.files[0];
        errorEl.textContent = '';
        uploadBtn.disabled = true;
        pendingBlob = null;
        if (!file) return;

        progressEl.textContent = 'Compressing...';
        ImageCompress.compressImage(file, 1600, 0.82).then(function (blob) {
          pendingBlob = blob;
          previewEl.innerHTML = '';
          var img = document.createElement('img');
          img.style.maxWidth = '240px';
          img.src = URL.createObjectURL(blob);
          previewEl.appendChild(img);
          uploadBtn.disabled = false;
          progressEl.textContent = 'Ready to upload.';
        }).catch(function (err) {
          errorEl.textContent = err.message;
          progressEl.textContent = '';
        });
      });

      uploadBtn.addEventListener('click', function () {
        if (!pendingBlob) return;
        var token = getToken();
        uploadBtn.disabled = true;
        errorEl.textContent = '';
        retryBtn.style.display = 'none';

        GitHubAPI.getFile(MANIFEST_PATH, token).then(function (manifestFile) {
          var manifest = manifestFile ? JSON.parse(atob(manifestFile.content)) : [];
          var filename = ManifestUtils.generateFilename(new Date(), manifest.map(function (m) { return m.file; }));
          var imagePath = IMAGES_DIR + filename;

          progressEl.textContent = 'Uploading image...';
          return ImageCompress.blobToBase64(pendingBlob).then(function (base64) {
            return GitHubAPI.putFile(imagePath, base64, 'Add infographic ' + filename, token);
          }).then(function () {
            return updateManifestWithEntry(imagePath, filename);
          });
        }).catch(function (err) {
          progressEl.textContent = '';
          errorEl.textContent = err.message;
        }).then(function () {
          uploadBtn.disabled = false;
        });
      });

      retryBtn.addEventListener('click', function () {
        if (!lastFailedUpload) return;
        updateManifestWithEntry(lastFailedUpload.imagePath, lastFailedUpload.filename);
      });
    })();
  </script>
```

- [ ] **Step 4: Verify manually in a browser**

Run: `python3 -m http.server 8000` (from `MWAfamily-main/`)
Open: `http://localhost:8000/admin.html`, unlock with your token.

Confirm the happy path:
- Selecting an image shows `Compressing...` then a preview thumbnail and
  `Ready to upload.`.
- Clicking Upload shows `Uploading image...` then
  `Updating carousel list...` then `Done, live in ~1 minute.`.
- On github.com, confirm a new file exists under `assets/images/` and
  `assets/images/infographics.json` now includes it as the last entry.

Confirm the partial-failure path (simulate by temporarily editing
`MANIFEST_PATH` in devtools to an invalid path like
`assets/images/does-not-exist/infographics.json` before clicking Upload,
then reloading to restore the real script afterward):
- The image still uploads, but the error text explains the manifest
  update failed and the imagePath it used, and `Retry list update`
  becomes visible.
- Fixing the path back and clicking `Retry list update` reuses the
  already-uploaded `imagePath`/`filename` and successfully updates the
  manifest without re-uploading the image.

- [ ] **Step 5: Commit**

```bash
git add assets/admin/image-compress.js admin.html
git commit -m "Add infographic upload flow with client-side compression"
```

---

### Task 6: Current infographics list + delete flow

**Files:**
- Modify: `admin.html` (extend `#admin-app`, add list/delete script)

**Interfaces:**
- Consumes: `window.GitHubAPI` (Task 4), `window.ManifestUtils` (Task 2).
- Produces: `window.refreshInfographicList()` — called by Task 4's
  `showApp()` after unlock, and by Task 5's upload success handler.

- [ ] **Step 1: Add the list markup to `admin.html`**

Inside `#admin-app`, after the upload `<section>` from Task 5, add:

```html
    <section>
      <h2>Current Infographics</h2>
      <div id="current-list"></div>
    </section>
```

- [ ] **Step 2: Add the list/delete script to `admin.html`**

Add a new `<script>` block right after the upload script from Task 5:

```html
  <script>
    (function () {
      var MANIFEST_PATH = 'assets/images/infographics.json';
      var listEl = document.getElementById('current-list');

      function getToken() {
        return localStorage.getItem('mwa_admin_token');
      }

      function renderList(manifest) {
        listEl.innerHTML = '';
        manifest.forEach(function (entry) {
          var item = document.createElement('div');
          item.style.display = 'inline-block';
          item.style.margin = '0 12px 12px 0';
          item.style.textAlign = 'center';

          var img = document.createElement('img');
          img.src = entry.file;
          img.style.width = '120px';
          img.style.display = 'block';

          var delBtn = document.createElement('button');
          delBtn.textContent = 'Delete';
          delBtn.addEventListener('click', function () {
            if (!window.confirm('Delete this infographic?')) return;
            deleteEntry(entry.file);
          });

          item.appendChild(img);
          item.appendChild(delBtn);
          listEl.appendChild(item);
        });
      }

      function loadList() {
        var token = getToken();
        GitHubAPI.getFile(MANIFEST_PATH, token).then(function (manifestFile) {
          var manifest = manifestFile ? JSON.parse(atob(manifestFile.content)) : [];
          renderList(manifest);
        });
      }

      function deleteEntry(file) {
        var token = getToken();
        GitHubAPI.getFile(MANIFEST_PATH, token).then(function (manifestFile) {
          var manifest = manifestFile ? JSON.parse(atob(manifestFile.content)) : [];
          var updatedManifest = ManifestUtils.removeEntry(manifest, file);
          return GitHubAPI.putFile(
            MANIFEST_PATH,
            btoa(JSON.stringify(updatedManifest, null, 2)),
            'Remove ' + file + ' from infographics list',
            token,
            manifestFile.sha
          ).then(function () {
            return GitHubAPI.getFile(file, token);
          }).then(function (imageFile) {
            if (imageFile) {
              return GitHubAPI.deleteFile(file, imageFile.sha, 'Delete infographic ' + file, token);
            }
          });
        }).then(function () {
          loadList();
        }).catch(function (err) {
          window.alert('Delete failed: ' + err.message);
          loadList();
        });
      }

      window.refreshInfographicList = loadList;
    })();
  </script>
```

- [ ] **Step 3: Verify manually in a browser**

Run: `python3 -m http.server 8000` (from `MWAfamily-main/`)
Open: `http://localhost:8000/admin.html`, unlock with your token.

Confirm:
- The current list renders thumbnails for every entry in
  `infographics.json`, each with a Delete button.
- Clicking Delete shows a confirm dialog; cancelling leaves everything
  unchanged.
- Confirming removes the entry from `infographics.json` on GitHub, and
  deletes the corresponding image file from `assets/images/`; the list
  re-renders without that entry.
- Uploading a new image (Task 5 flow) causes the list to refresh and
  show the new entry without a manual page reload.

- [ ] **Step 4: Commit**

```bash
git add admin.html
git commit -m "Add current infographics list with delete flow"
```
