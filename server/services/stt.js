/**
 * Speech-to-Text через OpenAI Whisper API
 */
export async function transcribeAudio(audioBuffer, mimetype = 'audio/webm') {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY не настроен');
  }

  // Определяем расширение по MIME-типу
  const extMap = {
    'audio/webm': 'webm',
    'audio/wav': 'wav',
    'audio/mp3': 'mp3',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/mp4': 'mp4',
    'audio/m4a': 'm4a'
  };
  const ext = extMap[mimetype] || 'webm';

  const formData = new FormData();
  formData.append('file', new Blob([audioBuffer], { type: mimetype }), `audio.${ext}`);
  formData.append('model', 'whisper-1');
  formData.append('language', 'ru');
  formData.append('response_format', 'json');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    },
    body: formData
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Whisper API error: ${response.status}`);
  }

  const data = await response.json();
  return data.text;
}
