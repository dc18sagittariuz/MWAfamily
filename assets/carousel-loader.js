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
