const http = require("http");

let server;

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  const base = { hostname: "localhost", port: 5000 };
  let token = "";
  let passed = 0;
  let failed = 0;

  function log(name, ok, msg) {
    const icon = ok ? "✅" : "❌";
    console.log(`${icon} ${name}${msg ? ` - ${msg}` : ""}`);
    ok ? passed++ : failed++;
  }

  // 1. Health check
  try {
    const r = await request({ ...base, path: "/", method: "GET" });
    log("GET /", r.status === 200, `HTTP ${r.status}`);
  } catch (e) {
    log("GET /", false, e.message);
  }

  // 2. Register (may already exist - 409 is ok)
  try {
    const r = await request(
      { ...base, path: "/api/auth/register", method: "POST", headers: { "Content-Type": "application/json" } },
      { name: "Test Admin", email: "test@test.com", password: "test" }
    );
    const ok = r.status === 201 || r.status === 409;
    log("POST /api/auth/register", ok, `HTTP ${r.status} - ${r.body.message}`);
  } catch (e) {
    log("POST /api/auth/register", false, e.message);
  }

  // 3. Login
  try {
    const r = await request(
      { ...base, path: "/api/auth/login", method: "POST", headers: { "Content-Type": "application/json" } },
      { email: "test@test.com", password: "test" }
    );
    const ok = r.status === 200 && r.body.token;
    token = r.body.token || "";
    log("POST /api/auth/login", ok, `HTTP ${r.status} - ${r.body.message}`);
  } catch (e) {
    log("POST /api/auth/login", false, e.message);
  }

  // 4. Profile (protected)
  try {
    const r = await request(
      { ...base, path: "/api/auth/me", method: "GET", headers: { Authorization: `Bearer ${token}` } }
    );
    log("GET /api/auth/me", r.status === 200, `HTTP ${r.status} - user: ${r.body.user?.email}`);
  } catch (e) {
    log("GET /api/auth/me", false, e.message);
  }

  // 5. Get Categories
  try {
    const r = await request({ ...base, path: "/api/categories", method: "GET" });
    const ok = r.status === 200 && Array.isArray(r.body.data);
    log("GET /api/categories", ok, `HTTP ${r.status} - ${r.body.data?.length} categories`);
  } catch (e) {
    log("GET /api/categories", false, e.message);
  }

  // 6. Get Gemstones
  try {
    const r = await request({ ...base, path: "/api/gemstones", method: "GET" });
    const ok = r.status === 200 && Array.isArray(r.body.data);
    log("GET /api/gemstones", ok, `HTTP ${r.status} - ${r.body.data?.length} gemstones`);
  } catch (e) {
    log("GET /api/gemstones", false, e.message);
  }

  // 7. Create Gemstone
  try {
    const r = await request(
      { ...base, path: "/api/gemstones", method: "POST", headers: { "Content-Type": "application/json" } },
      { category_id: 1, name: "Test Ruby", color: "Red", carat: 2.1, price: 1200, stock: 1, status: 1 }
    );
    const ok = r.status === 201;
    log("POST /api/gemstones", ok, `HTTP ${r.status} - ${r.body.message}`);
  } catch (e) {
    log("POST /api/gemstones", false, e.message);
  }

  // 8. 404 handler
  try {
    const r = await request({ ...base, path: "/nonexistent", method: "GET" });
    log("GET /nonexistent (404)", r.status === 404, `HTTP ${r.status} - ${r.body.message}`);
  } catch (e) {
    log("GET /nonexistent (404)", false, e.message);
  }

  console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
}

runTests().catch(console.error);
