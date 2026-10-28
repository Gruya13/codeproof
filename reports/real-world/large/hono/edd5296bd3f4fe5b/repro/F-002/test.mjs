import assert from 'node:assert/strict'
import { ALBProcessor } from './adapter/aws-lambda/handler.ts'

const processor = new ALBProcessor()
const base = {
  httpMethod: 'GET',
  path: '/search',
  headers: { host: 'example.com' },
  body: null,
  isBase64Encoded: false,
  requestContext: { elb: { targetGroupArn: 'arn:aws:elasticloadbalancing:test' } },
}

let error1 = null
let request1
try {
  request1 = processor.createRequest({
    ...base,
    queryStringParameters: { 'a&b': 'x y', q: 'a&b=c', lang: '日本語' },
  })
} catch (e) {
  error1 = e
}
assert.equal(error1, null)
const params1 = new URL(request1.url).searchParams
assert.equal(params1.get('a&b'), 'x y')
assert.equal(params1.get('q'), 'a&b=c')
assert.equal(params1.get('lang'), '日本語')
assert.equal(params1.get('b'), null)

let error2 = null
let request2
try {
  request2 = processor.createRequest({
    ...base,
    multiValueQueryStringParameters: { tag: ['a&b', 'c d', '日本語'], 'k&': ['v=1'] },
  })
} catch (e) {
  error2 = e
}
assert.equal(error2, null)
const params2 = new URL(request2.url).searchParams
assert.deepEqual(params2.getAll('tag'), ['a&b', 'c d', '日本語'])
assert.equal(params2.get('k&'), 'v=1')
assert.equal(params2.get('b'), null)
