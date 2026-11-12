/* main.js — BENJUMANLY PROPERTIES AND CONSULTANCY SERVICES LTD */

(function () {
    'use strict';

    /* ---------- Loading bar ---------- */
    var bar = document.getElementById('loading-bar');
    if (bar) {
        bar.style.width = '100%';
        setTimeout(function () { bar.classList.add('done'); }, 420);
    }

    /* ---------- Theme toggle ---------- */
    var themeBtn = document.getElementById('theme-toggle');
    var saved = localStorage.getItem('theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    if (themeBtn) {
        themeBtn.addEventListener('click', function () {
            var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
            themeBtn.textContent = next === 'dark' ? '☀' : '🌙';
        });
        if (saved === 'dark' && themeBtn) themeBtn.textContent = '☀';
    }

    /* ---------- Palette panel ---------- */
    var paletteBtn = document.getElementById('palette-btn');
    var palettePanel = document.getElementById('palette-panel');
    if (paletteBtn && palettePanel) {
        function openPalette() {
            palettePanel.classList.add('open');
            palettePanel.setAttribute('aria-hidden', 'false');
            var first = palettePanel.querySelector('.palette-option');
            if (first) first.focus();
        }
        function closePalette() {
            palettePanel.classList.remove('open');
            palettePanel.setAttribute('aria-hidden', 'true');
            paletteBtn.focus();
        }
        paletteBtn.addEventListener('click', function () {
            var isOpen = palettePanel.classList.contains('open');
            if (isOpen) closePalette(); else openPalette();
        });
        var options = palettePanel.querySelectorAll('.palette-option');
        options.forEach(function (opt) {
            opt.setAttribute('tabindex', '0');
            opt.setAttribute('role', 'option');
            opt.setAttribute('aria-selected', 'false');
            opt.addEventListener('click', function () {
                document.documentElement.setAttribute('data-palette', opt.dataset.palette);
                localStorage.setItem('palette', opt.dataset.palette);
                closePalette();
            });
            opt.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opt.click(); }
                if (e.key === 'Escape') { closePalette(); }
                if (e.key === 'ArrowDown') { e.preventDefault(); var next = opt.nextElementSibling; if (next) next.focus(); }
                if (e.key === 'ArrowUp') { e.preventDefault(); var prev = opt.previousElementSibling; if (prev) prev.focus(); }
            });
        });
        palettePanel.setAttribute('role', 'listbox');
        palettePanel.setAttribute('aria-label', 'Color palette');
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && palettePanel.classList.contains('open')) closePalette();
        });
        var savedPalette = localStorage.getItem('palette');
        if (savedPalette) document.documentElement.setAttribute('data-palette', savedPalette);
    }

    /* ---------- Nav toggle (mobile) ---------- */
    var navToggle = document.getElementById('nav-toggle');
    var navLinks = document.getElementById('nav-links');
    var lastFocusedNav = null;
    if (navToggle && navLinks) {
        function openNav() {
            lastFocusedNav = document.activeElement;
            navLinks.classList.add('open');
            navToggle.classList.add('open');
            navToggle.setAttribute('aria-expanded', 'true');
            document.body.classList.add('nav-lock');
            var firstLink = navLinks.querySelector('a');
            if (firstLink) firstLink.focus();
        }
        function closeNav() {
            navLinks.classList.remove('open');
            navToggle.classList.remove('open');
            navToggle.setAttribute('aria-expanded', 'false');
            document.body.classList.remove('nav-lock');
            if (lastFocusedNav) lastFocusedNav.focus();
        }
        navToggle.addEventListener('click', function () {
            var isOpen = navLinks.classList.contains('open');
            if (isOpen) closeNav(); else openNav();
        });
        navLinks.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { closeNav(); return; }
            if (e.key === 'Tab') {
                var focusable = navLinks.querySelectorAll('a, button');
                var first = focusable[0];
                var last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && navLinks.classList.contains('open')) closeNav();
        });
    }

    /* ---------- Sticky navbar + scroll-to-top ----------
       ONE scroll listener, throttled to animation frames — the browser
       fires scroll events up to 120x/sec; we do at most 1 update/frame. */
    var navbar = document.querySelector('.navbar');
    var scrollBtn = document.getElementById('scroll-top');
    var scrollTicking = false;
    function updateScrollUI() {
        scrollTicking = false;
        var y = window.scrollY;
        if (navbar) navbar.classList.toggle('scrolled', y > 20);
        if (scrollBtn) scrollBtn.classList.toggle('visible', y > 400);
    }
    window.addEventListener('scroll', function () {
        if (scrollTicking) return;
        scrollTicking = true;
        requestAnimationFrame(updateScrollUI);
    }, { passive: true });
    if (scrollBtn) {
        scrollBtn.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    /* ---------- Reveal on scroll + stat counters ----------
       IntersectionObserver instead of scroll handlers: the browser tells
       us when an element enters the viewport — ZERO DOM queries,
       ZERO forced layout, ZERO work on scroll events. */
    function animateCounter(el) {
        if (el.dataset.done) return;
        el.dataset.done = '1';
        var target = parseInt(el.dataset.count, 10) || 0;
        var suffix = el.dataset.suffix || '';
        var duration = 1200;
        var start = performance.now();
        el.setAttribute('aria-live', 'polite');
        el.setAttribute('role', 'status');
        function step(now) {
            var progress = Math.min((now - start) / duration, 1);
            var eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(target * eased) + suffix;
            if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    var revealEls = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    var statEls = Array.prototype.slice.call(document.querySelectorAll('.stat-number'));

    if ('IntersectionObserver' in window) {
        var revealIO = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('visible');
                revealIO.unobserve(entry.target); // one-shot: stop observing after reveal
            });
        }, { rootMargin: '0px 0px -60px 0px' }); // matches old "60px before bottom" rule
        revealEls.forEach(function (el) { revealIO.observe(el); });

        var statIO = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                statIO.unobserve(entry.target);
                animateCounter(entry.target);
            });
        }, { threshold: 0.3 });
        statEls.forEach(function (el) { statIO.observe(el); });
    } else {
        // Fallback for very old browsers: reveal everything at once
        revealEls.forEach(function (el) { el.classList.add('visible'); });
        statEls.forEach(animateCounter);
    }

    /* ---------- Active nav link ---------- */
    var currentPage = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('#nav-links a').forEach(function (a) {
        var href = a.getAttribute('href');
        var hrefPage = href.split('/').pop().split('?')[0];
        if (hrefPage === currentPage || (currentPage === '' && hrefPage === 'index.html')) {
            a.classList.add('active');
        }
    });

    /* ---------- Toast helper ---------- */
    window.showToast = function (message, type) {
        var host = document.querySelector('.toast-host');
        if (!host) {
            host = document.createElement('div');
            host.className = 'toast-host';
            document.body.appendChild(host);
        }
        var t = document.createElement('div');
        t.className = 'toast toast-' + (type || 'info');
        t.textContent = message;
        host.appendChild(t);
        requestAnimationFrame(function () { t.classList.add('visible'); });
        setTimeout(function () {
            t.classList.remove('visible');
            setTimeout(function () { t.remove(); }, 320);
        }, 3500);
    };

    /* ---------- Magnetic buttons ---------- */
    document.querySelectorAll('.magnetic').forEach(function (btn) {
        btn.addEventListener('mousemove', function (e) {
            var rect = btn.getBoundingClientRect();
            var x = (e.clientX - rect.left - rect.width / 2) * 0.15;
            var y = (e.clientY - rect.top - rect.height / 2) * 0.15;
            btn.style.transform = 'translate(' + x + 'px,' + y + 'px)';
        });
        btn.addEventListener('mouseleave', function () {
            btn.style.transform = '';
        });
    });

    /* ---------- Password toggle ---------- */
    document.querySelectorAll('.toggle-pw').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var input = btn.previousElementSibling || btn.parentElement.querySelector('input');
            if (!input) return;
            var show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            btn.textContent = show ? 'Hide' : 'Show';
        });
    });
})();
