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
