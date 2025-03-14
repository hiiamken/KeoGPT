// messageUtils.js
function chunkString(str, chunkSize) {
  const chunks = [];
  let startIndex = 0;

  while (startIndex < str.length) {
    const chunk = str.slice(startIndex, startIndex + chunkSize);
    chunks.push(chunk);
    startIndex += chunkSize;
  }

  return chunks;
}

async function sendChunkedMessage(channel, content) {
  const chunkSize = 1900;

  const chunks = chunkString(content, chunkSize);

  for (const chunk of chunks) {
    await channel.send(chunk);
  }
}

module.exports = {
  chunkString,
  sendChunkedMessage,
};
