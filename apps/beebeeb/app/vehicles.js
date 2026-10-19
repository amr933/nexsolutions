/* =========================================================
   بيب بيب — مكتبة المركبات (رسوم SVG مرسومة بالكود)
   قاعدة الاتجاه: كل مركبة تواجه اليسار، والسير من اليمين لليسار
   فالمركبة تسير للأمام دائمًا — لا يوجد أي scaleX(-1) هنا.
   ========================================================= */
window.VEHICLES = (function () {
  "use strict";

  var VW = 220, VH = 134;      // مساحة الرسم
  var WY = 102, WR = 19;       // مركز العجلات ونصف القطر
  var TIRE = "#263238", RIM = "#CFD8DC", SPOKE = "#78909C";

  function open() { return '<svg class="vs" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + VW + ' ' + VH + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true">'; }
  function close() { return "</svg>"; }
  function wrap(inner) { return open() + inner + close(); }

  function shadow(rx) {
    return '<ellipse cx="110" cy="125" rx="' + (rx || 96) + '" ry="8" fill="#0B2E3F" opacity=".16"/>';
  }

  /* عجلة بخطوط تظهر دورانها */
  function wheel(cx, r, cy) {
    r = r || WR; cy = cy || WY;
    var spokes = "", i, a;
    for (i = 0; i < 4; i++) {
      a = Math.PI * i / 4;
      spokes += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + Math.cos(a) * (r - 7)).toFixed(1) +
                '" y2="' + (cy + Math.sin(a) * (r - 7)).toFixed(1) +
                '" stroke="' + SPOKE + '" stroke-width="3.4" stroke-linecap="round"/>';
    }
    return '<g class="wh" style="transform-origin:' + cx + 'px ' + cy + 'px">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + TIRE + '"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r - 5) + '" fill="' + RIM + '"/>' +
      spokes +
      '<circle cx="' + cx + '" cy="' + cy + '" r="5" fill="#90A4AE"/>' +
      "</g>";
  }
  function wheels(x1, x2) { return wheel(x1) + wheel(x2); }

  function rr(x, y, w, h, r, fill, extra) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + r +
           '" fill="' + fill + '"' + (extra || "") + "/>";
  }
  /* لمعة زجاجية أعلى الجسم — تعطي إحساس العمق */
  function gloss(x, y, w, o) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="7" rx="3.5" fill="#FFFFFF" opacity="' +
           (o || ".28") + '"/>';
  }
  /* مصباح بحلقة غامقة حتى يظهر على أي لون جسم */
  function lamp(front) {
    var x = front ? 10 : 194;
    return rr(x - 2, 69, 15, 21, 8, "#263238") +
           rr(x, 72, 11, 15, 6, front ? "#FFE082" : "#FF5252");
  }

  /* ================= 1) سيدان ================= */
  function sedan(c) {
    return wrap(
      shadow(98) +
      '<path d="M16,102 L16,84 Q16,72 32,70 L70,66 L88,64 L100,34 Q102,31 108,31 L144,31 Q150,31 152,34 L164,64 L196,68 Q204,70 204,80 L204,102 Z" fill="' + c.body + '"/>' +
      gloss(34, 72, 150, ".22") +
      '<path d="M99,60 L106,36 L118,36 L118,60 Z" fill="' + c.glass + '"/>' +
      '<path d="M126,36 L142,36 Q145,36 146,38 L154,60 L126,60 Z" fill="' + c.glass + '"/>' +
      '<line x1="121" y1="64" x2="121" y2="94" stroke="#000000" stroke-opacity=".16" stroke-width="3"/>' +
      rr(20, 96, 178, 6, 3, "#000000", ' opacity=".12"') +
      lamp(true) + lamp(false) +
      wheels(58, 166)
    );
  }

  /* ================= 2) تاكسي ================= */
  function taxi() {
    var check = "", i;
    for (i = 0; i < 8; i++) check += rr(30 + i * 21, 88, 10, 8, 2, i % 2 ? "#212121" : "#FFFFFF");
    return wrap(
      shadow(98) +
      '<path d="M16,102 L16,84 Q16,72 32,70 L70,66 L88,64 L100,34 Q102,31 108,31 L144,31 Q150,31 152,34 L164,64 L196,68 Q204,70 204,80 L204,102 Z" fill="#FFC107"/>' +
      gloss(34, 72, 150, ".22") +
      '<path d="M99,60 L106,36 L118,36 L118,60 Z" fill="#B3E5FC"/>' +
      '<path d="M126,36 L142,36 Q145,36 146,38 L154,60 L126,60 Z" fill="#B3E5FC"/>' +
      '<line x1="121" y1="64" x2="121" y2="94" stroke="#000000" stroke-opacity=".16" stroke-width="3"/>' +
      rr(109, 13, 34, 17, 5, "#FFFDE7") + rr(116, 18, 20, 7, 2, "#F57F17") +
      check +
      lamp(true) + lamp(false) +
      wheels(58, 166)
    );
  }

  /* ================= 3) فان ================= */
  function van(c) {
    return wrap(
      shadow(98) +
      rr(14, 44, 192, 58, 16, c.body) +
      gloss(26, 50, 168) +
      rr(22, 54, 46, 32, 8, c.glass) +
      rr(76, 54, 46, 28, 7, c.glass) +
      rr(130, 54, 46, 28, 7, c.glass) +
      rr(22, 90, 176, 6, 3, c.dark, ' opacity=".55"') +
      lamp(true) + lamp(false) +
      wheels(62, 166)
    );
  }

  /* ================= 4) شاحنة ================= */
  function truck(c) {
    var ribs = "", i;
    for (i = 0; i < 3; i++) ribs += rr(122 + i * 26, 38, 6, 56, 3, c.dark, ' opacity=".55"');
    return wrap(
      shadow(100) +
      rr(100, 30, 106, 72, 9, c.body) +
      ribs +
      rr(12, 46, 84, 56, 12, c.dark) +
      rr(22, 54, 46, 26, 7, c.glass) +
      rr(12, 92, 194, 10, 5, "#37474F") +
      lamp(true) + lamp(false) +
      wheel(52) + wheel(132) + wheel(182)
    );
  }

  /* ================= 5) أتوبيس ================= */
  function bus() {
    var win = "", i;
    for (i = 0; i < 4; i++) win += rr(74 + i * 34, 44, 26, 26, 6, "#B3E5FC");
    return wrap(
      shadow(102) +
      rr(10, 32, 200, 70, 15, "#43A047") +
      gloss(24, 38, 172) +
      rr(24, 40, 42, 34, 8, "#B3E5FC") +
      win +
      rr(10, 84, 200, 9, 4, "#2E7D32") +
      rr(178, 44, 24, 38, 5, "#C8E6C9", ' opacity=".85"') +
      lamp(true) + lamp(false) +
      wheels(58, 166)
    );
  }

  /* ================= 6) سيارة سباق ================= */
  function racer() {
    return wrap(
      shadow(96) +
      '<path d="M12,98 L16,78 Q20,68 34,66 L150,62 Q170,61 178,54 L198,54 Q208,54 208,68 L208,98 Z" fill="#7B1FA2"/>' +
      gloss(30, 72, 160, ".22") +
      '<path d="M150,62 Q170,61 178,54 L198,54 Q208,54 208,68 L196,68 Q190,60 178,60 L152,64 Z" fill="#4A148C"/>' +
      rr(178, 40, 30, 9, 4, "#4A148C") + rr(190, 47, 8, 12, 3, "#4A148C") +
      '<ellipse cx="96" cy="70" rx="26" ry="12" fill="#CE93D8"/>' +
      '<ellipse cx="96" cy="68" rx="20" ry="7" fill="#F3E5F5" opacity=".8"/>' +
      rr(30, 62, 4, 26, 2, "#FFFFFF", ' opacity=".35"') +
      lamp(true) + lamp(false) +
      wheel(54, 16) + wheel(172, 16)
    );
  }

  /* ================= 7) مطافئ ================= */
  function fire() {
    var rungs = "", i;
    for (i = 0; i < 6; i++) rungs += rr(126 + i * 12, 24, 4, 12, 2, "#B0BEC5");
    return wrap(
      shadow(100) +
      rr(100, 34, 106, 68, 9, "#D32F2F") +
      rr(100, 34, 106, 12, 6, "#B71C1C") +
      rr(12, 46, 84, 56, 12, "#E53935") +
      rr(22, 54, 46, 26, 7, "#B3E5FC") +
      rr(122, 20, 78, 7, 3, "#90A4AE") + rungs +
      rr(48, 34, 26, 12, 5, "#FFEB3B") +
      rr(12, 92, 194, 10, 5, "#37474F") +
      lamp(true) + lamp(false) +
      wheel(52) + wheel(132) + wheel(182)
    );
  }

  /* ================= 8) إسعاف ================= */
  function ambulance() {
    return wrap(
      shadow(98) +
      rr(14, 44, 192, 58, 16, "#FAFAFA") +
      gloss(26, 50, 168) +
      rr(22, 54, 46, 32, 8, "#B3E5FC") +
      rr(78, 54, 44, 28, 7, "#B3E5FC") +
      rr(132, 62, 40, 40, 6, "#E53935") +
      rr(122, 74, 12, 12, 2, "#FFFFFF") + rr(131, 74, 12, 12, 2, "#FFFFFF") +
      rr(22, 90, 176, 6, 3, "#CFD8DC") +
      rr(48, 36, 24, 11, 5, "#1976D2") +
      lamp(true) + lamp(false) +
      wheels(62, 166)
    );
  }

  /* ================= 9) بيك أب ================= */
  function pickup(c) {
    return wrap(
      shadow(98) +
      rr(14, 70, 192, 32, 12, c.body) +
      gloss(26, 76, 168) +
      '<path d="M58,70 L74,40 Q78,33 87,33 L124,33 Q133,33 137,40 L152,70 Z" fill="' + c.dark + '"/>' +
      '<path d="M68,66 L81,42 Q83,39 89,39 L102,39 L102,66 Z" fill="' + c.glass + '"/>' +
      '<path d="M110,39 L124,39 Q130,39 132,42 L142,66 L110,66 Z" fill="' + c.glass + '"/>' +
      rr(156, 56, 50, 16, 5, "#546E7A") + rr(160, 60, 42, 8, 3, "#37474F") +
      lamp(true) + lamp(false) +
      wheels(56, 170)
    );
  }

  /* ================= 10) خلاطة أسمنت ================= */
  function mixer() {
    return wrap(
      shadow(100) +
      rr(12, 46, 84, 56, 12, "#1565C0") +
      rr(22, 54, 46, 26, 7, "#B3E5FC") +
      '<g transform="rotate(-14 158 66)">' +
        rr(118, 46, 82, 40, 18, "#FB8C00") +
        rr(130, 50, 8, 32, 4, "#E65100", ' opacity=".6"') +
        rr(152, 50, 8, 32, 4, "#E65100", ' opacity=".6"') +
        rr(174, 50, 8, 32, 4, "#E65100", ' opacity=".6"') +
      "</g>" +
      rr(12, 92, 194, 10, 5, "#37474F") +
      lamp(true) + lamp(false) +
      wheel(52) + wheel(132) + wheel(182)
    );
  }

  /* ================= 11) شاحنة نقل (منصة فارغة تُحمَّل بالعربيات) ================= */
  function carrier() {
    return wrap(
      shadow(100) +
      rr(96, 76, 114, 16, 4, "#B0BEC5") +
      rr(96, 78, 114, 5, 2, "#90A4AE") +
      rr(200, 54, 9, 24, 3, "#78909C") +
      rr(12, 46, 84, 56, 12, "#1E88E5") +
      gloss(22, 52, 64, ".20") +
      rr(22, 54, 46, 26, 7, "#B3E5FC") +
      rr(58, 32, 36, 13, 5, "#FFCA28") +
      rr(12, 92, 194, 10, 5, "#37474F") +
      lamp(true) + lamp(false) +
      wheel(52) + wheel(132) + wheel(182)
    );
  }

  /* ================= 12) دراجة ================= */
  function bike() {
    return wrap(
      shadow(88) +
      '<line x1="52" y1="100" x2="110" y2="62" stroke="#E53935" stroke-width="7" stroke-linecap="round"/>' +
      '<line x1="110" y1="62" x2="168" y2="100" stroke="#E53935" stroke-width="7" stroke-linecap="round"/>' +
      '<line x1="52" y1="100" x2="118" y2="100" stroke="#E53935" stroke-width="7" stroke-linecap="round"/>' +
      '<line x1="118" y1="100" x2="168" y2="100" stroke="#1E88E5" stroke-width="7" stroke-linecap="round"/>' +
      '<line x1="110" y1="62" x2="122" y2="46" stroke="#263238" stroke-width="5" stroke-linecap="round"/>' +
      '<line x1="104" y1="42" x2="140" y2="42" stroke="#263238" stroke-width="5" stroke-linecap="round"/>' +
      rr(96, 52, 30, 9, 4, "#455A64") +
      wheel(52, 20) + wheel(168, 20)
    );
  }

  /* ================= 12) صاروخ ================= */
  function rocket() {
    return wrap(
      '<path d="M18,74 Q58,26 122,30 L164,36 Q186,40 186,62 Q186,84 164,88 L122,94 Q58,98 18,74 Z" fill="#E3EAEE" stroke="#90A4AE" stroke-width="2.5"/>' +
      '<path d="M18,74 Q58,26 122,30 L118,52 Q60,56 18,74 Z" fill="#E53935"/>' +
      '<circle cx="118" cy="62" r="15" fill="#1E88E5"/>' +
      '<circle cx="118" cy="62" r="9" fill="#B3E5FC"/>' +
      '<path d="M160,36 Q196,26 202,62 Q196,98 160,88 Z" fill="#F4511E" opacity=".9"/>' +
      '<path d="M186,52 Q214,44 218,62 Q214,80 186,72 Z" fill="#FFB300"/>' +
      '<path d="M186,58 Q206,52 210,62 Q206,72 186,66 Z" fill="#FFEB3B"/>'
    );
  }

  /* ================= 13) طائرة ================= */
  function plane() {
    return wrap(
      /* الجنح الخلفي */
      '<path d="M96,78 L134,80 L146,106 Q148,112 140,110 L92,84 Z" fill="#64B5F6" stroke="#1565C0" stroke-width="2.5"/>' +
      /* الجسم */
      '<path d="M14,70 Q30,48 96,46 L152,48 Q188,50 188,66 Q188,82 152,84 L96,86 Q30,84 14,70 Z" fill="#F2F6F8" stroke="#90A4AE" stroke-width="2.5"/>' +
      /* الذيل */
      '<path d="M104,50 L140,48 L152,18 Q156,10 162,18 L168,50 L106,52 Z" fill="#42A5F5" stroke="#1565C0" stroke-width="2.5"/>' +
      /* الجنح الأمامي */
      '<path d="M92,66 L150,64 L162,36 Q166,28 158,30 L86,62 Z" fill="#90CAF9" stroke="#1565C0" stroke-width="2.5"/>' +
      /* الكابينة */
      '<path d="M40,60 Q52,50 76,50 L84,50 L84,66 L40,66 Z" fill="#B3E5FC" stroke="#90A4AE" stroke-width="2"/>' +
      /* المروحة */
      '<ellipse cx="14" cy="70" rx="5" ry="16" fill="#546E7A"/>' +
      '<ellipse cx="14" cy="70" rx="3" ry="8" fill="#B0BEC5"/>'
    );
  }

  /* ================= 14) مروحية ================= */
  function heli() {
    return wrap(
      '<line x1="60" y1="46" x2="196" y2="46" stroke="#546E7A" stroke-width="9" stroke-linecap="round" class="rotor"/>' +
      '<line x1="128" y1="24" x2="128" y2="50" stroke="#455A64" stroke-width="8" stroke-linecap="round"/>' +
      '<path d="M22,74 Q22,44 74,44 L128,46 L128,80 L74,88 Q22,88 22,74 Z" fill="#43A047"/>' +
      '<path d="M22,74 Q22,52 62,48 L62,80 Q30,82 22,74 Z" fill="#2E7D32"/>' +
      '<circle cx="82" cy="64" r="17" fill="#B3E5FC"/>' +
      '<circle cx="82" cy="64" r="10" fill="#4FC3F7"/>' +
      '<path d="M128,58 L206,62 L206,74 L128,80 Z" fill="#66BB6A"/>' +
      '<line x1="196" y1="52" x2="196" y2="86" stroke="#37474F" stroke-width="7" stroke-linecap="round"/>' +
      rr(30, 88, 84, 8, 4, "#37474F") + rr(30, 88, 84, 8, 4, "#37474F") +
      rr(44, 96, 60, 8, 4, "#546E7A")
    );
  }

  /* ================= 15) غواصة ================= */
  function sub() {
    return wrap(
      '<ellipse cx="112" cy="76" rx="88" ry="30" fill="#FBC02D"/>' +
      '<ellipse cx="112" cy="70" rx="80" ry="22" fill="#FDD835" opacity=".55"/>' +
      rr(84, 34, 44, 26, 8, "#F9A825") +
      '<line x1="100" y1="34" x2="100" y2="14" stroke="#F57F17" stroke-width="6" stroke-linecap="round"/>' +
      '<circle cx="100" cy="14" r="7" fill="#F57F17"/>' +
      '<circle cx="58" cy="78" r="8" fill="#4FC3F7"/>' +
      '<circle cx="92" cy="82" r="8" fill="#4FC3F7"/>' +
      '<circle cx="126" cy="84" r="8" fill="#4FC3F7"/>' +
      '<path d="M196,64 Q214,76 196,90 Z" fill="#EF6C00"/>' +
      '<circle cx="24" cy="76" r="9" fill="#EF6C00"/>'
    );
  }

  /* ================= رسوم لكلمات لا يوجد لها إيموجي مناسب ================= */
  function art(r, inner) {
    return '<svg class="vs" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" aria-hidden="true">' + inner + "</svg>";
  }
  function pomegranate() {
    return art(120,
      '<circle cx="60" cy="68" r="44" fill="#D32F2F"/>' +
      '<path d="M60 112 a44 44 0 0 0 40 -26 a44 44 0 0 1 -80 0 a44 44 0 0 0 40 26 z" fill="#B71C1C" opacity=".55"/>' +
      '<ellipse cx="45" cy="52" rx="11" ry="16" fill="#FFFFFF" opacity=".28" transform="rotate(-22 45 52)"/>' +
      '<path d="M60 26 q-11 -11 -24 -9 q7 11 24 9 z" fill="#43A047"/>' +
      '<path d="M60 26 q11 -11 24 -9 q-7 11 -24 9 z" fill="#2E7D32"/>' +
      '<path d="M52 28 l3 -15 l5 8 l5 -8 l3 15 z" fill="#8E1010"/>'
    );
  }

  /* ================= التجميع ================= */
  var SEDAN = { body: "#E53935", dark: "#C62828", glass: "#B3E5FC" };
  var PICK = { body: "#1E88E5", dark: "#1565C0", glass: "#B3E5FC" };
  var VANC = { body: "#F5F5F5", dark: "#CFD8DC", glass: "#B3E5FC" };

  var KINDS = {
    sedan: function () { return sedan(SEDAN); },
    taxi: taxi,
    van: function () { return van(VANC); },
    bluevan: function () { return van({ body: "#42A5F5", dark: "#1E88E5", glass: "#E1F5FE" }); },
    truck: function () { return truck({ body: "#66BB6A", dark: "#2E7D32" }); },
    bus: bus,
    racer: racer,
    fire: fire,
    ambulance: ambulance,
    pickup: function () { return pickup(PICK); },
    pickupGreen: function () { return pickup({ body: "#26A69A", dark: "#00897B", glass: "#B2DFDB" }); },
    mixer: mixer,
    carrier: carrier,
    bike: bike,
    rocket: rocket,
    plane: plane,
    heli: heli,
    sub: sub
  };

  /* عربيات الطريق: للعبة الحروف والأرقام */
  var ROAD = ["sedan", "taxi", "bluevan", "truck", "bus", "racer", "pickup", "pickupGreen",
              "van", "ambulance", "fire", "mixer"];

  /* المركبة الخاصة بكلمة الحرف (ب=بطة ليست مركبة، لكن دراجة/صاروخ/طائرة/مروحية/غواصة كذلك) */
  var WORD_VEHICLE = {
    "دَرّاجَة": "bike",
    "صَارُوخ": "rocket",
    "طائِرَة": "plane",
    "مِروحِيّة": "heli",
    "غَوّاصَة": "sub"
  };

  /* كلمات لها رسم خاص (لا يوجد لها إيموجي دقيق) */
  var WORD_ART = { "رُمّان": pomegranate };

  return {
    /* رسم أي مركبة بالاسم */
    svg: function (name) { return (KINDS[name] || KINDS.sedan)(); },
    /* رسم مركبة الطريق رقم i (ثابت لكل حرف/رقم حتى لا يتغير الشكل كل مرة) */
    road: function (i) { return this.svg(ROAD[((i % ROAD.length) + ROAD.length) % ROAD.length]); },
    roadName: function (i) { return ROAD[((i % ROAD.length) + ROAD.length) % ROAD.length]; },
    roadCount: ROAD.length,
    /* مركبة كلمة الحرف، أو null لو الكلمة مش مركبة */
    forWord: function (w) { return WORD_VEHICLE[w] ? this.svg(WORD_VEHICLE[w]) : null; },
    hasWordVehicle: function (w) { return !!WORD_VEHICLE[w]; },
    /* رسم خاص لكلمة ليس لها إيموجي مناسب */
    wordArt: function (w) { return WORD_ART[w] ? WORD_ART[w]() : null; },
    names: Object.keys(KINDS)
  };
})();
