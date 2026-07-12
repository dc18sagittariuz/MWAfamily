(function (global) {
  'use strict';

  function toBase64(buffer) {
    var bytes = new Uint8Array(buffer);
    var binary = '';
    for (var i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function fromBase64(base64) {
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  function deriveKey(pin, salt) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey'])
      .then(function (keyMaterial) {
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt']
        );
      });
  }

  function encryptToken(token, pin) {
    var salt = crypto.getRandomValues(new Uint8Array(16));
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return deriveKey(pin, salt).then(function (key) {
      var enc = new TextEncoder();
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, enc.encode(token));
    }).then(function (ciphertextBuffer) {
      return {
        salt: toBase64(salt),
        iv: toBase64(iv),
        ciphertext: toBase64(ciphertextBuffer)
      };
    });
  }

  function decryptToken(vault, pin) {
    var salt = fromBase64(vault.salt);
    var iv = fromBase64(vault.iv);
    var ciphertext = fromBase64(vault.ciphertext);
    return deriveKey(pin, salt).then(function (key) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ciphertext);
    }).then(function (plainBuffer) {
      var dec = new TextDecoder();
      return dec.decode(plainBuffer);
    });
  }

  global.CryptoVault = {
    encryptToken: encryptToken,
    decryptToken: decryptToken
  };
})(window);
