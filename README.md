<p align="center">
  <a href="https://github.com/hiiamken/keogpt">
    <img src="https://capsule-render.vercel.app/api?type=waving&height=300&color=gradient&text=KeoGPT-DiscordBot&fontSize=65&fontAlign=50&fontAlignY=30&animation=fadeIn&textBg=false&reversal=true&section=header" />
  </a>
</p>

<h1 align="center">✨ KeoGPT: The Intelligent Discord Assistant ✨</h1>

<p align="center">
  A versatile Discord AI assistant, powered by both <strong>Google's Gemini</strong> and <strong>OpenAI's ChatGPT</strong>, designed to bring intelligence, engagement, and seamless database integration to your community.
  <br />
  <a href="https://github.com/hiiamken/KeoGPT/issues">🐞 Report Bugs / 💡 Request Features</a>
</p>

---

## 🌟 Introduction

**KeoGPT** is a powerful and feature-rich Discord bot, meticulously crafted with Node.js and Discord.js. It seamlessly integrates the capabilities of both Google's Gemini and OpenAI's ChatGPT models, giving you the flexibility and resilience of a dual-AI system.  KeoGPT offers a comprehensive suite of features to enhance your Discord server:

- 🤖 **Dual-AI Power:**  Utilizes both Gemini and ChatGPT, with intelligent fallback to ChatGPT if Gemini reaches its daily token limit. This ensures continuous operation and cost-effectiveness.
- 🖼️ **Image Understanding:**  Leverages Gemini Pro Vision and GPT-4 Vision to answer questions about uploaded images.  Simply ask a question and attach an image!
- 💬 **Threaded Conversations:**  Automatically creates dedicated threads for each `/ask` command, keeping your main channels clean and organized.  Conversations are self-contained and easy to follow.
- 🗣️ **Contextual Replies:**  The `/reply` command allows for natural, ongoing conversations within threads, with the bot remembering previous messages.
- 🌐 **Extensive Multilingual Support:**  Communicates fluently in Vietnamese, English, Japanese, Korean, French, Spanish, German, Russian, Chinese (Simplified and Traditional), Arabic, Portuguese, Italian, Hindi, and Bengali.
- 🏆 **Gamification and Engagement:**  A points-based system rewards user interaction, fostering a more active and engaging community.  Leaderboards track monthly activity.
- 💡 **Helpful Suggestions:** Provides random command suggestions to users, encouraging exploration and discoverability.
- 🗑️ **Automated Thread Management:** Inactive threads are automatically deleted after a configurable period, reducing clutter.
- 💻 **Professional Formatting:**  Responses are beautifully formatted using Markdown, with proper code blocks for Python code (and syntax highlighting), and improved rendering of mathematical expressions.
- 💾 **Database Flexibility:**  Supports *both* **MySQL** and **SQLite** for data persistence, giving you a choice based on your server's needs and scale.

---

## 🙋‍♂️ A Word from the Creator

Hello! 👋 I'm **TKen**, the developer behind KeoGPT.  This bot was initially designed for the MineKeo Network Minecraft server, but I'm thrilled to share it with the wider Discord community.  Your feedback and suggestions are incredibly valuable, so please don't hesitate to connect with us on our Discord server: [MineKeo Network](https://discord.gg/minekeo).

Thank you for choosing KeoGPT! 💖

---

## 🔥 Commands & Features

| Command            | Description                                                                                                | Prefix Alternative |
| :----------------- | :--------------------------------------------------------------------------------------------------------- | :----------------- |
| `/ask`            | Ask a question, optionally with an image. The bot creates a new thread for the conversation.                   | `!ask`            |
| `/reply`          | Continue a conversation within an existing thread.                                                          | `!reply`          |
| `/new`            | Resets the current thread, clearing the conversation history and renaming the thread.                        | `!new`            |
| `/clear`          | Clears the thread conversation (creator/admin only).                                                          | `!clear`          |
| `/lang`           | Changes the bot's response language (e.g., `/lang en` for English).                                         | `!lang`           |
| `/stats`          | Displays your personal statistics and ranking.                                                               | `!stats`          |
| `/ranking-gpt`    | Shows the monthly leaderboard.                                                                             | `!ranking-gpt`    |
| `/gpthelp`        | Displays command help and information.                                                                    | `!gpthelp`        |
| `/cleardata`      | *Admin command* to manage user data (stats, threads, messages).                                             |                    |

---
## 🚀 Upcoming Features
- 📌 **Database Choice:** Support multiple databases (PostgreSQL, MongoDB for example).

- 📌 **Multiple AI Models:** Support more models like Claude, Perplexity, ...

- 🛠️ **Custom Commands:** Users can define personalized commands.
---

## 🛠️ Installation

### 📋 Requirements

-   [Node.js](https://nodejs.org) (version 18 or higher recommended)
-   A Discord Bot Token ([Discord Developer Portal](https://discord.com/developers/applications))
-   A Google Gemini API Key ([Google AI Studio](https://ai.google.dev/))
-   An OpenAI API Key ([OpenAI Platform](https://platform.openai.com/))
-   Either a MySQL database server (recommended for production) *or* SQLite (for local development/testing – no separate server needed).

### 🔧 Setup Steps

1.  **Clone the Repository:**

    ```bash
    git clone <YOUR_REPOSITORY_URL>
    cd <YOUR_REPOSITORY_NAME>
    ```

2.  **Install Dependencies:**

    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**

    *   Create a `.env` file by copying the provided `.env.example` file.
    *   Fill in the required values in your `.env` file, including:
        *   `DISCORD_TOKEN`: Your Discord bot token.
        *   `OPENAI_API_KEY`: Your OpenAI API key.
        *   `GOOGLE_API_KEY`: Your Google Gemini API key.
        *   `CLIENT_ID`: Your Discord bot's client ID.
        *   `GUILD_ID`: The ID of your Discord server (guild).
        *   `ALLOWED_CHANNEL_ID`: The ID of the channel where the bot will primarily operate.
        *    Database credentials (DB_HOST, DB_USER, etc. if using MySQL)
        *   `ADMIN_USER_ID`: Your Discord user ID (for admin commands).

4.  **Configure `config.js`:**

    *   Create a `config.js` file by copying `config.js.example`.
    *   Adjust the settings in `config.js` as needed, such as:
        *   `defaultLanguage`:  The bot's default language.
        *   `maxHistoryLength`:  The number of previous messages to include in the conversation context.
        *   `threadLifetimeDays`:  How long threads should remain active before automatic deletion.
        *   `prefix`:  The prefix for prefix commands (e.g., `!`).
        *   `supportedLanguages`:  The languages the bot supports.
        *   `databaseType`:  Set to either `"mysql"` or `"sqlite"`.
        * `chatgptModel`: "gpt-4-vision-preview" (if use image)
        *   `geminiModel`:  `"gemini-1.5-pro-002"` (or the latest 1.5 Pro version).
         *   `pointsPerInteraction`: Number of points to award per message
         *   `newThreadPoints`: Number of points awarded for new

5.  **Deploy Slash Commands:**

    ```bash
    node deploy-commands.js
    ```
    This registers the bot's slash commands with Discord.

6.  **Start the Bot:**

    ```bash
    node bot.js
    ```

---

## 🔗 Quick Links

*   ![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white) [Node.js](https://nodejs.org/)
*   ![Discord.js](https://img.shields.io/badge/Discord.js-7289DA?style=for-the-badge&logo=discord&logoColor=white) [Discord.js](https://discord.js.org/)
*   ![Google Cloud](https://img.shields.io/badge/Google_Cloud-4285F4?style=for-the-badge&logo=google-cloud&logoColor=white) [Google AI for Developers](https://ai.google.dev/)
*   ![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white) [OpenAI Platform](https://platform.openai.com/)
*   ![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white) [MySQL](https://www.mysql.com/)
*   ![SQLite](https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white) [SQLite](https://www.sqlite.org/index.html)
*   ![Knex.js](https://img.shields.io/badge/Knex.js-E34F26?style=for-the-badge&logo=knex&logoColor=white) [Knex.js](http://knexjs.org/)

---

## 🤝 Contributing

Contributions are welcome!  Feel free to submit issues or pull requests on the [GitHub repository](https://github.com/hiiamken/KeoGPT).

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">
  <a href="https://github.com/hiiamken/KeoGPT/stargazers"><img src="https://img.shields.io/github/stars/hiiamken/KeoGPT?style=social" alt="GitHub stars"></a>
  <a href="https://github.com/hiiamken/KeoGPT/fork"><img src="https://img.shields.io/github/forks/hiiamken/KeoGPT?style=social" alt="GitHub forks"></a>
  <a href="https://github.com/hiiamken/KeoGPT/issues"><img src="https://img.shields.io/github/issues/hiiamken/KeoGPT?color=important" alt="GitHub issues"></a>
 <a href="https://github.com/hiiamken/KeoGPT/blob/main/LICENSE"><img src="https://img.shields.io/github/license/hiiamken/KeoGPT" alt="License"></a>
</p>

<p align="center">
  <a href="discord.gg/minekeo"><img src="https://img.shields.io/discord/1096684955045728328?label=Discord&logo=discord&style=flat-square" alt="Discord Server"></a>
    </p>

<p align="center">
  Built with ❤️ by <a href="https://github.com/hiiamken">TKen</a>.
</p>