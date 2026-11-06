import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../public/js/app.js", import.meta.url), "utf8");

function extract(name, nextName) {
  const start = source.indexOf(`function ${name}`);
  const end = source.indexOf(`function ${nextName}`, start);
  if (start < 0 || end < 0) throw new Error(`missing ${name} or ${nextName}`);
  return source.slice(start, end);
}

const fn = new Function(`${extract("scaleQuantityText", "renderModalContent")}\n${extract("extractStepDuration", "formatTime")}\nreturn { scaleQuantityText, extractStepDuration };`);
const { scaleQuantityText, extractStepDuration } = fn();

assert.equal(scaleQuantityText("200g chicken sausages", 1), "200g chicken sausages");
assert.equal(scaleQuantityText("200g chicken sausages", 2), "400 g chicken sausages");
assert.equal(scaleQuantityText("1/2 tsp salt", 2), "1 tsp salt");
assert.equal(scaleQuantityText("50ml milk", 0.5), "25 ml milk");
assert.equal(extractStepDuration("Bake for 18-20 minutes or until set."), 19 * 60);
assert.equal(extractStepDuration("Cook for 10 minutes."), 600);
assert.equal(extractStepDuration("Rest for 30 seconds."), 30);
assert.equal(extractStepDuration("Serve warm."), null);

console.log("scale and timer unit checks passed");
