const { parseListSort } = require('../parseListSort')

describe('parseListSort', () => {
  it('parses single sort (backward compatible)', () => {
    const { sortObject, sorts } = parseListSort(
      { sortBy: 'title', sortOrder: 'asc' },
      { tieBreaker: null }
    )
    expect(sorts).toEqual([{ field: 'title', order: 'asc' }])
    expect(sortObject).toEqual({ title: 1 })
  })

  it('parses multi-sort comma lists', () => {
    const { sortObject, sorts } = parseListSort(
      { sortBy: 'priority,dueDate,title', sortOrder: 'asc,desc,asc' },
      { tieBreaker: '_id' }
    )
    expect(sorts).toEqual([
      { field: 'priority', order: 'asc' },
      { field: 'dueDate', order: 'desc' },
      { field: 'title', order: 'asc' }
    ])
    expect(sortObject).toEqual({
      priority: 1,
      dueDate: -1,
      title: 1,
      _id: 1
    })
  })

  it('caps at max and dedupes fields', () => {
    const { sorts } = parseListSort(
      { sortBy: 'a,b,a,c,d', sortOrder: 'asc,desc,asc,asc,asc' },
      { max: 3, tieBreaker: null }
    )
    expect(sorts.map((s) => s.field)).toEqual(['a', 'b', 'c'])
  })

  it('rejects invalid field names and respects allowlist', () => {
    const { sorts } = parseListSort(
      { sortBy: 'priority,$where,dueDate', sortOrder: 'asc,asc,desc' },
      { allowedFields: ['priority', 'dueDate'], tieBreaker: null }
    )
    expect(sorts).toEqual([
      { field: 'priority', order: 'asc' },
      { field: 'dueDate', order: 'desc' }
    ])
  })

  it('falls back to defaults when empty', () => {
    const { sorts, sortObject } = parseListSort({}, { tieBreaker: null })
    expect(sorts).toEqual([{ field: 'createdAt', order: 'desc' }])
    expect(sortObject).toEqual({ createdAt: -1 })
  })
})
