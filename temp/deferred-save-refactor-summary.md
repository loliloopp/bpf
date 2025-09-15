# Переработка логики сохранения: отложенная запись в БД

## 🎯 **Цель:**
Переделать код так, чтобы все данные вносились в базу только после нажатия кнопки "Сохранить" в модальном окне ProjectCardModal. До нажатия никаких записей в БД не должно создаваться.

## 🐛 **Проблема:**
Ранее проект создавался в БД сразу при открытии карточки проекта в функции `handleShowProjectCard`, что противоречило ожидаемому поведению.

## ✅ **Реализованные изменения:**

### 1. Изменение Projects.tsx
**Функция `handleShowProjectCard`:**
- Убрана логика создания проекта в БД
- Убраны вызовы Supabase API
- Теперь просто подготавливает данные для отображения
- Для новых проектов передается пустой `id: ''`

```typescript
// Было
const handleShowProjectCard = async () => {
  // ... создание проекта в БД
  const { data: projectData } = await supabase.from('projects').insert(...)
  projectId = projectData.id
  // ...
}

// Стало
const handleShowProjectCard = () => {
  const projectCardData = {
    id: modalMode === 'add' ? '' : (currentProject?.id || ''),
    name: values.name || '',
    address: values.address || '',
    blocks: // ... маппинг данных
  }
  setProjectCardData(projectCardData)
  setShowProjectCard(true)
}
```

**Функция `handleProjectCardSave`:**
- Обновлен интерфейс для приема данных от карточки
- Добавлены параметры `projectName` и `projectAddress`
- Реализована полная логика создания проекта, блоков, этажей, стилобатов и соединений
- Использует новые API функции из entities/projects

### 2. Изменение ProjectCardModal.tsx
**Интерфейс `ProjectCardModalProps`:**
- Добавлены поля `projectName` и `projectAddress` в callback `onSave`
- ID проекта теперь может быть пустой строкой для новых проектов

**Функция `handleSave`:**
- Убрана вся логика работы с БД
- Теперь просто передает данные родительскому компоненту
- Удалены импорты `blocksApi` и `blockConnectionsApi`

```typescript
// Было
const handleSave = async () => {
  // ... создание блоков, этажей, стилобатов в БД
  for (const block of blocks) {
    const createdBlock = await blocksApi.createBlock(block.name)
    // ...
  }
  await onSave({ blocks, stylobates, undergroundParking })
}

// Стало
const handleSave = async () => {
  await onSave({
    projectName: projectData.name,
    projectAddress: projectData.address,
    blocks,
    stylobates,
    undergroundParking,
  })
}
```

### 3. Перенос бизнес-логики
**Из ProjectCardModal в Projects.tsx:**
- Создание блоков через `blocksApi.createBlock()`
- Привязка блоков к проекту через `blocksApi.linkBlockToProject()`
- Создание этажей через `blocksApi.addFloorsToBlock()`
- Создание стилобатов и соединений через `blockConnectionsApi.createBlockConnection()`
- Обработка типов этажей (Кровля, Типовой корпус, Подземный паркинг)

## 🔧 **Технические детали:**

### Архитектурное решение:
- **Разделение ответственности**: ProjectCardModal отвечает только за UI и валидацию, Projects.tsx — за сохранение в БД
- **Отложенная запись**: Все операции с БД происходят атомарно при нажатии "Сохранить"
- **Консистентность данных**: Если любая операция с БД провалится, весь процесс откатывается

### Поток данных:
1. Пользователь заполняет форму проекта
2. Нажимает "Карточка" → открывается ProjectCardModal без создания проекта в БД
3. Настраивает блоки, стилобаты, подземную парковку в карточке
4. Нажимает "Сохранить" → данные передаются в handleProjectCardSave
5. handleProjectCardSave создает проект и все связанные сущности в БД

### Обработка ошибок:
- Добавлено логирование всех операций
- Используется upsert для предотвращения конфликтов уникальных ключей
- try-catch блоки для каждой критической операции

## 🧪 **Результат:**
- ✅ Проект создается в БД только при нажатии "Сохранить"
- ✅ Все данные (блоки, этажи, стилобаты, соединения) создаются атомарно
- ✅ Улучшена архитектура с разделением ответственности
- ✅ Сохранена вся функциональность создания сложных структур проектов