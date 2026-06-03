import http from 'k6/http';
import { check, sleep } from 'k6';

const base = __ENV.ATP_SUT_API_URL || __ENV.SUT_API_URL || 'http://localhost:3000';

export const options = {
  vus: Number(__ENV.K6_VUS || 5),
  duration: __ENV.K6_DURATION || '30s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<3000'],
  },
};

export default function healthReady() {
  const res = http.get(`${base.replace(/\/$/, '')}/health/ready`);
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(0.2);
}
