# Planly

Planly là ứng dụng lập kế hoạch cá nhân cho Android, kết hợp lịch biểu, danh sách công việc và ghi chú trong một giao diện tối giản. Project hiện là một MVP local-first xây dựng bằng React Native, Expo và TypeScript.

## Tính năng hiện có

### Lịch biểu

- Chuyển đổi lịch tuần và lịch tháng trên cùng màn hình.
- Di chuyển giữa các tuần/tháng, quay nhanh về hôm nay.
- Hiển thị ngày có công việc và danh sách công việc của ngày đang chọn.
- Tạo, chỉnh sửa, hoàn thành, nhân bản và xóa công việc.
- Đổi thứ tự công việc trong ngày bằng tay hoặc tự sắp theo giờ bắt đầu.
- Đặt thông báo local đúng giờ hoặc trước 5, 15, 30, 60 phút.

### Công việc

- Xem công việc theo ngày.
- Lọc theo trạng thái cần làm, tất cả hoặc đã hoàn thành.
- Tìm kiếm theo tên và mô tả.

### Ghi chú

- Tạo, chỉnh sửa và xóa ghi chú.
- Tìm kiếm theo tiêu đề và nội dung.

Dữ liệu task và note được lưu cục bộ trên thiết bị bằng AsyncStorage, không cần tài khoản hoặc backend.

> Phần AI xếp lịch và nhập giọng nói chưa nằm trong phạm vi triển khai hiện tại.

## Công nghệ

- Expo SDK 57
- React Native 0.86
- React 19
- TypeScript
- AsyncStorage
- Expo Notifications
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

Thông báo local hoạt động trong Expo Go. Để kiểm thử cấu hình native và quyền báo thức chính xác giống bản phát hành, tạo development build bằng Expo/EAS hoặc chạy prebuild trên máy có Android SDK.

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
├── App.tsx                    # App shell và điều hướng ba tab
├── src/
│   ├── components/            # Calendar, task card và các form modal
│   ├── hooks/                 # Luồng CRUD task và đồng bộ reminder
│   ├── screens/               # Lịch, công việc, ghi chú
│   ├── services/              # Thông báo local
│   ├── store/                 # Context, reducer và persistence
│   ├── theme/                 # Design tokens
│   ├── types/                 # Kiểu dữ liệu dùng chung
│   └── utils/                 # Xử lý ngày giờ và ID
├── app.json                   # Cấu hình Expo/Android
└── package.json
```

## Phạm vi tiếp theo

- AI tiếp nhận yêu cầu bằng văn bản/giọng nói và đề xuất lịch.
- Đồng bộ nhiều thiết bị và sao lưu tài khoản.
- Task lặp lại và các quy tắc nhắc lịch nâng cao.
- Widget Android và tích hợp lịch hệ thống.

## License

Chưa lựa chọn giấy phép. Mọi quyền hiện thuộc về chủ sở hữu repository.
