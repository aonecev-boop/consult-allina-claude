/**
 * Text-to-Speech через OpenAI TTS API
 */
export async function synthesizeSpeech(text, voice = 'nova') {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY не настроен');
  }

  // Ограничиваем длину текста (OpenAI TTS лимит 4096 символов)
  const truncated = text.slice(0, 4096);

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.TTS_MODEL || 'tts-1',
      input: truncated,
      voice: process.env.TTS_VOICE || voice, // nova — женский голос, подходит для АлИИны
      response_format: 'mp3',
      speed: 1.0
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `TTS API error: ${response.status}`);
  }

  return response;
}
