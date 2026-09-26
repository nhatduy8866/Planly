# Checklist phát hành Planly

Tài liệu này là checklist kỹ thuật, không thay thế tư vấn pháp lý. Không phát hành bản production cho đến khi tất cả mục bắt buộc đã có chủ sở hữu và bằng chứng hoàn thành.

## Danh tính và tài liệu công khai

- [ ] Điền tên pháp lý của đơn vị kiểm soát dữ liệu vào `EXPO_PUBLIC_DATA_CONTROLLER_NAME`.
- [ ] Điền email tiếp nhận yêu cầu quyền riêng tư vào `EXPO_PUBLIC_PRIVACY_CONTACT_EMAIL` và kiểm tra hộp thư có người phụ trách.
- [ ] Công bố chính sách quyền riêng tư tại URL HTTPS ổn định rồi điền `EXPO_PUBLIC_PRIVACY_POLICY_URL`.
- [ ] Công bố trang xóa tài khoản tại URL HTTPS ổn định rồi điền `EXPO_PUBLIC_ACCOUNT_DELETION_URL`. Trang này phải cho phép người dùng yêu cầu xóa mà không cần cài lại ứng dụng.
- [ ] Đưa hai URL trên vào Google Play Console/App Store Connect và bảo đảm nội dung công khai khớp với hành vi của bản phát hành.

## Dữ liệu và nhà cung cấp

- [ ] Chọn vùng dữ liệu Supabase phù hợp, ký/kiểm tra DPA và ghi lại danh sách bên xử lý dữ liệu.
- [ ] Xác định cấu hình Gemini là trả phí hay miễn phí; cập nhật chính sách nếu điều kiện lưu giữ hoặc dùng dữ liệu thay đổi.
- [ ] Hoàn tất hồ sơ đánh giá tác động xử lý dữ liệu cá nhân và chuyển dữ liệu xuyên biên giới nếu pháp luật áp dụng yêu cầu.
- [ ] Xác định lịch lưu giữ cho tài khoản, công việc, log vận hành, yêu cầu hỗ trợ và bằng chứng đồng ý/xóa dữ liệu.
- [ ] Có quy trình tiếp nhận yêu cầu truy cập, sửa, xóa, hạn chế xử lý và xử lý sự cố dữ liệu.

## Store và quyền hệ điều hành

- [ ] Khai báo Data Safety của Google Play và Privacy Nutrition Labels của Apple theo đúng dữ liệu thực tế.
- [ ] Hoàn tất khai báo/quy trình xét duyệt cho `USE_EXACT_ALARM` và full-screen intent nếu vẫn phân phối chế độ báo thức toàn màn hình.
- [ ] Kiểm tra Privacy Manifest, entitlement, ký và archive iOS trên macOS/Xcode.
- [ ] Kiểm thử luồng xóa tài khoản từ trong ứng dụng và từ URL công khai trên môi trường production.

## Khóa, build và chuỗi cung ứng

- [ ] Tạo upload keystore riêng, lưu bản sao an toàn và không commit keystore/mật khẩu.
- [ ] Cung cấp đủ bốn biến `PLANLY_UPLOAD_*` khi build release; kiểm tra chứng thư APK/AAB không có `Android Debug`.
- [ ] Chạy `npm audit --omit=dev`; đánh giá và ghi nhận mọi cảnh báo chưa có bản vá tương thích.
- [ ] Kiểm tra nguồn gốc/quyền sử dụng icon, hình nền, âm thanh và phông chữ; lưu bằng chứng cấp phép.
- [ ] Rà soát giấy phép dependency và công bố notices nếu giấy phép yêu cầu.

## Kiểm thử trước phát hành

- [ ] Chạy `npm run typecheck`, `npm run lint`, `npm test` và `npm run doctor`.
- [ ] Kiểm thử đăng ký, đăng nhập, đăng xuất, mất mạng, hết hạn mức AI và xóa tài khoản trên bản release.
- [ ] Kiểm thử quyền micro, thông báo, báo thức, backup/restore và việc tệp ghi âm tạm bị xóa sau khi xử lý.
- [ ] Kiểm thử nâng cấp từ phiên bản cũ để xác nhận phiên Supabase được chuyển khỏi AsyncStorage sang SecureStore.
