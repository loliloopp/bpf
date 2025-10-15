import { supabase } from '@/lib/supabase'
import type { Rate, RateWithRelations, RateFormData } from '../model/types'

// Хелпер для получения или создания work_name_id
async function resolveWorkNameId(data: RateFormData): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured')

  // Если передан work_name_id - используем его
  if (data.work_name_id) {
    return data.work_name_id
  }

  // Если передан work_name (строка) - ищем или создаём
  if (data.work_name) {
    const workNameTrimmed = data.work_name.trim()

    // Ищем существующее (maybeSingle возвращает null если не найдено, без ошибки)
    const { data: existing, error: searchError } = await supabase
      .from('work_names')
      .select('id')
      .eq('name', workNameTrimmed)
      .maybeSingle()

    if (searchError) {
      throw searchError
    }

    if (existing) {
      return existing.id
    }

    // Создаём новое
    const { data: created, error: createError } = await supabase
      .from('work_names')
      .insert({ name: workNameTrimmed })
      .select('id')
      .single()

    if (createError) throw createError
    if (!created) throw new Error('Failed to create work_name')

    return created.id
  }

  throw new Error('Either work_name_id or work_name must be provided')
}

export const ratesApi = {
  async getAll(): Promise<RateWithRelations[]> {
    if (!supabase) {
      throw new Error('Supabase is not configured')
    }

    const BATCH_SIZE = 1000
    let allData: any[] = []
    let from = 0
    let hasMore = true

    while (hasMore) {
      const to = from + BATCH_SIZE - 1
      const { data, error } = await supabase
        .from('rates')
        .select(
          `
          *,
          work_name:work_names(id, name),
          unit:units(id, name),
          detail_mapping:rates_detail_cost_categories_mapping(
            detail_cost_category:detail_cost_categories(id, name),
            cost_category:cost_categories(id, name, number),
            work_name:work_names(id, name)
          )
        `,
        )
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) {
        console.error('❌ Ошибка при получении rates:', error)
        throw error
      }

      if (!data || data.length === 0) {
        hasMore = false
      } else {
        allData = [...allData, ...data]

        if (data.length < BATCH_SIZE) {
          hasMore = false
        } else {
          from += BATCH_SIZE
        }
      }
    }

    const result = allData.map(({ detail_mapping, ...rate }) => {
      const detailCategory = detail_mapping?.[0]?.detail_cost_category
      const costCategory = detail_mapping?.[0]?.cost_category
      return {
        ...rate,
        detail_cost_category: detailCategory || null,
        detail_cost_category_id: detailCategory?.id,
        cost_category: costCategory || null,
        cost_category_id: costCategory?.id,
      }
    }) as RateWithRelations[]

    console.log(`✅ Загружено ${result.length} расценок`)
    return result
  },

  async create(data: RateFormData): Promise<Rate> {
    if (!supabase) throw new Error('Supabase is not configured')

    // Получаем или создаем work_name_id
    const workNameId = await resolveWorkNameId(data)

    const { detail_cost_category_id, cost_category_id, work_name, work_name_id, ...rateData } = data

    // Устанавливаем значение по умолчанию для active, если не указано
    const rateDataWithDefaults = {
      ...rateData,
      work_name_id: workNameId,
      active: rateData.active !== undefined ? rateData.active : true
    }

    // Создаем запись расценки
    const { data: rate, error: rateError } = await supabase
      .from('rates')
      .insert({ ...rateDataWithDefaults })
      .select()
      .single()

    if (rateError) {
      console.error('Failed to create rate:', rateError)
      throw rateError
    }

    // Создаем связь с видом затрат и категорией затрат
    if (detail_cost_category_id && cost_category_id) {
      const { error: mappingError } = await supabase
        .from('rates_detail_cost_categories_mapping')
        .insert({
          rate_id: rate.id,
          detail_cost_category_id,
          cost_category_id,
          work_name_id: workNameId
        })

      if (mappingError) {
        console.error('Failed to create rate-detail cost category mapping:', mappingError)
        throw mappingError
      }
    }

    return rate as Rate
  },

  async update(id: string, data: RateFormData): Promise<Rate> {
    if (!supabase) throw new Error('Supabase is not configured')

    // Получаем или создаем work_name_id
    const workNameId = await resolveWorkNameId(data)

    const { detail_cost_category_id, cost_category_id, work_name, work_name_id, ...rateData } = data

    // Обновляем запись расценки (включая поле active и work_name_id)
    const { data: rate, error: rateError } = await supabase
      .from('rates')
      .update({ ...rateData, work_name_id: workNameId })
      .eq('id', id)
      .select()
      .single()

    if (rateError) {
      console.error('Failed to update rate:', rateError)
      throw rateError
    }

    // Обновляем связь с видом затрат и категорией затрат
    // Удаляем старые связи
    const { error: deleteError } = await supabase
      .from('rates_detail_cost_categories_mapping')
      .delete()
      .eq('rate_id', id)

    if (deleteError) {
      console.error('Failed to delete old rate-detail cost category mapping:', deleteError)
      throw deleteError
    }

    // Создаем новую связь
    if (detail_cost_category_id && cost_category_id) {
      const { error: mappingError } = await supabase
        .from('rates_detail_cost_categories_mapping')
        .insert({
          rate_id: id,
          detail_cost_category_id,
          cost_category_id,
          work_name_id: workNameId
        })

      if (mappingError) {
        console.error('Failed to create new rate-detail cost category mapping:', mappingError)
        throw mappingError
      }
    }

    return rate as Rate
  },

  async bulkCreate(dataArray: RateFormData[]): Promise<Rate[]> {
    if (!supabase) throw new Error('Supabase is not configured')
    if (dataArray.length === 0) return []

    const results: Rate[] = []
    const BATCH_SIZE = 50

    for (let i = 0; i < dataArray.length; i += BATCH_SIZE) {
      const batch = dataArray.slice(i, i + BATCH_SIZE)

      // Дедупликация внутри батча по work_name (оставляем последнее вхождение)
      const dedupeMap = new Map<string, { data: RateFormData; originalIndex: number }>()
      batch.forEach((item, idx) => {
        const key = item.work_name ? item.work_name.toLowerCase().trim() : `id_${item.work_name_id}`
        dedupeMap.set(key, { data: item, originalIndex: idx })
      })

      const deduplicatedBatch = Array.from(dedupeMap.values())
      const duplicatesRemoved = batch.length - deduplicatedBatch.length

      if (duplicatesRemoved > 0) {
        console.log(
          `⚠️ Батч ${Math.floor(i / BATCH_SIZE) + 1}: удалено ${duplicatesRemoved} дубликатов внутри батча`,
        )
      }

      // Резолвим work_name_id для каждой записи
      const resolvedBatch = await Promise.all(
        deduplicatedBatch.map(async ({ data }) => {
          const workNameId = await resolveWorkNameId(data)
          return { data, workNameId }
        })
      )

      // Подготавливаем данные для вставки (без detail_cost_category_id, cost_category_id, work_name)
      const ratesToInsert = resolvedBatch.map(({ data, workNameId }) => {
        const { detail_cost_category_id, cost_category_id, work_name, work_name_id, ...rateData } = data
        return {
          ...rateData,
          work_name_id: workNameId,
          active: rateData.active !== undefined ? rateData.active : true,
        }
      })

      // Вставляем расценки
      const { data: rates, error: rateError } = await supabase
        .from('rates')
        .insert(ratesToInsert)
        .select()

      if (rateError) {
        console.error('Failed to bulk create rates:', rateError)
        throw rateError
      }

      if (rates) {
        // Создаем маппинги для видов затрат, категорий затрат и work_names
        const mappings = rates
          .map((rate, idx) => {
            const originalData = resolvedBatch[idx].data
            const workNameId = resolvedBatch[idx].workNameId
            if (originalData.detail_cost_category_id && originalData.cost_category_id) {
              return {
                rate_id: rate.id,
                detail_cost_category_id: originalData.detail_cost_category_id,
                cost_category_id: originalData.cost_category_id,
                work_name_id: workNameId,
              }
            }
            return null
          })
          .filter((m) => m !== null)

        if (mappings.length > 0) {
          const { error: mappingError } = await supabase
            .from('rates_detail_cost_categories_mapping')
            .insert(mappings)

          if (mappingError) {
            console.error('Failed to create rate mappings:', mappingError)
          }
        }

        results.push(...(rates as Rate[]))
      }

      console.log(
        `✅ Обработан батч ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(dataArray.length / BATCH_SIZE)} (${deduplicatedBatch.length} уникальных записей)`,
      )
    }

    return results
  },

  async bulkUpdate(updates: Array<{ id: string; data: RateFormData }>): Promise<void> {
    if (!supabase) throw new Error('Supabase is not configured')
    if (updates.length === 0) return

    const BATCH_SIZE = 50

    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE)

      // Обновляем последовательно в рамках батча (параллельное обновление может вызвать конфликты)
      await Promise.all(
        batch.map(async ({ id, data }) => {
          // Резолвим work_name_id
          const workNameId = await resolveWorkNameId(data)

          const { detail_cost_category_id, cost_category_id, work_name, work_name_id, ...rateData } = data

          // Обновляем расценку (включая work_name_id)
          const { error: rateError } = await supabase
            .from('rates')
            .update({ ...rateData, work_name_id: workNameId })
            .eq('id', id)

          if (rateError) {
            console.error(`Failed to update rate ${id}:`, rateError)
            throw rateError
          }

          // Удаляем старые связи
          await supabase.from('rates_detail_cost_categories_mapping').delete().eq('rate_id', id)

          // Создаем новую связь
          if (detail_cost_category_id && cost_category_id) {
            await supabase
              .from('rates_detail_cost_categories_mapping')
              .insert({
                rate_id: id,
                detail_cost_category_id,
                cost_category_id,
                work_name_id: workNameId
              })
          }
        }),
      )

      console.log(
        `✅ Обновлен батч ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(updates.length / BATCH_SIZE)} (${batch.length} записей)`,
      )
    }
  },

  async delete(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase is not configured')

    // Сначала удаляем связанные записи из таблиц без ON DELETE CASCADE
    const { error: vorError } = await supabase.from('vor_works').delete().eq('rate_id', id)

    if (vorError) {
      console.error('Failed to delete vor_works:', vorError)
      throw vorError
    }

    const { error: typeCalcError } = await supabase
      .from('type_calculation_work_mapping')
      .delete()
      .eq('rate_id', id)

    if (typeCalcError) {
      console.error('Failed to delete type_calculation_work_mapping:', typeCalcError)
      throw typeCalcError
    }

    // Теперь удаляем саму расценку
    const { error } = await supabase.from('rates').delete().eq('id', id)

    if (error) {
      console.error('Failed to delete rate:', error)
      throw error
    }
  },

  async bulkDelete(ids: string[]): Promise<void> {
    if (!supabase) throw new Error('Supabase is not configured')

    if (ids.length === 0) return

    const BATCH_SIZE = 100
    const batches = []

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      batches.push(ids.slice(i, i + BATCH_SIZE))
    }

    console.log(`🗑️ Удаление ${ids.length} записей батчами по ${BATCH_SIZE}`)

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]

      // Сначала удаляем связанные записи из таблиц без ON DELETE CASCADE
      const { error: vorError } = await supabase
        .from('vor_works')
        .delete()
        .in('rate_id', batch)

      if (vorError) {
        console.error(`Failed to delete vor_works for batch ${i + 1}/${batches.length}:`, vorError)
        throw vorError
      }

      const { error: typeCalcError } = await supabase
        .from('type_calculation_work_mapping')
        .delete()
        .in('rate_id', batch)

      if (typeCalcError) {
        console.error(
          `Failed to delete type_calculation_work_mapping for batch ${i + 1}/${batches.length}:`,
          typeCalcError,
        )
        throw typeCalcError
      }

      // Теперь удаляем сами расценки
      const { error } = await supabase.from('rates').delete().in('id', batch)

      if (error) {
        console.error(`Failed to delete batch ${i + 1}/${batches.length}:`, error)
        throw error
      }

      console.log(`✅ Удален батч ${i + 1}/${batches.length} (${batch.length} записей)`)
    }

    console.log(`✅ Все ${ids.length} записей успешно удалены`)
  },

  // Получение единицы измерения по ID расценки
  async getUnitByRateId(rateId: string): Promise<string | null> {
    if (!supabase) throw new Error('Supabase is not configured')

    const { data, error } = await supabase
      .from('rates')
      .select('unit:units(name)')
      .eq('id', rateId)
      .single()

    if (error) {
      console.error('Failed to get unit by rate id:', error)
      return null
    }

    return data?.unit?.name || null
  },

  // Получение работ по виду затрат через rates_detail_cost_categories_mapping
  async getWorksByCategory(
    costTypeId?: string,
    costCategoryId?: string,
  ): Promise<{ value: string; label: string }[]> {
    if (!supabase) throw new Error('Supabase is not configured')

    // Если не указан ни вид затрат, ни категория затрат - возвращаем пустой список
    if (!costTypeId && !costCategoryId) {
      return []
    }


    // Запрос: получаем только активные расценки с их категориями затрат
    const { data, error } = await supabase.from('rates').select(`
        id,
        work_name,
        active,
        rates_detail_cost_categories_mapping(detail_cost_category_id)
      `)
      .eq('active', true) // Фильтруем только активные расценки


    if (error) {
      console.error('Failed to get works by category:', error)
      throw error
    }

    if (!data || data.length === 0) {
      return []
    }

    // Фильтруем расценки по виду затрат (как в backup файле)
    const filteredRates = data.filter((rate) => {
      const categoryIds =
        rate.rates_detail_cost_categories_mapping?.map((m) =>
          m.detail_cost_category_id.toString(),
        ) ?? []

      // Сравниваем и как строку, и как число для надежности
      const targetIdAsString = costTypeId?.toString() || ''
      const targetIdAsNumber = parseInt(costTypeId || '0')
      const categoryIdsAsNumbers = rate.rates_detail_cost_categories_mapping?.map((m) => m.detail_cost_category_id) ?? []


      // Проверяем оба варианта: строка и число
      return categoryIds.includes(targetIdAsString) || categoryIdsAsNumbers.includes(targetIdAsNumber)
    })

    // Преобразуем результат в нужный формат и сортируем по названию работы
    const result = filteredRates
      .filter((rate) => rate.work_name) // Только записи с валидными работами
      .map((rate) => ({
        value: rate.id.toString(), // ID расценки для сохранения в chessboard_rates_mapping
        label: rate.work_name, // Название работы для отображения
      }))
      .sort((a, b) => a.label.localeCompare(b.label)) // Сортировка по названию работы

    return result
  },

  // Получение рабочих наборов по виду затрат для столбца "Рабочий набор" в шахматке
  async getWorkSetsByCategory(
    costTypeId?: string,
    costCategoryId?: string
  ): Promise<{ value: string; label: string; workSetName: string }[]> {
    if (!supabase) throw new Error('Supabase is not configured')

    // Если не указан вид затрат - возвращаем пустой список
    if (!costTypeId) {
      return []
    }

    const costTypeIdInt = parseInt(costTypeId)
    const costCategoryIdInt = costCategoryId ? parseInt(costCategoryId) : null

    // НОВЫЙ ПОДХОД: Запрашиваем mappings с фильтрами, затем получаем work_sets
    // Это обходит лимит 1000 для rates
    let mappingsQuery = supabase
      .from('rates_detail_cost_categories_mapping')
      .select(
        `
        rate_id,
        detail_cost_category_id,
        cost_category_id,
        rates!inner(
          id,
          work_set,
          active
        )
      `
      )

    // Фильтруем mappings по виду затрат
    mappingsQuery = mappingsQuery.eq('detail_cost_category_id', costTypeIdInt)

    // Если указана категория затрат - добавляем фильтрацию
    if (costCategoryIdInt) {
      mappingsQuery = mappingsQuery.eq('cost_category_id', costCategoryIdInt)
    }

    // Фильтруем по активным rates с work_set
    mappingsQuery = mappingsQuery
      .eq('rates.active', true)
      .not('rates.work_set', 'is', null)

    const { data: mappings, error } = await mappingsQuery

    if (error) {
      console.error('Ошибка загрузки рабочих наборов с фильтрами:', error)
      throw error
    }

    if (!mappings || mappings.length === 0) {
      return []
    }

    // Извлекаем уникальные work_sets из результата
    const uniqueWorkSets = new Map<string, { workSetName: string; rateId: string }>()

    mappings.forEach((mapping: any) => {
      const rate = mapping.rates
      if (rate && rate.work_set && !uniqueWorkSets.has(rate.work_set)) {
        uniqueWorkSets.set(rate.work_set, {
          workSetName: rate.work_set,
          rateId: rate.id,
        })
      }
    })

    const result = Array.from(uniqueWorkSets.values())
      .map(({ workSetName, rateId }) => ({
        value: rateId, // UUID расценки для сохранения в work_set (FK на rates.id)
        label: workSetName, // Название рабочего набора для отображения
        workSetName: workSetName, // Название набора для фильтрации работ
      }))
      .sort((a, b) => a.label.localeCompare(b.label))

    return result
  },

  // Получение работ по конкретному рабочему набору с учётом категории и вида затрат
  async getWorksByWorkSet(
    workSet?: string,
    costCategoryId?: string,
    costTypeId?: string
  ): Promise<{ value: string; label: string }[]> {
    if (!supabase) throw new Error('Supabase is not configured')

    // Если не указан рабочий набор - возвращаем пустой список
    if (!workSet) {
      return []
    }

    // Если не указаны категория и вид затрат - возвращаем пустой список
    if (!costCategoryId || !costTypeId) {
      return []
    }

    const costCategoryIdInt = parseInt(costCategoryId)
    const costTypeIdInt = parseInt(costTypeId)

    // Получаем работы через rates_detail_cost_categories_mapping с фильтрацией
    const { data, error } = await supabase
      .from('rates_detail_cost_categories_mapping')
      .select(
        `
        rate_id,
        rates!inner(
          id,
          work_set,
          active,
          work_name:work_names(id, name)
        )
      `
      )
      .eq('cost_category_id', costCategoryIdInt)
      .eq('detail_cost_category_id', costTypeIdInt)
      .eq('rates.work_set', workSet)
      .eq('rates.active', true)

    if (error) {
      console.error('Failed to get works by work set:', error)
      throw error
    }

    if (!data || data.length === 0) {
      return []
    }

    // Убираем дубликаты по work_name и преобразуем в нужный формат
    const uniqueWorks = new Map<string, { rateId: string; workName: string }>()
    data.forEach((item: any) => {
      const rate = item.rates
      const workName = rate?.work_name?.name
      if (workName && !uniqueWorks.has(workName)) {
        uniqueWorks.set(workName, {
          rateId: rate.id,
          workName: workName,
        })
      }
    })

    // Преобразуем в нужный формат и сортируем
    const result = Array.from(uniqueWorks.values())
      .map(({ rateId, workName }) => ({
        value: rateId, // ID расценки для сохранения в chessboard_rates_mapping
        label: workName, // Название работы для отображения
      }))
      .sort((a, b) => a.label.localeCompare(b.label))

    return result
  },

  // Получение наименований работ (work_names) по рабочему набору и виду затрат
  // Для страницы "Типы пирога отделки"
  async getWorkNamesByWorkSetAndCategory(
    workSet: string,
    detailCostCategoryId: string,
    costCategoryId?: string
  ): Promise<{ value: string; label: string; rateId: string }[]> {
    if (!supabase) throw new Error('Supabase is not configured')

    if (!workSet || !detailCostCategoryId) {
      return []
    }

    const detailCostCategoryIdInt = parseInt(detailCostCategoryId)
    const costCategoryIdInt = costCategoryId ? parseInt(costCategoryId) : null

    // НОВЫЙ ПОДХОД: Запрашиваем mappings с фильтрами, затем получаем work_names
    // Это обходит лимит 1000 для rates
    let mappingsQuery = supabase
      .from('rates_detail_cost_categories_mapping')
      .select(
        `
        rate_id,
        work_name_id,
        detail_cost_category_id,
        cost_category_id,
        work_names!inner(id, name),
        rates!inner(id, work_set, active)
      `
      )

    // Фильтруем mappings по виду затрат
    mappingsQuery = mappingsQuery.eq('detail_cost_category_id', detailCostCategoryIdInt)

    // Если указана категория затрат - добавляем фильтрацию
    if (costCategoryIdInt) {
      mappingsQuery = mappingsQuery.eq('cost_category_id', costCategoryIdInt)
    }

    // Фильтруем по рабочему набору и активным rates
    mappingsQuery = mappingsQuery
      .eq('rates.work_set', workSet)
      .eq('rates.active', true)

    const { data: mappings, error } = await mappingsQuery

    if (error) {
      console.error('Ошибка загрузки наименований работ с фильтрами:', error)
      throw error
    }

    if (!mappings || mappings.length === 0) {
      return []
    }

    // Убираем дубликаты по work_name_id
    const uniqueWorkNames = new Map<string, { workNameId: string; workName: string; rateId: string }>()

    mappings.forEach((mapping: any) => {
      const workNameId = mapping.work_name_id
      const workName = mapping.work_names?.name
      const rateId = mapping.rate_id

      if (workNameId && workName && !uniqueWorkNames.has(workNameId)) {
        uniqueWorkNames.set(workNameId, {
          workNameId,
          workName,
          rateId,
        })
      }
    })

    // Преобразуем в нужный формат
    const result = Array.from(uniqueWorkNames.values())
      .map(({ workNameId, workName, rateId }) => ({
        value: workNameId, // work_name_id для сохранения в БД
        label: workName,    // Название работы для отображения
        rateId: rateId,     // rate_id для сохранения в БД
      }))
      .sort((a, b) => a.label.localeCompare(b.label))

    return result
  },
}
