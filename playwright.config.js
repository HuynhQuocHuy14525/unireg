// Cấu hình Playwright: chạy cùng một bộ kiểm thử trên 2 phiên bản ứng dụng
const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  workers: 1, // dữ liệu máy chủ dùng chung -> chạy tuần tự
  timeout: 30000,
  reporter: [['list'], ['json', { outputFile: 'results/results.json' }], ['html', { outputFolder: 'results/html', open: 'never' }]],
  use: { browserName: 'chromium', viewport: { width: 1366, height: 800 }, screenshot: 'only-on-failure' },
  // Tự khởi động 2 phiên bản ứng dụng trước khi chạy kiểm thử
  webServer: [
    { command: 'node server.js 1', url: 'http://localhost:3001/index.html', reuseExistingServer: true, timeout: 30000 },
    { command: 'node server.js 2', url: 'http://localhost:3002/index.html', reuseExistingServer: true, timeout: 30000 },
  ],
  projects: [
    { name: 'v1.0', use: { baseURL: 'http://localhost:3001' } },
    { name: 'v1.1', use: { baseURL: 'http://localhost:3002' } },
  ],
});
