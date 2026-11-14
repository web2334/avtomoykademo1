/** Появление элементов при прокрутке. */
(function () {
  'use strict';

  let observer = null;

  AQ.reveal = {
    init() {
      if (AQ.env.reducedMotion || !('IntersectionObserver' in window)) {
        AQ.utils.qsa('[data-reveal]').forEach((el) => el.classList.add('is-visible'));
        return;
      }
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          });
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
      );
      AQ.utils.qsa('[data-reveal]').forEach((el) => observer.observe(el));
    },
    observe(el) {
      if (observer) observer.observe(el);
      else el.classList.add('is-visible');
    }
  };
})();
