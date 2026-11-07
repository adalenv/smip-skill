const http = require('http');

function cdpEval(code) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ code: `(() => { try { ${code} } catch(e) { return "ERROR: " + e.stack; } })()` });
    const req = http.request('http://127.0.0.1:8321/eval', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data).result));
    });
    req.write(postData);
    req.end();
  });
}

async function main() {
  const res = await cdpEval(`
    return (async () => {
      const root = JSON.parse(localStorage.getItem("persist:root"));
      const ay = JSON.parse(root.academicYear);
      const targetYear = ay.all.find(y => y.academic_year === "2025-2026");
      if (!targetYear) return "Target year 2025-2026 not found";
      
      ay.selected = targetYear;
      root.academicYear = JSON.stringify(ay);
      localStorage.setItem("persist:root", JSON.stringify(root));
      
      setTimeout(() => {
        window.location.href = "https://smip.al/teacher/registry?tab=trimester-register";
      }, 200);
      
      return { switched: true, year: targetYear.academic_year, id: targetYear.id };
    })();
  `);
  console.log("Switch result:", res);
}

main().catch(console.error);
