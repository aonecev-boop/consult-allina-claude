# 3. Архитектура проекта «АлИИна»

## Общая архитектура

**Архитектурный подход:** Модульный монолит с выделенными сервисными слоями.

Система состоит из трёх основных уровней:
1. **Клиентский уровень (Frontend)** — встраиваемый чат-виджет на сайте
2. **Серверный уровень (Backend)** — API-сервер с бизнес-логикой, AI-движком и интеграциями
3. **Внешние сервисы** — LLM API, STT API, TTS API, Telegram Bot API

Модульная структура позволяет заменять отдельные компоненты (LLM-провайдера, TTS/STT-сервис) без переписывания остальной системы.

---

## Диаграмма общей архитектуры

```mermaid
graph TB
    subgraph "КЛИЕНТ (Браузер)"
        W["Чат-виджет<br/>HTML/CSS/JS"]
        TI["Текстовый ввод"]
        MI["Микрофон<br/>(голосовой ввод)"]
        FU["Загрузка файлов<br/>(фото/проект)"]
        AP["Аудио-плеер<br/>(TTS ответ)"]
    end

    subgraph "BACKEND (API-сервер)"
        GW["API Gateway<br/>(маршрутизация запросов)"]

        subgraph "Сервисный слой"
            CS["Chat Service<br/>(управление диалогом)"]
            SS["STT Service<br/>(распознавание речи)"]
            TS["TTS Service<br/>(синтез речи)"]
            FS["File Service<br/>(приём файлов)"]
            NS["Notification Service<br/>(уведомления менеджеру)"]
        end

        subgraph "AI-движок"
            LLM["LLM Controller<br/>(системный промт + контекст)"]
            CALC["Calculation Engine<br/>(расчёт стоимости)"]
            PM["Prompt Manager<br/>(управление промтом)"]
        end

        subgraph "Хранилище данных"
            SM["Session Manager<br/>(сессии + история)"]
            DB["Data Layer<br/>(базы данных)"]
        end

        subgraph "Админ-панель"
            ADM["Admin API<br/>(CRUD для баз данных)"]
        end
    end

    subgraph "Внешние сервисы"
        LLMAPI["LLM API<br/>(OpenAI GPT-4o)"]
        STTAPI["STT API<br/>(Whisper / SpeechKit)"]
        TTSAPI["TTS API<br/>(OpenAI TTS / SpeechKit)"]
        TG["Telegram Bot API"]
        S3["S3 хранилище<br/>(файлы клиентов)"]
    end

    TI --> GW
    MI --> GW
    FU --> GW
    GW --> CS
    GW --> SS
    GW --> FS
    CS --> LLM
    CS --> CALC
    LLM --> PM
    LLM --> SM
    LLM --> DB
    CALC --> DB
    CS --> TS
    CS --> NS
    SS --> STTAPI
    TS --> TTSAPI
    LLM --> LLMAPI
    NS --> TG
    FS --> S3
    TS --> AP
    CS --> W
    ADM --> DB
```

---

## Структура проекта

```
aliina/
├── client/                          # Frontend — Чат-виджет
│   ├── widget.js                    # Основной скрипт виджета (точка входа)
│   ├── widget.css                   # Стили виджета
│   ├── components/
│   │   ├── ChatWindow.js            # Окно чата (отображение сообщений)
│   │   ├── MessageInput.js          # Текстовое поле ввода + отправка
│   │   ├── VoiceRecorder.js         # Кнопка микрофона + запись голоса
│   │   ├── AudioPlayer.js           # Воспроизведение голосовых ответов (TTS)
│   │   ├── FileUploader.js          # Загрузка файлов/фото
│   │   ├── StatusIndicator.js       # «АлИИна печатает...» / «говорит...»
│   │   └── WidgetToggle.js          # Кнопка свернуть/развернуть
│   └── utils/
│       ├── api.js                   # HTTP-клиент для API
│       └── audio.js                 # Утилиты для аудио (MediaRecorder, playback)
│
├── server/                          # Backend — API-сервер
│   ├── app.js                       # Точка входа сервера
│   ├── config/
│   │   ├── config.js                # Конфигурация (порты, ключи, режимы)
│   │   └── prompts/
│   │       └── system_prompt.txt    # Системный промт АлИИны
│   │
│   ├── routes/
│   │   ├── chat.js                  # POST /api/chat — основной чат
│   │   ├── stt.js                   # POST /api/stt — распознавание речи
│   │   ├── tts.js                   # POST /api/tts — синтез речи
│   │   ├── upload.js                # POST /api/upload — загрузка файлов
│   │   └── admin.js                 # CRUD /api/admin/* — управление БД
│   │
│   ├── services/
│   │   ├── ChatService.js           # Управление диалогом, контекст сессии
│   │   ├── LLMService.js            # Интеграция с LLM (OpenAI API)
│   │   ├── STTService.js            # Интеграция со STT-сервисом
│   │   ├── TTSService.js            # Интеграция с TTS-сервисом
│   │   ├── CalculationService.js    # Расчёт стоимости мебели
│   │   ├── FileService.js           # Обработка и хранение файлов
│   │   ├── NotificationService.js   # Уведомления менеджеру (Telegram/Email)
│   │   └── SessionManager.js        # Управление сессиями и историей
│   │
│   ├── data/                        # Базы данных (JSON-файлы, редактируемые)
│   │   ├── db_company_info.json     # DB-COMPANY-INFO
│   │   ├── db_price_category.json   # DB-PRICE-CATEGORY
│   │   ├── db_model_numbers.json    # DB-MODEL-NUMBERS
│   │   └── db_exception.json        # DB-EXCEPTION
│   │
│   ├── middleware/
│   │   ├── auth.js                  # Аутентификация (админ-панель)
│   │   ├── cors.js                  # CORS для виджета
│   │   ├── rateLimit.js             # Ограничение частоты запросов
│   │   └── validation.js            # Валидация входных данных
│   │
│   └── utils/
│       ├── urlParser.js             # Парсинг ссылок (извлечение номера модели)
│       ├── unitConverter.js         # Конвертация единиц (см→м, мм→м)
│       └── logger.js               # Логирование
│
├── admin/                           # Админ-панель (веб-интерфейс)
│   ├── index.html                   # Главная страница админ-панели
│   ├── admin.js                     # Логика CRUD-операций
│   └── admin.css                    # Стили
│
├── tests/                           # Тесты
│   ├── unit/
│   │   ├── calculation.test.js      # Тесты расчёта стоимости
│   │   ├── urlParser.test.js        # Тесты парсинга ссылок
│   │   └── unitConverter.test.js    # Тесты конвертации единиц
│   ├── integration/
│   │   ├── chat.test.js             # Интеграционные тесты чат-API
│   │   └── notification.test.js     # Тесты уведомлений
│   └── e2e/
│       └── dialog.test.js           # E2E тесты полного диалога
│
├── docs/                            # Документация
│   ├── 1_idea.md
│   ├── 2_technical_specification.md
│   └── 3_architecture.md
│
├── .env.example                     # Пример переменных окружения
├── package.json
└── README.md
```

---

## Диаграмма компонентов и их взаимодействия

### Клиентский уровень (Frontend Widget)

```mermaid
graph LR
    subgraph "Чат-виджет (widget.js)"
        WT["WidgetToggle<br/>свернуть/развернуть"]
        CW["ChatWindow<br/>окно сообщений"]
        MI["MessageInput<br/>текстовый ввод"]
        VR["VoiceRecorder<br/>микрофон"]
        FU["FileUploader<br/>загрузка файлов"]
        AP["AudioPlayer<br/>голосовой ответ"]
        SI["StatusIndicator<br/>статус АлИИны"]
    end

    WT --> CW
    MI --> CW
    VR --> CW
    FU --> CW
    AP --> CW
    SI --> CW
```

**Ответственности компонентов:**

| Компонент | Ответственность |
|-----------|----------------|
| `WidgetToggle` | Кнопка-иконка для открытия/закрытия виджета на сайте |
| `ChatWindow` | Отображение истории сообщений (клиент + АлИИна), автопрокрутка |
| `MessageInput` | Текстовое поле + кнопка отправки, обработка Enter |
| `VoiceRecorder` | Запись аудио с микрофона (MediaRecorder API), отправка на STT |
| `FileUploader` | Выбор и отправка файлов/фото (проект клиента) |
| `AudioPlayer` | Воспроизведение голосовых ответов АлИИны (TTS) |
| `StatusIndicator` | Индикаторы: «печатает...», «говорит...», «распознаёт голос...» |

### Серверный уровень (Backend)

```mermaid
graph TB
    subgraph "API Gateway (routes/)"
        R1["POST /api/chat"]
        R2["POST /api/stt"]
        R3["POST /api/tts"]
        R4["POST /api/upload"]
        R5["CRUD /api/admin/*"]
    end

    subgraph "Middleware"
        MW1["CORS"]
        MW2["Rate Limit"]
        MW3["Validation"]
        MW4["Auth (admin)"]
    end

    subgraph "Services"
        SVC1["ChatService"]
        SVC2["LLMService"]
        SVC3["STTService"]
        SVC4["TTSService"]
        SVC5["CalculationService"]
        SVC6["FileService"]
        SVC7["NotificationService"]
        SVC8["SessionManager"]
    end

    subgraph "Data Layer"
        D1["db_company_info.json"]
        D2["db_price_category.json"]
        D3["db_model_numbers.json"]
        D4["db_exception.json"]
    end

    R1 --> MW1 --> MW2 --> MW3 --> SVC1
    R2 --> SVC3
    R3 --> SVC4
    R4 --> SVC6
    R5 --> MW4 --> D1 & D2 & D3 & D4

    SVC1 --> SVC2
    SVC1 --> SVC5
    SVC1 --> SVC8
    SVC1 --> SVC7
    SVC2 --> D1 & D2 & D3 & D4
    SVC5 --> D2 & D3
```

---

## Описание сервисов

### ChatService — управление диалогом
**Ответственность:** Центральный координатор диалога. Принимает сообщение клиента, передаёт в LLMService, получает ответ, при необходимости инициирует расчёт, TTS и уведомления.

**Входные данные:**
- Текстовое сообщение клиента (или распознанный текст из STT)
- ID сессии

**Выходные данные:**
- Текстовый ответ АлИИны
- Ссылка на аудио-ответ (если голосовой режим)
- Флаг завершения диалога

### LLMService — интеграция с LLM
**Ответственность:** Формирование запроса к LLM (системный промт + история сессии + сообщение клиента), обработка ответа, потоковая генерация (streaming).

**Ключевые элементы:**
- Системный промт загружается из `system_prompt.txt`
- Базы данных подставляются в контекст (DB-COMPANY-INFO, DB-PRICE-CATEGORY, DB-MODEL-NUMBERS, DB-EXCEPTION)
- Внутренний JSON клиента передаётся в контексте, но скрыт от ответа
- Поддержка streaming (SSE / WebSocket) для потокового вывода

### CalculationService — расчёт стоимости
**Ответственность:** Вычисление ориентировочной стоимости мебели по формулам.

**Алгоритмы:**
| Тип расчёта | Формула |
|-------------|---------|
| По категории | `Цена_категории × Длина(м)` |
| По номеру модели | `Цена_модели × Длина(м)` |
| Гардеробная (П) | `Цена × ((глубина × 2) + ширина)` |
| Гардеробная (Г) | `Цена × (глубина + ширина)` |
| Гардеробная (Прямая) | `Цена × ширина` |
| Угловой шкаф | `Цена × (ширина₁ + ширина₂)` |
| Угловой шкаф-купе | `Цена × (ширина₁ + ширина₂)` |

**Утилиты:**
- `unitConverter` — перевод см→м, мм→м, извлечение длины из формата `159×60×240`
- `urlParser` — извлечение номера модели из URL (`uglovoi-shkaf-s-zerkalom-23` → №23)

### STTService — распознавание речи
**Ответственность:** Приём аудио-файла от клиента, отправка на внешний STT API, возврат распознанного текста.

**Поток данных:**
```
Микрофон → MediaRecorder (WebM/Opus) → POST /api/stt → Whisper API → текст → ChatService
```

### TTSService — синтез речи
**Ответственность:** Приём текста ответа АлИИны, отправка на внешний TTS API, возврат аудио-файла.

**Поток данных:**
```
Текст ответа → POST /api/tts → TTS API → аудио (MP3/OGG) → AudioPlayer (клиент)
```

**Параметры голоса:**
- Язык: русский
- Голос: женский, естественный (образ «АлИИна»)
- Формат: MP3 или OGG Opus

### NotificationService — уведомления менеджеру
**Ответственность:** Отправка собранных данных клиента менеджеру при завершении диалога.

**Триггеры:**
- Клиент записался на замер (собраны город, улица, телефон)
- Клиент прислал проект (собраны время, проект)
- Клиент позвал менеджера (собраны телефон, время)

**Каналы:**
- Telegram Bot → чат менеджера
- Email (SMTP) — резервный канал

**Формат сообщения менеджеру:**
```
📋 Новая заявка от АлИИны

👤 Имя: {Client_name}
🪑 Мебель: {Mebel_name}
📏 Размер: {Dlina}
💰 Ориент. стоимость: {Orientir_price}
🏙 Город: {Gorod}
🏠 Улица: {Ylitsa}
⏰ Удобное время: {Vremya_client}
📎 Проект: {Client_Project}
```

### SessionManager — управление сессиями
**Ответственность:** Хранение и управление данными сессий (история сообщений, внутренний JSON клиента).

**Структура сессии:**
```
session_id → {
  created_at,
  messages: [...],
  client_data: { внутренний JSON },
  state: { asked_name, asked_model_question, confirmed_calculation, ... },
  voice_mode: true/false
}
```

**Хранение:**
- In-memory (Redis / Map) для активных сессий
- Запись в лог-файл / БД при завершении диалога (для аналитики)
- TTL сессии: 30 минут без активности

### FileService — обработка файлов
**Ответственность:** Приём файлов/фото от клиента, сохранение в S3-хранилище, возврат ссылки.

**Ограничения:**
- Форматы: JPG, PNG, PDF, DOC, DOCX
- Максимальный размер: 10 МБ
- Файл сохраняется с привязкой к session_id

---

## База данных

### Схема хранения данных

```mermaid
erDiagram
    DB_COMPANY_INFO {
        string section_id PK
        string section_name
        text content
        datetime updated_at
    }

    DB_PRICE_CATEGORY {
        string category_id PK
        string category_name
        int price_per_meter
        string unit
        datetime updated_at
    }

    DB_MODEL_NUMBERS {
        string model_number PK
        string model_name
        string subcategory
        int price
        datetime updated_at
    }

    DB_EXCEPTION {
        string exception_id PK
        string exception_name
        text reason
        datetime updated_at
    }

    SESSIONS {
        string session_id PK
        string client_name
        text messages_json
        text client_data_json
        datetime created_at
        datetime updated_at
        string status
    }
```

### Модели данных

| Модель | Поля | Описание |
|--------|------|----------|
| `DB_COMPANY_INFO` | section_id, section_name, content, updated_at | Разделы информации о компании (текстовые блоки) |
| `DB_PRICE_CATEGORY` | category_id, category_name, price_per_meter, unit, updated_at | Цены по категориям мебели (9 записей) |
| `DB_MODEL_NUMBERS` | model_number, model_name, subcategory, price, updated_at | Цены по номерам моделей (109+ записей) |
| `DB_EXCEPTION` | exception_id, exception_name, reason, updated_at | Исключения — мебель, которую не изготавливаем (4 записи) |
| `SESSIONS` | session_id, client_name, messages_json, client_data_json, created_at, status | Сессии диалогов для аналитики |

### Формат хранения

**Основной:** JSON-файлы в директории `server/data/` — для быстрого редактирования без инструментов БД.

**Пример `db_price_category.json`:**
```json
[
  { "category_id": "garderobnie", "category_name": "Гардеробные", "price_per_meter": 29000, "unit": "м" },
  { "category_id": "prihozhie_raspashnye", "category_name": "Прихожие, распашные шкафы", "price_per_meter": 55000, "unit": "м" },
  { "category_id": "shkafy_kupe", "category_name": "Шкафы-купе", "price_per_meter": 60000, "unit": "м" }
]
```

**Для продакшна:** Миграция на SQLite/PostgreSQL с сохранением JSON API для админ-панели.

---

## API

### Эндпоинты

| Метод | URL | Описание | Входные данные | Ответ |
|-------|-----|----------|---------------|-------|
| POST | `/api/chat` | Отправка текстового сообщения | `{ session_id, message, voice_mode }` | `{ reply, audio_url?, dialog_ended }` |
| POST | `/api/stt` | Распознавание голоса → текст | `audio file (multipart)` | `{ text, confidence }` |
| POST | `/api/tts` | Синтез речи из текста | `{ text }` | `audio file (binary)` |
| POST | `/api/upload` | Загрузка файла/фото проекта | `file (multipart), session_id` | `{ file_url, file_id }` |
| GET | `/api/admin/db/:name` | Получить содержимое базы | — | `{ data: [...] }` |
| PUT | `/api/admin/db/:name` | Обновить содержимое базы | `{ data: [...] }` | `{ success, updated_at }` |
| POST | `/api/admin/db/:name/item` | Добавить запись в базу | `{ item: {...} }` | `{ success, item_id }` |
| DELETE | `/api/admin/db/:name/item/:id` | Удалить запись из базы | — | `{ success }` |

### Формат потокового ответа (SSE)

Для `POST /api/chat` с поддержкой streaming:
```
event: token
data: {"token": "Ориент"}

event: token
data: {"token": "ировочная"}

event: token
data: {"token": " стоимость"}

event: done
data: {"full_reply": "Ориентировочная стоимость — 95 000 рублей...", "audio_url": "/api/tts/abc123"}
```

---

## Потоки данных

### Поток 1 — Текстовое сообщение

```mermaid
sequenceDiagram
    participant K as Клиент (браузер)
    participant W as Виджет
    participant API as Backend API
    participant LLM as LLM API (OpenAI)
    participant DB as Базы данных

    K->>W: Вводит текст, нажимает Enter
    W->>API: POST /api/chat {session_id, message}
    API->>DB: Загрузить базы данных в контекст
    API->>LLM: Запрос (системный промт + история + сообщение)
    LLM-->>API: Ответ (streaming)
    API-->>W: SSE: токены ответа
    W-->>K: Отображение ответа посимвольно
```

### Поток 2 — Голосовое сообщение

```mermaid
sequenceDiagram
    participant K as Клиент (браузер)
    participant W as Виджет
    participant API as Backend API
    participant STT as STT API (Whisper)
    participant LLM as LLM API (OpenAI)
    participant TTS as TTS API

    K->>W: Нажимает микрофон, говорит
    W->>W: Запись аудио (MediaRecorder)
    W->>API: POST /api/stt (аудио-файл)
    API->>STT: Распознавание речи
    STT-->>API: Текст сообщения
    API-->>W: {text: "распознанный текст"}
    W->>API: POST /api/chat {session_id, message, voice_mode: true}
    API->>LLM: Запрос к LLM
    LLM-->>API: Текстовый ответ
    API->>TTS: Синтез речи из ответа
    TTS-->>API: Аудио-файл
    API-->>W: {reply, audio_url}
    W-->>K: Текст + автовоспроизведение аудио
```

### Поток 3 — Загрузка проекта

```mermaid
sequenceDiagram
    participant K as Клиент
    participant W as Виджет
    participant API as Backend API
    participant S3 as S3 хранилище
    participant TG as Telegram (менеджер)

    K->>W: Загрузка файла/фото
    W->>API: POST /api/upload (файл)
    API->>S3: Сохранение файла
    S3-->>API: file_url
    API-->>W: {file_url}
    W->>API: POST /api/chat {message: "[файл загружен]"}
    API-->>W: Фиксированное сообщение по алгоритму
    Note over W,API: Запрос времени и телефона
    Note over API,TG: Передача данных менеджеру
    API->>TG: Уведомление с данными клиента
```

### Поток 4 — Уведомление менеджера

```mermaid
sequenceDiagram
    participant API as Backend
    participant SM as SessionManager
    participant NS as NotificationService
    participant TG as Telegram Bot
    participant EM as Email SMTP

    API->>SM: Получить данные клиента из сессии
    SM-->>API: client_data JSON
    API->>NS: Отправить уведомление
    NS->>TG: Сообщение в Telegram
    TG-->>NS: OK
    NS->>EM: Копия на Email (резерв)
    EM-->>NS: OK
```

---

## Паттерны проектирования

| Паттерн | Где используется | Обоснование |
|---------|-----------------|-------------|
| **Service Layer** | Все сервисы (ChatService, LLMService и др.) | Отделение бизнес-логики от маршрутов API. Упрощает тестирование и замену компонентов |
| **Strategy** | LLMService, STTService, TTSService | Возможность замены провайдера (OpenAI → Yandex → ElevenLabs) без изменения бизнес-логики |
| **Middleware Chain** | CORS, Rate Limit, Validation, Auth | Последовательная обработка запросов с возможностью добавления новых middleware |
| **Observer** | NotificationService | Подписка на события завершения диалога для отправки уведомлений менеджеру |
| **Repository** | Data Layer (JSON-файлы → БД) | Абстракция доступа к данным. При миграции JSON → PostgreSQL меняется только репозиторий |
| **Session / State** | SessionManager | Хранение состояния диалога, истории сообщений и данных клиента в рамках сессии |
| **Factory** | Создание ответов, расчётов | Формирование ответа клиенту в зависимости от типа запроса (информация, расчёт, замер) |

---

## Схема навигации (пользовательские потоки)

### Поток клиента

```mermaid
stateDiagram-v2
    [*] --> ВиджетЗакрыт
    ВиджетЗакрыт --> ВиджетОткрыт: Клик по иконке чата

    state ВиджетОткрыт {
        [*] --> Приветствие: АлИИна представляется
        Приветствие --> ЗапросИмени: Запрос имени клиента
        ЗапросИмени --> ЗапросИмени: Имя не указано
        ЗапросИмени --> КонсультацияГотова: Имя получено

        state КонсультацияГотова {
            [*] --> ОжиданиеВопроса

            ОжиданиеВопроса --> ИнфоОКомпании: Вопрос по компании
            ИнфоОКомпании --> ОжиданиеВопроса

            ОжиданиеВопроса --> ПрислалПроект: Загрузил файл/фото
            ПрислалПроект --> ЗапросВремениТел
            ЗапросВремениТел --> ПередачаМенеджеру
            ПередачаМенеджеру --> ЗавершениеДиалога

            ОжиданиеВопроса --> ПозвалМенеджера: Хочу менеджера
            ПозвалМенеджера --> ЗапросТелефона
            ЗапросТелефона --> ПередачаМенеджеру2: Передам менеджеру
            ПередачаМенеджеру2 --> ЗавершениеДиалога

            ОжиданиеВопроса --> УточнениеКатегории: Хочу мебель
            УточнениеКатегории --> ПроверкаИсключений
            ПроверкаИсключений --> ОжиданиеВопроса: DB-EXCEPTION
            ПроверкаИсключений --> ВопросМодельИлиРазмеры
            ВопросМодельИлиРазмеры --> СборРазмеров
            СборРазмеров --> Подтверждение: Подтвердите мебель?
            Подтверждение --> Расчёт: Да
            Подтверждение --> ОжиданиеВопроса: Нет
            Расчёт --> ПредложениеЗамера
            ПредложениеЗамера --> СборАдресаТелефона: Согласен
            ПредложениеЗамера --> ОжиданиеВопроса: Не сейчас
            СборАдресаТелефона --> ЕщёВопросы
            ЕщёВопросы --> ОжиданиеВопроса: Да
            ЕщёВопросы --> ЗавершениеДиалога: Нет
        }
    }

    ЗавершениеДиалога --> [*]: СПАСИБО + СТОП
```

### Поток администратора

```mermaid
stateDiagram-v2
    [*] --> Авторизация: Вход в админ-панель
    Авторизация --> Главная: Успешная авторизация

    state Главная {
        [*] --> ВыборБазы

        ВыборБазы --> РедактированиеCompanyInfo: DB-COMPANY-INFO
        ВыборБазы --> РедактированиеPriceCategory: DB-PRICE-CATEGORY
        ВыборБазы --> РедактированиеModelNumbers: DB-MODEL-NUMBERS
        ВыборБазы --> РедактированиеException: DB-EXCEPTION

        РедактированиеCompanyInfo --> Сохранение
        РедактированиеPriceCategory --> Сохранение
        РедактированиеModelNumbers --> Сохранение
        РедактированиеException --> Сохранение

        Сохранение --> ВыборБазы: Данные обновлены
    }
```

---

## Безопасность

| Угроза | Мера защиты |
|--------|------------|
| Prompt Injection (клиент пытается изменить поведение AI) | Жёсткий системный промт, фильтрация входных сообщений, отдельный system/user контекст |
| Утечка API-ключей | Ключи хранятся в `.env` на сервере, не передаются на клиент |
| Утечка внутреннего JSON клиента | Инструкция в промте + серверная фильтрация ответа |
| DDoS / спам запросов | Rate Limiting (по IP и сессии), CAPTCHA при подозрении |
| Несанкционированный доступ к админ-панели | Аутентификация (логин/пароль), ограничение по IP |
| Передача персональных данных (ФЗ-152) | HTTPS, шифрование хранения, политика конфиденциальности на сайте |
| XSS через сообщения в чате | Экранирование HTML в выводе, Content Security Policy |

---

## Развёртывание (Deployment)

```mermaid
graph LR
    subgraph "Продакшн"
        VPS["VPS сервер<br/>(Ubuntu / Debian)"]
        NG["Nginx<br/>(reverse proxy + SSL)"]
        APP["Node.js приложение<br/>(PM2 process manager)"]
        DATA["data/<br/>(JSON базы данных)"]
        S3["S3 хранилище<br/>(файлы клиентов)"]
    end

    subgraph "Внешние API"
        OAI["OpenAI API"]
        TG["Telegram Bot API"]
    end

    subgraph "Сайт заказчика"
        SITE["vstroy-mebel.ru"]
        SCRIPT["&lt;script src='widget.js'&gt;"]
    end

    SITE --> SCRIPT
    SCRIPT --> NG
    NG --> APP
    APP --> DATA
    APP --> S3
    APP --> OAI
    APP --> TG
```

**Минимальные требования к серверу:**
- 2 vCPU, 4 ГБ RAM
- 20 ГБ SSD
- Ubuntu 22.04+
- Node.js 20+
- SSL-сертификат (Let's Encrypt)

**Встраивание на сайт:**
```html
<!-- Одна строка для подключения виджета -->
<script src="https://aliina.vstroy-mebel.ru/widget.js" defer></script>
```
