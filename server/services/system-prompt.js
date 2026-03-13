import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');

function loadJSON(filename) {
  return JSON.parse(readFileSync(join(dataDir, filename), 'utf-8'));
}

function loadText(filepath) {
  return readFileSync(join(dataDir, filepath), 'utf-8');
}

// Всегда читает файлы заново — горячая перезагрузка при редактировании через админку
export function buildSystemPrompt() {
  const systemPrompt = loadText('prompts/system.md');
  const algorithms = loadText('prompts/algorithms.md');

  const companyInfo = loadJSON('company-info.json');
  const priceCategory = loadJSON('price-category.json');
  const models = loadJSON('models.json');
  const exceptions = loadJSON('exceptions.json');

  const priceTable = priceCategory.categories
    .map(c => `- ${c.name}: ${c.pricePerMeter || c.pricePerUnit} ₽/${c.unit || 'м'}`)
    .join('\n');

  const modelsTable = models.models
    .map(m => `- №${m.id} ${m.name}: ${m.price} ₽`)
    .join('\n');

  return `${systemPrompt}

${algorithms}

## БАЗЫ ДАННЫХ

### [DB-EXCEPTION]
${JSON.stringify(exceptions.exceptions)}

### [DB-PRICE-CATEGORY]
${priceTable}

### [DB-MODEL-NUMBERS]
${modelsTable}

### [DB-COMPANY-INFO]
${JSON.stringify(companyInfo, null, 2)}

Если клиента интересуют: фурнитура, материалы, направляющие, сроки, история, фото/видео работ, отзывы, расположение, график, скидки, гарантии — отвечай на основе DB-COMPANY-INFO.`;
}
