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
    // no-store: GitHub caches contents responses for ~60s, which would hand
    // back a stale sha right after a save.
    return fetch(API_BASE + '/contents/' + path, { headers: authHeaders(token), cache: 'no-store' })
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

  function api(method, path, token, body) {
    var opts = { method: method, headers: authHeaders(token), cache: 'no-store' };
    if (body !== undefined) {
      opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers);
      opts.body = JSON.stringify(body);
    }
    return fetch(API_BASE + path, opts).then(function (res) {
      if (!res.ok) {
        return res.json().catch(function () { return {}; }).then(function (err) {
          throw new Error(method + ' ' + path + ' failed: ' + (err.message || res.status));
        });
      }
      return res.json();
    });
  }

  // Write several files (and delete others) as ONE commit using the Git Data API.
  // opts: { branch, message, files: [{ path, base64 }], deletions: [path] }
  function commitChanges(token, opts) {
    var branch = opts.branch || 'main';
    var files = opts.files || [];
    var deletions = opts.deletions || [];
    var headSha;

    return api('GET', '/git/ref/heads/' + branch, token).then(function (ref) {
      headSha = ref.object.sha;
      return api('GET', '/git/commits/' + headSha, token);
    }).then(function (headCommit) {
      return Promise.all(files.map(function (f) {
        return api('POST', '/git/blobs', token, { content: f.base64, encoding: 'base64' })
          .then(function (blob) {
            return { path: f.path, mode: '100644', type: 'blob', sha: blob.sha };
          });
      })).then(function (entries) {
        deletions.forEach(function (path) {
          entries.push({ path: path, mode: '100644', type: 'blob', sha: null });
        });
        return api('POST', '/git/trees', token, { base_tree: headCommit.tree.sha, tree: entries });
      });
    }).then(function (tree) {
      return api('POST', '/git/commits', token, { message: opts.message, tree: tree.sha, parents: [headSha] });
    }).then(function (commit) {
      return api('PATCH', '/git/refs/heads/' + branch, token, { sha: commit.sha, force: false })
        .then(function () { return commit; });
    });
  }

  // UTF-8 safe base64 helpers (plain btoa/atob break on Thai text)
  function encodeText(text) {
    var bytes = new TextEncoder().encode(text);
    var binary = '';
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function decodeText(base64) {
    var binary = atob(base64.replace(/\s/g, ''));
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function readJSON(file, fallback) {
    return file ? JSON.parse(decodeText(file.content)) : fallback;
  }

  function encodeJSON(value) {
    return encodeText(JSON.stringify(value, null, 2) + '\n');
  }

  global.GitHubAPI = {
    commitChanges: commitChanges,
    encodeText: encodeText,
    decodeText: decodeText,
    readJSON: readJSON,
    encodeJSON: encodeJSON,
    validateToken: validateToken,
    getFile: getFile,
    putFile: putFile,
    deleteFile: deleteFile
  };
})(window);
