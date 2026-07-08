# 📝 DAILY SUMMARY: API THANH LÝ HỢP ĐỒNG & FIX BUG TOÁN HỌC MÚI GIỜ (`2026-06-16`)

## 1. Nghiệp Vụ API Trả Phòng & Thanh Lý Hợp Đồng (`POST /contracts/:id/terminate`)

API này hoàn thiện toàn bộ vòng đời của một hợp đồng thuê trọ, tự động tính toán chi li số tiền dựa trên số ngày ở thực tế để khấu trừ vào tiền cọc (`depositAmount`).

### 📌 Các bước xử lý trong Transaction:

1. **Prorated Rent (Tính tiền phòng lẻ theo ngày):** Lấy số ngày ở thực tế trong tháng chia cho tổng số ngày của tháng đó, rồi nhân với giá phòng gốc để ra số tiền khít khịt.
2. **Chốt dịch vụ cuối kỳ:** Nhập số điện nước tại thời điểm trả phòng, lấy số mới trừ số cũ đầu kỳ ra lượng tiêu thụ thực tế để tính tiền. Có bộ check validation chặn không cho nhập số nhỏ hơn đầu kỳ.
3. **Gom nốt công nợ:** Gom sạch nợ cũ gối đầu từ hóa đơn trước (nếu có) + toàn bộ các khoản phát sinh, đền bù hư hại tài sản đang treo ở `RoomTab` (`status: PENDING`).
4. **Cân đối quỹ cọc (`finalSettlement`):** \* `finalSettlement = depositAmount - totalBillCost`
   - Nếu kết quả **DƯƠNG**: Chủ nhà cần hoàn trả lại tiền cọc thừa cho khách (`RETURN_TO_TENANT`).
   - Nếu kết quả **ÂM**: Khách ở lố tiền cọc, cần phải đóng thêm tiền cho chủ nhà (`COLLECT_FROM_TENANT`).
5. **Giải phóng hệ thống:** Đẻ ra 1 hóa đơn `UNPAID` cuối cùng làm căn cứ đối chiếu, chuyển trạng thái `Contract` sang `isActive: false`, gán các `RoomTab` sang `INVOICED` và đưa phòng (`Room`) về trạng thái trống `AVAILABLE`.

---

## 2. Bài Học Xương MÁU: Sửa Bug Toán Học Múi Giờ & Typo Số Lượng Milliseconds

### ❌ Lỗi 1: Typo hằng số phép tính ngày (`msPerDay`)

- **Hậu quả:** Gõ nhầm công thức `const msPerDay = 24 * 24 * 60 * 1000` (thừa một con số 24 và thiếu mất con số 60 của giây). Khiến số ngày ở thực tế của khách bị chia sai lệch, vọt lên tận **38 ngày** dù thực tế mới ở có 15-16 ngày.
- **Giải pháp:** Sửa lại chuẩn công thức toán học hoặc xài thẳng hằng số millisecond của 1 ngày:

  ```typescript
  const msPerDay = 24 * 60 * 60 * 1000; // Hoặc 86400000

  ROADMAP & TRẠNG THÁI HIỆN TẠI (ĐỌC ĐỂ LÀM TIẾP)
  ✅ ĐÃ HOÀN THÀNH (BACKEND):
  Invoice Loop & Cron Job: Tự động tạo hóa đơn nháp DRAFT gối đầu, chống trùng hóa đơn trùng lặp (Idempotency).
  ```

RoomTab (Phát sinh): Lưu vết nợ nần/giảm trừ linh hoạt giữa tháng. Tách logic tính toán thông minh dựa vào trạng thái hóa đơn (DRAFT chỉ cập nhật cột tabAmount, UNPAID cộng tịnh tiến vào cả totalAmount).

Thanh lý Hợp đồng (/contracts/:id/terminate): Xử lý bóc tách ngày ở thực tế (Prorated), khấu trừ tiền cọc sòng phẳng, đóng hợp đồng và trả phòng về AVAILABLE. Sửa triệt để bug toán học múi giờ.

⏳ TIẾP THEO (KHI QUAY LẠI BACKEND):
Khi quay lại làm Backend, anh em mình sẽ tập trung chiến cụm API Quản Lý Thu Chi Tổng Quan Cho Chủ Nhà (Dashboard / Thống kê):

Viết API thống kê doanh thu thực tế thu được từ các hóa đơn đã sang trạng thái PAID.

Viết API gom tổng nợ xấu (số tiền đang bị ngâm ở hóa đơn UNPAID và PARTIALLY_PAID) theo từng dãy trọ / tòa nhà để render lên biểu đồ Frontend
