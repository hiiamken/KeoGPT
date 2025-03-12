<p align="center">
  <a href="https://github.com/hiiamken/keogpt">
    <img src="https://capsule-render.vercel.app/api?type=waving&height=300&color=gradient&text=KeoGPT-nl-DiscordBot&fontSize=65&fontAlign=50&fontAlignY=30&animation=fadeIn&textBg=false&reversal=true&section=header" />
  </a>
</p>

<h1 align="center">KeoGPT v1.1.0</h1>

<p align="center">
  A versatile Discord AI assistant, powered by Google's Gemini.
  <br />
  <br />
  <a href="https://github.com/hiiamken/KeoGPT-DiscordBot/issues">Report bugs or suggest features</a>
</p>

## ✨ Introduction

**KeoGPT** is a Discord bot built on Node.js and Discord.js, integrated with Google's Gemini language model. It provides useful and fun features for your Discord community, including:

*   🤖 Intelligent question answering on a wide range of topics.
*   🖼️ Image analysis and question answering related to images you send.
*   💬 Separate threads for each question, keeping the main chat channel clean.
*   🗣️ Continued conversation within threads using the `/reply` command.
*   🌐 Support for multiple languages (Vietnamese, English, Japanese, Korean, French, Spanish, German, Russian, Chinese, Arabic, Portuguese, Italian, Hindi, Bengali).
*   🏆 A points system and monthly leaderboard to encourage interaction and competition.
*   ✨ Command suggestions to help new users.
*   🗑️ Automatic thread deletion for inactive threads.
*   💻 Beautifully formatted code responses.

## 🙋‍♂️ TKen's Note

Xin chào tất cả các bạn! 👋

Mình là TKen, người đã tạo ra KeoGPT.  Mình rất vui khi các bạn quan tâm đến dự án này.  KeoGPT là một dự án mình làm riêng cho server Minecraft của mình (MineKeo Network) nhưng mình muốn public với mong muốn mang đến một công cụ hữu ích và thú vị cho cộng đồng Discord Việt Nam.

Mình đã dành rất nhiều thời gian và tâm huyết để phát triển KeoGPT, và mình hy vọng nó sẽ giúp ích cho các bạn trong việc tìm kiếm thông tin, giải đáp thắc mắc, và tạo ra những cuộc trò chuyện vui vẻ.

Nếu các bạn có bất kỳ câu hỏi, góp ý, hoặc báo lỗi nào, đừng ngần ngại liên hệ với mình bằng cách tạo ticket tại Discord của [MineKeo Network](https://discord.gg/minekeo) nhé.  Mình luôn sẵn lòng lắng nghe và cải thiện bot!

Cảm ơn các bạn đã sử dụng KeoGPT! ❤️

## 🔥 Features

| Command                | Description                                                                                       | Prefix Command |
| ---------------------- | ------------------------------------------------------------------------------------------------- | -------------- |
| `/ask`                | Ask the bot a question. The bot will create a new thread to answer.                               | `!ask`         |
| `/reply`              | Continue the conversation within the current thread.                                                 | `!reply`        |
| `/new`                | Start a new topic within the thread (clears previous conversation history).                      | `!new`          |
| `/clear`              | Clear the conversation history in the thread (only for thread creator or admin).                  | `!clear`        |
| `/lang`               | Change the bot's response language (e.g., `/lang en` for English).                                  | `!lang`        |
| `/stats`              | View your personal statistics (number of threads, total points, this month's points, ranking).       | `!stats`        |
| `/ranking-gpt`        | View the monthly leaderboard of users' points.                                                      | `!ranking-gpt`  |
| `/gpthelp`             | Display this help message.                                                                         | `!gpthelp`     |
| `/cleardata user <user>` | Deletes all threads and chat history of the specified user (admin only).          |                |
|`/cleardata all data`| Deletes all threads and chat history  (admin only).                        |                |
|`/cleardata all stats`| Resets the points of all users.(admin only)                                                    |                |
|`/cleardata user <user> data`| Deletes data of specified user (admin only)                                              |                  |
|`/cleardata user <user> stats`| Deletes stats of specified user (admin only)                                                  |                  |

## 🚀 Upcoming Features

*   **Support for Multiple AI Models:**  Allow users to choose between Gemini, GPT-3, Claude, and other AI models.
*   **Customizable Prompts:**  Let users customize the system prompt to control the bot's tone and style.
*   **Integration with Other Services:** Connect to Google Search, Wikipedia, Wolfram Alpha, and more.
*   **Custom Commands:**  Enable users to create their own simple commands.
*   **More Detailed Statistics:** Track statistics by day/week, display charts, etc.
*   **Reward/Penalty System:**  Reward points for good answers, penalize inappropriate behavior.
*   **Game Mode:**  Add mini-games, quizzes, and other interactive elements.
*   **Voice Support:** Allow users to ask questions using voice input.

## 🔧 Installation

### Requirements

*   **Node.js:** Version 18 or higher (latest LTS recommended). Download at [https://nodejs.org/](https://nodejs.org/).
*   **npm:** (Node Package Manager) - usually installed with Node.js.
*   **Discord Developer Account:** To create a bot and get a token. Go to [https://discord.com/developers/applications](https://discord.com/developers/applications).
*   **Google Cloud Account:** To use the Gemini API (requires an API key). Go to [https://ai.google.dev/](https://ai.google.dev/).
*   **MySQL Database:** To store data (threads, messages, points, ...).

### Steps

1.  **Clone the repository:**

    ```bash
    git clone <YOUR_REPOSITORY_URL>
    cd <YOUR_REPOSITORY_NAME>
    ```

    Replace `<YOUR_REPOSITORY_URL>` and `<YOUR_REPOSITORY_NAME>` with your information.

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Configuration:**

    *   Create a `.env` file in the root directory of the project, based on the `.env.example` file, and fill in the required information (Discord token, Google API key, database information, ...). *Never commit the .env file.*
    *   Create a `config.js` file in the root directory , copy content from `config.js.example` and fill in the required information. *Do not commit the `config.js` file.*

4.  **Deploy slash commands:**

    ```bash
    node deploy-commands.js
    ```

    You only need to run this command once (or when you add/modify/delete slash commands).

5.  **Run the bot:**

    ```bash
    node bot.js
    ```

## 🔗 Quick Links

*   ![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white) [Node.js](https://nodejs.org/en/download/)
*   ![Discord.js](https://img.shields.io/badge/Discord.js-7289DA?style=for-the-badge&logo=discord&logoColor=white) [Discord.js](https://discord.js.org/#/)
*   ![Google Cloud](https://img.shields.io/badge/Google_Cloud-4285F4?style=for-the-badge&logo=google-cloud&logoColor=white) [Google Cloud](https://cloud.google.com/)
*   ![MySQL](https://img.shields.io/badge/MySQL-00000F?style=for-the-badge&logo=mysql&logoColor=white)
*   ![SQLite](https://www.sqlite.org/)

## 🤝 Contributing

If you'd like to contribute to the project, please create a new [issue](https://github.com/hiiamken/KeoGPT-DiscordBot/issues) or submit a [pull request](https://github.com/hiiamken/KeoGPT-DiscordBot/pulls). All contributions are welcome!

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Code by TKen**