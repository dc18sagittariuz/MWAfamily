(function () {
  'use strict';

  var VAULT_KEY = 'mwa_admin_vault';
  var MANIFEST_PATH = 'assets/images/infographics.json';
  var IMAGES_DIR = 'assets/images/';
  var RAW_BASE = 'https://raw.githubusercontent.com/dc18sagittariuz/MWAfamily/main/';
  var LIMIT = ManifestUtils.HOMEPAGE_LIMIT;
  var PUBLISH_MS = 90 * 1000;
  var THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

  var ICONS = {
    up: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>',
    down: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
    trash: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>',
    arrowUp: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>',
    check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>'
  };

  function $(id) { return document.getElementById(id); }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') node.textContent = v;
      else if (k === 'html') node.innerHTML = v; // only used with constant icon markup
      else if (k.indexOf('on') === 0) node.addEventListener(k.slice(2), v);
      else if (v === true) node.setAttribute(k, '');
      else node.setAttribute(k, v);
    });
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  function formatSize(bytes) {
    if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    return Math.max(1, Math.round(bytes / 1024)) + ' KB';
  }

  function fileLabel(path) {
    var name = path.split('/').pop();
    var m = /^infographic-(\d{4})(\d{2})(\d{2})-\d+\.jpg$/.exec(name);
    if (!m) return name;
    return 'อัปโหลด ' + Number(m[3]) + ' ' + THAI_MONTHS[Number(m[2]) - 1] + ' ' + (Number(m[1]) + 543);
  }

  /* =====================================================================
   * Gate: token encrypted with a PIN in localStorage
   * ===================================================================== */
  var token = null;

  function getVault() {
    try {
      var raw = localStorage.getItem(VAULT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function showGate(view) {
    $('admin-app').hidden = true;
    $('lock-btn').hidden = true;
    $('gate').hidden = false;
    $('gate-setup').hidden = view !== 'setup';
    $('gate-pin').hidden = view !== 'pin';
    var focusEl = view === 'setup' ? $('setup-token') : $('pin-input');
    setTimeout(function () { focusEl.focus(); }, 0);
  }

  function enterApp(t) {
    token = t;
    $('gate').hidden = true;
    $('admin-app').hidden = false;
    $('lock-btn').hidden = false;
    loadManifest();
  }

  $('setup-save').addEventListener('click', function () {
    var t = $('setup-token').value.trim();
    var pin = $('setup-pin').value;
    var errEl = $('setup-error');
    errEl.textContent = '';
    if (!t) { errEl.textContent = 'กรุณาใส่ GitHub token'; return; }
    if (pin.length < 6) { errEl.textContent = 'PIN ต้องยาวอย่างน้อย 6 ตัว'; return; }
    if (pin !== $('setup-pin-confirm').value) { errEl.textContent = 'PIN กับช่องยืนยันไม่ตรงกัน'; return; }

    GitHubAPI.validateToken(t).then(function (ok) {
      if (!ok) { errEl.textContent = 'token ไม่ถูกต้อง หรือไม่มีสิทธิ์เข้าถึง repo นี้'; return; }
      return CryptoVault.encryptToken(t, pin).then(function (vault) {
        try { localStorage.setItem(VAULT_KEY, JSON.stringify(vault)); } catch (e) { /* still usable this session */ }
        $('setup-token').value = '';
        $('setup-pin').value = '';
        $('setup-pin-confirm').value = '';
        enterApp(t);
      });
    }).catch(function () {
      errEl.textContent = 'ติดต่อ GitHub ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่';
    });
  });

  function unlock() {
    var errEl = $('pin-error');
    errEl.textContent = '';
    var vault = getVault();
    if (!vault) { showGate('setup'); return; }
    CryptoVault.decryptToken(vault, $('pin-input').value).then(function (t) {
      return GitHubAPI.validateToken(t).then(function (ok) {
        if (!ok) { errEl.textContent = 'token ที่บันทึกไว้หมดอายุหรือใช้ไม่ได้แล้ว กด “ลืม PIN” เพื่อใส่ token ใหม่'; return; }
        $('pin-input').value = '';
        enterApp(t);
      }, function () {
        errEl.textContent = 'ติดต่อ GitHub ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่';
      });
    }, function () {
      errEl.textContent = 'PIN ไม่ถูกต้อง';
    });
  }

  $('pin-unlock').addEventListener('click', unlock);
  $('pin-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') unlock(); });
  $('setup-pin-confirm').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('setup-save').click(); });

  $('pin-forgot').addEventListener('click', function (e) {
    e.preventDefault();
    if (!window.confirm('ล้างข้อมูลเข้าสู่ระบบที่บันทึกไว้ในเครื่องนี้? จะต้องใส่ GitHub token ใหม่')) return;
    try { localStorage.removeItem(VAULT_KEY); } catch (err) { /* ignore */ }
    showGate('setup');
  });

  $('lock-btn').addEventListener('click', function () {
    if (hasUnsaved() && !window.confirm('ยังมีการเปลี่ยนแปลงที่ไม่ได้บันทึก ล็อกหน้านี้และทิ้งการเปลี่ยนแปลง?')) return;
    token = null;
    resetLocal();
    showGate(getVault() ? 'pin' : 'setup');
  });

  /* =====================================================================
   * App state
   * ===================================================================== */
  var state = {
    sha: null,          // sha of infographics.json as loaded
    baseline: '',       // signature of the list as loaded, to detect changes
    items: [],          // { key, file, title, src, status: live|new|publishing, blob }
    removed: [],        // files to delete on save
    pending: [],        // files picked but not added yet
    saving: false
  };
  var publishing = {};  // file -> { until, src } for items saved this session
  var nextId = 1;

  function signature(items) {
    return JSON.stringify(items.map(function (i) { return [i.key, i.title.trim()]; }));
  }

  function isDirty() {
    return state.removed.length > 0 || signature(state.items) !== state.baseline;
  }

  function hasUnsaved() {
    return isDirty() || state.pending.length > 0;
  }

  function revoke(url) {
    if (url && url.indexOf('blob:') === 0) URL.revokeObjectURL(url);
  }

  function resetLocal() {
    state.items.forEach(function (i) { if (i.status === 'new') revoke(i.src); });
    state.pending.forEach(function (p) { revoke(p.src); });
    state.items = [];
    state.removed = [];
    state.pending = [];
    renderPending();
  }

  function itemFromEntry(entry) {
    var pub = publishing[entry.file];
    var live = !pub || pub.until < Date.now();
    return {
      key: entry.file,
      file: entry.file,
      title: ManifestUtils.titleOf(entry),
      src: live ? entry.file : pub.src,
      status: live ? 'live' : 'publishing'
    };
  }

  function loadManifest() {
    $('item-list').innerHTML = '';
    $('item-list').appendChild(el('p', { 'class': 'list-empty', text: 'กำลังโหลด…' }));
    return GitHubAPI.getFile(MANIFEST_PATH, token).then(function (file) {
      var manifest = GitHubAPI.readJSON(file, []);
      state.sha = file ? file.sha : null;
      state.items = manifest.map(itemFromEntry);
      state.removed = [];
      state.baseline = signature(state.items);
      render();
    }).catch(function (err) {
      $('item-list').innerHTML = '';
      $('item-list').appendChild(el('p', { 'class': 'list-empty', text: 'โหลดรายการไม่สำเร็จ: ' + err.message }));
    });
  }

  /* =====================================================================
   * Rendering
   * ===================================================================== */
  function showBanner(kind, message) {
    var b = $('banner');
    if (!kind) { b.hidden = true; return; }
    b.className = 'banner ' + kind;
    b.innerHTML = kind === 'ok' ? ICONS.check : '';
    b.appendChild(document.createTextNode(message));
    b.hidden = false;
  }

  function chip(cls, text) {
    return el('span', { 'class': 'chip ' + cls, text: text });
  }

  function render(focus) {
    $('limit-count').textContent = LIMIT;
    $('list-count').textContent = 'ทั้งหมด ' + state.items.length + ' รูป';

    var list = $('item-list');
    list.innerHTML = '';
    if (state.items.length === 0) {
      list.appendChild(el('p', { 'class': 'list-empty', text: 'ยังไม่มี infographic เพิ่มรูปแรกได้จากกล่องด้านซ้าย' }));
    }

    state.items.forEach(function (item, i) {
      var num = i + 1;
      var thumb = el('img', { 'class': 'row-thumb', src: item.src, alt: '', loading: 'lazy' });
      if (item.file) {
        thumb.addEventListener('error', function onErr() {
          thumb.removeEventListener('error', onErr);
          thumb.src = RAW_BASE + item.file; // not on GitHub Pages yet
        });
      }

      var titleInput = el('input', {
        type: 'text',
        'class': 'row-title',
        value: item.title,
        placeholder: 'ยังไม่มีชื่อ — คลิกเพื่อตั้งชื่อ',
        'aria-label': 'ชื่อ infographic ลำดับที่ ' + num,
        maxlength: '160',
        disabled: state.saving
      });
      titleInput.addEventListener('input', function () {
        item.title = titleInput.value;
        renderSavebar();
      });

      var meta = el('div', { 'class': 'row-meta' }, [
        el('span', { text: item.file ? fileLabel(item.file) : 'ไฟล์ใหม่' }),
        item.status === 'live' ? chip('chip-live', 'เผยแพร่แล้ว') : null,
        item.status === 'new' ? chip('chip-new', 'ใหม่ · ยังไม่บันทึก') : null,
        item.status === 'publishing' ? chip('chip-publishing', 'กำลังเผยแพร่ ~1 นาที') : null,
        i >= LIMIT ? chip('chip-hidden', 'ไม่แสดงบนหน้าแรก') : null
      ]);

      var row = el('div', { 'class': 'row', 'data-key': item.key }, [
        el('span', { 'class': 'row-num', text: String(num) }),
        el('a', { href: item.src, target: '_blank', rel: 'noopener', 'aria-label': 'เปิดรูปขนาดเต็ม' }, [thumb]),
        el('div', { 'class': 'row-body' }, [titleInput, meta]),
        el('div', { 'class': 'row-actions' }, [
          el('button', {
            type: 'button', 'class': 'icon-btn move-up', 'aria-label': 'เลื่อนขึ้น', html: ICONS.up,
            disabled: i === 0 || state.saving, onclick: function () { move(i, -1, 'move-up'); }
          }),
          el('button', {
            type: 'button', 'class': 'icon-btn move-down', 'aria-label': 'เลื่อนลง', html: ICONS.down,
            disabled: i === state.items.length - 1 || state.saving, onclick: function () { move(i, 1, 'move-down'); }
          }),
          el('button', {
            type: 'button', 'class': 'icon-btn danger', 'aria-label': 'ลบ', html: ICONS.trash,
            disabled: state.saving, onclick: function () { removeItem(i); }
          })
        ])
      ]);
      list.appendChild(row);

      if (i === LIMIT - 1 && i < state.items.length - 1) {
        list.appendChild(el('div', { 'class': 'divider', text: 'รูปด้านล่างไม่แสดงบนหน้าแรก' }));
      }
    });

    if (focus) {
      var target = list.querySelector('[data-key="' + CSS.escape(focus.key) + '"] .' + focus.cls);
      if (target && target.disabled) {
        target = list.querySelector('[data-key="' + CSS.escape(focus.key) + '"] .row-title');
      }
      if (target) target.focus();
    }
    renderSavebar();
  }

  function renderSavebar() {
    var dirty = isDirty();
    $('savebar').hidden = !dirty && !state.saving;
    var added = state.items.filter(function (i) { return i.status === 'new'; }).length;
    var parts = [];
    if (added) parts.push('เพิ่ม ' + added + ' รูป');
    if (state.removed.length) parts.push('ลบ ' + state.removed.length + ' รูป');
    $('savebar-text').textContent = state.saving
      ? 'กำลังบันทึก…'
      : 'มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก' + (parts.length ? ' (' + parts.join(', ') + ')' : '');
    $('save-btn').disabled = state.saving;
    $('discard-btn').disabled = state.saving;
  }

  function move(i, delta, cls) {
    var key = state.items[i].key;
    state.items = ManifestUtils.moveItem(state.items, i, delta);
    showBanner(null);
    render({ key: key, cls: cls });
  }

  function removeItem(i) {
    var item = state.items[i];
    var name = item.title.trim() || (item.file ? item.file.split('/').pop() : 'รูปนี้');
    if (!window.confirm('ลบ “' + name + '” ออกจากเว็บ? (จะลบจริงเมื่อกดบันทึก)')) return;
    state.items.splice(i, 1);
    if (item.status === 'new') revoke(item.src);
    else state.removed.push(item.file);
    showBanner(null);
    var next = state.items[Math.min(i, state.items.length - 1)];
    render(next ? { key: next.key, cls: 'danger' } : null);
  }

  /* =====================================================================
   * Picking files
   * ===================================================================== */
  function handleFiles(fileList) {
    Array.prototype.forEach.call(fileList, function (file) {
      var p = { id: nextId++, name: file.name, size: file.size, status: 'compressing', title: '' };
      if (!/^image\//.test(file.type)) {
        p.status = 'error';
        p.error = 'ไฟล์นี้ไม่ใช่รูปภาพ';
        state.pending.push(p);
        return;
      }
      state.pending.push(p);
      ImageCompress.compressImage(file, 1600, 0.82).then(function (blob) {
        p.blob = blob;
        p.src = URL.createObjectURL(blob);
        p.status = 'ready';
        var probe = new Image();
        probe.onload = function () {
          p.dims = probe.naturalWidth + ' × ' + probe.naturalHeight;
          renderPending();
        };
        probe.src = p.src;
        renderPending();
      }).catch(function (err) {
        p.status = 'error';
        p.error = 'เปิดรูปนี้ไม่ได้ (' + err.message + ')';
        renderPending();
      });
    });
    renderPending();
    var firstReady = document.querySelector('.pending input');
    if (firstReady) firstReady.focus();
  }

  function dropPending(p) {
    revoke(p.src);
    state.pending = state.pending.filter(function (x) { return x !== p; });
    renderPending();
  }

  function addPending(p) {
    var title = p.title.trim();
    if (!title || p.status !== 'ready') return;
    var key = 'new-' + p.id;
    state.items.unshift({ key: key, file: null, title: title, src: p.src, status: 'new', blob: p.blob });
    state.pending = state.pending.filter(function (x) { return x !== p; });
    showBanner(null);
    renderPending();
    render();
    var next = document.querySelector('.pending input');
    if (next) next.focus();
  }

  function renderPending() {
    var wrap = $('pending-list');
    wrap.innerHTML = '';
    state.pending.forEach(function (p) {
      var addBtn = el('button', {
        type: 'button', 'class': 'btn btn-primary', text: 'เพิ่มเข้ารายการ',
        disabled: p.status !== 'ready' || !p.title.trim(),
        onclick: function () { addPending(p); }
      });
      var inputId = 'pending-title-' + p.id;
      var input = el('input', {
        type: 'text', id: inputId, value: p.title, maxlength: '160',
        placeholder: 'เช่น มั่นใจน้ำประปา กปน. ปลอดภัยจากโลหะหนัก'
      });
      input.addEventListener('input', function () {
        p.title = input.value;
        addBtn.disabled = p.status !== 'ready' || !p.title.trim();
      });
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') addPending(p); });

      var metaLines;
      if (p.status === 'compressing') metaLines = ['กำลังย่อขนาด…'];
      else if (p.status === 'error') metaLines = [p.error];
      else metaLines = [formatSize(p.size) + ' → ย่อเหลือ ' + formatSize(p.blob.size) + (p.dims ? ' (' + p.dims + ')' : '')];

      var card = el('div', { 'class': 'card pending' }, [
        el('div', { 'class': 'pending-top' }, [
          p.src ? el('img', { 'class': 'pending-thumb', src: p.src, alt: '' }) : el('div', { 'class': 'pending-thumb' }),
          el('div', { 'class': 'pending-meta' }, [el('span', { 'class': 'pending-name', text: p.name })].concat(
            metaLines.map(function (t) { return el('span', { text: t, 'class': p.status === 'error' ? 'error' : null }); })
          ))
        ]),
        p.status === 'error' ? null : el('div', { 'class': 'field' }, [
          el('label', { 'for': inputId, text: 'ชื่อ infographic' }),
          input,
          el('span', { 'class': 'hint', text: 'แสดงใต้รูปบนหน้าเว็บ และใช้เป็นคำอธิบายรูปสำหรับผู้ใช้โปรแกรมอ่านหน้าจอ' })
        ]),
        p.status === 'error' ? null : el('div', { 'class': 'note', html: ICONS.arrowUp + '<span>จะขึ้นเป็นรูปแรกของ carousel · เปลี่ยนลำดับได้ภายหลัง</span>' }),
        el('div', { 'class': 'actions' }, [
          el('button', { type: 'button', 'class': 'btn', text: p.status === 'error' ? 'ปิด' : 'ยกเลิก', onclick: function () { dropPending(p); } }),
          p.status === 'error' ? null : addBtn
        ])
      ]);
      wrap.appendChild(card);
    });
  }

  var fileInput = $('upload-file');
  var dropzone = $('dropzone');
  fileInput.addEventListener('change', function () {
    handleFiles(fileInput.files);
    fileInput.value = '';
  });
  ['dragenter', 'dragover'].forEach(function (type) {
    dropzone.addEventListener(type, function (e) {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach(function (type) {
    dropzone.addEventListener(type, function () { dropzone.classList.remove('dragover'); });
  });
  dropzone.addEventListener('drop', function (e) {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  });
  // A file dropped outside the box shouldn't navigate away from the page
  window.addEventListener('dragover', function (e) { e.preventDefault(); });
  window.addEventListener('drop', function (e) { e.preventDefault(); });

  /* =====================================================================
   * Saving: everything in ONE commit
   * ===================================================================== */
  function save() {
    if (state.saving || !isDirty()) return;
    var untitledNew = state.items.some(function (i) { return i.status === 'new' && !i.title.trim(); });
    if (untitledNew) { showBanner('err', 'รูปใหม่ต้องมีชื่อก่อนบันทึก'); return; }

    state.saving = true;
    showBanner('busy', 'กำลังบันทึกและเผยแพร่…');
    render();

    var newItems = state.items.filter(function (i) { return i.status === 'new'; });
    var assigned = {};

    GitHubAPI.getFile(MANIFEST_PATH, token).then(function (file) {
      var currentSha = file ? file.sha : null;
      if (currentSha !== state.sha) {
        throw new Error('รายการถูกแก้จากที่อื่นระหว่างนี้ กด “ยกเลิก” เพื่อโหลดรายการล่าสุด แล้วทำใหม่อีกครั้ง');
      }
      var known = GitHubAPI.readJSON(file, []).map(function (e) { return e.file; })
        .concat(state.removed);
      var now = new Date();
      newItems.forEach(function (item) {
        var name = ManifestUtils.generateFilename(now, known);
        known.push(IMAGES_DIR + name);
        assigned[item.key] = IMAGES_DIR + name;
      });

      return Promise.all(newItems.map(function (item) {
        return ImageCompress.blobToBase64(item.blob).then(function (b64) {
          return { path: assigned[item.key], base64: b64 };
        });
      }));
    }).then(function (imageFiles) {
      var manifest = state.items.map(function (item) {
        return { file: item.file || assigned[item.key], alt: item.title.trim() || 'Infographic' };
      });
      var deletions = state.removed.filter(function (f) {
        return f.indexOf(IMAGES_DIR) === 0 && !manifest.some(function (m) { return m.file === f; });
      });

      var summary = [];
      if (newItems.length) summary.push('add ' + newItems.length);
      if (deletions.length) summary.push('remove ' + deletions.length);
      summary.push('order/titles');

      return GitHubAPI.commitChanges(token, {
        message: 'Update infographics (' + summary.join(', ') + ')',
        files: imageFiles.concat([{ path: MANIFEST_PATH, base64: GitHubAPI.encodeJSON(manifest) }]),
        deletions: deletions
      });
    }).then(function () {
      var until = Date.now() + PUBLISH_MS;
      newItems.forEach(function (item) {
        publishing[assigned[item.key]] = { until: until, src: item.src };
      });
      setTimeout(function () {
        if (!state.saving && !isDirty()) loadManifest();
      }, PUBLISH_MS + 1000);
      state.saving = false;
      return loadManifest().then(function () {
        showBanner('ok', 'บันทึกแล้ว · หน้าเว็บจะอัปเดตภายในประมาณ 1 นาที');
      });
    }).catch(function (err) {
      state.saving = false;
      showBanner('err', 'บันทึกไม่สำเร็จ: ' + err.message);
      render();
    });
  }

  function discard() {
    if (!window.confirm('ทิ้งการเปลี่ยนแปลงทั้งหมดและโหลดรายการล่าสุด?')) return;
    state.items.forEach(function (i) { if (i.status === 'new') revoke(i.src); });
    showBanner(null);
    loadManifest();
  }

  $('save-btn').addEventListener('click', save);
  $('discard-btn').addEventListener('click', discard);

  window.addEventListener('beforeunload', function (e) {
    if (token && (hasUnsaved() || state.saving)) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  /* ---- start ---- */
  showGate(getVault() ? 'pin' : 'setup');
})();
