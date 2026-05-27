# hocluatcungcrush

Trang ôn trắc nghiệm Luật Hình sự có phân tích điểm yếu, lưu tiến độ cục bộ và bảng xếp hạng Firebase.

## ChatGPT phân tích điểm yếu

`index.html` đã có `AI_INSIGHT_ENDPOINT`. Khi biến này rỗng, trang vẫn dùng phân tích nhanh trên máy. Khi có URL Firebase Function `analyzeWeakness`, trang sẽ gửi dữ liệu bài làm đã nộp để ChatGPT phân tích:

- tổng quan điểm mạnh/yếu;
- chủ đề cần ôn trước;
- các câu sai/bỏ trống đáng chú ý;
- lộ trình ôn tập 3-5 bước.

API key OpenAI không được đặt trong `index.html`. Function đọc key từ secret `OPENAI_API_KEY` trên server.

## File backend mẫu

- `functions/index.js`: Firebase HTTP Function gọi OpenAI Responses API bằng Structured Outputs.
- `functions/package.json`: dependency cho Firebase Functions.
- `firebase.json`: khai báo thư mục functions.

Sau khi deploy function, điền URL vào `AI_INSIGHT_ENDPOINT` trong `index.html`.
