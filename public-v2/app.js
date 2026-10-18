// UniReg v1.1 – mã phía client
const $ = (s, el = document) => el.querySelector(s);
const token = () => sessionStorage.getItem('token');

async function api(url, opts = {}) {
  let res;
  try {
    res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token(), ...(opts.headers || {}) } });
  } catch (e) {
    throw { message: 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.' };
  }
  let data = {};
  try { data = await res.json(); } catch (e) { /* phản hồi không phải JSON */ }
  if (res.status === 401 && !url.includes('/login')) { sessionStorage.clear(); location.href = 'index.html?expired=1'; }
  if (!res.ok) {
    if (res.status >= 500) throw { message: 'Hệ thống đang gặp sự cố, vui lòng thử lại sau ít phút.' };
    throw data;
  }
  return data;
}

function show(el, msg, kind) { el.className = 'alert ' + kind; el.textContent = msg; }

function shell(active) {
  const pages = [['courses.html', 'Đăng ký học phần'], ['my.html', 'Kết quả đăng ký'], ['profile.html', 'Thông tin cá nhân']];
  $('#hdr').innerHTML = `<a class="skip" href="#main">Bỏ qua đến nội dung chính</a>
  <div class="wrap"><a class="brand" href="courses.html"><img src="logo.svg" alt="" width="40" height="40">UniReg</a>
  <nav aria-label="Điều hướng chính">${pages.map(([h, t]) => `<a href="${h}"${h === active ? ' aria-current="page"' : ''}>${t}</a>`).join('')}
  <a href="#" id="logout">Đăng xuất</a></nav>
  <span class="user">Xin chào, ${sessionStorage.getItem('name') || ''}</span></div>`;
  $('#logout').onclick = (e) => { e.preventDefault(); sessionStorage.clear(); location.href = 'index.html'; };
}

// ---------- Trang đăng nhập ----------
function initLogin() {
  const f = $('#loginForm'), msg = $('#msg');
  if (new URLSearchParams(location.search).get('expired')) show(msg, 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'err');
  f.onsubmit = async (e) => {
    e.preventDefault();
    const mssv = $('#mssv').value.trim(), password = $('#password').value;
    if (!mssv || !password) return show(msg, 'Vui lòng nhập đầy đủ MSSV và mật khẩu.', 'err');
    if (!/^\d{8}$/.test(mssv)) { $('#mssv').setAttribute('aria-invalid', 'true'); $('#mssv').focus(); return show(msg, 'MSSV phải gồm đúng 8 chữ số.', 'err'); }
    const b = $('#btnLogin'); b.disabled = true; b.textContent = 'Đang đăng nhập…';
    try {
      const d = await api('/api/login', { method: 'POST', body: JSON.stringify({ mssv, password }) });
      sessionStorage.setItem('token', d.token); sessionStorage.setItem('name', d.name);
      location.href = 'courses.html';
    } catch (err) { show(msg, err.message, 'err'); $('#password').value = ''; $('#password').focus(); }
    finally { b.disabled = false; b.textContent = 'Đăng nhập'; }
  };
}

// ---------- Trang danh sách & đăng ký học phần ----------
async function initCourses() {
  shell('courses.html');
  const msg = $('#msg'), tbody = $('#tbl tbody');
  async function load() {
    const q = $('#q').value, khoa = $('#khoa').value;
    const list = await api(`/api/courses?q=${encodeURIComponent(q)}&khoa=${khoa}`);
    $('#count').textContent = `Tìm thấy ${list.length} học phần`;
    tbody.innerHTML = list.length ? list.map((c) => {
      const full = c.enrolled >= c.max;
      return `<tr><td data-label="Mã HP">${c.id}</td><td data-label="Tên học phần">${c.name}</td><td data-label="Số TC" class="num">${c.credits}</td>
      <td data-label="Lịch học">Thứ ${c.day}, tiết ${c.period}</td><td data-label="Sĩ số" class="num">${c.enrolled}/${c.max} <span class="tag ${full ? 'full' : 'open'}">${full ? 'Đã đầy' : 'Còn chỗ'}</span></td>
      <td data-label="Thao tác"><button class="btn btn-primary" data-id="${c.id}" aria-label="Đăng ký ${c.id} ${c.name}">Đăng ký</button></td></tr>`;
    }).join('') : '<tr><td colspan="6">Không có học phần phù hợp với điều kiện tìm kiếm.</td></tr>';
  }
  $('#searchForm').onsubmit = (e) => { e.preventDefault(); load(); };
  tbody.onclick = async (e) => {
    const b = e.target.closest('button[data-id]'); if (!b) return;
    b.disabled = true; const old = b.textContent; b.textContent = 'Đang xử lý…';
    try { const d = await api('/api/registrations', { method: 'POST', body: JSON.stringify({ courseId: b.dataset.id }) }); show(msg, `${d.message} Tổng số tín chỉ hiện tại: ${d.total}.`, 'ok'); await load(); }
    catch (err) { show(msg, err.message, 'err'); b.disabled = false; b.textContent = old; }
  };
  await load();
}

// ---------- Trang kết quả đăng ký ----------
async function initMy() {
  shell('my.html');
  const msg = $('#msg'), tbody = $('#tbl tbody'), dlg = $('#confirm');
  let pending = null;
  async function load() {
    const d = await api('/api/registrations');
    $('#total').textContent = d.total; $('#max').textContent = d.max; $('#n').textContent = d.items.length;
    tbody.innerHTML = d.items.map((c) => `<tr><td data-label="Mã HP">${c.id}</td><td data-label="Tên học phần">${c.name}</td><td data-label="Số TC" class="num">${c.credits}</td>
      <td data-label="Lịch học">Thứ ${c.day}, tiết ${c.period}</td><td data-label="Thao tác"><button class="btn btn-danger" data-rid="${c.rid}" data-name="${c.id} – ${c.name}">Hủy đăng ký</button></td></tr>`).join('');
  }
  tbody.onclick = (e) => {
    const b = e.target.closest('button[data-rid]'); if (!b) return;
    pending = b.dataset.rid; $('#cname').textContent = b.dataset.name; dlg.showModal();
  };
  $('#no').onclick = () => dlg.close();
  $('#yes').onclick = async () => {
    dlg.close();
    try { const d = await api('/api/registrations/' + pending, { method: 'DELETE' }); show(msg, d.message, 'ok'); await load(); $('h1').focus(); }
    catch (err) { show(msg, err.message, 'err'); }
  };
  await load();
}

// ---------- Trang thông tin cá nhân ----------
async function initProfile() {
  shell('profile.html');
  const msg = $('#msg'), f = $('#pf');
  const p = await api('/api/profile');
  ['name', 'email', 'phone', 'dob'].forEach((k) => (f[k].value = p[k]));
  const rules = {
    name: [/^[A-Za-zÀ-ỹ\s]{2,50}$/, 'Họ tên chỉ gồm chữ cái và khoảng trắng (2–50 ký tự).'],
    email: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email không đúng định dạng (ví dụ: ten@domain.com).'],
    phone: [/^0\d{9}$/, 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.'],
  };
  f.onsubmit = async (e) => {
    e.preventDefault();
    let first = null;
    for (const [k, [re, text]] of Object.entries(rules)) {
      const ok = re.test(f[k].value.trim()); const er = $('#' + k + '-err');
      f[k].setAttribute('aria-invalid', String(!ok)); er.textContent = ok ? '' : text;
      if (!ok && !first) first = f[k];
    }
    if (first) { show(msg, 'Vui lòng sửa các trường được đánh dấu bên dưới.', 'err'); first.focus(); return; }
    try { const d = await api('/api/profile', { method: 'PUT', body: JSON.stringify({ name: f.name.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim(), dob: f.dob.value }) }); show(msg, d.message, 'ok'); }
    catch (err) { show(msg, err.message, 'err'); }
  };
}

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page !== 'login' && !token()) { location.href = 'index.html'; return; }
  ({ login: initLogin, courses: initCourses, my: initMy, profile: initProfile })[page]();
});
