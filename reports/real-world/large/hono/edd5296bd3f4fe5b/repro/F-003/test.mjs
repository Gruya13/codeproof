import assert from 'node:assert/strict'
import { LatticeV2Processor } from './adapter/aws-lambda/handler.ts'

const processor = new LatticeV2Processor()
const event = {
  version: '2.0',
  path: '/search',
  method: 'GET',
  headers: { host: ['example.com'] },
  queryStringParameters: { q: ['hono'], tag: ['a', 'b'], page: ['2'] },
  body: null,
  isBase64Encoded: false,
  requestContext: {
    serviceArn: 'arn:aws:vpc-lattice:us-east-1:123456789012:service/svc-123',
  },
}
let request
let thrown = null
try {
  request = processor.createRequest(event)
} catch (error) {
  thrown = error
}
assert.equal(thrown, null)
assert.ok(request instanceof Request)
const url = new URL(request.url)
assert.equal(url.pathname, '/search')
assert.equal(url.searchParams.get('q'), 'hono')
assert.deepEqual(url.searchParams.getAll('tag'), ['a', 'b'])
assert.equal(url.searchParams.get('page'), '2')
