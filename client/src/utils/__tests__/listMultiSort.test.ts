import { describe, expect, it } from 'vitest'
import {
  applyColumnSortClick,
  applyExplicitColumnSort,
  normalizeSortSpecs,
  removeColumnSort,
  serializeSortsForApi,
  sortRankForField
} from '../listMultiSort'

describe('listMultiSort', () => {
  it('replace click toggles sole primary', () => {
    expect(applyColumnSortClick([{ field: 'title', order: 'asc' }], 'title')).toEqual([
      { field: 'title', order: 'desc' }
    ])
    expect(applyColumnSortClick([{ field: 'title', order: 'asc' }], 'priority')).toEqual([
      { field: 'priority', order: 'asc' }
    ])
  })

  it('shift-click builds a ranked stack', () => {
    const one = applyColumnSortClick([], 'title', { additive: true })
    const two = applyColumnSortClick(one, 'priority', { additive: true })
    expect(two).toEqual([
      { field: 'title', order: 'asc' },
      { field: 'priority', order: 'asc' }
    ])
    expect(sortRankForField(two, 'priority')).toBe(2)
    expect(applyColumnSortClick(two, 'title', { additive: true })[0].order).toBe('desc')
  })

  it('caps additive sorts at 3', () => {
    let sorts = normalizeSortSpecs([
      { field: 'a', order: 'asc' },
      { field: 'b', order: 'asc' },
      { field: 'c', order: 'asc' }
    ])
    sorts = applyColumnSortClick(sorts, 'd', { additive: true })
    expect(sorts.map((s) => s.field)).toEqual(['a', 'b', 'c'])
  })

  it('explicit sort replaces the stack', () => {
    expect(
      applyExplicitColumnSort(
        [
          { field: 'a', order: 'asc' },
          { field: 'b', order: 'desc' }
        ],
        'status',
        'desc'
      )
    ).toEqual([{ field: 'status', order: 'desc' }])
  })

  it('removeColumnSort drops one level', () => {
    expect(
      removeColumnSort(
        [
          { field: 'a', order: 'asc' },
          { field: 'b', order: 'desc' }
        ],
        'a'
      )
    ).toEqual([{ field: 'b', order: 'desc' }])
  })

  it('serializes multi-sort for API', () => {
    expect(
      serializeSortsForApi([
        { field: 'priority', order: 'asc' },
        { field: 'dueDate', order: 'desc' }
      ])
    ).toEqual({ sortBy: 'priority,dueDate', sortOrder: 'asc,desc' })
  })
})
