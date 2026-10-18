// UniReg v1.0 – mã phía client (phiên bản có cài sẵn lỗi để phục vụ demo kiểm thử)
const $ = (s, el = document) => el.querySelector(s);
const token = () => sessionStorage.getItem('token');

async function api(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() } });
  const data = await res.json();
  if (!res.ok) throw data; // hiển thị nguyên văn thông báo của máy chủ
  return data;
}
function show(el, msg, kind) { el.className = 'alert ' + kind; el.textContent = msg; }

function shell(active) {
  const pages = [['courses.html', 'Đăng ký HP'], ['my.html', 'Học phần của tôi'], ['profile.html', 'Profile']];
  $('#hdr').innerHTML = `<div class="wrap"><a class="brand" href="courses.html"><img src="logo.svg" width="40" height="40">UniReg</a>
  <nav>${pages.map(([h, t]) => `<a href="${h}"${h === active ? ' aria-current="page"' : ''}>${t}</a>`).join('')}
  <a href="#" id="logout">Thoát</a></nav><span class="user">Hi, ${sessionStorage.getItem('name') || ''}</span></div>`;
  $('#logout').onclick = (e) => { e.preventDefault(); sessionStorage.clear(); location.href = 'index.html'; };
}

function initLogin() {
  const f = $('#loginForm'), msg = $('#msg');
  f.onsubmit = async (e) => {
    e.preventDefault();
    try {
      const d = await api('/api/login', { method: 'POST', body: JSON.stringify({ mssv: $('#mssv').value, password: $('#password').value }) });
      sessionStorage.setItem('token', d.token); sessionStorage.setItem('name', d.name);
      location.href = 'courses.html';
    } catch (err) { show(msg, err.message, 'err'); }
  };
}

async function initCourses() {
  shell('courses.html');
  const msg = $('#msg'), tbody = $('#tbl tbody');
  async function load() {
    const list = await api(`/api/courses?q=${encodeURIComponent($('#q').value)}&khoa=${$('#khoa').value}`);
    $('#count').textContent = `${list.length} kết quả`;
    tbody.innerHTML = list.map((c) => `<tr><td>${c.id}</td><td>${c.name}</td><td class="num">${c.credits}</td><td>T${c.day} (${c.period})</td>
      <td class="num">${c.enrolled}/${c.max}</td><td><button class="btn btn-primary" data-id="${c.id}">Submit</button></td></tr>`).join('');
  }
  $('#searchForm').onsubmit = (e) => { e.preventDefault(); load(); };
  tbody.onclick = async (e) => {
    const b = e.target.closest('button[data-id]'); if (!b) return;
    msg.className = 'alert'; msg.textContent = '';
    try { await api('/api/registrations', { method: 'POST', body: JSON.stringify({ courseId: b.dataset.id }) }); await load(); }
    catch (err) { show(msg, err.message, 'err'); }
  };
  await load();
}

async function initMy() {
  shell('my.html');
  const tbody = $('#tbl tbody');
  async function load() {
    const d = await api('/api/registrations');
    $('#total').textContent = d.total; $('#max').textContent = d.max; $('#n').textContent = d.items.length;
    tbody.innerHTML = d.items.map((c) => `<tr><td>${c.id}</td><td>${c.name}</td><td class="num">${c.credits}</td><td>T${c.day} (${c.period})</td>
      <td><div class="del" data-rid="${c.rid}">✖ Xóa</div></td></tr>`).join('');
  }
  tbody.onclick = async (e) => {
    const d = e.target.closest('[data-rid]'); if (!d) return;
    await api('/api/registrations/' + d.dataset.rid, { method: 'DELETE' }); await load();
  };
  await load();
}

async function initProfile() {
  shell('profile.html');
  const msg = $('#msg'), f = $('#pf');
  const p = await api('/api/profile');
  ['name', 'email', 'phone', 'dob'].forEach((k) => (f[k].value = p[k]));
  f.onsubmit = async (e) => {
    e.preventDefault();
    const d = await api('/api/profile', { method: 'PUT', body: JSON.stringify({ name: f.name.value, email: f.email.value, phone: f.phone.value, dob: f.dob.value }) });
    show(msg, d.message, 'ok');
  };
}

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page !== 'login' && !token()) { location.href = 'index.html'; return; }
  ({ login: initLogin, courses: initCourses, my: initMy, profile: initProfile })[page]();
});
