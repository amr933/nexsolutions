/* =========================================================
   نكسس سوليوشنز — سكربت الموقع
   تبديل اللغة (عربي/إنجليزي) • قائمة الموبايل • حركات الظهور
   ========================================================= */
(function () {
  "use strict";

  var WA_NUMBER = "201040350971";           // واتساب نكسس سوليوشنز
  var LS_LANG = "nexus_lang";
  var root = document.documentElement;

  /* ---------- 1) اللغة ---------- */
  function setLang(lang) {
    lang = (lang === "en") ? "en" : "ar";

    root.setAttribute("data-lang", lang);
    root.setAttribute("lang", lang);
    root.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");

    // النصوص
    var nodes = document.querySelectorAll("[data-ar]");
    for (var i = 0; i < nodes.length; i++) {
      var v = nodes[i].getAttribute("data-" + lang);
      if (v !== null) nodes[i].textContent = v;
    }

    // العنوان والوصف
    var title = document.querySelector("title");
    if (title && title.getAttribute("data-" + lang)) {
      title.textContent = title.getAttribute("data-" + lang);
    }
    var meta = document.querySelector('meta[name="description"]');
    if (meta && meta.getAttribute("data-" + lang)) {
      meta.setAttribute("content", meta.getAttribute("data-" + lang));
    }

    // زر التبديل يعرض اللغة الأخرى
    var btn = document.getElementById("langBtn");
    if (btn) btn.textContent = (lang === "ar") ? "EN" : "ع";

    buildWhatsApp();
    try { localStorage.setItem(LS_LANG, lang); } catch (e) {}
  }

  function currentLang() { return root.getAttribute("data-lang") === "en" ? "en" : "ar"; }

  /* ---------- 2) روابط واتساب برسالة جاهزة ---------- */
  function buildWhatsApp() {
    var lang = currentLang();
    var links = document.querySelectorAll("a.wa-link");
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var msg = (lang === "ar")
        ? "السلام عليكم، أنا مهتم بمنتجات نكسس سوليوشنز"
        : "Hello, I am interested in Nexus Solutions products";

      var card = a.closest ? a.closest(".product-card") : null;
      if (card) {
        var h3 = card.querySelector("h3");
        if (h3) {
          var name = h3.textContent.trim();
          msg = (lang === "ar")
            ? "السلام عليكم، أنا مهتم بمنتج " + name
            : "Hello, I am interested in " + name;
        }
      }
      a.setAttribute("href", "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(msg));
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener");
    }
  }

  /* ---------- 3) قائمة الموبايل ---------- */
  function initNav() {
    var burger = document.getElementById("burger");
    var nav = document.getElementById("nav");
    if (!burger || !nav) return;

    burger.addEventListener("click", function (e) {
      e.stopPropagation();
      nav.classList.toggle("open");
    });
    nav.addEventListener("click", function () { nav.classList.remove("open"); });
    document.addEventListener("click", function (e) {
      if (!nav.contains(e.target)) nav.classList.remove("open");
    });
  }

  /* ---------- 4) حركات الظهور ---------- */
  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      for (var k = 0; k < items.length; k++) items[k].classList.add("in");
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("in");
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -40px 0px" });
    for (var i = 0; i < items.length; i++) io.observe(items[i]);
  }

  /* ---------- 5) الرابط النشط + زر الصعود ---------- */
  function initScrollSpy() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.nav a[href^="#"]'));
    var toTop = document.getElementById("toTop");
    var sections = links
      .map(function (a) { return document.querySelector(a.getAttribute("href")); })
      .filter(Boolean);

    function onScroll() {
      var y = window.pageYOffset || document.documentElement.scrollTop;
      var current = sections[0];
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].offsetTop - 120 <= y) current = sections[i];
      }
      for (var j = 0; j < links.length; j++) {
        var active = current && links[j].getAttribute("href") === "#" + current.id;
        links[j].classList.toggle("active", !!active);
      }
      if (toTop) toTop.classList.toggle("show", y > 520);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- التشغيل ---------- */
  function boot() {
    var saved = null;
    try { saved = localStorage.getItem(LS_LANG); } catch (e) {}
    setLang(saved || "ar");

    var btn = document.getElementById("langBtn");
    if (btn) {
      btn.addEventListener("click", function () {
        setLang(currentLang() === "ar" ? "en" : "ar");
      });
    }

    initNav();
    initReveal();
    initScrollSpy();
    buildWhatsApp();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
