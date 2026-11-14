// A small linear model that learns how much each CPI group moves the all-items rate.
// Works in the browser (window.GaugeModel) and in Node tests.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GaugeModel = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Twelve-month percent change for each month that has a value 12 months earlier.
  function yoySeries(index) {
    const out = [];
    for (let t = 12; t < index.length; t++) out.push((index[t] / index[t - 12] - 1) * 100);
    return out;
  }

  // Solve A x = b by Gaussian elimination with partial pivoting.
  function solve(A, b) {
    const n = b.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      if (Math.abs(M[c][c]) < 1e-12) throw new Error("singular system");
      for (let r = c + 1; r < n; r++) {
        const f = M[r][c] / M[c][c];
        for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
      }
    }
    const x = new Array(n).fill(0);
    for (let r = n - 1; r >= 0; r--) {
      let s = M[r][n];
      for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
      x[r] = s / M[r][r];
    }
    return x;
  }

  // Ridge regression with no intercept: minimise |Xw - y|^2 + lambda |w|^2.
  function fitRidge(X, y, lambda) {
    const k = X[0].length;
    const A = Array.from({ length: k }, () => new Array(k).fill(0));
    const b = new Array(k).fill(0);
    for (let t = 0; t < X.length; t++) {
      for (let i = 0; i < k; i++) {
        b[i] += X[t][i] * y[t];
        for (let j = 0; j < k; j++) A[i][j] += X[t][i] * X[t][j];
      }
    }
    for (let i = 0; i < k; i++) A[i][i] += lambda;
    return solve(A, b);
  }

  function predict(X, w) {
    return X.map((row) => row.reduce((s, v, i) => s + v * w[i], 0));
  }

  function mae(a, b) {
    return a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;
  }

  // Train on all but the last `holdout` months, then score on those months.
  function learnWeights(history, categoryIds, opts = {}) {
    const lambda = opts.lambda ?? 1;
    const holdout = opts.holdout ?? 12;
    const y = yoySeries(history.series["All-items"].index);
    const cols = categoryIds.map((id) => yoySeries(history.series[id].index));
    const X = y.map((_, t) => cols.map((c) => c[t]));
    const months = history.months.slice(12);
    const n = y.length - holdout;
    const w = fitRidge(X.slice(0, n), y.slice(0, n), lambda);
    const testX = X.slice(n);
    const testY = y.slice(n);
    const pred = predict(testX, w);
    return {
      weights: w,
      trainMonths: [months[0], months[n - 1]],
      testMonths: [months[n], months[months.length - 1]],
      testMAE: mae(pred, testY),
      testPred: pred,
      testActual: testY
    };
  }

  return { yoySeries, solve, fitRidge, predict, mae, learnWeights };
});
