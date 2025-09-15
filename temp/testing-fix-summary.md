# Исправление ошибки создания проекта из карточки проекта

## 🐛 **Проблема:**
При попытке создать проект из окна "Карточка проекта" возникала ошибка:
```
POST https://hfqgcaxmufzitdfafdlp.supabase.co/rest/v1/projects_blocks?select=* 400 (Bad Request)
null value in column "project_id" of relation "projects_blocks" violates not-null constraint
```

## 🔍 **Анализ причины:**
1. ProjectCardModal ожидал `projectData.id`, но он не передавался
2. В handleShowProjectCard для новых проектов id не был установлен
3. Для существующих проектов id также не передавался в projectData

## ✅ **Исправления:**

### 1. Изменена логика создания нового проекта
В `src/pages/references/Projects.tsx` в функции `handleShowProjectCard`:
- Добавлено создание проекта в БД **до** открытия карточки для новых проектов
- Для режима 'add': создается проект, получается его ID
- Для режима 'edit': использется ID существующего проекта

### 2. Добавлен ID в projectCardData
- Обновлено состояние `projectCardData` с добавлением поля `id`
- Исправлены все вызовы `setProjectCardData` для включения `id: ''`
- Добавлен ID существующего проекта при открытии карточки для просмотра

### 3. Обновлен интерфейс ProjectCardModalProps
- Добавлено обязательное поле `id` в `projectData`

## 🔧 **Технические изменения:**

### Projects.tsx:
```typescript
// Старая логика
const handleShowProjectCard = () => {
  const projectData = {
    name: values.name || '',
    address: values.address || '',
    blocks: [...],
  }
  setProjectCardData(projectData)
}

// Новая логика
const handleShowProjectCard = async () => {
  let projectId: string

  if (modalMode === 'add') {
    // Создаем проект в БД первым делом
    const { data: projectData } = await supabase
      .from('projects')
      .insert({ name: values.name, address: values.address })
      .select()
      .single()

    projectId = projectData.id
  } else {
    projectId = currentProject.id
  }

  const projectCardDataWithId = {
    id: projectId,  // Теперь ID передается!
    name: values.name || '',
    address: values.address || '',
    blocks: [...],
  }
  setProjectCardData(projectCardDataWithId)
}
```

### ProjectCardModal.tsx:
- API теперь получает правильный `projectData.id`
- Создание блоков и связей работает корректно

## 🧪 **Тестирование:**
1. ✅ Создание нового проекта через карточку проекта
2. ✅ Редактирование существующего проекта через карточку
3. ✅ Просмотр существующего проекта через карточку

## 📝 **Результат:**
Ошибка `null value in column "project_id"` исправлена.
Теперь проект создается корректно со всеми блоками, стилобатами и связями.