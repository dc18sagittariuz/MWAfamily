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
