/* ============================================================
   Nexus Solutions — نكسس سوليوشنز
   Language toggle (AR/EN) + UI interactions
   ============================================================ */
(function () {
  "use strict";

  var LANG_KEY = "nexus-lang";
  var html = document.documentElement;
  var langToggle = document.getElementById("langToggle");

  /* ---------- Language ---------- */
  function applyLang(lang) {
    html.setAttribute("data-lang", lang);
    html.setAttribute("lang", lang === "ar" ? "ar" : "en");
    html.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");

    // data-ar / data-en  →  text content
    document.querySelectorAll("[data-ar][data-en]").forEach(function (el) {
      el.textContent = el.getAttribute("data-" + lang) || el.textContent;
    });

    // data-ar-ph / data-en-ph  →  placeholder
    document.querySelectorAll("[data-ar-ph][data-en-ph]").forEach(function (el) {
      el.setAttribute("placeholder", el.getAttribute("data-" + lang + "-ph") || "");
    });

    if (langToggle) langToggle.textContent = lang === "ar" ? "EN" : "ع";
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* private mode */ }
  }

  var saved = null;
  try { saved = localStorage.getItem(LANG_KEY); } catch (e) { /* ignore */ }
  applyLang(saved === "ar" ? "ar" : "en"); // default: English LTR (Arabic available via toggle)

  if (langToggle) {
    langToggle.addEventListener("click", function () {
      var next = html.getAttribute("data-lang") === "ar" ? "en" : "ar";
      applyLang(next);
    });
  }

  /* ---------- Header shadow on scroll ---------- */
  var header = document.getElementById("siteHeader");
  function onScroll() {
    if (!header) return;
    header.classList.toggle("scrolled", window.scrollY > 8);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile nav ---------- */
  var burger = document.getElementById("navBurger");
  var nav = document.getElementById("mainNav");
  if (burger && nav) {
    burger.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        nav.classList.remove("open");
        burger.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- Scroll reveal ---------- */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("visible"); });
  }

  /* ---------- Esteshari: request-app WhatsApp deep link ---------- */
  var requestBtn = document.getElementById("requestAppBtn");
  if (requestBtn) {
    requestBtn.setAttribute("target", "_blank");
    requestBtn.setAttribute("rel", "noopener");

    function setRequestHref() {
      var isAr = html.getAttribute("data-lang") === "ar";
      var msg = isAr
        ? "السلام عليكم، أرغب في طلب نسخة من برنامج إستشاري (Esteshari) لإدارة مستندات المشاريع الهندسية."
        : "Hello, I would like to request a copy of Esteshari for engineering project document management.";
      requestBtn.href = "https://wa.me/201040350971?text=" + encodeURIComponent(msg);
    }
    setRequestHref();
    // keep message language in sync when the user switches language
    langToggle && langToggle.addEventListener("click", setRequestHref);
  }

  /* ---------- Contact form → WhatsApp ---------- */
  var form = document.getElementById("contactForm");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = (document.getElementById("cfName") || {}).value || "";
      var phone = (document.getElementById("cfPhone") || {}).value || "";
      var msg = (document.getElementById("cfMsg") || {}).value || "";
      name = name.trim(); phone = phone.trim(); msg = msg.trim();

      if (!name || !msg) {
        var isAr0 = html.getAttribute("data-lang") === "ar";
        alert(isAr0 ? "من فضلك اكتب اسمك ورسالتك ✓" : "Please enter your name and message ✓");
        return;
      }

      var isAr = html.getAttribute("data-lang") === "ar";
      var full = isAr
        ? "مرحبًا نكسس سوليوشنز 👋\n\nالاسم: " + name +
          (phone ? "\nالهاتف: " + phone : "") +
          "\n\nالرسالة: " + msg
        : "Hello Nexus Solutions 👋\n\nName: " + name +
          (phone ? "\nPhone: " + phone : "") +
          "\n\nMessage: " + msg;

      window.open("https://wa.me/201040350971?text=" + encodeURIComponent(full), "_blank", "noopener");
    });
  }

  /* ---------- Footer year ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
