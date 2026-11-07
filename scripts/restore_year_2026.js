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
      res.on('end', () => {
        try {
          resolve(JSON.parse(data).result);
        } catch (e) {
          reject(e);
        }
      });
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
      const targetYear = ay.academicYears.find(y => y.name.includes("2026-2027"));
      if (!targetYear) return "Target year 2026-2027 not found";
      
      ay.selected = targetYear.id;
      root.academicYear = JSON.stringify(ay);
      localStorage.setItem("persist:root", JSON.stringify(root));
      
      setTimeout(() => {
        window.location.href = "https://smip.al/teacher/registry?tab=student-grades";
      }, 200);
      
      return { restored: true, year: targetYear.name, id: targetYear.id };
    })();
  `);
  console.log("Restore result:", res);
}

main().catch(console.error);
