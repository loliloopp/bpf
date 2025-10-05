# Чек-лист выполнения миграции

## ✅ Подготовка (ЗАВЕРШЕНО)

- [x] Созданы SQL скрипты миграции
  - [x] Step 1: Создание структуры БД
  - [x] Step 2: Миграция данных
  - [x] Step 3: Активация новой структуры
  - [x] Rollback скрипт
- [x] Создана документация
  - [x] Инструкции по SQL миграции
  - [x] Инструкции по обновлению TypeScript
  - [x] Общее резюме миграции

---

## 📋 Выполнение миграции БД

### Шаг 1: Создание структуры

```bash
psql "$DATABASE_URL" -f sql/refactor_detail_cost_categories_CORRECT_step1_create_structure.sql
```

**Проверка:**
- [ ] Таблица `detail_cost_categories_new` создана (без `cost_category_id`)
- [ ] Таблица `detail_cost_categories_mapping` создана (тройная связь)
- [ ] Индексы созданы
- [ ] Нет ошибок в выводе

**Ожидаемый вывод:**
```
NOTICE: Шаг 1 завершён: Структура БД создана
NOTICE: Создана таблица: detail_cost_categories_new (БЕЗ cost_category_id)
NOTICE: Создана таблица: detail_cost_categories_mapping (тройная связь)
```

---

### Шаг 2: Миграция данных

```bash
psql "$DATABASE_URL" -f sql/refactor_detail_cost_categories_CORRECT_step2_migrate_data.sql
```

**Проверка:**
- [ ] В `detail_cost_categories_new` 172 записи (уникальные имена)
- [ ] В `detail_cost_categories_mapping` 218 связей
- [ ] Проверка целостности пройдена
- [ ] Устранено 46 дубликатов

**Ожидаемый вывод:**
```
NOTICE: Перенесено уникальных видов затрат: 172 (было 218 записей, 172 уникальных имён)
NOTICE: Создано тройных связей в маппинге: 218
NOTICE: Проверка целостности пройдена: все записи перенесены успешно
NOTICE: Устранено дубликатов: 46 записей
```

**Проверочный запрос:**
```sql
SELECT
    (SELECT COUNT(*) FROM detail_cost_categories_new) as new_count,
    (SELECT COUNT(DISTINCT name) FROM detail_cost_categories_new) as unique_names,
    (SELECT COUNT(*) FROM detail_cost_categories_mapping) as mapping_count;
-- Должно быть: new_count = unique_names = 172, mapping_count = 218
```

- [ ] Выполнен проверочный запрос
- [ ] Результаты соответствуют ожиданиям

---

### Шаг 3: Активация новой структуры

```bash
psql "$DATABASE_URL" -f sql/refactor_detail_cost_categories_CORRECT_step3_replace_tables.sql
```

**Проверка:**
- [ ] Таблица `detail_cost_categories_old` создана (старая версия сохранена)
- [ ] Таблица `detail_cost_categories` активирована (новая версия)
- [ ] Sequence переименован
- [ ] FK constraints добавлены
- [ ] Индексы созданы

**Ожидаемый вывод:**
```
NOTICE: Старая таблица переименована в detail_cost_categories_old
NOTICE: Новая таблица активирована как detail_cost_categories
NOTICE: Sequence переименован в detail_cost_categories_id_seq
NOTICE: Миграция завершена успешно!
NOTICE: Записей в detail_cost_categories: 172 (было: 218)
NOTICE: Тройных связей в маппинге: 218
```

**Проверочные запросы:**

1. **Проверить уникальность имён:**
```sql
SELECT COUNT(*) as total, COUNT(DISTINCT name) as unique_names
FROM detail_cost_categories;
-- Должно быть: total = unique_names = 172
```

2. **Проверить структуру таблицы:**
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'detail_cost_categories'
ORDER BY ordinal_position;
-- НЕ должно быть: cost_category_id, location_id
```

3. **Проверить маппинг:**
```sql
SELECT COUNT(*) as mapping_count,
       COUNT(DISTINCT detail_cost_category_id) as unique_details,
       COUNT(DISTINCT cost_category_id) as unique_categories,
       COUNT(DISTINCT location_id) as unique_locations
FROM detail_cost_categories_mapping;
-- Должно быть: mapping_count = 218
```

4. **Примеры тройных связей:**
```sql
SELECT
    cc.name AS category_name,
    dc.name AS detail_name,
    l.name AS location_name
FROM detail_cost_categories_mapping m
JOIN cost_categories cc ON m.cost_category_id = cc.id
JOIN detail_cost_categories dc ON m.detail_cost_category_id = dc.id
JOIN location l ON m.location_id = l.id
ORDER BY cc.name, dc.name, l.name
LIMIT 10;
```

- [ ] Все проверочные запросы выполнены
- [ ] Результаты соответствуют ожиданиям

---

## 🔧 Обновление TypeScript кода

### Предварительный анализ

- [ ] Прочитан файл `src/pages/references/CostCategories.tsx`
- [ ] Размер файла: **1125 строк** (превышает максимум 600 строк)
- [ ] Решено: разбить на компоненты или обновить как есть?

**Рекомендация:** Разбить на компоненты перед обновлением.

---

### Обновление типов данных

См. `temp/TYPESCRIPT_UPDATE_INSTRUCTIONS.md`

- [ ] Обновлён интерфейс `DetailCategory`
  - [ ] Удалено поле `costCategoryId`
  - [ ] Изменено поле `locations` на `mappings`
  - [ ] Добавлены поля в `mappings`: `costCategoryId`, `costCategoryName`, `locationId`, `locationName`

- [ ] Обновлён интерфейс `DetailCategoryRowDB`
  - [ ] Удалено поле `cost_category_id`
  - [ ] Изменено поле `detail_cost_categories_location_mapping` на `detail_cost_categories_mapping`
  - [ ] Добавлены поля в маппинг: `cost_category_id`, `cost_categories`, `location_id`, `location`

- [ ] Обновлён интерфейс `TableRow` (если используется подход "одна строка на тройную связь")

---

### Обновление API запросов

- [ ] Изменён запрос для получения `detail_categories`
  - [ ] Используется таблица `detail_cost_categories_mapping`
  - [ ] JOIN с `cost_categories` и `location`
  - [ ] Удалена ссылка на `cost_category_id` в основной таблице

- [ ] Обновлена трансформация данных
  - [ ] Используется `mappings` вместо `locations`
  - [ ] Добавлены `costCategoryId` и `costCategoryName` в каждый mapping

---

### Обновление логики добавления/редактирования

- [ ] Создание нового вида затрат
  - [ ] Шаг 1: Создать запись в `detail_cost_categories` (БЕЗ `cost_category_id` и `location_id`)
  - [ ] Шаг 2: Создать тройную связь в `detail_cost_categories_mapping`

- [ ] Обновление вида затрат
  - [ ] Обновляются только базовые поля (`name`, `description`, `unit_id`)
  - [ ] НЕ обновляются `cost_category_id` и `location_id`

- [ ] Добавление/удаление связей
  - [ ] Реализована функция добавления тройной связи
  - [ ] Реализована функция удаления тройной связи

---

### Обновление отображения данных

- [ ] Преобразование данных для таблицы
  - [ ] Используется `flatMap` по `mappings`
  - [ ] Каждая строка таблицы = одна тройная связь

- [ ] Фильтрация данных
  - [ ] Фильтр по `categoryId`
  - [ ] Фильтр по `detailId`
  - [ ] Фильтр по `locationId`

---

### Обновление Excel импорта

- [ ] Реализована логика "найти или создать" вид затрат
- [ ] После создания/нахождения вида создаётся тройная связь

---

## 🧪 Тестирование

### Тестирование БД

- [ ] Проверить уникальность имён в `detail_cost_categories`
- [ ] Проверить количество связей в `detail_cost_categories_mapping` (218)
- [ ] Проверить примеры тройных связей

### Тестирование UI

- [ ] Открыть страницу "Категории затрат"
- [ ] Проверить отображение данных
- [ ] Добавить новый вид затрат
- [ ] Отредактировать существующий вид затрат
- [ ] Удалить вид затрат
- [ ] Проверить фильтрацию по категориям
- [ ] Проверить фильтрацию по видам затрат
- [ ] Проверить фильтрацию по локализациям

### Тестирование Excel импорта

- [ ] Подготовить тестовый Excel файл
- [ ] Импортировать данные
- [ ] Проверить создание новых видов затрат
- [ ] Проверить создание тройных связей

---

## 🎯 Финализация

### Очистка

- [ ] Удалить старые SQL скрипты (неправильные версии)
  - [ ] `sql/refactor_detail_cost_categories_step1_create_structure.sql`
  - [ ] `sql/refactor_detail_cost_categories_step2_migrate_data.sql`
  - [ ] `sql/refactor_detail_cost_categories_step3_replace_tables.sql`

- [ ] Удалить временные диагностические скрипты
  - [ ] `sql/check_duplicates.sql`
  - [ ] `sql/check_table_structure.sql`
  - [ ] `sql/check_name_across_categories.sql`
  - [ ] `sql/debug_new_table_duplicates.sql`
  - [ ] `sql/solution_option1_unique_per_category.sql`
  - [ ] `sql/solution_option2_global_unique_with_suffix.sql`

- [ ] Удалить старую таблицу БД (после успешного тестирования)
```sql
DROP TABLE IF EXISTS detail_cost_categories_old CASCADE;
```

### Документация

- [ ] Обновить комментарии в коде
- [ ] Обновить README (если требуется)
- [ ] Архивировать файлы из `temp/` в постоянное хранилище (если нужно)

---

## 📝 Заметки

**Дата начала миграции:** 2025-10-05
**Дата завершения:** _____________

**Проблемы:**
-

**Решения:**
-

---

## ✅ Итоговый чек-лист

- [ ] SQL миграция выполнена успешно
- [ ] TypeScript код обновлён
- [ ] Все тесты пройдены
- [ ] Старая таблица удалена
- [ ] Документация обновлена
- [ ] Миграция завершена! 🎉
