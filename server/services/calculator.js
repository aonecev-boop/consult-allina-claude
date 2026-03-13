import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');

function loadJSON(filename) {
  return JSON.parse(readFileSync(join(dataDir, filename), 'utf-8'));
}

/**
 * Расчёт стоимости по категории
 * @param {string} categoryName - название категории
 * @param {number} length - длина в метрах
 * @param {object} [options] - доп. параметры для спецалгоритмов
 * @param {string} [options.shape] - форма гардеробной: "П", "Г", "прямая"
 * @param {number} [options.width] - ширина (для гардеробных и угловых)
 * @param {number} [options.depth] - глубина (для гардеробных)
 * @param {number} [options.width2] - вторая ширина (для угловых шкафов)
 */
export function calculateByCategory(categoryName, length, options = {}) {
  const data = loadJSON('price-category.json');
  const category = data.categories.find(c =>
    c.name.toLowerCase().includes(categoryName.toLowerCase()) ||
    categoryName.toLowerCase().includes(c.name.toLowerCase())
  );

  if (!category) {
    return { error: `Категория "${categoryName}" не найдена` };
  }

  // Спецалгоритм для гардеробных
  if (category.name.toLowerCase().includes('гардероб') && options.shape) {
    const w = options.width || length;
    const d = options.depth || 0;
    let effectiveLength;

    switch (options.shape.toUpperCase()) {
      case 'П':
        effectiveLength = (d * 2) + w;
        break;
      case 'Г':
        effectiveLength = d + w;
        break;
      default: // прямая
        effectiveLength = w;
    }

    const price = Math.round(effectiveLength * category.pricePerMeter);
    return {
      category: category.name,
      shape: options.shape,
      width: w,
      depth: d,
      effectiveLength,
      pricePerMeter: category.pricePerMeter,
      totalPrice: price,
      formula: `${options.shape}: (${effectiveLength} м) × ${category.pricePerMeter} ₽/м = ${price} ₽`
    };
  }

  // Спецалгоритм для угловых шкафов
  if (category.name.toLowerCase().includes('углов') && options.width2) {
    const effectiveLength = (options.width || length) + options.width2;
    const price = Math.round(effectiveLength * category.pricePerMeter);
    return {
      category: category.name,
      width1: options.width || length,
      width2: options.width2,
      effectiveLength,
      pricePerMeter: category.pricePerMeter,
      totalPrice: price,
      formula: `(${options.width || length} + ${options.width2}) × ${category.pricePerMeter} ₽/м = ${price} ₽`
    };
  }

  // Стандартный расчёт
  if (category.pricePerUnit) {
    // Для дверей купе — за штуку
    const price = Math.round(length * category.pricePerUnit);
    return {
      category: category.name,
      quantity: length,
      pricePerUnit: category.pricePerUnit,
      totalPrice: price,
      formula: `${length} шт × ${category.pricePerUnit} ₽/шт = ${price} ₽`
    };
  }

  const price = Math.round(length * category.pricePerMeter);
  return {
    category: category.name,
    length,
    pricePerMeter: category.pricePerMeter,
    totalPrice: price,
    formula: `${length} м × ${category.pricePerMeter} ₽/м = ${price} ₽`
  };
}

/**
 * Расчёт стоимости по номеру модели
 * @param {number} modelId - номер модели
 * @param {number} length - длина в метрах
 */
export function calculateByModel(modelId, length) {
  const data = loadJSON('models.json');
  const model = data.models.find(m => m.id === modelId);

  if (!model) {
    return { error: `Модель №${modelId} не найдена` };
  }

  const price = Math.round(length * model.price);
  return {
    modelId: model.id,
    modelName: model.name,
    category: model.category,
    length,
    pricePerMeter: model.price,
    totalPrice: price,
    formula: `${length} м × ${model.price} ₽/м (модель №${model.id}) = ${price} ₽`
  };
}

/**
 * Извлечение номера модели из URL
 * Пример: "uglovoi-shkaf-s-zerkalom-23" → 23
 */
export function extractModelFromUrl(url) {
  const match = url.match(/(\d+)\s*$/);
  return match ? parseInt(match[1]) : null;
}

/**
 * Конвертация размеров из см/мм в метры
 * Примеры: "159" → 1.59, "1590" → 1.59, "2.4" → 2.4
 */
export function parseLengthToMeters(input) {
  const str = String(input).replace(',', '.').trim();
  const num = parseFloat(str);
  if (isNaN(num)) return null;

  if (num >= 1000) return num / 1000; // мм → м
  if (num >= 10) return num / 100;    // см → м
  return num;                          // уже в метрах
}
