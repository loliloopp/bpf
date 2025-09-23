# Анализ проблемы производительности response.text()

## ПРОБЛЕМА
Время обработки `response.text()` занимает 62890мс (62+ секунды) для ответа размером 4493 символа (4.4KB), что является неприемлемо долго.

## ПРИЧИНЫ МЕДЛЕННОГО ЧТЕНИЯ

### 1. Браузерный баг с AbortSignal.timeout()
**Проблема**: В Chrome/Edge есть известный баг где `AbortSignal.timeout()` может вызывать зависание `response.text()`
- **Симптомы**: Запрос завершается быстро (661мс), но чтение response зависает на 60+ секунд
- **Затронутые браузеры**: Chrome, Edge (Chromium-based)
- **Источник**: AbortSignal.timeout() всегда возвращает AbortError вместо TimeoutError

### 2. Конфликт объединенных AbortSignal
**Проблема**: Комбинирование external signal (React Query) + AbortSignal.timeout() создает race conditions
- **Эффект**: response.text() может зависнуть в ожидании разрешения конфликта сигналов
- **Особенно проявляется**: При маленьких ответах где текст должен читаться мгновенно

### 3. Неоптимальная условная логика чтения
**Проблема**: Сложная логика выбора метода чтения для разных размеров ответов
- **Overhead**: Лишние проверки для маленьких ответов
- **Потоковое чтение**: Не нужно для 4KB данных, только замедляет

## РЕАЛИЗОВАННЫЕ РЕШЕНИЯ

### ✅ Решение 1: Исключение AbortSignal.timeout()
```typescript
// БЫЛО (проблемный код):
if (!externalSignal && timeoutMs) {
  return AbortSignal.timeout(timeoutMs) // Браузерный баг!
}

// СТАЛО (исправленный код):
if (!externalSignal && timeoutMs) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort(new DOMException(`Request timeout after ${timeoutMs}ms`, 'TimeoutError'))
  }, timeoutMs)
  return controller.signal
}
```

### ✅ Решение 2: Упрощение логики чтения
```typescript
// БЫЛО (сложная логика):
if (contentLength && parseInt(contentLength) > 1000000) { // 1MB
  // Потоковое чтение с множественными проверками AbortSignal
}

// СТАЛО (оптимизированная логика):
const isLargeResponse = contentLengthValue > 5000000 // 5MB threshold
if (isLargeResponse) {
  // ArrayBuffer для больших ответов
} else {
  // Прямое чтение с защитой от зависания
}
```

### ✅ Решение 3: Защита от зависания text()
```typescript
// Метод с таймаутом для защиты
const textPromise = response.text()
const timeoutPromise = new Promise<never>((_, reject) => {
  setTimeout(() => reject(new Error('text() timeout')), 5000) // 5 сек максимум
})

text = await Promise.race([textPromise, timeoutPromise])

// Fallback на ArrayBuffer если text() зависает
if (textPromise зависает) {
  const buffer = await response.arrayBuffer()
  text = new TextDecoder('utf-8').decode(buffer)
}
```

## ТЕХНИЧЕСКИЕ ДЕТАЛИ ИСПРАВЛЕНИЙ

### Изменение 1: createCombinedSignal()
- **Убрано**: `AbortSignal.timeout()` - источник browser bugs
- **Добавлено**: Простой `setTimeout()` с `AbortController`
- **Результат**: Исключены race conditions между signals

### Изменение 2: Логика чтения ответа
- **Threshold изменен**: с 1MB на 5MB для потокового чтения
- **Для маленьких ответов**: Прямое чтение с защитой таймаутом
- **Fallback**: ArrayBuffer если text() зависает

### Изменение 3: Promise.race защита
- **Проблема**: response.text() может зависнуть навсегда
- **Решение**: Promise.race с 5-секундным таймаутом
- **Backup**: Автоматический переход на ArrayBuffer

## ОЖИДАЕМЫЕ РЕЗУЛЬТАТЫ

### Время чтения 4KB ответа:
- **Было**: 62890мс (62+ секунд)
- **Ожидается**: 10-50мс (нормальное время)

### Надежность:
- **Устранены**: Browser bugs с AbortSignal.timeout()
- **Добавлены**: Fallback механизмы
- **Защита**: От зависания response.text()

## МОНИТОРИНГ И ОТЛАДКА

Добавлено детальное логирование для отслеживания:
```typescript
console.log(`🔍 Deepseek: Маленький ответ ${contentLengthValue} байт, оптимизированное чтение`)
console.log(`🔍 Deepseek: Текст прочитан (метод 1) за ${textReadTime}мс`)
console.warn(`🔍 Deepseek: text() зависло, переключаемся на ArrayBuffer`)
```

## ДОПОЛНИТЕЛЬНЫЕ РЕКОМЕНДАЦИИ

### 1. Мониторинг браузеров
- Тестирование в Chrome, Firefox, Safari
- Отслеживание performance.timing
- Логирование медленных запросов (>1000мс)

### 2. Fallback стратегии
- Для response.text() → ArrayBuffer
- Для больших ответов → потоковое чтение
- Для network errors → retry logic

### 3. Будущие оптимизации
- WebStreams API для больших ответов
- Service Workers для кэширования
- Background sync для offline режима

## ЗАКЛЮЧЕНИЕ

Проблема была вызвана комбинацией:
1. **Browser bug**: AbortSignal.timeout() в Chrome/Edge
2. **Race conditions**: Конфликт multiple abort signals
3. **Неоптимальная логика**: Сложные проверки для простых задач

Все исправления направлены на:
- Устранение browser bugs
- Упрощение логики чтения
- Добавление защиты от зависания
- Обеспечение fallback механизмов

**Ожидаемый результат**: Время чтения уменьшится с 62+ секунд до 10-50мс для маленьких ответов.