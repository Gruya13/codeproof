import assert from 'node:assert/strict';
import dayjs from './index.js';
import duration from './plugin/duration/index.js';

dayjs.extend(duration);

let error = null;
let negativeDay;
let negativeTime;
let positiveDay;
try {
  negativeDay = dayjs.duration('-P1D');
  negativeTime = dayjs.duration('-PT2H30M');
  positiveDay = dayjs.duration('P1D');
} catch (e) {
  error = e;
}
assert.equal(error, null);
assert.equal(negativeDay.asDays(), -1);
assert.equal(negativeDay.days(), -1);
assert.equal(negativeDay.asMilliseconds(), -86400000);
assert.equal(negativeDay.toISOString(), '-P1D');
assert.equal(negativeTime.asMinutes(), -150);
assert.equal(negativeTime.hours(), -2);
assert.equal(negativeTime.minutes(), -30);
assert.equal(positiveDay.asDays(), 1);
