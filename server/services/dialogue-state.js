// Машина состояний диалога АлИИны

export const STATES = {
  GREETING: 'greeting',
  COLLECTING_NAME: 'collecting_name',
  CONSULTING: 'consulting',
  CONFIRMING: 'confirming',
  CALCULATING: 'calculating',
  OFFERING_MEASUREMENT: 'offering_measurement',
  COLLECTING_CONTACT: 'collecting_contact',
  HANDLING_PROJECT: 'handling_project',
  CALLING_MANAGER: 'calling_manager',
  COMPLETED: 'completed'
};

// Какие поля clientData нужны для перехода между состояниями
const STATE_TRANSITIONS = {
  [STATES.GREETING]: {
    next: STATES.COLLECTING_NAME,
    auto: true // сразу после первого сообщения
  },
  [STATES.COLLECTING_NAME]: {
    next: STATES.CONSULTING,
    requiredFields: ['Client_name']
  },
  [STATES.CONSULTING]: {
    next: STATES.CONFIRMING,
    requiredFields: ['Mebel_name']
  },
  [STATES.CONFIRMING]: {
    next: STATES.CALCULATING,
    requiredFields: ['Mebel_name', 'Dlina']
  },
  [STATES.CALCULATING]: {
    next: STATES.OFFERING_MEASUREMENT,
    requiredFields: ['Orientir_price']
  },
  [STATES.OFFERING_MEASUREMENT]: {
    next: STATES.COLLECTING_CONTACT,
    auto: true
  },
  [STATES.COLLECTING_CONTACT]: {
    next: STATES.COMPLETED,
    requiredFields: ['Gorod', 'Ylitsa', 'Telefon']
  },
  [STATES.HANDLING_PROJECT]: {
    next: STATES.COMPLETED,
    requiredFields: ['Telefon', 'Vremya_client']
  },
  [STATES.CALLING_MANAGER]: {
    next: STATES.COMPLETED,
    requiredFields: ['Telefon', 'Vremya_client']
  },
  [STATES.COMPLETED]: {
    next: null
  }
};

/**
 * Определяет следующее состояние на основе текущих данных клиента
 */
export function resolveState(currentState, clientData) {
  // Спецсостояния — обрабатываются отдельно
  if (currentState === STATES.HANDLING_PROJECT || currentState === STATES.CALLING_MANAGER) {
    const transition = STATE_TRANSITIONS[currentState];
    if (transition.requiredFields?.every(f => clientData[f])) {
      return STATES.COMPLETED;
    }
    return currentState;
  }

  if (currentState === STATES.COMPLETED) return STATES.COMPLETED;

  const transition = STATE_TRANSITIONS[currentState];
  if (!transition?.next) return currentState;

  // Автоматический переход (без условий)
  if (transition.auto) return transition.next;

  // Проверяем заполненность полей
  if (transition.requiredFields?.every(f => clientData[f])) {
    // Рекурсивно проверяем — может, можно перейти ещё дальше
    return resolveState(transition.next, clientData);
  }

  return currentState;
}

/**
 * Извлекает JSON-блок с данными клиента из ответа AI
 * AI возвращает данные в формате: <!--DATA:{"Client_name":"Иван",...}-->
 */
export function extractClientData(assistantMessage) {
  const match = assistantMessage.match(/<!--DATA:(.*?)-->/s);
  if (!match) return null;

  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

/**
 * Удаляет служебный блок данных из сообщения перед показом клиенту
 */
export function cleanMessage(message) {
  return message.replace(/<!--DATA:.*?-->/gs, '').trim();
}

/**
 * Мержит новые данные в clientData (не перезаписывает пустыми значениями)
 */
export function mergeClientData(existing, extracted) {
  const merged = { ...existing };
  for (const [key, value] of Object.entries(extracted)) {
    if (value && value !== '' && value !== 'не указано') {
      merged[key] = value;
    }
  }
  return merged;
}

/**
 * Проверяет, нужно ли переключиться на спецсостояние
 */
export function checkSpecialState(assistantMessage, currentState) {
  if (currentState === STATES.HANDLING_PROJECT || currentState === STATES.CALLING_MANAGER) {
    return currentState;
  }

  // AI может сигнализировать о спецситуациях через теги
  if (assistantMessage.includes('<!--STATE:handling_project-->')) {
    return STATES.HANDLING_PROJECT;
  }
  if (assistantMessage.includes('<!--STATE:calling_manager-->')) {
    return STATES.CALLING_MANAGER;
  }

  return null;
}

/**
 * Генерирует блок для системного промпта с информацией о состоянии
 */
export function buildStateContext(state, clientData) {
  const filled = Object.entries(clientData)
    .filter(([, v]) => v && v !== '')
    .map(([k, v]) => `  ${k}: ${v}`)
    .join('\n');

  const stateDescriptions = {
    [STATES.GREETING]: 'Начало диалога. Поприветствуй и представься.',
    [STATES.COLLECTING_NAME]: 'Узнай имя клиента. Не продолжай без имени.',
    [STATES.CONSULTING]: 'Клиент назвал имя. Узнай, какая мебель нужна (категория). Уточни размеры.',
    [STATES.CONFIRMING]: 'Есть категория мебели. Подтверди с клиентом перед расчётом. Уточни размеры если не указаны.',
    [STATES.CALCULATING]: 'Есть все данные для расчёта. Выполни расчёт по алгоритму.',
    [STATES.OFFERING_MEASUREMENT]: 'Расчёт выполнен. Предложи записаться на бесплатный замер.',
    [STATES.COLLECTING_CONTACT]: 'Клиент согласен на замер. Узнай поочерёдно: город, улицу, телефон.',
    [STATES.HANDLING_PROJECT]: 'Клиент прислал проект. Попроси время звонка и телефон. НЕ считай.',
    [STATES.CALLING_MANAGER]: 'Клиент хочет менеджера. Узнай телефон и удобное время.',
    [STATES.COMPLETED]: 'Диалог завершён. Спроси есть ли ещё вопросы, поблагодари.'
  };

  return `
## ТЕКУЩЕЕ СОСТОЯНИЕ ДИАЛОГА
Этап: ${state}
Задача: ${stateDescriptions[state] || ''}

## СОБРАННЫЕ ДАННЫЕ КЛИЕНТА
${filled || '(пока нет данных)'}

## ВАЖНО: ФОРМАТ ОТВЕТА
В КАЖДОМ своём ответе ОБЯЗАТЕЛЬНО добавь в самый конец невидимый блок с АКТУАЛЬНЫМИ данными клиента:
<!--DATA:{"Client_name":"","Mebel_name":"","Dlina":"","Gorod":"","Ylitsa":"","Telefon":"","Vremya_client":"","Client_Project":"","Orientir_price":""}-->
Заполняй только те поля, значения которых ты знаешь. Пустые поля оставляй пустыми строками.
Если клиент прислал проект/фото, добавь: <!--STATE:handling_project-->
Если клиент попросил менеджера, добавь: <!--STATE:calling_manager-->
Эти блоки <!--DATA:...--> и <!--STATE:...--> НЕВИДИМЫ для клиента, их видит только система.`;
}
