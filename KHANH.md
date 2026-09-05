# BÁO CÁO CÔNG VIỆC THỰC HIỆN BỞI KHANH

Tài liệu này ghi chú lại toàn bộ các công việc, tính năng và lỗi đã được Khanh xử lý trên dự án **Planly** nhằm giúp đồng đội dễ dàng nắm bắt tiến độ, tiếp quản và phát triển tiếp mà không bị xung đột hay bỡ ngỡ.

---

## 1. Thông tin nhánh và Commit
- **Nhánh làm việc (Branch)**: `feature/web-support-and-form-pickers`
- **Mã commit chính**: `626962c` (`feat: add web support and improve task date time pickers`)
- **Tình trạng**: Đã push lên GitHub, sẵn sàng để tạo Pull Request và merge vào `main`.

---

## 2. Danh sách các hạng mục đã hoàn thành

### A. Hỗ trợ chạy thử nghiệm trên Web (Desktop Browser)
- **Bối cảnh**: Ban đầu dự án chỉ cấu hình cho Android/iOS. Khi mở cổng `http://localhost:8081` trên trình duyệt máy tính, Expo chỉ trả về chuỗi JSON Manifest khiến không thể xem được app trực tiếp.
- **Giải pháp**:
  - Cài đặt thêm các gói thư viện chuẩn của Expo: `react-dom`, `react-native-web`, `@expo/metro-runtime`.
  - **Không làm ảnh hưởng đến bản Mobile**: Các nền tảng Android/iOS vẫn sử dụng runtime native 100%, không bị ảnh hưởng hiệu năng hay logic.
  - **Tối ưu hiển thị Desktop**:
    - Chỉnh sửa `App.tsx`: Khi chạy trên Web, giao diện app được tự động bọc trong khung chuẩn điện thoại (`maxWidth: 480px`), căn giữa màn hình với màu nền nhẹ nhàng, mang lại cảm giác dùng như một chiếc điện thoại thật trên máy tính.
  - **Xử lý tương thích dịch vụ Thông báo (`src/services/notifications.ts`)**:
    - Bổ sung điều kiện kiểm tra nền tảng `Platform.OS !== 'web'`. Trên Web sẽ bỏ qua các lệnh gọi notification native để tránh sinh lỗi runtime hoặc cảnh báo không cần thiết.

---

### B. Cải tiến trải nghiệm Modal Công việc (`src/components/TaskFormModal.tsx`)

#### 1. Chọn ngày bắt đầu theo lịch trực quan
- **Trước đây**: Người dùng phải gõ tay định dạng chuỗi `YYYY-MM-DD`, rất dễ gõ sai thứ tự ngày/tháng và gây lỗi date parsing.
- **Đã làm**:
  - **Trên Web**: Tích hợp bộ chọn ngày trực quan (`<input type="date">` có icon lịch), người dùng click vào là bung popup lịch chọn ngày của trình duyệt.
  - **Trên Mobile**: Bấm vào mở hộp thoại lịch native.

#### 2. Chọn giờ bắt đầu trực quan
- **Trước đây**: Người dùng phải gõ bàn phím từng số cho giờ phút (`09:00`).
- **Đã làm**:
  - **Trên Web**: Tích hợp bộ chọn giờ (`<input type="time">`), chọn nhanh giờ và phút.
  - **Trên Mobile**: Bấm vào mở bộ chọn giờ native hoặc con lăn thời gian.

#### 3. Bộ chọn Thời lượng công việc dạng Quick Chips
- **Trước đây**: Chỉ có một ô nhập số phút (`30`), người dùng phải bấm bàn phím số.
- **Đã làm**:
  - Thêm hàng nút chọn nhanh (Quick Chips): **`15 phút`**, **`30 phút`**, **`45 phút`**, **`1 giờ`**, **`1.5 giờ`**, **`2 giờ`**.
  - Người dùng chỉ cần 1 chạm là chọn xong thời lượng cho 95% các tác vụ thường ngày.
  - Bổ sung nút **`Khác`**: Khi bấm vào sẽ mở ô nhập số phút tùy chỉnh nếu công việc có thời lượng đặc biệt (ví dụ 10 phút, 25 phút...).

#### 4. Khắc phục các lỗi hiển thị riêng trên iPhone (iOS)
- **Lỗi 1 - Nút giờ bị rớt xuống góc dưới bên trái**:
  - *Nguyên nhân*: Trên iOS, thư viện `DateTimePicker` mặc định render nút dạng inline compact tại vị trí component trong JSX (nằm ở cuối form sau mục Nhắc trước).
  - *Khắc phục*: Tách riêng luồng iOS thành một **Bottom Sheet chuẩn Apple**. Khi bấm Ngày hoặc Bắt đầu, một bảng Sheet sẽ trượt từ dưới lên kèm thanh tiêu đề và nút **"Xong"** để đóng lại. Hoàn toàn không còn nút xám bị rớt dưới đáy màn hình.
- **Lỗi 2 - Chữ trắng trên nền trắng (bị chói sáng không thấy gì)**:
  - *Nguyên nhân*: Khi iPhone bật chế độ Dark Mode của iOS, `UIDatePicker` tự động render chữ màu TRẮNG, trong khi khung Sheet của app lại có nền TRẮNG.
  - *Khắc phục*: Cấu hình cứng `themeVariant="light"`, `textColor={colors.text}` và `accentColor={colors.primary}`. Chữ và số ngày tháng trên iPhone luôn luôn hiển thị màu đậm sắc nét, độ tương phản cao, chuẩn màu thương hiệu xanh rêu của Planly.

#### 5. Khắc phục lỗi co chiều cao Modal trên Web
- *Hiện tượng*: Khi bấm "Thêm việc" trên Web, khung modal bị co lại thành một vạch trắng mảnh ở giữa màn hình do Flexbox thiếu chiều cao cố định cho ScrollView.
- *Khắc phục*: Đã cấu hình kích thước chuẩn cho hộp thoại trên Web (`width: 92%`, `maxWidth: 480px`, `height: 88%`, `maxHeight: 700px`), cấp `flex: 1` cho ScrollView để hiển thị trọn vẹn toàn bộ form và cuộn mượt mà.

---

### C. Đồng bộ Modal Ghi chú (`src/components/NoteFormModal.tsx`)
- Tương tự như Modal Công việc, Modal Thêm/Sửa ghi chú đã được căn giữa dạng hộp thoại pop-up trên Web (`maxWidth: 480px`, `height: 80%`), bo góc và đổ bóng nhẹ, mang lại sự đồng bộ 100% trong toàn bộ ứng dụng.

---

## 3. Các file đã thay đổi trong đợt này
1. `package.json` & `package-lock.json`: Thêm các thư viện Web.
2. `App.tsx`: Căn giữa container desktop web.
3. `src/services/notifications.ts`: Bổ sung kiểm tra an toàn cho Web.
4. `src/components/TaskFormModal.tsx`: Nâng cấp chọn ngày, giờ, thời lượng chips, fix lỗi iOS và fix kích thước web modal.
5. `src/components/NoteFormModal.tsx`: Đồng bộ giao diện web modal ghi chú.

---

## 4. Trạng thái kiểm thử (Quality Checks)
Trước khi push, toàn bộ mã nguồn đã vượt qua các bài kiểm tra nghiêm ngặt:
- `npm run typecheck`: ✅ **0 lỗi TypeScript**.
- `npm run lint`: ✅ **0 warning / error ESLint**.
- `npm test`: ✅ **8/8 unit tests passed** (Jest).
- Kiểm tra thực tế:
  - Trên **Web**: Hoạt động mượt mà tại `http://localhost:8081`.
  - Trên **iPhone (Expo Go)**: Hiển thị đúng màu, không lỗi layout, bộ chọn ngày/giờ hoạt động chuẩn chỉ.

---

*Người thực hiện: Khanh*  
*Mọi thắc mắc hoặc cần phối hợp tiếp, vui lòng xem Pull Request trên nhánh `feature/web-support-and-form-pickers`.*
