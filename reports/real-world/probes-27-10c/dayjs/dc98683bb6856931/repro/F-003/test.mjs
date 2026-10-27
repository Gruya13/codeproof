import assert from 'node:assert/strict'
import dayjs from './index.js'
import duration from './plugin/duration/index.js'

dayjs.extend(duration)

const start = dayjs('2023-01-01')
const twoWeeksObj = dayjs.duration({ weeks: 2 })
const twoWeeksIso = dayjs.duration('P2W')

assert.equal(twoWeeksObj.weeks(), 2)
assert.equal(twoWeeksIso.weeks(), 2)
assert.equal(start.add(twoWeeksObj).format('YYYY-MM-DD'), '2023-01-15')
assert.equal(start.add(twoWeeksIso).format('YYYY-MM-DD'), '2023-01-15')
assert.equal(dayjs('2023-01-15').subtract(dayjs.duration({ weeks: 1 })).format('YYYY-MM-DD'), '2023-01-08')
assert.equal(dayjs('2023-01-15').subtract(dayjs.duration('P1W')).format('YYYY-MM-DD'), '2023-01-08')
assert.equal(start.add(dayjs.duration({ weeks: 1, days: 1 })).format('YYYY-MM-DD'), '2023-01-09')
