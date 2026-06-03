const fs = require("fs");
const path = require("path");

function loadSchema() {
  return JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "repo-memory-schema.json"),
      "utf8"
    )
  );
}

module.exports = { loadSchema };
