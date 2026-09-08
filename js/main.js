/* =========================================================
   深蓝智养 · 深海玻璃拟态官网 —— 交互脚本（js/main.js）
   本地、无外部依赖；只做界面增强，不改变页面文字。
   ========================================================= */
(function () {
  'use strict';

  var doc = document.documentElement;
  // 标记「JS 可用」：css 里 .js .reveal 才会隐藏等入场，无 JS 时卡片直接可见
  doc.classList.add('js');

  // 1. 吸顶导航：滚动超过阈值加深（配合 .site-nav.is-scrolled）
  var nav = document.querySelector('.site-nav');
  function onScroll() {
    if (nav) nav.classList.toggle('is-scrolled', window.scrollY > 10);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // 占位链接（如菜单“关于我们/联系我们”，正文后续再挂）点击不跳转
  var placeholders = document.querySelectorAll('a[href="#"]');
  placeholders.forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); });
  });

  // 2. 卡片入场：进入视口后加 .in（触发上浮淡入）
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target); // 只播一次
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    // 兜底：老浏览器直接显示
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }
})();

/* =========================================================
   3. 首屏深海浮光粒子（canvas 装饰层）
   - 青白/淡蓝色微光点上浮 + 左右轻漂，呼吸式明暗
   - 跟随系统“减弱动效”偏好自动跳过
   ========================================================= */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce && reduce.matches) return;

  var cv = document.querySelector('.fx-particles');
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');

  var W = 0, H = 0, pts = [], raf = 0, last = 0;
  var PAL = [[255,255,255],[170,232,255],[128,222,255],[150,192,255]];

  function size() {
    W = cv.width  = cv.offsetWidth  || 0;
    H = cv.height = cv.offsetHeight || 0;
  }
  function make() {
    var n = Math.min(110, Math.max(36, (W * H) / 24000 | 0));
    pts = [];
    for (var i = 0; i < n; i++) {
      var c = (i % 5 === 0) ? PAL[3] : ((i % 2 === 0) ? PAL[0] : PAL[1]); // 白/青为主，偶带淡蓝
      pts.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 0.7 + Math.random() * 1.8,        // 0.7 ~ 2.5px 光点
        vy: 0.10 + Math.random() * 0.34,     // 上浮速度
        drift: 0.2 + Math.random() * 0.5,    // 左右漂移幅度
        ph: Math.random() * 6.283,
        tw: 0.0009 + Math.random() * 0.0025, // 呼吸频率
        col: c,
        a0: 0.16 + Math.random() * 0.5       // 基准透明度
      });
    }
  }
  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (!last) last = now;
    var dt = Math.min(50, now - last) / 16.7;
    last = now;

    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      p.y -= p.vy * dt;
      p.x += Math.sin(now * 0.00012 + p.ph) * p.drift * dt * 0.6;
      if (p.y < -8) { p.y = H + 8; p.x = Math.random() * W; }
      if (p.x < -8) p.x = W + 8; else if (p.x > W + 8) p.x = -8;

      var a = p.a0 * (0.7 + 0.3 * Math.sin(now * p.tw + p.ph));
      ctx.beginPath();
      ctx.fillStyle = 'rgba(' + p.col[0] + ',' + p.col[1] + ',' + p.col[2] + ',' + a.toFixed(3) + ')';
      ctx.arc(p.x, p.y, p.r, 0, 6.2832);
      ctx.fill();
    }
  }
  function boot() {
    size();
    make();
    cancelAnimationFrame(raf);
    last = 0;
    raf = requestAnimationFrame(tick);
  }
  window.addEventListener('resize', boot, { passive: true });
  boot();
})();

/* =========================================================
   4. 正文长卷深海浮游光点（.fx-deep 装饰画布）
   - 青蓝/淡白光点浮满整幅长卷，随页面滚动：暗色海沟里最显眼，
     顶部亮海面几乎隐没，营造深海中微生物/浮游光点的氛围
   - 光点密度按「每屏可见量」折算到全卷，避免高长卷上粒子爆炸
   - 画布内部分辨率封顶(宽 1400px)，长卷极高也不吃内存
   - 跟随系统“减弱动效”偏好自动跳过
   ========================================================= */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce && reduce.matches) return;

  var cv = document.querySelector('.fx-deep');
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');
  var roll = cv.parentElement; // .sea-roll：宽高即长卷范围

  var W = 0, H = 0, pts = [], raf = 0, last = 0;
  var PAL = [[255,255,255],[176,236,255],[128,222,255],[110,200,255],[82,178,255]];

  function size() {
    // 内部分辨率：宽封顶 1400（超出则 CSS 放大显示），高按长卷同比例，控制开销
    var cw = roll.offsetWidth || 1, ch = roll.offsetHeight || 1;
    var s = Math.min(1, 1400 / cw);
    W = cv.width  = Math.max(8, Math.round(cw * s));
    H = cv.height = Math.max(8, Math.round(ch * s));
  }
  function make() {
    // 目标：任何一屏视口内平均约 46 颗；折算成全卷数量再夹紧
    var rollH = roll.offsetHeight || 1;
    var vh = window.innerHeight || 600;
    var frac = Math.min(1, vh / rollH);          // 视口约占长卷比例
    var n = Math.min(850, Math.max(90, Math.round(46 / frac)));
    var rk = W / (roll.offsetWidth || 1);        // 半径换算系数：保持屏幕上的实际大小
    pts = [];
    for (var i = 0; i < n; i++) {
      var big = (i % 13 === 0);                  // 少量大光点做景深
      var c = (i % 7 === 0) ? PAL[4] : ((i % 3 === 0) ? PAL[1] : ((i % 2 === 0) ? PAL[0] : PAL[2]));
      pts.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r:  (big ? (1.9 + Math.random() * 2.1) : (0.7 + Math.random() * 1.6)) * rk,
        vy: 0.06 + Math.random() * 0.30,          // 上浮速度
        drift: 0.15 + Math.random() * 0.5,        // 左右漂移幅度
        ph: Math.random() * 6.283,
        tw: 0.0008 + Math.random() * 0.0022,      // 呼吸频率
        col: c,
        big: big,
        a0:  big ? (0.10 + Math.random() * 0.14) : (0.12 + Math.random() * 0.42)
      });
    }
  }
  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (!last) last = now;
    var dt = Math.min(50, now - last) / 16.7;
    last = now;

    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      p.y -= p.vy * dt;
      p.x += Math.sin(now * 0.00010 + p.ph) * p.drift * dt * 0.5;
      if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
      if (p.x < -8) p.x = W + 8; else if (p.x > W + 8) p.x = -8;

      var a = p.a0 * (0.65 + 0.35 * Math.sin(now * p.tw + p.ph));
      var rgb = p.col[0] + ',' + p.col[1] + ',' + p.col[2];
      // 外层一圈淡光晕（更柔和的深海感），大光点再加一圈更淡的辉光
      ctx.fillStyle = 'rgba(' + rgb + ',' + (a * 0.10).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3.1, 0, 6.2832); ctx.fill();
      if (p.big) {
        ctx.fillStyle = 'rgba(' + rgb + ',' + (a * 0.05).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 6, 0, 6.2832); ctx.fill();
      }
      ctx.fillStyle = 'rgba(' + rgb + ',' + a.toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
    }
  }
  function boot() {
    size();
    make();
    cancelAnimationFrame(raf);
    last = 0;
    raf = requestAnimationFrame(tick);
  }
  window.addEventListener('resize', boot, { passive: true });
  boot();
})();
