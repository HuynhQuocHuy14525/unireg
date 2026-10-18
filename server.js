// UniReg – ứng dụng web mẫu "Đăng ký học phần" dùng cho demo kiểm thử giao diện & chức năng.
// Chạy:  node server.js 1   (bản 1.0 – có cài sẵn lỗi, cổng 3001)
//        node server.js 2   (bản 1.1 – đã sửa lỗi,   cổng 3002)
const express = require('express');
const path = require('path');

const VERSION = (process.argv[2] || process.env.VERSION) === '1' ? 1 : 2;
const PORT = Number(process.env.PORT || (VERSION === 1 ? 3001 : 3002));
const MAX_CREDITS = 25;
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, VERSION === 1 ? 'public-v1' : 'public-v2')));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------- Dữ liệu mẫu (in-memory) ----------------
const COURSES = [
  { id: 'IT001', name: 'Nhập môn lập trình', khoa: 'CNTT', credits: 3, day: 2, period: '1-3', max: 60 },
  { id: 'IT005', name: 'Cấu trúc dữ liệu và giải thuật', khoa: 'CNTT', credits: 4, day: 3, period: '1-4', max: 60 },
  { id: 'IT010', name: 'Cơ sở dữ liệu', khoa: 'CNTT', credits: 3, day: 4, period: '7-9', max: 50 },
  { id: 'SE301', name: 'Đảm bảo chất lượng và kiểm thử phần mềm', khoa: 'KTPM', credits: 3, day: 5, period: '1-3', max: 45 },
  { id: 'SE302', name: 'Phân tích thiết kế hướng đối tượng', khoa: 'KTPM', credits: 3, day: 5, period: '2-4', max: 45 },
  { id: 'SE310', name: 'Phát triển ứng dụng web', khoa: 'KTPM', credits: 3, day: 6, period: '7-9', max: 40 },
  { id: 'EN101', name: 'Tiếng Anh chuyên ngành', khoa: 'NN', credits: 2, day: 7, period: '1-2', max: 40 },
  { id: 'MA201', name: 'Xác suất thống kê', khoa: 'KHCB', credits: 3, day: 2, period: '7-9', max: 80 },
  { id: 'PE001', name: 'Giáo dục thể chất 1', khoa: 'KHCB', credits: 2, day: 7, period: '7-8', max: 30 },
  { id: 'IT020', name: 'Mạng máy tính', khoa: 'CNTT', credits: 3, day: 4, period: '1-3', max: 60 },
  { id: 'IT030', name: 'Hệ điều hành', khoa: 'CNTT', credits: 3, day: 6, period: '1-3', max: 60 },
  { id: 'SE320', name: 'Kiểm thử tự động', khoa: 'KTPM', credits: 3, day: 3, period: '7-9', max: 40 },
  { id: 'SE330', name: 'Quản lý dự án phần mềm', khoa: 'KTPM', credits: 2, day: 5, period: '7-8', max: 40 },
];
// Tài khoản đăng nhập: MSSV của 2 thành viên nhóm 4, mật khẩu = MSSV
const ACCOUNTS = {
  '23658461': { password: '23658461', name: 'Đào Tiến Dũng', email: 'dung.dt@example.com', phone: '0901234567', dob: '2005-03-15' },
  '23654001': { password: '23654001', name: 'Huỳnh Quốc Huy', email: 'huy.hq@example.com', phone: '0912345678', dob: '2005-08-20' },
};
const DEFAULT_REGS = ['IT001', 'IT005', 'IT010', 'MA201', 'PE001']; // 3+4+3+3+2 = 15 tín chỉ

let state;
function reset(regs) {
  state = {
    enrolled: { IT001: 52, IT005: 41, IT010: 50, SE301: 30, SE302: 12, SE310: 39, EN101: 40, MA201: 66, PE001: 18, IT020: 35, IT030: 44, SE320: 21, SE330: 25 },
    students: {},
    tokens: new Map(), // token -> mssv
    seq: 1,
  };
  for (const [mssv, a] of Object.entries(ACCOUNTS)) {
    state.students[mssv] = {
      profile: { name: a.name, email: a.email, phone: a.phone, dob: a.dob },
      regs: (regs || DEFAULT_REGS).map((c) => ({ rid: state.seq++, courseId: c })),
    };
  }
}
reset();

const total = (me) => me.regs.reduce((s, r) => s + COURSES.find((c) => c.id === r.courseId).credits, 0);
const slotsOf = (c) => ({ ...c, enrolled: state.enrolled[c.id] });

function auth(req, res, next) {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  if (!state.tokens.has(t)) return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' });
  req.me = state.students[state.tokens.get(t)];
  next();
}

// Hook dành cho bộ kiểm thử: đưa dữ liệu về trạng thái ban đầu (test fixture)
app.post('/api/_reset', (req, res) => {
  reset(req.body && Array.isArray(req.body.regs) ? req.body.regs : null);
  res.json({ ok: true, version: VERSION });
});

app.post('/api/login', (req, res) => {
  const { mssv, password } = req.body || {};
  if (VERSION === 1) {
    // LỖI CÀI SẴN: không kiểm tra dữ liệu rỗng -> lộ thông báo lỗi kỹ thuật
    if (!mssv) return res.status(500).json({ message: "TypeError: Cannot read properties of undefined (reading 'trim')" });
  } else {
    if (!mssv || !password) return res.status(400).json({ message: 'Vui lòng nhập đầy đủ MSSV và mật khẩu.' });
    if (!/^\d{8}$/.test(mssv)) return res.status(400).json({ message: 'MSSV phải gồm đúng 8 chữ số.' });
  }
  if (!ACCOUNTS[mssv] || ACCOUNTS[mssv].password !== password)
    return res.status(401).json({ message: VERSION === 1 ? 'Login failed (code 0x80004005)' : 'MSSV hoặc mật khẩu không đúng. Vui lòng kiểm tra lại.' });
  const token = Math.random().toString(36).slice(2);
  state.tokens.set(token, mssv);
  res.json({ token, name: state.students[mssv].profile.name });
});

app.get('/api/courses', auth, (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const khoa = String(req.query.khoa || '');
  let list = COURSES.filter((c) => (!khoa || c.khoa === khoa) && (!q || c.id.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)));
  res.json(list.map(slotsOf));
});

app.get('/api/registrations', auth, (req, res) => {
  res.json({ total: total(req.me), max: MAX_CREDITS, items: req.me.regs.map((r) => ({ rid: r.rid, ...slotsOf(COURSES.find((c) => c.id === r.courseId)) })) });
});

app.post('/api/registrations', auth, async (req, res) => {
  await sleep(700); // mô phỏng độ trễ máy chủ
  const c = COURSES.find((x) => x.id === (req.body || {}).courseId);
  if (!c) return res.status(404).json({ message: 'Không tìm thấy học phần.' });
  if (VERSION === 2 && req.me.regs.some((r) => r.courseId === c.id))
    return res.status(409).json({ message: `Bạn đã đăng ký học phần ${c.id} rồi.` });
  if (state.enrolled[c.id] >= c.max)
    return res.status(409).json({ message: VERSION === 1 ? `SQLSTATE[45000]: slot_exceeded (course_id=${c.id})` : `Lớp ${c.id} đã đủ sĩ số (${c.max}/${c.max}). Vui lòng chọn lớp khác.` });
  // LỖI CÀI SẴN (v1): kiểm tra giới hạn trên tổng HIỆN TẠI, quên cộng tín chỉ học phần mới
  const over = VERSION === 1 ? total(req.me) > MAX_CREDITS : total(req.me) + c.credits > MAX_CREDITS;
  if (over) return res.status(409).json({ message: `Vượt quá số tín chỉ tối đa (${MAX_CREDITS} TC). Hiện có ${total(req.me)} TC, học phần ${c.id} có ${c.credits} TC.` });
  const clash = req.me.regs.map((r) => COURSES.find((x) => x.id === r.courseId)).find((x) => {
    if (x.id === c.id || x.day !== c.day) return false;
    const [a1, a2] = x.period.split('-').map(Number); const [b1, b2] = c.period.split('-').map(Number);
    return a1 <= b2 && b1 <= a2;
  });
  if (clash) return res.status(409).json({ message: `Trùng lịch với ${clash.id} (Thứ ${clash.day}, tiết ${clash.period}).` });
  req.me.regs.push({ rid: state.seq++, courseId: c.id });
  state.enrolled[c.id]++;
  res.status(201).json({ message: `Đăng ký thành công ${c.id} – ${c.name}.`, total: total(req.me) });
});

app.delete('/api/registrations/:rid', auth, (req, res) => {
  const i = req.me.regs.findIndex((r) => r.rid === Number(req.params.rid));
  if (i < 0) return res.status(404).json({ message: 'Không tìm thấy đăng ký.' });
  const [r] = req.me.regs.splice(i, 1);
  state.enrolled[r.courseId]--;
  res.json({ message: `Đã hủy đăng ký ${r.courseId}.`, total: total(req.me) });
});

app.get('/api/profile', auth, (req, res) => res.json(req.me.profile));
app.put('/api/profile', auth, (req, res) => {
  const p = req.body || {};
  if (VERSION === 2) {
    const errs = {};
    if (!/^[A-Za-zÀ-ỹ\s]{2,50}$/.test(p.name || '')) errs.name = 'Họ tên chỉ gồm chữ cái và khoảng trắng (2–50 ký tự).';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email || '')) errs.email = 'Email không đúng định dạng (ví dụ: ten@domain.com).';
    if (!/^0\d{9}$/.test(p.phone || '')) errs.phone = 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.';
    if (Object.keys(errs).length) return res.status(400).json({ message: 'Dữ liệu chưa hợp lệ.', errors: errs });
  }
  req.me.profile = { ...req.me.profile, ...p };
  res.json({ message: 'Đã lưu thông tin cá nhân.', profile: req.me.profile });
});

app.listen(PORT, () => console.log(`UniReg v${VERSION === 1 ? '1.0' : '1.1'} chạy tại http://localhost:${PORT}`));
