'use strict';
const cfg={
 leads:{name:'线索',sub:'识别优先跟进的线索，将成熟线索转为客户。',add:'添加新线索',cols:{date:'创建时间',name:'线索姓名',phone:'电话',priority:'线索优先级',channel:'渠道来源'},filters:['date','name','phone','priority']},
 customers:{name:'客户',sub:'查看客户资料、跟进负责人及关联订单。',add:'添加客户',cols:{date:'创建时间',id:'客户编号',name:'客户姓名',phone:'电话',priority:'优先级',owner:'跟进人'},filters:['date','id','name','phone','priority']},
 orders:{name:'订单',sub:'按订单或客户查询销售记录，核对商品与联系人。',add:'添加订单',cols:{date:'创建时间',id:'订单编号',customerId:'客户编号',product:'订单商品名',name:'客户名称',phone:'客户手机号'},filters:['date','id','customerId','phone']}
};
const priority=['高','中','低'],channels=['官网咨询','行业展会','合作伙伴','客户推荐'];
function seed(){
 const names=['林澄','周棠','许知远','梁羽','孙禾','陈溪','何宁','江野'];
 const leads=names.map((name,i)=>({id:'L-'+(1001+i),date:'2026-11-'+(20-i),name,phone:'1000000'+String(i+1).padStart(4,'0'),priority:priority[i%3],channel:channels[i%4],customerId:''}));
 const customers=[['苏青','赵敏'],['唐禾','宋洋'],['顾晴','赵敏']].map(([name,owner],i)=>({id:'C-'+(1001+i),date:'2026-11-'+(12+i),name,owner,phone:'1000001'+String(i+1).padStart(4,'0'),priority:priority[i]}));
 return {leads,customers,orders:[{id:'O-1001',date:'2026-11-17',customerId:'C-1001',product:'团队协作年包'},{id:'O-1002',date:'2026-11-19',customerId:'C-1002',product:'客户数据迁移服务'}]};
}

const storageKey = 'crm-project-sales-v2';
const legacyKey = 'qingxu-sales-demo-v1';
let storageMode = 'local';

function loadDatabase() {
  let stored;
  try {
    stored = localStorage.getItem(storageKey) ?? localStorage.getItem(legacyKey);
  } catch {
    storageMode = 'session';
    return seed();
  }
  if (!stored) return seed();
  try {
    const database = JSON.parse(stored);
    if (!Object.keys(cfg).every(key => Array.isArray(database[key]))) throw new Error();
    return database;
  } catch {
    storageMode = 'recovery';
    return seed();
  }
}

function commitDatabase(next) {
  if (storageMode === 'local') {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      throw new Error('浏览器未能写入本地存储。请检查存储空间或权限，再点保存。');
    }
  }
  db = next;
}

function today() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
}

function nextId(type) {
  const prefix = {leads:'L', customers:'C', orders:'O'}[type];
  const max = db[type].reduce((highest, row) => Math.max(highest, Number(row.id.split('-')[1]) || 0), 1000);
  return prefix + '-' + (max + 1);
}

function leadPriority(lead) {
  return lead.customerId ? '已转化' : lead.priority;
}
