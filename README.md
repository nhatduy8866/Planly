# Planly

Planly là ứng dụng lập kế hoạch cá nhân cho Android, kết hợp lịch biểu, danh sách công việc và ghi chú trong một giao diện tối giản. Project hiện là một MVP local-first xây dựng bằng React Native, Expo và TypeScript.

## Tính năng hiện có

### Lịch biểu

- Chuyển đổi lịch tuần và lịch tháng trên cùng màn hình.
- Di chuyển giữa các tuần/tháng, quay nhanh về hôm nay.
- Hiển thị ngày có công việc và danh sách công việc của ngày đang chọn.
- Tạo, chỉnh sửa, hoàn thành, nhân bản và xóa công việc.
- Đổi thứ tự công việc trong ngày bằng tay hoặc tự sắp theo giờ bắt đầu.
- Đặt nhắc việc đúng giờ hoặc trước 5, 15, 30, 60 phút.
- Chọn giữa thông báo thường (mặc định) và báo thức toàn màn hình có chuông, rung trong phần Cài đặt.
- Tạo hoặc sắp xếp lại lịch bằng yêu cầu tiếng Việt tự nhiên.
- Tự chọn giờ bắt đầu chưa được sử dụng, phát hiện trùng giờ và đề xuất giờ thay thế.
- Sử dụng Gemini khi có API key và tự fallback sang NLP offline.

### Công việc

- Xem công việc theo ngày.
- Lọc theo trạng thái cần làm, tất cả hoặc đã hoàn thành.
- Tìm kiếm theo tên và mô tả.

### Ghi chú

- Tạo, chỉnh sửa và xóa ghi chú.
- Tìm kiếm theo tiêu đề và nội dung.

Dữ liệu task và note được lưu cục bộ trên thiết bị bằng AsyncStorage, không cần tài khoản hoặc backend.

> Nhập giọng nói hiện mới là luồng demo, chưa tích hợp Speech-to-Text thật.

## Công nghệ

- Expo SDK 57
- Expo Router
- React Native 0.86
- React 19
- TypeScript
- AsyncStorage
- Expo Notifications
- React Native Alarm Scheduler
- Jest và ESLint

## Yêu cầu môi trường

- Node.js 22.13 trở lên
- npm
- Một trong các lựa chọn chạy Android:
  - Điện thoại Android cài Expo Go; hoặc
  - Android Studio, Android SDK và máy ảo Android.

## Cài đặt

```bash
npm install
npm start
```

Sau khi Metro khởi động, quét mã QR bằng Expo Go. Nếu máy đã cấu hình Android SDK và đang chạy emulator:

```bash
npm run android
```

Lệnh trên dùng khi cài app lần đầu hoặc sau khi thay đổi dependency/cấu hình native. Ở các phiên làm việc tiếp theo, khi app đã có trên emulator, chỉ cần chạy một lệnh nhanh hơn:

```bash
npm run android:dev
```

Lệnh này khởi động Metro đúng chế độ Expo Router và tự mở Planly trên emulator. Không chạy app debug chỉ bằng nút Run của Android Studio khi Metro chưa bật, vì app debug không chứa sẵn JavaScript bundle. Nếu Metro gặp cache cũ, chạy một lần:

```bash
npm run android:dev -- --clear
```

Thông báo thường là chế độ mặc định và hoạt động trong Expo Go. Chế độ Báo thức sử dụng module native để reo, rung và hiển thị giao diện tắt báo thức trong tối đa 5 phút, vì vậy cần development build (`npm run android`) và không hoạt động trong Expo Go. Sau khi đổi dependency hoặc cấu hình Alarm, hãy build lại app trước khi kiểm thử.

## Kiểm tra chất lượng

```bash
npm run typecheck
npm run lint
npm test
npm run doctor
```

## Cấu trúc chính

```text
Planly/
├── src/
│   ├── app/                   # Route, layout và điều hướng tab bằng Expo Router
│   ├── components/            # Calendar, task card và các form modal
│   ├── hooks/                 # Luồng CRUD task và đồng bộ reminder
│   ├── screens/               # Lịch, công việc, ghi chú
│   ├── services/              # Thông báo local và báo thức native
│   ├── store/                 # Context, reducer và persistence
│   ├── theme/                 # Design tokens
│   ├── types/                 # Kiểu dữ liệu dùng chung
│   └── utils/                 # Xử lý ngày giờ và ID
├── app.json                   # Cấu hình Expo/Android
└── package.json
```

## Phạm vi tiếp theo

- Tích hợp Speech-to-Text thật cho Planly AI.
- Đồng bộ nhiều thiết bị và sao lưu tài khoản.
- Task lặp lại và các quy tắc nhắc lịch nâng cao.
- Widget Android và tích hợp lịch hệ thống.

## License

Chưa lựa chọn giấy phép. Mọi quyền hiện thuộc về chủ sở hữu repository.
