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
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  const fs = require('fs');
  const csv = fs.readFileSync('users.csv', 'utf8').trim().split('\n').slice(1);
  
  console.log('Testing users from index 200 to 230 from CSV...');
  for (let i = 200; i < 230; i++) {
    const [nisn, password] = csv[i].split(',').map(s => s.trim());
    try {
      const loginRes = await post('http://localhost:8000/api/auth/login', {
        nisn,
        password,
        sessionToken: 'BF38EF',
        device_id: `artillery-device-${nisn}`,
        device_name: 'Artillery Load Tester'
      });
      
      if (loginRes.status !== 200) {
        console.log(`User ${nisn} Login Failed with status ${loginRes.status}:`, loginRes.body);
        continue;
      }
      
      const token = loginRes.body.data.accessToken;
      const valRes = await post('http://localhost:8000/api/exam-tokens/validate', {
        examId: 5,
        token: 'FBAD24'
      }, token);
      
      if (valRes.status !== 200) {
        console.log(`User ${nisn} Validate Failed with status ${valRes.status}:`, valRes.body);
      } else {
        console.log(`User ${nisn} Validate Success!`);
      }
    } catch (err) {
      console.error(`User ${nisn} Error:`, err.message);
    }
  }
}

main();
