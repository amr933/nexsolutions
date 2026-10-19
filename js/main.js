/* =========================================================
   نكسس سوليوشنز — سكربت الموقع
   اللغة الأساسية: الإنجليزية (LTR) • تبديل للعربية (RTL)
   قائمة الموبايل • حركات الظهور • نموذج التواصل
   ========================================================= */
(function () {
  "use strict";

  var WA_NUMBER = "201040350971";           // واتساب نكسس سوليوشنز
  var MAIL = "eng.amraladin@gmail.com";
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

    // النصوص التوضيحية داخل الحقول (Placeholder)
    var phs = document.querySelectorAll("[data-ar-ph]");
    for (var p = 0; p < phs.length; p++) {
      var pv = phs[p].getAttribute("data-" + lang + "-ph");
      if (pv !== null) phs[p].setAttribute("placeholder", pv);
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

    // وصف زر القائمة (لقارئ الشاشة)
    var burger = document.getElementById("burger");
    if (burger) burger.setAttribute("aria-label", lang === "ar" ? "القائمة" : "Menu");

    buildWhatsApp();
    cfRender();          // ترجمة رسالة النموذج لو كانت ظاهرة
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
        ? "السلام عليكم، أنا مهتم بخدمات نكسس سوليوشنز"
        : "Hello, I am interested in Nexus Solutions services";

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

  /* ---------- 3) نموذج التواصل ---------- */
  var CF_LABELS = {
    ar: { name: "الاسم", contact: "وسيلة التواصل", service: "الخدمة المطلوبة", details: "التفاصيل",
          subject: "طلب من موقع نكسس سوليوشنز", intro: "السلام عليكم، هذا طلب من نموذج الموقع:",
          okWa: "تم تجهيز رسالتك — كمّل الإرسال في واتساب.",
          okMail: "تم تجهيز بريد إلكتروني بالرسالة — كمّل الإرسال من برنامج البريد.",
          bad: "من فضلك اكمل: الاسم ووسيلة التواصل وتفاصيل المشروع." },
    en: { name: "Name", contact: "Contact", service: "Service", details: "Details",
          subject: "Website enquiry — Nexus Solutions", intro: "Hello, this is an enquiry from the website form:",
          okWa: "Your message is ready — finish sending it in WhatsApp.",
          okMail: "An email with your message is ready — finish sending it in your mail app.",
          bad: "Please fill in: your name, a way to reach you and the project details." }
  };

  function cfValue(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || "").trim() : "";
  }

  function cfMessage(lang) {
    var L = CF_LABELS[lang];
    return L.intro + "\n\n" +
      L.name + ": " + cfValue("cf-name") + "\n" +
      L.contact + ": " + cfValue("cf-contact") + "\n" +
      L.service + ": " + cfValue("cf-service") + "\n" +
      L.details + ": " + cfValue("cf-details");
  }

  var cfState = null;   // { type: "ok" | "bad", key: "okWa" | "okMail" | "bad" }

  function cfRender() {
    var box = document.getElementById("cfMsg");
    if (!box) return;
    if (!cfState) { box.hidden = true; box.textContent = ""; return; }
    box.className = "cf-msg " + (cfState.type === "ok" ? "ok" : "bad");
    box.textContent = CF_LABELS[currentLang()][cfState.key];
    box.hidden = false;
  }

  function cfShow(type, key) { cfState = { type: type, key: key }; cfRender(); }
  function cfClear() { cfState = null; cfRender(); }

  function cfValidate(lang) {
    var fields = ["cf-name", "cf-contact", "cf-details"];
    var bad = false;
    for (var i = 0; i < fields.length; i++) {
      var el = document.getElementById(fields[i]);
      if (!el) continue;
      var empty = !String(el.value || "").trim();
      el.classList.toggle("err", empty);
      if (empty && !bad) { try { el.focus(); } catch (e) {} bad = true; }
    }
    if (bad) cfShow("bad", "bad");
    return !bad;
  }

  function initForm() {
    var form = document.getElementById("contactForm");
    if (!form) return;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var lang = currentLang();
      if (!cfValidate(lang)) return;
      var url = "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(cfMessage(lang));
      window.open(url, "_blank", "noopener");
      cfShow("ok", "okWa");
    });

    var mailBtn = document.getElementById("cfMail");
    if (mailBtn) {
      mailBtn.addEventListener("click", function () {
        var lang = currentLang();
        if (!cfValidate(lang)) return;
        var url = "mailto:" + MAIL +
          "?subject=" + encodeURIComponent(CF_LABELS[lang].subject) +
          "&body=" + encodeURIComponent(cfMessage(lang));
        window.location.href = url;
        cfShow("ok", "okMail");
      });
    }

    // نشيل علامة الخطأ والرسالة أول ما المستخدم يكتب
    var inputs = form.querySelectorAll("input, textarea, select");
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].addEventListener("input", function () {
        this.classList.remove("err");
        cfClear();
      });
    }
  }

  /* ---------- 4) قائمة الموبايل ---------- */
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

  /* ---------- 4ب) روابط الأقسام والرجوع لأعلى ---------- */
  // ملاحظة مهمة: الهيدر ملزوق (sticky)، والمتصفح يعتبر العنصر الملزوق
  // ظاهرًا دائمًا فلا يمرّر إليه. لذلك نتولى التمرير بأنفسنا.
  function scrollToY(y) {
    try {
      window.scrollTo({ top: y, behavior: "smooth" });
    } catch (e) {
      window.scrollTo(0, y);
    }
  }

  function initAnchors() {
    var links = document.querySelectorAll('a[href^="#"]');
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener("click", function (e) {
        var href = this.getAttribute("href");
        if (!href || href === "#") return;
        var id = href.slice(1);
        var target = document.getElementById(id);
        if (!target) return;

        e.preventDefault();

        if (id === "top") {
          scrollToY(0);
        } else {
          var y = target.getBoundingClientRect().top +
                  (window.pageYOffset || document.documentElement.scrollTop || 0) - 78;
          scrollToY(y < 0 ? 0 : y);
        }
        if (window.history && history.replaceState) history.replaceState(null, "", href);
      });
    }
  }

  /* ---------- 5) حركات الظهور ---------- */
  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    function showAll() {
      for (var k = 0; k < items.length; k++) items[k].classList.add("in");
    }
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) { showAll(); return; }

    var fired = 0;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          fired++;
          en.target.classList.add("in");
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -40px 0px" });
    for (var i = 0; i < items.length; i++) io.observe(items[i]);

    // شبكة أمان: لو المراقب ما اشتغلش لأي سبب، نُظهر المحتوى كلّه
    // (المحتوى لا يجوز أن يبقى مخفيًا أبدًا)
    window.setTimeout(function () { if (fired === 0) showAll(); }, 2500);
  }

  /* ---------- 6) الرابط النشط + زر الصعود ---------- */
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
    setLang(saved || "en");

    var btn = document.getElementById("langBtn");
    if (btn) {
      btn.addEventListener("click", function () {
        setLang(currentLang() === "ar" ? "en" : "ar");
      });
    }

    initNav();
    initAnchors();
    initReveal();
    initScrollSpy();
    initForm();
    buildWhatsApp();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
