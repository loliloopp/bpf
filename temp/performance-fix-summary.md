# Исправление проблем производительности и ошибок базы данных

## 🐛 **Проблемы:**
1. Избыточные перерендеры в ProjectCardModal из-за пересоздания объектов на каждом рендере
2. Ошибка 400 Bad Request при создании этажей блоков в block_floor_mapping
3. Несоответствие TypeScript интерфейсов реальной структуре базы данных

## ✅ **Исправления:**

### 1. Оптимизация перерендеров в ProjectCardModal
- Добавлен импорт `useMemo` из React
- Обёрнуты `createBuildingTableData()` и `createTableColumns()` в `useMemo`
- Настроены правильные зависимости для пересчёта
- Удалены ненужные `console.log` из обработчиков событий таблицы

### 2. Исправление ошибок базы данных
- Приведены интерфейсы `Project` и `Block` в соответствие со схемой БД (удалены отсутствующие поля `created_at`, `updated_at`)
- Заменён `insert()` на `upsert()` для предотвращения конфликтов уникальных ключей
- Добавлена валидация данных перед отправкой в БД
- Улучшено логирование для отладки ошибок

### 3. Обработка уникальных ограничений
- Использование `upsert` с параметром `onConflict: 'block_id,floor_number'`
- Добавлены try-catch блоки для детальной обработки ошибок
- Улучшено логирование операций создания блоков и этажей

## 🔧 **Технические изменения:**

### ProjectCardModal.tsx:
```typescript
// Было
const tableData = createBuildingTableData()
const tableColumns = createTableColumns()

// Стало
const tableData = useMemo(() => {
  // логика создания данных
}, [blocks, stylobates, undergroundParking])

const tableColumns = useMemo(() => {
  // логика создания колонок
}, [blocks])
```

### projects-api.ts:
```typescript
// Было
const { data, error } = await supabase.from('block_floor_mapping').insert(floorsData).select()

// Стало
const { error } = await supabase
  .from('block_floor_mapping')
  .upsert(floorsData, {
    onConflict: 'block_id,floor_number',
    ignoreDuplicates: false
  })
```

### types.ts:
```typescript
// Было
export interface Project {
  id: string
  name: string
  address: string
  created_at: string  // <- удалено
  updated_at: string  // <- удалено
}

// Стало
export interface Project {
  id: string
  name: string
  address: string
}
```

## 🧪 **Результат:**
- Устранены избыточные перерендеры компонента ProjectCardModal
- Исправлены ошибки 400 Bad Request при создании этажей
- Приведены TypeScript типы в соответствие с реальной схемой БД
- Добавлена защита от конфликтов уникальных ключей
- Улучшена отладка через детальное логирование