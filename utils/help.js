// utils/help.js
const config = require("../config");

function getRandomLoadingMessage() {
  const loadingMessages = [
    `${config.loadingEmoji} Để xem nào...`,
    `${config.loadingEmoji} Hmm, câu hỏi hay đó, đợi chút nhé...`,
    `${config.loadingEmoji} Đang vắt óc suy nghĩ...`,
    `${config.loadingEmoji} Đang lật tung sách vở tìm câu trả lời...`,
    `${config.loadingEmoji} Hỏi anh Google tí đã...`,
    `${config.loadingEmoji} Đợi xíu, đang bận "hack" NASA tìm đáp án...`,
    `${config.loadingEmoji} Bình tĩnh, bình tĩnh... đáp án sắp ra lò rồi!`,
    `${config.loadingEmoji} Đang pha trà, nhâm nhi và tìm câu trả lời...`,
    `${config.loadingEmoji} A! Có ngay đây, đợi xíu...`,
    `${config.loadingEmoji} Đang kết nối với vũ trụ tri thức...`,
  ];
  return loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
}

const helpSuggestions = [
  "Có vẻ bạn đang bối rối. 🤔  Hãy thử `!gpthelp` xem sao!",
  "Bạn cần giúp đỡ?   `!gpthelp` là bạn của bạn!",
  "Lạc lối rồi hả?   Để tôi chỉ đường cho, gõ `!gpthelp` nhé!",
  "Ê! Hình như có lệnh `!gpthelp` thần thánh lắm đó.  Thử xem!",
  "Đừng lo, `!gpthelp` sẽ giải cứu bạn khỏi mớ bòng bong này!",
  "`!gpthelp` đi, ngại gì! 😉",
  "Hỡi người dùng lạc lối, `!gpthelp` sẽ dẫn lối cho bạn! ✨",
  "Bot xịn không tự nhiên sinh ra, `!gpthelp` nha bạn ơi!",
  "Đang vò đầu bứt tai hả?   `!gpthelp` có bí kíp đó!",
  "Muốn trở thành cao thủ Discord?   `!gpthelp` là bước đầu tiên!",
  "Alo alo, `!gpthelp` nghe rõ trả lời!",
  "Nghe đồn `!gpthelp` có thể giải quyết mọi vấn đề.  Thử xem sao!",
  "Đừng ngại, cứ `!gpthelp` mà gõ, có gì khó để bot lo!",
];

function getRandomHelpSuggestion() {
  return helpSuggestions[Math.floor(Math.random() * helpSuggestions.length)];
}

const afterReplySuggestions = [
  'Xong rồi đó! Còn thắc mắc gì về "**THREADNAME**" không nè? Cứ `/reply <câu hỏi>` hoặc `!reply <câu hỏi>` để tiếp tục, hoặc `/clear` rồi `/new <câu hỏi>` (hay `!new <câu hỏi>`) để hỏi về một vấn đề khác nha! 😉',
  "Đây là câu trả lời siêu xịn từ KeoGPT! Về \"**THREADNAME**\", bạn cứ `/reply` hoặc `!reply` để hỏi thêm, còn nếu muốn 'đổi gió' thì `/clear` trước rồi `/new` hoặc `!new` câu hỏi mới toanh nhé. 😊",
  "KeoGPT đã 'ra tay', vấn đề \"**THREADNAME**\" đã được giải quyết! `/reply`, `!reply` để hỏi tiếp, hoặc `/clear` và `/new` (hay `!new`) để 'khai trương' chủ đề mới nha bạn ơi. 😎",
  'Hi vọng câu trả lời này hữu ích. Về "**THREADNAME**" cứ réo KeoGPT bằng `/reply` hoặc `!reply` nha! Còn không thì `/clear` rồi `/new` hoặc `!new` để qua chuyện khác nè. 😉',
  "Đó là tất cả những gì tớ biết về \"**THREADNAME**\"! `/reply` hoặc `!reply` để vặn vẹo tớ tiếp, còn không thì `/clear` rồi `/new` (hoặc !new) xem tớ 'xử' được bao nhiêu câu hỏi nè. 🤓",
  "Câu trả lời 'chất như nước cất' cho \"**THREADNAME**\" luôn! `/reply` hoặc `!reply` để 'chất vấn' thêm, hoặc `/clear` rồi `/new` (hay `!new`) cho tớ thử thách mới nha. 😏",
  "KeoGPT đã hoàn thành nhiệm vụ với \"**THREADNAME**\"! `/reply` hoặc `!reply` để làm 'trùm cuối', còn không thì `/clear` rồi `/new` hoặc `!new` cho chủ đề tiếp theo nhé. 🤔",
  "Bạn thấy câu trả lời về \"**THREADNAME**\" thế nào? Có làm bạn 'lóa mắt' không? 🤩 `/reply` hoặc `!reply` để hỏi tiếp, `/clear` rồi `/new` hoặc `!new` để qua vòng mới đê!",
  "Nghe đồn là bạn còn nhiều câu hỏi lắm. Về \"**THREADNAME**\" thì cứ `/reply` hoặc `!reply` nha, còn muốn 'đánh úp' thì `/clear` trước rồi `/new` (hay `!new`) bất cứ lúc nào. 😉",
  'Hỏi một câu về "**THREADNAME**", biết thêm một điều. Cứ `/reply` hoặc `!reply` nhé! Còn muốn hỏi nhiều điều hơn thì `/clear` rồi `/new` hoặc `!new` để KeoGPT trổ tài tiếp nè! 😊',
  "Hài lòng chưa, hài lòng chưa? KeoGPT xứng đáng 10 điểm với câu trả lời về \"**THREADNAME**\" nha! 😜 `/reply` hoặc `!reply` để 'thách đấu' tiếp, hoặc `/clear` rồi `/new` (hay `!new`) để 'lên level' nào! (Hỏi tiếp đi!)",
  "Tớ là KeoGPT, không ngại trả lời về \"**THREADNAME**\", chỉ cần bạn `/reply` hoặc `!reply` thôi! Còn muốn 'thử lửa' thì `/clear` rồi `/new` hoặc `!new` nha. 😎",
];

function getRandomReplySuggestion(threadName) {
  const suggestion =
    afterReplySuggestions[
      Math.floor(Math.random() * afterReplySuggestions.length)
    ];
  return suggestion.replace("THREADNAME", threadName);
}
// *****

module.exports = {
  getRandomHelpSuggestion,
  getRandomLoadingMessage,
  getRandomReplySuggestion,
};
