const http = require('http');

function cdpEval(code) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ code });
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
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  const res = await cdpEval(`(() => {
    const table = document.querySelector('table');
    if (!table) return 'no table';
    
    // Gjej ku eshte teksti "Klasa"
    const allDivs = Array.from(document.querySelectorAll('div, label, span'));
    const klasaEl = allDivs.find(d => d.textContent.trim() === 'Klasa' && d.children.length === 0);
    
    let cur = table;
    const path = [];
    while (cur && cur !== document.body) {
      const containsKlasa = klasaEl ? cur.contains(klasaEl) : false;
      path.push({
        tag: cur.tagName,
        id: cur.id,
        className: (cur.className || '').slice(0, 40),
        containsKlasa,
        w: cur.offsetWidth,
        h: cur.offsetHeight,
        top: cur.getBoundingClientRect().top
      });
      cur = cur.parentElement;
    }
    return { klasaFound: !!klasaEl, path };
  })()`);
  console.log(JSON.stringify(res, null, 2));
}

main().catch(console.error);
