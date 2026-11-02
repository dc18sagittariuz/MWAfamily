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

  // Number of infographics shown on the homepage carousel.
  // Keep in sync with MAX_SLIDES in assets/carousel-loader.js.
  var HOMEPAGE_LIMIT = 8;

  function moveItem(list, index, delta) {
    var target = index + delta;
    if (index < 0 || index >= list.length || target < 0 || target >= list.length) {
      return list.slice();
    }
    var copy = list.slice();
    var item = copy.splice(index, 1)[0];
    copy.splice(target, 0, item);
    return copy;
  }

  // Old entries were saved with the placeholder alt "Infographic".
  function titleOf(entry) {
    var alt = (entry && entry.alt) || '';
    return alt === 'Infographic' ? '' : alt;
  }

  global.ManifestUtils = {
    HOMEPAGE_LIMIT: HOMEPAGE_LIMIT,
    moveItem: moveItem,
    titleOf: titleOf,
    generateFilename: generateFilename,
    addEntry: addEntry,
    removeEntry: removeEntry
  };
})(window);
