# 🔥 Критические исправления ML автозаполнения номенклатуры

## 📋 Резюме проблем
1. **ML предложения НЕ заполняли связанную номенклатуру** - callback не срабатывал
2. **ML значения НЕ сохранялись в БД** - некорректная логика сохранения
3. **Infinite renders** из-за нестабильных query настроек

## ✅ Применённые критические исправления

### 1. 🎯 **КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ**: Перенос ML обработки из `onSelect` в `onChange`

**Файл**: `ChessboardTable.tsx:2234-2267`

**Проблема**: AutoComplete отправлял ML предложения через `onChange`, но логика ожидала их в `onSelect`

**Решение**:
```typescript
onChange={async (newValue, option) => {
  // ИСПРАВЛЕНО: Обрабатываем ML предложения в onChange (не onSelect!)
  if (option?.isMLSuggestion) {
    console.log('🤖 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: ML предложение в onChange - вызываем callback')

    // Вызываем callback для ML автозаполнения номенклатуры
    if (onNomenclatureSupplierSelect && option?.nomenclatureSupplierId) {
      onNomenclatureSupplierSelect(
        option.nomenclatureSupplierId,
        option.nomenclatureSupplierName
      )
    }
  }

  // Обновление UI для всех выборов (ML и статических)
  onRowUpdate(record.id, { supplier: newValue || '' })
}}
```

### 2. 🔍 **ДИАГНОСТИЧЕСКИЕ ЛОГИ**: Полное отслеживание автозаполнения

**Файл**: `ChessboardTable.tsx:2333-2408`

**Добавлены логи**:
- Вызов `onNomenclatureSupplierSelect` callback
- Поиск номенклатуры через API по названию поставщика
- Результат поиска номенклатуры
- Подстановка найденной номенклатуры в форму
- Поиск в локальном списке номенклатур
- Успешная подстановка номенклатуры

### 3. 💾 **КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ**: Сохранение ML значений в БД

**Файл**: `useTableOperations.ts:280-317`

**Проблема**: ML поставщики сохранялись только при наличии номенклатуры

**Решение**:
```typescript
// КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Сохраняем поставщика даже без номенклатуры (для ML режима)
const nomenclatureId = updates.nomenclatureId !== undefined ? updates.nomenclatureId : null

// Создаём связь если есть номенклатура ИЛИ просто поставщик (ML режим)
if (nomenclatureId || updates.supplier) {
  promises.push(
    supabase.from('chessboard_nomenclature_mapping').insert({
      chessboard_id: rowId,
      nomenclature_id: nomenclatureId, // может быть null для ML режима
      supplier_name: updates.supplier || null,
    })
  )
}
```

### 4. 🔄 **КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ**: Устранение infinite renders

**Файл**: `useMLNomenclatureSuppliers.ts:58-65`

**Проблема**: `staleTime: 0` и `refetchOnMount: true` вызывали постоянные перезапуски query

**Решение**:
```typescript
// КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Загружаем режим ML/AI со стабилизированным кэшем
const { data: modeConfig } = useQuery({
  queryKey: ['ml-mode-config-nomenclature-suppliers'],
  queryFn: () => mlModeApi.getCurrentMode(),
  staleTime: 30 * 1000,    // ИСПРАВЛЕНО: 30 секунд вместо 0
  gcTime: 5 * 60 * 1000,   // ИСПРАВЛЕНО: 5 минут в памяти
  refetchOnMount: false,   // ИСПРАВЛЕНО: отключаем refetch при mount
})
```

## 🎯 Ожидаемые результаты после исправлений

### ✅ Что должно работать:

1. **ML предложения теперь вызывают callback**:
   - При выборе ML предложения срабатывает `onNomenclatureSupplierSelect`
   - В консоли видны логи: `"🎯 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: onNomenclatureSupplierSelect ВЫЗВАН"`

2. **Автозаполнение номенклатуры работает**:
   - При выборе ML поставщика автоматически подставляется связанная номенклатура
   - В консоли видны логи всего процесса от поиска до подстановки

3. **ML значения сохраняются в БД**:
   - ML поставщики сохраняются даже без связанной номенклатуры
   - В консоли видны логи: `"💾 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Сохраняем в chessboard_nomenclature_mapping"`

4. **Infinite renders устранены**:
   - Исчезли ошибки "Maximum update depth exceeded"
   - Стабильная работа без постоянных перерендеров

### 🔍 Тестирование:

1. Включить режим редактирования строки
2. Кликнуть в поле "Наименование номенклатуры поставщика"
3. Выбрать ML предложение с иконкой 🤖
4. Проверить что поле "Номенклатура" автоматически заполнилось
5. Нажать "Сохранить" и убедиться что данные сохранились

### 📊 Логи для отслеживания:

```
🔄 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: onChange обработка ML предложений
🤖 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: ML предложение в onChange - вызываем callback
🎯 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: onNomenclatureSupplierSelect ВЫЗВАН
🔍 ML АВТОЗАПОЛНЕНИЕ: Поиск номенклатуры через API по названию поставщика
✅ ML АВТОЗАПОЛНЕНИЕ: Номенклатура успешно подставлена в форму
💾 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Сохраняем в chessboard_nomenclature_mapping
```

## 🚀 Статус исправлений: ВЫПОЛНЕНО ✅

Все критические исправления применены и готовы к тестированию.