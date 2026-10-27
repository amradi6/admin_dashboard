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
const cache = new Map();
let loadSequence = 0;
let dataLoading = false;
let saving = false;

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
  const cachedRows = cache.get(section);
  if (cachedRows) {
    rows = cachedRows;
    render();
  } else {
    $('loading').classList.remove('hidden');
    $('empty').classList.add('hidden');
    $('table-wrap').classList.add('hidden');
  }
  dataLoading = true;
  $('refresh').disabled = true;
  const requestSequence = ++loadSequence;
  const fields = ['id', ...config().columns.map(([key]) => key)].join(',');
  const { data, error } = await db.from(config().table).select(fields).order('name');
  if (requestSequence !== loadSequence) return;
  dataLoading = false;
  $('refresh').disabled = false;
  $('loading').classList.add('hidden');
  if (error) {
    showError(error);
    return;
  }
  rows = data || [];
  cache.set(section, rows);
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
  if (event.submitter?.value !== 'save' || saving) return;
  saving = true;
  $('save-editor').disabled = true;
  $('cancel-editor').disabled = true;
  $('save-editor').textContent = 'جارٍ الحفظ…';
  const payload = {};
  config().columns.forEach(([key]) => {
    const value = new FormData($('editor-form')).get(key)?.toString().trim() || null;
    payload[key] = value;
  });
  const request = editingId
    ? db.from(config().table).update(payload).eq('id', editingId).select().single()
    : db.from(config().table).insert(payload).select().single();
  const { data, error } = await request;
  saving = false;
  $('save-editor').disabled = false;
  $('cancel-editor').disabled = false;
  $('save-editor').textContent = 'حفظ';
  if (error) {
    showError(error);
    return;
  }
  $('editor').close();
  rows = editingId
    ? rows.map((row) => row.id === editingId ? data : row)
    : [...rows, data];
  rows.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ar'));
  cache.set(section, rows);
  render();
}

async function remove(id) {
  if (!confirm('هل تريد حذف هذا السجل؟')) return;
  const { error } = await db.from(config().table).delete().eq('id', id);
  if (error) {
    showError(error);
    return;
  }
  rows = rows.filter((row) => row.id !== id);
  cache.set(section, rows);
  render();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
}
function escapeAttr(value) { return escapeHtml(value); }

function closeEditor() {
  if (!saving) $('editor').close();
}

function handleTableAction(event) {
  const editButton = event.target.closest('[data-edit]');
  const deleteButton = event.target.closest('[data-delete]');
  if (editButton) openEditor(editButton.dataset.edit);
  if (deleteButton) remove(deleteButton.dataset.delete);
}

document.querySelectorAll('.tab').forEach((button) => button.addEventListener('click', () => {
  if (button.dataset.section === section || dataLoading || saving) return;
  document.querySelectorAll('.tab').forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
  section = button.dataset.section;
  load();
}));
$('table-wrap').addEventListener('click', handleTableAction);
$('refresh').addEventListener('click', () => load());
$('add').addEventListener('click', () => openEditor());
$('editor-form').addEventListener('submit', save);
$('cancel-editor').addEventListener('click', closeEditor);
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
