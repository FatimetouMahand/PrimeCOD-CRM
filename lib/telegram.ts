/**
 * Telegram notification helper — même méthode que l'ancienne app.
 * Envoie un message HTML à un agent via son telegramChatId.
 */
export async function sendTelegramMessage(chatId: string, message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("⚠️ [Telegram] TELEGRAM_BOT_TOKEN non défini — notifications désactivées");
    return { success: false, error: "Token not configured" };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  console.log(`📡 [Telegram] Envoi vers ChatId: ${chatId}`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" }),
    });

    const data = await response.json();

    if (!data.ok) {
      console.error("❌ [Telegram] Erreur API:", data);
      return { success: false, error: data.description || "Unknown Telegram error" };
    }

    console.log(`✅ [Telegram] Message livré au ChatId: ${chatId}`);
    return { success: true };
  } catch (error) {
    console.error("❌ [Telegram] Échec réseau:", error);
    return { success: false, error: "Network error" };
  }
}

/**
 * Notifie un agent qu'une nouvelle commande lui a été attribuée.
 * Message en arabe comme l'ancienne app.
 */
export async function notifyAgentNewOrder(agentName: string, chatId: string, orderNumber: number, productNames: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://prime-cod-crm.vercel.app";
  const message =
    `🔔 <b>تم تعيين طلب جديد</b>\n\n` +
    `<b>الطلب:</b> #${orderNumber}\n` +
    `<b>المنتج:</b> ${productNames}\n` +
    `<b>الوكيل:</b> ${agentName}\n\n` +
    `<a href="${appUrl}">👉 انقر هنا لفتح التطبيق</a>`;

  return sendTelegramMessage(chatId, message);
}
