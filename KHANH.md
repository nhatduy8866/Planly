# BÁO CÁO CÔNG VIỆC THỰC HIỆN BỞI KHANH

Tài liệu này ghi chú lại toàn bộ các công việc, tính năng và lỗi đã được Khanh xử lý trên dự án **Planly** nhằm giúp đồng đội dễ dàng nắm bắt tiến độ, tiếp quản và phát triển tiếp mà không bị xung đột hay bỡ ngỡ.

---

## 1. Thông tin nhánh và Commit
- **Nhánh làm việc (Branches)**:
  - `feature/web-support-and-form-pickers`: Hỗ trợ Web & nâng cấp bộ chọn ngày/giờ/thời lượng.
  - `fix/sort-and-delete-actions`: Sửa triệt để lỗi Xóa và Sắp xếp công việc/ghi chú trên Web & Mobile.
- **Mã commit chính**:
  - `626962c` (`feat: add web support and improve task date time pickers`)
  - `c33a2a1` (`docs: add handover documentation in KHANH.md`)
- **Tình trạng**: Sẵn sàng tạo Pull Request cho từng nhánh theo đúng quy chuẩn git workflow.

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

### D. Khắc phục triệt để tính năng Xóa và Sắp xếp (Deletion & Sorting)

#### 1. Khắc phục tính năng Xóa công việc và Ghi chú (Web & Mobile)
- **Nguyên nhân lỗi**:
  - Trước đây app sử dụng `Alert.alert(...)` có sẵn của React Native để hỏi xác nhận khi xóa. Trên môi trường `react-native-web`, `Alert.alert` chỉ là giả lập hoặc `window.alert` không thực thi callback `onPress` của các nút hành động (Cancel / Delete). Do đó khi bấm Xóa trên Web, ứng dụng hoàn toàn không phản hồi.
  - Trong `useTaskActions.ts`, hàm `deleteTask` bị chặn bởi lệnh `await cancelTaskReminder(id)`. Nếu dịch vụ notification bị treo hoặc gặp lỗi thì hành động xóa sẽ bị tắc nghẽn.
- **Giải pháp**:
  - **Tạo component xác nhận đa nền tảng**: Xây dựng `src/components/ConfirmModal.tsx` dựa trên React Native `Modal` thuần, có overlay mờ, hiển thị rõ tiêu đề, nội dung tên công việc/ghi chú và 2 nút bấm rõ ràng (Hủy và nút Xóa cảnh báo màu đỏ).
  - **Thay thế triệt để**: Cập nhật cả 3 màn hình `ScheduleScreen.tsx`, `TasksScreen.tsx`, và `NotesScreen.tsx` chuyển sang dùng `ConfirmModal`. Hoạt động đồng nhất, mượt mà 100% trên cả Web, Android và iOS.
  - **Tối ưu xóa phản hồi tức thì (Optimistic UI)**: Trong `useTaskActions.ts`, cập nhật State `dispatch({ type: 'delete_task', payload: { id } })` ngay lập tức để giao diện xóa ngay, sau đó việc hủy notification được bọc trong try/catch xử lý ngầm trong nền mà không làm chậm UI.

#### 2. Khắc phục tính năng Sắp xếp (Sorting & Reordering)
- **Tại màn hình Lịch trình (`ScheduleScreen.tsx`)**:
  - *Nguyên nhân*: Reducer xử lý `move_task` và `sort_day` dựa vào phép trừ `a.order - b.order`. Khi các task được thêm mới có cùng giá trị `order` (hoặc `undefined`), phép trừ ra `NaN` dẫn đến việc hoán đổi vị trí bị lỗi hoặc nhảy sai vị trí.
  - *Giải pháp*:
    - Viết lại reducer `move_task` trong `plannerReducer.ts`: Lấy danh sách task của ngày đó, sắp xếp ổn định, hoán đổi phần tử trực tiếp trong mảng (`[tasks[from], tasks[to]] = [tasks[to], tasks[from]]`), sau đó re-index lại `order` tuần tự `0, 1, 2...` cho từng task thông qua một `orderMap`.
    - Viết lại `sort_day`: Sắp xếp các task theo `startTime` tăng dần, sau đó cũng re-index lại `order` tuần tự `0..N-1`.
    - Bổ sung rung xúc giác nhẹ (`haptics.selection()`) khi bấm nút mũi tên lên/xuống trên mobile.
- **Tại màn hình Công việc (`TasksScreen.tsx`)**:
  - *Nguyên nhân*: Màn hình này trước đây chỉ có bộ lọc trạng thái (Tất cả, Đang làm, Hoàn thành), hoàn toàn không có tính năng sắp xếp danh sách.
  - *Giải pháp*:
    - Bổ sung thanh công cụ sắp xếp (Sort Bar) với 3 tùy chọn: **`Theo giờ` (Giờ bắt đầu tăng dần)**, **`Tên A-Z` (Bảng chữ cái)**, và **`Mới nhất` (Thời gian tạo)**.
    - Xử lý sắp xếp kết hợp với bộ lọc trạng thái mượt mà bằng `useMemo`.

#### 3. Bổ sung Unit Test
- Cập nhật `src/store/plannerReducer.test.ts`:
  - Thêm test case kiểm tra `delete_task` xóa chuẩn xác task được chỉ định và không ảnh hưởng đến các task khác.
  - Thêm test case kiểm tra `move_task` khi các task ban đầu có cùng chỉ số `order`, đảm bảo việc hoán đổi và re-index diễn ra chính xác tuyệt đối.

---

## 3. Các file đã thay đổi trong đợt này
1. `package.json` & `package-lock.json`: Thêm các thư viện Web.
2. `App.tsx`: Căn giữa container desktop web.
3. `src/services/notifications.ts`: Bổ sung kiểm tra an toàn cho Web.
4. `src/components/TaskFormModal.tsx`: Nâng cấp chọn ngày, giờ, thời lượng chips, fix lỗi iOS và fix kích thước web modal.
5. `src/components/NoteFormModal.tsx`: Đồng bộ giao diện web modal ghi chú.
6. `src/components/ConfirmModal.tsx`: *(Mới)* Component modal xác nhận xóa chuẩn đa nền tảng (Web/iOS/Android).
7. `src/hooks/useTaskActions.ts`: Tối ưu hóa xóa task tức thì (Optimistic UI).
8. `src/screens/ScheduleScreen.tsx`: Thay thế ConfirmModal và tăng độ tin cậy khi di chuyển/sắp xếp công việc.
9. `src/screens/TasksScreen.tsx`: Thay thế ConfirmModal và bổ sung thanh công cụ sắp xếp (Sort Bar).
10. `src/screens/NotesScreen.tsx`: Thay thế ConfirmModal cho việc xóa ghi chú.
11. `src/store/plannerReducer.ts`: Viết lại logic `move_task` và `sort_day` với cơ chế re-index sequential `orderMap`.
12. `src/store/plannerReducer.test.ts`: Thêm unit tests cho `delete_task` và `move_task`.

---

## 4. Trạng thái kiểm thử (Quality Checks)
Toàn bộ mã nguồn đã vượt qua các bài kiểm tra nghiêm ngặt:
- `npm run typecheck`: ✅ **0 lỗi TypeScript**.
- `npm run lint`: ✅ **0 warning / error ESLint**.
- `npm test`: ✅ **10/10 unit tests passed** (Jest).
- Kiểm tra thực tế:
  - **Xóa**: Bấm xóa trên Web và Mobile đều mở modal xác nhận đẹp mắt, xác nhận xóa là item biến mất ngay lập tức.
  - **Sắp xếp**: Mũi tên lên/xuống và nút sắp xếp theo giờ ở Lịch trình hoạt động chính xác 100%, không bị nhảy task; thanh sort ở màn hình Công việc lọc và sắp xếp mượt mà.

---

*Người thực hiện: Khanh*  
*Mọi thắc mắc hoặc cần phối hợp tiếp, vui lòng xem các nhánh và Pull Request tương ứng trên GitHub.*
