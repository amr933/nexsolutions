/* ===== BEEB BEEB — game engine (vanilla JS) ===== */
/* Engine version bumps only with the APK; pack version updates in-app via OTA. */
window.BB = (function () {
  "use strict";

  var APK_VERSION = "1.2.0";
  var MANIFEST_URL = "https://nexsolutions.pages.dev/apps/beebeeb/manifest.json";
  var LS = { pack: "bb_pack_v", stars: "bb_stars", startCount: "bb_starts" };

  var PACK = (window.DEFAULT_PACK && window.DEFAULT_PACK.v) ? window.DEFAULT_PACK : { v: 1, letters: [], numbers: [], phrases: {} };
  var stars = { L: {}, N: {} };
  var currentLetter = null, currentNumber = null;
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
  /* أيقونة كلمة الحرف: مركبة مرسومة لو الكلمة مركبة، وإلا الإيموجي */
  function wordIcon(L) {
    var V = window.VEHICLES;
    var v = V && (V.forWord(L.w) || V.wordArt(L.w));
    if (v) return '<span class="veh sm">' + v + "</span>";
    return '<span class="chip-emoji">' + (L.e || "🚗") + "</span>";
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
        u.lang = "ar"; u.rate = slow ? 0.75 : 0.9; u.pitch = 1.1;
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
    try { var s = JSON.parse(localStorage.getItem(LS.stars) || "{}"); if (s && s.L) stars = s; } catch (e) {}
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
    var totalL = PACK.letters.length, doneL = Object.keys(stars.L).length;
    var totalN = PACK.numbers.length, doneN = Object.keys(stars.N).length;
    $("letters-progress").textContent = doneL >= totalL ? "أكملتها كلها! 🏆" : (doneL > 0 ? ("أنجزت " + doneL + " من " + totalL) : "هيا نلعب!");
    $("numbers-progress").textContent = doneN >= totalN ? "أكملتها كلها! 🏆" : (doneN > 0 ? ("أنجزت " + doneN + " من " + totalN) : "هيا نلعب!");
    say(PACK.phrases.home || "");
  }

  /* ---------- UPDATE (OTA) ---------- */
  function toast(msg, ms) {
    var t = $("toast");
    t.textContent = msg; t.classList.remove("hidden");
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.add("hidden"); }, ms || 3200);
  }
  function applyPack(json) {
    if (!json || !json.v || !json.letters) return false;
    PACK = json;
    localStorage.setItem(LS.pack, JSON.stringify(json));
    return true;
  }
  function loadLocalPack() {
    try {
      var raw = localStorage.getItem(LS.pack);
      if (raw) { var p = JSON.parse(raw); if (p && p.letters && p.numbers) PACK = p; }
    } catch (e) {}
    $("pack-version").textContent = PACK.v;
  }
  function checkUpdate(manual) {
    if (!navigator.onLine && !manual) return;
    fetch(MANIFEST_URL + "?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (m) {
        if (m && m.v > PACK.v) return fetchPackManifest(m);
        if (m && m.apkVersion && m.apkVersion > APK_VERSION) {
          window.latestApkUrl = m.apkUrl || null;
          ensureApkUpdateBtn(m.apkVersion);
          if (manual) toast("يتوفر إصدار أحدث من التطبيق — حمّله من شاشة الأهل 🔽");
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
  function openLetters() {
    buildLetters();
    show("scr-letters");
    say(PACK.phrases.openLetters || "");
  }
  function buildLetters() {
    var g = $("letters-grid"); g.innerHTML = "";
    PACK.letters.forEach(function (L, i) {
      var b = document.createElement("button");
      b.className = "letter-card" + (stars.L[i] ? " done" : "");
      b.style.setProperty("--c", palette(i));
      b.style.setProperty("--c2", palette2(i));
      b.innerHTML =
        '<span class="lc-head">' + roadVeh(i, "xs") + '<span class="lc-l">' + esc(L.c) + "</span></span>" +
        '<span class="lc-w">' + esc(L.w) + "</span>" +
        '<span class="lc-s">' + starStr("L", i) + "</span>";
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
    currentLetter = { idx: i, L: PACK.letters[i] };
    var n = stars.L[i] || 0;
    $("lg-title").textContent = "حرف " + currentLetter.L.c + " — " + currentLetter.L.n;
    $("stars-lg").textContent = "⭐".repeat(n + 1);
    show("scr-letter-game");
    buildLetterGame();
  }
  function stageHTML(html, scr) { $(scr || "lg-body").innerHTML = html; }

  /* المرحلة 1 : التعرف — دوس على العربية التي تحمل الحرف */
  function buildLetterGame() {
    var L = currentLetter.L, idx = currentLetter.idx, col = palette(idx);
    stageHTML(
      '<div class="center-wrap">' +
        '<span class="stage-prompt">' + esc(PACK.phrases.tapCar) + "</span>" +
        '<button class="hero-car-btn" id="lg-car">' +
          '<span class="car-holder">' +
            roadVeh(idx, "xl bob") +
            '<span class="roof-plate" style="--c:' + col + '">' + esc(L.c) + "</span>" +
          "</span>" +
        "</button>" +
        '<button class="next-btn" id="lg-next">التالي ▶️</button>' +
      "</div>"
    );
    var car = $("lg-car");
    car.onclick = function () {
      honk();
      speakSeq([L.n, L.w], true);
      var chip = document.querySelector("#lg-body .word-chip");
      if (!chip) {
        chip = document.createElement("div");
        chip.className = "word-chip";
        chip.style.setProperty("--c", col);
        chip.style.setProperty("--c2", palette2(idx));
        chip.innerHTML = wordIcon(L) + "<span>" + esc(L.w) + "</span>";
        car.parentNode.appendChild(chip);
      }
      setTimeout(function () { $("lg-next").classList.add("show"); }, 700);
      car.onclick = function () { honk(); say(L.n + "! " + L.w + "!", true); };
    };
    $("lg-next").onclick = buildLetterCatch;
    say(PACK.phrases.tapCar);
  }

  /* المرحلة 2 : تجميع الحرف من العربيات المارة (من اليمين إلى اليسار) */
  function buildLetterCatch() {
    var L = currentLetter.L, target = L.c, col = palette(currentLetter.idx);
    stageHTML('<div class="center-wrap" style="justify-content:flex-start">' +
      '<span class="stage-prompt">' + esc(PACK.phrases.catchTitle) + "</span>" +
      '<div class="letter-plate" style="--c:' + col + '">' + esc(target) + "</div>" +
      '<div class="catch-name">حرف ' + esc(L.n) + "</div>" +
      "</div>");
    var caught = 0, spawned = 0, TOTAL = 6, NEEDED = 3;
    var timers = [];
    function spawn() {
      if (spawned >= TOTAL) return;
      spawned++;
      var isTarget = caught < NEEDED && (spawned <= TOTAL - 2 ? Math.random() < 0.55 : true);
      var obs = isTarget ? target : pick(shuffle(PACK.letters.filter(function (x) { return x.c !== target; }))).c;
      var car = document.createElement("button");
      car.className = "traffic-car";
      var dur = 4200 + rand(1800);
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
          say(L.n, true);
          $("stars-lg").textContent = "⭐".repeat(Math.min(5, (stars.L[currentLetter.idx] || 0) + 1)) + " " + caught + "/" + NEEDED;
          timers.push(setTimeout(function () { car.remove(); }, 760));
          if (caught >= NEEDED) { timers.forEach(clearTimeout); setTimeout(letterWin, 700); }
        } else {
          car.classList.add("car-shake");
          honk();
          timers.push(setTimeout(function () { car.classList.add("car-leave"); }, 420));
          say(PACK.phrases.catchWrong);
        }
      };
      timers.push(setTimeout(function () { done = true; car.remove(); }, dur + 400));
      timers.push(setTimeout(spawn, 900 + rand(1400)));
    }
    spawn(); setTimeout(spawn, 1400);
    speakSeq([PACK.phrases.catchTitle, L.n], true);
  }

  function letterWin() {
    addStar("L", currentLetter.idx);
    starSound();
    var L = currentLetter.L;
    stageHTML(
      '<div class="win-wrap">' +
        '<div class="win-plate" style="--c:' + palette(currentLetter.idx) + '">' + esc(L.c) + "</div>" +
        '<div class="big-star">⭐</div>' +
        '<div class="win-tt">' + esc(L.n + " — " + L.w) + "</div>" +
        '<div class="win-btns">' +
          '<button class="round-btn" onclick="BB.replayLetter()">🔁 مرة أخرى</button>' +
          '<button class="round-btn alt" onclick="BB.nextLetter()">الحرف التالي ▶️</button>' +
        "</div>" +
      "</div>");
    confetti();
    speakSeq([PACK.phrases.done, L.n, L.w]);
    buildLetters();
  }
  function replayLetter() { startLetterGame(currentLetter.idx); }
  function nextLetter() { startLetterGame((currentLetter.idx + 1) % PACK.letters.length); }

  /* ---------- NUMBERS ---------- */
  function openNumbers() {
    buildNumbers();
    show("scr-numbers");
    say(PACK.phrases.openNumbers || "");
  }
  function buildNumbers() {
    var g = $("numbers-grid"); g.innerHTML = "";
    PACK.numbers.forEach(function (N, i) {
      var b = document.createElement("button");
      b.className = "number-card" + (stars.N[i] ? " done" : "");
      var nbArabic = ["", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩", "١٠"][N.v];
      b.style.setProperty("--c", numColor(i));
      b.style.setProperty("--c2", numColor2(i));
      b.innerHTML = '<span class="nc-body">' + roadVeh(i) + '<span class="nc-n">' + nbArabic + "</span></span>" +
        '<span class="nc-s">' + starStr("N", i) + "</span>";
      b.onclick = function () { startNumberGame(i); };
      g.appendChild(b);
    });
    refreshStarsEls();
  }
  function startNumberGame(i) {
    currentNumber = { idx: i, N: PACK.numbers[i] };
    var n = stars.N[i] || 0;
    $("ng-title").textContent = "رقم " + ["", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩", "١٠"][currentNumber.N.v];
    $("stars-ng").textContent = "⭐".repeat(n + 1);
    show("scr-number-game");
    buildNumberGame();
  }
  /* حمّل الشاحنة: اضغط على كل عربية فتصعد على المنصة وتُعدّ معك */
  function buildNumberGame() {
    var N = currentNumber.N;
    var slots = "";
    for (var k = 0; k < N.v; k++) slots += '<span class="slot" data-slot="' + k + '"></span>';
    stageHTML(
      '<div class="truck-zone">' +
        '<span class="stage-prompt">' + esc(PACK.phrases.loadTitle + " — " + N.w) + "</span>" +
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
          say(PACK.numbers[loaded - 1].w, true);
          var mini = document.createElement("span");
          mini.className = "veh";
          mini.innerHTML = vehSvg(s.getAttribute("data-veh"));
          $("ng-bed").appendChild(mini);
          var badge = $("ng-count");
          badge.textContent = loaded + " / " + N.v;
          badge.classList.remove("pop"); void badge.offsetWidth; badge.classList.add("pop");
          var slot = document.querySelector('#ng-slots .slot[data-slot="' + (loaded - 1) + '"]');
          if (slot) { slot.classList.add("filled"); slot.textContent = ["", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩", "١٠"][loaded]; }
          if (loaded >= N.v) setTimeout(numberWin, 850);
        };
        pool.appendChild(s);
      })(i);
    }
    speakSeq([PACK.phrases.loadTitle, N.w], true);
  }
  function numberWin() {
    addStar("N", currentNumber.idx);
    starSound();
    var N = currentNumber.N;
    var tr = $("ng-truck");
    if (tr) { tr.classList.add("truck-driveoff"); honk(); }
    setTimeout(function () {
      stageHTML(
        '<div class="win-wrap">' +
          '<div class="win-plate" style="--c:' + numColor(currentNumber.idx) + '">' + ["", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩", "١٠"][N.v] + "</div>" +
          '<div class="big-star">⭐</div>' +
          '<div class="win-tt">' + esc(N.v + " — " + N.w) + "</div>" +
          '<div class="win-btns">' +
            '<button class="round-btn" onclick="BB.replayNumber()">🔁 مرة أخرى</button>' +
            '<button class="round-btn alt" onclick="BB.nextNumber()">الرقم التالي ▶️</button>' +
          "</div>" +
        "</div>", "ng-body");
      confetti();
      speakSeq([PACK.phrases.done, N.w]);
      buildNumbers();
    }, 1700);
  }
  function replayNumber() { startNumberGame(currentNumber.idx); }
  function nextNumber() { startNumberGame((currentNumber.idx + 1) % PACK.numbers.length); }

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
  function toArabicDigits(x) {
    return String(x).replace(/[0-9]/g, function (d) { return "٠١٢٣٤٥٦٧٨٩"[d]; });
  }
  function checkGate() {
    var v = parseInt($("pg-answer").value, 10);
    if (v === gateTarget) {
      $("parent-gate").classList.add("hidden");
      $("parent-panel").classList.remove("hidden");
    } else {
      $("pg-q").textContent = "?";
      toast("إجابة غير صحيحة — حاول مرة أخرى"); honk();
    }
  }
  function resetProgress() {
    if (confirm("هل تريد بالتأكيد مسح كل النجوم وتقدّم اللعب؟")) {
      stars = { L: {}, N: {} };
      saveStars();
      buildLetters(); buildNumbers(); refreshStarsEls();
      toast("تم تصفير التقدّم ✅");
    }
  }

  /* ---------- boot ---------- */
  function boot() {
    loadStars();
    loadLocalPack();
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
  }

  document.addEventListener("DOMContentLoaded", boot);

  /* ---------- public ---------- */
  return {
    goHome: goHome,
    openLetters: openLetters,
    openNumbers: openNumbers,
    openParent: openParent,
    checkGate: checkGate,
    resetProgress: resetProgress,
    manualUpdate: manualUpdate,
    replayLetter: replayLetter, nextLetter: nextLetter,
    replayNumber: replayNumber, nextNumber: nextNumber
  };
})();
