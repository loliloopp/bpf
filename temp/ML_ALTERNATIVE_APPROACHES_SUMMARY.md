# Альтернативные подходы к сохранению ML предложений

## Проблема
Ошибка 400 Bad Request при попытке сохранить ML предложение с `nomenclature_id: null` в таблицу `chessboard_nomenclature_mapping`.

## Причина
В production схеме БД поле `nomenclature_id` имеет ограничение `NOT NULL` и является частью составного первичного ключа.

## Альтернативные решения

### 1. БЫСТРОЕ ИСПРАВЛЕНИЕ (Рекомендуется)
Модификация существующей таблицы для поддержки ML режима:

**Преимущества:**
- Минимальные изменения в коде
- Сохраняется существующая логика
- Поддерживает оба режима: с номенклатурой и без

**SQL миграция:** `/sql/fix_chessboard_nomenclature_mapping_for_ml.sql`

### 2. СОЗДАНИЕ ОТДЕЛЬНОЙ ТАБЛИЦЫ ДЛЯ ML ПРЕДЛОЖЕНИЙ

```sql
CREATE TABLE public.chessboard_ml_suggestions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    chessboard_id uuid NOT NULL REFERENCES public.chessboard(id) ON DELETE CASCADE,
    supplier_name text NOT NULL,
    confidence_score numeric(3,2), -- 0.00-1.00
    ml_source text, -- 'deepseek', 'openai', 'local' и т.д.
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),

    UNIQUE(chessboard_id, supplier_name)
);
```

**Преимущества:**
- Четкое разделение данных
- Можно хранить дополнительную ML метаинформацию
- Не влияет на существующую схему

**Недостатки:**
- Требует изменения логики во всех местах
- Дублирование запросов для получения данных

### 3. ИСПОЛЬЗОВАНИЕ СПЕЦИАЛЬНОГО UUID ДЛЯ ML ЗАПИСЕЙ

Создать специальную запись в таблице `nomenclature` для ML предложений:

```sql
INSERT INTO public.nomenclature (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', '[ML_SUGGESTION]')
ON CONFLICT (id) DO NOTHING;
```

Затем использовать этот ID для всех ML записей, а реальное название хранить в `supplier_name`.

**Преимущества:**
- Минимальные изменения в схеме БД
- Работает с существующими constraints

**Недостатки:**
- "Хак" в схеме данных
- Может вызвать путаницу в отчетах

### 4. JSONB ПОЛЕ ДЛЯ ХРАНЕНИЯ ML ДАННЫХ

Добавить JSONB поле в таблицу `chessboard` для хранения ML предложений:

```sql
ALTER TABLE public.chessboard
ADD COLUMN ml_suggestions jsonb DEFAULT '[]'::jsonb;

-- Пример структуры:
-- [
--   {
--     "supplier_name": "Плиты минераловатная Технофас Декор",
--     "confidence": 0.95,
--     "source": "deepseek"
--   }
-- ]
```

**Преимущества:**
- Гибкость хранения ML данных
- Не нарушает существующую схему
- Легко добавлять метаданные

**Недостатки:**
- Усложняет запросы с фильтрацией
- Менее нормализованная структура

## Рекомендуемое решение

**РЕКОМЕНДУЮ ВАРИАНТ 1**: Модификация существующей таблицы через SQL миграцию.

### Изменения в коде после применения миграции:

```typescript
// В useTableOperations.ts нужно будет убрать проверку на nomenclatureId
if (updates.supplier) { // Убираем: || nomenclatureId
  console.log('💾 Сохраняем ML предложение:', {
    chessboard_id: rowId,
    nomenclature_id: nomenclatureId, // может быть null
    supplier_name: updates.supplier,
  })

  promises.push(
    supabase.from('chessboard_nomenclature_mapping').insert({
      chessboard_id: rowId,
      nomenclature_id: nomenclatureId, // null разрешён после миграции
      supplier_name: updates.supplier,
    }),
  )
}
```

### Команды для применения исправлений:

```bash
# 1. Применить SQL миграцию к БД
psql "$DATABASE_URL" -f sql/fix_chessboard_nomenclature_mapping_for_ml.sql

# 2. Перезапустить приложение
npm run dev
```

### Проверка успешности:

После применения миграции данный запрос должен работать без ошибок:
```json
{
  "chessboard_id": "ff9fcf43-1c58-492a-9006-6133981d582a",
  "nomenclature_id": null,
  "supplier_name": "Плиты минераловатная Технофас Декор 1200х600х100мм"
}
```