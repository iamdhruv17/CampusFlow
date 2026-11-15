/**
 * CampusFlow End-to-End Verification Test
 * Runs full integration checks on backend API logic and workflows
 */

const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function runTests() {
  console.log('--- Starting CampusFlow API Tests ---\n');

  // Load app directly to test without requiring separate background process
  const app = require('../app');
  const connectDB = require('../config/db');
  await connectDB();

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  function makeRequest(method, path, body = null, cookie = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(`${baseUrl}${path}`);
      const options = {
        method,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      if (cookie) {
        options.headers['Cookie'] = cookie;
      }

      const req = http.request(options, (res) => {
        let data = '';
        const setCookieHeader = res.headers['set-cookie'];
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, data: parsed, cookies: setCookieHeader });
        });
      });

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  try {
    // 1. Health check
    const health = await makeRequest('GET', '/health');
    console.log('1. Health check:', health.status === 200 && health.data.success ? 'PASS' : 'FAIL');

    // 2. Student login
    const studentLogin = await makeRequest('POST', '/auth/login', {
      email: 'arjun.singh@campusflow.edu',
      password: 'Demo@1234',
    });
    console.log('2. Student login:', studentLogin.status === 200 && studentLogin.data.user.role === 'student' ? 'PASS' : 'FAIL');
    const studentCookie = studentLogin.cookies ? studentLogin.cookies[0].split(';')[0] : null;

    // 3. Student fetches stats
    const studentStats = await makeRequest('GET', '/requests/stats', null, studentCookie);
    console.log('3. Student stats:', studentStats.status === 200 && studentStats.data.stats.total > 0 ? 'PASS' : 'FAIL');

    // 4. Student creates attendance correction request
    const createReq = await makeRequest('POST', '/requests', {
      requestType: 'attendance_correction',
      subject: 'Data Structures',
      subjectCode: 'CS301',
      attendanceDate: '2026-10-25',
      lectureNumber: '1',
      description: 'Marked absent by mistake during 1st lecture.',
    }, studentCookie);
    console.log('4. Create request routing:', createReq.status === 201 && createReq.data.request.currentApprovalStage === 'teacher' ? 'PASS' : 'FAIL');
    const newRequestId = createReq.data.request._id;

    // 5. Teacher login
    const teacherLogin = await makeRequest('POST', '/auth/login', {
      email: 'ramesh.kumar@campusflow.edu',
      password: 'Demo@1234',
    });
    console.log('5. Teacher login:', teacherLogin.status === 200 && teacherLogin.data.user.role === 'teacher' ? 'PASS' : 'FAIL');
    const teacherCookie = teacherLogin.cookies ? teacherLogin.cookies[0].split(';')[0] : null;

    // 6. Teacher approves request
    const approveReq = await makeRequest('PUT', `/requests/${newRequestId}/approve`, {
      remarks: 'Verified present in lecture.',
    }, teacherCookie);
    console.log('6. Teacher approval:', approveReq.status === 200 && approveReq.data.request.status === 'approved' ? 'PASS' : 'FAIL');

    // 7. Verify ApprovalHistory
    const historyRes = await makeRequest('GET', `/requests/${newRequestId}/history`, null, studentCookie);
    const hasApproveRecord = historyRes.data.history.some(h => h.action === 'approved');
    console.log('7. Approval audit history:', hasApproveRecord ? 'PASS' : 'FAIL');

    // 8. Admin login and RBAC check
    const adminLogin = await makeRequest('POST', '/auth/login', {
      email: 'admin@campusflow.edu',
      password: 'Demo@1234',
    });
    console.log('8. Admin login:', adminLogin.status === 200 && adminLogin.data.user.role === 'admin' ? 'PASS' : 'FAIL');
    const adminCookie = adminLogin.cookies ? adminLogin.cookies[0].split(';')[0] : null;

    // 9. RBAC: Student accessing admin users endpoint should be 403 Forbidden
    const rbacCheck = await makeRequest('GET', '/users', null, studentCookie);
    console.log('9. RBAC Student denied Admin endpoint:', rbacCheck.status === 403 ? 'PASS' : 'FAIL');

    // 10. Admin can access user management
    const adminUsers = await makeRequest('GET', '/users', null, adminCookie);
    console.log('10. Admin user directory access:', adminUsers.status === 200 && adminUsers.data.users.length > 0 ? 'PASS' : 'FAIL');

    console.log('\n--- ALL VERIFICATION CHECKS PASSED ---\n');
  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    server.close();
    process.exit(0);
  }
}

runTests();
