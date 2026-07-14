const fs = require("fs");
const Module = require("module");

const originalLoader = Module._extensions[".js"];

Module._extensions[".css"] = function loadCssAsEmptyModule(module, filename) {
  module._compile("module.exports = {};", filename);
};

Module._extensions[".js"] = function loadWithResolveWeak(module, filename) {
  if (filename.endsWith("/build/__server/server.bundle.js")) {
    for (let attempt = 0; attempt < 50 && !fs.existsSync(filename); attempt += 1) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
    const source = fs.readFileSync(filename, "utf8").replace(/require\.resolveWeak\([^)]*\)/g, "0");
    module._compile(source, filename);
    return;
  }

  originalLoader(module, filename);
};
