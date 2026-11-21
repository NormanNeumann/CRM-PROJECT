'use strict';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let db = loadDatabase();
let page = 'leads';
let filters = {};
let selectedRow = '';
let submitAction;
let timer;

function navigate(type, initialFilters = {}, highlight = '') {
  page = type;
  filters = {...initialFilters};
  selectedRow = highlight;
  render();
}

function displayRows() {
  if (page === 'customers') return db.customers;
  if (page === 'leads') return db.leads.map(row => ({...row, priority: leadPriority(row)}));
  const customers = new Map(db.customers.map(c => [c.id, c]));
  return db.orders.map(row => {
    const customer = customers.get(row.customerId);
    return {...row, name:customer?.name || '—', phone:customer?.phone || '—'};
  });
}

function stats() {
  if (page === 'leads') return [
    ['线索总数', db.leads.length, ''],
    ['高优先待转化', db.leads.filter(r => leadPriority(r) === '高').length, '高'],
    ['已转为客户', db.leads.filter(r => leadPriority(r) === '已转化').length, '已转化']
  ];
  if (page === 'customers') return [
    ['客户总数', db.customers.length], ['高优先客户', db.customers.filter(r => r.priority === '高').length],
    ['已有订单客户', new Set(db.orders.map(o => o.customerId)).size]
  ];
  return [['订单总数', db.orders.length], ['下单客户', new Set(db.orders.map(o => o.customerId)).size],
    ['商品种类', new Set(db.orders.map(o => o.product)).size]];
}

function renderStats() {
  $('stats').innerHTML = stats().map(([label,n,value]) => {
    const content = '<small>'+label+'</small><strong>'+n+'</strong>';
    if (page !== 'leads') return '<div class="stat">'+content+'</div>';
    const onlyPriority = Object.keys(filters).every(k => k === 'priority');
    const pressed = onlyPriority && (filters.priority || '') === value;
    return '<button type="button" class="stat" data-priority="'+value+'" aria-pressed="'+pressed+'">'+content+'</button>';
  }).join('');
}

function render() {
  const c = cfg[page];
  document.querySelectorAll('[data-page]').forEach(b => b.setAttribute('aria-current', b.dataset.page === page ? 'page' : 'false'));
  $('heading').textContent = $('crumb').textContent = c.name + '管理';
  $('subtitle').textContent = c.sub;
  $('add').textContent = '＋ ' + c.add;
  $('listtitle').textContent = c.name + '列表';
  renderStats();
  $('filters').innerHTML = c.filters.map(key => {
    const label = c.cols[key];
    const values = page === 'leads' ? [...priority, '已转化'] : priority;
    const control = key === 'priority'
      ? '<select data-filter="priority" aria-label="'+label+'"><option value="">全部优先级</option>'+values.map(p=>'<option>'+p+'</option>').join('')+'</select>'
      : '<input aria-label="'+label+'" data-filter="'+key+'" type="'+(key === 'date' ? 'date' : 'text')+'" placeholder="输入'+label+'">';
    return '<label>'+label+control+'</label>';
  }).join('');
  $('filters').querySelectorAll('[data-filter]').forEach(el => el.value = filters[el.dataset.filter] || '');
  $('thead').innerHTML = '<tr>'+[...Object.values(c.cols),'操作'].map(s=>'<th scope="col">'+s+'</th>').join('')+'</tr>';
  $('storage').textContent = {
    local:'本地演示数据保存在当前浏览器。',
    session:'浏览器已禁用本地存储，修改仅在当前页面有效。',
    recovery:'已有本地数据无法读取。当前使用临时演示数据，原始数据已保留。'
  }[storageMode];
  renderRows();
}

function rowButton(action, id, label) {
  return '<button type="button" class="link" data-action="'+action+'" data-id="'+esc(id)+'">'+label+'</button>';
}

function renderRows() {
  const cols = Object.keys(cfg[page].cols);
  const rows = displayRows().filter(row => Object.entries(filters).every(([key,value]) => {
    if (key === 'priority' || key === 'date' || (key === 'id' && value === selectedRow)) return row[key] === value;
    return String(row[key] || '').toLowerCase().includes(value.toLowerCase());
  })).sort((a,b) => Number(b.id === selectedRow)-Number(a.id === selectedRow) || b.date.localeCompare(a.date) || b.id.localeCompare(a.id,undefined,{numeric:true}));
  $('count').textContent = '显示 '+rows.length+' / '+db[page].length+' 条';
  $('tbody').innerHTML = rows.map(row => {
    let actions = rowButton('detail',row.id,'详情');
    if (page === 'leads') actions += row.customerId ? rowButton('customer',row.customerId,'客户管理') : rowButton('convert',row.id,'转为客户');
    if (page === 'customers') actions += rowButton('newOrder',row.id,'建订单');
    const cells = cols.map(key => '<td>'+(key === 'priority' ? '<span class="pill p'+esc(row[key])+'">'+esc(row[key])+'</span>' : esc(row[key]))+'</td>').join('');
    return '<tr'+(row.id === selectedRow?' class="highlight"':'')+'>'+cells+'<td>'+actions+'</td></tr>';
  }).join('') || '<tr><td colspan="'+(cols.length+1)+'" class="empty">没有匹配的记录。<button class="link" data-action="reset">清除筛选</button></td></tr>';
}

function toast(msg) {
  $('toast').textContent = msg;
  clearTimeout(timer);
  timer = setTimeout(() => $('toast').textContent = '', 3500);
}

function field(key, label, options) {
  const id = 'input-'+key;
  const attrs = ' id="'+id+'" name="'+key+'" required aria-describedby="err-'+key+'"';
  let control;
  if (options) {
    control = '<select'+attrs+'>'+options.map(o => {
      const [value,text] = Array.isArray(o) ? o : [o,o];
      return '<option value="'+esc(value)+'">'+esc(text)+'</option>';
    }).join('')+'</select>';
  } else {
    control = '<input'+attrs+(key === 'phone' ? ' type="tel" inputmode="numeric" placeholder="请输入 11 位数字"' : ' type="text"')+'>';
  }
  return '<label for="'+id+'"><span>'+label+'</span>'+control+'<span class="field-error" id="err-'+key+'" aria-live="polite"></span></label>';
}

function details(entries) {
  return '<dl class="details">'+entries.map(([k,v]) => '<dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd>').join('')+'</dl>';
}

function openBox(title, body, buttonLabel, handler) {
  submitAction = handler;
  $('dialogtitle').textContent = title;
  $('form').innerHTML = body+'<div class="error" role="alert" id="formerror"></div>'+(handler
    ? '<footer><button class="btn" type="button" id="cancel">取消</button><button type="submit" class="btn primary">'+buttonLabel+'</button></footer>' : '');
  if ($('cancel')) $('cancel').onclick = () => $('dialog').close();
  $('dialog').showModal();
  $('form').querySelector('input,select')?.focus();
}

function fieldError(name, message) {
  const input = $('form').elements.namedItem(name);
  input.setAttribute('aria-invalid','true');
  $('err-'+name).textContent = message;
}

function validate() {
  const values = {};
  for (const el of $('form').querySelectorAll('[name]')) {
    const key = el.name;
    const value = el.value.trim();
    values[key] = value;
    el.removeAttribute('aria-invalid');
    $('err-'+key).textContent = '';
    const label = el.labels[0].firstElementChild.textContent;
    if (!value) fieldError(key, '请填写或选择'+label+'。');
    else if (key === 'phone' && !/^[0-9]{11}$/.test(value)) fieldError(key, '手机号须为 11 位数字，当前输入 '+value.length+' 个字符。');
    else if (value.length > 64) fieldError(key, label+'不能超过 64 个字符。');
  }
  return values;
}

function finish(type, next, id, message, filterId = false) {
  commitDatabase(next);
  $('dialog').close();
  navigate(type, filterId ? {id} : {}, id);
  toast(message + (storageMode === 'local' ? '' : '（仅本次会话）'));
}

function add(type = page, preselected = '') {
  if (type === 'orders') {
    if (!db.customers.length) { toast('请先在客户管理中添加客户，再创建订单。'); return; }
    const options = [['','请选择客户'], ...db.customers.map(c => [c.id,c.id+' · '+c.name])];
    openBox('添加订单', field('customerId','关联客户',options)+field('product','订单商品名'), '保存订单', v => {
      if (!db.customers.some(c => c.id === v.customerId)) { fieldError('customerId','请选择有效的客户。'); return; }
      const row = {id:nextId('orders'),date:today(),customerId:v.customerId,product:v.product};
      finish('orders',{...db,orders:[row,...db.orders]},row.id,'已添加订单 '+row.id);
    });
    $('input-customerId').value = preselected;
    return;
  }
  const lead = type === 'leads';
  openBox(cfg[type].add, field('name', cfg[type].cols.name)+field('phone','手机号')+field('priority','优先级',priority)+
    (lead ? field('channel','渠道来源',channels) : field('owner','跟进人')), '保存'+cfg[type].name, v => {
    if (db[type].some(r=>r.phone === v.phone)) { fieldError('phone','该手机号已存在于'+cfg[type].name+'列表，请查询原记录。'); return; }
    const row = {...v,id:nextId(type),date:today(),...(lead ? {customerId:''} : {})};
    finish(type,{...db,[type]:[row,...db[type]]},row.id,'已添加'+cfg[type].name+' '+row.name);
  });
}

function convert(id) {
  const lead = db.leads.find(r=>r.id === id);
  if (!lead || lead.customerId) return;
  const existing = db.customers.find(c=>c.phone === lead.phone);
  const body = details([['姓名',lead.name],['电话',lead.phone],['优先级',lead.priority]])+
    (existing ? '<p class="note">该手机号已关联客户 '+esc(existing.id)+' · '+esc(existing.name)+'。确认后将使用这条客户记录。</p>' : field('owner','客户跟进人'));
  openBox('线索转为客户',body,'确认转化',v=>{
    const customer = existing || {id:nextId('customers'),date:today(),name:lead.name,phone:lead.phone,priority:lead.priority,owner:v.owner};
    const next = {...db, leads:db.leads.map(r=>r.id === id ? {...r,customerId:customer.id} : r),
      customers:existing ? db.customers : [customer,...db.customers]};
    finish('customers',next,customer.id,'已转为客户 '+customer.name,true);
  });
}

function showDetail(id) {
  const row = displayRows().find(r=>r.id === id);
  if (!row) return;
  const entries = Object.entries(cfg[page].cols).map(([k,label])=>[label,row[k]]);
  if (page === 'leads') entries.push(['关联客户',row.customerId || '尚未转化']);
  if (page === 'customers') entries.push(['关联订单',db.orders.filter(o=>o.customerId === id).map(o=>o.id).join('、') || '暂无订单']);
  openBox(cfg[page].name+'详情',details(entries));
}

$('form').onsubmit = event => {
  event.preventDefault();
  if (!submitAction) return;
  $('formerror').textContent = '';
  const values = validate();
  if (!$('form').querySelector('[aria-invalid=true]')) {
    try { submitAction(values); }
    catch (error) { $('formerror').textContent = error.message; }
  }
  $('form').querySelector('[aria-invalid=true]')?.focus();
};
$('form').oninput = event => {
  const el = event.target;
  if (!el.name) return;
  el.removeAttribute('aria-invalid');
  $('err-'+el.name).textContent = '';
  $('formerror').textContent = '';
};
$('dialog').onclose = () => { submitAction = null; };
$('close').onclick = () => $('dialog').close();
$('add').onclick = () => add();
$('clear').onclick = () => navigate(page);
document.querySelector('nav').onclick = event => {
  const b = event.target.closest('[data-page]');
  if (b) navigate(b.dataset.page);
};
$('stats').onclick = event => {
  const card = event.target.closest('button[data-priority]');
  if (!card) return;
  const value = card.dataset.priority;
  navigate('leads', value ? {priority:value} : {});
  $('stats').querySelector('[aria-pressed=true]').focus({preventScroll:true});
};
$('filters').oninput = event => {
  const key = event.target.dataset.filter;
  if (!key) return;
  if (key === 'id') selectedRow = '';
  const value = event.target.value.trim();
  if (value) filters[key] = value;
  else delete filters[key];
  renderStats();
  renderRows();
};
$('tbody').onclick = event => {
  const b = event.target.closest('[data-action]');
  if (!b) return;
  const id = b.dataset.id;
  switch (b.dataset.action) {
    case 'reset': navigate(page); break;
    case 'detail': showDetail(id); break;
    case 'convert': convert(id); break;
    case 'newOrder': add('orders',id); break;
    case 'customer': navigate('customers',{id},id); break;
  }
};
render();
