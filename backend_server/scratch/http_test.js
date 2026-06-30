const http = require('http');

function post(url, data, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const postData = JSON.stringify(data);
    const options = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, body: JSON.parse(body) });
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  try {
    const loginRes = await post('http://localhost:8000/api/auth/login', {
      nisn: '9900000002',
      password: 'siswa123',
      sessionToken: 'BF38EF',
      device_id: 'artillery-device-9900000002',
      device_name: 'Artillery Load Tester'
    });
    console.log('Login result:', loginRes);
    if (loginRes.status !== 200) return;
    
    const token = loginRes.body.data.accessToken;
    const valRes = await post('http://localhost:8000/api/exam-tokens/validate', {
      examId: 5,
      token: 'FBAD24'
    }, token);
    console.log('Validate result:', valRes);
  } catch (e) {
    console.error('Error:', e);
  }
}

main();
