/**
 * Свечение и курсор.
 *  • Бирюзовое свечение плавно следует за мышью; на телефонах — медленно переливается само.
 *  • Курсор: заполненная точка + кольцо, которое догоняет её с небольшой задержкой.
 *    Над ссылками и кнопками кольцо увеличивается, над полями ввода — уступает место обычному курсору.
 */
(function () {
  'use strict';

  AQ.components.cursor = {
    init() {
      const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
      const reduced = AQ.env.reducedMotion;

      const glow = document.createElement('div');
      glow.className = 'ambient' + (finePointer ? ' ambient--follow' : ' ambient--drift');
      glow.setAttribute('aria-hidden', 'true');
      document.body.appendChild(glow);

      if (!finePointer) return; // телефоны и планшеты: только переливающееся свечение

      const dot = document.createElement('div');
      const ring = document.createElement('div');
      dot.className = 'cursor-dot';
      ring.className = 'cursor-ring';
      dot.setAttribute('aria-hidden', 'true');
      ring.setAttribute('aria-hidden', 'true');
      document.body.append(dot, ring);
      document.documentElement.classList.add('has-cursor');

      const pos = { x: innerWidth / 2, y: innerHeight / 2 };
      const ringPos = { ...pos };
      const glowPos = { ...pos };
      let visible = false, raf = 0;

      const INTERACTIVE = 'a, button, [role="slider"], [role="tab"], select, label, summary, .service-card, [data-glow-host]';
      const TEXT = 'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), textarea';

      const loop = () => {
        // Кольцо отстаёт от точки, свечение — ещё сильнее
        const kRing = reduced ? 1 : 0.18;
        const kGlow = reduced ? 1 : 0.07;
        ringPos.x += (pos.x - ringPos.x) * kRing;
        ringPos.y += (pos.y - ringPos.y) * kRing;
        glowPos.x += (pos.x - glowPos.x) * kGlow;
        glowPos.y += (pos.y - glowPos.y) * kGlow;
        dot.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
        ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0)`;
        glow.style.transform = `translate3d(${glowPos.x}px, ${glowPos.y}px, 0)`;
        const settled = Math.abs(pos.x - glowPos.x) < 0.3 && Math.abs(pos.y - glowPos.y) < 0.3;
        raf = settled ? 0 : requestAnimationFrame(loop);
      };
      const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };

      document.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        pos.x = e.clientX;
        pos.y = e.clientY;
        if (!visible) {
          visible = true;
          ringPos.x = glowPos.x = pos.x;
          ringPos.y = glowPos.y = pos.y;
          document.documentElement.classList.add('cursor-visible');
        }
        const t = e.target;
        const overText = !!(t.closest && t.closest(TEXT));
        document.documentElement.classList.toggle('cursor-text', overText);
        document.documentElement.classList.toggle('cursor-hover', !overText && !!(t.closest && t.closest(INTERACTIVE)));
        kick();
      }, { passive: true });

      document.addEventListener('pointerdown', () => document.documentElement.classList.add('cursor-down'));
      document.addEventListener('pointerup', () => document.documentElement.classList.remove('cursor-down'));
      document.documentElement.addEventListener('mouseleave', () => { visible = false; document.documentElement.classList.remove('cursor-visible'); });
      window.addEventListener('blur', () => document.documentElement.classList.remove('cursor-visible'));
    }
  };
})();
