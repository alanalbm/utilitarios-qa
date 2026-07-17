(() => {
  'use strict';

  const app = document.querySelector('#tool-app');
  const slug = document.body?.dataset.toolSlug;
  if (!app || !slug) return;

  const q = (selector, scope = app) => scope.querySelector(selector);
  const qa = (selector, scope = app) => [...scope.querySelectorAll(selector)];
  const html = (content) => { app.innerHTML = content; };
  const outputText = (selector, value) => { const el = q(selector); if (el) el.textContent = String(value ?? ''); };
  const randomInt = (max) => {
    if (!Number.isInteger(max) || max <= 0) return 0;
    const limit = Math.floor(0x100000000 / max) * max;
    const values = new Uint32Array(1);
    do { crypto.getRandomValues(values); } while (values[0] >= limit);
    return values[0] % max;
  };
  const randomItem = (items) => items[randomInt(items.length)];
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || min));
  const csvCell = (value) => {
    const text = String(value ?? '');
    return /[",\n\r;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const setBusy = (button, busy, busyText = 'Processando...') => {
    if (!button) return;
    if (busy) {
      button.dataset.originalText = button.textContent;
      button.textContent = busyText;
      button.disabled = true;
    } else {
      button.textContent = button.dataset.originalText || button.textContent;
      button.disabled = false;
    }
  };

  function documentosTeste() {
    html(`<div class="two-col"><div class="field"><label for="doc-type">Documento</label><select id="doc-type"><option value="cpf">CPF</option><option value="cnpj">CNPJ</option></select></div><div class="field"><label for="doc-count">Quantidade</label><input class="input" id="doc-count" type="number" min="1" max="100" value="10"></div></div>
      <div class="options-row"><label class="check"><input id="doc-mask" type="checkbox" checked> Aplicar máscara</label></div>
      <div class="actions"><button class="btn btn-primary" id="generate-doc">Gerar documentos</button><button class="btn btn-secondary" data-copy-target="#doc-output">Copiar</button><button class="btn btn-secondary" data-download-target="#doc-output" data-filename="documentos-teste.txt">Baixar TXT</button></div>
      <pre class="output large" id="doc-output" aria-live="polite"></pre><div class="status" id="status"></div>
      <hr class="separator"><h2>Validar documento</h2><div class="field"><label for="doc-value">CPF ou CNPJ</label><input class="input" id="doc-value" inputmode="numeric" placeholder="Digite somente números ou use máscara"></div><div class="actions"><button class="btn btn-secondary" id="validate-doc">Validar</button></div><div class="status" id="validate-status"></div>`);

    const calcDigits = (base, weights) => {
      const sum = base.split('').reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
      const remainder = sum % 11;
      return remainder < 2 ? 0 : 11 - remainder;
    };
    const makeCpf = () => {
      let base = Array.from({ length: 9 }, () => randomInt(10)).join('');
      if (/^(\d)\1{8}$/.test(base)) base = `1${base.slice(1)}`;
      const d1 = calcDigits(base, [10,9,8,7,6,5,4,3,2]);
      const d2 = calcDigits(base + d1, [11,10,9,8,7,6,5,4,3,2]);
      return `${base}${d1}${d2}`;
    };
    const makeCnpj = () => {
      const root = Array.from({ length: 8 }, () => randomInt(10)).join('');
      const base = `${root}0001`;
      const d1 = calcDigits(base, [5,4,3,2,9,8,7,6,5,4,3,2]);
      const d2 = calcDigits(base + d1, [6,5,4,3,2,9,8,7,6,5,4,3,2]);
      return `${base}${d1}${d2}`;
    };
    const formatCpf = (v) => v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    const formatCnpj = (v) => v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    const validCpf = (value) => {
      const v = value.replace(/\D/g, '');
      if (v.length !== 11 || /^(\d)\1+$/.test(v)) return false;
      const d1 = calcDigits(v.slice(0,9), [10,9,8,7,6,5,4,3,2]);
      const d2 = calcDigits(v.slice(0,9) + d1, [11,10,9,8,7,6,5,4,3,2]);
      return v.endsWith(`${d1}${d2}`);
    };
    const validCnpj = (value) => {
      const v = value.replace(/\D/g, '');
      if (v.length !== 14 || /^(\d)\1+$/.test(v)) return false;
      const d1 = calcDigits(v.slice(0,12), [5,4,3,2,9,8,7,6,5,4,3,2]);
      const d2 = calcDigits(v.slice(0,12) + d1, [6,5,4,3,2,9,8,7,6,5,4,3,2]);
      return v.endsWith(`${d1}${d2}`);
    };
    q('#generate-doc').addEventListener('click', () => {
      const type = q('#doc-type').value;
      const count = clamp(q('#doc-count').value, 1, 100);
      const mask = q('#doc-mask').checked;
      const result = Array.from({ length: count }, () => {
        const value = type === 'cpf' ? makeCpf() : makeCnpj();
        return mask ? (type === 'cpf' ? formatCpf(value) : formatCnpj(value)) : value;
      });
      outputText('#doc-output', result.join('\n'));
      showStatus(`${count} documento${count === 1 ? '' : 's'} fictício${count === 1 ? '' : 's'} gerado${count === 1 ? '' : 's'}. Use apenas em testes.`, 'success');
      trackAction('generate_test_data', { data_type: type, quantity: count });
    });
    q('#validate-doc').addEventListener('click', () => {
      const value = q('#doc-value').value;
      const digits = value.replace(/\D/g, '');
      const type = digits.length === 11 ? 'CPF' : digits.length === 14 ? 'CNPJ' : '';
      const valid = type === 'CPF' ? validCpf(value) : type === 'CNPJ' ? validCnpj(value) : false;
      showStatus(type ? `${type} ${valid ? 'válido' : 'inválido'}.` : 'Informe 11 dígitos para CPF ou 14 para CNPJ.', valid ? 'success' : 'error', '#validate-status');
      trackAction('validate_document', { data_type: type || 'unknown', valid });
    });
    q('#generate-doc').click();
  }

  function geradorDadosFicticios() {
    html(`<div class="three-col"><div class="field"><label for="fake-count">Registros</label><input class="input" id="fake-count" type="number" min="1" max="500" value="10"></div><div class="field"><label for="fake-format">Formato</label><select id="fake-format"><option value="json">JSON</option><option value="csv">CSV</option></select></div><div class="field"><label for="fake-locale">Localidade</label><select id="fake-locale"><option value="br">Brasil</option><option value="pt">Portugal</option></select></div></div>
      <div class="options-row"><label class="check"><input id="fake-cpf" type="checkbox" checked> Documento fictício</label><label class="check"><input id="fake-address" type="checkbox" checked> Endereço</label></div>
      <div class="actions"><button class="btn btn-primary" id="generate-fake">Gerar massa</button><button class="btn btn-secondary" data-copy-target="#fake-output">Copiar</button><button class="btn btn-secondary" id="download-fake">Baixar arquivo</button></div><pre class="output large" id="fake-output"></pre><div class="status" id="status"></div>`);

    const first = ['Ana','Bruno','Camila','Daniel','Eduarda','Felipe','Gabriela','Henrique','Isabela','João','Larissa','Marcos','Nathália','Otávio','Paula','Rafael','Sofia','Tiago','Vitória','Yasmin'];
    const last = ['Almeida','Barbosa','Cardoso','Dias','Ferreira','Gomes','Lima','Martins','Nascimento','Oliveira','Pereira','Ribeiro','Rocha','Santos','Silva','Souza'];
    const streets = ['Rua das Acácias','Avenida Central','Rua do Mercado','Alameda das Flores','Rua da Tecnologia','Avenida Brasil','Rua do Sol','Travessa da Qualidade'];
    const citiesBr = [['Curitiba','PR'],['São Paulo','SP'],['Belo Horizonte','MG'],['Porto Alegre','RS'],['Recife','PE'],['Florianópolis','SC'],['Salvador','BA'],['Goiânia','GO']];
    const citiesPt = [['Lisboa','Lisboa'],['Porto','Porto'],['Braga','Braga'],['Coimbra','Coimbra'],['Faro','Faro'],['Aveiro','Aveiro']];
    const uuid = () => crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r=randomInt(16); return (c==='x'?r:(r&3)|8).toString(16); });
    const makeCpf = () => {
      const calc=(base,w)=>{const s=[...base].reduce((a,d,i)=>a+Number(d)*w[i],0),r=s%11;return r<2?0:11-r;};
      let b=Array.from({length:9},()=>randomInt(10)).join(''); if(/^(\d)\1{8}$/.test(b)) b='1'+b.slice(1);
      const d1=calc(b,[10,9,8,7,6,5,4,3,2]),d2=calc(b+d1,[11,10,9,8,7,6,5,4,3,2]); return `${b}${d1}${d2}`;
    };
    const generate = () => {
      const count = clamp(q('#fake-count').value, 1, 500);
      const locale = q('#fake-locale').value;
      const includeDoc = q('#fake-cpf').checked;
      const includeAddress = q('#fake-address').checked;
      const cities = locale === 'br' ? citiesBr : citiesPt;
      const records = Array.from({ length: count }, (_, index) => {
        const given = randomItem(first), family = randomItem(last), [city, region] = randomItem(cities);
        const record = {
          id: uuid(),
          nome: `${given} ${family}`,
          email: `${given}.${family}.${index + 1}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase() + '@example.test',
          telefone: locale === 'br' ? `+55 41 9${String(randomInt(100000000)).padStart(8,'0')}` : `+351 9${String(randomInt(100000000)).padStart(8,'0')}`,
          ativo: randomInt(2) === 1,
          criadoEm: new Date(Date.now() - randomInt(31536000000)).toISOString()
        };
        if (includeDoc) record.documentoTeste = locale === 'br' ? makeCpf() : `PT${String(randomInt(1000000000)).padStart(9,'0')}`;
        if (includeAddress) record.endereco = { logradouro: randomItem(streets), numero: 1 + randomInt(9999), cidade: city, regiao: region };
        return record;
      });
      const format = q('#fake-format').value;
      let content;
      if (format === 'json') content = JSON.stringify(records, null, 2);
      else {
        const flattened = records.map((r) => ({ id:r.id,nome:r.nome,email:r.email,telefone:r.telefone,ativo:r.ativo,criadoEm:r.criadoEm,documentoTeste:r.documentoTeste||'',logradouro:r.endereco?.logradouro||'',numero:r.endereco?.numero||'',cidade:r.endereco?.cidade||'',regiao:r.endereco?.regiao||'' }));
        const headers = Object.keys(flattened[0] || {});
        content = [headers.join(','), ...flattened.map((r) => headers.map((h) => csvCell(r[h])).join(','))].join('\n');
      }
      outputText('#fake-output', content);
      showStatus(`${count} registro${count === 1 ? '' : 's'} gerado${count === 1 ? '' : 's'} localmente. Os e-mails usam o domínio reservado example.test.`, 'success');
      trackAction('generate_test_data', { data_type: 'fake_records', quantity: count, format });
      return { content, format };
    };
    q('#generate-fake').addEventListener('click', generate);
    q('#download-fake').addEventListener('click', () => {
      const value = q('#fake-output').textContent;
      if (!value) return showStatus('Gere a massa antes de baixar.', 'warning');
      const format = q('#fake-format').value;
      downloadText(value, `massa-ficticia.${format}`, format === 'json' ? 'application/json' : 'text/csv;charset=utf-8');
      trackAction('download_result', { format });
    });
    generate();
  }

  function geradorUuid() {
    html(`<div class="two-col"><div class="field"><label for="uuid-count">Quantidade</label><input class="input" id="uuid-count" type="number" min="1" max="500" value="10"></div><div class="field"><label for="uuid-case">Formato</label><select id="uuid-case"><option value="lower">Minúsculas</option><option value="upper">Maiúsculas</option><option value="braces">Com chaves</option></select></div></div><div class="actions"><button class="btn btn-primary" id="generate-uuid">Gerar UUIDs</button><button class="btn btn-secondary" data-copy-target="#uuid-output">Copiar</button><button class="btn btn-secondary" data-download-target="#uuid-output" data-filename="uuids.txt">Baixar</button></div><pre class="output large" id="uuid-output"></pre><div class="status" id="status"></div>`);
    const make = () => crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r=randomInt(16); return (c==='x'?r:(r&3)|8).toString(16); });
    const generate = () => {
      const count = clamp(q('#uuid-count').value, 1, 500), format=q('#uuid-case').value;
      const result=Array.from({length:count},()=>{let v=make();if(format==='upper')v=v.toUpperCase();if(format==='braces')v=`{${v}}`;return v;});
      outputText('#uuid-output',result.join('\n')); showStatus(`${count} UUID${count===1?'':'s'} v4 gerado${count===1?'':'s'}.`,'success'); trackAction('generate_test_data',{data_type:'uuid',quantity:count});
    };
    q('#generate-uuid').addEventListener('click',generate); generate();
  }

  function geradorStringAleatoria() {
    html(`<div class="two-col"><div class="field"><label for="string-length">Tamanho</label><input class="input" id="string-length" type="number" min="1" max="4096" value="32"></div><div class="field"><label for="string-count">Quantidade</label><input class="input" id="string-count" type="number" min="1" max="100" value="5"></div></div><div class="options-row"><label class="check"><input id="str-lower" type="checkbox" checked> a–z</label><label class="check"><input id="str-upper" type="checkbox" checked> A–Z</label><label class="check"><input id="str-digits" type="checkbox" checked> 0–9</label><label class="check"><input id="str-symbols" type="checkbox"> Símbolos</label><label class="check"><input id="str-no-ambiguous" type="checkbox" checked> Evitar 0/O/l/I</label></div><div class="actions"><button class="btn btn-primary" id="generate-string">Gerar strings</button><button class="btn btn-secondary" data-copy-target="#string-output">Copiar</button><button class="btn btn-secondary" data-download-target="#string-output" data-filename="strings-aleatorias.txt">Baixar</button></div><pre class="output large" id="string-output"></pre><div class="status" id="status"></div>`);
    const generate=()=>{
      const length=clamp(q('#string-length').value,1,4096),count=clamp(q('#string-count').value,1,100),avoid=q('#str-no-ambiguous').checked;
      let chars=''; if(q('#str-lower').checked)chars+='abcdefghijklmnopqrstuvwxyz';if(q('#str-upper').checked)chars+='ABCDEFGHIJKLMNOPQRSTUVWXYZ';if(q('#str-digits').checked)chars+='0123456789';if(q('#str-symbols').checked)chars+='!@#$%&*+-_=?:.';
      if(avoid)chars=chars.replace(/[0OIl1]/g,'');
      if(!chars)return showStatus('Selecione pelo menos um conjunto de caracteres.','error');
      const values=Array.from({length:count},()=>Array.from({length},()=>chars[randomInt(chars.length)]).join(''));
      outputText('#string-output',values.join('\n'));showStatus(`${count} string${count===1?'':'s'} gerada${count===1?'':'s'} com fonte aleatória criptográfica do navegador.`,'success');trackAction('generate_test_data',{data_type:'random_string',quantity:count,length});
    };
    q('#generate-string').addEventListener('click',generate);generate();
  }

  function loremIpsumQa() {
    html(`<div class="two-col"><div class="field"><label for="lorem-mode">Unidade</label><select id="lorem-mode"><option value="paragraphs">Parágrafos</option><option value="sentences">Frases</option><option value="words">Palavras</option></select></div><div class="field"><label for="lorem-count">Quantidade</label><input class="input" id="lorem-count" type="number" min="1" max="100" value="3"></div></div><div class="options-row"><label class="check"><input id="lorem-start" type="checkbox" checked> Começar com “Lorem ipsum”</label></div><div class="actions"><button class="btn btn-primary" id="generate-lorem">Gerar texto</button><button class="btn btn-secondary" data-copy-target="#lorem-output">Copiar</button><button class="btn btn-secondary" data-download-target="#lorem-output" data-filename="texto-teste.txt">Baixar</button></div><div class="output large" id="lorem-output"></div><div class="status" id="status"></div>`);
    const words='lorem ipsum qualidade software teste cenário automação validação requisito integração sistema dado resposta serviço usuário interface desempenho segurança confiabilidade cobertura evidência fluxo exceção resultado ambiente desenvolvimento equipe produto entrega análise melhoria contínua'.split(' ');
    const sentence=(n=8)=>{const text=Array.from({length:n},()=>randomItem(words)).join(' ');return text.charAt(0).toUpperCase()+text.slice(1)+'.';};
    const generate=()=>{
      const mode=q('#lorem-mode').value,count=clamp(q('#lorem-count').value,1,100);let result='';
      if(mode==='words')result=Array.from({length:count},()=>randomItem(words)).join(' ');
      if(mode==='sentences')result=Array.from({length:count},()=>sentence(6+randomInt(8))).join(' ');
      if(mode==='paragraphs')result=Array.from({length:count},()=>Array.from({length:3+randomInt(4)},()=>sentence(7+randomInt(9))).join(' ')).join('\n\n');
      if(q('#lorem-start').checked){const prefix='Lorem ipsum';result=prefix+result.replace(/^\w+(?:\s+\w+)?/,'');}
      outputText('#lorem-output',result);showStatus('Texto fictício gerado para preenchimento e validação de layouts.','success');trackAction('generate_test_data',{data_type:'test_text',mode,quantity:count});
    };
    q('#generate-lorem').addEventListener('click',generate);generate();
  }

  function formatadorJson() {
    html(`<div class="field"><label for="json-input">JSON de entrada</label><textarea id="json-input" spellcheck="false" placeholder='{"status":"ok","items":[1,2,3]}'></textarea></div><div class="options-row"><label class="check"><input id="json-sort" type="checkbox"> Ordenar chaves</label><label class="field-inline">Indentação <select id="json-indent"><option value="2">2 espaços</option><option value="4">4 espaços</option><option value="tab">Tab</option></select></label></div><div class="actions"><button class="btn btn-primary" id="format-json">Formatar e validar</button><button class="btn btn-secondary" id="minify-json">Minificar</button><button class="btn btn-secondary" data-copy-target="#json-output">Copiar</button><button class="btn btn-secondary" data-download-target="#json-output" data-filename="dados.json" data-mime="application/json">Baixar</button></div><pre class="output large" id="json-output"></pre><div class="status" id="status"></div>`);
    q('#json-input').value='{"usuario":{"id":123,"nome":"Exemplo"},"permissoes":["ler","testar"],"ativo":true}';
    const sortObj=(value)=>Array.isArray(value)?value.map(sortObj):value&&typeof value==='object'?Object.keys(value).sort().reduce((o,k)=>(o[k]=sortObj(value[k]),o),{}):value;
    const run=(minify=false)=>{try{let data=JSON.parse(q('#json-input').value);if(q('#json-sort').checked)data=sortObj(data);const indent=minify?0:(q('#json-indent').value==='tab'?'\t':Number(q('#json-indent').value));outputText('#json-output',JSON.stringify(data,null,indent));showStatus('JSON válido.','success');trackAction(minify?'minify_json':'format_json');}catch(error){outputText('#json-output','');showStatus(`JSON inválido: ${error.message}`,'error');}};
    q('#format-json').addEventListener('click',()=>run(false));q('#minify-json').addEventListener('click',()=>run(true));run(false);
  }

  function comparadorJson() {
    html(`<div class="two-col"><div class="field"><label for="json-a">JSON A</label><textarea id="json-a" spellcheck="false"></textarea></div><div class="field"><label for="json-b">JSON B</label><textarea id="json-b" spellcheck="false"></textarea></div></div><div class="options-row"><label class="check"><input id="ignore-array-order" type="checkbox"> Ignorar ordem de arrays simples</label></div><div class="actions"><button class="btn btn-primary" id="compare-json">Comparar JSONs</button><button class="btn btn-secondary" id="swap-json">Trocar lados</button></div><div id="json-diff"></div><div class="status" id="status"></div>`);
    q('#json-a').value='{"id":1,"nome":"Teste","perfis":["qa","dev"],"ativo":true}';q('#json-b').value='{"id":1,"nome":"Teste QA","perfis":["dev","qa"],"ativo":false,"versao":2}';
    const stable=(v)=>JSON.stringify(v);
    const compare=(a,b,path='$',diffs=[])=>{
      if(q('#ignore-array-order').checked&&Array.isArray(a)&&Array.isArray(b)&&a.every(x=>x===null||typeof x!=='object')&&b.every(x=>x===null||typeof x!=='object')){a=[...a].sort();b=[...b].sort();}
      if(Object.is(a,b))return diffs;
      const ta=Array.isArray(a)?'array':a===null?'null':typeof a,tb=Array.isArray(b)?'array':b===null?'null':typeof b;
      if(ta!==tb){diffs.push({path,type:'tipo',a,b});return diffs;}
      if(ta==='object'||ta==='array'){
        const keys=new Set([...Object.keys(a),...Object.keys(b)]);
        for(const key of keys){const next=ta==='array'?`${path}[${key}]`:`${path}.${key}`;if(!(key in a))diffs.push({path:next,type:'adicionado',a:undefined,b:b[key]});else if(!(key in b))diffs.push({path:next,type:'removido',a:a[key],b:undefined});else compare(a[key],b[key],next,diffs);}
      }else diffs.push({path,type:'alterado',a,b});return diffs;
    };
    const render=()=>{try{const a=JSON.parse(q('#json-a').value),b=JSON.parse(q('#json-b').value),diffs=compare(a,b);if(!diffs.length){q('#json-diff').innerHTML='<div class="empty-state">Os JSONs são equivalentes nas opções selecionadas.</div>';showStatus('Nenhuma diferença encontrada.','success');}else{q('#json-diff').innerHTML=`<div class="table-wrap"><table><thead><tr><th>Caminho</th><th>Tipo</th><th>JSON A</th><th>JSON B</th></tr></thead><tbody>${diffs.map(d=>`<tr><td><code>${escapeHtml(d.path)}</code></td><td>${escapeHtml(d.type)}</td><td>${escapeHtml(d.a===undefined?'—':stable(d.a))}</td><td>${escapeHtml(d.b===undefined?'—':stable(d.b))}</td></tr>`).join('')}</tbody></table></div>`;showStatus(`${diffs.length} diferença${diffs.length===1?'':'s'} encontrada${diffs.length===1?'':'s'}.`,'warning');}trackAction('compare_json',{difference_count:diffs.length});}catch(error){q('#json-diff').innerHTML='';showStatus(`Não foi possível comparar: ${error.message}`,'error');}};
    q('#compare-json').addEventListener('click',render);q('#swap-json').addEventListener('click',()=>{const a=q('#json-a').value;q('#json-a').value=q('#json-b').value;q('#json-b').value=a;render();});render();
  }

  function conversorJsonCsv() {
    html(`<div class="two-col"><div class="field"><label for="convert-direction">Conversão</label><select id="convert-direction"><option value="json-csv">JSON → CSV</option><option value="csv-json">CSV → JSON</option></select></div><div class="field"><label for="csv-delimiter">Separador CSV</label><select id="csv-delimiter"><option value=",">Vírgula (,)</option><option value=";">Ponto e vírgula (;)</option><option value="\t">Tabulação</option></select></div></div><div class="field"><label for="convert-input">Entrada</label><textarea id="convert-input" spellcheck="false"></textarea></div><div class="actions"><button class="btn btn-primary" id="convert-data">Converter</button><button class="btn btn-secondary" data-copy-target="#convert-output">Copiar</button><button class="btn btn-secondary" id="download-converted">Baixar</button></div><pre class="output large" id="convert-output"></pre><div class="status" id="status"></div>`);
    q('#convert-input').value='[{"id":1,"nome":"Ana","ativo":true},{"id":2,"nome":"Bruno","ativo":false}]';
    const parseCsv=(text,delimiter)=>{const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c==='"'&&quoted&&n==='"'){cell+='"';i++;}else if(c==='"')quoted=!quoted;else if(c===delimiter&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&n==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}else cell+=c;}if(cell||row.length){row.push(cell);rows.push(row);}return rows.filter(r=>r.some(v=>v!==''));};
    const infer=(v)=>{const t=v.trim();if(t==='true')return true;if(t==='false')return false;if(t==='null')return null;if(t!==''&&!Number.isNaN(Number(t)))return Number(t);return v;};
    const convert=()=>{try{const direction=q('#convert-direction').value,delimiter=q('#csv-delimiter').value==='\\t'?'\t':q('#csv-delimiter').value;let result='';if(direction==='json-csv'){const data=JSON.parse(q('#convert-input').value);if(!Array.isArray(data)||!data.every(x=>x&&typeof x==='object'&&!Array.isArray(x)))throw new Error('Use um array de objetos JSON.');const headers=[...new Set(data.flatMap(Object.keys))];result=[headers.map(csvCell).join(delimiter),...data.map(row=>headers.map(h=>csvCell(typeof row[h]==='object'?JSON.stringify(row[h]):row[h])).join(delimiter))].join('\n');}else{const rows=parseCsv(q('#convert-input').value,delimiter);if(rows.length<1)throw new Error('CSV vazio.');const [headers,...body]=rows;result=JSON.stringify(body.map(row=>Object.fromEntries(headers.map((h,i)=>[h.trim(),infer(row[i]??'')]))),null,2);}outputText('#convert-output',result);showStatus('Conversão concluída localmente.','success');trackAction('convert_data',{direction});return result;}catch(error){outputText('#convert-output','');showStatus(`Erro na conversão: ${error.message}`,'error');return '';}};
    q('#convert-data').addEventListener('click',convert);q('#convert-direction').addEventListener('change',()=>{q('#convert-input').value=q('#convert-direction').value==='json-csv'?'[{"id":1,"nome":"Ana"},{"id":2,"nome":"Bruno"}]':'id,nome\n1,Ana\n2,Bruno';outputText('#convert-output','');});q('#download-converted').addEventListener('click',()=>{const value=q('#convert-output').textContent||convert();if(!value)return;const json=q('#convert-direction').value==='csv-json';downloadText(value,json?'dados.json':'dados.csv',json?'application/json':'text/csv;charset=utf-8');});convert();
  }

  function jwtDecoder() {
    html(`<div class="field"><label for="jwt-input">Token JWT</label><textarea id="jwt-input" spellcheck="false" placeholder="Cole um token JWT"></textarea></div><div class="actions"><button class="btn btn-primary" id="decode-jwt">Decodificar</button><button class="btn btn-secondary" id="clear-jwt">Limpar</button></div><div class="two-col"><div><h3>Header</h3><pre class="output large" id="jwt-header"></pre></div><div><h3>Payload</h3><pre class="output large" id="jwt-payload"></pre></div></div><div class="status" id="status"></div><p class="note">Esta ferramenta apenas decodifica header e payload. Ela não verifica a assinatura nem confirma a autenticidade do token.</p>`);
    q('#jwt-input').value='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3VhcmlvLXRlc3RlIiwicm9sZSI6IlFBIiwiaWF0IjoxNzAwMDAwMDAwfQ.exemplo-assinatura';
    const decodePart=(part)=>{let s=part.replace(/-/g,'+').replace(/_/g,'/');s+='='.repeat((4-s.length%4)%4);const bytes=Uint8Array.from(atob(s),c=>c.charCodeAt(0));return JSON.parse(new TextDecoder().decode(bytes));};
    const decode=()=>{try{const parts=q('#jwt-input').value.trim().split('.');if(parts.length!==3)throw new Error('Um JWT deve ter três partes separadas por ponto.');const header=decodePart(parts[0]),payload=decodePart(parts[1]);outputText('#jwt-header',JSON.stringify(header,null,2));outputText('#jwt-payload',JSON.stringify(payload,null,2));let message='Token decodificado. A assinatura não foi validada.';let type='success';if(payload.exp){const expired=Date.now()/1000>Number(payload.exp);message+=` Expiração: ${new Date(Number(payload.exp)*1000).toLocaleString('pt-BR')} (${expired?'expirado':'ainda válido pelo relógio local'}).`;type=expired?'warning':'success';}showStatus(message,type);trackAction('decode_jwt');}catch(error){outputText('#jwt-header','');outputText('#jwt-payload','');showStatus(`Token inválido ou não decodificável: ${error.message}`,'error');}};
    q('#decode-jwt').addEventListener('click',decode);q('#clear-jwt').addEventListener('click',()=>{q('#jwt-input').value='';outputText('#jwt-header','');outputText('#jwt-payload','');q('#status').className='status';});decode();
  }

  function montadorCurl() {
    html(`<div class="two-col"><div class="field"><label for="curl-method">Método</label><select id="curl-method"><option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option><option>HEAD</option></select></div><div class="field"><label for="curl-url">URL</label><input class="input" id="curl-url" type="url" value="https://api.example.test/v1/usuarios"></div></div><div class="field"><label for="curl-headers">Headers — um por linha</label><textarea id="curl-headers" spellcheck="false">Accept: application/json\nContent-Type: application/json</textarea></div><div class="field"><label for="curl-body">Corpo opcional</label><textarea id="curl-body" spellcheck="false">{"nome":"Usuário de teste","ativo":true}</textarea></div><div class="options-row"><label class="check"><input id="curl-pretty" type="checkbox" checked> Quebrar em linhas</label><label class="check"><input id="curl-insecure" type="checkbox"> Adicionar -k (somente testes controlados)</label></div><div class="actions"><button class="btn btn-primary" id="build-curl">Montar cURL</button><button class="btn btn-secondary" data-copy-target="#curl-output">Copiar</button></div><pre class="output large" id="curl-output"></pre><div class="status" id="status"></div>`);
    const shellQuote=(value)=>`'${String(value).replaceAll("'", "'\\''")}'`;
    const build=()=>{try{const method=q('#curl-method').value,url=q('#curl-url').value.trim();if(!/^https?:\/\//i.test(url))throw new Error('Informe uma URL HTTP ou HTTPS válida.');const parts=['curl',q('#curl-insecure').checked?'-k':'',`-X ${method}`,shellQuote(url)].filter(Boolean);const headers=q('#curl-headers').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);headers.forEach(h=>parts.push(`-H ${shellQuote(h)}`));const body=q('#curl-body').value.trim();if(body&& !['GET','HEAD'].includes(method))parts.push(`--data-raw ${shellQuote(body)}`);const sep=q('#curl-pretty').checked?' \\\n  ':' ';outputText('#curl-output',parts.join(sep));showStatus('Comando montado. Revise URLs, credenciais e dados antes de executar.','success');trackAction('build_curl',{method});}catch(error){outputText('#curl-output','');showStatus(error.message,'error');}};
    q('#build-curl').addEventListener('click',build);q('#curl-method').addEventListener('change',build);build();
  }

  function statusHttp() {
    const statuses=[
      [100,'Continue','Informacional','O cliente pode continuar a requisição.'],[101,'Switching Protocols','Informacional','O protocolo está sendo alterado.'],
      [200,'OK','Sucesso','A requisição foi processada com sucesso.'],[201,'Created','Sucesso','Um novo recurso foi criado.'],[202,'Accepted','Sucesso','A requisição foi aceita para processamento posterior.'],[204,'No Content','Sucesso','Sucesso sem corpo na resposta.'],[206,'Partial Content','Sucesso','Resposta parcial, comum em downloads por faixa.'],
      [301,'Moved Permanently','Redirecionamento','O recurso mudou permanentemente.'],[302,'Found','Redirecionamento','Redirecionamento temporário.'],[304,'Not Modified','Redirecionamento','O cache do cliente ainda é válido.'],[307,'Temporary Redirect','Redirecionamento','Redirecionamento temporário preservando o método.'],[308,'Permanent Redirect','Redirecionamento','Redirecionamento permanente preservando o método.'],
      [400,'Bad Request','Erro do cliente','A requisição é inválida ou malformada.'],[401,'Unauthorized','Erro do cliente','Autenticação ausente ou inválida.'],[403,'Forbidden','Erro do cliente','A identidade foi reconhecida, mas não tem permissão.'],[404,'Not Found','Erro do cliente','O recurso não foi encontrado.'],[405,'Method Not Allowed','Erro do cliente','O método HTTP não é aceito nesse recurso.'],[409,'Conflict','Erro do cliente','Conflito com o estado atual do recurso.'],[415,'Unsupported Media Type','Erro do cliente','Tipo de conteúdo não suportado.'],[422,'Unprocessable Content','Erro do cliente','A sintaxe está correta, mas há erro semântico ou de validação.'],[429,'Too Many Requests','Erro do cliente','Limite de requisições excedido.'],
      [500,'Internal Server Error','Erro do servidor','Falha inesperada no servidor.'],[501,'Not Implemented','Erro do servidor','Funcionalidade ainda não implementada.'],[502,'Bad Gateway','Erro do servidor','Gateway recebeu resposta inválida do serviço de origem.'],[503,'Service Unavailable','Erro do servidor','Serviço temporariamente indisponível.'],[504,'Gateway Timeout','Erro do servidor','O serviço de origem não respondeu a tempo.']
    ];
    html(`<div class="two-col"><div class="field"><label for="http-search">Pesquisar código ou termo</label><input class="input" id="http-search" type="search" placeholder="Ex.: 404, autenticação, gateway"></div><div class="field"><label for="http-group">Grupo</label><select id="http-group"><option value="Todos">Todos</option><option>Informacional</option><option>Sucesso</option><option>Redirecionamento</option><option>Erro do cliente</option><option>Erro do servidor</option></select></div></div><p id="http-count"></p><div class="table-wrap"><table><thead><tr><th>Código</th><th>Nome</th><th>Grupo</th><th>Quando aparece</th></tr></thead><tbody id="http-table"></tbody></table></div><div class="status" id="status"></div>`);
    const render=()=>{const term=q('#http-search').value.trim().toLowerCase(),group=q('#http-group').value;const filtered=statuses.filter(row=>(group==='Todos'||row[2]===group)&&(!term||row.join(' ').toLowerCase().includes(term)));q('#http-table').innerHTML=filtered.map(r=>`<tr><td><strong>${r[0]}</strong></td><td>${escapeHtml(r[1])}</td><td>${escapeHtml(r[2])}</td><td>${escapeHtml(r[3])}</td></tr>`).join('');q('#http-count').textContent=`${filtered.length} código${filtered.length===1?'':'s'} exibido${filtered.length===1?'':'s'}.`;};
    q('#http-search').addEventListener('input',render);q('#http-group').addEventListener('change',render);render();
  }

  function formatadorXml() {
    html(`<div class="field"><label for="xml-input">XML de entrada</label><textarea id="xml-input" spellcheck="false"></textarea></div><div class="actions"><button class="btn btn-primary" id="format-xml">Formatar e validar</button><button class="btn btn-secondary" id="minify-xml">Minificar</button><button class="btn btn-secondary" data-copy-target="#xml-output">Copiar</button><button class="btn btn-secondary" data-download-target="#xml-output" data-filename="documento.xml" data-mime="application/xml">Baixar</button></div><pre class="output large" id="xml-output"></pre><div class="status" id="status"></div>`);
    q('#xml-input').value='<?xml version="1.0" encoding="UTF-8"?><usuarios><usuario id="1"><nome>Ana</nome><ativo>true</ativo></usuario><usuario id="2"><nome>Bruno</nome><ativo>false</ativo></usuario></usuarios>';
    const parse=()=>{const doc=new DOMParser().parseFromString(q('#xml-input').value,'application/xml');const error=doc.querySelector('parsererror');if(error)throw new Error(error.textContent.split('\n')[0]);return doc;};
    const pretty=(xml)=>{const compact=new XMLSerializer().serializeToString(xml).replace(/>\s*</g,'><');const tokens=compact.replace(/></g,'>\n<').split('\n');let indent=0;return tokens.map(token=>{if(/^<\//.test(token))indent=Math.max(0,indent-1);const line='  '.repeat(indent)+token;if(/^<[^!?/][^>]*[^/]?>$/.test(token)&&!/<\/[^>]+>$/.test(token))indent++;return line;}).join('\n');};
    const run=(minify=false)=>{try{const doc=parse();const value=minify?new XMLSerializer().serializeToString(doc).replace(/>\s+</g,'><'):pretty(doc);outputText('#xml-output',value);showStatus('XML válido.','success');trackAction(minify?'minify_xml':'format_xml');}catch(error){outputText('#xml-output','');showStatus(`XML inválido: ${error.message}`,'error');}};
    q('#format-xml').addEventListener('click',()=>run(false));q('#minify-xml').addEventListener('click',()=>run(true));run(false);
  }

  function testadorSeletoresHtml() {
    html(`<div class="field"><label for="selector-html">Trecho de HTML</label><textarea id="selector-html" spellcheck="false"></textarea></div><div class="two-col"><div class="field"><label for="selector-type">Tipo</label><select id="selector-type"><option value="css">Seletor CSS</option><option value="xpath">XPath</option></select></div><div class="field"><label for="selector-value">Seletor</label><input class="input" id="selector-value" value="button[data-testid='salvar']"></div></div><div class="actions"><button class="btn btn-primary" id="test-selector">Testar seletor</button><button class="btn btn-secondary" id="selector-example">Carregar exemplo</button></div><div id="selector-results"></div><div class="status" id="status"></div><p class="note">O HTML é analisado em um documento isolado. Scripts presentes no trecho não são executados.</p>`);
    const example='<main id="conteudo">\n  <form class="cadastro">\n    <label>Nome <input name="nome" required></label>\n    <button type="submit" data-testid="salvar">Salvar</button>\n    <button type="button" class="cancelar">Cancelar</button>\n  </form>\n</main>';
    const load=()=>{q('#selector-html').value=example;q('#selector-type').value='css';q('#selector-value').value="button[data-testid='salvar']";};load();
    const describe=(el,index)=>{const attrs=[...el.attributes].slice(0,6).map(a=>`${a.name}="${a.value}"`).join(' ');const text=(el.textContent||'').trim().replace(/\s+/g,' ').slice(0,120);return `<div class="match-card"><strong>${index+1}. &lt;${escapeHtml(el.tagName.toLowerCase())}${attrs?' '+escapeHtml(attrs):''}&gt;</strong>${text?`<div>${escapeHtml(text)}</div>`:''}</div>`;};
    const test=()=>{try{const doc=new DOMParser().parseFromString(q('#selector-html').value,'text/html'),type=q('#selector-type').value,value=q('#selector-value').value.trim();if(!value)throw new Error('Informe um seletor.');let nodes=[];if(type==='css')nodes=[...doc.querySelectorAll(value)];else{const result=doc.evaluate(value,doc,null,XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,null);for(let i=0;i<result.snapshotLength;i++){const node=result.snapshotItem(i);if(node.nodeType===Node.ELEMENT_NODE)nodes.push(node);}}q('#selector-results').innerHTML=nodes.length?nodes.slice(0,100).map(describe).join(''):'<div class="empty-state">Nenhum elemento corresponde ao seletor.</div>';showStatus(`${nodes.length} elemento${nodes.length===1?'':'s'} encontrado${nodes.length===1?'':'s'}.` ,nodes.length?'success':'warning');trackAction('test_selector',{selector_type:type,match_count:nodes.length});}catch(error){q('#selector-results').innerHTML='';showStatus(`Seletor inválido: ${error.message}`,'error');}};
    q('#test-selector').addEventListener('click',test);q('#selector-example').addEventListener('click',()=>{load();test();});q('#selector-type').addEventListener('change',()=>{q('#selector-value').value=q('#selector-type').value==='css'?"button[data-testid='salvar']":"//button[@data-testid='salvar']";});test();
  }

  function base64Tool() {
    html(`<div class="field"><label for="base64-input">Entrada</label><textarea id="base64-input" spellcheck="false">Utilitários QA — processamento local no navegador.</textarea></div><div class="actions"><button class="btn btn-primary" id="base64-encode">Codificar</button><button class="btn btn-secondary" id="base64-decode">Decodificar</button><button class="btn btn-secondary" data-copy-target="#base64-output">Copiar resultado</button></div><pre class="output large" id="base64-output"></pre><div class="status" id="status"></div>`);
    const encode=(text)=>{const bytes=new TextEncoder().encode(text);let binary='';bytes.forEach(b=>binary+=String.fromCharCode(b));return btoa(binary);};
    const decode=(text)=>{const binary=atob(text.replace(/\s/g,''));return new TextDecoder().decode(Uint8Array.from(binary,c=>c.charCodeAt(0)));};
    q('#base64-encode').addEventListener('click',()=>{try{outputText('#base64-output',encode(q('#base64-input').value));showStatus('Texto codificado em Base64.','success');trackAction('base64_encode');}catch(error){showStatus(error.message,'error');}});
    q('#base64-decode').addEventListener('click',()=>{try{outputText('#base64-output',decode(q('#base64-input').value));showStatus('Base64 decodificado como UTF-8.','success');trackAction('base64_decode');}catch(_){outputText('#base64-output','');showStatus('Entrada Base64 inválida.','error');}});q('#base64-encode').click();
  }

  function urlEncodeDecode() {
    html(`<div class="field"><label for="url-input">Texto ou URL</label><textarea id="url-input" spellcheck="false">https://example.test/busca?termo=qualidade de software&filtro=QA + API</textarea></div><div class="field"><label for="url-mode">Modo</label><select id="url-mode"><option value="component">Componente de URL — encodeURIComponent</option><option value="full">URL completa — encodeURI</option></select></div><div class="actions"><button class="btn btn-primary" id="url-encode">Codificar</button><button class="btn btn-secondary" id="url-decode">Decodificar</button><button class="btn btn-secondary" data-copy-target="#url-output">Copiar</button></div><pre class="output large" id="url-output"></pre><div class="status" id="status"></div>`);
    const run=(direction)=>{try{const text=q('#url-input').value,full=q('#url-mode').value==='full';const result=direction==='encode'?(full?encodeURI(text):encodeURIComponent(text)):(full?decodeURI(text):decodeURIComponent(text));outputText('#url-output',result);showStatus(direction==='encode'?'Conteúdo codificado.':'Conteúdo decodificado.','success');trackAction(`url_${direction}`);}catch(error){outputText('#url-output','');showStatus(`Não foi possível concluir: ${error.message}`,'error');}};
    q('#url-encode').addEventListener('click',()=>run('encode'));q('#url-decode').addEventListener('click',()=>run('decode'));run('encode');
  }

  function htmlEscapeTool() {
    html(`<div class="field"><label for="html-input">HTML ou texto</label><textarea id="html-input" spellcheck="false"><button class="acao">Salvar & continuar</button></textarea></div><div class="actions"><button class="btn btn-primary" id="html-escape-btn">Escapar HTML</button><button class="btn btn-secondary" id="html-unescape-btn">Restaurar entidades</button><button class="btn btn-secondary" data-copy-target="#html-output">Copiar</button></div><pre class="output large" id="html-output"></pre><div class="status" id="status"></div>`);
    const decode=(value)=>{const area=document.createElement('textarea');area.innerHTML=value;return area.value;};
    q('#html-escape-btn').addEventListener('click',()=>{outputText('#html-output',escapeHtml(q('#html-input').value));showStatus('Caracteres especiais convertidos em entidades HTML.','success');trackAction('html_escape');});
    q('#html-unescape-btn').addEventListener('click',()=>{outputText('#html-output',decode(q('#html-input').value));showStatus('Entidades HTML restauradas como texto.','success');trackAction('html_unescape');});q('#html-escape-btn').click();
  }

  function comparadorTexto() {
    html(`<div class="two-col"><div class="field"><label for="text-a">Texto A</label><textarea id="text-a" spellcheck="false"></textarea></div><div class="field"><label for="text-b">Texto B</label><textarea id="text-b" spellcheck="false"></textarea></div></div><div class="options-row"><label class="check"><input id="diff-case" type="checkbox"> Ignorar maiúsculas/minúsculas</label><label class="check"><input id="diff-trim" type="checkbox" checked> Ignorar espaços nas extremidades</label><label class="check"><input id="diff-empty" type="checkbox"> Ignorar linhas vazias</label></div><div class="actions"><button class="btn btn-primary" id="compare-text">Comparar textos</button><button class="btn btn-secondary" id="swap-text">Trocar lados</button></div><div class="metric-grid" id="diff-metrics"></div><div id="text-diff"></div><div class="status" id="status"></div>`);
    q('#text-a').value='Iniciar sessão\nPesquisar citação\nAbrir detalhes\nValidar estado';q('#text-b').value='Iniciar sessão\nPesquisar citação\nAbrir detalhes do executado\nValidar estado\nGuardar evidência';
    const normalize=(line)=>{let v=q('#diff-trim').checked?line.trim():line;if(q('#diff-case').checked)v=v.toLowerCase();return v;};
    const lines=(value)=>{let list=value.replace(/\r/g,'').split('\n');if(q('#diff-empty').checked)list=list.filter(x=>x.trim());return list;};
    const diff=(a,b)=>{const n=a.length,m=b.length,dp=Array.from({length:n+1},()=>new Uint32Array(m+1));for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)dp[i][j]=normalize(a[i])===normalize(b[j])?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);const out=[];let i=0,j=0;while(i<n&&j<m){if(normalize(a[i])===normalize(b[j])){out.push({type:'equal',a:a[i],b:b[j]});i++;j++;}else if(dp[i+1][j]>=dp[i][j+1]){out.push({type:'removed',a:a[i],b:''});i++;}else{out.push({type:'added',a:'',b:b[j]});j++;}}while(i<n)out.push({type:'removed',a:a[i++],b:''});while(j<m)out.push({type:'added',a:'',b:b[j++]});return out;};
    const render=()=>{const a=lines(q('#text-a').value),b=lines(q('#text-b').value);if(a.length*b.length>1500000)return showStatus('Os textos são grandes demais para esta comparação no navegador. Reduza o número de linhas.','error');const rows=diff(a,b);const added=rows.filter(r=>r.type==='added').length,removed=rows.filter(r=>r.type==='removed').length,equal=rows.filter(r=>r.type==='equal').length;q('#diff-metrics').innerHTML=`<div class="metric"><strong>${equal}</strong><span>Iguais</span></div><div class="metric"><strong>${added}</strong><span>Adicionadas</span></div><div class="metric"><strong>${removed}</strong><span>Removidas</span></div><div class="metric"><strong>${a.length}/${b.length}</strong><span>Linhas A/B</span></div>`;q('#text-diff').innerHTML=`<div class="table-wrap"><table><thead><tr><th>#</th><th>Texto A</th><th>Texto B</th></tr></thead><tbody>${rows.map((r,i)=>`<tr class="${r.type==='added'?'diff-added':r.type==='removed'?'diff-removed':''}"><td>${i+1}</td><td>${escapeHtml(r.a||'')}</td><td>${escapeHtml(r.b||'')}</td></tr>`).join('')}</tbody></table></div>`;showStatus(added+removed?(added+removed===1?'1 alteração identificada.':`${added+removed} alterações identificadas.`):'Os textos são equivalentes.',added+removed?'warning':'success');trackAction('compare_text',{added,removed,equal});};
    q('#compare-text').addEventListener('click',render);q('#swap-text').addEventListener('click',()=>{const v=q('#text-a').value;q('#text-a').value=q('#text-b').value;q('#text-b').value=v;render();});render();
  }

  function contadorTexto() {
    html(`<div class="field"><label for="counter-input">Texto</label><textarea id="counter-input" spellcheck="true" placeholder="Digite ou cole um texto..."></textarea></div><div class="metric-grid" id="counter-metrics"></div><div class="actions"><button class="btn btn-secondary" id="clear-counter">Limpar</button><button class="btn btn-secondary" data-copy-target="#counter-input">Copiar texto</button></div><div class="status" id="status"></div>`);
    q('#counter-input').value='Testes claros reduzem retrabalho e ajudam a equipe a entregar software com mais confiança.';
    const update=()=>{const value=q('#counter-input').value,trim=value.trim();const words=trim?trim.split(/\s+/u).length:0,lines=value?value.split(/\r?\n/).length:0,bytes=new TextEncoder().encode(value).length,sentences=trim?(trim.match(/[.!?]+(?:\s|$)/g)||[]).length:0,paragraphs=trim?trim.split(/\n\s*\n/).filter(Boolean).length:0,minutes=words/200;q('#counter-metrics').innerHTML=`<div class="metric"><strong>${value.length}</strong><span>Caracteres</span></div><div class="metric"><strong>${value.replace(/\s/g,'').length}</strong><span>Sem espaços</span></div><div class="metric"><strong>${words}</strong><span>Palavras</span></div><div class="metric"><strong>${lines}</strong><span>Linhas</span></div><div class="metric"><strong>${bytes}</strong><span>Bytes UTF-8</span></div><div class="metric"><strong>${sentences}</strong><span>Frases</span></div><div class="metric"><strong>${paragraphs}</strong><span>Parágrafos</span></div><div class="metric"><strong>${minutes<1?'< 1':Math.ceil(minutes)} min</strong><span>Leitura estimada</span></div>`;};
    q('#counter-input').addEventListener('input',update);q('#clear-counter').addEventListener('click',()=>{q('#counter-input').value='';update();q('#counter-input').focus();});update();
  }

  function testadorRegex() {
    html(`<div class="two-col"><div class="field"><label for="regex-pattern">Expressão regular</label><input class="input" id="regex-pattern" value="\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b"></div><div class="field"><label for="regex-flags">Flags</label><input class="input" id="regex-flags" value="gi" maxlength="8" placeholder="gimuy"></div></div><div class="field"><label for="regex-text">Texto de teste</label><textarea id="regex-text" spellcheck="false">Contato principal: qa@example.test\nOutro endereço: automacao@example.test\nValor inválido: pessoa@dominio</textarea></div><div class="actions"><button class="btn btn-primary" id="run-regex">Executar Regex</button><button class="btn btn-secondary" id="clear-regex">Limpar</button></div><div class="metric-grid" id="regex-metrics"></div><div id="regex-results"></div><div class="status" id="status"></div>`);
    const run=()=>{try{const pattern=q('#regex-pattern').value,rawFlags=q('#regex-flags').value.replace(/\s/g,''),flags=[...new Set(rawFlags)].join('');const regex=new RegExp(pattern,flags.includes('g')?flags:`${flags}g`),text=q('#regex-text').value,matches=[];let match;while((match=regex.exec(text))!==null){matches.push({value:match[0],index:match.index,groups:match.slice(1)});if(match[0]==='')regex.lastIndex++;if(matches.length>=1000)break;}q('#regex-metrics').innerHTML=`<div class="metric"><strong>${matches.length}</strong><span>Correspondências</span></div><div class="metric"><strong>${matches.reduce((n,m)=>n+m.groups.length,0)}</strong><span>Grupos capturados</span></div><div class="metric"><strong>${pattern.length}</strong><span>Caracteres na expressão</span></div><div class="metric"><strong>${flags||'—'}</strong><span>Flags</span></div>`;q('#regex-results').innerHTML=matches.length?matches.map((m,i)=>`<div class="match-card"><strong>${i+1}. ${escapeHtml(m.value)}</strong><div>Índice: ${m.index}${m.groups.length?` · Grupos: ${m.groups.map(g=>escapeHtml(g??'')).join(' | ')}`:''}</div></div>`).join(''):'<div class="empty-state">Nenhuma correspondência encontrada.</div>';showStatus(matches.length?`${matches.length} correspondência${matches.length===1?'':'s'} encontrada${matches.length===1?'':'s'}.`:'Expressão válida, sem correspondências.',matches.length?'success':'warning');trackAction('test_regex',{match_count:matches.length});}catch(error){q('#regex-results').innerHTML='';q('#regex-metrics').innerHTML='';showStatus(`Expressão inválida: ${error.message}`,'error');}};
    q('#run-regex').addEventListener('click',run);q('#clear-regex').addEventListener('click',()=>{q('#regex-text').value='';run();});run();
  }

  function geradorHash() {
    html(`<div class="field"><label for="hash-input">Texto</label><textarea id="hash-input" spellcheck="false">Utilitários QA</textarea></div><div class="two-col"><div class="field"><label for="hash-algorithm">Algoritmo</label><select id="hash-algorithm"><option>SHA-256</option><option>SHA-384</option><option>SHA-512</option></select></div><div class="field"><label for="hash-format">Saída</label><select id="hash-format"><option value="hex">Hexadecimal</option><option value="base64">Base64</option></select></div></div><div class="actions"><button class="btn btn-primary" id="generate-hash">Calcular hash</button><button class="btn btn-secondary" data-copy-target="#hash-output">Copiar</button></div><pre class="output large" id="hash-output"></pre><div class="status" id="status"></div><p class="note">Hashes são unidirecionais, mas não substituem algoritmos próprios para armazenar senhas, como Argon2 ou bcrypt.</p>`);
    const run=async()=>{const button=q('#generate-hash');try{setBusy(button,true);const bytes=new TextEncoder().encode(q('#hash-input').value),digest=new Uint8Array(await crypto.subtle.digest(q('#hash-algorithm').value,bytes));let result;if(q('#hash-format').value==='hex')result=[...digest].map(b=>b.toString(16).padStart(2,'0')).join('');else{let binary='';digest.forEach(b=>binary+=String.fromCharCode(b));result=btoa(binary);}outputText('#hash-output',result);showStatus(`${q('#hash-algorithm').value} calculado localmente.`,'success');trackAction('generate_hash',{algorithm:q('#hash-algorithm').value});}catch(error){showStatus(`Não foi possível calcular o hash: ${error.message}`,'error');}finally{setBusy(button,false);}};
    q('#generate-hash').addEventListener('click',run);run();
  }

  function conversorTimestamp() {
    html(`<div class="field"><label for="timestamp-input">Timestamp Unix, ISO 8601 ou data</label><input class="input" id="timestamp-input" value="${Date.now()}"></div><div class="actions"><button class="btn btn-primary" id="convert-timestamp">Converter</button><button class="btn btn-secondary" id="timestamp-now">Usar agora</button></div><div class="table-wrap"><table><tbody id="timestamp-results"></tbody></table></div><div class="status" id="status"></div>`);
    const parse=(value)=>{const trimmed=value.trim();if(/^\d{10}$/.test(trimmed))return new Date(Number(trimmed)*1000);if(/^\d{13}$/.test(trimmed))return new Date(Number(trimmed));return new Date(trimmed);};
    const render=()=>{const date=parse(q('#timestamp-input').value);if(Number.isNaN(date.getTime())){q('#timestamp-results').innerHTML='';return showStatus('Data ou timestamp inválido.','error');}const values=[['Unix — segundos',Math.floor(date.getTime()/1000)],['Unix — milissegundos',date.getTime()],['ISO 8601',date.toISOString()],['UTC',date.toUTCString()],['Data e hora local',date.toLocaleString('pt-BR',{dateStyle:'full',timeStyle:'long'})],['Fuso detectado',Intl.DateTimeFormat().resolvedOptions().timeZone]];q('#timestamp-results').innerHTML=values.map(([label,value])=>`<tr><th>${escapeHtml(label)}</th><td><code>${escapeHtml(value)}</code></td></tr>`).join('');showStatus('Conversão concluída.','success');trackAction('convert_timestamp');};
    q('#convert-timestamp').addEventListener('click',render);q('#timestamp-now').addEventListener('click',()=>{q('#timestamp-input').value=String(Date.now());render();});render();
  }

  function formatadorSql() {
    html(`<div class="field"><label for="sql-input">Consulta SQL</label><textarea id="sql-input" spellcheck="false">SELECT u.id,u.nome,p.perfil FROM usuarios u LEFT JOIN perfis p ON p.usuario_id=u.id WHERE u.ativo=true AND u.criado_em>=CURRENT_DATE-30 ORDER BY u.nome;</textarea></div><div class="two-col"><div class="field"><label for="sql-case">Palavras-chave</label><select id="sql-case"><option value="upper">MAIÚSCULAS</option><option value="lower">minúsculas</option><option value="keep">Manter</option></select></div><div class="field"><label for="sql-indent">Indentação</label><select id="sql-indent"><option value="2">2 espaços</option><option value="4">4 espaços</option></select></div></div><div class="actions"><button class="btn btn-primary" id="format-sql">Formatar</button><button class="btn btn-secondary" id="minify-sql">Minificar</button><button class="btn btn-secondary" data-copy-target="#sql-output">Copiar</button></div><pre class="output large" id="sql-output"></pre><div class="status" id="status"></div><p class="note">Formatador voltado a consultas comuns. Dialetos e blocos procedurais complexos podem exigir uma ferramenta específica do banco.</p>`);
    const keywords=['select','from','where','left join','right join','inner join','full join','cross join','join','on','group by','order by','having','limit','offset','union all','union','insert into','values','update','set','delete from','and','or','as','distinct','case','when','then','else','end'];
    const protect=(sql)=>{const strings=[];return{value:sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"/g,m=>`__STR_${strings.push(m)-1}__`),strings};};
    const restore=(sql,strings)=>sql.replace(/__STR_(\d+)__/g,(_,i)=>strings[Number(i)]);
    const changeCase=(sql)=>{const mode=q('#sql-case').value;if(mode==='keep')return sql;const ordered=[...keywords].sort((a,b)=>b.length-a.length),regex=new RegExp(`\\b(${ordered.map(k=>k.replace(' ','\\s+')).join('|')})\\b`,'gi');return sql.replace(regex,m=>mode==='upper'?m.toUpperCase():m.toLowerCase());};
    const format=()=>{try{const indent=' '.repeat(Number(q('#sql-indent').value)),protectedSql=protect(q('#sql-input').value.trim());let sql=protectedSql.value.replace(/\s+/g,' ').replace(/\s*,\s*/g,', ');sql=changeCase(sql);const main=['SELECT','FROM','WHERE','GROUP BY','ORDER BY','HAVING','LIMIT','OFFSET','UNION ALL','UNION','INSERT INTO','VALUES','UPDATE','SET','DELETE FROM','LEFT JOIN','RIGHT JOIN','INNER JOIN','FULL JOIN','CROSS JOIN','JOIN'];for(const word of main){const rx=new RegExp(`\\s+${word.replace(' ','\\s+')}\\s+`,'gi');sql=sql.replace(rx,`\n${word} `);}sql=sql.replace(/\s+(AND|OR)\s+/gi,`\n${indent}$1 `);sql=sql.replace(/SELECT\s+/i,m=>m).replace(/,\s*/g,`,\n${indent}`);sql=restore(sql.trim(),protectedSql.strings);outputText('#sql-output',sql);showStatus('SQL formatado.','success');trackAction('format_sql');}catch(error){showStatus(error.message,'error');}};
    const minify=()=>{const protectedSql=protect(q('#sql-input').value);outputText('#sql-output',restore(changeCase(protectedSql.value.replace(/\s+/g,' ').trim()),protectedSql.strings));showStatus('SQL minificado.','success');trackAction('minify_sql');};q('#format-sql').addEventListener('click',format);q('#minify-sql').addEventListener('click',minify);format();
  }

  function contrasteCores() {
    html(`<div class="two-col"><div class="field"><label for="color-foreground">Cor do texto</label><div class="color-control"><input id="color-foreground-picker" type="color" value="#16213e"><input class="input" id="color-foreground" value="#16213e" maxlength="7"></div></div><div class="field"><label for="color-background">Cor do fundo</label><div class="color-control"><input id="color-background-picker" type="color" value="#ffffff"><input class="input" id="color-background" value="#ffffff" maxlength="7"></div></div></div><div class="preview-box" id="contrast-preview"><h3>Texto de exemplo</h3><p>Qualidade de software com acessibilidade.</p></div><div class="center"><div class="ratio-result" id="contrast-ratio">—</div><p id="contrast-summary"></p></div><div class="table-wrap"><table><thead><tr><th>Critério</th><th>Resultado</th></tr></thead><tbody id="contrast-table"></tbody></table></div><div class="actions"><button class="btn btn-secondary" id="swap-colors">Trocar cores</button></div><div class="status" id="status"></div>`);
    const validHex=(v)=>/^#[0-9a-f]{6}$/i.test(v);
    const rgb=(hex)=>[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];
    const luminance=(hex)=>{const values=rgb(hex).map(v=>{const s=v/255;return s<=.03928?s/12.92:Math.pow((s+.055)/1.055,2.4);});return .2126*values[0]+.7152*values[1]+.0722*values[2];};
    const update=()=>{const fg=q('#color-foreground').value.trim(),bg=q('#color-background').value.trim();if(!validHex(fg)||!validHex(bg))return showStatus('Use cores hexadecimais no formato #RRGGBB.','error');q('#color-foreground-picker').value=fg;q('#color-background-picker').value=bg;const ratio=(Math.max(luminance(fg),luminance(bg))+.05)/(Math.min(luminance(fg),luminance(bg))+.05);q('#contrast-preview').style.color=fg;q('#contrast-preview').style.backgroundColor=bg;q('#contrast-ratio').textContent=`${ratio.toFixed(2)}:1`;const tests=[['Texto normal — WCAG AA',ratio>=4.5],['Texto grande — WCAG AA',ratio>=3],['Texto normal — WCAG AAA',ratio>=7],['Texto grande — WCAG AAA',ratio>=4.5],['Componentes e gráficos',ratio>=3]];q('#contrast-table').innerHTML=tests.map(([name,pass])=>`<tr><td>${name}</td><td><strong>${pass?'✓ Aprovado':'✕ Reprovado'}</strong></td></tr>`).join('');q('#contrast-summary').textContent=ratio>=4.5?'Bom contraste para texto normal.':'Aumente a diferença entre as cores para texto normal.';showStatus('Contraste calculado segundo as proporções da WCAG. ',ratio>=4.5?'success':'warning');trackAction('check_contrast',{ratio:Number(ratio.toFixed(2))});};
    [['#color-foreground-picker','#color-foreground'],['#color-background-picker','#color-background']].forEach(([picker,text])=>{q(picker).addEventListener('input',()=>{q(text).value=q(picker).value;update();});q(text).addEventListener('input',update);});q('#swap-colors').addEventListener('click',()=>{const fg=q('#color-foreground').value;q('#color-foreground').value=q('#color-background').value;q('#color-background').value=fg;update();});update();
  }

  function redimensionarImagem() {
    html(`<div class="field"><label for="image-file">Imagem JPG, PNG ou WebP</label><input class="input" id="image-file" type="file" accept="image/jpeg,image/png,image/webp"></div><div class="three-col"><div class="field"><label for="image-width">Largura máxima</label><input class="input" id="image-width" type="number" min="1" max="12000" value="1600"></div><div class="field"><label for="image-height">Altura máxima</label><input class="input" id="image-height" type="number" min="1" max="12000" value="1600"></div><div class="field"><label for="image-format">Formato</label><select id="image-format"><option value="image/webp">WebP</option><option value="image/jpeg">JPEG</option><option value="image/png">PNG</option></select></div></div><div class="field"><label for="image-quality">Qualidade: <span id="quality-label">85%</span></label><input id="image-quality" type="range" min="10" max="100" value="85"></div><div class="options-row"><label class="check"><input id="image-upscale" type="checkbox"> Permitir ampliar imagens pequenas</label></div><div class="actions"><button class="btn btn-primary" id="resize-image">Redimensionar</button><button class="btn btn-secondary" id="download-image" disabled>Baixar imagem</button></div><div class="preview-box" id="image-preview-box"><p>Selecione uma imagem. O arquivo será processado somente no navegador.</p></div><div class="metric-grid" id="image-metrics"></div><div class="status" id="status"></div>`);
    let source=null,resultBlob=null,resultName='imagem-redimensionada.webp';
    q('#image-quality').addEventListener('input',()=>q('#quality-label').textContent=`${q('#image-quality').value}%`);
    q('#image-file').addEventListener('change',()=>{const file=q('#image-file').files[0];resultBlob=null;q('#download-image').disabled=true;if(!file)return;if(file.size>25*1024*1024)return showStatus('Escolha um arquivo de até 25 MB.','error');const reader=new FileReader();reader.onload=()=>{const image=new Image();image.onload=()=>{source={image,file,width:image.naturalWidth,height:image.naturalHeight};q('#image-preview-box').innerHTML='';image.className='image-preview';q('#image-preview-box').appendChild(image.cloneNode());q('#image-metrics').innerHTML=`<div class="metric"><strong>${source.width}×${source.height}</strong><span>Dimensões originais</span></div><div class="metric"><strong>${(file.size/1024).toFixed(1)} KB</strong><span>Tamanho original</span></div>`;showStatus('Imagem carregada e pronta para processamento.','success');};image.onerror=()=>showStatus('Não foi possível ler a imagem.','error');image.src=reader.result;};reader.readAsDataURL(file);});
    q('#resize-image').addEventListener('click',async()=>{if(!source)return showStatus('Selecione uma imagem primeiro.','warning');const maxW=clamp(q('#image-width').value,1,12000),maxH=clamp(q('#image-height').value,1,12000),allow=q('#image-upscale').checked;let scale=Math.min(maxW/source.width,maxH/source.height);if(!allow)scale=Math.min(1,scale);const width=Math.max(1,Math.round(source.width*scale)),height=Math.max(1,Math.round(source.height*scale));const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{alpha:q('#image-format').value==='image/png'});if(!ctx)return showStatus('Canvas não está disponível neste navegador.','error');if(q('#image-format').value==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);}ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(source.image,0,0,width,height);const type=q('#image-format').value,quality=Number(q('#image-quality').value)/100;resultBlob=await new Promise(resolve=>canvas.toBlob(resolve,type,quality));if(!resultBlob)return showStatus('Não foi possível gerar o arquivo.','error');const ext=type==='image/jpeg'?'jpg':type==='image/png'?'png':'webp';resultName=`${source.file.name.replace(/\.[^.]+$/,'')}-${width}x${height}.${ext}`;const url=URL.createObjectURL(resultBlob);const img=new Image();img.src=url;img.className='image-preview';img.onload=()=>setTimeout(()=>URL.revokeObjectURL(url),5000);q('#image-preview-box').innerHTML='';q('#image-preview-box').appendChild(img);q('#image-metrics').innerHTML=`<div class="metric"><strong>${width}×${height}</strong><span>Novas dimensões</span></div><div class="metric"><strong>${(source.file.size/1024).toFixed(1)} KB</strong><span>Original</span></div><div class="metric"><strong>${(resultBlob.size/1024).toFixed(1)} KB</strong><span>Resultado</span></div><div class="metric"><strong>${Math.round((1-resultBlob.size/source.file.size)*100)}%</strong><span>Variação de tamanho</span></div>`;q('#download-image').disabled=false;showStatus('Imagem processada localmente. Confira a prévia antes de baixar.','success');trackAction('resize_image',{width,height,format:type});});
    q('#download-image').addEventListener('click',()=>{if(!resultBlob)return;downloadText(resultBlob,resultName,resultBlob.type);trackAction('download_result',{format:resultBlob.type});});
  }

  const handlers = {
    'documentos-teste': documentosTeste,
    'gerador-dados-ficticios': geradorDadosFicticios,
    'gerador-uuid': geradorUuid,
    'gerador-string-aleatoria': geradorStringAleatoria,
    'lorem-ipsum-qa': loremIpsumQa,
    'formatador-json': formatadorJson,
    'comparador-json': comparadorJson,
    'conversor-json-csv': conversorJsonCsv,
    'jwt-decoder': jwtDecoder,
    'montador-curl': montadorCurl,
    'status-http': statusHttp,
    'formatador-xml': formatadorXml,
    'testador-seletores-html': testadorSeletoresHtml,
    'base64': base64Tool,
    'url-encode-decode': urlEncodeDecode,
    'html-escape': htmlEscapeTool,
    'comparador-texto': comparadorTexto,
    'contador-texto': contadorTexto,
    'testador-regex': testadorRegex,
    'gerador-hash': geradorHash,
    'conversor-timestamp': conversorTimestamp,
    'formatador-sql': formatadorSql,
    'contraste-cores': contrasteCores,
    'redimensionar-imagem': redimensionarImagem
  };

  try {
    if (!handlers[slug]) throw new Error('Ferramenta não registrada.');
    handlers[slug]();
  } catch (error) {
    app.innerHTML = `<div class="empty-state"><h2>Não foi possível iniciar a ferramenta</h2><p>${escapeHtml(error.message)}</p></div>`;
    console.error(error);
  }
})();
