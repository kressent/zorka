// Проверка, что статический сервер отдаёт файлы с верным Content-Type.
import assert from 'node:assert';
const { server } = await import('../tools/serve.js');   // поднимает сервер на :8080
await new Promise(r => setTimeout(r, 400));

const base = 'http://localhost:8080';
const cases = [['/','text/html'],['/js/app.js','javascript'],['/js/score.js','javascript'],
  ['/css/style.css','text/css'],['/manifest.webmanifest','manifest'],['/icons/icon-192.png','image/png']];

let ok = 0;
for (const [path, mime] of cases) {
  const r = await fetch(base + path);
  assert.ok(r.ok, path + ' → ' + r.status);
  const ct = r.headers.get('content-type') || '';
  assert.ok(ct.includes(mime), path + ' MIME=' + ct);
  console.log('  ✓', path, r.status, ct);
  ok++;
}
console.log('\n' + ok + '/' + cases.length + ' файлов отдаются корректно\n');
server.close(() => process.exit(0));
