const fs = require('fs');

function validate(content){
  if(typeof content !== 'string' || !content.trim()) return { ok:false, error:'empty content' };
  const doctypeIdx = content.search(/<!doctype html>/i);
  if(doctypeIdx < 0) return { ok:false, error:'missing <!DOCTYPE html>' };
  const beforeDoctype = content.slice(0, doctypeIdx).replace(/<!--[\s\S]*?-->/g, '').trim();
  if(beforeDoctype.length) return { ok:false, error:'unexpected code/text before <!DOCTYPE html>' };
  if(!/<\/html>\s*$/i.test(content)) return { ok:false, error:'missing closing </html>' };
  const lockedViewChecks = [
    [/skin1:Object\.freeze\(\{id:['"]three-pane-puzzle-v1['"],panelCount:3,/, 'View 1 three-panel skin'],
    [/for\s*\(const key of \[(['"])skin1\1,\s*(['"])skin2\2,\s*(['"])skin3\3\]\)/, 'View 1/2/3 controls'],
    [/responsiveCards=\[[^\n]{0,300}?\.slice\(0,\s*skin\.panelCount\)/, 'skin-controlled panel count'],
    [/id=['"]builders-preview-skin-switch['"][\s\S]{0,5000}data-omp-skin="skin1"[\s\S]{0,500}?grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/, 'three-panel View 1 layout styles']
  ];
  for(const [pattern,label] of lockedViewChecks){
    if(!pattern.test(content)) return { ok:false, error:`locked OMP View 1/2/3 layout missing: ${label}` };
  }
  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m, scriptCount = 0;
  while((m = scriptRe.exec(content))){
    scriptCount++;
    const attrs = m[1] || '';
    const code = m[2] || '';
    if(/type\s*=\s*["']module["']/i.test(attrs)) continue;
    try { new Function(code); } catch(e){
      return { ok:false, error:`script ${scriptCount} syntax error: ${e.message}` };
    }
  }
  return { ok:true, scripts: scriptCount };
}

for(const file of process.argv.slice(2)){
  const r = validate(fs.readFileSync(file, 'utf8'));
  console.log(file, JSON.stringify(r));
  if(!r.ok) process.exitCode = 1;
}
