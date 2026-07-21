(() => {
  'use strict';

  const app = document.querySelector('#tool-app');
  const slug = document.body?.dataset.toolSlug;
  if (!app || !slug) return;

  const rootPath = document.body?.dataset.root || '';
  const q = (selector, scope = document) => scope.querySelector(selector);
  const qa = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const esc = window.escapeHtml || ((value = '') => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])));
  const setHtml = (content) => { app.innerHTML = content; };
  const status = (message, type = 'success', target = '#status') => window.showStatus?.(message, type, target);
  const track = (action = 'tool_use', params = {}) => window.trackAction?.(action, params);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const randomInt = (max) => {
    if (max <= 0) return 0;
    const maxUint = 0x100000000;
    const limit = maxUint - (maxUint % max);
    const a = new Uint32Array(1);
    do crypto.getRandomValues(a); while (a[0] >= limit);
    return a[0] % max;
  };
  const pageLang = document.body?.dataset.lang || 'pt';
  const pageLocale = pageLang === 'en' ? 'en-US' : pageLang === 'es' ? 'es-ES' : 'pt-BR';
  const formatNumber = (value, digits = 2) => new Intl.NumberFormat(pageLocale, { maximumFractionDigits: digits }).format(value);
  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };
  const downloadText = (text, filename, type = 'text/plain;charset=utf-8') => window.downloadText?.(text, filename, type);
  const bytesLabel = (bytes) => {
    const units = ['B','KB','MB','GB','TB']; let n = Number(bytes) || 0; let i = 0;
    while (n >= 1000 && i < units.length - 1) { n /= 1000; i++; }
    return `${n.toFixed(i ? 2 : 0)} ${units[i]}`;
  };
  const fileToBuffer = (file) => file.arrayBuffer();
  const canvasToBlob = (canvas, type = 'image/png', quality = 0.9) => new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Não foi possível gerar o arquivo.')), type, quality));
  const loadImageFile = (file) => new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) return reject(new Error('Selecione um arquivo de imagem válido.'));
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível abrir a imagem.')); };
    img.src = url;
  });
  const loadScript = (src, globalName) => new Promise((resolve, reject) => {
    if (globalName && window[globalName]) return resolve(window[globalName]);
    const existing = [...document.scripts].find((s) => s.src.endsWith(src.replace(rootPath, '')) || s.src === new URL(src, location.href).href);
    if (existing) {
      existing.addEventListener('load', () => resolve(globalName ? window[globalName] : true), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Falha ao carregar ${src}`)), { once: true });
      return;
    }
    const script = document.createElement('script'); script.src = src; script.defer = true;
    script.onload = () => resolve(globalName ? window[globalName] : true);
    script.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    document.head.appendChild(script);
  });
  const loadPdfLib = () => loadScript(`${rootPath}assets/vendor/pdf-lib.min.js`, 'PDFLib');
  const loadJsZip = () => loadScript(`${rootPath}assets/vendor/jszip.min.js`, 'JSZip');
  let pdfJsPromise;
  const loadPdfJs = () => {
    if (!pdfJsPromise) pdfJsPromise = import(`${rootPath}assets/vendor/pdfjs/pdf.min.mjs`).then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = `${rootPath}assets/vendor/pdfjs/pdf.worker.min.mjs`;
      return pdfjs;
    });
    return pdfJsPromise;
  };
  const parsePages = (value, total) => {
    const text = String(value || '').trim();
    if (!text || text.toLowerCase() === 'todas' || text.toLowerCase() === 'all') return Array.from({ length: total }, (_, i) => i);
    const set = new Set();
    text.split(',').forEach((part) => {
      const p = part.trim();
      if (/^\d+$/.test(p)) set.add(Number(p) - 1);
      else if (/^\d+\s*-\s*\d+$/.test(p)) {
        let [a,b] = p.split('-').map(Number); if (a > b) [a,b] = [b,a];
        for (let n = a; n <= b; n++) set.add(n - 1);
      }
    });
    const pages = [...set].filter((n) => n >= 0 && n < total).sort((a,b) => a - b);
    if (!pages.length) throw new Error('Informe páginas válidas, por exemplo: 1,3-5.');
    return pages;
  };
  const extractPdfText = async (file) => {
    const pdfjs = await loadPdfJs();
    const doc = await pdfjs.getDocument({ data: await fileToBuffer(file) }).promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i); const content = await page.getTextContent();
      const text = content.items.map((item) => item.str).join(' ').replace(/\s+/g, ' ').trim();
      pages.push(text);
    }
    return pages;
  };
  const parseCsv = (text, delimiter = ',') => {
    const rows = []; let row = []; let cell = ''; let quoted = false;
    const value = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    for (let i = 0; i < value.length; i++) {
      const c = value[i];
      if (c === '"') {
        if (quoted && value[i + 1] === '"') { cell += '"'; i++; }
        else quoted = !quoted;
      } else if (c === delimiter && !quoted) { row.push(cell); cell = ''; }
      else if (c === '\n' && !quoted) { row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    row.push(cell); if (row.some((v) => v !== '') || rows.length === 0) rows.push(row);
    return rows;
  };
  const csvCell = (value, delimiter = ',') => {
    const s = String(value ?? '');
    return /["\n\r]/.test(s) || s.includes(delimiter) ? `"${s.replaceAll('"','""')}"` : s;
  };
  const objectPathGet = (obj, path) => String(path || '').replace(/^\$\.?/, '').split('.').filter(Boolean).reduce((value, key) => value?.[key], obj);
  const slugify = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const field = (id, label, type = 'text', value = '', extra = '') => `<div class="field"><label for="${id}">${label}</label><input class="input" id="${id}" type="${type}" value="${esc(value)}" ${extra}></div>`;
  const textarea = (id, label, value = '', rows = 8, extra = '') => `<div class="field"><label for="${id}">${label}</label><textarea class="input" id="${id}" rows="${rows}" ${extra}>${esc(value)}</textarea></div>`;
  const outputBox = (id = 'output', label = 'Resultado') => `<div class="field"><label for="${id}">${label}</label><textarea class="output large" id="${id}" rows="12" readonly></textarea></div>`;
  const standardActions = (primaryId, primaryLabel = 'Executar', outputId = '#output', filename = 'resultado.txt') => `<div class="actions"><button class="btn btn-primary" id="${primaryId}">${primaryLabel}</button><button class="btn btn-secondary" data-copy-target="${outputId}">Copiar</button><button class="btn btn-secondary" data-download-target="${outputId}" data-filename="${filename}">Baixar</button></div><div class="status" id="status"></div>`;
  const addText = (selector, value) => { const el = q(selector); if (el) el.value = String(value ?? ''); };

  // Basic YAML support for common maps, arrays and scalar values.
  const yamlScalar = (text) => {
    const s = String(text).trim();
    if (s === '' || s === 'null' || s === '~') return null;
    if (/^(true|false)$/i.test(s)) return s.toLowerCase() === 'true';
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1,-1).replace(/\\n/g,'\n');
    if ((s.startsWith('[') && s.endsWith(']')) || (s.startsWith('{') && s.endsWith('}'))) {
      try { return JSON.parse(s.replace(/'/g, '"')); } catch (_) { /* keep string */ }
    }
    return s;
  };
  const parseYamlBasic = (text) => {
    const raw = String(text || '').trim();
    if (!raw) return {};
    try { return JSON.parse(raw); } catch (_) { /* YAML */ }
    const lines = raw.split(/\r?\n/).map((line) => ({ indent: line.match(/^\s*/)[0].length, text: line.trim() })).filter((x) => x.text && !x.text.startsWith('#'));
    const parseBlock = (start, indent) => {
      const isArray = lines[start]?.indent === indent && lines[start].text.startsWith('- ');
      const container = isArray ? [] : {};
      let i = start;
      while (i < lines.length && lines[i].indent >= indent) {
        const line = lines[i]; if (line.indent > indent) { i++; continue; }
        if (isArray) {
          if (!line.text.startsWith('-')) break;
          const rest = line.text.slice(1).trim();
          if (!rest) {
            const next = lines[i + 1]; if (next && next.indent > indent) { const [child, ni] = parseBlock(i + 1, next.indent); container.push(child); i = ni; continue; }
            container.push(null); i++; continue;
          }
          const colon = rest.indexOf(':');
          if (colon > 0) {
            const obj = {}; const key = rest.slice(0, colon).trim(); const value = rest.slice(colon + 1).trim();
            obj[key] = value ? yamlScalar(value) : null;
            let j = i + 1;
            if (j < lines.length && lines[j].indent > indent) {
              const [child, nj] = parseBlock(j, lines[j].indent);
              if (obj[key] === null && (typeof child === 'object')) obj[key] = child;
              else if (!Array.isArray(child)) Object.assign(obj, child);
              j = nj;
            }
            container.push(obj); i = j; continue;
          }
          container.push(yamlScalar(rest)); i++;
        } else {
          if (line.text.startsWith('- ')) break;
          const colon = line.text.indexOf(':'); if (colon < 0) throw new Error(`Linha YAML inválida: ${line.text}`);
          const key = line.text.slice(0, colon).trim().replace(/^['"]|['"]$/g, ''); const value = line.text.slice(colon + 1).trim();
          if (value) { container[key] = yamlScalar(value); i++; }
          else {
            const next = lines[i + 1];
            if (next && next.indent > indent) { const [child, ni] = parseBlock(i + 1, next.indent); container[key] = child; i = ni; }
            else { container[key] = null; i++; }
          }
        }
      }
      return [container, i];
    };
    return parseBlock(0, lines[0]?.indent || 0)[0];
  };
  const dumpYaml = (value, indent = 0) => {
    const pad = ' '.repeat(indent);
    const scalar = (v) => {
      if (v === null) return 'null'; if (typeof v === 'boolean' || typeof v === 'number') return String(v);
      const s = String(v); return /[:#\-{}\[\],&*!|>'"%@`\n]|^\s|\s$/.test(s) ? JSON.stringify(s) : s;
    };
    if (Array.isArray(value)) return value.map((item) => {
      if (item && typeof item === 'object') return `${pad}-\n${dumpYaml(item, indent + 2)}`;
      return `${pad}- ${scalar(item)}`;
    }).join('\n');
    if (value && typeof value === 'object') return Object.entries(value).map(([key,val]) => {
      if (val && typeof val === 'object') return `${pad}${key}:\n${dumpYaml(val, indent + 2)}`;
      return `${pad}${key}: ${scalar(val)}`;
    }).join('\n');
    return `${pad}${scalar(value)}`;
  };

  async function compressPdf() {
    setHtml(`<div class="tool-form"><div class="field"><label for="pdf-file">Arquivo PDF</label><input id="pdf-file" type="file" accept="application/pdf"></div><div class="two-col">${field('pdf-scale','Resolução relativa','number','1.25','min="0.6" max="2" step="0.05"')}${field('pdf-quality','Qualidade JPEG','range','0.72','min="0.35" max="0.95" step="0.01"')}</div><p class="small muted">Este método rasteriza cada página. É mais indicado para PDFs escaneados e pode remover texto pesquisável, links e formulários.</p><div class="actions"><button class="btn btn-primary" id="run">Comprimir PDF</button></div><div class="progress-wrap" hidden><progress id="progress" max="100" value="0"></progress><span id="progress-label"></span></div><div class="status" id="status"></div></div>`);
    q('#run').addEventListener('click', async () => {
      const file = q('#pdf-file').files[0]; if (!file) return status('Selecione um PDF.', 'warning');
      try {
        status('Processando páginas. Mantenha esta aba aberta…', 'info'); q('.progress-wrap').hidden = false;
        const [pdfjs, PDFLib] = await Promise.all([loadPdfJs(), loadPdfLib()]);
        const source = await pdfjs.getDocument({ data: await fileToBuffer(file) }).promise;
        const out = await PDFLib.PDFDocument.create(); const scale = clamp(q('#pdf-scale').value, .6, 2); const quality = clamp(q('#pdf-quality').value, .35, .95);
        for (let i = 1; i <= source.numPages; i++) {
          const page = await source.getPage(i); const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
          await page.render({ canvasContext: canvas.getContext('2d', { alpha: false }), viewport, background: '#ffffff' }).promise;
          const blob = await canvasToBlob(canvas, 'image/jpeg', quality); const img = await out.embedJpg(await blob.arrayBuffer());
          const outPage = out.addPage([viewport.width, viewport.height]); outPage.drawImage(img, { x: 0, y: 0, width: viewport.width, height: viewport.height });
          q('#progress').value = Math.round(i / source.numPages * 100); q('#progress-label').textContent = `${i}/${source.numPages}`;
        }
        const bytes = await out.save({ useObjectStreams: true }); downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `compactado-${file.name}`);
        const reduction = 100 - (bytes.length / file.size * 100);
        status(`Arquivo gerado: ${bytesLabel(bytes.length)}. ${reduction > 0 ? `Redução aproximada de ${reduction.toFixed(1)}%.` : 'O arquivo ficou maior; tente reduzir resolução ou qualidade.'}`, reduction > 0 ? 'success' : 'warning');
        track('download_file', { file_type: 'pdf', action_detail: 'compress' });
      } catch (error) { status(error.message, 'error'); }
    });
  }

  function rotatePdf() {
    setHtml(`<div class="field"><label for="pdf-file">Arquivo PDF</label><input id="pdf-file" type="file" accept="application/pdf"></div><div class="two-col"><div class="field"><label for="pages">Páginas</label><input class="input" id="pages" value="todas" placeholder="todas ou 1,3-5"></div><div class="field"><label for="angle">Rotação</label><select id="angle"><option value="90">90° à direita</option><option value="180">180°</option><option value="270">90° à esquerda</option></select></div></div><div class="actions"><button class="btn btn-primary" id="run">Girar e baixar</button></div><div class="status" id="status"></div>`);
    q('#run').addEventListener('click', async () => {
      const file = q('#pdf-file').files[0]; if (!file) return status('Selecione um PDF.', 'warning');
      try {
        const PDFLib = await loadPdfLib(); const doc = await PDFLib.PDFDocument.load(await fileToBuffer(file)); const pages = doc.getPages();
        parsePages(q('#pages').value, pages.length).forEach((idx) => { const p = pages[idx]; p.setRotation(PDFLib.degrees((p.getRotation().angle + Number(q('#angle').value)) % 360)); });
        const bytes = await doc.save(); downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `girado-${file.name}`); status('PDF girado e baixado.', 'success'); track('download_file',{file_type:'pdf',action_detail:'rotate'});
      } catch (error) { status(error.message, 'error'); }
    });
  }

  function watermarkPdf() {
    setHtml(`<div class="field"><label for="pdf-file">Arquivo PDF</label><input id="pdf-file" type="file" accept="application/pdf"></div>${field('text','Texto da marca-d’água','text','CONFIDENCIAL','maxlength="80"')}<div class="three-col">${field('size','Tamanho','number','42','min="8" max="150"')} ${field('opacity','Opacidade','range','0.22','min="0.05" max="0.8" step="0.01"')}<div class="field"><label for="position">Posição</label><select id="position"><option value="diagonal">Diagonal central</option><option value="center">Centro</option><option value="footer">Rodapé</option></select></div></div><div class="actions"><button class="btn btn-primary" id="run">Aplicar e baixar</button></div><div class="status" id="status"></div>`);
    q('#run').addEventListener('click', async () => {
      const file = q('#pdf-file').files[0], text = q('#text').value.trim(); if (!file || !text) return status('Selecione um PDF e informe o texto.', 'warning');
      try {
        const PDFLib = await loadPdfLib(); const doc = await PDFLib.PDFDocument.load(await fileToBuffer(file)); const font = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
        const size = clamp(q('#size').value, 8, 150), opacity = clamp(q('#opacity').value, .05, .8), position = q('#position').value;
        doc.getPages().forEach((page) => {
          const { width, height } = page.getSize(); const tw = font.widthOfTextAtSize(text, size); let x=(width-tw)/2,y=(height-size)/2,rotate=PDFLib.degrees(0);
          if (position === 'diagonal') rotate = PDFLib.degrees(35); if (position === 'footer') { x=(width-tw)/2; y=24; }
          page.drawText(text,{x,y,size,font,opacity,rotate,color:PDFLib.rgb(.35,.35,.35)});
        });
        const bytes = await doc.save(); downloadBlob(new Blob([bytes],{type:'application/pdf'}),`marca-dagua-${file.name}`); status('Marca-d’água aplicada.', 'success'); track('download_file',{file_type:'pdf',action_detail:'watermark'});
      } catch(error){status(error.message,'error');}
    });
  }

  function numberPdfPages() {
    setHtml(`<div class="field"><label for="pdf-file">Arquivo PDF</label><input id="pdf-file" type="file" accept="application/pdf"></div><div class="three-col">${field('start','Número inicial','number','1','min="0"')} ${field('size','Tamanho','number','11','min="6" max="50"')}<div class="field"><label for="position">Posição</label><select id="position"><option value="bottom-center">Rodapé central</option><option value="bottom-right">Rodapé direito</option><option value="top-right">Topo direito</option></select></div></div>${field('prefix','Prefixo opcional','text','','placeholder="Página "')}<div class="actions"><button class="btn btn-primary" id="run">Numerar e baixar</button></div><div class="status" id="status"></div>`);
    q('#run').addEventListener('click', async () => {
      const file=q('#pdf-file').files[0]; if(!file)return status('Selecione um PDF.','warning');
      try{const PDFLib=await loadPdfLib(),doc=await PDFLib.PDFDocument.load(await fileToBuffer(file)),font=await doc.embedFont(PDFLib.StandardFonts.Helvetica);const start=Number(q('#start').value)||0,size=clamp(q('#size').value,6,50),prefix=q('#prefix').value,pos=q('#position').value;
        doc.getPages().forEach((p,i)=>{const text=`${prefix}${start+i}`,{width,height}=p.getSize(),tw=font.widthOfTextAtSize(text,size);let x=(width-tw)/2,y=18;if(pos==='bottom-right')x=width-tw-24;if(pos==='top-right'){x=width-tw-24;y=height-size-18;}p.drawText(text,{x,y,size,font,color:PDFLib.rgb(.15,.15,.15)});});
        const bytes=await doc.save();downloadBlob(new Blob([bytes],{type:'application/pdf'}),`numerado-${file.name}`);status('Numeração adicionada.','success');track('download_file',{file_type:'pdf',action_detail:'number_pages'});
      }catch(error){status(error.message,'error');}
    });
  }

  function extractTextPdf() {
    setHtml(`<div class="field"><label for="pdf-file">Arquivo PDF</label><input id="pdf-file" type="file" accept="application/pdf"></div><div class="actions"><button class="btn btn-primary" id="run">Extrair texto</button><button class="btn btn-secondary" data-copy-target="#output">Copiar</button><button class="btn btn-secondary" data-download-target="#output" data-filename="texto-extraido.txt">Baixar TXT</button></div>${outputBox('output','Texto extraído')}<div class="status" id="status"></div>`);
    q('#run').addEventListener('click',async()=>{const file=q('#pdf-file').files[0];if(!file)return status('Selecione um PDF.','warning');try{status('Extraindo texto…','info');const pages=await extractPdfText(file);addText('#output',pages.map((t,i)=>`--- Página ${i+1} ---\n${t}`).join('\n\n'));status(`${pages.length} página(s) processada(s). PDFs apenas com imagem podem retornar pouco texto.`, 'success');track('tool_use',{action_detail:'extract_pdf_text'});}catch(error){status(error.message,'error');}});
  }

  function removePdfMetadata() {
    setHtml(`<div class="field"><label for="pdf-file">Arquivo PDF</label><input id="pdf-file" type="file" accept="application/pdf"></div><div class="note">Remove campos comuns de título, autor, assunto, palavras-chave, produtor e criador. Isso não garante anonimização total do conteúdo interno.</div><div class="actions"><button class="btn btn-primary" id="run">Limpar metadados</button></div><div class="status" id="status"></div>`);
    q('#run').addEventListener('click',async()=>{const file=q('#pdf-file').files[0];if(!file)return status('Selecione um PDF.','warning');try{const PDFLib=await loadPdfLib(),doc=await PDFLib.PDFDocument.load(await fileToBuffer(file));doc.setTitle('');doc.setAuthor('');doc.setSubject('');doc.setKeywords([]);doc.setProducer('');doc.setCreator('');doc.setCreationDate(new Date(0));doc.setModificationDate(new Date());const bytes=await doc.save();downloadBlob(new Blob([bytes],{type:'application/pdf'}),`sem-metadados-${file.name}`);status('Metadados comuns removidos. Revise o arquivo antes de compartilhar.','success');track('download_file',{file_type:'pdf',action_detail:'remove_metadata'});}catch(error){status(error.message,'error');}});
  }

  function comparePdfs() {
    setHtml(`<div class="two-col"><div class="field"><label for="pdf-a">PDF A</label><input id="pdf-a" type="file" accept="application/pdf"></div><div class="field"><label for="pdf-b">PDF B</label><input id="pdf-b" type="file" accept="application/pdf"></div></div><div class="actions"><button class="btn btn-primary" id="run">Comparar textos</button><button class="btn btn-secondary" data-copy-target="#output">Copiar relatório</button></div><div class="comparison-summary" id="summary"></div>${outputBox('output','Diferenças encontradas')}<div class="status" id="status"></div>`);
    q('#run').addEventListener('click',async()=>{const a=q('#pdf-a').files[0],b=q('#pdf-b').files[0];if(!a||!b)return status('Selecione os dois PDFs.','warning');try{status('Extraindo e comparando texto…','info');const [pa,pb]=await Promise.all([extractPdfText(a),extractPdfText(b)]),max=Math.max(pa.length,pb.length);const diffs=[];for(let i=0;i<max;i++){const ta=pa[i]||'',tb=pb[i]||'';if(ta!==tb){const wa=new Set(ta.split(/\s+/)),wb=new Set(tb.split(/\s+/));const onlyA=[...wa].filter(x=>x&&!wb.has(x)).slice(0,80),onlyB=[...wb].filter(x=>x&&!wa.has(x)).slice(0,80);diffs.push(`Página ${i+1}\nSomente A: ${onlyA.join(' ')}\nSomente B: ${onlyB.join(' ')}`);}}addText('#output',diffs.join('\n\n'));q('#summary').innerHTML=`<div class="stat-card"><strong>${max}</strong><span>Páginas analisadas</span></div><div class="stat-card"><strong>${diffs.length}</strong><span>Páginas diferentes</span></div>`;status(diffs.length?'Diferenças textuais encontradas. A comparação não verifica aparência visual.':'Nenhuma diferença textual detectada.',diffs.length?'warning':'success');track('tool_use',{action_detail:'compare_pdfs',differences:diffs.length});}catch(error){status(error.message,'error');}});
  }

  function textToPdf() {
    setHtml(`${textarea('text','Texto','Título do documento\n\nDigite ou cole seu conteúdo aqui.',14)}<div class="three-col">${field('font-size','Tamanho da fonte','number','12','min="8" max="28"')}<div class="field"><label for="page-size">Página</label><select id="page-size"><option value="a4">A4</option><option value="letter">Carta</option></select></div><div class="field"><label for="margin">Margem (pt)</label><input class="input" id="margin" type="number" min="20" max="100" value="48"></div></div><div class="actions"><button class="btn btn-primary" id="run">Criar PDF</button></div><div class="status" id="status"></div>`);
    q('#run').addEventListener('click',async()=>{const text=q('#text').value;if(!text.trim())return status('Digite algum texto.','warning');try{const PDFLib=await loadPdfLib(),doc=await PDFLib.PDFDocument.create(),font=await doc.embedFont(PDFLib.StandardFonts.Helvetica),size=clamp(q('#font-size').value,8,28),margin=clamp(q('#margin').value,20,100),dims=q('#page-size').value==='letter'?[612,792]:[595.28,841.89],lineHeight=size*1.45,maxWidth=dims[0]-margin*2;let page=doc.addPage(dims),y=dims[1]-margin;
      const writeLine=(line)=>{if(y<margin+lineHeight){page=doc.addPage(dims);y=dims[1]-margin;}page.drawText(line,{x:margin,y,size,font,color:PDFLib.rgb(.08,.1,.15)});y-=lineHeight;};
      text.split(/\r?\n/).forEach((paragraph)=>{if(!paragraph){writeLine('');return;}let line='';paragraph.split(/\s+/).forEach(word=>{const test=line?`${line} ${word}`:word;if(font.widthOfTextAtSize(test,size)>maxWidth&&line){writeLine(line);line=word;}else line=test;});if(line)writeLine(line);});
      const bytes=await doc.save();downloadBlob(new Blob([bytes],{type:'application/pdf'}),'texto.pdf');status('PDF criado e baixado.','success');track('download_file',{file_type:'pdf',action_detail:'text_to_pdf'});}catch(error){status(error.message,'error');}});
  }

  function linedPdf() {
    setHtml(`<div class="four-col">${field('pages','Páginas','number','3','min="1" max="100"')}<div class="field"><label for="style">Estilo</label><select id="style"><option value="lines">Pautado</option><option value="grid">Quadriculado</option><option value="dots">Pontilhado</option></select></div>${field('spacing','Espaçamento (pt)','number','24','min="8" max="60"')}${field('margin','Margem (pt)','number','42','min="10" max="100"')}</div><div class="actions"><button class="btn btn-primary" id="run">Gerar PDF</button></div><div class="status" id="status"></div>`);
    q('#run').addEventListener('click',async()=>{try{const PDFLib=await loadPdfLib(),doc=await PDFLib.PDFDocument.create(),count=clamp(q('#pages').value,1,100),style=q('#style').value,spacing=clamp(q('#spacing').value,8,60),margin=clamp(q('#margin').value,10,100),dims=[595.28,841.89],color=PDFLib.rgb(.75,.8,.88);for(let n=0;n<count;n++){const p=doc.addPage(dims);if(style==='lines'||style==='grid')for(let y=margin;y<dims[1]-margin;y+=spacing)p.drawLine({start:{x:margin,y},end:{x:dims[0]-margin,y},thickness:.5,color});if(style==='grid')for(let x=margin;x<dims[0]-margin;x+=spacing)p.drawLine({start:{x,y:margin},end:{x,y:dims[1]-margin},thickness:.5,color});if(style==='dots')for(let y=margin;y<dims[1]-margin;y+=spacing)for(let x=margin;x<dims[0]-margin;x+=spacing)p.drawCircle({x,y,size:1,color});}const bytes=await doc.save();downloadBlob(new Blob([bytes],{type:'application/pdf'}),`papel-${style}.pdf`);status(`${count} página(s) criada(s).`,'success');track('download_file',{file_type:'pdf',action_detail:'lined_pdf'});}catch(error){status(error.message,'error');}});
  }

  function cropImage() {
    setHtml(`<div class="field"><label for="image-file">Imagem</label><input id="image-file" type="file" accept="image/*"></div><div class="four-col">${field('crop-x','X','number','0','min="0"')}${field('crop-y','Y','number','0','min="0"')}${field('crop-w','Largura','number','500','min="1"')}${field('crop-h','Altura','number','500','min="1"')}</div><div class="actions"><button class="btn btn-primary" id="run">Recortar</button><button class="btn btn-secondary" id="download" disabled>Baixar PNG</button></div><canvas class="image-canvas" id="canvas"></canvas><div class="status" id="status"></div>`);
    let blob;
    q('#run').addEventListener('click',async()=>{const file=q('#image-file').files[0];if(!file)return status('Selecione uma imagem.','warning');try{const img=await loadImageFile(file),x=clamp(q('#crop-x').value,0,img.naturalWidth-1),y=clamp(q('#crop-y').value,0,img.naturalHeight-1),w=clamp(q('#crop-w').value,1,img.naturalWidth-x),h=clamp(q('#crop-h').value,1,img.naturalHeight-y),canvas=q('#canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(img,x,y,w,h,0,0,w,h);blob=await canvasToBlob(canvas,'image/png');q('#download').disabled=false;status(`Recorte criado: ${w} × ${h}px.`,'success');track('tool_use',{action_detail:'crop_image'});}catch(error){status(error.message,'error');}});
    q('#download').addEventListener('click',()=>blob&&downloadBlob(blob,'imagem-recortada.png'));
  }

  function rotateFlipImage() {
    setHtml(`<div class="field"><label for="image-file">Imagem</label><input id="image-file" type="file" accept="image/*"></div><div class="three-col"><div class="field"><label for="angle">Rotação</label><select id="angle"><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option><option value="0">0°</option></select></div><label class="check field-check"><input id="flip-h" type="checkbox"> Espelhar horizontal</label><label class="check field-check"><input id="flip-v" type="checkbox"> Espelhar vertical</label></div><div class="actions"><button class="btn btn-primary" id="run">Transformar</button><button class="btn btn-secondary" id="download" disabled>Baixar PNG</button></div><canvas class="image-canvas" id="canvas"></canvas><div class="status" id="status"></div>`);
    let blob;
    q('#run').addEventListener('click',async()=>{const file=q('#image-file').files[0];if(!file)return status('Selecione uma imagem.','warning');try{const img=await loadImageFile(file),angle=Number(q('#angle').value),rad=angle*Math.PI/180,swap=angle===90||angle===270,canvas=q('#canvas');canvas.width=swap?img.naturalHeight:img.naturalWidth;canvas.height=swap?img.naturalWidth:img.naturalHeight;const ctx=canvas.getContext('2d');ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(rad);ctx.scale(q('#flip-h').checked?-1:1,q('#flip-v').checked?-1:1);ctx.drawImage(img,-img.naturalWidth/2,-img.naturalHeight/2);blob=await canvasToBlob(canvas,'image/png');q('#download').disabled=false;status('Imagem transformada.','success');track('tool_use',{action_detail:'rotate_flip_image'});}catch(error){status(error.message,'error');}});
    q('#download').addEventListener('click',()=>blob&&downloadBlob(blob,'imagem-transformada.png'));
  }

  function removeExif() {
    setHtml(`<div class="field"><label for="image-file">Imagem JPEG, PNG ou WebP</label><input id="image-file" type="file" accept="image/*"></div><div class="two-col"><div class="field"><label for="format">Formato de saída</label><select id="format"><option value="image/jpeg">JPEG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option></select></div>${field('quality','Qualidade','range','0.9','min="0.4" max="1" step="0.01"')}</div><div class="actions"><button class="btn btn-primary" id="run">Remover metadados</button></div><div class="status" id="status"></div>`);
    q('#run').addEventListener('click',async()=>{const file=q('#image-file').files[0];if(!file)return status('Selecione uma imagem.','warning');try{const img=await loadImageFile(file),canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;canvas.getContext('2d').drawImage(img,0,0);const type=q('#format').value,blob=await canvasToBlob(canvas,type,clamp(q('#quality').value,.4,1)),ext=type.split('/')[1].replace('jpeg','jpg');downloadBlob(blob,`sem-metadados.${ext}`);status(`Imagem regravada sem metadados EXIF comuns (${bytesLabel(blob.size)}).`,'success');track('download_file',{file_type:ext,action_detail:'remove_exif'});}catch(error){status(error.message,'error');}});
  }

  function extractPalette() {
    setHtml(`<div class="field"><label for="image-file">Imagem</label><input id="image-file" type="file" accept="image/*"></div>${field('count','Quantidade de cores','number','8','min="2" max="20"')}<div class="actions"><button class="btn btn-primary" id="run">Extrair paleta</button></div><div class="palette-grid" id="palette"></div><div class="status" id="status"></div>`);
    q('#run').addEventListener('click',async()=>{const file=q('#image-file').files[0];if(!file)return status('Selecione uma imagem.','warning');try{const img=await loadImageFile(file),canvas=document.createElement('canvas'),max=180,scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,canvas.width,canvas.height);const data=ctx.getImageData(0,0,canvas.width,canvas.height).data,map=new Map();for(let i=0;i<data.length;i+=16){if(data[i+3]<128)continue;const r=Math.min(255,Math.round(data[i]/32)*32),g=Math.min(255,Math.round(data[i+1]/32)*32),b=Math.min(255,Math.round(data[i+2]/32)*32),key=`${r},${g},${b}`;map.set(key,(map.get(key)||0)+1);}const colors=[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,clamp(q('#count').value,2,20)).map(([key])=>{const [r,g,b]=key.split(',').map(Number);return `#${[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('')}`;});q('#palette').innerHTML=colors.map(c=>`<button class="palette-color" data-color="${c}" style="--swatch:${c}"><span></span><strong>${c.toUpperCase()}</strong></button>`).join('');status(`${colors.length} cores dominantes aproximadas.`,'success');track('tool_use',{action_detail:'extract_palette'});}catch(error){status(error.message,'error');}});
    q('#palette').addEventListener('click',async(e)=>{const btn=e.target.closest('[data-color]');if(btn){await window.copyText(btn.dataset.color);status(`${btn.dataset.color} copiado.`,'success');}});
  }

  function imageColorPicker() {
    setHtml(`<div class="field"><label for="image-file">Imagem</label><input id="image-file" type="file" accept="image/*"></div><p class="small muted">Toque ou clique na imagem para capturar uma cor.</p><canvas class="image-canvas picker-canvas" id="canvas"></canvas><div class="color-result" id="color-result"><span class="color-preview"></span><strong>—</strong><button class="btn btn-secondary" id="copy" disabled>Copiar HEX</button></div><div class="status" id="status"></div>`);
    let current='';
    q('#image-file').addEventListener('change',async()=>{const file=q('#image-file').files[0];if(!file)return;try{const img=await loadImageFile(file),canvas=q('#canvas'),max=1000,scale=Math.min(1,max/img.naturalWidth);canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);status('Imagem carregada. Clique em um ponto.','info');}catch(error){status(error.message,'error');}});
    q('#canvas').addEventListener('click',(e)=>{const canvas=q('#canvas'),rect=canvas.getBoundingClientRect(),x=Math.floor((e.clientX-rect.left)*canvas.width/rect.width),y=Math.floor((e.clientY-rect.top)*canvas.height/rect.height),d=canvas.getContext('2d').getImageData(x,y,1,1).data;current=`#${[d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,'0')).join('')}`.toUpperCase();q('.color-preview').style.background=current;q('#color-result strong').textContent=`${current} · rgb(${d[0]}, ${d[1]}, ${d[2]})`;q('#copy').disabled=false;track('tool_use',{action_detail:'pick_color'});});
    q('#copy').addEventListener('click',async()=>{await window.copyText(current);status(`${current} copiado.`,'success');});
  }

  function placeholderImage() {
    setHtml(`<div class="four-col">${field('width','Largura','number','1200','min="16" max="5000"')}${field('height','Altura','number','630','min="16" max="5000"')}${field('bg','Fundo','color','#3157d5')}${field('fg','Texto','color','#ffffff')}</div>${field('text','Texto','text','1200 × 630','maxlength="120"')}<div class="actions"><button class="btn btn-primary" id="run">Gerar imagem</button><button class="btn btn-secondary" id="download" disabled>Baixar PNG</button></div><canvas class="image-canvas" id="canvas"></canvas><div class="status" id="status"></div>`);
    let blob;
    const generate=async()=>{const w=clamp(q('#width').value,16,5000),h=clamp(q('#height').value,16,5000),canvas=q('#canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.fillStyle=q('#bg').value;ctx.fillRect(0,0,w,h);ctx.fillStyle=q('#fg').value;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`700 ${Math.max(16,Math.round(Math.min(w,h)*.1))}px system-ui`;ctx.fillText(q('#text').value||`${w} × ${h}`,w/2,h/2,w*.9);blob=await canvasToBlob(canvas,'image/png');q('#download').disabled=false;status(`Placeholder ${w} × ${h}px criado.`,'success');track('tool_use',{action_detail:'generate_placeholder'});};q('#run').addEventListener('click',generate);q('#download').addEventListener('click',()=>blob&&downloadBlob(blob,`placeholder-${q('#width').value}x${q('#height').value}.png`));generate();
  }

  function batchResizeImages() {
    setHtml(`<div class="field"><label for="files">Imagens</label><input id="files" type="file" accept="image/*" multiple></div><div class="three-col">${field('max-w','Largura máxima','number','1600','min="1" max="8000"')}${field('max-h','Altura máxima','number','1600','min="1" max="8000"')}<div class="field"><label for="format">Formato</label><select id="format"><option value="image/jpeg">JPEG</option><option value="image/webp">WebP</option><option value="image/png">PNG</option></select></div></div>${field('quality','Qualidade','range','0.88','min="0.35" max="1" step="0.01"')}<div class="actions"><button class="btn btn-primary" id="run">Redimensionar e baixar ZIP</button></div><div class="progress-wrap" hidden><progress id="progress" max="100" value="0"></progress><span id="progress-label"></span></div><div class="status" id="status"></div>`);
    q('#run').addEventListener('click',async()=>{const files=[...q('#files').files];if(!files.length)return status('Selecione uma ou mais imagens.','warning');try{const JSZip=await loadJsZip(),zip=new JSZip(),maxW=clamp(q('#max-w').value,1,8000),maxH=clamp(q('#max-h').value,1,8000),type=q('#format').value,quality=clamp(q('#quality').value,.35,1),ext=type.split('/')[1].replace('jpeg','jpg');q('.progress-wrap').hidden=false;for(let i=0;i<files.length;i++){const img=await loadImageFile(files[i]),scale=Math.min(1,maxW/img.naturalWidth,maxH/img.naturalHeight),w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale)),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');if(type==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);}ctx.drawImage(img,0,0,w,h);const blob=await canvasToBlob(canvas,type,quality);zip.file(`${slugify(files[i].name.replace(/\.[^.]+$/,''))||`imagem-${i+1}`}.${ext}`,blob);q('#progress').value=Math.round((i+1)/files.length*100);q('#progress-label').textContent=`${i+1}/${files.length}`;}const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE'});downloadBlob(blob,'imagens-redimensionadas.zip');status(`${files.length} imagem(ns) processada(s).`,'success');track('download_file',{file_type:'zip',action_detail:'batch_resize',quantity:files.length});}catch(error){status(error.message,'error');}});
  }

  function aspectRatioCalculator() {
    setHtml(`<div class="two-col"><section class="mini-panel"><h3>Redimensionar mantendo proporção</h3><div class="two-col">${field('ow','Largura original','number','1920','min="1"')}${field('oh','Altura original','number','1080','min="1"')}</div><div class="two-col">${field('nw','Nova largura','number','1280','min="1"')}${field('nh','Nova altura','number','','min="1"')}</div><div class="actions"><button class="btn btn-primary" id="calc-w">Calcular pela largura</button><button class="btn btn-secondary" id="calc-h">Calcular pela altura</button></div></section><section class="mini-panel"><h3>Proporção simplificada</h3><div id="ratio-result" class="result-big">16:9</div><p class="small muted" id="scale-result"></p></section></div><div class="status" id="status"></div>`);
    const gcd=(a,b)=>b?gcd(b,a%b):a;const update=()=>{const ow=clamp(q('#ow').value,1,1e7),oh=clamp(q('#oh').value,1,1e7),g=gcd(Math.round(ow),Math.round(oh));q('#ratio-result').textContent=`${Math.round(ow/g)}:${Math.round(oh/g)}`;};q('#calc-w').addEventListener('click',()=>{const ow=clamp(q('#ow').value,1,1e7),oh=clamp(q('#oh').value,1,1e7),nw=clamp(q('#nw').value,1,1e7),nh=Math.round(nw*oh/ow);q('#nh').value=nh;q('#scale-result').textContent=`Escala: ${(nw/ow*100).toFixed(2)}%`;update();status(`Nova dimensão: ${nw} × ${nh}px.`,'success');track('tool_use',{action_detail:'aspect_ratio'});});q('#calc-h').addEventListener('click',()=>{const ow=clamp(q('#ow').value,1,1e7),oh=clamp(q('#oh').value,1,1e7),nh=clamp(q('#nh').value,1,1e7),nw=Math.round(nh*ow/oh);q('#nw').value=nw;q('#scale-result').textContent=`Escala: ${(nh/oh*100).toFixed(2)}%`;update();status(`Nova dimensão: ${nw} × ${nh}px.`,'success');track('tool_use',{action_detail:'aspect_ratio'});});['#ow','#oh'].forEach(s=>q(s).addEventListener('input',update));update();
  }

  function yamlFormatter() {
    setHtml(`${textarea('input','YAML ou JSON','servico:\n  nome: pagamentos\n  ativo: true\n  portas:\n    - 8080\n    - 8443',14)}<div class="actions"><button class="btn btn-primary" id="format">Formatar YAML</button><button class="btn btn-secondary" id="to-json">Converter para JSON</button><button class="btn btn-secondary" data-copy-target="#output">Copiar</button></div>${outputBox('output')}<div class="status" id="status"></div>`);
    q('#format').addEventListener('click',()=>{try{const data=parseYamlBasic(q('#input').value);addText('#output',dumpYaml(data));status('YAML validado e formatado. O parser cobre estruturas comuns.','success');track('tool_use',{action_detail:'format_yaml'});}catch(error){status(error.message,'error');}});q('#to-json').addEventListener('click',()=>{try{addText('#output',JSON.stringify(parseYamlBasic(q('#input').value),null,2));status('Convertido para JSON.','success');track('tool_use',{action_detail:'yaml_to_json'});}catch(error){status(error.message,'error');}});
  }

  function jsonYamlConverter() {
    setHtml(`<div class="two-col">${textarea('input','Entrada','{"usuario":{"id":1,"ativo":true},"perfis":["qa","admin"]}',15)}${outputBox('output','Saída')}</div><div class="actions"><button class="btn btn-primary" id="json-yaml">JSON → YAML</button><button class="btn btn-secondary" id="yaml-json">YAML → JSON</button><button class="btn btn-secondary" data-copy-target="#output">Copiar</button><button class="btn btn-secondary" data-download-target="#output" data-filename="conversao.txt">Baixar</button></div><div class="status" id="status"></div>`);
    q('#json-yaml').addEventListener('click',()=>{try{addText('#output',dumpYaml(JSON.parse(q('#input').value)));status('JSON convertido para YAML.','success');track('tool_use',{action_detail:'json_to_yaml'});}catch(error){status(`JSON inválido: ${error.message}`,'error');}});q('#yaml-json').addEventListener('click',()=>{try{addText('#output',JSON.stringify(parseYamlBasic(q('#input').value),null,2));status('YAML convertido para JSON.','success');track('tool_use',{action_detail:'yaml_to_json'});}catch(error){status(error.message,'error');}});
  }

  function csvViewer() {
    setHtml(`${textarea('input','CSV','id,nome,ativo\n1,Ana,true\n2,Bruno,false',12)}<div class="three-col"><div class="field"><label for="delimiter">Delimitador</label><select id="delimiter"><option value=",">Vírgula</option><option value=";">Ponto e vírgula</option><option value="\t">Tabulação</option></select></div><label class="check field-check"><input id="header" type="checkbox" checked> Primeira linha é cabeçalho</label><div class="field"><label for="filter">Filtrar linhas</label><input class="input" id="filter" placeholder="Digite para filtrar"></div></div><div class="actions"><button class="btn btn-primary" id="run">Visualizar</button><button class="btn btn-secondary" id="download">Baixar CSV atual</button></div><div class="table-scroll"><table class="data-table" id="table"></table></div><div class="status" id="status"></div>`);
    let rows=[];const render=()=>{const query=q('#filter').value.toLowerCase(),visible=rows.filter(r=>!query||r.join(' ').toLowerCase().includes(query));if(!visible.length){q('#table').innerHTML='';return;}const hasHeader=q('#header').checked,head=hasHeader?visible[0]:visible[0].map((_,i)=>`Coluna ${i+1}`),body=hasHeader?visible.slice(1):visible;q('#table').innerHTML=`<thead><tr>${head.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${body.slice(0,500).map(r=>`<tr>${head.map((_,i)=>`<td contenteditable="true">${esc(r[i]||'')}</td>`).join('')}</tr>`).join('')}</tbody>`;status(`${body.length} linha(s), ${head.length} coluna(s). Exibindo até 500 linhas.`,'success');};q('#run').addEventListener('click',()=>{rows=parseCsv(q('#input').value,q('#delimiter').value);render();track('tool_use',{action_detail:'view_csv'});});q('#filter').addEventListener('input',render);q('#download').addEventListener('click',()=>{const delimiter=q('#delimiter').value,table=q('#table'),out=[...table.rows].map(row=>[...row.cells].map(c=>csvCell(c.textContent,delimiter)).join(delimiter)).join('\n');downloadText(out,'dados-editados.csv','text/csv;charset=utf-8');track('download_file',{file_type:'csv'});});q('#run').click();
  }

  function compareCsv() {
    setHtml(`<div class="two-col">${textarea('a','CSV A','id,nome,status\n1,Ana,ativo\n2,Bruno,inativo',12)}${textarea('b','CSV B','id,nome,status\n1,Ana,ativo\n2,Bruno,ativo',12)}</div><div class="two-col"><div class="field"><label for="delimiter">Delimitador</label><select id="delimiter"><option value=",">Vírgula</option><option value=";">Ponto e vírgula</option><option value="\t">Tabulação</option></select></div>${field('key','Coluna-chave','text','id')}</div>${standardActions('run','Comparar','#output','diferencas-csv.txt')}${outputBox('output','Relatório')}</div>`);
    q('#run').addEventListener('click',()=>{try{const d=q('#delimiter').value,ra=parseCsv(q('#a').value,d),rb=parseCsv(q('#b').value,d),ha=ra.shift(),hb=rb.shift(),key=q('#key').value.trim(),ki=ha.indexOf(key);if(ki<0)throw new Error('Coluna-chave não encontrada no CSV A.');const mapB=new Map(rb.map(r=>[r[hb.indexOf(key)],r])),diff=[];ra.forEach(r=>{const id=r[ki],other=mapB.get(id);if(!other){diff.push(`Somente A: ${id}`);return;}ha.forEach((h,i)=>{const bi=hb.indexOf(h),av=r[i]||'',bv=bi>=0?(other[bi]||''):'[coluna ausente]';if(av!==bv)diff.push(`${id} · ${h}: A="${av}" | B="${bv}"`);});mapB.delete(id);});mapB.forEach((_,id)=>diff.push(`Somente B: ${id}`));addText('#output',diff.length?diff.join('\n'):'Nenhuma diferença encontrada.');status(`${diff.length} diferença(s) encontrada(s).`,diff.length?'warning':'success');track('tool_use',{action_detail:'compare_csv',differences:diff.length});}catch(error){status(error.message,'error');}});
  }

  const typeMatches=(value,type)=>({object:value!==null&&typeof value==='object'&&!Array.isArray(value),array:Array.isArray(value),string:typeof value==='string',number:typeof value==='number'&&!Number.isNaN(value),integer:Number.isInteger(value),boolean:typeof value==='boolean',null:value===null}[type]??true);
  const validateSchemaSubset=(value,schema,path='$',errors=[])=>{if(!schema||typeof schema!=='object')return errors;if(schema.type&&!typeMatches(value,schema.type))errors.push(`${path}: esperado ${schema.type}, recebido ${Array.isArray(value)?'array':value===null?'null':typeof value}`);if(schema.enum&&!schema.enum.some(v=>JSON.stringify(v)===JSON.stringify(value)))errors.push(`${path}: valor fora do enum`);if(typeof value==='string'){if(schema.minLength!=null&&value.length<schema.minLength)errors.push(`${path}: tamanho mínimo ${schema.minLength}`);if(schema.maxLength!=null&&value.length>schema.maxLength)errors.push(`${path}: tamanho máximo ${schema.maxLength}`);if(schema.pattern){try{if(!new RegExp(schema.pattern).test(value))errors.push(`${path}: não corresponde ao pattern`);}catch(_){errors.push(`${path}: pattern inválido no schema`);}}}if(typeof value==='number'){if(schema.minimum!=null&&value<schema.minimum)errors.push(`${path}: menor que minimum ${schema.minimum}`);if(schema.maximum!=null&&value>schema.maximum)errors.push(`${path}: maior que maximum ${schema.maximum}`);}if(Array.isArray(value)){if(schema.minItems!=null&&value.length<schema.minItems)errors.push(`${path}: menos itens que minItems`);if(schema.maxItems!=null&&value.length>schema.maxItems)errors.push(`${path}: mais itens que maxItems`);if(schema.items)value.forEach((v,i)=>validateSchemaSubset(v,schema.items,`${path}[${i}]`,errors));}if(value&&typeof value==='object'&&!Array.isArray(value)){(schema.required||[]).forEach(k=>{if(!(k in value))errors.push(`${path}.${k}: campo obrigatório ausente`);});Object.entries(schema.properties||{}).forEach(([k,s])=>{if(k in value)validateSchemaSubset(value[k],s,`${path}.${k}`,errors);});}return errors;};
  function jsonSchemaValidator() {
    setHtml(`<div class="two-col">${textarea('json','JSON','{"id":1,"nome":"Ana","ativo":true}',16)}${textarea('schema','JSON Schema','{"type":"object","required":["id","nome"],"properties":{"id":{"type":"integer","minimum":1},"nome":{"type":"string","minLength":2},"ativo":{"type":"boolean"}}}',16)}</div>${standardActions('run','Validar JSON','#output','validacao-schema.txt')}${outputBox('output','Resultado')}</div>`);
    q('#run').addEventListener('click',()=>{try{const errors=validateSchemaSubset(JSON.parse(q('#json').value),JSON.parse(q('#schema').value));addText('#output',errors.length?errors.map((e,i)=>`${i+1}. ${e}`).join('\n'):'JSON válido para o subconjunto de regras analisado.');status(errors.length?`${errors.length} problema(s) encontrado(s).`:'Validação concluída sem erros.',errors.length?'error':'success');track('tool_use',{action_detail:'validate_json_schema',errors:errors.length});}catch(error){status(error.message,'error');}});
  }

  const inferSchema=(value)=>{if(value===null)return{type:'null'};if(Array.isArray(value)){const types=value.slice(0,20).map(inferSchema);return{type:'array',items:types[0]||{}};}if(typeof value==='object'){const properties={};Object.entries(value).forEach(([k,v])=>properties[k]=inferSchema(v));return{type:'object',properties,required:Object.keys(value)};}return{type:Number.isInteger(value)?'integer':typeof value};};
  function jsonSchemaGenerator() {
    setHtml(`${textarea('input','JSON de exemplo','{"id":123,"nome":"Ana","tags":["qa","api"],"ativo":true}',16)}<div class="options-row"><label class="check"><input id="required" type="checkbox" checked> Marcar campos como obrigatórios</label><label class="check"><input id="draft" type="checkbox" checked> Incluir $schema</label></div>${standardActions('run','Gerar JSON Schema','#output','schema.json')}${outputBox('output','JSON Schema')}</div>`);
    q('#run').addEventListener('click',()=>{try{const schema=inferSchema(JSON.parse(q('#input').value));if(!q('#required').checked){const strip=(s)=>{delete s.required;if(s.properties)Object.values(s.properties).forEach(strip);if(s.items)strip(s.items);};strip(schema);}if(q('#draft').checked)schema.$schema='https://json-schema.org/draft/2020-12/schema';addText('#output',JSON.stringify(schema,null,2));status('Schema inicial gerado. Revise regras de formato, limites e obrigatoriedade.','success');track('tool_use',{action_detail:'generate_json_schema'});}catch(error){status(error.message,'error');}});
  }

  function openApiValidator() {
    setHtml(`${textarea('input','OpenAPI em JSON ou YAML','openapi: 3.0.3\ninfo:\n  title: API de exemplo\n  version: 1.0.0\npaths:\n  /usuarios:\n    get:\n      responses:\n        "200":\n          description: OK',20)}${standardActions('run','Analisar contrato','#output','relatorio-openapi.txt')}${outputBox('output','Relatório')}</div>`);
    q('#run').addEventListener('click',()=>{try{const doc=parseYamlBasic(q('#input').value),issues=[];if(!doc.openapi&&!doc.swagger)issues.push('Campo openapi ou swagger ausente.');if(!doc.info?.title)issues.push('info.title ausente.');if(!doc.info?.version)issues.push('info.version ausente.');if(!doc.paths||typeof doc.paths!=='object')issues.push('paths ausente ou inválido.');let operations=0;Object.entries(doc.paths||{}).forEach(([path,item])=>{if(!path.startsWith('/'))issues.push(`Caminho sem / inicial: ${path}`);['get','post','put','patch','delete','options','head'].forEach(method=>{if(item?.[method]){operations++;const op=item[method];if(!op.responses||!Object.keys(op.responses).length)issues.push(`${method.toUpperCase()} ${path}: responses ausente.`);}});});addText('#output',`Versão: ${doc.openapi||doc.swagger||'não informada'}\nOperações: ${operations}\nCaminhos: ${Object.keys(doc.paths||{}).length}\n\n${issues.length?issues.map((x,i)=>`${i+1}. ${x}`).join('\n'):'Nenhum problema estrutural básico detectado.'}`);status(issues.length?`${issues.length} alerta(s) estrutural(is).`:'Contrato básico analisado sem alertas.',issues.length?'warning':'success');track('tool_use',{action_detail:'validate_openapi',issues:issues.length});}catch(error){status(error.message,'error');}});
  }

  function cronGenerator() {
    const options=(from,to,any=true)=>`${any?'<option value="*">Qualquer</option>':''}${Array.from({length:to-from+1},(_,i)=>`<option value="${i+from}">${i+from}</option>`).join('')}`;
    setHtml(`<div class="five-col"><div class="field"><label for="minute">Minuto</label><select id="minute">${options(0,59)}</select></div><div class="field"><label for="hour">Hora</label><select id="hour">${options(0,23)}</select></div><div class="field"><label for="day">Dia do mês</label><select id="day">${options(1,31)}</select></div><div class="field"><label for="month">Mês</label><select id="month">${options(1,12)}</select></div><div class="field"><label for="weekday">Dia da semana</label><select id="weekday">${options(0,6)}</select></div></div><div class="options-row"><button class="chip" data-cron="*/5 * * * *">A cada 5 min</button><button class="chip" data-cron="0 * * * *">A cada hora</button><button class="chip" data-cron="0 9 * * 1-5">Dias úteis às 09h</button><button class="chip" data-cron="0 0 1 * *">Todo dia 1</button></div>${outputBox('output','Expressão Cron')}<div class="human-result" id="human"></div><div class="actions"><button class="btn btn-primary" id="run">Gerar</button><button class="btn btn-secondary" data-copy-target="#output">Copiar</button></div><div class="status" id="status"></div>`);
    const explain=(parts)=>{const [m,h,d,mo,w]=parts;return `${m==='*'?'a cada minuto':m.startsWith('*/')?`a cada ${m.slice(2)} minutos`:`no minuto ${m}`}, ${h==='*'?'em qualquer hora':`às ${String(h).padStart(2,'0')}:${m==='*'?'00':String(m).padStart(2,'0')}`}, ${d==='*'?'em qualquer dia do mês':`no dia ${d}`}, ${mo==='*'?'em qualquer mês':`no mês ${mo}`}, ${w==='*'?'em qualquer dia da semana':`dia da semana ${w}`}.`;};
    const show=(cron)=>{addText('#output',cron);q('#human').textContent=explain(cron.split(/\s+/));status('Expressão gerada. Confirme o fuso horário do agendador.','success');track('tool_use',{action_detail:'generate_cron'});};q('#run').addEventListener('click',()=>show([q('#minute').value,q('#hour').value,q('#day').value,q('#month').value,q('#weekday').value].join(' ')));qa('[data-cron]').forEach(btn=>btn.addEventListener('click',()=>show(btn.dataset.cron)));q('#run').click();
  }

  function envFormatter() {
    setHtml(`${textarea('input','Conteúdo .env','API_URL=https://api.example.test\nAPI_TOKEN=segredo-local\nPORT=8080\nDEBUG=true',16)}<div class="options-row"><label class="check"><input id="sort" type="checkbox" checked> Ordenar chaves</label><label class="check"><input id="mask" type="checkbox" checked> Mascarar segredos na visualização</label><label class="check"><input id="duplicates" type="checkbox" checked> Detectar duplicadas</label></div>${standardActions('run','Formatar .env','#output','config.env')}${outputBox('output','Resultado')}</div>`);
    q('#run').addEventListener('click',()=>{const lines=q('#input').value.split(/\r?\n/),items=[],comments=[],seen=new Map(),dups=[];lines.forEach((line,i)=>{const t=line.trim();if(!t||t.startsWith('#')){if(t)comments.push(t);return;}const idx=t.indexOf('=');if(idx<1){dups.push(`Linha ${i+1}: sem sinal =`);return;}const key=t.slice(0,idx).trim(),value=t.slice(idx+1).trim();if(seen.has(key))dups.push(`Chave duplicada: ${key}`);seen.set(key,true);items.push({key,value});});if(q('#sort').checked)items.sort((a,b)=>a.key.localeCompare(b.key));const sensitive=/SECRET|TOKEN|PASSWORD|PASS|API_KEY|PRIVATE|CREDENTIAL/i;const out=items.map(({key,value})=>`${key}=${q('#mask').checked&&sensitive.test(key)?'••••••••':value}`).join('\n');addText('#output',`${comments.join('\n')}${comments.length?'\n':''}${out}`);status(dups.length?dups.join(' · '):`${items.length} variável(is) organizada(s).`,dups.length?'warning':'success');track('tool_use',{action_detail:'format_env',issues:dups.length});});
  }

  function headersAnalyzer() {
    setHtml(`${textarea('input','Headers HTTP','content-type: application/json; charset=utf-8\ncache-control: no-store\naccess-control-allow-origin: https://app.example.test\nstrict-transport-security: max-age=31536000; includeSubDomains',16)}<div class="actions"><button class="btn btn-primary" id="run">Analisar headers</button></div><div class="header-analysis" id="analysis"></div><div class="status" id="status"></div>`);
    q('#run').addEventListener('click',()=>{const headers=new Map(),issues=[];q('#input').value.split(/\r?\n/).filter(Boolean).forEach(line=>{const i=line.indexOf(':');if(i>0)headers.set(line.slice(0,i).trim().toLowerCase(),line.slice(i+1).trim());});const checks=[['content-type','Tipo de conteúdo'],['cache-control','Cache'],['content-security-policy','Content Security Policy'],['strict-transport-security','HSTS'],['x-content-type-options','MIME sniffing'],['referrer-policy','Referrer Policy'],['permissions-policy','Permissions Policy'],['access-control-allow-origin','CORS']];if(!headers.has('content-type'))issues.push('Content-Type ausente.');if(headers.get('access-control-allow-origin')==='*'&&headers.get('access-control-allow-credentials')==='true')issues.push('CORS inseguro: origem * com credenciais.');if(!headers.has('x-content-type-options'))issues.push('Considere X-Content-Type-Options: nosniff.');q('#analysis').innerHTML=`<div class="analysis-grid">${checks.map(([key,label])=>`<div class="analysis-item ${headers.has(key)?'ok':'missing'}"><strong>${label}</strong><span>${esc(headers.get(key)||'Não informado')}</span></div>`).join('')}</div>${issues.length?`<div class="note warning-note"><strong>Alertas</strong><ul>${issues.map(i=>`<li>${esc(i)}</li>`).join('')}</ul></div>`:''}`;status(`${headers.size} header(s) analisado(s). A ferramenta fornece uma revisão básica, não uma auditoria de segurança.`,issues.length?'warning':'success');track('tool_use',{action_detail:'analyze_headers',issues:issues.length});});q('#run').click();
  }

  function markdownTableGenerator() {
    setHtml(`${textarea('input','Dados separados por tabulação, vírgula ou ponto e vírgula','Nome\tÁrea\tStatus\nAna\tQA\tAtivo\nBruno\tDesenvolvimento\tAtivo',12)}<div class="two-col"><div class="field"><label for="delimiter">Separador de entrada</label><select id="delimiter"><option value="\t">Tabulação</option><option value=",">Vírgula</option><option value=";">Ponto e vírgula</option></select></div><div class="field"><label for="align">Alinhamento</label><select id="align"><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></div></div>${standardActions('run','Gerar tabela Markdown','#output','tabela.md')}${outputBox('output','Markdown')}</div>`);
    q('#run').addEventListener('click',()=>{const rows=parseCsv(q('#input').value,q('#delimiter').value);if(!rows.length)return status('Informe os dados.','warning');const cols=Math.max(...rows.map(r=>r.length)),header=rows[0],marker={left:':---',center:':---:',right:'---:'}[q('#align').value],line=r=>`| ${Array.from({length:cols},(_,i)=>String(r[i]||'').replaceAll('|','\\|')).join(' | ')} |`;addText('#output',[line(header),line(Array(cols).fill(marker)),...rows.slice(1).map(line)].join('\n'));status('Tabela Markdown gerada.','success');track('tool_use',{action_detail:'generate_markdown_table'});});q('#run').click();
  }

  function delimiterConverter() {
    setHtml(`${textarea('input','CSV ou texto delimitado','id;nome;status\n1;Ana;ativo\n2;Bruno;inativo',14)}<div class="two-col"><div class="field"><label for="from">Separador atual</label><select id="from"><option value=";">Ponto e vírgula</option><option value=",">Vírgula</option><option value="\t">Tabulação</option><option value="|">Barra vertical</option></select></div><div class="field"><label for="to">Novo separador</label><select id="to"><option value=",">Vírgula</option><option value=";">Ponto e vírgula</option><option value="\t">Tabulação</option><option value="|">Barra vertical</option></select></div></div>${standardActions('run','Converter delimitador','#output','dados-convertidos.csv')}${outputBox('output')}</div>`);
    q('#run').addEventListener('click',()=>{const from=q('#from').value,to=q('#to').value,rows=parseCsv(q('#input').value,from);addText('#output',rows.map(r=>r.map(v=>csvCell(v,to)).join(to)).join('\n'));status(`${rows.length} linha(s) convertida(s).`,'success');track('tool_use',{action_detail:'convert_delimiter'});});q('#run').click();
  }

  function slugGenerator() {
    setHtml(`${textarea('input','Texto','Como criar testes de API confiáveis',6)}<div class="options-row"><label class="check"><input id="trim" type="checkbox" checked> Remover hífens das bordas</label><label class="check"><input id="lower" type="checkbox" checked> Minúsculas</label></div>${standardActions('run','Gerar slug','#output','slug.txt')}${outputBox('output','Slug')}</div>`);
    q('#run').addEventListener('click',()=>{let value=q('#input').value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-');if(q('#trim').checked)value=value.replace(/^-+|-+$/g,'');if(q('#lower').checked)value=value.toLowerCase();addText('#output',value);status('Slug gerado.','success');track('tool_use',{action_detail:'generate_slug'});});q('#run').click();
  }

  function utmGenerator() {
    setHtml(`${field('url','URL de destino','url','https://utilitariosqa.com.br/ferramentas/formatador-json.html')}<div class="three-col">${field('source','utm_source','text','linkedin')}${field('medium','utm_medium','text','social')}${field('campaign','utm_campaign','text','divulgacao_ferramentas')}</div><div class="two-col">${field('term','utm_term','text','')}${field('content','utm_content','text','post_json')}</div>${standardActions('run','Gerar URL com UTM','#output','url-utm.txt')}${outputBox('output','URL final')}</div>`);
    q('#run').addEventListener('click',()=>{try{const url=new URL(q('#url').value.trim());[['utm_source','#source'],['utm_medium','#medium'],['utm_campaign','#campaign'],['utm_term','#term'],['utm_content','#content']].forEach(([k,s])=>{const v=q(s).value.trim();if(v)url.searchParams.set(k,v);});addText('#output',url.toString());status('URL criada. Não inclua dados pessoais nos parâmetros UTM.','success');track('tool_use',{action_detail:'generate_utm'});}catch(_){status('Informe uma URL completa e válida.','error');}});q('#run').click();
  }

  function metaTagsGenerator() {
    setHtml(`${field('title','Título','text','Ferramenta online gratuita | Utilitários QA','maxlength="70"')}${textarea('description','Meta description','Resolva uma tarefa diretamente no navegador, sem cadastro e com privacidade.',4,'maxlength="180"')}${field('url','URL canônica','url','https://utilitariosqa.com.br/')}${field('image','Imagem de compartilhamento','url','https://utilitariosqa.com.br/assets/img/og-global.png')}<div class="actions"><button class="btn btn-primary" id="run">Gerar meta tags</button><button class="btn btn-secondary" data-copy-target="#output">Copiar HTML</button></div>${outputBox('output','HTML')}<div class="serp-preview"><span id="preview-url"></span><h3 id="preview-title"></h3><p id="preview-desc"></p></div><div class="status" id="status"></div>`);
    q('#run').addEventListener('click',()=>{const title=q('#title').value.trim(),desc=q('#description').value.trim(),url=q('#url').value.trim(),image=q('#image').value.trim(),html=`<title>${esc(title)}</title>\n<meta name="description" content="${esc(desc)}">\n<link rel="canonical" href="${esc(url)}">\n<meta property="og:type" content="website">\n<meta property="og:title" content="${esc(title)}">\n<meta property="og:description" content="${esc(desc)}">\n<meta property="og:url" content="${esc(url)}">\n<meta property="og:image" content="${esc(image)}">\n<meta name="twitter:card" content="summary_large_image">`;addText('#output',html);q('#preview-url').textContent=url;q('#preview-title').textContent=title;q('#preview-desc').textContent=desc;status(`Título: ${title.length} caracteres · descrição: ${desc.length} caracteres.`,'success');track('tool_use',{action_detail:'generate_meta_tags'});});q('#run').click();
  }

  function robotsSitemapGenerator() {
    setHtml(`${field('domain','Domínio','url','https://example.com')}${textarea('paths','Caminhos indexáveis, um por linha','/\n/ferramentas/\n/guias/\n/sobre.html',10)}<div class="options-row"><label class="check"><input id="block-admin" type="checkbox" checked> Bloquear /admin/</label><label class="check"><input id="include-lastmod" type="checkbox" checked> Incluir lastmod no sitemap</label></div><div class="actions"><button class="btn btn-primary" id="run">Gerar arquivos</button></div><div class="two-col">${outputBox('robots','robots.txt')}${outputBox('sitemap','sitemap.xml')}</div><div class="actions"><button class="btn btn-secondary" data-copy-target="#robots">Copiar robots</button><button class="btn btn-secondary" data-copy-target="#sitemap">Copiar sitemap</button></div><div class="status" id="status"></div>`);
    q('#run').addEventListener('click',()=>{try{const base=new URL(q('#domain').value.trim());const paths=q('#paths').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean),sitemapUrl=`${base.origin}/sitemap.xml`;addText('#robots',`User-agent: *\nAllow: /\n${q('#block-admin').checked?'Disallow: /admin/\n':''}Sitemap: ${sitemapUrl}\n`);const date=new Date().toISOString().slice(0,10),urls=paths.map(p=>`  <url>\n    <loc>${esc(new URL(p,base.origin).href)}</loc>${q('#include-lastmod').checked?`\n    <lastmod>${date}</lastmod>`:''}\n  </url>`).join('\n');addText('#sitemap',`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`);status(`${paths.length} URL(s) incluída(s). Revise antes de publicar.`, 'success');track('tool_use',{action_detail:'generate_robots_sitemap'});}catch(_){status('Informe um domínio completo e válido.','error');}});q('#run').click();
  }

  const hexToRgb=(hex)=>{let h=String(hex).replace('#','').trim();if(h.length===3)h=[...h].map(c=>c+c).join('');if(!/^[0-9a-f]{6}$/i.test(h))throw new Error('HEX inválido.');return[0,2,4].map(i=>parseInt(h.slice(i,i+2),16));};
  const rgbToHsl=(r,g,b)=>{r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),l=(max+min)/2;let h=0,s=0;if(max!==min){const d=max-min;s=l>.5?d/(2-max-min):d/(max+min);switch(max){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;default:h=(r-g)/d+4;}h/=6;}return[Math.round(h*360),Math.round(s*100),Math.round(l*100)];};
  const hslToRgb=(h,s,l)=>{h=((h%360)+360)%360/360;s/=100;l/=100;if(s===0)return[Math.round(l*255),Math.round(l*255),Math.round(l*255)];const hue=(p,q,t)=>{if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;};const qv=l<.5?l*(1+s):l+s-l*s,p=2*l-qv;return[hue(p,qv,h+1/3),hue(p,qv,h),hue(p,qv,h-1/3)].map(v=>Math.round(v*255));};
  function colorConverter() {
    setHtml(`<div class="two-col"><section class="mini-panel"><h3>HEX / RGB</h3>${field('hex','HEX','text','#3157d5')}<div class="three-col">${field('r','R','number','49','min="0" max="255"')}${field('g','G','number','87','min="0" max="255"')}${field('b','B','number','213','min="0" max="255"')}</div></section><section class="mini-panel"><h3>HSL</h3><div class="three-col">${field('h','H','number','226','min="0" max="360"')}${field('s','S %','number','66','min="0" max="100"')}${field('l','L %','number','51','min="0" max="100"')}</div><div class="color-large" id="preview"></div></section></div><div class="actions"><button class="btn btn-primary" id="from-hex">Converter HEX</button><button class="btn btn-secondary" id="from-rgb">Converter RGB</button><button class="btn btn-secondary" id="from-hsl">Converter HSL</button></div>${outputBox('output','Formatos')}<div class="status" id="status"></div>`);
    const show=(r,g,b)=>{const hex=`#${[r,g,b].map(v=>clamp(v,0,255).toString(16).padStart(2,'0')).join('')}`.toUpperCase(),[h,s,l]=rgbToHsl(r,g,b);q('#hex').value=hex;q('#r').value=r;q('#g').value=g;q('#b').value=b;q('#h').value=h;q('#s').value=s;q('#l').value=l;q('#preview').style.background=hex;addText('#output',`${hex}\nrgb(${r}, ${g}, ${b})\nhsl(${h}, ${s}%, ${l}%)`);status('Cor convertida.','success');track('tool_use',{action_detail:'convert_color'});};q('#from-hex').addEventListener('click',()=>{try{show(...hexToRgb(q('#hex').value));}catch(e){status(e.message,'error');}});q('#from-rgb').addEventListener('click',()=>show(clamp(q('#r').value,0,255),clamp(q('#g').value,0,255),clamp(q('#b').value,0,255)));q('#from-hsl').addEventListener('click',()=>show(...hslToRgb(clamp(q('#h').value,0,360),clamp(q('#s').value,0,100),clamp(q('#l').value,0,100))));q('#from-hex').click();
  }

  function gradientGenerator() {
    setHtml(`<div class="four-col"><div class="field"><label for="type">Tipo</label><select id="type"><option value="linear">Linear</option><option value="radial">Radial</option></select></div>${field('angle','Ângulo','number','135','min="0" max="360"')}${field('c1','Cor inicial','color','#3157d5')}${field('c2','Cor final','color','#21b58d')}</div><div class="gradient-preview" id="preview"></div>${standardActions('run','Gerar CSS','#output','gradiente.css')}${outputBox('output','CSS')}</div>`);
    const generate=()=>{const type=q('#type').value,css=type==='linear'?`linear-gradient(${clamp(q('#angle').value,0,360)}deg, ${q('#c1').value}, ${q('#c2').value})`:`radial-gradient(circle, ${q('#c1').value}, ${q('#c2').value})`;q('#preview').style.background=css;addText('#output',`background: ${css};`);status('Gradiente CSS gerado.','success');track('tool_use',{action_detail:'generate_gradient'});};q('#run').addEventListener('click',generate);qa('input,select',app).forEach(x=>x.addEventListener('input',generate));generate();
  }

  function boxShadowGenerator() {
    setHtml(`<div class="five-col">${field('x','X','range','0','min="-50" max="50"')}${field('y','Y','range','14','min="-50" max="50"')}${field('blur','Desfoque','range','35','min="0" max="100"')}${field('spread','Expansão','range','-10','min="-50" max="50"')}${field('color','Cor','color','#000000')}</div>${field('opacity','Opacidade','range','0.24','min="0" max="1" step="0.01"')}<label class="check"><input id="inset" type="checkbox"> Sombra interna (inset)</label><div class="shadow-preview"><div id="preview">Prévia</div></div>${standardActions('run','Gerar CSS','#output','box-shadow.css')}${outputBox('output','CSS')}</div>`);
    const gen=()=>{const [r,g,b]=hexToRgb(q('#color').value),css=`${q('#inset').checked?'inset ':''}${q('#x').value}px ${q('#y').value}px ${q('#blur').value}px ${q('#spread').value}px rgba(${r}, ${g}, ${b}, ${q('#opacity').value})`;q('#preview').style.boxShadow=css;addText('#output',`box-shadow: ${css};`);status('Box shadow gerada.','success');track('tool_use',{action_detail:'generate_box_shadow'});};q('#run').addEventListener('click',gen);qa('input',app).forEach(x=>x.addEventListener('input',gen));gen();
  }

  function hmacGenerator() {
    setHtml(`${textarea('message','Mensagem','payload de teste',8)}${field('secret','Chave secreta','password','segredo-apenas-para-teste')}<div class="field"><label for="algorithm">Algoritmo</label><select id="algorithm"><option value="SHA-256">HMAC-SHA-256</option><option value="SHA-384">HMAC-SHA-384</option><option value="SHA-512">HMAC-SHA-512</option></select></div>${standardActions('run','Gerar HMAC','#output','hmac.txt')}${outputBox('output','HMAC hexadecimal')}</div>`);
    q('#run').addEventListener('click',async()=>{try{const enc=new TextEncoder(),key=await crypto.subtle.importKey('raw',enc.encode(q('#secret').value),{name:'HMAC',hash:q('#algorithm').value},false,['sign']),sig=await crypto.subtle.sign('HMAC',key,enc.encode(q('#message').value)),hex=[...new Uint8Array(sig)].map(b=>b.toString(16).padStart(2,'0')).join('');addText('#output',hex);status('HMAC calculado localmente. Não use segredos de produção em ferramentas Web.','success');track('tool_use',{action_detail:'generate_hmac'});}catch(error){status(error.message,'error');}});
  }

  function fileChecksum() {
    setHtml(`<div class="field"><label for="file">Arquivo</label><input id="file" type="file"></div><div class="field"><label for="algorithm">Algoritmo</label><select id="algorithm"><option value="SHA-256">SHA-256</option><option value="SHA-384">SHA-384</option><option value="SHA-512">SHA-512</option></select></div>${standardActions('run','Calcular checksum','#output','checksum.txt')}${outputBox('output','Checksum')}</div>`);
    q('#run').addEventListener('click',async()=>{const file=q('#file').files[0];if(!file)return status('Selecione um arquivo.','warning');try{status(`Lendo ${bytesLabel(file.size)}…`,'info');const hash=await crypto.subtle.digest(q('#algorithm').value,await file.arrayBuffer()),hex=[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');addText('#output',`${q('#algorithm').value}  ${hex}  ${file.name}`);status('Checksum calculado localmente.','success');track('tool_use',{action_detail:'file_checksum',file_size:file.size});}catch(error){status(error.message,'error');}});
  }

  function pairwiseGenerator() {
    setHtml(`${textarea('input','Fatores e valores','Navegador: Chrome, Firefox, Safari\nPerfil: Admin, Cliente, Visitante\nPagamento: Cartão, Pix, Boleto\nIdioma: PT, EN',12)}<p class="small muted">Formato: um fator por linha, seguido de dois-pontos e valores separados por vírgula.</p>${standardActions('run','Gerar combinações Pairwise','#output','pairwise.csv')}${outputBox('output','CSV gerado')}</div>`);
    q('#run').addEventListener('click',()=>{try{const factors=q('#input').value.split(/\r?\n/).filter(Boolean).map(line=>{const i=line.indexOf(':');if(i<1)throw new Error(`Linha inválida: ${line}`);return{name:line.slice(0,i).trim(),values:line.slice(i+1).split(',').map(v=>v.trim()).filter(Boolean)};});if(factors.length<2)throw new Error('Informe pelo menos dois fatores.');if(factors.some(f=>f.values.length<2))throw new Error('Cada fator deve ter pelo menos dois valores.');const needed=new Set();for(let i=0;i<factors.length;i++)for(let j=i+1;j<factors.length;j++)for(const a of factors[i].values)for(const b of factors[j].values)needed.add(`${i}:${a}|${j}:${b}`);const all=[];const build=(idx,row)=>{if(idx===factors.length){all.push([...row]);return;}factors[idx].values.forEach(v=>{row.push(v);build(idx+1,row);row.pop();});};build(0,[]);const selected=[];while(needed.size&&all.length){let bestIndex=0,bestScore=-1;all.forEach((row,idx)=>{let score=0;for(let i=0;i<row.length;i++)for(let j=i+1;j<row.length;j++)if(needed.has(`${i}:${row[i]}|${j}:${row[j]}`))score++;if(score>bestScore){bestScore=score;bestIndex=idx;}});if(bestScore<=0)break;const row=all.splice(bestIndex,1)[0];selected.push(row);for(let i=0;i<row.length;i++)for(let j=i+1;j<row.length;j++)needed.delete(`${i}:${row[i]}|${j}:${row[j]}`);}const csv=[factors.map(f=>csvCell(f.name)).join(','),...selected.map(r=>r.map(csvCell).join(','))].join('\n');addText('#output',csv);status(`${selected.length} combinação(ões) gerada(s), reduzindo ${all.length+selected.length} combinações completas. Revise restrições de negócio.`,needed.size?'warning':'success');track('tool_use',{action_detail:'pairwise',cases:selected.length});}catch(error){status(error.message,'error');}});q('#run').click();
  }

  function decisionTable() {
    setHtml(`${textarea('conditions','Condições, uma por linha','Cliente é premium\nCompra acima de R$ 200\nCupom válido',8)}${textarea('actions','Ações, uma por linha','Aplicar frete grátis\nAplicar desconto\nExibir mensagem de cupom inválido',6)}<div class="actions"><button class="btn btn-primary" id="run">Gerar regras</button><button class="btn btn-secondary" data-copy-target="#output">Copiar CSV</button><button class="btn btn-secondary" data-download-target="#output" data-filename="tabela-decisao.csv">Baixar CSV</button></div>${outputBox('output','Tabela de decisão inicial')}<div class="status" id="status"></div>`);
    q('#run').addEventListener('click',()=>{const cond=q('#conditions').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean),actions=q('#actions').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(!cond.length)return status('Informe pelo menos uma condição.','warning');if(cond.length>10)return status('Use até 10 condições para evitar uma tabela muito grande.','warning');const count=2**cond.length,headers=['Item',...Array.from({length:count},(_,i)=>`R${i+1}`)],rows=[headers];cond.forEach((c,idx)=>rows.push([`C: ${c}`,...Array.from({length:count},(_,rule)=>((rule>>(cond.length-idx-1))&1)?'S':'N')]));actions.forEach(a=>rows.push([`A: ${a}`,...Array(count).fill('') ]));addText('#output',rows.map(r=>r.map(csvCell).join(',')).join('\n'));status(`${count} regra(s) criada(s). Preencha as ações aplicáveis em cada coluna e elimine combinações impossíveis.`, 'success');track('tool_use',{action_detail:'decision_table',rules:count});});q('#run').click();
  }

  function equivalencePartitioning() {
    setHtml(`<div class="two-col">${field('name','Campo ou regra','text','idade')}${field('type','Tipo','text','número inteiro')}</div><div class="two-col">${field('min','Mínimo válido','number','18')}${field('max','Máximo válido','number','65')}</div>${field('special','Regras adicionais','text','Obrigatório; não aceitar casas decimais')}<div class="actions"><button class="btn btn-primary" id="run">Gerar partições e valores</button></div><div class="table-scroll"><table class="data-table" id="table"></table></div>${outputBox('output','Casos sugeridos')}<div class="status" id="status"></div>`);
    q('#run').addEventListener('click',()=>{const name=q('#name').value||'campo',min=Number(q('#min').value),max=Number(q('#max').value);if(!Number.isFinite(min)||!Number.isFinite(max)||min>max)return status('Informe limites válidos.','error');const mid=Math.round((min+max)/2),rows=[['Classe','Válida?','Representantes','Objetivo'],[`Abaixo do mínimo (< ${min})`,'Não',`${min-1}, ${min-10}`,'Rejeitar valores abaixo da faixa'],[`Limite mínimo (${min})`,'Sim',String(min),'Aceitar o menor valor'],[`Faixa interna (${min+1}…${max-1})`,'Sim',String(mid),'Representar comportamento comum'],[`Limite máximo (${max})`,'Sim',String(max),'Aceitar o maior valor'],[`Acima do máximo (> ${max})`,'Não',`${max+1}, ${max+10}`,'Rejeitar acima da faixa'],['Ausente/nulo','Depende','vazio, null','Validar obrigatoriedade'],['Formato inválido','Não','texto, decimal, símbolo','Validar tipo e parsing']];q('#table').innerHTML=`<thead><tr>${rows[0].map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map(r=>`<tr>${r.map(x=>`<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody>`;addText('#output',`Campo: ${name}\n${rows.slice(1).map((r,i)=>`${i+1}. ${r[0]} — testar: ${r[2]}`).join('\n')}\nRegras adicionais: ${q('#special').value||'não informadas'}`);status('Partições e valores de fronteira sugeridos. Adapte à regra real do produto.','success');track('tool_use',{action_detail:'equivalence_partitioning'});});q('#run').click();
  }

  function stateTransitionModeler() {
    setHtml(`${textarea('input','Transições: estado inicial, evento, estado final','Novo, enviar, Em análise\nEm análise, aprovar, Aprovado\nEm análise, rejeitar, Rejeitado\nRejeitado, corrigir, Novo\nAprovado, cancelar, Cancelado',12)}<div class="actions"><button class="btn btn-primary" id="run">Gerar matriz e cenários</button><button class="btn btn-secondary" data-copy-target="#output">Copiar</button></div><div class="table-scroll"><table class="data-table" id="table"></table></div>${outputBox('output','Cenários sugeridos')}<div class="status" id="status"></div>`);
    q('#run').addEventListener('click',()=>{const transitions=q('#input').value.split(/\r?\n/).filter(Boolean).map((line,i)=>{const p=parseCsv(line,',')[0].map(x=>x.trim());if(p.length<3)throw new Error(`Linha ${i+1} inválida.`);return{from:p[0],event:p[1],to:p[2]};});const states=[...new Set(transitions.flatMap(t=>[t.from,t.to]))],events=[...new Set(transitions.map(t=>t.event))],map=new Map(transitions.map(t=>[`${t.from}|${t.event}`,t.to]));q('#table').innerHTML=`<thead><tr><th>Estado</th>${events.map(e=>`<th>${esc(e)}</th>`).join('')}</tr></thead><tbody>${states.map(s=>`<tr><th>${esc(s)}</th>${events.map(e=>`<td>${esc(map.get(`${s}|${e}`)||'Inválida / não definida')}</td>`).join('')}</tr>`).join('')}</tbody>`;const positive=transitions.map((t,i)=>`${i+1}. Dado estado "${t.from}", quando "${t.event}", então "${t.to}"`),negative=[];states.forEach(s=>events.forEach(e=>{if(!map.has(`${s}|${e}`))negative.push(`Estado "${s}" + evento "${e}" deve ser rejeitado ou tratado`);}));addText('#output',`TRANSIÇÕES VÁLIDAS\n${positive.join('\n')}\n\nTRANSIÇÕES AUSENTES/INVÁLIDAS\n${negative.join('\n')}`);status(`${states.length} estados, ${events.length} eventos e ${transitions.length} transições definidas.`,'success');track('tool_use',{action_detail:'state_transition',transitions:transitions.length});});
  }

  function riskMatrix() {
    setHtml(`${textarea('input','Itens: nome, probabilidade (1-5), impacto (1-5)','Pagamento indisponível,4,5\nBusca lenta,3,3\nErro visual no rodapé,2,1\nExposição de dados,2,5',10)}<div class="actions"><button class="btn btn-primary" id="run">Priorizar riscos</button><button class="btn btn-secondary" data-download-target="#output" data-filename="matriz-risco.csv">Baixar CSV</button></div><div class="risk-grid" id="risk-grid"></div>${outputBox('output','CSV priorizado')}<div class="status" id="status"></div>`);
    q('#run').addEventListener('click',()=>{try{const items=q('#input').value.split(/\r?\n/).filter(Boolean).map((line,i)=>{const p=parseCsv(line,',')[0];if(p.length<3)throw new Error(`Linha ${i+1} inválida.`);const probability=clamp(p[1],1,5),impact=clamp(p[2],1,5);return{name:p[0].trim(),probability,impact,score:probability*impact};}).sort((a,b)=>b.score-a.score);q('#risk-grid').innerHTML=items.map(x=>`<article class="risk-item risk-${x.score>=15?'high':x.score>=8?'medium':'low'}"><strong>${esc(x.name)}</strong><span>Probabilidade ${x.probability} × impacto ${x.impact}</span><b>${x.score}</b></article>`).join('');addText('#output',['risco,probabilidade,impacto,exposicao,prioridade',...items.map(x=>[x.name,x.probability,x.impact,x.score,x.score>=15?'Alta':x.score>=8?'Média':'Baixa'].map(csvCell).join(','))].join('\n'));status(`${items.length} risco(s) priorizado(s). A pontuação deve apoiar, não substituir, julgamento e contexto.`, 'success');track('tool_use',{action_detail:'risk_matrix',items:items.length});}catch(error){status(error.message,'error');}});q('#run').click();
  }

  function coverageCalculator() {
    setHtml(`<div class="coverage-inputs"><section class="mini-panel"><h3>Requisitos</h3>${field('req-total','Total','number','40','min="0"')}${field('req-covered','Cobertos','number','32','min="0"')}</section><section class="mini-panel"><h3>Execução</h3>${field('tests-total','Casos planejados','number','120','min="0"')}${field('tests-run','Executados','number','90','min="0"')}</section><section class="mini-panel"><h3>Automação</h3>${field('auto-candidates','Candidatos','number','80','min="0"')}${field('automated','Automatizados','number','52','min="0"')}</section><section class="mini-panel"><h3>Resultados</h3>${field('run-total','Executados','number','90','min="0"')}${field('passed','Aprovados','number','78','min="0"')}</section></div><div class="actions"><button class="btn btn-primary" id="run">Calcular indicadores</button></div><div class="metric-grid" id="metrics"></div><div class="status" id="status"></div>`);
    const pct=(a,b)=>b>0?a/b*100:0;q('#run').addEventListener('click',()=>{const data=[['Cobertura de requisitos',pct(Number(q('#req-covered').value),Number(q('#req-total').value))],['Progresso de execução',pct(Number(q('#tests-run').value),Number(q('#tests-total').value))],['Cobertura de automação',pct(Number(q('#automated').value),Number(q('#auto-candidates').value))],['Taxa de aprovação',pct(Number(q('#passed').value),Number(q('#run-total').value))]];q('#metrics').innerHTML=data.map(([name,v])=>`<article class="metric-card"><span>${esc(name)}</span><strong>${v.toFixed(1)}%</strong><progress max="100" value="${v}"></progress></article>`).join('');status('Indicadores calculados. Percentuais altos não garantem cobertura de risco ou qualidade dos casos.','success');track('tool_use',{action_detail:'coverage_metrics'});});q('#run').click();
  }

  function exploratoryChecklist() {
    setHtml(`<div class="two-col">${field('area','Área ou funcionalidade','text','Checkout e pagamento')}${field('timebox','Timebox','text','60 minutos')}</div>${textarea('mission','Missão','Explore o checkout usando diferentes perfis, produtos, formas de pagamento e interrupções para descobrir riscos de perda de pedido ou cobrança incorreta.',5)}<div class="options-grid"><label class="check"><input type="checkbox" data-item="Dados válidos, inválidos, limites e combinações"> Dados e limites</label><label class="check"><input type="checkbox" data-item="Sequências, voltar, repetir, atualizar e múltiplas abas"> Sequências e interrupções</label><label class="check"><input type="checkbox" data-item="Perfis, permissões, propriedade e sessão"> Permissões</label><label class="check"><input type="checkbox" data-item="Mensagens, recuperação e estado após falha"> Erros e recuperação</label><label class="check"><input type="checkbox" data-item="Teclado, foco, contraste, zoom e leitor de tela"> Acessibilidade</label><label class="check"><input type="checkbox" data-item="Tempo, concorrência, rede lenta e volume"> Desempenho e concorrência</label></div>${standardActions('run','Gerar charter','#output','charter-exploratorio.md')}${outputBox('output','Charter')}</div>`);
    q('#run').addEventListener('click',()=>{const items=qa('[data-item]:checked').map(x=>`- ${x.dataset.item}`).join('\n')||'- Defina heurísticas e variações relevantes';addText('#output',`# Charter de Teste Exploratório\n\n## Área\n${q('#area').value}\n\n## Missão\n${q('#mission').value}\n\n## Timebox\n${q('#timebox').value}\n\n## Focos\n${items}\n\n## Notas durante a sessão\n- Perguntas:\n- Riscos:\n- Defeitos:\n- Evidências:\n- Próximos testes:\n`);status('Charter criado. Mantenha espaço para aprendizado e mudança de direção durante a sessão.','success');track('tool_use',{action_detail:'exploratory_charter'});});
  }

  function apiTestCasesGenerator() {
    setHtml(`<div class="three-col"><div class="field"><label for="method">Método</label><select id="method"><option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option></select></div>${field('endpoint','Endpoint','text','/api/v1/usuarios/{id}')}${field('auth','Autenticação','text','Bearer token')}</div>${textarea('fields','Campos/regras importantes','id: UUID obrigatório\nnome: string 2-100\nemail: formato válido e único\nperfil: ADMIN ou CLIENTE',8)}<div class="options-row"><label class="check"><input id="security" type="checkbox" checked> Segurança e autorização</label><label class="check"><input id="performance" type="checkbox" checked> Desempenho e limites</label><label class="check"><input id="contract" type="checkbox" checked> Contrato e tipos</label></div>${standardActions('run','Gerar casos de teste','#output','casos-api.md')}${outputBox('output','Casos sugeridos')}</div>`);
    q('#run').addEventListener('click',()=>{const method=q('#method').value,ep=q('#endpoint').value,auth=q('#auth').value,fields=q('#fields').value;const cases=[`Sucesso — ${method} ${ep} com dados e autenticação válidos`,`Recurso inexistente — identificador bem formatado sem correspondência`,`Identificador malformado — valor fora do padrão esperado`,`Campo obrigatório ausente ou nulo`,`Tipo de dado incorreto em cada campo`,`Valores nos limites, imediatamente abaixo e acima`,`Caracteres Unicode, espaços, símbolos e conteúdo longo`,`Duplicidade e idempotência quando aplicável`,`Headers Content-Type e Accept ausentes ou incompatíveis`,`Método HTTP não permitido`];if(q('#security').checked)cases.push(`Sem autenticação (${auth})`,`Token inválido, expirado ou revogado`,`Perfil sem permissão`,`Acesso a recurso de outro usuário`,`Campos sensíveis não devem aparecer em resposta ou logs`);if(q('#contract').checked)cases.push('Campos obrigatórios, opcionais e adicionais no contrato','Tipos, formatos, enums e nullability','Compatibilidade com versão anterior da API');if(q('#performance').checked)cases.push('Resposta sob volume representativo','Limite de taxa e comportamento após 429','Timeout e falha de dependência','Concorrência e atualização simultânea');addText('#output',`# Casos de teste para ${method} ${ep}\n\n## Regras informadas\n\n\`\`\`\n${fields}\n\`\`\`\n\n## Cenários\n${cases.map((c,i)=>`${i+1}. ${c}`).join('\n')}\n\n## Para cada cenário validar\n- Status HTTP e headers\n- Corpo, tipos, valores e contrato\n- Persistência e efeitos colaterais\n- Logs sem dados sensíveis\n- Tempo e rastreabilidade\n`);status(`${cases.length} ideias de teste geradas. Priorize conforme risco e contrato real.`, 'success');track('tool_use',{action_detail:'generate_api_tests',cases:cases.length});});q('#run').click();
  }

  function mockJsonGenerator() {
    setHtml(`<div class="three-col">${field('count','Registros','number','5','min="1" max="200"')}${field('page','Página','number','1','min="1"')}${field('size','Tamanho da página','number','20','min="1" max="200"')}</div>${textarea('fields','Campos: nome, tipo, exemplo/opções','id,uuid\nnome,nome\nemail,email\nstatus,enum,ATIVO|INATIVO|PENDENTE\nvalor,number,10|500\ncriadoEm,date',10)}<div class="actions"><button class="btn btn-primary" id="run">Gerar resposta mock</button><button class="btn btn-secondary" data-copy-target="#output">Copiar</button><button class="btn btn-secondary" data-download-target="#output" data-filename="mock.json" data-mime="application/json">Baixar JSON</button></div>${outputBox('output','Resposta JSON')}<div class="status" id="status"></div>`);
    const names=['Ana Lima','Bruno Santos','Camila Rocha','Diego Martins','Elisa Souza','Fábio Costa','Gabriela Alves','Henrique Gomes'];const generateValue=(type,example,i)=>{switch(type){case'uuid':return crypto.randomUUID?.()||`${Date.now()}-${i}`;case'name':return names[i%names.length];case'email':return `usuario${i+1}@example.test`;case'number':{const [a,b]=String(example||'0|100').split('|').map(Number);return Number((a+Math.random()*(b-a)).toFixed(2));}case'integer':return randomInt(Number(example)||100);case'boolean':return i%2===0;case'date':return new Date(Date.now()-i*86400000).toISOString();case'enum':return String(example||'A|B').split('|')[i%String(example||'A|B').split('|').length];default:return example||`valor-${i+1}`;}};
    q('#run').addEventListener('click',()=>{try{const specs=q('#fields').value.split(/\r?\n/).filter(Boolean).map(line=>{const p=parseCsv(line,',')[0].map(x=>x.trim());return{name:p[0],type:p[1]||'string',example:p.slice(2).join(',')};}),count=clamp(q('#count').value,1,200),page=clamp(q('#page').value,1,1e6),size=clamp(q('#size').value,1,200),data=Array.from({length:count},(_,i)=>Object.fromEntries(specs.map(s=>[s.name,generateValue(s.type,s.example,i)]))),result={data,pagination:{page,size,totalElements:count*3,totalPages:Math.ceil(count*3/size)},meta:{generatedAt:new Date().toISOString(),fictional:true}};addText('#output',JSON.stringify(result,null,2));status(`${count} registro(s) fictício(s) gerado(s).`,'success');track('tool_use',{action_detail:'generate_mock_json',quantity:count});}catch(error){status(error.message,'error');}});q('#run').click();
  }

  function curlToRestAssured() {
    setHtml(`${textarea('input','Comando cURL',`curl -X POST 'https://api.example.test/v1/usuarios' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer TOKEN_TESTE' \\
  -d '{"nome":"Ana","email":"ana@example.test"}'`,12)}${standardActions('run','Converter para RestAssured','#output','requisicao-restassured.java')}${outputBox('output','Java / RestAssured')}</div>`);
    q('#run').addEventListener('click',()=>{try{const input=q('#input').value.replace(/\\\s*\n/g,' '),method=(input.match(/(?:-X|--request)\s+([A-Z]+)/i)?.[1]||(/\s-d\s|--data/.test(input)?'POST':'GET')).toLowerCase(),url=input.match(/(?:curl\s+)(?:-\S+\s+)*['"]?([^'"\s]+)['"]?/i)?.[1]||input.match(/https?:\/\/[^'"\s]+/)?.[0],headers=[...input.matchAll(/(?:-H|--header)\s+['"]([^:'"]+):\s*([^'"]+)['"]/gi)].map(m=>[m[1],m[2]]),body=input.match(/(?:-d|--data(?:-raw)?)\s+(['"])(.*?)\1/i)?.[2];if(!url)throw new Error('Não foi possível identificar a URL.');const lines=['import static io.restassured.RestAssured.given;','','var response = given()','    .relaxedHTTPSValidation()'];headers.forEach(([k,v])=>lines.push(`    .header(${JSON.stringify(k)}, ${JSON.stringify(v)})`));if(body)lines.push(`    .body(${JSON.stringify(body)})`);lines.push(`.when()`,`    .${method}(${JSON.stringify(url)})`,`.then()`,`    .log().ifValidationFails()`,`    .extract().response();`);addText('#output',lines.join('\n'));status('Conversão inicial concluída. Revise autenticação, serialização, parâmetros e asserts.','success');track('tool_use',{action_detail:'curl_to_restassured'});}catch(error){status(error.message,'error');}});q('#run').click();
  }

  function testCaseGenerator() {
    setHtml(`<div class="two-col">${field('id','ID','text','TC-001')}${field('title','Título','text','Cadastrar usuário com dados válidos')}</div>${textarea('objective','Objetivo','Validar que um usuário pode concluir o cadastro com informações válidas.',4)}${textarea('preconditions','Pré-condições','Usuário não cadastrado\nServiço de e-mail disponível',4)}${textarea('steps','Passos, um por linha','Acessar a tela de cadastro\nPreencher nome e e-mail válidos\nCriar uma senha conforme a política\nConfirmar o cadastro',7)}${textarea('expected','Resultado esperado','Cadastro concluído, usuário persistido e confirmação exibida sem dados sensíveis.',4)}<div class="actions"><button class="btn btn-primary" id="run">Gerar caso de teste</button><button class="btn btn-secondary" data-copy-target="#output">Copiar</button><button class="btn btn-secondary" data-download-target="#output" data-filename="caso-de-teste.md">Baixar Markdown</button></div>${outputBox('output','Caso de teste')}<div class="status" id="status"></div>`);
    q('#run').addEventListener('click',()=>{const steps=q('#steps').value.split(/\r?\n/).filter(Boolean);addText('#output',`# ${q('#id').value} — ${q('#title').value}\n\n## Objetivo\n${q('#objective').value}\n\n## Pré-condições\n${q('#preconditions').value.split(/\r?\n/).filter(Boolean).map(x=>`- ${x}`).join('\n')}\n\n## Passos\n${steps.map((x,i)=>`${i+1}. ${x}`).join('\n')}\n\n## Resultado esperado\n${q('#expected').value}\n\n## Dados / evidências\n- Dados fictícios:\n- Ambiente/build:\n- Evidências:\n`);status('Caso de teste estruturado. Prefira passos observáveis e evite detalhes frágeis de interface quando não forem essenciais.','success');track('tool_use',{action_detail:'generate_test_case'});});q('#run').click();
  }

  function bugReportGenerator() {
    setHtml(`${field('title','Título do defeito','text','[Checkout] Pedido é duplicado ao reenviar após timeout')}${textarea('environment','Ambiente','Build: 2026.07.21\nNavegador: Chrome\nPerfil: Cliente\nDados: pedido fictício #TEST-123',5)}${textarea('steps','Passos para reproduzir','Adicionar produto ao carrinho\nSelecionar pagamento de teste\nConfirmar com rede lenta\nApós timeout, clicar novamente em confirmar',7)}<div class="two-col">${textarea('actual','Resultado atual','Dois pedidos são criados e a interface mostra uma única confirmação.',4)}${textarea('expected','Resultado esperado','A operação deve ser idempotente e criar apenas um pedido.',4)}</div><div class="three-col"><div class="field"><label for="severity">Severidade</label><select id="severity"><option>Crítica</option><option selected>Alta</option><option>Média</option><option>Baixa</option></select></div><div class="field"><label for="frequency">Frequência</label><select id="frequency"><option>Sempre</option><option selected>Intermitente</option><option>Uma vez</option></select></div>${field('evidence','Evidências','text','Vídeo, logs e IDs de correlação')}</div>${standardActions('run','Gerar bug report','#output','bug-report.md')}${outputBox('output','Relatório')}</div>`);
    q('#run').addEventListener('click',()=>{const steps=q('#steps').value.split(/\r?\n/).filter(Boolean);addText('#output',`# ${q('#title').value}\n\n## Ambiente\n${q('#environment').value}\n\n## Passos para reproduzir\n${steps.map((x,i)=>`${i+1}. ${x}`).join('\n')}\n\n## Resultado atual\n${q('#actual').value}\n\n## Resultado esperado\n${q('#expected').value}\n\n## Impacto\n- Severidade: ${q('#severity').value}\n- Frequência: ${q('#frequency').value}\n\n## Evidências\n${q('#evidence').value}\n\n## Observações técnicas\n- IDs de correlação:\n- Logs relevantes sem dados sensíveis:\n- Hipóteses:\n`);status('Relatório gerado. Use um título observável e inclua dados mínimos para reprodução.','success');track('tool_use',{action_detail:'generate_bug_report'});});q('#run').click();
  }

  function testPlanGenerator() {
    setHtml(`${field('project','Produto ou iniciativa','text','Portal de pagamentos')}${textarea('scope','Escopo','Cadastro de pagamento\nAutorização\nCancelamento\nConsulta de transações',6)}${textarea('risks','Riscos prioritários','Cobrança duplicada\nExposição de dados\nIndisponibilidade da adquirente\nInconsistência de status',6)}${textarea('strategy','Estratégia','Testes de contrato e integração em CI\nCenários E2E críticos\nExploração por risco\nCarga nos endpoints principais',6)}<div class="three-col">${field('environments','Ambientes','text','QA, pré-produção')}${field('cycles','Ciclos','number','2','min="1" max="20"')}${field('team','Equipe','text','2 QAs, 3 devs')}</div>${standardActions('run','Gerar plano','#output','plano-testes.md')}${outputBox('output','Plano de testes inicial')}</div>`);
    q('#run').addEventListener('click',()=>{addText('#output',`# Plano de Testes — ${q('#project').value}\n\n## Objetivo\nReduzir riscos de negócio e técnicos por meio de feedback rápido, evidências confiáveis e critérios claros.\n\n## Escopo\n${q('#scope').value.split(/\r?\n/).filter(Boolean).map(x=>`- ${x}`).join('\n')}\n\n## Riscos prioritários\n${q('#risks').value.split(/\r?\n/).filter(Boolean).map(x=>`- ${x}`).join('\n')}\n\n## Estratégia\n${q('#strategy').value.split(/\r?\n/).filter(Boolean).map(x=>`- ${x}`).join('\n')}\n\n## Ambientes e dados\n- Ambientes: ${q('#environments').value}\n- Dados fictícios e isolados por execução\n- Dependências, mocks e observabilidade definidos\n\n## Execução\n- Ciclos planejados: ${q('#cycles').value}\n- Equipe: ${q('#team').value}\n- Smoke por build; regressão por risco; exploração direcionada\n\n## Critérios de entrada\n- Build implantado e estável\n- Requisitos e riscos discutidos\n- Dados e dependências disponíveis\n\n## Critérios de saída\n- Cenários críticos executados\n- Defeitos críticos tratados\n- Riscos residuais comunicados\n- Evidências e decisão registradas\n\n## Métricas úteis\n- Cobertura de risco\n- Tempo de feedback\n- Defeitos escapados e causa\n- Flakiness e custo de manutenção\n`);status('Plano inicial criado. Valide-o com produto, desenvolvimento, operações e segurança.','success');track('tool_use',{action_detail:'generate_test_plan'});});q('#run').click();
  }

  function regressionChecklist() {
    setHtml(`${textarea('areas','Áreas críticas, uma por linha','Autenticação e sessão\nCadastro e perfis\nBusca, filtros e paginação\nCheckout e pagamento\nNotificações\nRelatórios e exportações',9)}<div class="options-grid"><label class="check"><input type="checkbox" data-focus="Fluxos principais e alternativos" checked> Fluxos</label><label class="check"><input type="checkbox" data-focus="Permissões, perfis e propriedade" checked> Permissões</label><label class="check"><input type="checkbox" data-focus="Integrações, filas e dependências" checked> Integrações</label><label class="check"><input type="checkbox" data-focus="Navegadores, dispositivos e responsividade" checked> Plataformas</label><label class="check"><input type="checkbox" data-focus="Acessibilidade e teclado"> Acessibilidade</label><label class="check"><input type="checkbox" data-focus="Desempenho e volume"> Desempenho</label></div>${standardActions('run','Gerar checklist','#output','checklist-regressao.csv')}${outputBox('output','CSV')}</div>`);
    q('#run').addEventListener('click',()=>{const areas=q('#areas').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean),focus=qa('[data-focus]:checked').map(x=>x.dataset.focus),rows=[['Área','Foco','Risco','Automatizado','Status','Responsável','Evidência']];areas.forEach(a=>focus.forEach(f=>rows.push([a,f,'Definir','','Não executado','',''])));addText('#output',rows.map(r=>r.map(csvCell).join(',')).join('\n'));status(`${rows.length-1} item(ns) criado(s). Remova verificações sem risco e acrescente cenários específicos do produto.`, 'success');track('tool_use',{action_detail:'regression_checklist',items:rows.length-1});});q('#run').click();
  }

  function traceabilityMatrix() {
    setHtml(`${textarea('requirements','Requisitos: ID | descrição | risco','REQ-001 | Usuário pode autenticar com MFA | Alto\nREQ-002 | Usuário pode recuperar senha | Médio\nREQ-003 | Administrador gerencia perfis | Alto',8)}${textarea('tests','Casos de teste: ID | requisitos relacionados','TC-001 | REQ-001\nTC-002 | REQ-001;REQ-002\nTC-003 | REQ-003',8)}${standardActions('run','Gerar matriz','#output','matriz-rastreabilidade.csv')}${outputBox('output','CSV')}</div>`);
    q('#run').addEventListener('click',()=>{const reqs=q('#requirements').value.split(/\r?\n/).filter(Boolean).map(l=>l.split('|').map(x=>x.trim())),tests=q('#tests').value.split(/\r?\n/).filter(Boolean).map(l=>l.split('|').map(x=>x.trim())),rows=[['Requisito','Descrição','Risco','Casos de teste','Cobertura']];reqs.forEach(([id,desc,risk])=>{const linked=tests.filter(([,links])=>String(links||'').split(/[;,]/).map(x=>x.trim()).includes(id)).map(x=>x[0]);rows.push([id,desc,risk,linked.join(';'),linked.length?'Coberto':'Sem caso relacionado']);});addText('#output',rows.map(r=>r.map(csvCell).join(',')).join('\n'));const missing=rows.slice(1).filter(r=>r[4]==='Sem caso relacionado').length;status(`${reqs.length} requisito(s), ${missing} sem caso relacionado.`,missing?'warning':'success');track('tool_use',{action_detail:'traceability_matrix',missing});});q('#run').click();
  }

  function evidenceHtmlGenerator() {
    setHtml(`${field('title','Título da execução','text','Regressão do checkout — build 2026.07.21')}${textarea('summary','Resumo','Execução dos cenários críticos de compra e pagamento em ambiente de QA.',4)}${textarea('steps','Passos/resultados: passo | resultado | status','Login com cliente fictício | Sessão iniciada | APROVADO\nAdicionar produto | Carrinho atualizado | APROVADO\nConfirmar pagamento de teste | Pedido criado | APROVADO',8)}<div class="field"><label for="images">Imagens de evidência (opcional)</label><input id="images" type="file" accept="image/*" multiple></div><div class="actions"><button class="btn btn-primary" id="run">Gerar relatório HTML</button></div><div class="status" id="status"></div>`);
    q('#run').addEventListener('click',async()=>{try{const images=[];for(const file of [...q('#images').files].slice(0,12)){const data=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file);});images.push({name:file.name,data});}const rows=q('#steps').value.split(/\r?\n/).filter(Boolean).map(l=>l.split('|').map(x=>x.trim())),title=q('#title').value,html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title><style>body{font:16px/1.55 system-ui;max-width:1000px;margin:40px auto;padding:0 20px;color:#172033}h1{line-height:1.15}table{width:100%;border-collapse:collapse}th,td{padding:10px;border:1px solid #ccd3e0;text-align:left}.ok{color:#087f5b;font-weight:700}.bad{color:#c92a2a;font-weight:700}.evidence{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}.evidence img{width:100%;border:1px solid #ddd;border-radius:8px}small{color:#667085}</style></head><body><h1>${esc(title)}</h1><p>${esc(q('#summary').value)}</p><p><small>Gerado em ${new Date().toLocaleString('pt-BR')} · Dados e imagens incorporados localmente</small></p><h2>Execução</h2><table><thead><tr><th>Passo</th><th>Resultado</th><th>Status</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r[0]||'')}</td><td>${esc(r[1]||'')}</td><td class="${/aprovado|pass/i.test(r[2]||'')?'ok':'bad'}">${esc(r[2]||'')}</td></tr>`).join('')}</tbody></table>${images.length?`<h2>Evidências</h2><div class="evidence">${images.map(x=>`<figure><img src="${x.data}" alt="${esc(x.name)}"><figcaption>${esc(x.name)}</figcaption></figure>`).join('')}</div>`:''}</body></html>`;downloadText(html,'relatorio-evidencias.html','text/html;charset=utf-8');status(`Relatório HTML gerado com ${rows.length} passo(s) e ${images.length} imagem(ns).`,'success');track('download_file',{file_type:'html',action_detail:'evidence_report'});}catch(error){status(error.message,'error');}});
  }

  function effortEstimator() {
    setHtml(`<div class="four-col">${field('scenarios','Cenários','number','80','min="1"')}${field('complexity','Complexidade média (1–5)','number','3','min="1" max="5"')}${field('platforms','Plataformas','number','2','min="1" max="10"')}${field('cycles','Ciclos','number','2','min="1" max="10"')}</div><div class="three-col">${field('minutes','Minutos por cenário simples','number','8','min="1"')}${field('automation','Automação prevista (%)','number','40','min="0" max="100"')}${field('contingency','Contingência (%)','number','20','min="0" max="100"')}</div><div class="actions"><button class="btn btn-primary" id="run">Estimar esforço</button></div><div class="metric-grid" id="metrics"></div><div class="status" id="status"></div>`);
    q('#run').addEventListener('click',()=>{const scenarios=clamp(q('#scenarios').value,1,1e6),complex=clamp(q('#complexity').value,1,5),platforms=clamp(q('#platforms').value,1,10),cycles=clamp(q('#cycles').value,1,10),minutes=clamp(q('#minutes').value,1,240),automation=clamp(q('#automation').value,0,100)/100,cont=clamp(q('#contingency').value,0,100)/100,manualFactor=1-automation*.55,base=scenarios*minutes*(.6+complex*.2)*platforms*cycles*manualFactor,total=base*(1+cont),hours=total/60,days=hours/6; q('#metrics').innerHTML=`<article class="metric-card"><span>Horas estimadas</span><strong>${hours.toFixed(1)} h</strong></article><article class="metric-card"><span>Dias líquidos (6h)</span><strong>${days.toFixed(1)}</strong></article><article class="metric-card"><span>Contingência</span><strong>${(total-base)/60|0} h</strong></article>`;status('Estimativa paramétrica criada. Calibre com dados históricos, riscos, ambientes, dependências e experiência da equipe.','success');track('tool_use',{action_detail:'estimate_test_effort'});});q('#run').click();
  }

  function gherkinValidator() {
    setHtml(`${textarea('input','Feature Gherkin','# language: pt\nFuncionalidade: Login\n\n  Cenário: Usuário válido\n    Dado que existe um usuário ativo\n    Quando informo credenciais válidas\n    Então acesso a área autenticada',16)}${standardActions('run','Validar estrutura','#output','validacao-gherkin.txt')}${outputBox('output','Resultado')}</div>`);
    q('#run').addEventListener('click',()=>{const lines=q('#input').value.split(/\r?\n/),issues=[],feature=lines.findIndex(l=>/^\s*(Funcionalidade|Feature|Característica):/i.test(l)),scenarios=lines.filter(l=>/^\s*(Cenário|Esquema do Cenário|Scenario|Scenario Outline|Escenario):/i.test(l)).length,steps=lines.filter(l=>/^\s*(Dado|Quando|Então|E|Mas|Given|When|Then|And|But|Sea|Cuando|Entonces):?\s+/i.test(l)).length;if(feature<0)issues.push('Funcionalidade/Feature não encontrada.');if(!scenarios)issues.push('Nenhum cenário encontrado.');if(!steps)issues.push('Nenhum passo Given/When/Then encontrado.');let currentScenario=false,hasWhen=false,hasThen=false;lines.forEach((line,i)=>{if(/^\s*(Cenário|Scenario|Escenario):/i.test(line)){if(currentScenario&&(!hasWhen||!hasThen))issues.push(`Cenário anterior à linha ${i+1} pode estar sem Quando/Então.`);currentScenario=true;hasWhen=hasThen=false;}if(/^\s*(Quando|When|Cuando)\s+/i.test(line))hasWhen=true;if(/^\s*(Então|Then|Entonces)\s+/i.test(line))hasThen=true;if(/\b(eu clico no botão|click button|xpath|css selector)\b/i.test(line))issues.push(`Linha ${i+1}: passo muito ligado à interface; considere descrever comportamento.`);});if(currentScenario&&(!hasWhen||!hasThen))issues.push('Último cenário pode estar sem Quando/Então.');addText('#output',`Funcionalidade: ${feature>=0?'encontrada':'ausente'}\nCenários: ${scenarios}\nPassos: ${steps}\n\n${issues.length?issues.map((x,i)=>`${i+1}. ${x}`).join('\n'):'Estrutura básica encontrada sem alertas.'}`);status(issues.length?`${issues.length} alerta(s).`:'Estrutura básica válida.',issues.length?'warning':'success');track('tool_use',{action_detail:'validate_gherkin',issues:issues.length});});q('#run').click();
  }

  function testCaseToGherkin() {
    setHtml(`${field('feature','Funcionalidade','text','Cadastro de usuário')}${field('scenario','Cenário','text','Cadastrar com dados válidos')}${textarea('preconditions','Pré-condições','Existe um visitante não autenticado\nO e-mail fictício ainda não está cadastrado',5)}${textarea('steps','Ações','Acessar o cadastro\nInformar nome, e-mail e senha válidos\nConfirmar o cadastro',6)}${textarea('expected','Resultado esperado','O usuário é criado e uma confirmação é exibida.',4)}${standardActions('run','Converter para Gherkin','#output','cenario.feature')}${outputBox('output','Gherkin')}</div>`);
    q('#run').addEventListener('click',()=>{const pre=q('#preconditions').value.split(/\r?\n/).filter(Boolean),steps=q('#steps').value.split(/\r?\n/).filter(Boolean);addText('#output',`# language: pt\nFuncionalidade: ${q('#feature').value}\n\n  Cenário: ${q('#scenario').value}\n${pre.map((x,i)=>`    ${i?'E':'Dado'} ${x.charAt(0).toLowerCase()+x.slice(1)}`).join('\n')}\n${steps.map((x,i)=>`    ${i?'E':'Quando'} ${x.charAt(0).toLowerCase()+x.slice(1)}`).join('\n')}\n    Então ${q('#expected').value.charAt(0).toLowerCase()+q('#expected').value.slice(1)}\n`);status('Estrutura inicial gerada. Reescreva passos para expressar regras e resultados observáveis, não cliques mecânicos.','success');track('tool_use',{action_detail:'test_case_to_gherkin'});});q('#run').click();
  }

  function accessibilityChecklist() {
    setHtml(`<div class="two-col">${field('page','Página ou fluxo','text','Formulário de cadastro')}<div class="field"><label for="level">Referência</label><select id="level"><option value="AA">WCAG 2.2 AA</option><option value="A">WCAG 2.2 A</option></select></div></div><div class="options-grid"><label class="check"><input type="checkbox" data-a11y="Navegação completa por teclado e ordem lógica de foco" checked> Teclado e foco</label><label class="check"><input type="checkbox" data-a11y="Nome, função e estado acessíveis dos controles" checked> Semântica</label><label class="check"><input type="checkbox" data-a11y="Labels, instruções e erros associados aos campos" checked> Formulários</label><label class="check"><input type="checkbox" data-a11y="Contraste, foco visível e informação não dependente só de cor" checked> Visual</label><label class="check"><input type="checkbox" data-a11y="Zoom 200%, reflow e orientação" checked> Responsividade</label><label class="check"><input type="checkbox" data-a11y="Alternativas textuais para imagens e mídia" checked> Conteúdo</label><label class="check"><input type="checkbox" data-a11y="Mensagens dinâmicas anunciadas por tecnologia assistiva" checked> Atualizações</label><label class="check"><input type="checkbox" data-a11y="Teste com leitor de tela e navegador" checked> Leitor de tela</label></div>${standardActions('run','Gerar checklist','#output','checklist-acessibilidade.md')}${outputBox('output','Checklist')}</div>`);
    q('#run').addEventListener('click',()=>{const selected=qa('[data-a11y]:checked').map(x=>x.dataset.a11y);const detailed=selected.flatMap(item=>[`- [ ] ${item}`,`  - [ ] Testar condição normal, erro e estado desabilitado quando aplicável`,`  - [ ] Registrar evidência, impacto e recomendação`]);addText('#output',`# Checklist de Acessibilidade — ${q('#page').value}\n\nReferência inicial: ${q('#level').value}\n\n${detailed.join('\n')}\n\n## Testes complementares\n- [ ] HTML semântico e landmarks\n- [ ] Título da página e idioma\n- [ ] Skip link e foco após navegação\n- [ ] Áreas de toque e espaçamento\n- [ ] Movimento, animação e preferência reduced-motion\n- [ ] Tempo limite, autenticação e prevenção de erros\n\n> Este checklist não substitui auditoria especializada ou testes com pessoas com deficiência.\n`);status(`${selected.length} áreas incluídas. Combine ferramentas automáticas com testes manuais e usuários reais.`, 'success');track('tool_use',{action_detail:'a11y_checklist'});});q('#run').click();
  }

  const nifCheckDigit=(base)=>{const w=[9,8,7,6,5,4,3,2],sum=[...base].reduce((a,d,i)=>a+Number(d)*w[i],0),d=11-(sum%11);return d>=10?0:d;};
  const validNif=(value)=>{const d=String(value).replace(/\D/g,'');return /^\d{9}$/.test(d)&&nifCheckDigit(d.slice(0,8))===Number(d[8]);};
  function nifGeneratorValidator() {
    setHtml(`<div class="two-col"><section class="mini-panel"><h3>Gerar NIF fictício</h3>${field('count','Quantidade','number','10','min="1" max="200"')}<div class="actions"><button class="btn btn-primary" id="generate">Gerar NIFs</button></div></section><section class="mini-panel"><h3>Validar NIF</h3>${field('value','NIF','text','245716698','inputmode="numeric"')}<div class="actions"><button class="btn btn-secondary" id="validate">Validar</button></div><div class="status" id="validate-status"></div></section></div>${outputBox('output','NIFs fictícios')}<div class="actions"><button class="btn btn-secondary" data-copy-target="#output">Copiar</button><button class="btn btn-secondary" data-download-target="#output" data-filename="nifs-teste.txt">Baixar</button></div><div class="status" id="status"></div>`);
    q('#generate').addEventListener('click',()=>{const count=clamp(q('#count').value,1,200),prefixes=['1','2','3','5','6','8','9'],values=Array.from({length:count},()=>{let base=prefixes[randomInt(prefixes.length)]+Array.from({length:7},()=>randomInt(10)).join('');return base+nifCheckDigit(base);});addText('#output',values.join('\n'));status(`${count} NIF(s) matematicamente válido(s) gerado(s) para testes. Validade não significa existência.`, 'success');track('tool_use',{action_detail:'generate_nif',quantity:count});});q('#validate').addEventListener('click',()=>{const ok=validNif(q('#value').value);status(ok?'NIF com formato e dígito de controle válidos. Isso não confirma existência.':'NIF inválido.','success','#validate-status');if(!ok)q('#validate-status').className='status show error';track('tool_use',{action_detail:'validate_nif',valid:ok});});q('#generate').click();
  }

  const validNiss=(value)=>{const d=String(value).replace(/\D/g,'');if(!/^\d{11}$/.test(d))return false;const w=[29,23,19,17,13,11,7,5,3,2],sum=[...d.slice(0,10)].reduce((a,x,i)=>a+Number(x)*w[i],0),check=9-(sum%10);return check===Number(d[10]);};
  function nissValidator() {
    setHtml(`${field('value','NISS (11 dígitos)','text','12345678902','inputmode="numeric" maxlength="20"')}<div class="actions"><button class="btn btn-primary" id="run">Validar NISS</button></div><div class="result-big" id="result">—</div><div class="status" id="status"></div>`);
    q('#run').addEventListener('click',()=>{const digits=q('#value').value.replace(/\D/g,''),ok=validNiss(digits);q('#result').textContent=ok?'Válido':'Inválido';q('#result').className=`result-big ${ok?'valid':'invalid'}`;status(ok?'Formato e dígito de controle válidos. A ferramenta não consulta a Segurança Social nem confirma titularidade.':'NISS inválido ou incompleto.',ok?'success':'error');track('tool_use',{action_detail:'validate_niss',valid:ok});});q('#run').click();
  }

  const mod97=(numeric)=>{let rem=0;for(const c of numeric)rem=(rem*10+Number(c))%97;return rem;};
  function ibanValidator() {
    setHtml(`${field('value','IBAN','text','PT50 0002 0123 1234 5678 9015 4','autocomplete="off"')}<div class="actions"><button class="btn btn-primary" id="run">Validar IBAN</button></div><div class="iban-breakdown" id="breakdown"></div><div class="status" id="status"></div>`);
    q('#run').addEventListener('click',()=>{const iban=q('#value').value.toUpperCase().replace(/\s+/g,''),format=/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban);let ok=false;try{if(format){const moved=iban.slice(4)+iban.slice(0,4),numeric=[...moved].map(c=>/[A-Z]/.test(c)?String(c.charCodeAt(0)-55):c).join('');ok=mod97(numeric)===1;}}catch(_){}q('#breakdown').innerHTML=format?`<div class="stat-card"><span>País</span><strong>${esc(iban.slice(0,2))}</strong></div><div class="stat-card"><span>Dígitos de controle</span><strong>${esc(iban.slice(2,4))}</strong></div><div class="stat-card"><span>Comprimento</span><strong>${iban.length}</strong></div>`:'';status(ok?'IBAN com estrutura e checksum MOD-97 válidos. Isso não confirma que a conta existe ou está ativa.':'IBAN inválido ou checksum incorreto.',ok?'success':'error');track('tool_use',{action_detail:'validate_iban',valid:ok});});q('#run').click();
  }

  function vatValidator() {
    const rules={AT:/^ATU\d{8}$/,BE:/^BE0?\d{9}$/,BG:/^BG\d{9,10}$/,CY:/^CY\d{8}[A-Z]$/,CZ:/^CZ\d{8,10}$/,DE:/^DE\d{9}$/,DK:/^DK\d{8}$/,EE:/^EE\d{9}$/,EL:/^EL\d{9}$/,ES:/^ES[A-Z0-9]\d{7}[A-Z0-9]$/,FI:/^FI\d{8}$/,FR:/^FR[A-Z0-9]{2}\d{9}$/,HR:/^HR\d{11}$/,HU:/^HU\d{8}$/,IE:/^IE[A-Z0-9]{7,9}$/,IT:/^IT\d{11}$/,LT:/^LT\d{9,12}$/,LU:/^LU\d{8}$/,LV:/^LV\d{11}$/,MT:/^MT\d{8}$/,NL:/^NL\d{9}B\d{2}$/,PL:/^PL\d{10}$/,PT:/^PT\d{9}$/,RO:/^RO\d{2,10}$/,SE:/^SE\d{12}$/,SI:/^SI\d{8}$/,SK:/^SK\d{10}$/};
    setHtml(`${field('value','Número VAT/IVA com prefixo do país','text','PT245716698','autocomplete="off"')}<div class="actions"><button class="btn btn-primary" id="run">Validar formato</button></div><div class="status" id="status"></div>`);
    q('#run').addEventListener('click',()=>{const value=q('#value').value.toUpperCase().replace(/[\s.\-]/g,''),country=value.slice(0,2),rule=rules[country],ok=Boolean(rule?.test(value))&&(country!=='PT'||validNif(value.slice(2)));status(!rule?'País/prefixo não reconhecido nesta validação básica.':ok?'Formato compatível com a regra local analisada. Isso não confirma registro ativo no VIES.':'Formato ou dígito de controle inválido.',!rule?'warning':ok?'success':'error');track('tool_use',{action_detail:'validate_vat',country,valid:ok});});q('#run').click();
  }

  const easterDate=(year)=>{const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;return new Date(year,month-1,day);};
  const addDays=(date,days)=>new Date(date.getFullYear(),date.getMonth(),date.getDate()+days);
  const ptHolidays=(year)=>{const fixed=['01-01','04-25','05-01','06-10','08-15','10-05','11-01','12-01','12-08','12-25'].map(md=>`${year}-${md}`),e=easterDate(year),movable=[addDays(e,-2),e,addDays(e,60)].map(d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);return new Set([...fixed,...movable]);};
  function portugalBusinessDays() {
    const now=new Date(),start=new Date(now.getFullYear(),now.getMonth(),1),end=new Date(now.getFullYear(),now.getMonth()+1,0),iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    setHtml(`<div class="two-col">${field('start','Data inicial','date',iso(start))}${field('end','Data final','date',iso(end))}</div><div class="options-row"><label class="check"><input id="include-start" type="checkbox" checked> Incluir data inicial</label><label class="check"><input id="include-end" type="checkbox" checked> Incluir data final</label><label class="check"><input id="holidays" type="checkbox" checked> Descontar feriados nacionais</label></div>${textarea('extra','Feriados locais/adicionais (AAAA-MM-DD)','',5)}<div class="actions"><button class="btn btn-primary" id="run">Contar dias úteis</button></div><div class="metric-grid" id="metrics"></div><div class="status" id="status"></div>`);
    q('#run').addEventListener('click',()=>{let s=new Date(`${q('#start').value}T12:00:00`),e=new Date(`${q('#end').value}T12:00:00`);if(!q('#start').value||!q('#end').value||s>e)return status('Informe um intervalo válido.','error');const extra=new Set(q('#extra').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)),sets=new Map(),day=86400000;let business=0,weekends=0,holidayCount=0,total=0;for(let d=new Date(s);d<=e;d=new Date(d.getTime()+day)){if(d.getTime()===s.getTime()&&!q('#include-start').checked)continue;if(d.getTime()===e.getTime()&&!q('#include-end').checked)continue;total++;const weekend=d.getDay()===0||d.getDay()===6,key=iso(d);if(!sets.has(d.getFullYear()))sets.set(d.getFullYear(),ptHolidays(d.getFullYear()));const holiday=q('#holidays').checked&&(sets.get(d.getFullYear()).has(key)||extra.has(key));if(weekend)weekends++;else if(holiday)holidayCount++;else business++;}q('#metrics').innerHTML=`<article class="metric-card"><span>Dias úteis</span><strong>${business}</strong></article><article class="metric-card"><span>Dias corridos</span><strong>${total}</strong></article><article class="metric-card"><span>Fins de semana</span><strong>${weekends}</strong></article><article class="metric-card"><span>Feriados em dia útil</span><strong>${holidayCount}</strong></article>`;status('Cálculo inclui feriados nacionais fixos, Sexta-feira Santa, Páscoa e Corpo de Deus. Feriados municipais devem ser informados.','success');track('tool_use',{action_detail:'business_days_portugal',days:business});});q('#run').click();
  }

  const zoneOffset=(date,zone)=>{const parts=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).reduce((a,p)=>(a[p.type]=p.value,a),{});const asUTC=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute),Number(parts.second));return asUTC-date.getTime();};
  const zonedToUtc=(value,zone)=>{const [date,time]=value.split('T'),[y,m,d]=date.split('-').map(Number),[hh,mm]=time.split(':').map(Number);let utc=new Date(Date.UTC(y,m-1,d,hh,mm));for(let i=0;i<3;i++)utc=new Date(Date.UTC(y,m-1,d,hh,mm)-zoneOffset(utc,zone));return utc;};
  function timezoneConverter() {
    const zones=['America/Sao_Paulo','America/Manaus','America/New_York','America/Los_Angeles','Europe/Lisbon','Europe/London','Europe/Madrid','Europe/Paris','Africa/Luanda','Asia/Tokyo','Asia/Dubai','Australia/Sydney','UTC'],opts=zones.map(z=>`<option>${z}</option>`).join(''),now=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
    setHtml(`<div class="three-col">${field('datetime','Data e hora na origem','datetime-local',now)}<div class="field"><label for="from">Fuso de origem</label><select id="from">${opts}</select></div><div class="field"><label for="to">Fuso de destino</label><select id="to">${opts}</select></div></div><div class="actions"><button class="btn btn-primary" id="run">Converter horário</button></div><div class="timezone-result" id="result"></div><div class="status" id="status"></div>`);q('#from').value='America/Sao_Paulo';q('#to').value='Europe/Lisbon';
    q('#run').addEventListener('click',()=>{try{const instant=zonedToUtc(q('#datetime').value,q('#from').value),fmt=(zone)=>new Intl.DateTimeFormat(navigator.language||'pt-BR',{timeZone:zone,dateStyle:'full',timeStyle:'long'}).format(instant);q('#result').innerHTML=`<div class="stat-card"><span>${esc(q('#from').value)}</span><strong>${esc(fmt(q('#from').value))}</strong></div><div class="arrow-big">→</div><div class="stat-card"><span>${esc(q('#to').value)}</span><strong>${esc(fmt(q('#to').value))}</strong></div><p class="small muted">Instante UTC: ${instant.toISOString()}</p>`;status('Horário convertido considerando regras de fuso e horário de verão disponíveis no navegador.','success');track('tool_use',{action_detail:'timezone_converter'});}catch(error){status('Informe uma data e hora válidas.','error');}});q('#run').click();
  }

  function fileSizeConverter() {
    const factors={B:1,KB:1e3,MB:1e6,GB:1e9,TB:1e12,KiB:1024,MiB:1024**2,GiB:1024**3,TiB:1024**4};
    setHtml(`<div class="two-col">${field('value','Valor','number','1','min="0" step="any"')}<div class="field"><label for="unit">Unidade de origem</label><select id="unit">${Object.keys(factors).map(u=>`<option>${u}</option>`).join('')}</select></div></div><div class="actions"><button class="btn btn-primary" id="run">Converter</button></div><div class="table-scroll"><table class="data-table" id="table"></table></div><div class="status" id="status"></div>`);q('#unit').value='GB';
    q('#run').addEventListener('click',()=>{const bytes=Number(q('#value').value)*factors[q('#unit').value];q('#table').innerHTML=`<thead><tr><th>Unidade</th><th>Valor</th><th>Sistema</th></tr></thead><tbody>${Object.entries(factors).map(([u,f])=>`<tr><td>${u}</td><td>${formatNumber(bytes/f,8)}</td><td>${u.includes('i')?'Binário (1024)':'Decimal (1000)'}</td></tr>`).join('')}</tbody>`;status(`${formatNumber(bytes,0)} bytes.`, 'success');track('tool_use',{action_detail:'file_size_converter'});});q('#run').click();
  }

  function transferTimeCalculator() {
    setHtml(`<div class="four-col">${field('size','Tamanho do arquivo','number','5','min="0" step="any"')}<div class="field"><label for="size-unit">Unidade</label><select id="size-unit"><option value="MB">MB</option><option value="GB" selected>GB</option><option value="TB">TB</option><option value="MiB">MiB</option><option value="GiB">GiB</option></select></div>${field('speed','Velocidade','number','100','min="0.01" step="any"')}<div class="field"><label for="speed-unit">Unidade da velocidade</label><select id="speed-unit"><option value="Mbps">Mbps</option><option value="MBps">MB/s</option><option value="Gbps">Gbps</option></select></div></div>${field('efficiency','Eficiência real (%)','range','85','min="10" max="100"')}<div class="actions"><button class="btn btn-primary" id="run">Estimar tempo</button></div><div class="metric-grid" id="metrics"></div><div class="status" id="status"></div>`);
    const sizeFactor={MB:1e6,GB:1e9,TB:1e12,MiB:1024**2,GiB:1024**3},speedFactor={Mbps:1e6/8,MBps:1e6,Gbps:1e9/8};q('#run').addEventListener('click',()=>{const bytes=Number(q('#size').value)*sizeFactor[q('#size-unit').value],bps=Number(q('#speed').value)*speedFactor[q('#speed-unit').value]*Number(q('#efficiency').value)/100,seconds=bytes/bps;const human=seconds<60?`${seconds.toFixed(1)} s`:seconds<3600?`${Math.floor(seconds/60)} min ${Math.round(seconds%60)} s`:seconds<86400?`${Math.floor(seconds/3600)} h ${Math.round(seconds%3600/60)} min`:`${Math.floor(seconds/86400)} d ${Math.round(seconds%86400/3600)} h`;q('#metrics').innerHTML=`<article class="metric-card"><span>Tempo estimado</span><strong>${human}</strong></article><article class="metric-card"><span>Taxa efetiva</span><strong>${bytesLabel(bps)}/s</strong></article><article class="metric-card"><span>Dados</span><strong>${bytesLabel(bytes)}</strong></article>`;status('Estimativa sem considerar latência, congestionamento, limites do servidor, protocolo ou variação da conexão.','success');track('tool_use',{action_detail:'transfer_time'});});q('#run').click();
  }

  function passwordPassphraseGenerator() {
    const words=['acordo','amendoa','aurora','brisa','campo','cedro','circulo','claro','codigo','cometa','coral','dados','delta','estrela','farol','foco','folha','gesto','ilha','janela','lago','livre','luz','mapa','nuvem','onda','ponte','prisma','ritmo','rio','sinal','sol','tempo','trilha','valor','vento','verde','vivo','zebra'];
    setHtml(`<div class="two-col"><section class="mini-panel"><h3>Senha aleatória</h3><div class="two-col">${field('length','Comprimento','number','20','min="8" max="128"')}${field('count','Quantidade','number','5','min="1" max="50"')}</div><div class="options-row"><label class="check"><input id="upper" type="checkbox" checked> Maiúsculas</label><label class="check"><input id="digits" type="checkbox" checked> Números</label><label class="check"><input id="symbols" type="checkbox" checked> Símbolos</label></div><button class="btn btn-primary" id="passwords">Gerar senhas</button></section><section class="mini-panel"><h3>Frase-senha</h3><div class="two-col">${field('words','Palavras','number','5','min="3" max="12"')}${field('separator','Separador','text','-','maxlength="3"')}</div><label class="check"><input id="capitalize" type="checkbox"> Capitalizar palavras</label><button class="btn btn-secondary" id="phrases">Gerar frases</button></section></div>${outputBox('output','Resultados')}<div class="actions"><button class="btn btn-secondary" data-copy-target="#output">Copiar</button></div><div class="status" id="status"></div>`);
    q('#passwords').addEventListener('click',()=>{let chars='abcdefghijklmnopqrstuvwxyz';if(q('#upper').checked)chars+='ABCDEFGHIJKLMNOPQRSTUVWXYZ';if(q('#digits').checked)chars+='0123456789';if(q('#symbols').checked)chars+='!@#$%&*+-_=?:.';const count=clamp(q('#count').value,1,50),length=clamp(q('#length').value,8,128),values=Array.from({length:count},()=>Array.from({length},()=>chars[randomInt(chars.length)]).join(''));addText('#output',values.join('\n'));status('Senhas geradas localmente com Web Crypto. Use um gerenciador de senhas e nunca reutilize credenciais.','success');track('tool_use',{action_detail:'generate_password',quantity:count});});q('#phrases').addEventListener('click',()=>{const count=clamp(q('#count').value,1,50),n=clamp(q('#words').value,3,12),sep=q('#separator').value,cap=q('#capitalize').checked,values=Array.from({length:count},()=>Array.from({length:n},()=>{let w=words[randomInt(words.length)];return cap?w[0].toUpperCase()+w.slice(1):w;}).join(sep));addText('#output',values.join('\n'));status('Frases-senha geradas localmente. Quanto mais palavras aleatórias, maior a resistência a tentativas.','success');track('tool_use',{action_detail:'generate_passphrase',quantity:count});});q('#passwords').click();
  }

  function compoundInterestCalculator() {
    const defaultCurrency = pageLang === 'en' ? 'USD' : pageLang === 'es' ? 'EUR' : 'BRL';
    setHtml(`<div class="coverage-inputs">${field('principal','Capital inicial','number','10000','min="0" step="0.01"')}${field('contribution','Aporte por período','number','500','min="0" step="0.01"')}${field('rate','Taxa (%)','number','0.8','step="0.01"')}${field('periods','Períodos','number','60','min="1" max="600"')}<div class="field"><label for="timing">Aporte</label><select id="timing"><option value="end">Fim do período</option><option value="start">Início do período</option></select></div><div class="field"><label for="currency">Moeda</label><select id="currency"><option value="BRL">BRL — Real</option><option value="USD">USD — Dollar</option><option value="EUR">EUR — Euro</option><option value="GBP">GBP — Pound</option></select></div></div><div class="actions"><button class="btn btn-primary" id="run">Calcular evolução</button></div><div class="metric-grid" id="metrics"></div><div class="table-scroll"><table class="data-table" id="table"></table></div><div class="status" id="status"></div>`);
    q('#currency').value = defaultCurrency;
    q('#run').addEventListener('click',()=>{let balance=Number(q('#principal').value)||0,contrib=Number(q('#contribution').value)||0,rate=(Number(q('#rate').value)||0)/100,periods=clamp(q('#periods').value,1,600),invested=balance,interest=0,rows=[];for(let i=1;i<=periods;i++){if(q('#timing').value==='start'){balance+=contrib;invested+=contrib;}const gain=balance*rate;balance+=gain;interest+=gain;if(q('#timing').value==='end'){balance+=contrib;invested+=contrib;}if(i<=12||i%12===0||i===periods)rows.push([i,invested,balance,interest]);}const currency=new Intl.NumberFormat(pageLocale,{style:'currency',currency:q('#currency').value});q('#metrics').innerHTML=`<article class="metric-card"><span>Saldo final</span><strong>${currency.format(balance)}</strong></article><article class="metric-card"><span>Total investido</span><strong>${currency.format(invested)}</strong></article><article class="metric-card"><span>Juros acumulados</span><strong>${currency.format(interest)}</strong></article>`;q('#table').innerHTML=`<thead><tr><th>Período</th><th>Investido</th><th>Saldo</th><th>Juros</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r[0]}</td><td>${currency.format(r[1])}</td><td>${currency.format(r[2])}</td><td>${currency.format(r[3])}</td></tr>`).join('')}</tbody>`;status('Simulação matemática sem impostos, inflação, taxas, risco ou garantia de rendimento.','success');track('tool_use',{action_detail:'compound_interest',currency:q('#currency').value});});q('#run').click();
  }

  const handlers = {
    'comprimir-pdf': compressPdf,
    'girar-pdf': rotatePdf,
    'marca-dagua-pdf': watermarkPdf,
    'numerar-paginas-pdf': numberPdfPages,
    'extrair-texto-pdf': extractTextPdf,
    'remover-metadados-pdf': removePdfMetadata,
    'comparar-pdfs': comparePdfs,
    'texto-para-pdf': textToPdf,
    'gerador-pdf-pautado': linedPdf,
    'recortar-imagem': cropImage,
    'girar-espelhar-imagem': rotateFlipImage,
    'remover-exif': removeExif,
    'extrair-paleta-cores': extractPalette,
    'conta-gotas-imagem': imageColorPicker,
    'placeholder-imagem': placeholderImage,
    'redimensionar-imagens-lote': batchResizeImages,
    'calculadora-proporcao-imagem': aspectRatioCalculator,
    'formatador-yaml': yamlFormatter,
    'conversor-json-yaml': jsonYamlConverter,
    'visualizador-csv': csvViewer,
    'comparador-csv': compareCsv,
    'validador-json-schema': jsonSchemaValidator,
    'gerador-json-schema': jsonSchemaGenerator,
    'validador-openapi': openApiValidator,
    'gerador-cron': cronGenerator,
    'formatador-env': envFormatter,
    'analisador-headers-http': headersAnalyzer,
    'gerador-tabela-markdown': markdownTableGenerator,
    'conversor-delimitador-csv': delimiterConverter,
    'gerador-slug': slugGenerator,
    'gerador-utm': utmGenerator,
    'gerador-meta-tags': metaTagsGenerator,
    'gerador-robots-sitemap': robotsSitemapGenerator,
    'conversor-cores': colorConverter,
    'gerador-gradiente-css': gradientGenerator,
    'gerador-box-shadow': boxShadowGenerator,
    'gerador-hmac': hmacGenerator,
    'checksum-arquivo': fileChecksum,
    'gerador-pairwise': pairwiseGenerator,
    'tabela-decisao': decisionTable,
    'particionamento-equivalencia-tool': equivalencePartitioning,
    'transicao-estados': stateTransitionModeler,
    'matriz-risco': riskMatrix,
    'calculadora-cobertura-testes': coverageCalculator,
    'checklist-testes-exploratorios': exploratoryChecklist,
    'gerador-casos-teste-api': apiTestCasesGenerator,
    'gerador-mock-json': mockJsonGenerator,
    'curl-para-restassured': curlToRestAssured,
    'gerador-caso-teste': testCaseGenerator,
    'gerador-relatorio-bug': bugReportGenerator,
    'gerador-plano-testes': testPlanGenerator,
    'checklist-regressao': regressionChecklist,
    'matriz-rastreabilidade': traceabilityMatrix,
    'gerador-evidencia-html': evidenceHtmlGenerator,
    'estimador-esforco-testes': effortEstimator,
    'validador-gherkin': gherkinValidator,
    'caso-teste-para-gherkin': testCaseToGherkin,
    'checklist-acessibilidade': accessibilityChecklist,
    'gerador-validador-nif': nifGeneratorValidator,
    'validador-niss': nissValidator,
    'validador-iban': ibanValidator,
    'validador-vat': vatValidator,
    'dias-uteis-portugal': portugalBusinessDays,
    'conversor-fusos-horarios': timezoneConverter,
    'conversor-tamanho-arquivo': fileSizeConverter,
    'calculadora-transferencia-dados': transferTimeCalculator,
    'gerador-senha-frase': passwordPassphraseGenerator,
    'calculadora-juros-compostos': compoundInterestCalculator
  };

  try {
    const handler = handlers[slug];
    if (!handler) throw new Error('Ferramenta em preparação. Volte em breve.');
    const result = handler();
    if (result?.catch) result.catch((error) => status(error.message, 'error'));
  } catch (error) {
    setHtml(`<div class="empty-state"><strong>Não foi possível iniciar esta ferramenta.</strong><p>${esc(error.message)}</p></div>`);
  }
})();
