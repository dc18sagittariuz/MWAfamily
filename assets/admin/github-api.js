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
