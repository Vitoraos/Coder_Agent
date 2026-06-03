const axios = require("axios");
const { Project } = require("ts-morph");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const GITHUB_TOKEN = process.env.PAT_TOKEN;
const REPO = process.env.CODER_REPOSITORY;

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY,
  {
    realtime: {
      enabled: false,
    },
  }
);

/* -----------------------------
   1. GET FILE TREE (GitHub API)
------------------------------ */

async function getRepoFiles() {
  const url = `https://api.github.com/repos/${REPO}/git/trees/main?recursive=1`;

  const res = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
    },
  });

  return res.data.tree.filter(f => f.type === "blob");
}

/* -----------------------------
   2. FETCH RAW FILE CONTENT
------------------------------ */

async function getFile(path) {
  const url = `https://raw.githubusercontent.com/${REPO}/main/${path}`;
  const res = await axios.get(url);
  return res.data;
}

/* -----------------------------
   3. AST ANALYSIS (single pass)
------------------------------ */

function analyze(filePath, code) {
  const project = new Project({
    useInMemoryFileSystem: true,
  });

  const source = project.createSourceFile(filePath, code);

  // imports
  const imports = source.getImportDeclarations().map(i =>
    i.getModuleSpecifierValue()
  );

  // functions + calls
  const functions = source.getFunctions().map(fn => {
    const name = fn.getName() || "anonymous";

    const calls = fn.getDescendantsOfKind(230) // CallExpression
      .map(c => c.getExpression().getText());

    return { name, calls };
  });

  // exports
  const exports = source.getExportedDeclarations();
  const exportNames = Array.from(exports.keys());

  // naive route detection (Express-style)
  const routes = [];

  const text = source.getFullText();
  const routeRegex = /(get|post|put|delete)\(["'`](.*?)["'`]/g;

  let match;
  while ((match = routeRegex.exec(text)) !== null) {
    routes.push({
      method: match[1].toUpperCase(),
      path: match[2],
    });
  }

  return {
    imports,
    functions,
    exports: exportNames,
    routes,
  };
}

/* -----------------------------
   4. MAIN INDEXER
------------------------------ */

async function run() {
  console.log("Starting baseline index...");

  const files = await getRepoFiles();

  const tsFiles = files.filter(f =>
    f.path.endsWith(".ts") || f.path.endsWith(".tsx")
  );

  console.log(`Found ${tsFiles.length} TS files`);

  for (const file of tsFiles) {
    const path = file.path;
    const sha = file.sha;

    console.log("Indexing:", path);

    const code = await getFile(path);

    let data;
    try {
      data = analyze(path, code);
    } catch (err) {
      console.log("Failed parsing:", path);
      continue;
    }

    await supabase.from("repo_index").upsert({
      path,
      sha,
      data,
      updated_at: new Date().toISOString(),
    });
  }

  console.log("Baseline index complete");
}

run();
