# Cơ sở dữ liệu nhân vật SF3

Trang web tĩnh để tra cứu nhân vật trong SF3, xem thông tin và chỉnh sửa năm chỉ số. Dữ liệu nhân vật và ảnh chân dung nằm trong `data/`; ứng dụng chạy bằng HTML, CSS và JavaScript thuần, không cần backend hay cài thư viện.

## Chạy trang web

Mở terminal tại thư mục dự án và chạy:

```bash
python3 -m http.server 8000
```

Mở `http://localhost:8000` trong trình duyệt. Để dừng máy chủ, nhấn `Ctrl+C` trong terminal.

Không nên mở `index.html` trực tiếp bằng đường dẫn `file://`, vì trình duyệt có thể chặn ứng dụng tải tệp JSON dữ liệu.

## Tra cứu nhân vật

- Nhập tên tiếng Anh, tên tiếng Nhật hoặc ID vào ô tìm kiếm. Có thể kết hợp tìm kiếm với các bộ lọc khác.
- Chọn quốc gia trong danh sách Country để giới hạn kết quả.
- Nhấn **Special Skill** để chỉ hiện nhân vật có tên skill tiếng Anh chứa `Secret Art:`. Nhấn lần nữa để tắt bộ lọc.
- Nhấn tiêu đề ID, Name hoặc một chỉ số để sắp xếp. Nhấn lại tiêu đề đang chọn để đảo chiều sắp xếp.
- Số lượng kết quả hiện tại được hiển thị cạnh các bộ lọc.
- Rê chuột lên một hàng để xem tooltip chỉ đọc gồm portrait, tên Anh/Nhật, ID, quốc gia, Special Skill và năm chỉ số dạng năm đoạn.
- Nhấn hàng nhân vật để mở cửa sổ chỉnh sửa trực tiếp.

## Chỉnh sửa chỉ số

Mỗi chỉ số có năm đoạn tương ứng với `2`, `4`, `6`, `8` và `10`:

- Nhấn một đoạn để đặt mức chỉ số tương ứng.
- Nhấn lại đoạn đang được chọn để đặt chỉ số về `0`.
- Giá trị chưa biết được hiển thị là `—` và được lưu dưới dạng `null`; `0` là một giá trị riêng.
- Nhấn **Save** để kiểm tra và lưu thay đổi. Giá trị hợp lệ là `null`, `0`, `2`, `4`, `6`, `8` hoặc `10`.
- Nhấn **Cancel**, nút `×`, vùng nền ngoài cửa sổ hoặc nhấn `Escape` để đóng và bỏ các thay đổi chưa lưu.

## Lưu trữ dữ liệu

Các chỉ số đã chỉnh sửa được lưu trong trình duyệt tại LocalStorage với khóa `sf3-character-database-v1`. Dữ liệu không được gửi lên máy chủ. Tệp `data/sf3_data.json` không bị ứng dụng ghi đè khi sử dụng bình thường.

Khi mở lần đầu, ứng dụng tải dữ liệu JSON và khởi tạo LocalStorage. Những lần mở sau, ứng dụng sử dụng dữ liệu đã lưu; metadata Special Skill còn thiếu trong dữ liệu LocalStorage cũ sẽ được bổ sung từ JSON nguồn.

Muốn xóa dữ liệu đã lưu và khởi tạo lại từ JSON, mở Developer Tools của trình duyệt, chọn Console và chạy:

```javascript
localStorage.removeItem('sf3-character-database-v1');
location.reload();
```

Thao tác này xóa các chỉ số đã chỉnh sửa đang lưu trong trình duyệt.

## Deploy Firebase Hosting

Dự án đã cấu hình deploy lên Firebase project `projn21-d2ab7` và Hosting site `projn21-d2ab7`. Đây là trang tĩnh nên deploy trực tiếp từ thư mục gốc, không cần bước build.

Cần chuẩn bị trước:

- Cài Node.js và Firebase CLI: `npm install -g firebase-tools`.
- Tạo Service Account key cho project `projn21-d2ab7`, rồi lưu tại `firebase/projn21-d2ab7-service-account.json`. Không commit hoặc đưa key này lên Hosting.
- Nếu muốn dùng đường dẫn key khác, đặt biến môi trường `FIREBASE_SERVICE_ACCOUNT_PATH` trước khi chạy script.

Sau đó chạy từ thư mục dự án:

```bash
./deploy.sh
```

Script kiểm tra Firebase CLI, cấu hình Hosting, Service Account và tệp `index.html` trước khi deploy. `firebase.json` chỉ đưa các tệp cần thiết cho trang web lên Hosting, không đưa tài liệu dự án hoặc thư mục chứa credentials lên site.