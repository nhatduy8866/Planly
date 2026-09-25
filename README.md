# Planly

Planly là ứng dụng lập kế hoạch cá nhân cho Android và iOS, kết hợp lịch biểu và danh sách công việc trong một giao diện tối giản. Ứng dụng được xây dựng bằng React Native, Expo và TypeScript theo hướng local-first.

## Tính năng hiện có

### Lịch biểu

- Chuyển đổi lịch tuần và lịch tháng trên cùng màn hình.
- Di chuyển giữa các tuần/tháng, quay nhanh về hôm nay.
- Hiển thị ngày có công việc; lọc danh sách của ngày đang chọn theo nhóm sắp diễn ra, đã qua hoặc tất cả.
- Tạo, chỉnh sửa, hoàn thành và xóa công việc.
- Tạo hàng loạt theo thứ trong tuần, ngày trong tháng hoặc danh sách ngày cụ thể; có thể sửa cả nhóm hoặc tách riêng một công việc.
- Chọn màu, mức ưu tiên và sắp xếp theo giờ bắt đầu, ưu tiên hoặc tên.
- Khi tạo mới, giờ bắt đầu mặc định được làm tròn lên mốc 30 phút gần nhất.
- Thông báo hoặc báo thức vào đúng giờ bắt đầu công việc.
- Chọn giữa thông báo thường (mặc định) và báo thức toàn màn hình; báo thức hỗ trợ bật/tắt rung, âm thanh và hình nền có sẵn hoặc tệp tùy chỉnh.
- Xem nhanh công việc hôm nay bằng widget màn hình chính trên Android và iOS.
- Tạo, cập nhật hoặc sắp xếp lại lịch bằng yêu cầu tiếng Việt tự nhiên qua văn bản hoặc giọng nói.
- Tự chọn giờ bắt đầu chưa được sử dụng, phát hiện trùng giờ và đề xuất giờ thay thế.
- Sử dụng Gemini khi có API key và tự fallback sang NLP offline.

### Công việc

- Xem công việc theo ngày.
- Lọc theo trạng thái sắp diễn ra, đã qua hoặc tất cả.
- Tìm kiếm theo tên và mô tả.
- Sắp xếp theo thời gian, mức ưu tiên, tên hoặc ngày tạo.

### Cá nhân hóa và đồng bộ

- Chuyển đổi giao diện sáng/tối và ngôn ngữ Việt/Anh.
- Bật/tắt màu nhấn và badge số lượng công việc trên lịch.
- Đăng ký hoặc đăng nhập bằng email để sao lưu, khôi phục và đồng bộ công việc qua Supabase.

Dữ liệu công việc luôn được lưu cục bộ bằng AsyncStorage để ứng dụng tiếp tục hoạt động khi mất mạng. Khi Supabase được cấu hình và người dùng đăng nhập, Planly tự động đồng bộ dữ liệu giữa các thiết bị.

## Công nghệ

- Expo SDK 57
- Expo Router
- React Native 0.86
- React 19
- TypeScript
- AsyncStorage
- Supabase Auth và PostgreSQL
- Expo Notifications
- Expo Audio và Expo File System
- React Native Alarm Scheduler
- Expo Widgets và React Native Android Widget
- Jest và ESLint

## Yêu cầu môi trường

- Node.js 22.13 trở lên
- npm
- Một trong các lựa chọn chạy Android:
  - Điện thoại Android cài Expo Go; hoặc
  - Android Studio, Android SDK và máy ảo Android.
- macOS và Xcode nếu cần build widget iOS.

## Cài đặt

```bash
npm install
npm start
```

### Cấu hình biến môi trường

Tạo `.env` từ `.env.example`. Planly vẫn chạy local-first khi chưa cấu hình Supabase.

Để bật sao lưu và đồng bộ qua Supabase:

1. Tạo một project Supabase.
2. Chạy migration trong `supabase/migrations` bằng Supabase CLI hoặc SQL Editor.
3. Điền các biến sau vào `.env`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

4. Khởi động lại Metro, mở **Cài đặt → Sao lưu và đồng bộ**, sau đó tạo tài khoản hoặc đăng nhập.

### Cấu hình Gemini an toàn

Planly không đóng gói Gemini API key trong ứng dụng. Các yêu cầu Gemini đi qua
Supabase Edge Function `gemini-proxy` và chỉ chấp nhận người dùng Supabase đã
đăng nhập.

1. Tạo Gemini API key trong Google AI Studio.
2. Lưu `GEMINI_API_KEY` trong **Supabase Dashboard → Edge Functions → Secrets**.
   Không thêm key này vào `.env` của ứng dụng hoặc source control.
3. Liên kết Supabase CLI với project rồi deploy function:

```bash
npx supabase link --project-ref your_project_ref
npx supabase db push --linked
npx supabase functions deploy gemini-proxy --use-api
```

Các yêu cầu văn bản đơn giản vẫn dùng NLP offline. Lập lịch nâng cao và chuyển
giọng nói thành văn bản cần Supabase được cấu hình, Edge Function đã deploy và
người dùng đã đăng nhập. Mỗi tài khoản có tối đa 50 lượt gọi AI cloud mỗi ngày;
lập lịch nâng cao và chuyển giọng nói cùng sử dụng hạn mức này. Các yêu cầu được
xử lý hoàn toàn offline không tính vào hạn mức.

Chỉ dữ liệu công việc được đưa lên cloud. ID thông báo, quyền báo thức và URI tệp âm thanh/hình nền tùy chỉnh vẫn nằm riêng trên từng thiết bị. Khi dữ liệu được khôi phục, Planly tự tạo lại reminder phù hợp cho thiết bị hiện tại.

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

Thông báo thường là chế độ mặc định và hoạt động trong Expo Go. Chế độ Báo thức sử dụng module native để mở màn hình báo thức, sau đó app tiếp quản chuông và rung trong tối đa 5 phút; chế độ này không lên lịch thêm thông báo thường. Alarm cần development build và không hoạt động trong Expo Go. Sau khi đổi dependency, chuông đóng gói hoặc cấu hình Alarm, hãy chạy `npx expo prebuild --platform android` rồi `npm run android` trước khi kiểm thử.

### Widget Hôm nay

Widget hiển thị công việc sắp tới trong ngày theo giờ bắt đầu và tự thích ứng giao diện sáng/tối. Chạm vào vòng tròn để hoàn thành task ngay từ widget; trong 5 giây tiếp theo có thể chạm lại dấu tích để hoàn tác. Chạm vào phần còn lại để mở Planly. Dữ liệu được làm mới ngay khi task hoặc ngôn ngữ thay đổi; Android còn yêu cầu cập nhật định kỳ tối đa mỗi 30 phút, còn iOS nhận timeline cho 7 ngày tiếp theo.

Widget sử dụng native extension nên không xuất hiện trong Expo Go. Sau khi cài dependency, hãy tạo development build bằng `npm run android` trên Android hoặc `npm run ios` trên macOS. Sau đó nhấn giữ màn hình chính, chọn **Widget**, tìm **Planly Hôm nay** và thêm vào màn hình.

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
│   ├── auth/                  # Phiên đăng nhập Supabase
│   ├── components/            # Calendar, task card và các form modal
│   ├── hooks/                 # Luồng CRUD task và đồng bộ reminder
│   ├── preferences/           # Giao diện, ngôn ngữ và tùy chọn nhắc việc
│   ├── screens/               # Màn hình lịch và công việc
│   ├── services/              # AI, giọng nói, thông báo, báo thức và dịch vụ cloud
│   ├── storage/               # Khóa lưu trữ cục bộ
│   ├── sync/                  # Điều phối đồng bộ local-first
│   ├── store/                 # Context, reducer và persistence
│   ├── theme/                 # Design tokens
│   ├── types/                 # Kiểu dữ liệu dùng chung
│   ├── utils/                 # Xử lý ngày giờ và ID
│   └── widgets/               # Giao diện và đồng bộ widget Android/iOS
├── app.json                   # Cấu hình Expo/Android
└── package.json
```

## Phạm vi tiếp theo

- Bổ sung lịch sử khôi phục dữ liệu và quản lý phiên đăng nhập chi tiết hơn.
- Task lặp lại và các quy tắc nhắc lịch nâng cao.
- Tích hợp lịch hệ thống và widget màn hình khóa.

## License

Chưa lựa chọn giấy phép. Mọi quyền hiện thuộc về chủ sở hữu repository.
