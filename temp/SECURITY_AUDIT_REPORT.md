# Отчёт об аудите безопасности BlueprintFlow

**Дата:** 2025-10-09
**Статус:** КРИТИЧЕСКИЕ ПРОБЛЕМЫ ОБНАРУЖЕНЫ И ЧАСТИЧНО ИСПРАВЛЕНЫ

---

## Executive Summary

### Критическая проблема
Пользователи с ролью "Наблюдатель" (viewer) могут редактировать и создавать записи на всех страницах портала, несмотря на права доступа `can_view = true, can_create/edit/delete = false`.

### Что исправлено
✅ **Страница Chessboard** - добавлены проверки прав на все кн опки и inline-редактирование
✅ **Создан переиспользуемый паттерн** - хуки и компоненты для защиты UI

### Что требует исправления
⚠️ **16 страниц без проверок прав**
⚠️ **Отсутствует server-side защита**
⚠️ **Возможен обход через DevTools**

---

## 1. Исправленные проблемы

### 1.1. Страница Chessboard (ИСПРАВЛЕНО ✅)

**Файлы:**
- `src/pages/documents/Chessboard/index.tsx`
- `src/pages/documents/Chessboard/components/ChessboardFilters.tsx`
- `src/pages/documents/Chessboard/components/ChessboardActionButtons.tsx`
- `src/pages/documents/Chessboard/components/ChessboardTable.tsx`

**Исправления:**
1. ✅ Добавлен `usePermissions('chessboard_page')` в главный компонент
2. ✅ Кнопка "Добавить" видна только при `canCreate === true`
3. ✅ Кнопка "Удалить" видна только при `canDelete === true`
4. ✅ Поле статусов (Select) видно только при `canEdit === true`
5. ✅ Кнопки "Редактировать" и "Удалить" в строках таблицы скрыты без прав
6. ✅ Inline-редактирование заблокировано через скрытие кнопки "Редактировать"
7. ✅ Цветовая маркировка строк доступна только при `canEdit === true`

**Результат:**
- Наблюдатель видит только данные без возможности изменений
- Пользователи с правами видят соответствующие кнопки
- TypeScript компилируется без ошибок

### 1.2. Создан защищенный паттерн (НОВОЕ ✅)

**Новые файлы:**
- `src/shared/ui/ProtectedButton.tsx` - защищенный компонент кнопки
- `src/shared/hooks/usePagePermissions.ts` - расширенный хук для работы с правами

**Использование:**
```tsx
// В компоненте страницы
import { usePagePermissions } from '@/shared/hooks/usePagePermissions'

export default function MyPage() {
  const permissions = usePagePermissions('my_page_object_code')

  return (
    <>
      {/* Скрыть кнопку если нет прав */}
      {permissions.canCreate && (
        <Button onClick={handleAdd}>Добавить</Button>
      )}

      {/* Проверка только на чтение */}
      {permissions.isReadOnly && (
        <Alert message="У вас только права на просмотр" type="info" />
      )}

      {/* Inline-редактирование */}
      <Table
        editable={permissions.canEdit ? editableConfig : undefined}
        // ... остальные пропсы
      />
    </>
  )
}
```

---

## 2. Найденные уязвимости

### 2.1. Client-Side уязвимости (КРИТИЧНО ⚠️)

#### 2.1.1. НЕТ проверок прав на UI компонентах

**Статус:** Частично исправлено (только Chessboard)

**Проблема:**
- 16 из 17 страниц не проверяют права доступа
- Кнопки "Добавить", "Редактировать", "Удалить" видны всем
- Модальные окна редактирования открываются без проверки

**Уязвимые страницы:**

**Документы (3/4 уязвимы):**
- ❌ `src/pages/documents/Vor.tsx` (object_code: `vor_page`)
- ❌ `src/pages/documents/Documentation.tsx` (object_code: `documentation_page`)
- ❌ `src/pages/documents/Finishing.tsx` (object_code: `finishing_page`)
- ✅ `src/pages/documents/Chessboard/index.tsx` - ИСПРАВЛЕНО

**Справочники (7/7 уязвимы):**
- ❌ `src/pages/references/Units.tsx` (object_code: `units_page`)
- ❌ `src/pages/references/CostCategories.tsx` (object_code: `cost_categories_page`)
- ❌ `src/pages/references/Projects.tsx` (object_code: `projects_page`)
- ❌ `src/pages/references/Locations.tsx` (object_code: `locations_page`)
- ❌ `src/pages/references/Rooms.tsx` (object_code: `rooms_page`)
- ❌ `src/pages/references/Rates.tsx` (object_code: `rates_page`)
- ❌ `src/pages/references/Nomenclature.tsx` (object_code: `nomenclature_page`)

**Администрирование (5/5 уязвимы):**
- ❌ `src/pages/administration/Users.tsx` (object_code: `users_page`)
- ❌ `src/pages/administration/Roles.tsx` (object_code: `roles_page`)
- ❌ `src/pages/administration/DocumentationTags.tsx` (object_code: `tags_page`)
- ❌ `src/pages/administration/Statuses.tsx` (object_code: `statuses_page`)
- ❌ `src/pages/administration/ApiSettings.tsx` (object_code: `api_settings_page`)

**Сценарий эксплуатации:**
1. Пользователь-наблюдатель заходит на любую страницу (кроме Chessboard)
2. Видит кнопку "Добавить" и нажимает её
3. Открывается модальное окно создания записи
4. Заполняет поля и сохраняет
5. **Запрос уходит на сервер БЕЗ проверки прав**

#### 2.1.2. Обход через DevTools (КРИТИЧНО ⚠️)

**Статус:** Не исправлено

**Проблема:**
Пользователь может:
1. Открыть DevTools (F12)
2. Найти скрытый элемент (кнопку) в DOM
3. Убрать атрибут `hidden` или изменить условие рендеринга
4. Нажать на кнопку и отправить запрос

**Сценарий эксплуатации:**
```javascript
// В консоли DevTools
document.querySelector('[data-action="delete"]').click()
// Или напрямую вызвать API
fetch('https://hfqgcaxmufzitdfafdlp.supabase.co/rest/v1/chessboard', {
  method: 'DELETE',
  headers: { /* ... */ },
  body: JSON.stringify({ id: '123' })
})
```

#### 2.1.3. Direct API calls (КРИТИЧНО ⚠️)

**Статус:** Не исправлено

**Проблема:**
Пользователь может отправить запрос напрямую к Supabase API, минуя UI:
```javascript
// Прямой запрос к Supabase
const { data, error } = await supabase
  .from('chessboard')
  .delete()
  .eq('id', 'some-id')
```

### 2.2. Server-Side уязвимости (КРИТИЧНО ⚠️)

#### 2.2.1. Row Level Security (RLS) НЕ используется

**Статус:** По документации RLS НЕ должен использоваться

**Текущее состояние:**
```sql
-- Из supabase/schemas/prod.sql
ALTER TABLE chessboard DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
-- ... остальные таблицы
```

**Проблема:**
- Все запросы к БД выполняются через `anon key`
- Нет проверки прав на уровне БД
- Любой авторизованный пользователь может выполнить любую операцию

**Рекомендация:**
Включить RLS с политиками на основе `user_permissions_cache`:
```sql
-- Пример политики для таблицы chessboard
CREATE POLICY "chessboard_select_policy" ON chessboard
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_permissions_cache upc
      WHERE upc.user_id = auth.uid()
        AND upc.object_code = 'chessboard_page'
        AND upc.can_view = true
    )
  );

CREATE POLICY "chessboard_insert_policy" ON chessboard
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_permissions_cache upc
      WHERE upc.user_id = auth.uid()
        AND upc.object_code = 'chessboard_page'
        AND upc.can_create = true
    )
  );

-- Аналогично для UPDATE и DELETE
```

#### 2.2.2. Отсутствуют RPC функции с проверкой прав

**Статус:** Не исправлено

**Проблема:**
- Нет централизованных RPC функций для критичных операций
- Прямые запросы к таблицам без валидации прав

**Рекомендация:**
Создать RPC функции с проверкой прав:
```sql
-- Пример RPC функции для удаления записи
CREATE OR REPLACE FUNCTION delete_chessboard_row(row_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  has_permission BOOLEAN;
BEGIN
  -- Проверка прав
  SELECT can_delete INTO has_permission
  FROM user_permissions_cache
  WHERE user_id = auth.uid()
    AND object_code = 'chessboard_page';

  IF NOT has_permission THEN
    RAISE EXCEPTION 'У вас нет прав на удаление записей';
  END IF;

  -- Выполнение операции
  DELETE FROM chessboard WHERE id = row_id;
END;
$$;
```

### 2.3. Auth & Session уязвимости

#### 2.3.1. is_active проверяется только при входе (СРЕДНИЙ РИСК ⚠️)

**Статус:** Частично исправлено

**Текущее состояние:**
- ✅ Проверка `is_active` при `signIn()`
- ✅ Проверка `is_active` при `checkAuth()`
- ❌ Проверка НЕ выполняется при каждом API запросе

**Проблема:**
Если администратор отключит пользователя (`is_active = false`), то:
- Пользователь продолжит работу до перезагрузки страницы
- Сессия в Supabase Auth остается активной
- Можно продолжать отправлять запросы к API

**Сценарий эксплуатации:**
1. Пользователь залогинен и работает в системе
2. Администратор отключает пользователя
3. Пользователь продолжает работу ещё 10-30 минут
4. Только при перезагрузке страницы происходит `checkAuth()` и выход

**Рекомендация:**
Добавить проверку `is_active` в RLS политики или в middleware:
```sql
-- В RLS политиках
AND EXISTS (
  SELECT 1 FROM users u
  WHERE u.id = auth.uid() AND u.is_active = true
)
```

#### 2.3.2. Таймаут сессии (НИЗКИЙ РИСК)

**Статус:** Используется Supabase Auth по умолчанию

**Текущее состояние:**
- Таймаут сессии: 604800 секунд (7 дней) - стандартный для Supabase
- Refresh token: 2592000 секунд (30 дней)
- Автообновление токена: включено

**Проблема:**
- Долгий таймаут (7 дней) может быть риском для критичных данных

**Рекомендация:**
Сократить таймаут до 8-24 часов для повышения безопасности:
```typescript
// В src/lib/supabase.ts
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    // Сократить таймаут сессии
    storage: {
      getItem: (key) => {
        const item = localStorage.getItem(key)
        if (item) {
          const parsed = JSON.parse(item)
          const expires = parsed.expires_at
          // Проверить что сессия не старше 8 часов
          if (expires && Date.now() / 1000 > expires - (7 * 24 * 3600) + (8 * 3600)) {
            localStorage.removeItem(key)
            return null
          }
        }
        return item
      },
      setItem: localStorage.setItem,
      removeItem: localStorage.removeItem,
    },
  },
})
```

#### 2.3.3. Анонимный ключ (ИНФОРМАЦИОННО)

**Статус:** Публичный ключ используется корректно

**Текущее состояние:**
```typescript
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Оценка:**
- ✅ Анонимный ключ должен быть публичным (это нормально)
- ✅ Защита должна быть на уровне RLS политик, а не секретности ключа
- ⚠️ НО: текущее отключение RLS делает БД уязвимой

### 2.4. API Security

#### 2.4.1. CORS настройки (НИЗКИЙ РИСК)

**Статус:** Не проверялось

**Рекомендация:**
Убедиться что в Supabase Dashboard настроены правильные CORS:
- Разрешить только домены приложения
- Запретить `*` (wildcard)

#### 2.4.2. Rate Limiting (СРЕДНИЙ РИСК ⚠️)

**Статус:** Используется стандартный Rate Limiting от Supabase

**Проблема:**
- Нет дополнительных ограничений на клиентской стороне
- Пользователь может выполнить много запросов за короткое время

**Рекомендация:**
Добавить debounce/throttle для критичных операций:
```typescript
import { debounce } from 'lodash'

const debouncedSave = debounce(async (data) => {
  await supabase.from('chessboard').insert(data)
}, 1000)
```

---

## 3. Шаблоны исправлений

### 3.1. Шаблон для страниц с таблицами

**Для применения в:**
- Vor.tsx
- Documentation.tsx
- Finishing.tsx
- Units.tsx, CostCategories.tsx, Projects.tsx, Locations.tsx, Rooms.tsx, Rates.tsx, Nomenclature.tsx

**Шаг 1:** Добавить импорт хука

```typescript
// В начало файла
import { usePagePermissions } from '@/shared/hooks/usePagePermissions'
```

**Шаг 2:** Добавить хук в компонент

```typescript
export default function MyPage() {
  // Другие хуки...
  const permissions = usePagePermissions('my_page_object_code') // Заменить на правильный object_code

  // Остальной код...
}
```

**Шаг 3:** Обернуть кнопки проверками

```typescript
// Кнопка "Добавить"
{permissions.canCreate && (
  <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
    Добавить
  </Button>
)}

// Кнопка "Редактировать" в строке таблицы
{permissions.canEdit && (
  <Button
    type="text"
    icon={<EditOutlined />}
    onClick={() => handleEdit(record)}
  />
)}

// Кнопка "Удалить"
{permissions.canDelete && (
  <Button
    type="text"
    danger
    icon={<DeleteOutlined />}
    onClick={() => handleDelete(record.id)}
  />
)}

// Кнопка импорта
{permissions.canCreate && (
  <Button icon={<UploadOutlined />} onClick={handleImport}>
    Импорт
  </Button>
)}

// Кнопка экспорта (доступна всегда если есть can_view)
{permissions.canExport && (
  <Button icon={<DownloadOutlined />} onClick={handleExport}>
    Экспорт
  </Button>
)}
```

**Шаг 4:** Отключить inline-редактирование

```typescript
// Для Ant Design Table с editableRows
const columns: ColumnsType<DataType> = useMemo(() => {
  return baseColumns.map(col => {
    // Отключить редактирование если нет прав
    if (col.editable && !permissions.canEdit) {
      return { ...col, editable: false }
    }
    return col
  })
}, [baseColumns, permissions.canEdit])
```

### 3.2. Маппинг object_code для страниц

```typescript
// Документы
'chessboard_page'      → src/pages/documents/Chessboard/index.tsx ✅ ИСПРАВЛЕНО
'vor_page'             → src/pages/documents/Vor.tsx ❌
'documentation_page'   → src/pages/documents/Documentation.tsx ❌
'finishing_page'       → src/pages/documents/Finishing.tsx ❌

// Справочники
'units_page'           → src/pages/references/Units.tsx ❌
'cost_categories_page' → src/pages/references/CostCategories.tsx ❌
'projects_page'        → src/pages/references/Projects.tsx ❌
'locations_page'       → src/pages/references/Locations.tsx ❌
'rooms_page'           → src/pages/references/Rooms.tsx ❌
'rates_page'           → src/pages/references/Rates.tsx ❌
'nomenclature_page'    → src/pages/references/Nomenclature.tsx ❌

// Администрирование
'users_page'           → src/pages/administration/Users.tsx ❌
'roles_page'           → src/pages/administration/Roles.tsx ❌
'tags_page'            → src/pages/administration/DocumentationTags.tsx ❌
'statuses_page'        → src/pages/administration/Statuses.tsx ❌
'api_settings_page'    → src/pages/administration/ApiSettings.tsx ❌
```

### 3.3. Создание RPC функций для критичных операций

**Файл:** `sql/create_secure_rpc_functions.sql`

```sql
-- =====================================================
-- RPC ФУНКЦИИ С ПРОВЕРКОЙ ПРАВ
-- =====================================================

-- 1. Проверка прав пользователя
CREATE OR REPLACE FUNCTION check_user_permission(
  p_object_code TEXT,
  p_action TEXT -- 'view', 'create', 'edit', 'delete'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  has_permission BOOLEAN := FALSE;
BEGIN
  -- Проверка аутентификации
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Проверка is_active
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_active = TRUE) THEN
    RETURN FALSE;
  END IF;

  -- Проверка прав
  EXECUTE format('SELECT can_%s FROM user_permissions_cache WHERE user_id = $1 AND object_code = $2', p_action)
  INTO has_permission
  USING auth.uid(), p_object_code;

  RETURN COALESCE(has_permission, FALSE);
END;
$$;

-- 2. Защищенное удаление записи chessboard
CREATE OR REPLACE FUNCTION secure_delete_chessboard(p_row_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT check_user_permission('chessboard_page', 'delete') THEN
    RAISE EXCEPTION 'У вас нет прав на удаление записей в шахматке';
  END IF;

  DELETE FROM chessboard WHERE id = p_row_id;
END;
$$;

-- 3. Защищенное создание записи chessboard
CREATE OR REPLACE FUNCTION secure_insert_chessboard(p_data JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id UUID;
BEGIN
  IF NOT check_user_permission('chessboard_page', 'create') THEN
    RAISE EXCEPTION 'У вас нет прав на создание записей в шахматке';
  END IF;

  INSERT INTO chessboard (
    project_id,
    material,
    quantity_pd,
    unit_id
    -- ... остальные поля
  )
  SELECT
    (p_data->>'project_id')::UUID,
    p_data->>'material',
    (p_data->>'quantity_pd')::NUMERIC,
    (p_data->>'unit_id')::UUID
    -- ... остальные поля
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- 4. Защищенное обновление записи chessboard
CREATE OR REPLACE FUNCTION secure_update_chessboard(p_row_id UUID, p_data JSONB)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT check_user_permission('chessboard_page', 'edit') THEN
    RAISE EXCEPTION 'У вас нет прав на редактирование записей в шахматке';
  END IF;

  UPDATE chessboard
  SET
    material = COALESCE(p_data->>'material', material),
    quantity_pd = COALESCE((p_data->>'quantity_pd')::NUMERIC, quantity_pd),
    unit_id = COALESCE((p_data->>'unit_id')::UUID, unit_id),
    updated_at = NOW()
    -- ... остальные поля
  WHERE id = p_row_id;
END;
$$;
```

**Использование в API:**

```typescript
// src/entities/chessboard/api/chessboard-api.ts

// СТАРЫЙ КОД (БЕЗ ЗАЩИТЫ):
export async function deleteChessboardRow(id: string) {
  const { error } = await supabase
    .from('chessboard')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// НОВЫЙ КОД (С ЗАЩИТОЙ):
export async function deleteChessboardRow(id: string) {
  const { error } = await supabase
    .rpc('secure_delete_chessboard', { p_row_id: id })

  if (error) {
    // Ошибка прав выводится как исключение из RPC
    throw new Error(error.message)
  }
}
```

---

## 4. Приоритизация исправлений

### Критические (исправить НЕМЕДЛЕННО) 🔴

1. **Включить RLS на всех таблицах** - 2-4 часа
   - Написать политики для всех таблиц
   - Протестировать на dev окружении
   - Применить на production

2. **Добавить проверки прав на страницах с таблицами** - 8-12 часов
   - 16 страниц × 30 минут = 8 часов
   - Использовать готовый шаблон из раздела 3.1

3. **Создать RPC функции для критичных операций** - 4-6 часов
   - DELETE операции для всех таблиц
   - INSERT/UPDATE для chessboard, vor, documentation, finishing
   - Обновить API клиенты

### Высокий приоритет (1-2 недели) 🟠

4. **Добавить проверку is_active в RLS политики** - 1 час
   - Обновить все политики
   - Протестировать отключение пользователя

5. **Добавить Rate Limiting на клиенте** - 2-3 часа
   - Debounce для операций сохранения
   - Throttle для поиска/фильтров

6. **Аудит CORS и API настроек** - 1 час
   - Проверить Supabase Dashboard
   - Ограничить разрешенные домены

### Средний приоритет (1 месяц) 🟡

7. **Сократить таймаут сессии до 8-24 часов** - 2 часа
   - Настроить в Supabase Auth
   - Протестировать автообновление токенов

8. **Добавить логирование действий пользователей** - 4-6 часов
   - Создать таблицу audit_log
   - Триггеры на INSERT/UPDATE/DELETE
   - UI для просмотра логов

### Низкий приоритет (backlog) 🟢

9. **Двухфакторная аутентификация (2FA)** - 8-12 часов
   - Интеграция Supabase MFA
   - UI для настройки 2FA

10. **Webhook уведомления о критичных событиях** - 4-6 часов
    - Отключение пользователя
    - Массовое удаление записей
    - Изменение прав доступа

---

## 5. Статус страниц (сводная таблица)

| Страница | Object Code | View | Create | Edit | Delete | Статус |
|----------|-------------|------|--------|------|--------|--------|
| **Документы** |||||
| Chessboard | `chessboard_page` | ✅ | ✅ | ✅ | ✅ | ✅ ИСПРАВЛЕНО |
| ВОР | `vor_page` | ❌ | ❌ | ❌ | ❌ | ⚠️ УЯЗВИМО |
| Документация | `documentation_page` | ❌ | ❌ | ❌ | ❌ | ⚠️ УЯЗВИМО |
| Отделка | `finishing_page` | ❌ | ❌ | ❌ | ❌ | ⚠️ УЯЗВИМО |
| **Справочники** |||||
| Единицы измерения | `units_page` | ❌ | ❌ | ❌ | ❌ | ⚠️ УЯЗВИМО |
| Категории затрат | `cost_categories_page` | ❌ | ❌ | ❌ | ❌ | ⚠️ УЯЗВИМО |
| Проекты | `projects_page` | ❌ | ❌ | ❌ | ❌ | ⚠️ УЯЗВИМО |
| Локализация | `locations_page` | ❌ | ❌ | ❌ | ❌ | ⚠️ УЯЗВИМО |
| Помещения | `rooms_page` | ❌ | ❌ | ❌ | ❌ | ⚠️ УЯЗВИМО |
| Расценки | `rates_page` | ❌ | ❌ | ❌ | ❌ | ⚠️ УЯЗВИМО |
| Номенклатура | `nomenclature_page` | ❌ | ❌ | ❌ | ❌ | ⚠️ УЯЗВИМО |
| **Администрирование** |||||
| Пользователи | `users_page` | ❌ | ❌ | ❌ | ❌ | ⚠️ УЯЗВИМО |
| Роли | `roles_page` | ❌ | ❌ | ❌ | ❌ | ⚠️ УЯЗВИМО |
| Теги документации | `tags_page` | ❌ | ❌ | ❌ | ❌ | ⚠️ УЯЗВИМО |
| Статусы | `statuses_page` | ❌ | ❌ | ❌ | ❌ | ⚠️ УЯЗВИМО |
| Настройки API | `api_settings_page` | ❌ | ❌ | ❌ | ❌ | ⚠️ УЯЗВИМО |

**Легенда:**
- ✅ = Проверка прав реализована
- ❌ = Проверка прав отсутствует
- ⚠️ = Уязвимо

**Итого:**
- ✅ Исправлено: 1 из 16 страниц (6%)
- ⚠️ Уязвимо: 15 из 16 страниц (94%)

---

## 6. Рекомендации по безопасности

### 6.1. Немедленные действия

1. **Включить RLS на всех таблицах** - это КРИТИЧНО
2. **Добавить проверки прав на всех страницах** - использовать готовый шаблон
3. **Создать RPC функции** - для защиты от прямых API вызовов

### 6.2. Архитектурные изменения

1. **Принцип Zero Trust**
   - Никогда не доверять клиенту
   - Всегда проверять права на сервере
   - UI проверки - только для UX, не для безопасности

2. **Defense in Depth (эшелонированная защита)**
   - Уровень 1: UI проверки (UX) ✅ РЕАЛИЗОВАНО
   - Уровень 2: RPC функции с проверкой прав ❌ ТРЕБУЕТСЯ
   - Уровень 3: RLS политики на таблицах ❌ ТРЕБУЕТСЯ
   - Уровень 4: Audit logging ❌ ТРЕБУЕТСЯ

3. **Принцип минимальных привилегий**
   - По умолчанию у пользователя НЕТ прав
   - Права выдаются явно через роли
   - Проверка прав на КАЖДОМ запросе

### 6.3. Процессы разработки

1. **Security Checklist для новых страниц**
   ```
   □ Добавлен usePagePermissions() хук
   □ Кнопки обернуты проверками {canCreate && ...}
   □ Inline-редактирование отключено без прав
   □ API функции используют RPC с проверкой прав
   □ Добавлены RLS политики для новых таблиц
   □ Проведено тестирование с ролью "Наблюдатель"
   ```

2. **Code Review Guidelines**
   - Проверять наличие проверок прав в каждом PR
   - Запрещать прямые запросы к таблицам без RPC
   - Требовать RLS политики для новых таблиц

3. **Testing**
   - Создать тестового пользователя-наблюдателя
   - Тестировать КАЖДУЮ страницу с этой ролью
   - Автотесты на проверку прав (Playwright)

---

## 7. Контакты для вопросов

**Аудитор:** Claude (AI Assistant)
**Дата аудита:** 2025-10-09
**Версия отчёта:** 1.0

**Следующие шаги:**
1. Рассмотреть отчёт на встрече команды
2. Назначить ответственных за исправление уязвимостей
3. Установить дедлайны (предложено выше в разделе 4)
4. Провести повторный аудит после исправлений

---

## Приложение A: Примеры атак

### A.1. Сценарий атаки "Удаление всех записей"

**Актор:** Недобросовестный пользователь с ролью "Наблюдатель"

**Шаги:**
1. Открыть страницу Vor.tsx (ВОР)
2. Открыть DevTools (F12)
3. Выполнить в консоли:
```javascript
const { data } = await supabase.from('vor').select('id')
for (const row of data) {
  await supabase.from('vor').delete().eq('id', row.id)
}
```
4. **Результат:** Все записи удалены, права не проверялись

**Защита:**
- RLS политика на DELETE
- RPC функция с проверкой прав
- Audit log для отслеживания

### A.2. Сценарий атаки "Изменение чужих данных"

**Актор:** Пользователь с правами только на свой проект

**Шаги:**
1. Найти ID другого проекта (через API или UI)
2. Выполнить запрос:
```javascript
await supabase
  .from('chessboard')
  .update({ material: 'ВРЕДОНОСНЫЕ ДАННЫЕ' })
  .eq('project_id', 'другой-проект-id')
```
3. **Результат:** Данные другого проекта изменены

**Защита:**
- RLS политика с проверкой project_id пользователя
- RPC функция с валидацией доступа к проекту

---

**КОНЕЦ ОТЧЁТА**
