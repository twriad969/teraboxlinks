const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');

const BOT_TOKEN = '6878959816:AAEYkRBK5jBQ9HrRllEoMzI0dQBmKLSW3K8';
const DATA_FILE = 'data.json';

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

let userData = {};
if (fs.existsSync(DATA_FILE)) {
  userData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

const saveUserData = () => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(userData, null, 2));
};

const extractUrls = (text) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex);
};

const shortenUrl = async (url, apiKey) => {
  try {
    const response = await axios.get(`https://teraboxbd.com/api?api=${apiKey}&url=${encodeURIComponent(url)}`);
    const data = response.data;
    if (data.status === 'success') {
      return data.shortenedUrl;
    }
  } catch (error) {
    console.error('Error shortening URL:', error);
  }
  return url;
};

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text || msg.caption;

  if (text && text.startsWith('/')) return;

  if (!userData[userId] || !userData[userId].apiKey) {
    bot.sendMessage(chatId, 'Please set your API key first using /api command.');
    return;
  }

  const urls = extractUrls(text);

  if (userData[userId].etext && urls) {
    const finalUrls = await Promise.all(urls.map(async (url) => {
      if (url.includes('t.me') && userData[userId].channelUrl) {
        return userData[userId].channelUrl;
      } else {
        return await shortenUrl(url, userData[userId].apiKey);
      }
    }));

    let finalText = finalUrls.map((url, index) => `v${index + 1}: ${url}`).join('\n\n');

    if (userData[userId].headerText) {
      finalText = `${userData[userId].headerText}\n\n${finalText}`;
    }
    if (userData[userId].footerText) {
      finalText = `${finalText}\n\n${userData[userId].footerText}`;
    }

    if (msg.photo) {
      bot.sendPhoto(chatId, msg.photo[msg.photo.length - 1].file_id, { caption: finalText });
    } else {
      bot.sendMessage(chatId, finalText);
    }

  } else if (urls) {
    const finalUrls = await Promise.all(urls.map(async (url) => {
      if (url.includes('t.me') && userData[userId].channelUrl) {
        return userData[userId].channelUrl;
      } else {
        return await shortenUrl(url, userData[userId].apiKey);
      }
    }));

    let finalText = text;
    urls.forEach((url, index) => {
      finalText = finalText.replace(url, finalUrls[index]);
    });

    if (userData[userId].headerText) {
      finalText = `${userData[userId].headerText}\n\n${finalText}`;
    }

    if (userData[userId].footerText) {
      finalText = `${finalText}\n\n${userData[userId].footerText}`;
    }

    if (msg.photo) {
      bot.sendPhoto(chatId, msg.photo[msg.photo.length - 1].file_id, { caption: finalText });
    } else {
      bot.sendMessage(chatId, finalText);
    }
  } else {
    bot.sendMessage(chatId, 'No URLs found to shorten or replace.');
  }
});

bot.onText(/\/etext/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!userData[userId]) {
    userData[userId] = {};
  }
  userData[userId].etext = !userData[userId].etext;
  saveUserData();

  bot.sendMessage(chatId, `Enhanced text mode ${userData[userId].etext ? 'enabled' : 'disabled'}.`);
});

bot.onText(/\/header/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  bot.sendMessage(chatId, 'Please enter your header text:').then(() => {
    bot.once('message', (headerMsg) => {
      const headerText = headerMsg.text;
      if (!userData[userId]) {
        userData[userId] = {};
      }
      userData[userId].headerText = headerText;
      saveUserData();
      bot.sendMessage(chatId, `Header text set to:\n\n${headerText}`);
    });
  });
});

bot.onText(/\/footer/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  bot.sendMessage(chatId, 'Please enter your footer text:').then(() => {
    bot.once('message', (footerMsg) => {
      const footerText = footerMsg.text;
      if (!userData[userId]) {
        userData[userId] = {};
      }
      userData[userId].footerText = footerText;
      saveUserData();
      bot.sendMessage(chatId, `Footer text set to:\n\n${footerText}`);
    });
  });
});

bot.onText(/\/channel/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  bot.sendMessage(chatId, 'Please enter your channel URL or addlist URL:').then(() => {
    bot.once('message', (channelMsg) => {
      const channelUrl = channelMsg.text;
      if (channelUrl.startsWith('https://t.me/')) {
        if (!userData[userId]) {
          userData[userId] = {};
        }
        userData[userId].channelUrl = channelUrl;
        saveUserData();
        bot.sendMessage(chatId, `Channel URL set to: ${channelUrl}`);
      } else {
        bot.sendMessage(chatId, 'Invalid URL. Please provide a valid Telegram channel or addlist URL.');
      }
    });
  });
});

bot.onText(/\/rc/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (userData[userId] && userData[userId].channelUrl) {
    delete userData[userId].channelUrl;
    saveUserData();
    bot.sendMessage(chatId, 'Channel URL removed.');
  } else {
    bot.sendMessage(chatId, 'No channel URL to remove.');
  }
});

bot.onText(/\/api (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const apiKey = match[1];

  if (!userData[userId]) {
    userData[userId] = {};
  }
  userData[userId].apiKey = apiKey;
  saveUserData();
  bot.sendMessage(chatId, 'API key saved successfully.');
});

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcomeMessage = `
Welcome to the URL Shortener Bot! 🚀

This bot helps you shorten URLs, manage headers and footers, and much more!

Here are some things you can do:
1. Set your API key using /api <your_api_key>.
2. Set your channel or addlist URL using /channel.
3. Toggle enhanced text mode with /etext.
4. Set a custom header with /header.
5. Set a custom footer with /footer.
6. Remove channel URL with /rc.
7. Type /help to see all available commands.

Let's get started!
  `;
  bot.sendMessage(chatId, welcomeMessage);
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpMessage = `
Here are the available commands:

1. /api <your_api_key> - Set your TeraBoxBD API key.
2. /channel - Set your channel or addlist URL for Telegram links.
3. /etext - Toggle enhanced text mode. If enabled, captions with changed links will be sent.
4. /header - Set a custom header text for your messages.
5. /footer - Set a custom footer text for your messages.
6. /rc - Remove your previously set channel URL.
7. /help - Display this help message.
  `;
  bot.sendMessage(chatId, helpMessage);
});
