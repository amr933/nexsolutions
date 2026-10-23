/* ===== BEEB BEEB — game engine (vanilla JS) ===== */
/* Engine version bumps only with the APK; pack version updates in-app via OTA. */
window.BB = (function () {
  "use strict";

  var APK_VERSION = "2.2.0";
  var MANIFEST_URL = "https://nexsolutions.pages.dev/apps/shater/manifest.json";
  var LS = { pack: "bb_pack_v", stars: "bb_stars", startCount: "bb_starts", profile: "bb_profile_v1" };

  /* ---------- ملف الطفل: الاسم والنوع والعمر ---------- */
  var profile = { name: "", gender: "", age: 0 };
  var tier = 2;                       /* 1 = سنتان–3 سنوات، 2 = 4 سنوات، 3 = 5 سنوات فأكثر */
  var setupStep = 0;

  /* إعدادات كل فئة عمرية */
  var TIERS = {
    1: { maxNumber: 5,  en: false, catch: { total: 4, needed: 2, spawnMs: 1400, durMs: 5200 }, trace: false, traceCfg: { coverage: 0.45, travel: 1.0, finish: 0.85 }, fs: 1.12 },
    2: { maxNumber: 10, en: true,  catch: { total: 6, needed: 3, spawnMs: 1000, durMs: 4400 }, trace: true,  traceCfg: { coverage: 0.50, travel: 1.0, finish: 0.85 }, fs: 1.0 },
    3: { maxNumber: 10, en: true,  catch: { total: 8, needed: 4, spawnMs: 850,  durMs: 3800 }, trace: true,  traceCfg: { coverage: 0.62, travel: 1.4, finish: 0.90 }, fs: 0.94 }
  };
  function tierCfg() { return TIERS[tier] || TIERS[2]; }
  function tierForAge(a) { return a <= 3 ? 1 : (a === 4 ? 2 : 3); }
  function loadProfile() {
    try {
      var p = JSON.parse(localStorage.getItem(LS.profile) || "null");
      if (p && p.name) {
        profile = { name: String(p.name).slice(0, 20), gender: p.gender === "girl" ? "girl" : "boy", age: parseInt(p.age, 10) || 4 };
        tier = tierForAge(profile.age);
        return true;
      }
    } catch (e) {}
    return false;
  }
  function saveProfile() { localStorage.setItem(LS.profile, JSON.stringify(profile)); }
  function hasProfile() { return !!(profile.name && profile.gender && profile.age); }
  /* لون/شكل التطبيق حسب نوع الطفل */
  function applyTheme() {
    var b = document.body;
    b.dataset.gender = profile.gender || "boy";
    b.dataset.tier = String(tier);
    b.dataset.fs = String(tierCfg().fs);
  }

  var PACK = (window.DEFAULT_PACK && window.DEFAULT_PACK.v) ? window.DEFAULT_PACK : { v: 2, letters: [], lettersEn: [], numbers: [], numbersEn: [], phrases: {}, phrasesEn: {} };
  var stars = { L: {}, N: {}, E: {}, M: {} };
  var currentLetter = null, currentNumber = null;
  /* مسار التدريب: الحرف 5 مراحل — الرقم 4 مراحل (كل مرحلة ناجحة تُضاف نجمة حتى 5) */
  var letterStage = 1, numberStage = 1;
  /* نصوص مراحل التدريب: الحزمة أولًا (أصوات مدرَّجة)، واحتياطي مطبوع في المحرك */
  var STAGE_FB = {
    ar: {
      pickTitle: "دوّر على صورة كلمة الحرف",
      findTitle: "دوّر على الحرف",
      tryAgain: "أوّل! حاول تاني",
      wrongLetter: "ده حرف تاني — ركّز معايا",
      traceTitle: "لوّن الحرف بإصبعك",
      traceHint: "تتبّع شكل الحرف لكل أجزائه",
      matchTitle: "اختَر العربيات اللي عددها زي الرقم",
      matchWrong: "أوّل! عدّ تاني",
      numFindTitle: "اسمع ودوّر على الرقم",
      orderTitle: "إيه الرقم اللي ييجي بعد؟",
      gotStar: "أحسنت! نجمة جديدة",
      fullDone: "بطل! خلّصت كل المراحل!"
    },
    en: {
      pickTitle: "Tap the picture of the word!",
      findTitle: "Find this letter!",
      tryAgain: "Oops! Try again",
      wrongLetter: "That's a different letter! Look carefully",
      traceTitle: "Paint the letter with your finger!",
      traceHint: "Follow the shape and cover all of it",
      matchTitle: "Pick the group with same number of cars!",
      matchWrong: "Oops! Count again",
      numFindTitle: "Listen and find the number!",
      orderTitle: "What comes next?",
      gotStar: "Great! New star!",
      fullDone: "Champion! All stages done!"
    }
  };
  /* نص مرحلة: من الحزمة (بصوتها المدرَّج)، وإلا الاحتياطي */
  function ST(k) { return PH(k) || (STAGE_FB[curLang] && STAGE_FB[curLang][k]) || STAGE_FB.ar[k] || ""; }
  /* شريط نقاط المراحل (عرف لكل مرحلة — مُنجَز يتحوّل ذهبي) */
  function dotsHTML(cur, total) {
    var h = '<div class="stage-dots">';
    for (var i = 1; i <= total; i++) h += '<span class="sdot' + (i <= cur ? " on" : "") + '"></span>';
    return h + "</div>";
  }
  /* نجمة صغيرة بين المراحل + الانتقال للمرحلة التالية */
  function miniWin(nextFn, bodyId) {
    stageHTML(
      '<div class="win-wrap mini">' +
        '<div class="big-star">⭐</div>' +
        '<div class="win-tt">' + esc(ST("gotStar")) + "</div>" +
        '<div class="mini-progress"><span class="mini-bar"></span></div>' +
      "</div>",
      bodyId);
    goodSound();
    setTimeout(nextFn, 1500);
  }
  /* لغة القسم الحالي المفتوح: "ar" للحروف/الأرقام العربية، "en" للأقسام الإنجليزية */
  var curLang = "ar";
  var curScreen = "scr-home";
  var gateQ = null, gateTarget = 0;
  var ac = null;
  var updateTimer = null;

  /* ---------- utils ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[<>&"]/g, function (c) { return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]; }); }
  function rand(n) { return Math.floor(Math.random() * n); }
  function pick(arr) { return arr[rand(arr.length)]; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = rand(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  /* ---------- أدوات اللغة (عربي / English) ---------- */
  var AR_DIG = ["", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩", "١٠"];
  function letArr() { return (curLang === "en" && PACK.lettersEn && PACK.lettersEn.length) ? PACK.lettersEn : PACK.letters; }
  function numArr() { return (curLang === "en" && PACK.numbersEn && PACK.numbersEn.length) ? PACK.numbersEn : PACK.numbers; }
  function teamL() { return curLang === "en" ? "E" : "L"; }
  function teamN() { return curLang === "en" ? "M" : "N"; }
  function digFor(v) { return curLang === "en" ? String(v) : (AR_DIG[v] || String(v)); }
  /* نص عبارة واجهة حسب اللغة الحالية */
  function PH(key) {
    if (curLang === "en" && PACK.phrasesEn && PACK.phrasesEn[key]) return PACK.phrasesEn[key];
    return (PACK.phrases && PACK.phrases[key]) || "";
  }
  /* الاسم المنطوق للحرف: متشكّل عربي (L.say) أو اللفظ الإنجليزي (Aye/Bee/…) */
  function letterName(L) { return curLang === "en" ? (L.say || L.c) : (L.say || L.n); }
  /* الاسم المعروض في الشاشات: العربي بدون تشكيل — الإنجليزي بنفس اللفظ */
  function dispName(L) { return curLang === "en" ? (L.say || L.c) : (L.n || L.say); }
  function digitsOnly(s) { return String(s).replace(/[0-9]/g, function (d) { return AR_DIG[+d]; }); }

  /* ---------- ألوان ---------- */
  /* [اللون الأساسي، اللون الغامق] — يُستخدمان في التدرّجات */
  var PAL = [
    ["#E53935", "#B71C1C"], ["#43A047", "#2E7D32"], ["#1E88E5", "#1565C0"], ["#F4511E", "#D84315"],
    ["#8E24AA", "#6A1B9A"], ["#00897B", "#00695C"], ["#D81B60", "#AD1457"], ["#546E7A", "#37474F"],
    ["#F9A825", "#E65100"], ["#6D4C41", "#4E342E"], ["#3949AB", "#283593"], ["#E91E63", "#C2185B"]
  ];
  function palette(i) { return PAL[((i % PAL.length) + PAL.length) % PAL.length][0]; }
  function palette2(i) { return PAL[((i % PAL.length) + PAL.length) % PAL.length][1]; }
  function numColor(i) { return palette(i + 5); }
  function numColor2(i) { return palette2(i + 5); }

  /* ---------- المركبات المرسومة ---------- */
  function vehSvg(name) { return (window.VEHICLES && VEHICLES.svg(name)) || ""; }
  function veh(name, cls) { return '<span class="veh' + (cls ? " " + cls : "") + '">' + vehSvg(name) + "</span>"; }
  function roadVeh(i, cls) { return veh(window.VEHICLES ? VEHICLES.roadName(i) : "sedan", cls); }
  /* الكلمة والصورة حسب نوع الطفل: لكل حرف كلمة للولد (w) و another للبنت (wg) */
  function wordOf(L) {
    if (curLang === "en") return L.w;
    return (profile.gender === "girl" && L.wg) ? L.wg : L.w;
  }
  function emojiOf(L) {
    if (curLang === "en") return L.e || "🚗";
    return (profile.gender === "girl" && L.eg) ? L.eg : (L.e || "🚗");
  }
  /* أيقونة كلمة الحرف: مركبة مرسومة لو الكلمة مركبة، وإلا الإيموجي */
  function wordIcon(L) {
    var V = window.VEHICLES;
    var w = wordOf(L);
    var v = V && (V.forWord(w) || V.wordArt(w));
    if (v) return '<span class="veh sm">' + v + "</span>";
    return '<span class="chip-emoji">' + emojiOf(L) + "</span>";
  }

  /* ---------- audio ---------- */
  function ctx() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    return ac;
  }
  function beep(freq, dur, type, vol, delay) {
    var c = ctx(); if (!c) return;
    try {
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || "sine"; o.frequency.value = freq;
      g.gain.value = (vol == null ? 0.18 : vol);
      o.connect(g); g.connect(c.destination);
      var t0 = c.currentTime + (delay || 0);
      o.start(t0); o.stop(t0 + (dur || 0.15));
    } catch (e) {}
  }
  function honk() { beep(392, 0.13, "square", 0.12); beep(494, 0.13, "square", 0.12, 0.15); }
  function goodSound() { beep(523, 0.12); beep(659, 0.12, "sine", 0.18, 0.12); beep(784, 0.25, "sine", 0.2, 0.24); }
  function starSound() { beep(784, 0.1); beep(988, 0.1, "sine", 0.2, 0.1); beep(1319, 0.3, "sine", 0.22, 0.2); }
  function popSound() { beep(300, 0.06, "triangle", 0.25); }

  /* ---------- voice (صوت عربي مدرَّج داخل التطبيق + محرّك الجهاز كاحتياطي) ---------- */
  var voiceEl = null, voiceSeq = [], voiceBusy = false;
  function voiceFile(text) { return (window.VOICE && window.VOICE[text]) || null; }
  function stopVoice() {
    if (voiceEl) { try { voiceEl.pause(); } catch (e) {} voiceEl = null; }
    voiceSeq = []; voiceBusy = false;
    if (window.AndroidBridge && window.AndroidBridge.stopSpeak) { try { window.AndroidBridge.stopSpeak(); } catch (e) {} }
    if (window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch (e) {} }
  }
  function ttsSay(text, slow) {
    if (window.AndroidBridge && window.AndroidBridge.speak) { try { window.AndroidBridge.speak(text, !!slow); } catch (e) {} return; }
    if (window.speechSynthesis) {
      try {
        var u = new SpeechSynthesisUtterance(text);
        u.lang = /^[\u0600-\u06FF]/.test(text) ? "ar-EG" : "en-US";
        u.rate = slow ? 0.75 : 0.9; u.pitch = 1.1;
        window.speechSynthesis.speak(u);
      } catch (e) {}
    }
  }
  function playFile(f) {
    try {
      voiceEl = new Audio(f);
      voiceEl.onended = function () { voiceEl = null; voiceBusy = false; playSeqNext(); };
      var p = voiceEl.play();
      if (p && p.catch) { p.catch(function () { voiceEl = null; voiceBusy = false; playSeqNext(); }); }
      return true;
    } catch (e) { voiceEl = null; voiceBusy = false; playSeqNext(); return false; }
  }
  function playSeqNext() {
    if (voiceBusy && voiceEl) return;
    if (!voiceSeq.length) { voiceBusy = false; return; }
    var f = voiceFile(voiceSeq.shift());
    voiceBusy = true;
    playFile(f);
  }
  /* نطق نص واحد: ملف الصوت المدرَّج أولًا، ثم محرّك الجهاز */
  function say(text, slow) {
    if (!text) return;
    var f = voiceFile(text);
    stopVoice();
    if (!f) { ttsSay(text, slow); return; }
    voiceBusy = true;
    playFile(f);
  }
  /* نطق جملة مكوّنة من أجزاء، جزءًا بعد جزء (إن توفّرت أصواتها) */
  function speakSeq(parts, slow) {
    parts = (parts || []).filter(function (x) { return x && String(x).trim(); });
    if (!parts.length) return;
    for (var i = 0; i < parts.length; i++) {
      if (!voiceFile(parts[i])) { say(parts.join("، "), slow); return; }
    }
    stopVoice();
    voiceSeq = parts.slice();
    playSeqNext();
  }

  /* ---------- stars / progress ---------- */
  function loadStars() {
    try {
      var s = JSON.parse(localStorage.getItem(LS.stars) || "{}");
      if (s && typeof s === "object") stars = s;
    } catch (e) {}
    ["L", "N", "E", "M"].forEach(function (k) { if (!stars[k]) stars[k] = {}; });
  }
  function saveStars() { localStorage.setItem(LS.stars, JSON.stringify(stars)); }
  function addStar(team, id) {
    if (!stars[team][id]) stars[team][id] = 0;
    stars[team][id] = Math.min(5, stars[team][id] + 1);
    saveStars();
  }
  function starStr(team, id) {
    var n = (stars[team] && stars[team][id]) || 0;
    return n ? "⭐".repeat(n) : "";
  }
  function totals(team) {
    var t = 0, k;
    for (k in stars[team]) t += stars[team][k];
    return t;
  }

  /* ---------- navigation ---------- */
  function show(id) {
    document.querySelectorAll(".screen").forEach(function (s) { s.classList.remove("active"); });
    $(id).classList.add("active");
    curScreen = id;
    stopVoice();
    if (id === "scr-home") refreshHome();
  }
  function goHome() { show("scr-home"); }

  /* ---------- home ---------- */
  function buildHomeScene() {
    var logo = $("home-logo");
    if (logo && !logo.firstChild) logo.innerHTML = vehSvg("sedan");
    var road = $("home-road");
    if (road && !road.firstChild) {
      [["taxi", 88], ["truck", 116], ["racer", 82]].forEach(function (x, i) {
        var s = document.createElement("span");
        s.className = "veh v" + (i + 1);
        s.style.width = x[1] + "px";
        s.innerHTML = vehSvg(x[0]);
        road.appendChild(s);
      });
    }
  }
  function refreshHome() {
    buildHomeScene();
    /* ترحيب بالطفل */
    var hello = $("hello-tt"), av = $("home-avatar");
    if (hello) hello.textContent = profile.name ? ("أهلاً يا " + profile.name + "!") : "أهلاً يا بطل!";
    if (av) av.textContent = profile.gender === "girl" ? "👧" : "👦";
    var bc = $("bonus-title"), bi = $("bonus-icon");
    if (bc) bc.textContent = profile.gender === "girl" ? "حديقتي" : "جراجي";
    if (bi) bi.textContent = profile.gender === "girl" ? "🌸" : "🚗";
    function prog(el, team, arr) {
      var done = 0;
      for (var k in stars[team]) { if (stars[team][k]) done++; }
      var total = arr.length;
      var e = $(el);
      if (!e) return;
      e.textContent = done >= total ? "أكملتها كلها! 🏆" : (done > 0 ? ("أنجزت " + done + " من " + total) : "هيا نلعب!");
    }
    prog("letters-progress", "L", PACK.letters);
    prog("numbers-progress", "N", PACK.numbers);
    prog("enletters-progress", "E", PACK.lettersEn || []);
    prog("enumbers-progress", "M", PACK.numbersEn || []);
    say(PACK.phrases.home || "");
  }

  /* ---------- UPDATE (OTA) ---------- */
  function toast(msg, ms) {
    var t = $("toast");
    t.textContent = msg; t.classList.remove("hidden");
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.add("hidden"); }, ms || 3200);
  }
  function applyPack(json) {
    if (!json || !json.v || !(json.letters && json.letters.length)) return false;
    PACK = json;
    ["L", "N", "E", "M"].forEach(function (k) { if (!stars[k]) stars[k] = {}; });
    localStorage.setItem(LS.pack, JSON.stringify(json));
    return true;
  }
  function loadLocalPack() {
    try {
      var raw = localStorage.getItem(LS.pack);
      if (raw) {
        var p = JSON.parse(raw);
        /* الحزمة المحفوظة تُقبل فقط إن كانت بنفس إصدار الحزمة المدمجة أو أحدث — قديمة تُتجاهل */
        if (p && p.v >= PACK.v && p.letters && p.numbers) PACK = p;
      }
    } catch (e) {}
    $("pack-version").textContent = PACK.v;
  }
  function versionGT(a, b) {
    var A = String(a || "").split(".").map(Number), B = String(b || "").split(".").map(Number);
    for (var i = 0; i < 3; i++) { var x = A[i] || 0, y = B[i] || 0; if (x > y) return true; if (x < y) return false; }
    return false;
  }
  function checkUpdate(manual) {
    if (!navigator.onLine && !manual) return;
    fetch(MANIFEST_URL + "?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (m) {
        if (m && m.v > PACK.v) return fetchPackManifest(m);
        if (m && m.apkVersion && versionGT(m.apkVersion, APK_VERSION)) {
          window.latestApkUrl = m.apkUrl || null;
          ensureApkUpdateBtn(m.apkVersion);
          if (manual) toast("يتوفر إصدار أحدث من التطبيق (v" + m.apkVersion + ") — حمّله من شاشة الأهل 🔽");
        } else if (manual) toast("التطبيق محدَّث بالفعل ✅");
      })
      .catch(function () { if (manual) toast("تعذّر الاتصال بالسيرفر… تحقق من الإنترنت وحاول مرة أخرى"); });
  }
  function fetchPackManifest(m) {
    var url = m.packUrl;
    if (!url) return;
    toast("⏬ يتوفر تحديث جديد… جاري التحميل", 6000);
    fetch(url + "?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (p) {
        if (applyPack(p)) {
          toast("🎉 تم تحديث التطبيق! محتوى جديد في انتظارك");
          buildLetters(); buildNumbers(); refreshStarsEls();
          say("تم تحديث التطبيق! محتوى جديد");
          $("pack-version").textContent = PACK.v;
          /* بعد تحديث المحتوى: إن كان يؤجل الإصدار جديدًا فأظهر زر التحميل في نفس اللحظة */
          if (m && m.apkVersion && versionGT(m.apkVersion, APK_VERSION)) {
            window.latestApkUrl = m.apkUrl || null;
            ensureApkUpdateBtn(m.apkVersion);
          }
        }
      })
      .catch(function () { toast("تعذّر تنزيل التحديث… تحقق من الإنترنت وحاول مرة أخرى"); });
  }
  function ensureApkUpdateBtn(newV) {
    if (document.getElementById("apk-update-btn")) return;
    var panel = $("parent-panel"); if (!panel) return;
    var b = document.createElement("button");
    b.id = "apk-update-btn"; b.className = "parent-btn";
    b.textContent = "⬇️ حمّل الإصدار الأحدث " + newV;
    b.onclick = function () {
      var url = window.latestApkUrl;
      if (!url) return;
      if (window.AndroidBridge && window.AndroidBridge.openUrl) { try { window.AndroidBridge.openUrl(url); return; } catch (e) {} }
      window.open(url, "_blank");
    };
    panel.insertBefore(b, panel.querySelector(".danger"));
    toast("📋 يوجد إصدار أحدث من التطبيق — راجع شاشة الأهل");
  }
  function manualUpdate() { checkUpdate(true); }
  var lastCheck = 0;
  function maybeAutoUpdate() {
    var now = Date.now();
    if (now - lastCheck < 120000) return;   // مرة كل دقيقتين
    lastCheck = now;
    checkUpdate(false);
  }

  /* ---------- LETTERS SCREEN ---------- */
  function openLetters(lang) {
    curLang = (lang === "en") ? "en" : "ar";
    buildLetters();
    $("letters-title").textContent = curLang === "en" ? "ABC Letters" : "حروفنا";
    $("stars-letters").textContent = "⭐ " + totals(teamL());
    show("scr-letters");
    say(PH("openLetters") || PH("openLettersFallback"));
  }
  function buildLetters() {
    var arr = letArr(), team = teamL();
    var g = $("letters-grid"); g.innerHTML = "";
    arr.forEach(function (L, i) {
      var b = document.createElement("button");
      b.className = "letter-card" + (stars[team][i] ? " done" : "");
      b.style.setProperty("--c", palette(i));
      b.style.setProperty("--c2", palette2(i));
      b.innerHTML =
        '<span class="lc-head">' + roadVeh(i, "xs") + '<span class="lc-l">' + esc(L.c) + "</span></span>" +
        '<span class="lc-w">' + esc(wordOf(L)) + "</span>" +
        '<span class="lc-s">' + starStr(team, i) + "</span>";
      b.onclick = function () { startLetterGame(i); };
      g.appendChild(b);
    });
    refreshStarsEls();
  }
  function refreshStarsEls() {
    $("stars-letters").textContent = "⭐ " + totals("L");
    $("stars-numbers").textContent = "⭐ " + totals("N");
  }

  /* ---------- LETTER GAME ---------- */
  function startLetterGame(i) {
    var arr = letArr();
    currentLetter = { idx: i, L: arr[i], team: teamL() };
    letterStage = 1;
    var L = currentLetter.L, n = (stars[currentLetter.team][i] || 0);
    $("lg-title").textContent = curLang === "en"
      ? ("Letter " + L.c + " — " + wordOf(L))
      : ("حرف " + L.c + " — " + L.n);
    $("stars-lg").textContent = "⭐".repeat(Math.min(5, n + 1));
    show("scr-letter-game");
    buildLetterGame();
  }
  function stageHTML(html, scr) { $(scr || "lg-body").innerHTML = html; }

  /* المرحلة 1 : التعرف — دوس على العربية التي تحمل الحرف */
  function buildLetterGame() {
    letterStage = 1;
    var L = currentLetter.L, idx = currentLetter.idx, col = palette(idx);
    stageHTML(
      dotsHTML(1, 5) +
      '<div class="center-wrap">' +
        '<span class="stage-prompt">' + esc(PH("tapCar")) + "</span>" +
        '<button class="hero-car-btn" id="lg-car">' +
          '<span class="car-holder">' +
            roadVeh(idx, "xl bob") +
            '<span class="roof-plate" style="--c:' + col + '">' + esc(L.c) + "</span>" +
          "</span>" +
        "</button>" +
        '<button class="next-btn" id="lg-next">' + (curLang === "en" ? "Next ▶️" : "التالي ▶️") + "</button>" +
      "</div>"
    );
    var car = $("lg-car");
    car.onclick = function () {
      honk();
      speakSeq([letterName(L), wordOf(L)], true);
      var chip = document.querySelector("#lg-body .word-chip");
      if (!chip) {
        chip = document.createElement("div");
        chip.className = "word-chip";
        chip.style.setProperty("--c", col);
        chip.style.setProperty("--c2", palette2(idx));
        chip.innerHTML = wordIcon(L) + "<span>" + esc(wordOf(L)) + "</span>";
        car.parentNode.appendChild(chip);
      }
      setTimeout(function () { var nb = $("lg-next"); if (nb) nb.classList.add("show"); }, 700);
      car.onclick = function () { honk(); speakSeq([letterName(L), wordOf(L)], true); };
    };
    $("lg-next").onclick = function () {
      /* نجمة المرحلة الأولى: التعرّف على الحرف واستمع له ”کتاب به كلمه */
      letterStageDone(1);
    };
    say(PH("tapCar"));
  }

  /* المرحلة 2 : تجميع الحرف من العربيات المارة (من اليمين إلى اليسار) */
  function buildLetterCatch() {
    letterStage = 2;
    var L = currentLetter.L, target = L.c, col = palette(currentLetter.idx);
    var catchName = curLang === "en" ? ("Letter " + L.c) : ("حرف " + L.n);
    stageHTML(dotsHTML(2, 5) + '<div class="center-wrap" style="justify-content:flex-start">' +
      '<span class="stage-prompt">' + esc(PH("catchTitle")) + "</span>" +
      '<div class="letter-plate" style="--c:' + col + '">' + esc(target) + "</div>" +
      '<div class="catch-name">' + esc(catchName) + "</div>" +
      '<span class="catch-hint" id="catch-hint"></span>' +
      "</div>");
    var caught = 0, spawned = 0, sinceTarget = 0, CFG = tierCfg().catch;
    var NEEDED = CFG.needed;
    var timers = [], wave = 1, spawnedInWave = 0;
    function scheduleNext(extraMs) { timers.push(setTimeout(spawn, (extraMs || CFG.spawnMs) + rand(700))); }
    /* نهاية الموجة: إذا لم يجتمع العدد المطلوب — نجدد الموجة بمساعدة منظّمة ثم إجباريّة إن تكررت
       (لا طريق ما مريحش — لا تعثّر للأبد) */
    function endWave() {
      if (caught >= NEEDED) return;
      /* صمام الأمان: 3 موجات مفقودة بلا أي اصطياد → إكمال مساعد بلُطف (لا مرض التكرار للأبد) */
      if (caught === 0 && wave >= 3) {
        timers.forEach(clearTimeout);
        say(PH("catchDone"));
        var endCtx = currentLetter;
        setTimeout(function () { letterStageDone(2, endCtx); }, 900);
        return;
      }
      spawnedInWave = 0;
      wave++;
      var hint = $("catch-hint");
      if (hint) { hint.textContent = PH("tryAgain"); hint.classList.add("show"); }
      say(PH("tryAgain"));
      /* الموجة الثانية: تعليم بصري — العربية المطلوبة لون أخضر واضح وبطيئة */
      timers.push(setTimeout(spawn, 2200));
    }
    function spawn() {
      if (caught >= NEEDED) return;
      spawned++; spawnedInWave++;
      /* الضمانات المتسلسلة:
         1) لا يمر أكثر من عربيتين بدون العربية المطلوبة
         2) الموجة 2: كل عربية ثانية هي المطلوبة (تعليم بشارة خضراء)
         3) الموجة 3: العربية المطلوبة في كل العربيات — النجاح مضمون */
      var isTarget;
      if (wave >= 3) isTarget = true;
      else if (wave === 2) isTarget = (spawnedInWave % 2 === 1);
      else isTarget = sinceTarget >= 2 || Math.random() < 0.5;
      sinceTarget = isTarget ? 0 : (sinceTarget + 1);
      var obs = isTarget ? target : pick(shuffle(letArr().filter(function (x) { return x.c !== target; }))).c;
      var car = document.createElement("button");
      car.className = "traffic-car" + (wave >= 2 && isTarget ? " glow" : "");
      var dur = (wave >= 2 ? Math.round(CFG.durMs * 1.35) : CFG.durMs) + rand(1800);
      var c1 = isTarget ? "#2E7D32" : "#546E7A", c2 = isTarget ? "#1B5E20" : "#37474F";
      car.innerHTML =
        '<span class="carry" style="--c:' + c1 + ";--c2:" + c2 + '">' + esc(obs) + "</span>" +
        veh(window.VEHICLES ? VEHICLES.roadName(rand(999)) : "sedan");
      car.style.setProperty("--dur", dur + "ms");
      $("lg-body").appendChild(car);
      var done = false;
      car.onclick = function () {
        if (done) return; done = true;
        if (obs === target) {
          caught++;
          car.classList.add("car-fly");
          popSound(); goodSound();
          say(letterName(L), true);
          var n = (stars[currentLetter.team][currentLetter.idx] || 0) + 1;
          $("stars-lg").textContent = "⭐".repeat(Math.min(5, n)) + " " + caught + "/" + NEEDED;
          timers.push(setTimeout(function () { car.remove(); }, 760));
          if (caught >= NEEDED) { timers.forEach(clearTimeout); var catchEnd = currentLetter; setTimeout(function () { letterStageDone(2, catchEnd); }, 700); }
        } else {
          car.classList.add("car-shake");
          honk();
          timers.push(setTimeout(function () { car.classList.add("car-leave"); }, 420));
          say(PH("catchWrong"));
        }
      };
      timers.push(setTimeout(function () { done = true; car.remove(); }, dur + 400));
      if (spawnedInWave >= CFG.total) { timers.push(setTimeout(endWave, 700)); }
      else scheduleNext();
    }
    spawn(); scheduleNext(CFG.spawnMs + 400);
    speakSeq([PH("catchTitle"), letterName(L)], true);
  }

  /* بعد نجاح مرحلة: نجمة + شاشة نجمة صغيرة ثم المرحلة التالية */
  function letterStageDone(no, ctxLetter) {
    var cur = ctxLetter || currentLetter;
    if (cur) currentLetter = cur;
    if (no >= 1) addStar(currentLetter.team, currentLetter.idx);
    var n = (stars[currentLetter.team][currentLetter.idx] || 0);
    $("stars-lg").textContent = "⭐".repeat(Math.min(5, n));
    if (no >= 5) { letterWin(); return; }
    miniWin(function () {
      if (no === 1) buildLetterCatch();
      else if (no === 2) buildLetterPick();
      else if (no === 3) buildLetterFind();
      else if (tierCfg().trace) buildLetterTrace();
      else letterWin();
    }, "lg-body");
  }

  /* المرحلة 3 : معنى الحرف — اختيار صورة كلمة الحرف من بين الصور */
  function buildLetterPick() {
    letterStage = 3;
    var arr = letArr(), L = currentLetter.L, idx = currentLetter.idx;
    var opts = [{ L: L, word: wordOf(L), done: true }];
    var others = shuffle(arr.filter(function (x, i) { return i !== idx; })).slice(0, 2);
    others.forEach(function (o) { opts.push({ L: o, word: wordOf(o), done: false }); });
    opts = shuffle(opts);
    var h = dotsHTML(3, 5) +
      '<div class="center-wrap" style="justify-content:flex-start">' +
        '<span class="stage-prompt">' + esc(ST("pickTitle")) + "</span>" +
        '<div class="letter-plate" style="--c:' + palette(idx) + '">' + esc(L.c) + "</div>" +
        '<div class="pick-opts">';
    opts.forEach(function (o, i) {
      h += '<button class="pick-opt" data-ok="' + (o.done ? 1 : 0) + '">' +
        '<span class="pick-ic">' + wordIcon(o.L) + "</span>" +
        '<span class="pick-w">' + esc(o.word) + "</span></button>";
    });
    h += "</div></div>";
    stageHTML(h);
    speakSeq([ST("pickTitle"), letterName(L)], true);
    var done = false;
    document.querySelectorAll("#lg-body .pick-opt").forEach(function (b) {
      b.onclick = function () {
        if (done) return;
        if (b.getAttribute("data-ok") === "1") {
          done = true;
          b.classList.add("hit");
          goodSound();
          say(wordOf(L), true);
          setTimeout(function () { letterStageDone(3); }, 1000);
        } else {
          b.classList.add("shake"); setTimeout(function () { b.classList.remove("shake"); }, 500);
          honk(); say(ST("tryAgain"));
        }
      };
    });
  }

  /* المرحلة 4 : إيجاد الحرف — الشبكة فيها الحرف المطلوب وحروف تانية */
  function buildLetterFind() {
    letterStage = 4;
    var arr = letArr(), L = currentLetter.L, idx = currentLetter.idx, col = palette(idx);
    var others = shuffle(arr.filter(function (x) { return x.c !== L.c; })).slice(0, 5).map(function (x) { return x.c; });
    var cells = shuffle(others.concat([L.c]));
    var h = dotsHTML(4, 5) +
      '<div class="center-wrap" style="justify-content:flex-start">' +
        '<span class="stage-prompt">' + esc(ST("findTitle")) + "</span>" +
        '<div class="letter-plate" style="--c:' + col + '">' + esc(L.c) + "</div>" +
        '<div class="find-grid">';
    cells.forEach(function (c) {
      h += '<button class="find-cell" data-ok="' + (c === L.c ? 1 : 0) + '">' + esc(c) + "</button>";
    });
    h += "</div></div>";
    stageHTML(h);
    speakSeq([ST("findTitle"), letterName(L)], true);
    var done = false;
    document.querySelectorAll("#lg-body .find-cell").forEach(function (b) {
      b.onclick = function () {
        if (done) return;
        if (b.getAttribute("data-ok") === "1") {
          done = true;
          b.classList.add("hit");
          goodSound(); say(letterName(L), true);
          setTimeout(function () { letterStageDone(4); }, 1000);
        } else {
          b.classList.add("shake"); setTimeout(function () { b.classList.remove("shake"); }, 500);
          honk(); say(ST("wrongLetter"));
        }
      };
    });
  }

  /* المرحلة 5 : تتبع الحرف — تلوين شكل الحرف باللمس (قماش Canvas) */
  function buildLetterTrace() {
    letterStage = 5;
    var L = currentLetter.L, idx = currentLetter.idx, col = palette(idx);
    var SZ = 260, FONT = Math.round(SZ * 0.78);
    var h = dotsHTML(5, 5) +
      '<div class="center-wrap" style="justify-content:flex-start">' +
        '<span class="stage-prompt">' + esc(ST("traceTitle")) + "</span>" +
        '<div class="trace-wrap" style="touch-action:none">' +
          '<canvas id="tr-base" width="' + SZ + '" height="' + SZ + '"></canvas>' +
          '<canvas id="tr-paint" width="' + SZ + '" height="' + SZ + '"></canvas>' +
        "</div>" +
        '<div class="trace-meter"><span id="tr-fill"></span></div>' +
        '<span class="trace-hint">' + esc(ST("traceHint")) + "</span>" +
        '<button id="tr-clear" class="trace-clear-btn" type="button">' + (curLang === "en" ? "🧹 Erase all" : "🧹 مسح الكل") + "</button>" +
      "</div>";
    stageHTML(h);
    /* ثبِّت شكل الحرف في أرضية القماش ثم اجمع نقاطه */
    var base = $("tr-base"), paint = $("tr-paint");
    function drawGlyph(c, color) {
      var x = c.getContext("2d");
      x.clearRect(0, 0, SZ, SZ);
      x.save(); x.textAlign = "center"; x.textBaseline = "middle";
      x.font = FONT + 'px "Segoe UI", Arial, sans-serif';
      x.fillStyle = color;
      x.fillText(L.c, SZ / 2, SZ / 2 + SZ * 0.04);
      x.restore();
    }
    drawGlyph(base, "rgba(0,0,0,0.15)");
    var pts = [], ctxP = paint.getContext("2d");
    try {
      drawGlyph(paint, "#000");
      var img = ctxP.getImageData(0, 0, SZ, SZ).data;
      for (var y = 0; y < SZ; y += 5) for (var x2 = 0; x2 < SZ; x2 += 5) {
        if (img[(y * SZ + x2) * 4 + 3] > 60) pts.push({ x: x2, y: y, ok: false });
      }
    } catch (e) { pts = []; }
    ctxP.clearRect(0, 0, SZ, SZ);
    ctxP.lineCap = "round"; ctxP.lineJoin = "round";
    /* بوابات صرف الإنجاز — أي لمسة واحدة أو نقرة لا تكفي أبدًا:
       1) تغطية ≥ 62% من نقاط شكل الحرف (وعلى الأقل 120 نقطة عيّنة)
       2) ثلاث ضغطات على الأقل (ضغطة = تنزيل إصبع)
       3) مسافة تتبّع حقيقية ≥ ضعف عرض اللوحة (منع "التقادي" بالنقر) */
    var need = Math.max(80, Math.round(pts.length * (tierCfg().traceCfg.coverage || 0.62)));
    var doneP = 0, strokes = 0, travel = 0;
    var MIN_TRAVEL = SZ * (tierCfg().traceCfg.travel || 1.4);
    var down = false, last = null, finished = false;
    function hitTest(x3, y3) {
      var R = 18, hit = 0;
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        if (!p.ok) {
          var dx = p.x - x3, dy = p.y - y3;
          if (dx * dx + dy * dy <= R * R) { p.ok = true; hit++; }
        }
      }
      return hit;
    }
    function paintBlob(x3, y3) {
      ctxP.fillStyle = col;
      ctxP.globalAlpha = 0.85;
      ctxP.beginPath(); ctxP.arc(x3, y3, 20, 0, Math.PI * 2); ctxP.fill();
      ctxP.globalAlpha = 1;
    }
    function refreshMeter() {
      var f = $("tr-fill");
      if (f) f.style.width = Math.min(100, Math.round(100 * doneP / need)) + "%";
    }
    function clearTrace() {
      if (finished) return;
      ctxP.clearRect(0, 0, SZ, SZ);
      for (var ci = 0; ci < pts.length; ci++) pts[ci].ok = false;
      doneP = 0; strokes = 0; travel = 0;
      refreshMeter();
      popSound();
    }
    function finish() {
      if (finished) return;
      finished = true;
      try {
        var cb = $("tr-clear");
        if (cb) { cb.disabled = true; cb.style.opacity = "0.4"; cb.style.pointerEvents = "none"; }
      } catch (e) {}
      try { confetti(); } catch (e) {}
      try { goodSound(); } catch (e) {}
      setTimeout(function () { try { letterStageDone(5); } catch (e) {} }, 900);
    }
    function evPos(e) {
      var r = paint.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (SZ / r.width), y: (e.clientY - r.top) * (SZ / r.height) };
    }
    paint.addEventListener("pointerdown", function (e) {
      if (finished) return;
      down = true; strokes++;
      var p = evPos(e); last = p; travel += 0;
      var hit = hitTest(p.x, p.y);
      if (hit) { doneP += hit; paintBlob(p.x, p.y); refreshMeter(); }
      popSound();
      e.preventDefault();
    });
    paint.addEventListener("pointermove", function (e) {
      if (!down || finished) return;
      var p = evPos(e);
      var d = Math.hypot(p.x - last.x, p.y - last.y);
      travel += d; last = p;
      /* فرشاة متصلة على طول المسار (وليس النقاط المفردة فقط) */
      var steps = Math.max(1, Math.floor(d / 9));
      var any = 0;
      for (var s = 1; s <= steps; s++) {
        var xx = last.x - (p.x - last.x) * (s / steps) + (p.x - last.x), yy = last.y - (p.y - last.y) * (s / steps) + (p.y - last.y);
        xx = p.x - (p.x - last.x) * ((steps - s) / steps);
        yy = p.y - (p.y - last.y) * ((steps - s) / steps);
        var hit = hitTest(xx, yy);
        if (hit) { doneP += hit; paintBlob(xx, yy); any += hit; }
      }
      if (any) refreshMeter();
      e.preventDefault();
    });
    window.addEventListener("pointerup", function () {
      down = false; last = null;
      if (finished) return;
      /* باب التسامح: تغطية ≥ 90% مع تتبّع حقيقي يكفي — أي عدد ضغطات (حتى ضغطة واحدة متصلة) */
      if (travel >= MIN_TRAVEL && doneP >= Math.round(need * (tierCfg().traceCfg.finish || 0.90))) finish();
    });
    speakSeq([ST("traceTitle")], true);
    var clearBtn = $("tr-clear");
    if (clearBtn) clearBtn.addEventListener("click", clearTrace);
  }

  function letterWin() {
    starSound();
    var L = currentLetter.L;
    stageHTML(
      '<div class="win-wrap">' +
        '<div class="win-plate" style="--c:' + palette(currentLetter.idx) + '">' + esc(L.c) + "</div>" +
        '<div class="big-star">⭐</div>' +
        '<div class="win-tt">' + esc(ST("done")) + "</div>" +
        '<div class="win-sub">' + esc(dispName(L) + " — " + wordOf(L)) + "</div>" +
        '<div class="win-btns">' +
          '<button class="round-btn" onclick="BB.replayLetter()">' + (curLang === "en" ? "🔁 Again" : "🔁 مرة أخرى") + "</button>" +
          '<button class="round-btn alt" onclick="BB.nextLetter()">' + (curLang === "en" ? "Next letter ▶️" : "الحرف التالي ▶️") + "</button>" +
        "</div>" +
      "</div>");
    try { confetti(); } catch (e) {}
    try { speakSeq([PH("done"), letterName(L), wordOf(L)]); } catch (e) {}
    try { buildLetters(); } catch (e) {}
  }
  function replayLetter() { startLetterGame(currentLetter.idx); }
  function nextLetter() { startLetterGame((currentLetter.idx + 1) % letArr().length); }

  /* ---------- NUMBERS ---------- */
  function openNumbers(lang) {
    curLang = (lang === "en") ? "en" : "ar";
    buildNumbers();
    $("numbers-title").textContent = curLang === "en" ? "123 Numbers" : "أرقامنا";
    $("stars-numbers").textContent = "⭐ " + totals(teamN());
    show("scr-numbers");
    say(PH("openNumbers") || "");
  }
  function buildNumbers() {
    var arr = numArr(), team = teamN();
    var g = $("numbers-grid"); g.innerHTML = "";
    arr.forEach(function (N, i) {
      if (curLang === "ar" && N.v > tierCfg().maxNumber) return;   /* الأرقام المتاحة حسب عمر الطفل */
      var b = document.createElement("button");
      b.className = "number-card" + (stars[team][i] ? " done" : "");
      b.style.setProperty("--c", numColor(i));
      b.style.setProperty("--c2", numColor2(i));
      b.innerHTML = '<span class="nc-body">' + roadVeh(i) + '<span class="nc-n">' + digFor(N.v) + "</span></span>" +
        '<span class="nc-s">' + starStr(team, i) + "</span>";
      b.onclick = function () { startNumberGame(i); };
      g.appendChild(b);
    });
    refreshStarsEls();
  }
  function startNumberGame(i) {
    var arr = numArr();
    currentNumber = { idx: i, N: arr[i], team: teamN() };
    numberStage = 1;
    var n = (stars[currentNumber.team][i] || 0);
    $("ng-title").textContent = curLang === "en"
      ? ("Number " + currentNumber.N.v)
      : ("رقم " + digFor(currentNumber.N.v));
    $("stars-ng").textContent = "⭐".repeat(Math.min(5, n + 1));
    show("scr-number-game");
    buildNumberGame();
  }
  /* حمّل الشاحنة: اضغط على كل عربية فتصعد على المنصة وتُعدّ معك */
  function buildNumberGame() {
    numberStage = 1;
    var N = currentNumber.N;
    var slots = "";
    for (var k = 0; k < N.v; k++) slots += '<span class="slot" data-slot="' + k + '"></span>';
    stageHTML(
      dotsHTML(1, 4) +
      '<div class="truck-zone">' +
        '<span class="stage-prompt">' + esc(PH("loadTitle") + " — " + N.w) + "</span>" +
        '<div class="truck-wrap" id="ng-truck">' +
          '<span class="truck-badge" id="ng-count">0 / ' + N.v + "</span>" +
          veh("carrier", "xl") +
          '<span class="truck-bed" id="ng-bed"></span>' +
        "</div>" +
      "</div>" +
      '<div class="slots" id="ng-slots">' + slots + "</div>" +
      '<div class="pool" id="ng-pool"></div>', "ng-body");
    var pool = $("ng-pool"), loaded = 0;
    for (var i = 0; i < N.v; i++) {
      (function (i) {
        var s = document.createElement("button");
        s.className = "pool-car";
        var vname = window.VEHICLES ? VEHICLES.roadName(i) : "sedan";
        s.setAttribute("data-veh", vname);
        s.innerHTML = '<span class="veh">' + vehSvg(vname) + "</span>";
        s.onclick = function () {
          if (s.classList.contains("loaded")) return;
          loaded++;
          s.classList.add("loaded"); popSound();
          say(numArr()[loaded - 1].w, true);
          var mini = document.createElement("span");
          mini.className = "veh";
          mini.innerHTML = vehSvg(s.getAttribute("data-veh"));
          $("ng-bed").appendChild(mini);
          var badge = $("ng-count");
          badge.textContent = loaded + " / " + N.v;
          badge.classList.remove("pop"); void badge.offsetWidth; badge.classList.add("pop");
          var slot = document.querySelector('#ng-slots .slot[data-slot="' + (loaded - 1) + '"]');
          if (slot) { slot.classList.add("filled"); slot.textContent = digFor(loaded); }
          if (loaded >= N.v) setTimeout(function () {
            var tr2 = $("ng-truck");
            if (tr2) { tr2.classList.add("truck-driveoff"); honk(); }
            setTimeout(function () { numberStageDone(1); }, 1500);
          }, 850);
        };
        pool.appendChild(s);
      })(i);
    }
    speakSeq([PH("loadTitle"), N.w], true);
  }
  /* بعد نجاح مرحلة أرقام: نجمة + شاشة نجمة، ثم المرحلة التالية */
  function numberStageDone(no) {
    addStar(currentNumber.team, currentNumber.idx);
    var n = (stars[currentNumber.team][currentNumber.idx] || 0);
    $("stars-ng").textContent = "⭐".repeat(Math.min(5, n));
    if (no >= 4) { numberWin(); return; }
    miniWin(function () {
      if (no === 1) buildNumMatch();
      else if (no === 2) buildNumFind();
      else buildNumOrder();
    }, "ng-body");
  }

  /* المرحلة 2 : مطابقة الرقم بعدد العربيات — اختَر المجموعة الصحيحة */
  function buildNumMatch() {
    numberStage = 2;
    var N = currentNumber.N, idx = currentNumber.idx;
    var counts = [];
    if (N.v > 1) counts.push(N.v - 1);
    counts.push(N.v);
    if (N.v < 10) counts.push(N.v + 1);
    counts = shuffle(counts);
    var h = dotsHTML(2, 4) +
      '<div class="center-wrap" style="justify-content:flex-start">' +
        '<span class="stage-prompt">' + esc(ST("matchTitle")) + "</span>" +
        '<div class="letter-plate" style="--c:' + numColor(idx) + '">' + esc(digFor(N.v)) + "</div>" +
        '<div class="match-groups">';
    counts.forEach(function (cnt, gi) {
      h += '<button class="match-group" data-v="' + cnt + '" style="--mg:' + gi + '">';
      for (var k = 0; k < cnt; k++) {
        h += '<span class="veh sm">' + vehSvg(window.VEHICLES ? VEHICLES.roadName((idx + k + gi) % 999) : "sedan") + "</span>";
      }
      h += "</button>";
    });
    h += "</div></div>";
    stageHTML(h, "ng-body");
    speakSeq([ST("matchTitle"), numArr()[idx].w], true);
    var done = false;
    document.querySelectorAll("#ng-body .match-group").forEach(function (b) {
      b.onclick = function () {
        if (done) return;
        if (parseInt(b.getAttribute("data-v"), 10) === N.v) {
          done = true;
          b.classList.add("hit");
          goodSound();
          speakSeq([numArr()[idx].w, ST("gotStar")]);
          setTimeout(function () { numberStageDone(2); }, 1100);
        } else {
          b.classList.add("shake"); setTimeout(function () { b.classList.remove("shake"); }, 500);
          honk(); say(ST("matchWrong"));
        }
      };
    });
  }

  /* المرحلة 3 : سمعنا اسم الرقم — اختَر الرقم الصحيح من الشبكة */
  function buildNumFind() {
    numberStage = 3;
    var N = currentNumber.N, idx = currentNumber.idx;
    var digits = [];
    var cand = [];
    for (var d = 1; d <= Math.max(5, tierCfg().maxNumber); d++) if (d !== N.v) cand.push(d);
    cand = shuffle(cand).slice(0, 4);
    digits = shuffle(cand.concat([N.v]));
    var h = dotsHTML(3, 4) +
      '<div class="center-wrap" style="justify-content:flex-start">' +
        '<span class="stage-prompt">' + esc(ST("numFindTitle")) + "</span>" +
        '<div class="num-find-grid">';
    digits.forEach(function (v) {
      h += '<button class="find-cell num' + '" data-v="' + v + '" style="--c:' + numColor(v - 1) + '">' + esc(digFor(v)) + "</button>";
    });
    h += "</div></div>";
    stageHTML(h, "ng-body");
    say(numArr()[idx].w, true);
    setTimeout(function () { if (!done) say(numArr()[idx].w, true); }, 2600);
    var done = false;
    document.querySelectorAll("#ng-body .num-find-grid .find-cell").forEach(function (b) {
      b.onclick = function () {
        if (done) return;
        if (parseInt(b.getAttribute("data-v"), 10) === N.v) {
          done = true;
          doFind(b);
        } else { shakeCell(b); }
      };
    });
    function doFind(b) {
      b.classList.add("hit");
      goodSound();
      say(numArr()[idx].w, true);
      setTimeout(function () { numberStageDone(3); }, 1000);
    }
    function shakeCell(b) {
      b.classList.add("shake");
      setTimeout(function () { b.classList.remove("shake"); }, 500);
      honk(); say(ST("tryAgain"));
    }
  }

  /* المرحلة 4 : الترتيب — بماذا نتّبع الرقم؟ */
  function buildNumOrder() {
    numberStage = 4;
    var N = currentNumber.N, idx = currentNumber.idx;
    var seq = "";
    for (var k = 1; k < N.v; k++) seq += '<span class="order-chip" style="--c:' + numColor(k - 1) + '">' + esc(digFor(k)) + "</span>";
    seq += '<span class="order-chip q">؟</span>';
    var ack = [N.v];
    if (N.v > 1) ack.push(N.v - 1);
    if (N.v < 10) ack.push(N.v + 1);
    if (N.v < 9) ack.push(N.v + 2);
    ack = shuffle(ack);
    var h = dotsHTML(4, 4) +
      '<div class="center-wrap" style="justify-content:flex-start">' +
        '<span class="stage-prompt">' + esc(ST("orderTitle")) + "</span>" +
        '<div class="order-seq">' + seq + "</div>" +
        '<div class="num-find-grid">';
    ack.forEach(function (v) {
      h += '<button class="find-cell num" data-v="' + v + '" style="--c:' + numColor(v - 1) + '">' + esc(digFor(v)) + "</button>";
    });
    h += "</div></div>";
    stageHTML(h, "ng-body");
    speakSeq([ST("orderTitle"), N.v > 1 ? numArr()[N.v - 2].w : "", numArr()[idx].w], true);
    var done = false;
    document.querySelectorAll("#ng-body .num-find-grid .find-cell").forEach(function (b) {
      b.onclick = function () {
        if (done) return;
        if (parseInt(b.getAttribute("data-v"), 10) === N.v) {
          done = true;
          b.classList.add("hit");
          goodSound(); say(numArr()[idx].w, true);
          setTimeout(function () { numberStageDone(4); }, 1000);
        } else {
          b.classList.add("shake"); setTimeout(function () { b.classList.remove("shake"); }, 500);
          honk(); say(ST("tryAgain"));
        }
      };
    });
  }
  function numberWin() {
    starSound();
    var N = currentNumber.N;
    stageHTML(
      '<div class="win-wrap">' +
        '<div class="win-plate" style="--c:' + numColor(currentNumber.idx) + '">' + digFor(N.v) + "</div>" +
        '<div class="big-star">⭐</div>' +
        '<div class="win-tt">' + esc(ST("done")) + "</div>" +
        '<div class="win-sub">' + esc(digFor(N.v) + " — " + N.w) + "</div>" +
        '<div class="win-btns">' +
          '<button class="round-btn" onclick="BB.replayNumber()">' + (curLang === "en" ? "🔁 Again" : "🔁 مرة أخرى") + "</button>" +
          '<button class="round-btn alt" onclick="BB.nextNumber()">' + (curLang === "en" ? "Next number ▶️" : "الرقم التالي ▶️") + "</button>" +
        "</div>" +
      "</div>", "ng-body");
    confetti();
    speakSeq([PH("done"), N.w]);
    buildNumbers();
  }
  function replayNumber() { startNumberGame(currentNumber.idx); }
  function nextNumber() { startNumberGame((currentNumber.idx + 1) % numArr().length); }

  /* ---------- confetti ---------- */
  function confetti() {
    var stage = document.querySelector(".screen.active .lg-stage") || $("lg-stage");
    var emojis = ["🎉", "⭐", "🎈", "✨", "🎊"];
    for (var i = 0; i < 26; i++) {
      var d = document.createElement("div");
      d.className = "confetti";
      d.textContent = pick(emojis);
      d.style.right = rand(96) + "%";
      d.style.animationDelay = (rand(10) / 10) + "s";
      d.style.fontSize = (0.9 + rand(12) / 10) + "rem";
      stage.appendChild(d);
      setTimeout(function (x) { return function () { x.remove(); }; }(d), 2600);
    }
  }

  /* ---------- parent ---------- */
  function openParent() {
    $("parent-gate").classList.remove("hidden");
    $("parent-panel").classList.add("hidden");
    $("pg-answer").value = "";
    var a = 2 + rand(8), b = 2 + rand(8);
    gateTarget = a + b; gateQ = a + " + " + b;
    $("pg-q").textContent = toArabicDigits(a) + " + " + toArabicDigits(b);
    show("scr-parent");
  }
  /* بيانات الطفل في شاشة الأهل */
  function refreshParentInfo() {
    var n = $("pf-name"), g = $("pf-gender"), a = $("pf-age"), t = $("pf-tier");
    if (n) n.textContent = profile.name || "—";
    if (g) g.textContent = profile.gender === "girl" ? "بنت" : (profile.gender === "boy" ? "ولد" : "—");
    if (a) a.textContent = profile.age ? (profile.age + " سنوات") : "—";
    if (t) t.textContent = profile.age ? (tier === 1 ? "مبتدئ (حتى 3 سنوات)" : (tier === 2 ? "متوسط (4 سنوات)" : "متقدّم (5 سنوات فأكثر)")) : "—";
  }
  function toArabicDigits(x) {
    return String(x).replace(/[0-9]/g, function (d) { return "٠١٢٣٤٥٦٧٨٩"[d]; });
  }
  function checkGate() {
    var v = parseInt($("pg-answer").value, 10);
    if (v === gateTarget) {
      $("parent-gate").classList.add("hidden");
      $("parent-panel").classList.remove("hidden");
      refreshParentInfo();
    } else {
      $("pg-q").textContent = "?";
      toast("إجابة غير صحيحة — حاول مرة أخرى"); honk();
    }
  }
  function resetProgress() {
    if (confirm("هل تريد بالتأكيد مسح كل النجوم وتقدّم اللعب؟")) {
      stars = { L: {}, N: {}, E: {}, M: {} };
      saveStars();
      buildLetters(); buildNumbers(); refreshStarsEls();
      refreshHome();
      toast("تم تصفير التقدّم ✅");
    }
  }

  /* ---------- setup: بيانات الطفل (الاسم والنوع والعمر) ---------- */
  var AGE_OPTS = [
    { v: 2, t: "سنتان" },
    { v: 3, t: "3 سنوات" },
    { v: 4, t: "4 سنوات" },
    { v: 5, t: "5 سنوات" },
    { v: 6, t: "6 سنوات" }
  ];
  var pickedAge = 4;
  function renderSetup() {
    var panes = ["pane-name", "pane-gender", "pane-age"];
    for (var i = 0; i < panes.length; i++) {
      var p = $(panes[i]); if (p) p.classList.toggle("hidden", i !== setupStep);
    }
    var dots = document.querySelectorAll("#setup-steps .dot");
    for (var j = 0; j < dots.length; j++) dots[j].classList.toggle("on", j <= setupStep);
    var titles = ["مين هيلعب معانا؟", "ولد ولا بنت؟", "كام سنة عمر الطفل؟"];
    var subs = ["اكتب اسم الطفل عشان نبدأ", "هنختار الألعاب والألوان المناسبة", "العمر يختار نمط التمارين المناسب"];
    if ($("setup-title")) $("setup-title").textContent = titles[setupStep];
    if ($("setup-sub")) $("setup-sub").textContent = subs[setupStep];
    if (setupStep === 2) {
      var row = $("age-row"); row.innerHTML = "";
      AGE_OPTS.forEach(function (o) {
        var b = document.createElement("button");
        b.className = "age-chip" + (pickedAge === o.v ? " sel" : "");
        b.textContent = o.t;
        b.onclick = function () { pickedAge = o.v; renderSetup(); };
        row.appendChild(b);
      });
    }
    var m = $("setup-mascot");
    if (m && !m.firstChild) m.innerHTML = vehSvg("sedan");
  }
  function setupNext() {
    if (setupStep === 0) {
      var n = (($("child-name") || {}).value || "").trim();
      if (!n) { toast("اكتب اسم الطفل الأول 🙂"); return; }
      profile.name = n.slice(0, 20);
      setupStep = 1; renderSetup();
    } else if (setupStep === 1) {
      if (!profile.gender) { toast("اختر: ولد أم بنت"); return; }
      setupStep = 2; pickedAge = profile.age || 4; renderSetup();
    }
  }
  function setupBack() { if (setupStep > 0) { setupStep--; renderSetup(); } }
  function pickGender(g) {
    profile.gender = g;
    var b = $("ch-boy"), c = $("ch-girl");
    if (b) b.classList.toggle("sel", g === "boy");
    if (c) c.classList.toggle("sel", g === "girl");
    applyTheme();
    setTimeout(function () { setupStep = 2; pickedAge = profile.age || 4; renderSetup(); }, 300);
  }
  function setupFinish() {
    profile.age = pickedAge;
    tier = tierForAge(pickedAge);
    saveProfile(); applyTheme();
    show("scr-home");
    toast("أهلاً يا " + profile.name + "! 🎉", 2800);
  }
  function editProfile() {
    setupStep = 0;
    var inp = $("child-name"); if (inp) inp.value = profile.name;
    show("scr-setup"); renderSetup();
  }
  function resetProfile() {
    if (!confirm("هل تريد مسح بيانات الطفل (الاسم والنوع والعمر)؟")) return;
    profile = { name: "", gender: "", age: 0 };
    try { localStorage.removeItem(LS.profile); } catch (e) {}
    setupStep = 0; show("scr-setup"); renderSetup();
    toast("تم مسح بيانات الطفل");
  }

  /* ---------- اللعبة الإضافية: التمييز بين الأشكال (تختلف حسب النوع) ---------- */
  var BONUS_ITEMS = {
    boy: ["🚗", "🚙", "🚕", "🏎️", "🚓", "🚚", "🚜", "🚐"],
    girl: ["🌸", "🌼", "🌷", "🌻", "🌺", "🌹", "🍀", "🦋"]
  };
  function openBonus() {
    var isGirl = profile.gender === "girl";
    var items = isGirl ? BONUS_ITEMS.girl : BONUS_ITEMS.boy;
    var target = pick(items);
    var matches = tier === 1 ? 2 : (tier === 2 ? 3 : 4);
    var cols = tier === 1 ? 2 : 3;
    var total = cols * cols;
    var cells = [];
    for (var i = 0; i < matches; i++) cells.push(target);
    var others = items.filter(function (x) { return x !== target; });
    while (cells.length < total) cells.push(pick(others));
    cells = shuffle(cells);
    $("bonus-screen-title").textContent = isGirl ? "حديقتي" : "جراجي";
    show("scr-bonus");
    stageHTML(
      '<div class="bonus-wrap ' + (isGirl ? "garden" : "garage") + '">' +
        '<span class="stage-prompt">' + esc(PH("bonusTitle")) + ' <b class="bonus-target">' + target + "</b></span>" +
        '<div class="bonus-grid" id="bonus-grid" style="--cols:' + cols + '"></div>' +
        '<span class="bonus-hint">' + esc(PH("bonusFind")) + "</span>" +
      "</div>", "bonus-body");
    var grid = $("bonus-grid"), found = 0;
    cells.forEach(function (c) {
      var b = document.createElement("button");
      b.className = "bonus-cell";
      b.textContent = c;
      b.onclick = function () {
        if (b.classList.contains("done")) return;
        if (c === target) {
          b.classList.add("done"); found++; popSound();
          if (found >= matches) setTimeout(bonusWin, 700);
        } else {
          b.classList.add("shake"); setTimeout(function () { b.classList.remove("shake"); }, 500);
          honk();
        }
      };
      grid.appendChild(b);
    });
    speakSeq([PH("bonusTitle"), PH("bonusFind")]);
  }
  function bonusWin() {
    starSound();
    stageHTML(
      '<div class="win-wrap">' +
        '<div class="big-star">⭐</div>' +
        '<div class="win-tt">' + esc(PH("bonusWin")) + "</div>" +
        '<div class="win-btns">' +
          '<button class="round-btn" onclick="BB.openBonus()">' + (curLang === "en" ? "🔁 Again" : "🔁 مرة أخرى") + "</button>" +
          '<button class="round-btn alt" onclick="BB.goHome()">' + (curLang === "en" ? "Home ▶️" : "الرئيسية ▶️") + "</button>" +
        "</div>" +
      "</div>", "bonus-body");
    confetti();
  }

  /* ---------- boot ---------- */
  function boot() {
    loadStars();
    loadLocalPack();
    loadProfile();
    applyTheme();
    buildLetters(); buildNumbers(); refreshStarsEls();
    buildHomeScene();
    $("app-version").textContent = APK_VERSION;
    document.addEventListener("click", function unlock() {
      var c = ctx(); if (c && c.state === "suspended") c.resume();
      // على الآيفون: نطلب من Safari تشغيل الصوت في وضع "تشغيل" بدل "نظام"
      // فيعمل الصوت حتى لو الموبايل على الوضع الصامت (Safari 17.4+)
      try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}
      document.removeEventListener("click", unlock);
    });
    var starts = 0;
    try { starts = parseInt(localStorage.getItem(LS.startCount) || "0", 10); } catch (e) {}
    starts++;
    try { localStorage.setItem(LS.startCount, String(starts)); } catch (e) {}
    setTimeout(maybeAutoUpdate, 2500);
    updateTimer = setInterval(maybeAutoUpdate, 120000);
    // زر الرجوع الأندرويد بيكلم الدالة دي
    window.androidBack = function () {
      if (curScreen === "scr-home") return false;
      show("scr-home"); return true;
    };
    document.addEventListener("gesturestart", function (e) { e.preventDefault(); });

    /* ---------- تطبيق الويب المثبَّت (PWA) ---------- */
    // يعمل على الآيفون والأندرويد والكمبيوتر عندما تُفتح الصفحة من الإنترنت،
    // ونتجاهله تمامًا داخل نسخة الأندرويد (file://) لأنه غير مدعوم هناك.
    if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
      window.addEventListener("load", function () {
        try { navigator.serviceWorker.register("sw.js").catch(function () {}); } catch (e) {}
      });
    }
    /* أول تشغيل: شاشة بيانات الطفل */
    if (!hasProfile()) {
      setupStep = 0;
      var inp0 = $("child-name"); if (inp0) inp0.value = "";
      show("scr-setup");
      renderSetup();
    }
  }

  document.addEventListener("DOMContentLoaded", boot);

  /* ---------- public ---------- */
  return {
    goHome: goHome,
    openLetters: openLetters,
    openNumbers: openNumbers,
    openParent: openParent,
    openBonus: openBonus,
    checkGate: checkGate,
    resetProgress: resetProgress,
    manualUpdate: manualUpdate,
    setupNext: setupNext, setupBack: setupBack, pickGender: pickGender, setupFinish: setupFinish,
    editProfile: editProfile, resetProfile: resetProfile,
    replayLetter: replayLetter, nextLetter: nextLetter,
    replayNumber: replayNumber, nextNumber: nextNumber
  };
})();
