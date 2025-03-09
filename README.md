<center><img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&height=200&section=header&text=KeoGPT&fontSize=80&fontAlignY=35&animation=twinkling&fontColor=gradient" /></center>

<h1 align="center">KeoGPT v1.0.0</h1>

<p align="center">
  Trợ lý Discord AI đa năng, sử dụng sức mạnh của Gemini.
  <br />
  <br />
  <a href="https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPOSITORY_NAME/issues">Báo cáo lỗi hoặc đóng góp ý kiến</a>
</p>

## ✨ Giới thiệu

KeoGPT là một bot Discord được xây dựng trên nền tảng Node.js và sử dụng thư viện Discord.js, được tích hợp với mô hình ngôn ngữ Gemini của Google. Bot cung cấp các tính năng hữu ích và thú vị cho cộng đồng Discord của bạn, bao gồm:

*   **Hỏi đáp thông minh:** Trả lời các câu hỏi về nhiều chủ đề khác nhau.
*   **Hỗ trợ đa ngôn ngữ:** Có thể giao tiếp bằng nhiều ngôn ngữ phổ biến.
*   **Xử lý ảnh:** Phân tích và trả lời các câu hỏi liên quan đến hình ảnh.
*   **Định dạng code:** Hiển thị code một cách đẹp mắt và dễ đọc.
*   **Quản lý thread:** Tự động tạo thread cho mỗi câu hỏi, giúp giữ cho kênh chat gọn gàng.
*   **Hệ thống điểm và bảng xếp hạng:** Tăng tính tương tác và cạnh tranh giữa các thành viên.
*   **Gợi ý lệnh:** Tự động gợi ý lệnh cho người dùng.
*  **Tự động xoá thread:** Các thread không hoạt động sẽ tự động được xóa sau 2 ngày

## 🔥 Tính năng

*   **Hỏi đáp (Ask):** Đặt câu hỏi cho bot bằng lệnh `/ask` hoặc `!ask`.
*   **Trả lời (Reply):** Tiếp tục cuộc trò chuyện trong thread bằng lệnh `/reply` hoặc `!reply`.
*   **Chủ đề mới (New):** Bắt đầu một chủ đề mới bằng lệnh `/new` hoặc `!new` (trong thread).
*   **Xóa lịch sử (Clear):** Xóa lịch sử trò chuyện trong thread (chỉ người tạo thread hoặc admin).
*   **Thay đổi ngôn ngữ (Lang):** Thay đổi ngôn ngữ trả lời của bot bằng lệnh `/lang` hoặc `!lang`.
*   **Thống kê (Stats):** Xem thống kê cá nhân (số thread, điểm) bằng lệnh `/stats`.
*   **Bảng xếp hạng (Ranking):** Xem bảng xếp hạng điểm số hàng tháng bằng lệnh `/ranking-gpt`.
*   **Trợ giúp (Help):** Xem hướng dẫn sử dụng bot bằng lệnh `/gpthelp` hoặc `!gpthelp`.
*   **Xoá toàn bộ dữ liệu (Cleardata):** Dành cho Admin, xóa toàn bộ thread và lịch sử chat

## 🔧 Cài đặt

Trước khi bắt đầu, hãy đảm bảo bạn đã cài đặt:

*   ![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white) [v22.14.0 hoặc mới hơn](https://nodejs.org/en/download/)
*   Một tài khoản [Discord Developer Portal](https://discord.com/developers/applications) để tạo bot.
*   Một tài khoản [Google Cloud](https://console.cloud.google.com/) và đã bật [API Gemini](https://ai.google.dev/tutorials/setup)
*   Một cơ sở dữ liệu MySQL

**Các bước cài đặt:**

1.  **Clone repository:**

    ```bash
    git clone <YOUR_REPOSITORY_URL>
    cd <YOUR_REPOSITORY_NAME>
    ```
2.  **Cài đặt dependencies:**

    ```bash
    npm install
    ```

3.  **Tạo file `.env`:** Tạo một file tên là `.env` trong thư mục gốc của project, và điền các thông tin sau (thay thế các giá trị mẫu bằng giá trị thật của bạn):

    ```
    DISCORD_TOKEN=YOUR_DISCORD_BOT_TOKEN
    GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY
    CLIENT_ID=YOUR_DISCORD_CLIENT_ID
    GUILD_ID=YOUR_DISCORD_GUILD_ID
    ALLOWED_CHANNEL_ID=YOUR_ALLOWED_CHANNEL_ID

    DB_HOST=your_database_host
    DB_USER=your_database_user
    DB_PASSWORD=your_database_password
    DB_NAME=your_database_name

    ADMIN_USER_ID=your_discord_user_id
    ```
    **Quan Trọng:** Không commit file .env

4.  **Tạo file `config.js`:** Tạo file `config.js` và copy nội dung từ file `config.js.example` và điền các thông tin của bạn.
5.  **Chạy file `deploy-commands.js`:**

    ```bash
    node deploy-commands.js
    ```

    Lệnh này sẽ đăng ký các slash commands lên Discord.  Bạn chỉ cần chạy lệnh này một lần (hoặc khi bạn thêm/sửa/xóa slash commands).

6.  **Chạy bot:**

    ```bash
    node bot.js
    ```

## 🔗 Liên kết nhanh

*   ![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white) [Node.js](https://nodejs.org/en/download/)
*   ![Discord.js](https://img.shields.io/badge/Discord.js-7289DA?style=for-the-badge&logo=discord&logoColor=white) [Discord.js](https://discord.js.org/#/)
*   ![Google Cloud](https://img.shields.io/badge/Google_Cloud-4285F4?style=for-the-badge&logo=google-cloud&logoColor=white) [Google Cloud](https://cloud.google.com/)
*   ![MySQL](https://img.shields.io/badge/MySQL-00000F?style=for-the-badge&logo=mysql&logoColor=white)

## 🤝 Đóng góp

Nếu bạn muốn đóng góp cho dự án, xin vui lòng tạo một [issue](https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPOSITORY_NAME/issues) mới hoặc gửi một [pull request](https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPOSITORY_NAME/pulls).

## 📝 Giấy phép

Dự án này được cấp phép theo giấy phép MIT - xem file [LICENSE](LICENSE) để biết thêm chi tiết.