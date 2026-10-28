import assert from 'node:assert/strict'
import { getProcessor } from './adapter/aws-lambda/handler.ts'

const event = {
  httpMethod: 'GET',
  path: '/',
  body: null,
  isBase64Encoded: false,
  queryStringParameters: {},
  multiValueHeaders: {
    host: ['example.com'],
    'x-forwarded-for': ['203.0.113.1', '198.51.100.2'],
  },
  requestContext: {
    elb: {
      targetGroupArn:
        'arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/test/abc',
    },
  },
}

let request
let caught = null
try {
  request = getProcessor(event).createRequest(event)
} catch (error) {
  caught = error
}

assert.equal(caught, null)
assert.equal(request?.headers.get('x-forwarded-for'), '203.0.113.1, 198.51.100.2')
