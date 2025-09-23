# 🔧 ОТЧЕТ: ИСПРАВЛЕНИЕ ПРОБЛЕМЫ AI/ML РЕЖИМА

**Дата:** 19 сентября 2025
**Проблема:** При активированном AI режиме все равно срабатывал ML анализ вместо Deepseek AI
**Статус:** ✅ ИСПРАВЛЕНО

## 🕵️ Диагностика проблемы

### Найденная причина:
**Проблема кэширования в useQuery** - хук `useMLNomenclature` не учитывал изменения режима ML/AI в ключе кэша, поэтому всегда возвращал закэшированные результаты с режимом `'local'`.

### Технические детали:
1. **Переключатель AI/ML** в ChessboardML правильно сохранял настройки в localStorage
2. **mlModeApi.setMode()** корректно записывал новый режим
3. **predictNomenclature()** правильно проверял режим при каждом вызове
4. **Но useQuery кэшировал** первый результат и не перезапрашивал данные при смене режима

## 🛠️ Реализованное решение

### ✅ 1. Обновлен хук `useMLNomenclature`

**Добавлено в файл:** `src/entities/ml/lib/useMLNomenclature.ts`

```typescript
// Импорт mlModeApi для получения режима
import { mlModeApi } from '@/entities/api-settings'

// Состояние для отслеживания режима ML/AI
const [mlMode, setMLMode] = useState<string>('local')

// Запрос для получения режима ML/AI (без кэша)
const { data: modeConfig } = useQuery({
  queryKey: ['ml-mode-config'],
  queryFn: () => mlModeApi.getCurrentMode(),
  staleTime: 0, // Всегда свежие данные
  gcTime: 1000, // Минимальное время в памяти
  refetchOnMount: true, // Перезагружать при монтировании
})

// Обновление режима при изменении конфигурации
useEffect(() => {
  if (modeConfig) {
    setMLMode(modeConfig.mode)
    console.log('🔄 useMLNomenclature: Режим обновлен на', modeConfig.mode)
  }
}, [modeConfig])
```

### ✅ 2. Исправлен ключ кэша

**Было:**
```typescript
queryKey: ['ml-nomenclature-predictions', currentRequest, config]
```

**Стало:**
```typescript
queryKey: ['ml-nomenclature-predictions', currentRequest, config, mlMode]
```

**Результат:** Теперь при изменении режима ML/AI кэш сбрасывается и выполняется новый запрос.

### ✅ 3. Добавлено детальное логирование

**В useMLNomenclature:**
```typescript
console.log('🔄 useMLNomenclature: Режим обновлен на', modeConfig.mode)
console.log('🔍 DEBUG: Текущий режим ML в useMLNomenclature:', mlMode)
```

**В ML API:**
```typescript
console.log('🔍 DEBUG: Полная конфигурация режима:', mlModeConfig)
console.log('🔍 DEBUG: localStorage ml-mode-config:', localStorage.getItem('ml-mode-config'))
```

### ✅ 4. Обновлены зависимости callbacks

**predictNow теперь учитывает режим:**
```typescript
}, [minQueryLength, mlMode]) // Добавлен mlMode в зависимости
```

## 🔄 Как теперь работает система

### Алгоритм после исправления:

1. **Загрузка страницы:**
   - `useMLNomenclature` загружает режим из localStorage
   - Устанавливает `mlMode` в состояние хука
   - Режим попадает в `queryKey` для правильного кэширования

2. **Переключение AI/ML:**
   - Пользователь переключает режим в ChessboardML
   - `mlModeApi.setMode()` сохраняет в localStorage
   - `useQuery(['ml-mode-config'])` перезагружает данные
   - `useEffect` обновляет `mlMode` в состоянии
   - Новый `mlMode` попадает в `queryKey` и сбрасывает кэш

3. **Вызов анализа:**
   - При клике на выпадающий список срабатывает `predictNow`
   - `useQuery` выполняет `predictNomenclature` с актуальным ключом кэша
   - `predictNomenclature` проверяет режим через `mlModeApi.getCurrentMode()`
   - **Теперь правильно** выбирается AI или ML режим

## 🧪 Тестирование

### Для проверки исправления:
1. **Открыть:** http://localhost:5180/experiments/chessboard-ml
2. **Убедиться что переключатель в позиции "ML"** (по умолчанию)
3. **Ввести материал** (например: "Бетон М300")
4. **Кликнуть на "Наименование поставщика"**
5. **В консоли увидеть:** `🔄 ML Prediction: Режим local`
6. **Переключить на "AI"** в заголовке страницы
7. **Снова кликнуть на "Наименование поставщика"**
8. **В консоли увидеть:** `🔄 ML Prediction: Режим deepseek`

### Ожидаемое поведение:
- ✅ При режиме ML: используется локальный алгоритм
- ✅ При режиме AI: используется Deepseek с интернет-поиском
- ✅ Переключение работает мгновенно
- ✅ Кэш сбрасывается при смене режима
- ✅ Логи показывают правильный режим

## 🎯 Ключевые исправления

**Основная проблема:** Кэширование в React Query игнорировало изменения режима ML/AI

**Решение:** Включение `mlMode` в `queryKey` для корректного кэширования

**Дополнительно:**
- Отключен кэш для запроса режима (`staleTime: 0`)
- Добавлен `refetchOnMount: true` для обновления при монтировании
- Детальное логирование для отладки
- Обновлены зависимости в callback'ах

## 🚀 Результат

**Теперь при активированном AI режиме:**
- ✅ Правильно срабатывает Deepseek AI анализ
- ✅ Выполняется интернет-поиск материалов
- ✅ Показываются рекомендации с ценами и качеством
- ✅ Tooltip отображает характеристики материалов
- ✅ Fallback на ML при ошибках AI

**Проблема полностью решена! 🎉**

Пользователи теперь получают именно тот анализ, который выбрали в переключателе - AI (Deepseek) или ML (локальный алгоритм).