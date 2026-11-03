/* Gặp wordmark intro authored in EffectCraft. Transparent 300x120, 60 fps, 2.2 seconds. */
var comp = app.run("comp.new", {
  name: "Gặp Wordmark",
  width: 300,
  height: 120,
  frameRate: 60,
  duration: 2.2
}).comp;

function addKey(layer, path, time, value) {
  app.run("prop.addKey", { layer: layer, path: path, time: time, timeBase: "comp", value: value });
}
function ease(layer, path, times, spatial) {
  app.run("keys.select", {
    timeBase: "comp",
    keys: times.map(function (time) { return { layer: layer, prop: path, time: time }; })
  });
  app.run("keys.interpolation", {
    interpolation: "bezier",
    autoBezier: true,
    spatial: spatial ? "autoBezier" : "linear"
  });
}

var word = app.run("layer.newText", {
  comp: comp,
  text: "gặp",
  name: "Wordmark — gặp (Baloo 2 ExtraBold, converted to shapes on export)",
  position: [150, 69],
  font: "Baloo 2",
  style: "ExtraBold",
  size: 76,
  fill: "#C34D40",
  justify: "center",
  ligatures: true,
  contextualAlternates: true
}).layer;

/* Full word holds, then converges to its center and is gone before logo drawing starts. */
addKey(word, "transform/scale", 0, [100, 100, 100]);
addKey(word, "transform/scale", 0.75, [100, 100, 100]);
addKey(word, "transform/scale", 1.1, [0, 0, 100]);
ease(word, "transform/scale", [0, 0.75, 1.1], false);

/* Exact two-loop brand geometry, transparent background, separate editable vectors. */
var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="108" height="108" viewBox="0 0 108 108">' +
  '<g fill="none" stroke-width="6" stroke-linecap="round">' +
  '<path stroke="#38263D" d="M50 40C43 28 33 26 26 32C15 41 18 62 28 70C38 78 49 67 52 56"/>' +
  '<path stroke="#C34D40" d="M58 40C65 28 75 26 82 32C93 41 90 62 80 70C70 78 59 67 56 56"/>' +
  '</g><circle cx="54" cy="25" r="4" fill="#C34D40"/></svg>';
var mark = app.run("edit.pasteSvg", {
  comp: comp,
  svg: svg,
  name: "Logo — two inward loops and coral diacritic"
}).layer;

var coralTrim = app.run("layer.addShapeItem", {
  layer: mark,
  kind: "trim",
  group: "contents/group#2/contents/group"
}).path;
var plumTrim = app.run("layer.addShapeItem", {
  layer: mark,
  kind: "trim",
  group: "contents/group#2/contents/group#2"
}).path;

/* The two strokes write on after the word clears (one-frame separation), then the dot lands. */
var coralStart = 67 / 60;
var coralFinish = 106 / 60;
var plumStart = 71 / 60;
var plumFinish = 110 / 60;
addKey(mark, coralTrim + "/end", 0, 0);
addKey(mark, coralTrim + "/end", coralStart, 0);
addKey(mark, coralTrim + "/end", coralFinish, 100);
ease(mark, coralTrim + "/end", [0, coralStart, coralFinish], false);
addKey(mark, plumTrim + "/end", 0, 0);
addKey(mark, plumTrim + "/end", plumStart, 0);
addKey(mark, plumTrim + "/end", plumFinish, 100);
ease(mark, plumTrim + "/end", [0, plumStart, plumFinish], false);
var dotOpacity = "contents/group/contents/fill/opacity";
addKey(mark, dotOpacity, 0, 0);
addKey(mark, dotOpacity, 111 / 60, 0);
addKey(mark, dotOpacity, 117 / 60, 100);
ease(mark, dotOpacity, [0, 111 / 60, 117 / 60], false);

writeLn(JSON.stringify({comp: comp, word: word, mark: mark, coralTrim: coralTrim, plumTrim: plumTrim}));
var exported = app.run("file.exportLottie", {
  comp: comp,
  path: "apps/mobile/assets/brand/gap-wordmark.json",
  includeExpressions: false,
  textAsShapes: true
});
writeLn("Lottie: " + JSON.stringify(exported));
