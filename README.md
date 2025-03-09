<center>
<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&height=200&section=header&text=KeoGPT&fontSize=80&fontAlignY=35&animation=twinkling&fontColor=gradient" />
</center>

# KeoGPT - Trợ lý AI trên Discord 🤖💬

[![Node.js](https://img.shields.io/badge/Node.js-v22+-green.svg?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Discord.js](https://img.shields.io/badge/Discord.js-v14+-blue.svg?style=for-the-badge&logo=discord)](https://discord.js.org/)
[![Gemini API](https://img.shields.io/badge/Gemini%20API-yellow.svg?style=for-the-badge&logo=google-cloud)](https://ai.google.dev/)
[![MySQL](https://img.shields.io/badge/MySQL-blue.svg?style=for-the-badge&logo=mysql)](https://www.mysql.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

**KeoGPT** là một bot Discord đa năng, tích hợp trí tuệ nhân tạo Gemini của Google, mang đến trải nghiệm hỏi đáp thông minh và thú vị cho server của bạn!

## ✨ Tính năng nổi bật

*   **Hỏi đáp thông minh:** Sử dụng sức mạnh của Gemini AI để trả lời các câu hỏi phức tạp.
*   **Hỗ trợ đa ngôn ngữ:** Giao tiếp với bot bằng nhiều ngôn ngữ khác nhau! (Tiếng Việt, Anh, Nhật, Hàn, Pháp, Tây Ban Nha, Đức, Nga, Trung, Ả Rập, Bồ Đào Nha, Ý, Hindi, Bengali).
*   **Xử lý ảnh:** Đặt câu hỏi liên quan đến hình ảnh mà bạn gửi.
*   **Định dạng code:** Nhận câu trả lời chứa code được định dạng đẹp mắt, dễ đọc.
*   **Quản lý thread:** Tự động tạo thread riêng cho từng câu hỏi, giúp kênh chat gọn gàng.
*   **Hệ thống điểm và bảng xếp hạng:** Tăng tính tương tác và cạnh tranh giữa các thành viên.
*   **Gợi ý lệnh:** Giúp người dùng mới làm quen với các lệnh của bot.
*   **Tự động xóa thread:** Các thread không hoạt động sẽ tự động được lưu trữ sau một thời gian.
* **Chế độ trả lời:** Cho phép người dùng lựa chọn giữa trả lời "Đơn giản" và "Chuyên nghiệp"

## 🚀 Cài đặt

### Yêu cầu

*   **Node.js:** Phiên bản 18 trở lên (khuyên dùng bản LTS mới nhất).
*   **npm:** (Node Package Manager) - thường được cài đặt cùng với Node.js.
*   **Tài khoản Discord Developer:** Để tạo bot và lấy token.
*   **Tài khoản Google Cloud:** Để sử dụng Gemini API (cần có API key).
*   **MySQL Database:** Để lưu trữ dữ liệu (thread, tin nhắn, điểm, ...).

### Các bước cài đặt

1.  **Clone repository:**

    ```bash
    git clone <YOUR_REPOSITORY_URL>
    cd <YOUR_REPOSITORY_NAME>
    ```
     (Thay thế `<YOUR_REPOSITORY_URL>` và `<YOUR_REPOSITORY_NAME>` bằng thông tin của bạn)

2.  **Cài đặt dependencies:**

    ```bash
    npm install
    ```

3.  **Cấu hình:**

    *   Tạo một file `.env` trong thư mục gốc của project, dựa theo file `.env.example` và điền các thông tin cần thiết (Discord token, Google API key, thông tin database, ...).
    *   Tạo một file `config.js` trong thư mục gốc, copy nội dung từ `config.js.example` và điền các thông tin cần thiết.
    **Quan trọng:**  Tuyệt đối không commit file `.env` và `config.js` lên GitHub!

4.  **Deploy slash commands:**

    ```bash
    node deploy-commands.js
    ```
    (Chỉ cần chạy lệnh này một lần, hoặc khi bạn thay đổi cấu trúc của slash commands).

5.  **Chạy bot:**

    ```bash
    node bot.js
    ```

## 🤖 Sử dụng

KeoGPT hỗ trợ cả slash commands (bắt đầu bằng `/`) và prefix commands (bắt đầu bằng `!`).

| Lệnh             | Chức năng                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| `/ask` `!ask`     | Đặt câu hỏi cho bot.  Bot sẽ tạo một thread mới để trả lời.                                                    |
| `/reply` `!reply` | Tiếp tục trò chuyện trong thread hiện tại.                                                                        |
| `/new` `!new`     | Bắt đầu một chủ đề mới trong thread hiện tại (xóa lịch sử trò chuyện cũ).                                     |
| `/clear` `!clear`  | Xóa lịch sử trò chuyện trong thread (chỉ dành cho người tạo thread và admin).                                  |
| `/lang` `!lang`   | Đổi ngôn ngữ trả lời của bot (ví dụ: `/lang en` để chuyển sang tiếng Anh).                                |
| `/stats`         | Xem thống kê cá nhân (số thread đã tạo, tổng điểm, điểm tháng này, thứ hạng).                                    |
| `/ranking-gpt`   | Xem bảng xếp hạng điểm của các thành viên trong tháng.                                                          |
| `/gpthelp` `!gpthelp`      | Hiển thị hướng dẫn sử dụng.                                                                               |
| `/cleardata user <user> <data/stats>`| Xoá dữ liệu của user, data bao gồm các thread đã tạo, stats bao gồm điểm (dành cho admin)
| `/cleardata all <data/stats>`| Xoá hết dữ liệu của người dùng hoặc toàn bộ data, stats (dành cho admin)

**Lưu ý:**

*   Bot chỉ hoạt động trong kênh Discord mà bạn đã cấu hình (trong file `config.js`).
*   Bot sẽ tự động xóa các thread không hoạt động sau một khoảng thời gian nhất định (cấu hình trong `config.js`).

## 🤝 Đóng góp

Nếu bạn muốn đóng góp cho dự án, xin vui lòng tạo một [issue](https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPOSITORY_NAME/issues) mới hoặc gửi một [pull request](https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPOSITORY_NAME/pulls).  Chúng tôi rất hoan nghênh mọi sự đóng góp!

## 📄 Giấy phép

Dự án này được cấp phép theo giấy phép MIT.  Xem file [LICENSE](LICENSE) để biết thêm chi tiết.

---

**Code by TKen**