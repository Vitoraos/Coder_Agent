const { selectFields } = require("./intent-router");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function buildContext(query) {
  const fields = selectFields(query);

  const { data } = await supabase.from("repo_index").select("*");

  const filtered = data.map(row => {
    const d = row.data;

    const result = {
      path: row.path,
      sha: row.sha,
      context: {}
    };

    for (const f of fields) {
      result.context[f] = d[f];
    }

    return result;
  });

  return {
    query,
    fieldsUsed: fields,
    results: filtered
  };
}

module.exports = { buildContext };
