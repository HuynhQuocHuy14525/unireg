// Bộ kiểm thử tự động UniReg – FAST, TOFT, FET, BVA, A11Y
// Chạy: npx playwright test   (chạy trên cả 2 phiên bản v1.0 và v1.1)
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

const TECH = /TypeError|SQLSTATE|0x[0-9a-f]+|undefined|Exception/i; // dấu hiệu thông báo lỗi kỹ thuật

async function reset(page, regs) {
  await page.request.post('/api/_reset', { data: regs ? { regs } : {} });
}
async function login(page) {
  await page.goto('/index.html');
  await page.fill('#mssv', '23658461');
  await page.fill('#password', '23658461');
  await page.click('#loginForm button[type=submit]');
  await page.waitForURL('**/courses.html');
  await page.waitForSelector('#tbl tbody tr');
}
async function registrations(page) {
  const t = await page.evaluate(() => sessionStorage.getItem('token'));
  const r = await page.request.get('/api/registrations', { headers: { Authorization: 'Bearer ' + t } });
  return r.json();
}
async function register(page, id) {
  await page.click(`button[data-id="${id}"]`);
  await page.waitForResponse((r) => r.url().endsWith('/api/registrations') && r.request().method() === 'POST');
  await page.waitForTimeout(300);
}

test.beforeEach(async ({ page }) => { await reset(page); });

// ======================= FAST – Functional Acceptance Simple Tests =======================
test.describe('FAST', () => {
  test('FAST-01 Trang đăng nhập có đủ control, mật khẩu được che', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('#mssv')).toBeVisible();
    await expect(page.locator('#password')).toHaveAttribute('type', 'password');
    await expect(page.locator('#loginForm button[type=submit]')).toBeEnabled();
  });
  test('FAST-02 Focus ban đầu đặt tại ô MSSV', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('#mssv')).toBeFocused();
  });
  test('FAST-03 Menu điều hướng đánh dấu trang hiện tại', async ({ page }) => {
    await login(page);
    await expect(page.locator('nav a')).toHaveCount(4);
    await expect(page.locator('nav a[aria-current=page]')).toHaveAttribute('href', 'courses.html');
  });
  test('FAST-04 Không có liên kết hỏng (broken link)', async ({ page }) => {
    await login(page);
    const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')).filter((h) => h.endsWith('.html')));
    const broken = [];
    for (const h of [...new Set(hrefs)]) { const r = await page.request.get('/' + h); if (r.status() !== 200) broken.push(`${h} (${r.status()})`); }
    expect(broken, 'Liên kết hỏng: ' + broken.join(', ')).toEqual([]);
  });
  test('FAST-05 Tìm kiếm theo từ khóa "kiểm thử"', async ({ page }) => {
    await login(page);
    await page.fill('#q', 'kiểm thử');
    await page.click('#searchForm button[type=submit]');
    await page.waitForTimeout(400);
    const ids = await page.$$eval('#tbl tbody tr td:first-child', (t) => t.map((x) => x.textContent.trim()));
    expect(ids).toEqual(['SE301', 'SE320']);
  });
  test('FAST-06 Lọc theo khoa Kỹ thuật phần mềm', async ({ page }) => {
    await login(page);
    await page.selectOption('#khoa', 'KTPM');
    await page.click('#searchForm button[type=submit]');
    await page.waitForTimeout(400);
    await expect(page.locator('#tbl tbody tr')).toHaveCount(5);
  });
  test('FAST-07 Mọi hình ảnh đều có thuộc tính alt', async ({ page }) => {
    await login(page);
    const missing = await page.$$eval('img', (imgs) => imgs.filter((i) => !i.hasAttribute('alt')).map((i) => i.getAttribute('src')));
    expect(missing, 'Ảnh thiếu alt: ' + missing.join(', ')).toEqual([]);
  });
  test('FAST-08 Tên nút lệnh nhất quán, cùng ngôn ngữ (tiếng Việt)', async ({ page }) => {
    const ENGLISH = /^(Submit|Save|Search|Login|Profile|Hi)\b/;
    const labels = async () => page.$$eval('button, nav a', (els) => els.map((e) => e.textContent.trim()));
    await page.goto('/index.html');
    const found = (await labels()).filter((t) => ENGLISH.test(t));
    await login(page);
    for (const p of ['courses.html', 'profile.html']) {
      await page.goto('/' + p); await page.waitForTimeout(300);
      found.push(...(await labels()).filter((t) => ENGLISH.test(t)));
    }
    expect([...new Set(found)], 'Nhãn tiếng Anh lẫn trong giao diện').toEqual([]);
  });
});

// ======================= TOFT – Task-Oriented Functional Tests =======================
test.describe('TOFT', () => {
  test('TOFT-01 Đăng nhập hợp lệ và hiển thị tên sinh viên', async ({ page }) => {
    await login(page);
    await expect(page.locator('.user')).toContainText('Đào Tiến Dũng');
  });
  test('TOFT-02 Đăng ký SE301: dữ liệu và tổng tín chỉ cập nhật đúng (15 → 18)', async ({ page }) => {
    await login(page);
    await register(page, 'SE301');
    const d = await registrations(page);
    expect(d.items.map((x) => x.id)).toContain('SE301');
    expect(d.total).toBe(18);
  });
  test('TOFT-03 Có thông báo phản hồi sau khi đăng ký thành công', async ({ page }) => {
    await login(page);
    await register(page, 'SE301');
    await expect(page.locator('#msg')).toContainText('thành công');
  });
  test('TOFT-04 Hủy đăng ký có hộp thoại xác nhận; chọn "Không" thì giữ nguyên', async ({ page }) => {
    await login(page);
    await page.goto('/my.html');
    await page.waitForSelector('#tbl tbody tr');
    await page.locator('#tbl tbody tr', { hasText: 'PE001' }).locator('[data-rid]').click();
    await page.waitForTimeout(400);
    const dlg = page.locator('dialog[open]');
    const hasDialog = (await dlg.count()) > 0;
    if (hasDialog) await page.click('#no');
    const d = await registrations(page);
    expect(hasDialog, 'Không có bước xác nhận trước thao tác hủy').toBe(true);
    expect(d.items.map((x) => x.id)).toContain('PE001');
  });
  test('TOFT-05 Hủy đăng ký PE001: tổng tín chỉ giảm đúng (15 → 13)', async ({ page }) => {
    await login(page);
    await page.goto('/my.html');
    await page.waitForSelector('#tbl tbody tr');
    await page.locator('#tbl tbody tr', { hasText: 'PE001' }).locator('[data-rid]').click();
    if (await page.locator('dialog[open]').count()) await page.click('#yes');
    await page.waitForTimeout(500);
    await expect(page.locator('#total')).toHaveText('13');
  });
  test('TOFT-06 Cập nhật thông tin cá nhân hợp lệ', async ({ page }) => {
    await login(page);
    await page.goto('/profile.html');
    await page.waitForTimeout(400);
    await page.fill('#phone', '0987654321');
    await page.click('#pf button[type=submit]');
    await expect(page.locator('#msg')).toContainText('Đã lưu');
  });
});

// ======================= FET – Forced-Error Tests =======================
test.describe('FET', () => {
  test('FET-01 Đăng nhập để trống: thông báo dễ hiểu', async ({ page }) => {
    await page.goto('/index.html');
    await page.click('#loginForm button[type=submit]');
    await expect(page.locator('#msg')).not.toBeEmpty();
    await expect(page.locator('#msg')).not.toHaveText(TECH);
    await expect(page.locator('#msg')).toContainText('Vui lòng nhập');
  });
  test('FET-02 Sai mật khẩu: không lộ mã lỗi kỹ thuật', async ({ page }) => {
    await page.goto('/index.html');
    await page.fill('#mssv', '23658461'); await page.fill('#password', 'sai-mat-khau');
    await page.click('#loginForm button[type=submit]');
    await expect(page.locator('#msg')).not.toBeEmpty();
    await expect(page.locator('#msg')).not.toHaveText(TECH);
  });
  test('FET-03 MSSV 7 chữ số (biên dưới - 1): báo lỗi định dạng', async ({ page }) => {
    await page.goto('/index.html');
    await page.fill('#mssv', '2365846'); await page.fill('#password', '23658461');
    await page.click('#loginForm button[type=submit]');
    await expect(page.locator('#msg')).toContainText('8 chữ số');
  });
  test('FET-04 Đăng ký lớp đã đầy (EN101): thông báo dễ hiểu', async ({ page }) => {
    await login(page);
    await register(page, 'EN101');
    await expect(page.locator('#msg')).toContainText('đủ sĩ số');
    await expect(page.locator('#msg')).not.toHaveText(TECH);
  });
  test('FET-05 Đăng ký học phần trùng lịch (SE302 sau SE301)', async ({ page }) => {
    await login(page);
    await register(page, 'SE301');
    await register(page, 'SE302');
    await expect(page.locator('#msg')).toContainText('Trùng lịch');
  });
  test('FET-06 Đăng ký lại học phần đã có (IT001) bị từ chối', async ({ page }) => {
    await login(page);
    await register(page, 'IT001');
    const d = await registrations(page);
    expect(d.items.filter((x) => x.id === 'IT001').length).toBe(1);
  });
  test('FET-07 Nhấn đúp nút Đăng ký không tạo bản ghi trùng', async ({ page }) => {
    await login(page);
    await page.dblclick('button[data-id="SE320"]');
    await page.waitForTimeout(2000);
    const d = await registrations(page);
    expect(d.items.filter((x) => x.id === "SE320").length).toBe(1);
  });
  test('FET-08 Họ tên "123456" bị từ chối tại trường nhập', async ({ page }) => {
    await login(page);
    await page.goto('/profile.html'); await page.waitForTimeout(400);
    await page.fill('#name', '123456');
    await page.click('#pf button[type=submit]');
    await page.waitForTimeout(400);
    await expect(page.locator('#name')).toHaveAttribute('aria-invalid', 'true');
  });
  test('FET-09 Số điện thoại 9 chữ số bị từ chối', async ({ page }) => {
    await login(page);
    await page.goto('/profile.html'); await page.waitForTimeout(400);
    await page.fill('#phone', '090123456');
    await page.click('#pf button[type=submit]');
    await page.waitForTimeout(400);
    await expect(page.locator('#phone')).toHaveAttribute('aria-invalid', 'true');
  });
  test('FET-10 Mất kết nối máy chủ khi đăng ký: có thông báo cho người dùng', async ({ page }) => {
    await login(page);
    await page.route('**/api/registrations', (r) => r.abort('internetdisconnected'));
    await page.click('button[data-id="SE301"]');
    await page.waitForTimeout(800);
    await expect(page.locator('#msg')).toContainText('kết nối');
  });
  test('FET-11 MSSV 9 chữ số (biên trên + 1): ô MSSV không nhận quá 8 chữ số', async ({ page }) => {
    await page.goto('/index.html');
    await page.fill('#mssv', '123456789');
    expect((await page.inputValue('#mssv')).length).toBeLessThanOrEqual(8);
  });
});

// ======================= BVA – Boundary Value Analysis (giới hạn 25 tín chỉ) =======================
test.describe('BVA', () => {
  const R22 = ['IT001', 'IT005', 'IT010', 'MA201', 'SE301', 'IT030', 'IT020'];            // 22 TC
  const R23 = ['IT001', 'IT005', 'IT010', 'MA201', 'SE301', 'IT030', 'PE001', 'SE330'];   // 23 TC
  const R25 = [...R22, 'SE320'];                                                           // 25 TC
  test('BVA-01 22 TC + 3 TC = 25 (đúng biên): chấp nhận', async ({ page }) => {
    await reset(page, R22); await login(page);
    await register(page, 'SE320');
    expect((await registrations(page)).total).toBe(25);
  });
  test('BVA-02 23 TC + 3 TC = 26 (biên + 1): từ chối', async ({ page }) => {
    await reset(page, R23); await login(page);
    await register(page, 'SE320');
    expect((await registrations(page)).total).toBe(23);
    await expect(page.locator('#msg')).toContainText('Vượt quá');
  });
  test('BVA-03 25 TC + 2 TC = 27 (đã ở biên): từ chối', async ({ page }) => {
    await reset(page, R25); await login(page);
    await register(page, 'PE001');
    expect((await registrations(page)).total).toBe(25);
  });
  test('BVA-04 22 TC + 2 TC = 24 (biên − 1): chấp nhận', async ({ page }) => {
    await reset(page, R22); await login(page);
    await register(page, 'PE001');
    expect((await registrations(page)).total).toBe(24);
  });
});

// ======================= A11Y – Accessibility =======================
test.describe('A11Y', () => {
  test('A11Y-01 Khai báo ngôn ngữ trang (WCAG 3.1.1)', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  });
  test('A11Y-02 Mọi ô nhập đều có nhãn (WCAG 1.3.1, 3.3.2)', async ({ page }) => {
    await login(page);
    await page.goto('/profile.html'); await page.waitForTimeout(400);
    const unlabeled = await page.$$eval('input, select', (els) => els.filter((e) => !(e.labels && e.labels.length) && !e.getAttribute('aria-label')).map((e) => '#' + e.id));
    expect(unlabeled, 'Ô nhập không có nhãn: ' + unlabeled.join(', ')).toEqual([]);
  });
  test('A11Y-03 Hủy đăng ký chỉ bằng bàn phím (WCAG 2.1.1)', async ({ page }) => {
    await login(page);
    await page.goto('/my.html'); await page.waitForSelector('#tbl tbody tr');
    let reached = false;
    for (let i = 0; i < 25 && !reached; i++) {
      await page.keyboard.press('Tab');
      reached = await page.evaluate(() => !!document.activeElement && document.activeElement.hasAttribute('data-rid'));
    }
    expect(reached, 'Không thể dùng phím Tab để tới nút hủy').toBe(true);
  });
  test('A11Y-04 Có chỉ báo focus khi dùng bàn phím (WCAG 2.4.7)', async ({ page }) => {
    await page.goto('/index.html');
    await page.keyboard.press('Tab');
    const style = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle + ' ' + s.outlineWidth; });
    expect(style).not.toMatch(/^none|0px$/);
  });
  test('A11Y-05 Không cuộn ngang ở chiều rộng 320px (WCAG 1.4.10)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await login(page);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(sw).toBeLessThanOrEqual(320);
  });
  test('A11Y-06 axe-core: không có vi phạm WCAG 2.x mức A/AA', async ({ page }) => {
    await login(page);
    const all = [];
    for (const p of ['index.html', 'courses.html', 'my.html', 'profile.html']) {
      if (p === 'index.html') { await page.evaluate(() => sessionStorage.clear()); }
      await page.goto('/' + p); await page.waitForTimeout(500);
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      all.push(...r.violations.map((v) => `${p}: ${v.id} (${v.nodes.length})`));
      if (p === 'index.html') { await login(page); }
    }
    expect(all, all.join('\n')).toEqual([]);
  });
});
