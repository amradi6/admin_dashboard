const SUPABASE_URL = 'https://sfyxjgxpicprvirlmjzj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_UtPxDWegDt6vAr52b8QFsA_DvW_sK1C';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const configs = {
  students: {
    title: 'الطالبات',
    subtitle: 'إدارة بيانات الطالبات المسجلة.',
    table: 'students',
    columns: [
      ['name', 'الاسم', true],
      ['grade', 'الصف', false],
      ['age', 'العمر', false],
      ['phone', 'الهاتف', false],
    ],
  },
  guardians: {
    title: 'أولياء الأمور',
    subtitle: 'إدارة بيانات أولياء الأمور.',
    table: 'guardians',
    columns: [['name', 'الاسم', true], ['phone', 'الهاتف', false]],
  },
  instructors: {
    title: 'المعلمات',
    subtitle: 'إدارة بيانات المعلمات.',
    table: 'instructors',
    columns: [['name', 'الاسم', true], ['phone', 'الهاتف', false]],
  },
};

let section = 'students';
let rows = [];
let editingId = null;

const $ = (id) => document.getElementById(id);
const config = () => configs[section];

function showError(error) {
  const message = error?.message || String(error);
  const target = $('shell').classList.contains('hidden') ? $('login-message') : $('message');
  target.textContent = `تعذر تنفيذ الطلب: ${message}`;
  target.classList.remove('hidden');
}

function setAuthenticated(authenticated) {
  $('login').classList.toggle('hidden', authenticated);
  $('shell').classList.toggle('hidden', !authenticated);
}

function clearError() {
  $('message').classList.add('hidden');
  $('login-message').classList.add('hidden');
}

async function load() {
  clearError();
  $('loading').classList.remove('hidden');
  $('empty').classList.add('hidden');
  $('table-wrap').classList.add('hidden');
  const { data, error } = await db.from(config().table).select('*').order('name');
  $('loading').classList.add('hidden');
  if (error) {
    showError(error);
    return;
  }
  rows = data || [];
  render();
}

function render() {
  const c = config();
  $('section-title').textContent = c.title;
  $('section-subtitle').textContent = c.subtitle;
  if (!rows.length) {
    $('empty').classList.remove('hidden');
    return;
  }
  const head = c.columns.map(([, label]) => `<th>${label}</th>`).join('');
  const body = rows.map((row) => {
    const cells = c.columns.map(([key]) => `<td>${escapeHtml(row[key] ?? '')}</td>`).join('');
    return `<tr>${cells}<td class="actions">
      <button class="button secondary small" data-edit="${row.id}">تعديل</button>
      <button class="button small danger" data-delete="${row.id}">حذف</button>
    </td></tr>`;
  }).join('');
  $('table-wrap').innerHTML = `<table><thead><tr>${head}<th>إجراءات</th></tr></thead><tbody>${body}</tbody></table>`;
  $('table-wrap').classList.remove('hidden');
  $('table-wrap').querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openEditor(b.dataset.edit)));
  $('table-wrap').querySelectorAll('[data-delete]').forEach((b) => b.addEventListener('click', () => remove(b.dataset.delete)));
}

function openEditor(id = null) {
  editingId = id;
  const row = rows.find((item) => item.id === id) || {};
  $('editor-title').textContent = id ? 'تعديل سجل' : 'إضافة سجل';
  $('fields').innerHTML = config().columns.map(([key, label, required]) =>
    `<label for="field-${key}">${label}</label><input id="field-${key}" name="${key}" value="${escapeAttr(row[key] ?? '')}" ${required ? 'required' : ''}>`
  ).join('');
  $('editor').showModal();
}

async function save(event) {
  event.preventDefault();
  const payload = {};
  config().columns.forEach(([key]) => {
    const value = new FormData($('editor-form')).get(key)?.toString().trim() || null;
    payload[key] = value;
  });
  const request = editingId
    ? db.from(config().table).update(payload).eq('id', editingId)
    : db.from(config().table).insert(payload);
  const { error } = await request;
  if (error) {
    showError(error);
    return;
  }
  $('editor').close();
  await load();
}

async function remove(id) {
  if (!confirm('هل تريد حذف هذا السجل؟')) return;
  const { error } = await db.from(config().table).delete().eq('id', id);
  if (error) {
    showError(error);
    return;
  }
  await load();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
}
function escapeAttr(value) { return escapeHtml(value); }

document.querySelectorAll('.tab').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
  section = button.dataset.section;
  load();
}));
$('refresh').addEventListener('click', load);
$('add').addEventListener('click', () => openEditor());
$('editor-form').addEventListener('submit', save);
$('logout').addEventListener('click', async () => {
  await db.auth.signOut();
  setAuthenticated(false);
});
$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();
  const { error } = await db.auth.signInWithPassword({
    email: $('email').value.trim(),
    password: $('password').value,
  });
  if (error) {
    showError(error);
    return;
  }
  setAuthenticated(true);
  await load();
});

async function start() {
  const { data } = await db.auth.getSession();
  const authenticated = Boolean(data.session);
  setAuthenticated(authenticated);
  if (authenticated) await load();
}

start();
