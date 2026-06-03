function selectFields(query) {
  const q = query.toLowerCase();

  const fields = [];

  if (q.includes("import") || q.includes("dependency")) {
    fields.push("imports");
  }

  if (q.includes("call") || q.includes("flow") || q.includes("trigger")) {
    fields.push("functions");
  }

  if (q.includes("route") || q.includes("api") || q.includes("endpoint")) {
    fields.push("routes");
  }

  if (q.includes("export") || q.includes("public")) {
    fields.push("exports");
  }

  if (fields.length === 0) {
    return ["functions", "imports", "exports"];
  }

  return [...new Set(fields)];
}

module.exports = { selectFields };
