const axios = require("axios");
const { Project, SyntaxKind } = require("ts-morph");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const GITHUB_TOKEN = process.env.PAT_TOKEN;
const REPO = process.env.CODER_REPOSITORY;

/* -----------------------------
   SUPABASE CLIENT (safe)
------------------------------ */
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: { enabled: false },
});

/* -----------------------------
   SAFE SERIALIZER (FIX)
------------------------------ */
function sanitize(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/* -----------------------------
   1. GET DEFAULT BRANCH
------------------------------ */
async function getDefaultBranch() {
  const res = await axios.get(
    `https://api.github.com/repos/${REPO}`,
    {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
      },
    }
  );

  return res.data.default_branch;
}

/* -----------------------------
   2. GET FILE TREE
------------------------------ */
async function getRepoFiles() {
  const branch = await getDefaultBranch();

  const url = `https://api.github.com/repos/${REPO}/git/trees/${branch}?recursive=1`;

  const res = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
    },
  });

  return res.data.tree.filter(f => f.type === "blob");
}

/* -----------------------------
   3. FETCH FILE CONTENT
------------------------------ */
async function getFile(path) {
  const branch = await getDefaultBranch();

  const url = `https://raw.githubusercontent.com/${REPO}/${branch}/${path}`;
  const res = await axios.get(url);

  return res.data;
}

/* -----------------------------
   4. AST ANALYSIS
------------------------------ */
function analyze(filePath, code) {
  const project = new Project({
    useInMemoryFileSystem: true,
  });

  const source = project.createSourceFile(filePath, code);

  const imports = source.getImportDeclarations().map(i =>
    i.getModuleSpecifierValue()
  );

  const functions = source.getFunctions().map(fn => {
    const name = fn.getName() || "anonymous";

    const calls = fn
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .map(c => c.getExpression().getText());

    return { name, calls };
  });

  const exports = Array.from(source.getExportedDeclarations().keys());

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
    exports,
    routes,
  };
}

/* -----------------------------
   5. MAIN INDEXER
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

    let code;
    try {
      code = await getFile(path);
    } catch (err) {
      console.log("Failed fetching:", path);
      continue;
    }

    let data;
    try {
      data = analyze(path, code);
    } catch (err) {
      console.log("Failed parsing:", path);
      continue;
    }

    /* -----------------------------
       🔥 FIXED UPLOAD (IMPORTANT)
    ------------------------------ */
    await supabase.from("repo_index").upsert({
      path,
      sha,
      data: sanitize(data),
      updated_at: new Date().toISOString(),
    });
  }

  console.log("Baseline index complete");
}

run();
