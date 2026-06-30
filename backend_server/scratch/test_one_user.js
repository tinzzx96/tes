async function main() {
  try {
    const loginRes = await fetch('http://localhost:8000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nisn: '9900000002',
        password: 'siswa123',
        sessionToken: 'BF38EF',
        device_id: 'artillery-device-9900000002',
        device_name: 'Artillery Load Tester'
      })
    });
    const loginData = await loginRes.json();
    console.log('Login status:', loginRes.status);
    console.log('Login success:', loginData);
    
    if (loginRes.status !== 200) return;
    
    const token = loginData.data.accessToken;

    const valRes = await fetch('http://localhost:8000/api/exam-tokens/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        examId: 5,
        token: 'FBAD24'
      })
    });
    const valData = await valRes.json();
    console.log('Validate status:', valRes.status);
    console.log('Validate result:', valData);

  } catch (err) {
    console.error('Error:', err);
  }
}

main();
