/**
 * CampusFlow — Full Workflow & Edge Case Verification Suite
 *
 * Verifies:
 * 1. Medical Leave: Rejection at Coordinator stage
 * 2. Medical Leave: Rejection at Mentor stage
 * 3. Medical Leave: Rejection at HOD stage
 * 4. Medical Leave: Rejection at Dean stage
 * 5. Medical Leave: Return for correction by Coordinator -> Student Resubmission -> Approval
 * 6. Audit Trail: Preservation of all events across returns and resubmissions
 * 7. Stage Skipping Prevention: Unauthorized approver / wrong stage approver blocked (403)
 * 8. Attendance Correction: Submission with document attachment -> Teacher approval -> Document access
 * 9. Event Attendance: Submission with document attachment -> Teacher approval -> Document access
 * 10. Other Academic Grievance: Submission with document attachment -> HOD approval -> Document access
 *
 * All test records and Cloudinary assets are cleanly isolated and deleted afterward.
 */

const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const Request = require('../models/Request');
const FileRecord = require('../models/FileRecord');
const { deleteFileRecord } = require('../services/storage.service');
const { configureCloudinary } = require('../config/cloudinary');

const PDF_SAMPLE = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF', 'utf-8');
const JPEG_SAMPLE = Buffer.from([
  0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46,
  0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xD9,
]);
const PNG_SAMPLE = Buffer.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
  0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06,
  0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89,
]);

async function runFullVerification() {
  console.log('====================================================');
  console.log('  CampusFlow — Extended Workflow Verification Suite');
  console.log('====================================================\n');

  configureCloudinary();
  const app = require('../app');
  const connectDB = require('../config/db');
  await connectDB();

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  const createdRequestIds = [];
  const createdFileRecordIds = [];

  function req(method, urlPath, body = null, cookie = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(`${baseUrl}${urlPath}`);
      const options = {
        method,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        headers: { 'Content-Type': 'application/json' },
      };
      if (cookie) options.headers['Cookie'] = cookie;

      const r = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try { parsed = JSON.parse(data); } catch { parsed = data; }
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        });
      });
      r.on('error', reject);
      if (body) r.write(JSON.stringify(body));
      r.end();
    });
  }

  function reqMultipart(urlPath, fields, files = [], cookie = null, method = 'POST') {
    return new Promise((resolve, reject) => {
      const url = new URL(`${baseUrl}${urlPath}`);
      const boundary = '----CampusFlowExtBoundary' + Math.random().toString(16).substring(2);
      const parts = [];

      for (const [key, val] of Object.entries(fields)) {
        let part = `--${boundary}\r\n`;
        part += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
        part += `${val}\r\n`;
        parts.push(Buffer.from(part, 'utf-8'));
      }

      for (const f of files) {
        let header = `--${boundary}\r\n`;
        header += `Content-Disposition: form-data; name="files"; filename="${f.filename}"\r\n`;
        header += `Content-Type: ${f.mimetype}\r\n\r\n`;
        parts.push(Buffer.from(header, 'utf-8'));
        parts.push(f.buffer);
        parts.push(Buffer.from('\r\n', 'utf-8'));
      }

      parts.push(Buffer.from(`--${boundary}--\r\n`, 'utf-8'));
      const body = Buffer.concat(parts);

      const options = {
        method,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
          Cookie: cookie,
        },
      };

      const r = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try { parsed = JSON.parse(data); } catch { parsed = data; }
          resolve({ status: res.statusCode, data: parsed });
        });
      });
      r.on('error', reject);
      r.write(body);
      r.end();
    });
  }

  async function login(email) {
    const res = await req('POST', '/auth/login', { email, password: 'Demo@1234' });
    const cookie = res.headers?.['set-cookie'] ? res.headers['set-cookie'][0].split(';')[0] : null;
    return cookie;
  }

  try {
    const studentCookie = await login('arjun.singh@campusflow.edu');
    const teacherCookie = await login('ramesh.kumar@campusflow.edu');
    const coordCookie = await login('sunita.sharma@campusflow.edu');
    const mentorCookie = await login('vijay.mehta@campusflow.edu');
    const hodCookie = await login('priya.verma@campusflow.edu');
    const deanCookie = await login('anil.gupta@campusflow.edu');

    // ─────────────────────────────────────────────────────────────────────────
    // Test A: Stage Skipping Prevention
    // ─────────────────────────────────────────────────────────────────────────
    const subRes = await reqMultipart(
      '/requests',
      {
        requestType: 'medical_leave',
        leaveStartDate: '2026-12-01',
        leaveEndDate: '2026-12-05',
        medicalDescription: 'Fever',
        description: 'Testing stage-skipping prevention.',
      },
      [{ filename: 'med_cert_skip.pdf', mimetype: 'application/pdf', buffer: PDF_SAMPLE }],
      studentCookie
    );
    const rSkipId = subRes.data?.request?._id;
    if (rSkipId) createdRequestIds.push(rSkipId);
    if (subRes.data?.request?.attachments?.[0]?._id) {
      createdFileRecordIds.push(subRes.data.request.attachments[0]._id);
    }

    // Mentor attempts to approve while stage is Coordinator -> Should be 403
    const mentorEarly = await req('PUT', `/requests/${rSkipId}/approve`, { remarks: 'Trying to skip' }, mentorCookie);
    // Dean attempts to approve -> Should be 403
    const deanEarly = await req('PUT', `/requests/${rSkipId}/approve`, { remarks: 'Trying to skip' }, deanCookie);

    const testAPass = mentorEarly.status === 403 && deanEarly.status === 403;
    console.log(`1. Stage skipping prevented (Mentor & Dean blocked at Coordinator stage): ${testAPass ? 'PASS' : 'FAIL'}`);

    // ─────────────────────────────────────────────────────────────────────────
    // Test B: Coordinator Rejection
    // ─────────────────────────────────────────────────────────────────────────
    const coordReject = await req('PUT', `/requests/${rSkipId}/reject`, {
      remarks: 'Invalid medical certificate submitted.',
    }, coordCookie);
    const testBPass = coordReject.status === 200 &&
      coordReject.data?.request?.status === 'rejected' &&
      coordReject.data?.request?.currentApprovalStage === 'rejected';
    console.log(`2. Coordinator rejection terminates chain with status=rejected: ${testBPass ? 'PASS' : 'FAIL'}`);

    // ─────────────────────────────────────────────────────────────────────────
    // Test C: Mentor Rejection
    // ─────────────────────────────────────────────────────────────────────────
    const subC = await reqMultipart(
      '/requests',
      {
        requestType: 'medical_leave',
        leaveStartDate: '2026-12-10',
        leaveEndDate: '2026-12-12',
        medicalDescription: 'Flu',
        description: 'Testing mentor rejection.',
      },
      [{ filename: 'med_cert_mentor_rej.pdf', mimetype: 'application/pdf', buffer: PDF_SAMPLE }],
      studentCookie
    );
    const rMentorRejId = subC.data?.request?._id;
    if (rMentorRejId) createdRequestIds.push(rMentorRejId);
    if (subC.data?.request?.attachments?.[0]?._id) {
      createdFileRecordIds.push(subC.data.request.attachments[0]._id);
    }

    // Coordinator approves -> advances to mentor
    await req('PUT', `/requests/${rMentorRejId}/approve`, { remarks: 'Coord ok' }, coordCookie);
    // Mentor rejects
    const mentorRej = await req('PUT', `/requests/${rMentorRejId}/reject`, {
      remarks: 'Attendance too low to recommend leave.',
    }, mentorCookie);
    const testCPass = mentorRej.status === 200 &&
      mentorRej.data?.request?.status === 'rejected' &&
      mentorRej.data?.request?.currentApprovalStage === 'rejected';
    console.log(`3. Mentor rejection terminates chain with status=rejected: ${testCPass ? 'PASS' : 'FAIL'}`);

    // ─────────────────────────────────────────────────────────────────────────
    // Test D: HOD Rejection
    // ─────────────────────────────────────────────────────────────────────────
    const subD = await reqMultipart(
      '/requests',
      {
        requestType: 'medical_leave',
        leaveStartDate: '2026-12-15',
        leaveEndDate: '2026-12-18',
        medicalDescription: 'Back Pain',
        description: 'Testing HOD rejection.',
      },
      [{ filename: 'med_cert_hod_rej.pdf', mimetype: 'application/pdf', buffer: PDF_SAMPLE }],
      studentCookie
    );
    const rHodRejId = subD.data?.request?._id;
    if (rHodRejId) createdRequestIds.push(rHodRejId);
    if (subD.data?.request?.attachments?.[0]?._id) {
      createdFileRecordIds.push(subD.data.request.attachments[0]._id);
    }

    await req('PUT', `/requests/${rHodRejId}/approve`, { remarks: 'Coord ok' }, coordCookie);
    await req('PUT', `/requests/${rHodRejId}/approve`, { remarks: 'Mentor ok' }, mentorCookie);
    const hodRej = await req('PUT', `/requests/${rHodRejId}/reject`, {
      remarks: 'Department recommendation denied.',
    }, hodCookie);
    const testDPass = hodRej.status === 200 &&
      hodRej.data?.request?.status === 'rejected' &&
      hodRej.data?.request?.currentApprovalStage === 'rejected';
    console.log(`4. HOD rejection terminates chain with status=rejected: ${testDPass ? 'PASS' : 'FAIL'}`);

    // ─────────────────────────────────────────────────────────────────────────
    // Test E: Dean Rejection
    // ─────────────────────────────────────────────────────────────────────────
    const subE = await reqMultipart(
      '/requests',
      {
        requestType: 'medical_leave',
        leaveStartDate: '2026-12-20',
        leaveEndDate: '2026-12-22',
        medicalDescription: 'Dental Surgery',
        description: 'Testing Dean rejection.',
      },
      [{ filename: 'med_cert_dean_rej.pdf', mimetype: 'application/pdf', buffer: PDF_SAMPLE }],
      studentCookie
    );
    const rDeanRejId = subE.data?.request?._id;
    if (rDeanRejId) createdRequestIds.push(rDeanRejId);
    if (subE.data?.request?.attachments?.[0]?._id) {
      createdFileRecordIds.push(subE.data.request.attachments[0]._id);
    }

    await req('PUT', `/requests/${rDeanRejId}/approve`, { remarks: 'Coord ok' }, coordCookie);
    await req('PUT', `/requests/${rDeanRejId}/approve`, { remarks: 'Mentor ok' }, mentorCookie);
    await req('PUT', `/requests/${rDeanRejId}/approve`, { remarks: 'HOD ok' }, hodCookie);
    const deanRej = await req('PUT', `/requests/${rDeanRejId}/reject`, {
      remarks: 'Final institutional rejection by Dean.',
    }, deanCookie);
    const testEPass = deanRej.status === 200 &&
      deanRej.data?.request?.status === 'rejected' &&
      deanRej.data?.request?.currentApprovalStage === 'rejected';
    console.log(`5. Dean rejection terminates chain with status=rejected: ${testEPass ? 'PASS' : 'FAIL'}`);

    // ─────────────────────────────────────────────────────────────────────────
    // Test F: Return for Correction -> Student Resubmission -> Approval
    // ─────────────────────────────────────────────────────────────────────────
    const subF = await reqMultipart(
      '/requests',
      {
        requestType: 'medical_leave',
        leaveStartDate: '2026-12-25',
        leaveEndDate: '2026-12-28',
        medicalDescription: 'Cold and Cough',
        description: 'Testing return and resubmit workflow.',
      },
      [{ filename: 'med_cert_initial.pdf', mimetype: 'application/pdf', buffer: PDF_SAMPLE }],
      studentCookie
    );
    const rReturnId = subF.data?.request?._id;
    if (rReturnId) createdRequestIds.push(rReturnId);
    if (subF.data?.request?.attachments?.[0]?._id) {
      createdFileRecordIds.push(subF.data.request.attachments[0]._id);
    }

    // Coordinator returns for correction
    const returnAction = await req('PUT', `/requests/${rReturnId}/return`, {
      remarks: 'Prescription missing doctor seal. Please re-upload with hospital seal.',
    }, coordCookie);

    const isReturned = returnAction.status === 200 && returnAction.data?.request?.status === 'returned';

    // Student resubmits with additional document
    const resubmitAction = await reqMultipart(
      `/requests/${rReturnId}/resubmit`,
      {
        description: 'Updated prescription with official hospital seal attached.',
      },
      [{ filename: 'sealed_certificate.jpg', mimetype: 'image/jpeg', buffer: JPEG_SAMPLE }],
      studentCookie,
      'PUT'
    );
    const isResubmitted = resubmitAction.status === 200 &&
      resubmitAction.data?.request?.status === 'under_review' &&
      resubmitAction.data?.request?.currentApprovalStage === 'coordinator';

    if (resubmitAction.data?.request?.attachments) {
      for (const a of resubmitAction.data.request.attachments) {
        const id = a._id || a;
        if (!createdFileRecordIds.includes(id)) createdFileRecordIds.push(id);
      }
    }

    // Coordinator now approves resubmitted request
    const coordApproveResub = await req('PUT', `/requests/${rReturnId}/approve`, {
      remarks: 'Hospital seal verified. Forwarding to Mentor.',
    }, coordCookie);

    // Verify history audit trail has all steps preserved: submitted -> returned -> resubmitted -> forwarded
    const histRes = await req('GET', `/requests/${rReturnId}/history`, null, studentCookie);
    const historyActions = (histRes.data?.history || []).map(h => h.action);
    const hasAllSteps =
      historyActions.includes('submitted') &&
      historyActions.includes('returned') &&
      historyActions.includes('resubmitted') &&
      historyActions.includes('forwarded');

    const testFPass = isReturned && isResubmitted && coordApproveResub.status === 200 && hasAllSteps;
    console.log(`6. Return for correction -> Resubmit -> Coordinator approves & history preserved: ${testFPass ? 'PASS' : 'FAIL'}`);

    // ─────────────────────────────────────────────────────────────────────────
    // Test G: Attendance Correction with Document Attachment
    // ─────────────────────────────────────────────────────────────────────────
    const attCorr = await reqMultipart(
      '/requests',
      {
        requestType: 'attendance_correction',
        subject: 'Data Structures',
        subjectCode: 'CS301',
        attendanceDate: '2026-11-05',
        lectureNumber: '1',
        description: 'Attached attendance portal screenshot as proof.',
      },
      [{ filename: 'att_proof.png', mimetype: 'image/png', buffer: PNG_SAMPLE }],
      studentCookie
    );
    const rAttId = attCorr.data?.request?._id;
    if (rAttId) createdRequestIds.push(rAttId);
    const attFileId = attCorr.data?.request?.attachments?.[0]?._id;
    if (attFileId) createdFileRecordIds.push(attFileId);

    // Teacher Ramesh Kumar approves
    const tApprove = await req('PUT', `/requests/${rAttId}/approve`, {
      remarks: 'Attendance record verified against lecture log.',
    }, teacherCookie);

    // Teacher can view the attachment
    const tView = await req('GET', `/files/${attFileId}`, null, teacherCookie);
    const testGPass = attCorr.status === 201 &&
      tApprove.status === 200 &&
      tApprove.data?.request?.status === 'approved' &&
      tView.status === 200 &&
      (tView.data?.signedUrl || tView.data?.data?.signedUrl);
    console.log(`7. Attendance Correction with document -> Teacher approves -> View signed URL: ${testGPass ? 'PASS' : 'FAIL'}`);

    // ─────────────────────────────────────────────────────────────────────────
    // Test H: Event Attendance with Document Attachment
    // ─────────────────────────────────────────────────────────────────────────
    const eventAtt = await reqMultipart(
      '/requests',
      {
        requestType: 'event_attendance',
        eventName: 'National Cyber Security Hackathon',
        eventDate: '2026-11-08',
        eventOrganizer: 'CSI Student Branch',
        subject: 'Data Structures',
        description: 'Won 1st prize in national level cyber competition.',
      },
      [{ filename: 'event_win_cert.pdf', mimetype: 'application/pdf', buffer: PDF_SAMPLE }],
      studentCookie
    );
    const rEvtId = eventAtt.data?.request?._id;
    if (rEvtId) createdRequestIds.push(rEvtId);
    const evtFileId = eventAtt.data?.request?.attachments?.[0]?._id;
    if (evtFileId) createdFileRecordIds.push(evtFileId);

    const evtApprove = await req('PUT', `/requests/${rEvtId}/approve`, {
      remarks: 'Congratulations! Attendance credit approved.',
    }, teacherCookie);

    const sViewEvt = await req('GET', `/files/${evtFileId}`, null, studentCookie);
    const testHPass = eventAtt.status === 201 &&
      evtApprove.status === 200 &&
      evtApprove.data?.request?.status === 'approved' &&
      sViewEvt.status === 200 &&
      (sViewEvt.data?.signedUrl || sViewEvt.data?.data?.signedUrl);
    console.log(`8. Event Attendance with document -> Teacher approves -> Student view signed URL: ${testHPass ? 'PASS' : 'FAIL'}`);

    // ─────────────────────────────────────────────────────────────────────────
    // Test I: Other Academic Grievance with Document Attachment
    // ─────────────────────────────────────────────────────────────────────────
    const griev = await reqMultipart(
      '/requests',
      {
        requestType: 'other_grievance',
        grievanceCategory: 'Lab Equipment Malfunction',
        targetDepartment: 'Computer Science',
        description: 'System crashed during practical evaluation, lost code.',
      },
      [{ filename: 'lab_incident_photo.jpg', mimetype: 'image/jpeg', buffer: JPEG_SAMPLE }],
      studentCookie
    );
    const rGrievId = griev.data?.request?._id;
    if (rGrievId) createdRequestIds.push(rGrievId);
    const grievFileId = griev.data?.request?.attachments?.[0]?._id;
    if (grievFileId) createdFileRecordIds.push(grievFileId);

    // Initial stage is HOD
    const isHodStage = griev.data?.request?.currentApprovalStage === 'hod';

    const hodApprove = await req('PUT', `/requests/${rGrievId}/approve`, {
      remarks: 'Lab in-charge notified, re-attempt granted.',
    }, hodCookie);

    const testIPass = griev.status === 201 &&
      isHodStage &&
      hodApprove.status === 200 &&
      hodApprove.data?.request?.status === 'approved';
    console.log(`9. Other Grievance with document -> Routed to HOD -> HOD approves: ${testIPass ? 'PASS' : 'FAIL'}`);

    // ─────────────────────────────────────────────────────────────────────────
    // Test J: Verified Content Integrity (Cloudinary Raw Delivery)
    // ─────────────────────────────────────────────────────────────────────────
    // Fetch the actual signed URL from Cloudinary via HTTPS and verify content length
    const https = require('https');
    const signedUrlRes = await req('GET', `/files/${attFileId}`, null, studentCookie);
    const signedUrl = signedUrlRes.data?.signedUrl || signedUrlRes.data?.data?.signedUrl;

    const dlBuf = await new Promise((resolve) => {
      https.get(signedUrl, (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      });
    });

    const testJPass = dlBuf.equals(PNG_SAMPLE);
    console.log(`10. Cloudinary downloaded binary matches uploaded file byte-for-byte: ${testJPass ? 'PASS' : 'FAIL'}`);

    const allPass = testAPass && testBPass && testCPass && testDPass && testEPass &&
      testFPass && testGPass && testHPass && testIPass && testJPass;

    console.log('\n====================================================');
    console.log(allPass ? '  ALL 10 EXTENDED WORKFLOW TESTS PASSED' : '  SOME TESTS FAILED');
    console.log('====================================================\n');

  } finally {
    // Clean up only test records
    console.log('Cleaning up test records and Cloudinary assets...');
    for (const fId of createdFileRecordIds) {
      try { await deleteFileRecord(fId); } catch {}
    }
    for (const rId of createdRequestIds) {
      try { await Request.findByIdAndDelete(rId); } catch {}
    }
    server.close();
    process.exit(0);
  }
}

runFullVerification().catch(err => {
  console.error('Error in extended verification:', err);
  process.exit(1);
});
