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

    /* ---------- Sticky navbar shadow ---------- */
    var navbar = document.querySelector('.navbar');
    if (navbar) {
        window.addEventListener('scroll', function () {
            navbar.classList.toggle('scrolled', window.scrollY > 20);
        }, { passive: true });
    }

    /* ---------- Scroll-to-top ---------- */
    var scrollBtn = document.getElementById('scroll-top');
    if (scrollBtn) {
        window.addEventListener('scroll', function () {
            scrollBtn.classList.toggle('visible', window.scrollY > 400);
        }, { passive: true });
        scrollBtn.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    /* ---------- Reveal on scroll ---------- */
    function reveal() {
        document.querySelectorAll('.reveal:not(.visible)').forEach(function (el) {
            var rect = el.getBoundingClientRect();
            if (rect.top < window.innerHeight - 60) el.classList.add('visible');
        });
    }
    window.addEventListener('scroll', reveal, { passive: true });
    window.addEventListener('resize', reveal, { passive: true });
    reveal();

    /* ---------- Stat counter ---------- */
    function animateCounters() {
        document.querySelectorAll('.stat-number').forEach(function (el) {
            if (el.dataset.done) return;
            var rect = el.getBoundingClientRect();
            if (rect.top > window.innerHeight) return;
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
        });
    }
    window.addEventListener('scroll', animateCounters, { passive: true });
    animateCounters();

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
