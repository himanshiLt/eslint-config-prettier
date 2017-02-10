"use strict";

const test = require("ava");
const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");
const rimraf = require("rimraf");
const pkg = require("../package.json");
const eslintConfig = require("../.eslintrc");
const eslintConfigBase = require("../.eslintrc.base");

const TEST_CONFIG_DIR = "test-config";

const ruleFiles = fs
  .readdirSync(".")
  .filter(name => !name.startsWith(".") && name.endsWith(".js"));
const configFiles = fs
  .readdirSync(".")
  .filter(name => name.startsWith(".eslintrc"));

createTestConfigDir();

function createTestConfigDir() {
  // Clear the test config dir.
  rimraf.sync(TEST_CONFIG_DIR);
  fs.mkdirSync(TEST_CONFIG_DIR);

  // Copy all rule files into the test config dir.
  ruleFiles.forEach(ruleFileName => {
    const config = require(`../${ruleFileName}`);

    // Change all rules to "warn", so that ESLint warns about unknown rules.
    Object.keys(config.rules).forEach(ruleName => {
      config.rules[ruleName] = "warn";
    });

    fs.writeFileSync(
      path.join(TEST_CONFIG_DIR, ruleFileName),
      `module.exports = ${JSON.stringify(config, null, 2)};`
    );
  });

  // Copy the ESLint configs into the test config dir.
  configFiles.forEach(configFileName => {
    fs.writeFileSync(
      path.join(TEST_CONFIG_DIR, configFileName),
      fs.readFileSync(configFileName)
    );
  });
}

test("All rule files are listed in package.json", t => {
  ruleFiles.forEach(ruleFileName => {
    t.true(pkg.files.indexOf(ruleFileName) >= 0);
  });
});

test("All rule files have tests in test-lint/", t => {
  ruleFiles.forEach(ruleFileName => {
    t.true(fs.existsSync(path.join("test-lint", ruleFileName)));
  });
});

test("All rule files are included in the ESLint config", t => {
  ruleFiles.forEach(ruleFileName => {
    const name = ruleFileName.replace(/\.js$/, "");
    t.true(eslintConfig.extends.indexOf(`./${ruleFileName}`) >= 0);
    if (ruleFileName !== "index.js") {
      t.true(eslintConfigBase.plugins.indexOf(name) >= 0);
    }
  });
});

test("All plugin rule files are mentioned in the README", t => {
  const readme = fs.readFileSync("README.md", "utf8");
  ruleFiles
    .filter(ruleFileName => ruleFileName !== "index.js")
    .forEach(ruleFileName => {
      const name = ruleFileName.replace(/\.js$/, "");
      t.true(readme.indexOf(`eslint-plugin-${name}`) >= 0);
      t.true(readme.indexOf(`"${name}"`) >= 0);
      t.true(readme.indexOf(`"prettier/${name}"`) >= 0);
    });
});

test("There are no unknown rules", t => {
  const result = childProcess.spawnSync(
    "npm",
    ["run", "test:lint-rules", "--silent"],
    { encoding: "utf8" }
  );
  const output = JSON.parse(result.stdout);
  const messages = output[0].messages.slice(0, 3);

  messages.forEach(message => {
    t.notRegex(message.message, /rule\s+'[^']+'.*not found/);
  });
});
