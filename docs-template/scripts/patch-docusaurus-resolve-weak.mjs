import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const codegenPath = require.resolve("@docusaurus/core/lib/server/codegen/codegenRoutes.js");
const source = fs.readFileSync(codegenPath, "utf8");
const patched = source
  .replace(/require\.resolveWeak\("\$\{modulePath\}"\)/g, "0")
  .replace(/require\.resolve\("\$\{modulePath\}"\)/g, "0");

if (patched !== source) {
  fs.writeFileSync(codegenPath, patched);
}

const ssgRequirePath = require.resolve("@docusaurus/core/lib/ssg/ssgNodeRequire.js");
const ssgSource = fs.readFileSync(ssgRequirePath, "utf8");
const ssgPatched = ssgSource
  .replace(
    "const module = realRequire(id);\n        allRequiredIds.push(id);\n        return module;",
    "if (typeof id === 'string' && (id.endsWith('.css') || id === '@theme/prism-include-languages' || id.includes('prism-include-languages'))) {\n            allRequiredIds.push(id);\n            return {};\n        }\n        const module = realRequire(id);\n        allRequiredIds.push(id);\n        return module;",
  )
  .replace(
    "ssgRequireFunction.resolve = realRequire.resolve;",
    "ssgRequireFunction.resolve = realRequire.resolve;\n    ssgRequireFunction.resolveWeak = () => 0;",
  );

if (ssgPatched !== ssgSource) {
  fs.writeFileSync(ssgRequirePath, ssgPatched);
}
