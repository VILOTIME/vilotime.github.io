/* 双人足球半场夹取：只修正"贴中线抖动"这一个问题。
 *
 * 原游戏的移动被写在 if 分支里（只有在本方半场才允许移动），越过中线后
 * 只剩"每帧往回挤一点点"，所以会在中线来回蹭。这里不去改积木，而是每帧
 * 把两个角色夹回自己的半场（留 2 个单位余量，保证它们的"在本方半场"判断
 * 始终成立、移动不被禁用），从而消除抖动。
 *
 * 用法：在游戏页面末尾加 <script src="football-halves.js"></script>
 */
(function () {
  'use strict';
  if (window.__ycHalves) { return; }
  window.__ycHalves = true;

  var MID = 0;      /* 中线 */
  var MARGIN = 2;   /* 留在半场内的余量 */

  function findSprite(name) {
    var vm = window.vm;
    if (!vm || !vm.runtime || !vm.runtime.targets) { return null; }
    for (var i = 0; i < vm.runtime.targets.length; i++) {
      var t = vm.runtime.targets[i];
      if (t.sprite && t.sprite.name === name) { return t; }
    }
    return null;
  }

  var left = null;   /* 玩家：只能待在左半场 */
  var right = null;  /* 人机：只能待在右半场 */
  var stats = { leftClamps: 0, rightClamps: 0 };

  function tick() {
    if (!left) { left = findSprite('玩家'); }
    if (!right) { right = findSprite('人机'); }

    if (left && typeof left.x === 'number') {
      if (left.x > MID - MARGIN) { left.x = MID - MARGIN; stats.leftClamps++; }
    }
    if (right && typeof right.x === 'number') {
      if (right.x < MID + MARGIN) { right.x = MID + MARGIN; stats.rightClamps++; }
    }
  }

  var timer = setInterval(tick, 16);
  window.addEventListener('pagehide', function () { clearInterval(timer); });

  /* 调试接口 */
  window.__ycHalvesStats = function () { return JSON.parse(JSON.stringify(stats)); };
  window.__ycHalvesMid = function () { return { mid: MID, margin: MARGIN }; };
})();
