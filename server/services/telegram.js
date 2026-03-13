const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:3000/admin';

export async function notifyManager(clientData, sessionId) {
  // Telegram
  const sent = await sendTelegram(clientData, sessionId);

  // Email fallback
  if (!sent && process.env.NOTIFY_EMAIL) {
    await sendEmailFallback(clientData, sessionId);
  }

  return sent;
}

async function sendTelegram(clientData, sessionId) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) return false;

  const text = `🔔 <b>Новая заявка от АлИИны!</b>

👤 Имя: ${clientData.Client_name || 'не указано'}
🪑 Мебель: ${clientData.Mebel_name || 'не указано'}
📏 Размер: ${clientData.Dlina || 'не указано'}
💰 Ориентир. цена: ${clientData.Orientir_price || 'не рассчитано'}
🏙 Город: ${clientData.Gorod || 'не указано'}
📍 Улица: ${clientData.Ylitsa || 'не указано'}
📞 Телефон: ${clientData.Telefon || 'не указано'}
🕐 Удобное время: ${clientData.Vremya_client || 'не указано'}
📎 Проект: ${clientData.Client_Project ? 'Да' : 'Нет'}

🆔 Сессия: <code>${sessionId}</code>
🔗 <a href="${ADMIN_URL}">Открыть в админке</a>`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('Telegram API error:', err);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Telegram notify error:', err.message);
    return false;
  }
}

async function sendEmailFallback(clientData, sessionId) {
  // Простой fallback — логирование (можно заменить на nodemailer)
  console.log('=== EMAIL FALLBACK ===');
  console.log(`Заявка от ${clientData.Client_name || 'аноним'}`);
  console.log(`Мебель: ${clientData.Mebel_name}, Цена: ${clientData.Orientir_price}`);
  console.log(`Телефон: ${clientData.Telefon}, Город: ${clientData.Gorod}`);
  console.log(`Сессия: ${sessionId}`);
  console.log('=== /EMAIL FALLBACK ===');
}
