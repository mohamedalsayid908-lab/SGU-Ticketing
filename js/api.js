const SUPABASE_URL = "https://cwjzybnkgevwdimvxgvh.supabase.co/rest/v1/";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3anp5Ym5rZ2V2d2RpbXZ4Z3ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0ODE1ODQsImV4cCI6MjA5NDA1NzU4NH0.sZjvs-U9UNbekfX-VDMcF8cfFZHDP93fdGvzdjhu6n8";

const headers = {
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json"
};

async function getData(table, query="") {
  const res = await fetch(SUPABASE_URL + table + "?" + query, { headers });
  return await res.json();
}

async function insertData(table, data) {
  await fetch(SUPABASE_URL + table, {
    method: "POST",
    headers,
    body: JSON.stringify(data)
  });
}

async function updateData(table, query, data) {
  await fetch(SUPABASE_URL + table + "?" + query, {
    method: "PATCH",
    headers,
    body: JSON.stringify(data)
  });
}