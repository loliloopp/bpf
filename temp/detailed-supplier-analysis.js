// Детальный анализ проблем алгоритмов поиска поставщиков
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hfqgcaxmufzitdfafdlp.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmcWdjYXhtdWZ6aXRkZmFmZGxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4OTI5MjMsImV4cCI6MjA3MDQ2ODkyM30.XnOEKdwZdJM-DilhrjZ7PdzHU2rx3L72oQ1rJYo5pXc'

const supabase = createClient(supabaseUrl, supabaseKey)

// Детальный анализ проблем каждого алгоритма
async function analyzeProblems() {
  console.log('🔍 ДЕТАЛЬНЫЙ АНАЛИЗ ПРОБЛЕМ АЛГОРИТМОВ')
  console.log('=' .repeat(80))

  // Проблема 1: Алгоритм 2 (векторный) не находит простые материалы
  console.log('\n❌ ПРОБЛЕМА 1: Алгоритм 2 (векторный) не работает на простом материале "пеноплэкс"')

  const { data: penoplexData } = await supabase
    .from('supplier_names')
    .select('id, name')
    .ilike('name', '%пеноплэкс%')

  console.log('🔍 Найденные записи с "пеноплэкс":')
  penoplexData?.forEach((item, index) => {
    console.log(`  ${index + 1}. "${item.name}"`)

    // Тестируем векторный алгоритм на каждой записи
    const itemName = item.name.toLowerCase()
    const searchTerms = 'пеноплэкс'.toLowerCase().split(/\s+/)
    let confidence = 0

    searchTerms.forEach(term => {
      if (itemName.includes(term)) {
        confidence += 0.3
        console.log(`    ✅ Содержит "${term}": +0.3`)
      }
      if (itemName.startsWith(term)) {
        confidence += 0.2
        console.log(`    ✅ Начинается с "${term}": +0.2`)
      }
      if (itemName.endsWith(term)) {
        confidence += 0.1
        console.log(`    ✅ Заканчивается на "${term}": +0.1`)
      }
    })

    console.log(`    📊 Итоговый confidence: ${confidence}`)
    console.log(`    ${confidence > 0.1 ? '✅' : '❌'} Проходит фильтр (> 0.1): ${confidence > 0.1}`)
  })

  // Проблема 2: Алгоритм 3 (семантический) слишком строгий фильтр
  console.log('\n❌ ПРОБЛЕМА 2: Алгоритм 3 (семантический) имеет слишком строгий фильтр relevanceScore > 0.5')

  console.log('\n🔍 Тестируем на "пеноплэкс" с разными порогами:')
  for (const threshold of [0.1, 0.3, 0.5, 1.0]) {
    console.log(`\n📊 Порог relevanceScore > ${threshold}:`)

    penoplexData?.forEach((item, index) => {
      const itemName = item.name.toLowerCase()
      const processedQuery = 'пеноплэкс'
      const originalKeywords = ['пеноплэкс']

      let relevanceScore = 0
      const matchedKeywords = []

      // Точное совпадение фразы
      if (itemName.includes(processedQuery)) {
        relevanceScore += 10
        matchedKeywords.push('точное совпадение')
      }

      // Анализ по словам
      originalKeywords.forEach(keyword => {
        if (itemName.includes(keyword)) {
          relevanceScore += 3
          matchedKeywords.push(keyword)
        }
      })

      console.log(`  ${index + 1}. "${item.name}"`)
      console.log(`      Score: ${relevanceScore}, Keywords: [${matchedKeywords.join(', ')}]`)
      console.log(`      ${relevanceScore > threshold ? '✅' : '❌'} Проходит порог ${threshold}`)
    })
  }

  // Проблема 3: Сложный материал не найден ни одним алгоритмом
  console.log('\n❌ ПРОБЛЕМА 3: Сложный материал с артикулами не найден подходящими записями')

  const complexMaterial = 'Кран шаровой резьбовой BVR-R DN32 BVR-R DN32 065B8310R Ридан'
  console.log(`🔍 Ищем подходящие записи для: "${complexMaterial}"`)

  // Ищем все краны в базе
  const { data: kranyData } = await supabase
    .from('supplier_names')
    .select('id, name')
    .ilike('name', '%кран%')
    .limit(20)

  console.log('\n📊 Все записи с "кран" в базе:')
  kranyData?.forEach((item, index) => {
    console.log(`  ${index + 1}. "${item.name}"`)
  })

  // Ищем шаровые краны
  const { data: sharovyeData } = await supabase
    .from('supplier_names')
    .select('id, name')
    .ilike('name', '%шаров%')
    .limit(10)

  console.log('\n📊 Записи с "шаров" в базе:')
  if (sharovyeData && sharovyeData.length > 0) {
    sharovyeData.forEach((item, index) => {
      console.log(`  ${index + 1}. "${item.name}"`)
    })
  } else {
    console.log('  ❌ Записей с "шаров" не найдено')
  }

  // Ищем по артикулу BVR
  const { data: bvrData } = await supabase
    .from('supplier_names')
    .select('id, name')
    .ilike('name', '%bvr%')
    .limit(10)

  console.log('\n📊 Записи с "bvr" в базе:')
  if (bvrData && bvrData.length > 0) {
    bvrData.forEach((item, index) => {
      console.log(`  ${index + 1}. "${item.name}"`)
    })
  } else {
    console.log('  ❌ Записей с "bvr" не найдено')
  }

  // Ищем по производителю Ридан
  const { data: ridanData } = await supabase
    .from('supplier_names')
    .select('id, name')
    .ilike('name', '%ридан%')
    .limit(10)

  console.log('\n📊 Записи с "ридан" в базе:')
  if (ridanData && ridanData.length > 0) {
    ridanData.forEach((item, index) => {
      console.log(`  ${index + 1}. "${item.name}"`)
    })
  } else {
    console.log('  ❌ Записей с "ридан" не найдено')
  }

  // Анализ паттернов в названиях
  console.log('\n📊 АНАЛИЗ ПАТТЕРНОВ В НАЗВАНИЯХ МАТЕРИАЛОВ')

  const { data: randomSample } = await supabase
    .from('supplier_names')
    .select('name')
    .limit(100)

  if (randomSample) {
    const patterns = {
      withBrands: [],
      withArticles: [],
      withDimensions: [],
      withSpecialChars: [],
      simple: []
    }

    randomSample.forEach(item => {
      const name = item.name

      // Бренды (заглавные буквы или кавычки)
      if (/[A-Z]{2,}|"[^"]+"/g.test(name)) {
        patterns.withBrands.push(name)
      }

      // Артикулы (буквы+цифры)
      if (/[A-Za-z]+\d+|[A-Z]+[-_]\d+/g.test(name)) {
        patterns.withArticles.push(name)
      }

      // Размеры (цифры+мм, x, *)
      if (/\d+[x*×]\d+|\d+мм|\d+,\d+/g.test(name)) {
        patterns.withDimensions.push(name)
      }

      // Спецсимволы
      if (/[-_()[\]{}#№@&%]/g.test(name)) {
        patterns.withSpecialChars.push(name)
      }

      // Простые названия
      if (!/[A-Z]{2,}|"[^"]+"|[A-Za-z]+\d+|\d+[x*×]\d+|[-_()[\]{}#№@&%]/g.test(name)) {
        patterns.simple.push(name)
      }
    })

    console.log('\n📈 Статистика паттернов:')
    console.log(`  С брендами: ${patterns.withBrands.length} (${Math.round(patterns.withBrands.length/100*100)}%)`)
    console.log(`  С артикулами: ${patterns.withArticles.length} (${Math.round(patterns.withArticles.length/100*100)}%)`)
    console.log(`  С размерами: ${patterns.withDimensions.length} (${Math.round(patterns.withDimensions.length/100*100)}%)`)
    console.log(`  Со спецсимволами: ${patterns.withSpecialChars.length} (${Math.round(patterns.withSpecialChars.length/100*100)}%)`)
    console.log(`  Простые: ${patterns.simple.length} (${Math.round(patterns.simple.length/100*100)}%)`)

    console.log('\n📝 Примеры простых названий:')
    patterns.simple.slice(0, 5).forEach((name, index) => {
      console.log(`  ${index + 1}. ${name}`)
    })

    console.log('\n📝 Примеры с брендами:')
    patterns.withBrands.slice(0, 5).forEach((name, index) => {
      console.log(`  ${index + 1}. ${name}`)
    })

    console.log('\n📝 Примеры с артикулами:')
    patterns.withArticles.slice(0, 5).forEach((name, index) => {
      console.log(`  ${index + 1}. ${name}`)
    })
  }
}

// Предложение концепции 4-го алгоритма
async function proposeAlgorithm4() {
  console.log('\n' + '='.repeat(80))
  console.log('💡 КОНЦЕПЦИЯ 4-ГО АЛГОРИТМА: АДАПТИВНЫЙ ГИБРИДНЫЙ ПОИСК')
  console.log('='.repeat(80))

  console.log(`
🎯 ОСНОВНЫЕ ПРИНЦИПЫ:

1. АДАПТИВНОСТЬ - алгоритм автоматически определяет тип запроса:
   • Простой материал (1-3 слова, обычные термины)
   • Технический материал (артикулы, размеры, бренды)
   • Смешанный тип

2. МНОГОУРОВНЕВАЯ СТРАТЕГИЯ:
   • Уровень 1: Предварительная классификация запроса
   • Уровень 2: Выбор оптимальной стратегии поиска
   • Уровень 3: Комбинирование результатов разных методов
   • Уровень 4: Ранжирование по релевантности

3. ИНТЕЛЛЕКТУАЛЬНАЯ ТОКЕНИЗАЦИЯ:
   • Разделение на смысловые блоки (материал, размер, бренд, артикул)
   • Определение важности каждого блока
   • Поиск по блокам с разными весами

4. ДИНАМИЧЕСКИЕ ПОРОГИ:
   • Автоматическая настройка порогов в зависимости от типа запроса
   • Снижение порогов для редких технических терминов
   • Повышение для общих слов

5. ОБУЧАЕМОСТЬ:
   • Сохранение статистики успешных поисков
   • Адаптация весов на основе пользовательских выборов
   • Улучшение с каждым использованием`)

  console.log(`
🔧 АЛГОРИТМ РАБОТЫ:

ЭТАП 1 - КЛАССИФИКАЦИЯ ЗАПРОСА:
  ❓ Анализ сложности: количество слов, наличие цифр, спецсимволов
  ❓ Определение типа: простой/технический/смешанный
  ❓ Выявление ключевых блоков: материал, размер, бренд, артикул

ЭТАП 2 - ВЫБОР СТРАТЕГИИ:
  📊 Простой запрос → акцент на точные совпадения и synonyms
  📊 Технический → акцент на частичные совпадения и артикулы
  📊 Смешанный → комбинированный подход

ЭТАП 3 - МНОГОМЕТОДНЫЙ ПОИСК:
  🔍 Метод A: Точные совпадения (высокий вес)
  🔍 Метод B: Нечеткое совпадение (средний вес)
  🔍 Метод C: Семантический поиск (низкий вес)
  🔍 Метод D: Поиск по частям (переменный вес)

ЭТАП 4 - УМНОЕ РАНЖИРОВАНИЕ:
  ⚖️ Комбинирование оценок всех методов
  ⚖️ Учет длины совпадений
  ⚖️ Бонусы за полные совпадения ключевых блоков
  ⚖️ Штрафы за слишком общие результаты`)

  console.log(`
🎮 ПРИМЕР РАБОТЫ НА ТЕСТОВЫХ МАТЕРИАЛАХ:

1️⃣ Материал: "пеноплэкс"
   • Классификация: ПРОСТОЙ (1 слово, общий термин)
   • Стратегия: Точные + нечеткие совпадения, низкий порог (0.2)
   • Методы: A(вес=3) + B(вес=2) + C(вес=1)
   • Ожидаемый результат: Все варианты "Пеноплэкс" с высокими оценками

2️⃣ Материал: "Кран шаровой резьбовой BVR-R DN32 BVR-R DN32 065B8310R Ридан"
   • Классификация: ТЕХНИЧЕСКИЙ (много слов, артикулы, размеры)
   • Стратегия: Поиск по блокам, высокий порог (0.6)
   • Блоки: {материал: "кран шаровой"}, {тип: "резьбовой"}, {размер: "DN32"}, {артикул: "BVR-R"}, {бренд: "Ридан"}
   • Методы: D(вес=3) + B(вес=2) + A(вес=1)
   • Ожидаемый результат: Краны шаровые, резьбовые, размер DN32, любые артикулы`)

  console.log(`
🚀 ПРЕИМУЩЕСТВА 4-ГО АЛГОРИТМА:

✅ УНИВЕРСАЛЬНОСТЬ - работает с любым типом материалов
✅ АДАПТИВНОСТЬ - подстраивается под характер запроса
✅ ТОЧНОСТЬ - комбинирует лучшее от всех существующих алгоритмов
✅ ОБУЧАЕМОСТЬ - улучшается с использованием
✅ ПРОИЗВОДИТЕЛЬНОСТЬ - оптимизирован для больших объемов данных
✅ ОТКАЗОУСТОЙЧИВОСТЬ - даже при неточном запросе найдет релевантные результаты`)

  console.log(`
📋 ПЛАН РЕАЛИЗАЦИИ:

1️⃣ Создать классификатор типов запросов
2️⃣ Реализовать токенизатор для разбора на блоки
3️⃣ Адаптировать существующие алгоритмы как методы поиска
4️⃣ Создать систему динамических весов и порогов
5️⃣ Реализовать комбинированное ранжирование результатов
6️⃣ Добавить систему обучения на основе пользовательского выбора`)
}

// Запуск полного анализа
async function runFullAnalysis() {
  await analyzeProblems()
  await proposeAlgorithm4()
  console.log('\n🎯 ПОЛНЫЙ АНАЛИЗ ЗАВЕРШЕН')
}

runFullAnalysis().catch(console.error)