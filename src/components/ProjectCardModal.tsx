import React, { useState, useCallback } from 'react'
import { Modal, Checkbox, InputNumber, Typography, Table } from 'antd'

const { Title, Text } = Typography

export type BlockType = 'Подземная парковка' | 'Типовой корпус' | 'Стилобат' | 'Кровля'

interface Block {
  id: number
  name: string
  bottomFloor: number
  topFloor: number
  x: number
  y: number
}

interface Stylobate {
  id: string
  name: string
  fromBlockId: number
  toBlockId: number
  floors: number
  x: number
  y: number
}

interface UndergroundParking {
  blockIds: number[]
  connections: Array<{ fromBlockId: number; toBlockId: number }>
}

interface ProjectCardModalProps {
  visible: boolean
  onCancel: () => void
  onSave: (data: {
    blocks: Block[]
    stylobates: Stylobate[]
    undergroundParking: UndergroundParking
  }) => void
  projectData: {
    name: string
    address: string
    blocks: Array<{
      name: string
      bottomFloor: number
      topFloor: number
    }>
  }
}

export default function ProjectCardModal({
  visible,
  onCancel,
  onSave,
  projectData,
}: ProjectCardModalProps) {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [stylobates, setStylobates] = useState<Stylobate[]>([])
  const [undergroundParking, setUndergroundParking] = useState<UndergroundParking>({
    blockIds: [],
    connections: [],
  })

  React.useEffect(() => {
    if (visible && projectData.blocks.length > 0) {
      const generatedBlocks: Block[] = projectData.blocks.map((block, index) => ({
        id: index + 1,
        name: block.name,
        bottomFloor: block.bottomFloor,
        topFloor: block.topFloor,
        x: 0,
        y: 0,
      }))
      setBlocks(generatedBlocks)
    }
  }, [visible, projectData.blocks])

  const generateStylobateName = (fromBlock: Block, toBlock: Block) => {
    const getShortName = (blockName: string) => {
      // Если имя корпуса - это число, используем номер
      if (/^\d+$/.test(blockName)) {
        return blockName
      }
      // Иначе берём первые 3 буквы
      return blockName.substring(0, 3)
    }

    const fromName = getShortName(fromBlock.name)
    const toName = getShortName(toBlock.name)

    return `Стилобат ${fromName}-${toName}`
  }

  const handleStylobateChange = useCallback(
    (fromBlockId: number, toBlockId: number, checked: boolean) => {
      if (checked) {
        const fromBlock = blocks.find((b) => b.id === fromBlockId)!
        const toBlock = blocks.find((b) => b.id === toBlockId)!

        const newStylobate: Stylobate = {
          id: `stylobate-${fromBlockId}-${toBlockId}`,
          name: generateStylobateName(fromBlock, toBlock),
          fromBlockId,
          toBlockId,
          floors: 1,
          x: 0,
          y: 0,
        }
        setStylobates((prev) => [...prev, newStylobate])
      } else {
        setStylobates((prev) =>
          prev.filter((s) => s.fromBlockId !== fromBlockId || s.toBlockId !== toBlockId),
        )
      }
    },
    [blocks],
  )

  const handleStylobateFloorsChange = useCallback(
    (stylobateId: string, floors: number) => {
      setStylobates((prev) =>
        prev.map((s) => {
          if (s.id === stylobateId) {
            const fromBlock = blocks.find((b) => b.id === s.fromBlockId)!
            const toBlock = blocks.find((b) => b.id === s.toBlockId)!
            return { ...s, floors, name: generateStylobateName(fromBlock, toBlock) }
          }
          return s
        }),
      )
    },
    [blocks],
  )

  const handleUndergroundParkingBlockChange = useCallback((blockId: number, checked: boolean) => {
    setUndergroundParking((prev) => ({
      ...prev,
      blockIds: checked
        ? [...prev.blockIds, blockId]
        : prev.blockIds.filter((id) => id !== blockId),
    }))
  }, [])

  const handleUndergroundConnectionChange = useCallback(
    (fromBlockId: number, toBlockId: number, checked: boolean) => {
      setUndergroundParking((prev) => ({
        ...prev,
        connections: checked
          ? [...prev.connections, { fromBlockId, toBlockId }]
          : prev.connections.filter(
              (conn) => !(conn.fromBlockId === fromBlockId && conn.toBlockId === toBlockId),
            ),
      }))
    },
    [],
  )

  const handleSave = () => {
    onSave({
      blocks,
      stylobates,
      undergroundParking,
    })
  }

  const createBuildingTableData = () => {
    if (!blocks.length) return []

    // Находим диапазон этажей
    const maxTopFloor = Math.max(...blocks.map((block) => block.topFloor))
    const minBottomFloor = Math.min(...blocks.map((block) => block.bottomFloor))

    console.log('🏢 Generating table data for floor range:', minBottomFloor, 'to', maxTopFloor)

    const tableData = []

    // Создаем данные для каждого этажа
    for (let floor = maxTopFloor; floor >= minBottomFloor; floor--) {
      const row: Record<string, unknown> = {
        key: floor,
        floor: floor,
      }

      // Для каждого корпуса проверяем, есть ли этот этаж
      blocks.forEach((block) => {
        const blockKey = `block_${block.id}`
        if (floor <= block.topFloor && floor >= block.bottomFloor) {
          // Определяем тип этажа и цвет
          let backgroundColor
          const hasUndergroundParking = undergroundParking.blockIds.includes(block.id)

          if (floor === 0) {
            backgroundColor = '#fff2e8' // Кровля
          } else if (floor > 0) {
            backgroundColor = '#f6ffed' // Типовой корпус
          } else {
            backgroundColor = hasUndergroundParking ? '#e6f7ff' : '#f6ffed'
          }

          row[blockKey] = {
            floor,
            backgroundColor,
            blockName: block.name,
          }
        } else {
          row[blockKey] = null
        }
      })

      // Проверяем стилобаты и подземные соединения между корпусами
      for (let i = 0; i < blocks.length - 1; i++) {
        const fromBlock = blocks[i]
        const toBlock = blocks[i + 1]
        const connectionKey = `connection_${fromBlock.id}_${toBlock.id}`

        const stylobate = stylobates.find(
          (s) => s.fromBlockId === fromBlock.id && s.toBlockId === toBlock.id,
        )
        const connection = undergroundParking.connections.find(
          (c) => c.fromBlockId === fromBlock.id && c.toBlockId === toBlock.id,
        )

        // Стилобат - только для положительных этажей
        if (stylobate && floor > 0 && floor <= stylobate.floors) {
          row[connectionKey] = {
            floor,
            backgroundColor: '#fffbe6', // Цвет стилобата
            type: 'stylobate',
            name: stylobate.name,
          }
        }
        // Подземное соединение - для этажа 0 и отрицательных этажей
        // И только в диапазоне этажей обоих корпусов
        else if (connection && floor <= 0) {
          const minBottomFloor = Math.max(fromBlock.bottomFloor, toBlock.bottomFloor)
          if (floor >= minBottomFloor) {
            // Определяем цвет: 0 этаж - как кровля, отрицательные - как подземная парковка
            const backgroundColor = floor === 0 ? '#fff2e8' : '#e6f7ff'
            row[connectionKey] = {
              floor,
              backgroundColor,
              type: 'underground',
            }
          }
        }
      }

      tableData.push(row)
    }

    console.log('📋 Generated table data:', tableData.length, 'rows')
    console.log('🔍 Sample row keys:', Object.keys(tableData[0] || {}))

    return tableData
  }

  const createTableColumns = () => {
    const columns: Array<{
      title: string
      dataIndex: string
      key: string
      width: number
      render: (cell: { floor: number; backgroundColor: string; blockName?: string; type?: string; name?: string } | null) => React.ReactNode
    }> = []

    console.log('🏗️ Creating table columns for blocks:', blocks.length)

    // Добавляем левый отступ 50px
    columns.push({
      title: '',
      dataIndex: 'left_margin',
      key: 'left_margin',
      width: 50,
      render: () => null, // Пустая колонка для отступа
    })
    console.log('✅ Added left margin column: 50px')

    // Добавляем колонки для каждого корпуса и промежутки между ними
    blocks.forEach((block, index) => {
      // Колонка корпуса - фиксированная ширина 120px (+20%)
      columns.push({
        title: block.name,
        dataIndex: `block_${block.id}`,
        key: `block_${block.id}`,
        width: 120,
        render: (cell: { floor: number; backgroundColor: string; blockName?: string } | null) => {
          if (!cell) return null
          return (
            <div
              style={{
                backgroundColor: cell.backgroundColor,
                border: '1px solid #d9d9d9',
                height: 14.4, // +20% от 12px
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 7.2, // +20% от 6px
                fontWeight: 'bold',
                margin: 0,
                padding: 0,
                boxSizing: 'border-box',
              }}
            >
              {cell.floor}
            </div>
          )
        },
      })
      console.log(`✅ Added building column [${index}]: ${block.name} - 120px`)

      // Добавляем промежуток между корпусами (кроме последнего корпуса) - фиксированная ширина 120px (+20%)
      if (index < blocks.length - 1) {
        const nextBlock = blocks[index + 1]

        // Колонка промежутка (для стилобатов и подземных соединений)
        columns.push({
          title: '', // Пустой заголовок для промежутка
          dataIndex: `connection_${block.id}_${nextBlock.id}`,
          key: `connection_${block.id}_${nextBlock.id}`,
          width: 120,
          render: (cell: { floor: number; backgroundColor: string; type?: string; name?: string } | null) => {
            if (!cell) return null
            return (
              <div
                style={{
                  backgroundColor: cell.backgroundColor,
                  border: '1px solid #d9d9d9',
                  height: 14.4, // +20% от 12px
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 6, // +20% от 5px = 6px
                  margin: 0,
                  padding: 0,
                  boxSizing: 'border-box',
                }}
              >
                {cell.floor}
              </div>
            )
          },
        })
        console.log(`✅ Added connection column [${index}]: ${block.name} -> ${nextBlock.name} - 120px`)
      }
    })

    // Рассчитываем правый отступ: ширина модального окна минус все колонки
    // Модальное окно: 98vw (примерно ~1900px на широком экране)
    // Корпуса теперь 120px каждый (+20% от 100px)
    // Используем константу для расчёта
    const modalWidth = typeof window !== 'undefined' ? window.innerWidth * 0.98 : 1900
    const usedWidth = columns.reduce((sum, col) => sum + col.width, 0)
    const rightPadding = Math.max(0, modalWidth - usedWidth)

    // Добавляем правый отступ как последнюю колонку
    columns.push({
      title: '',
      dataIndex: 'right_margin',
      key: 'right_margin',
      width: rightPadding,
      render: () => null, // Пустая колонка для правого отступа
    })

    console.log('📊 Total columns created:', columns.length)
    console.log('📏 Used width (without right margin):', usedWidth + 'px')
    console.log('🖥️ Modal width:', modalWidth + 'px')
    console.log('➡️ Right padding calculated:', rightPadding + 'px')
    console.log('📏 Total expected width:', columns.reduce((sum, col) => sum + col.width, 0) + 'px')
    console.log('📋 Column details:', columns.map(col => `${col.key}: ${col.width}px`))

    return columns
  }

  const tableData = createBuildingTableData()
  const tableColumns = createTableColumns()

  console.log('🎯 Rendering ProjectCardModal with:')
  console.log('   - Table data rows:', tableData.length)
  console.log('   - Table columns:', tableColumns.length)

  return (
    <Modal
      open={visible}
      title="Карточка проекта"
      onCancel={onCancel}
      onOk={handleSave}
      width="98vw"
      style={{ top: 20, height: 'calc(100vh - 40px)' }}
      styles={{ body: { height: 'calc(100vh - 140px)', overflow: 'hidden', padding: '16px' } }}
      okText="Сохранить"
      cancelText="Отмена"
    >
      <div
        style={{
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
        }}
      >
        {/* Информация о проекте */}
        <div style={{ flex: '0 0 auto' }}>
          <Title level={3}>{projectData.name}</Title>
          <Text>{projectData.address}</Text>
          <br />
          <Text>
            Количество корпусов: {blocks.length} (
            {blocks.map((b) => `${b.bottomFloor}; ${b.topFloor}`).join(', ')})
          </Text>
        </div>

        {/* Элементы управления */}
        <div style={{ flex: 1, minWidth: 400 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* Стилобаты */}
            {blocks.length > 1 && (
              <div>
                <Text strong style={{ fontSize: '0.75em', marginRight: 8 }}>Стилобаты:</Text>
                {blocks.slice(0, -1).map((block, index) => {
                  const nextBlock = blocks[index + 1]
                  const stylobate = stylobates.find(
                    (s) => s.fromBlockId === block.id && s.toBlockId === nextBlock.id,
                  )
                  const isChecked = !!stylobate

                  return (
                    <span key={`stylobate-${block.id}-${nextBlock.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 12 }}>
                      <Checkbox
                        checked={isChecked}
                        onChange={(e) => handleStylobateChange(block.id, nextBlock.id, e.target.checked)}
                      />
                      <Text style={{ fontSize: '0.7em' }}>{block.name}↔{nextBlock.name}</Text>
                      {isChecked && (
                        <InputNumber
                          size="small"
                          min={1}
                          value={stylobate?.floors || 1}
                          onChange={(value) => handleStylobateFloorsChange(stylobate!.id, value || 1)}
                          style={{ width: 40, marginLeft: 4 }}
                        />
                      )}
                    </span>
                  )
                })}
              </div>
            )}

            {/* Подземная парковка */}
            <div>
              <Text strong style={{ fontSize: '0.75em', marginRight: 8 }}>Подз.парковка:</Text>
              {blocks.map((block) => {
                const isChecked = undergroundParking.blockIds.includes(block.id)
                return (
                  <span key={`underground-${block.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 12 }}>
                    <Checkbox
                      checked={isChecked}
                      onChange={(e) => handleUndergroundParkingBlockChange(block.id, e.target.checked)}
                    />
                    <Text style={{ fontSize: '0.7em' }}>{block.name}</Text>
                  </span>
                )
              })}
            </div>

            {/* Подземные соединения */}
            {blocks.length > 1 && (
              <div>
                <Text strong style={{ fontSize: '0.75em', marginRight: 8 }}>Подз.соединения:</Text>
                {blocks.slice(0, -1).map((block, index) => {
                  const nextBlock = blocks[index + 1]
                  const isChecked = undergroundParking.connections.some(
                    (conn) => conn.fromBlockId === block.id && conn.toBlockId === nextBlock.id,
                  )

                  return (
                    <span key={`underground-connection-${block.id}-${nextBlock.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 12 }}>
                      <Checkbox
                        checked={isChecked}
                        onChange={(e) =>
                          handleUndergroundConnectionChange(block.id, nextBlock.id, e.target.checked)
                        }
                      />
                      <Text style={{ fontSize: '0.7em' }}>{block.name}↔{nextBlock.name}</Text>
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Цветовая легенда */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            minWidth: 250,
            flexShrink: 0,
          }}
        >
          <Text strong style={{ fontSize: '0.9em', marginBottom: 4 }}>
            Легенда:
          </Text>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gridTemplateRows: '1fr 1fr',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  width: '0.8em',
                  height: '0.8em',
                  backgroundColor: '#e6f7ff',
                  border: '1px solid #91d5ff',
                  borderRadius: 2,
                  flexShrink: 0,
                }}
              />
              <Text style={{ fontSize: '0.7em', lineHeight: 1.2 }}>Подземная парковка</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  width: '0.8em',
                  height: '0.8em',
                  backgroundColor: '#f6ffed',
                  border: '1px solid #b7eb8f',
                  borderRadius: 2,
                  flexShrink: 0,
                }}
              />
              <Text style={{ fontSize: '0.7em', lineHeight: 1.2 }}>Типовой корпус</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  width: '0.8em',
                  height: '0.8em',
                  backgroundColor: '#fffbe6',
                  border: '1px solid #ffe58f',
                  borderRadius: 2,
                  flexShrink: 0,
                }}
              />
              <Text style={{ fontSize: '0.7em', lineHeight: 1.2 }}>Стилобат</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  width: '0.8em',
                  height: '0.8em',
                  backgroundColor: '#fff2e8',
                  border: '1px solid #ffbb96',
                  borderRadius: 2,
                  flexShrink: 0,
                }}
              />
              <Text style={{ fontSize: '0.7em', lineHeight: 1.2 }}>Кровля</Text>
            </div>
          </div>
        </div>
      </div>

        {/* Табличное отображение корпусов */}
        <div style={{
          backgroundColor: '#fafafa',
          border: '1px solid #d9d9d9',
          height: 'calc(100vh - 240px)',
          overflow: 'hidden'
        }}>
          <Table
            dataSource={tableData}
            columns={tableColumns}
            pagination={false}
            scroll={{ x: 'max-content', y: 'calc(100vh - 280px)' }}
            size="small"
            bordered={false}
            showHeader={true}
            tableLayout="fixed"
            style={{
              backgroundColor: 'transparent',
              height: '100%'
            }}
            className="building-table"
            onHeaderRow={() => {
              console.log('🔍 Table header rendered')
              return {}
            }}
            onRow={() => {
              console.log('🔍 Table row rendered')
              return {}
            }}
          />
        </div>
        <style>{`
          .building-table .ant-table {
            table-layout: fixed !important;
          }
          .building-table .ant-table-tbody > tr > td {
            padding: 0 !important;
            border: none !important;
            height: 14.4px !important;
            vertical-align: top !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
          }
          .building-table .ant-table-thead > tr > th {
            padding: 2px 4px !important;
            background: #fafafa !important;
            border-bottom: 1px solid #d9d9d9 !important;
            text-align: center !important;
            font-size: 12px !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
          }
          .building-table .ant-table-tbody > tr:hover > td {
            background: transparent !important;
          }
        `}</style>
    </Modal>
  )
}
