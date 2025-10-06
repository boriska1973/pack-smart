// global.js - small header/nav interactions used on all pages

document.addEventListener('DOMContentLoaded', () => {
  // burger toggle for small screens
  const burger = document.querySelectorAll('.burger');
  burger.forEach(btn => {
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      document.body.classList.toggle('nav-open');
      // simple animation: toggle nav class
      document.querySelectorAll('.nav').forEach(n => n.classList.toggle('open'));
    });
  });

  // highlight current nav based on page
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.href === location.href || link.href === location.pathname.split('/').pop()) {
      link.classList.add('current');
    }
  });

  // small entrance animation for cards
  document.querySelectorAll('.card').forEach((card, i) => {
    card.style.opacity = 0;
    card.style.transform = 'translateY(10px)';
    setTimeout(() => {
      card.style.transition = 'opacity .6s ease, transform .6s cubic-bezier(.2,.9,.2,1)';
      card.style.opacity = 1;
      card.style.transform = 'translateY(0)';
    }, 120 + i*80);
  });
});
