# UniReg – Ứng dụng mẫu dùng để demo kiểm thử giao diện và chức năng (DT06)

Ứng dụng có hai phiên bản:

| Phiên bản | Lệnh chạy | Địa chỉ | Mô tả |
|---|---|---|---|
| 1.0 | `npm run v1` | http://localhost:3001 | Có cài sẵn lỗi (seeded defects) |
| 1.1 | `npm run v2` | http://localhost:3002 | Đã sửa lỗi |

Tài khoản đăng nhập (mật khẩu = MSSV):

| Thành viên | MSSV (tên đăng nhập) | Mật khẩu |
|---|---|---|
| Đào Tiến Dũng (nhóm trưởng) | `23658461` | `23658461` |
| Huỳnh Quốc Huy | `23654001` | `23654001` |

## 1. Cài đặt (chỉ làm 1 lần)

1. Cài Node.js bản LTS (18 trở lên) từ https://nodejs.org
2. Giải nén file zip, mở Terminal / Command Prompt tại thư mục `unireg`.
3. Chạy các lệnh sau:

```
npm install
npx playwright install chromium
```

## 2. Mở website để xem, thao tác bằng tay

Mở 2 cửa sổ Terminal tại thư mục `unireg`:

```
npm run v1        (cửa sổ 1)
npm run v2        (cửa sổ 2)
```

Sau đó mở trình duyệt vào http://localhost:3001 và http://localhost:3002. Nhấn Ctrl + C để tắt.

## 3. Chạy bộ kiểm thử tự động (35 test case × 2 phiên bản)

```
npm test
```

Lệnh này tự khởi động cả 2 phiên bản, không cần chạy `npm run v1` / `npm run v2` trước. Kết quả mong đợi: 46 lượt đạt, 24 lượt không đạt (bản 1.0 đạt 11/35, bản 1.1 đạt 35/35) (toàn bộ lượt không đạt nằm ở bản 1.0).

Xem báo cáo HTML:

```
npm run report
```

Chạy riêng một phiên bản hoặc một nhóm test case:

```
npx playwright test --project=v1.1
npx playwright test -g "FET"
npx playwright test --headed      (mở trình duyệt để xem quá trình chạy)
```

## 4. Chạy Lighthouse (tùy chọn)

Khi 2 phiên bản đang chạy:

```
npx lighthouse http://localhost:3001 --preset=desktop --view
npx lighthouse http://localhost:3002 --preset=desktop --view
```

Xem điểm mục Accessibility (bản 1.0 đạt 74, bản 1.1 đạt 100). Cũng có thể dùng Chrome DevTools, tab Lighthouse, chế độ Desktop.
